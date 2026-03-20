# Canvas Performance Fix Guide
> Đây là chỉ dẫn implement các fix performance cho canvas khi render file có lượng node lớn (70K+).
> Mục tiêu: loại bỏ freeze sau khi load file và sau khi kết thúc gesture zoom/pan.

---

## Bối cảnh (Context)

**Stack:** CanvasKit/Skia WASM, React 19, Zustand v5, Electron 35
**File chính:** `src/canvas/skia/skia-engine.ts`, `src/canvas/skia/skia-renderer.ts`, `src/canvas/skia/skia-canvas.tsx`

**Vấn đề đang xảy ra:**
1. Load file lớn → canvas render xong → **đơ ~1-2s** → mới điều khiển được
2. Zoom/pan xong → **đơ ~500ms-1s** → kết quả mới hiển thị
3. Navigate tab bật + có selection → **lag liên tục** mỗi frame

**Root cause đã xác định:**
- `render()` chạy full-fidelity cho 70K nodes ở 2% zoom (waste 99% GPU work)
- BFS connection maps rebuild O(connections) **mỗi render frame** thay vì cache
- Canvas element thiếu `tabIndex` → không auto-focus khi mount

---

## Wave 1 — Quick Wins (Ưu tiên làm trước, ~1 ngày)

---

### Fix W1-1: LOD (Level-of-Detail) Rendering

**File:** `src/canvas/skia/skia-engine.ts`
**Vị trí:** Vòng lặp render chính, khoảng line 695–712 (phần `for (const rn of this.renderNodes)`)

**Hiện tại:**
```typescript
for (const rn of this.renderNodes) {
  // Viewport culling
  if (rn.absX + rn.absW < vpLeft - vpMargin || rn.absX > vpRight + vpMargin ||
      rn.absY + rn.absH < vpTop - vpMargin || rn.absY > vpBottom + vpMargin) {
    continue
  }
  try {
    this.renderer.drawNode(canvas, rn, selectedIds)
  } catch { }
}
```

**Sửa thành:**
```typescript
for (const rn of this.renderNodes) {
  // Viewport culling (existing)
  if (rn.absX + rn.absW < vpLeft - vpMargin || rn.absX > vpRight + vpMargin ||
      rn.absY + rn.absH < vpTop - vpMargin || rn.absY > vpBottom + vpMargin) {
    continue
  }

  // LOD: tính kích thước thực tế trên màn hình (pixels)
  const pixelW = rn.absW * this.zoom
  const pixelH = rn.absH * this.zoom

  // Sub-pixel: bỏ qua hoàn toàn
  if (pixelW < 1 && pixelH < 1) continue

  try {
    this.renderer.drawNode(canvas, rn, selectedIds, pixelW, pixelH)
  } catch { }
}
```

---

**File:** `src/canvas/skia/skia-renderer.ts`
**Vị trí:** Method `drawNode()` (tìm `drawNode(` trong file)

Thêm tham số `pixelW` và `pixelH`, áp dụng LOD tiers:

```typescript
drawNode(
  canvas: Canvas,
  rn: RenderNode,
  selectedIds: Set<string>,
  pixelW = 9999,   // default: full render nếu không truyền
  pixelH = 9999,
) {
  const node = rn.node

  // LOD Tier 1: node cực nhỏ (<8px) → chỉ vẽ màu fill solid
  if (pixelW < 8 && pixelH < 8) {
    if (node.fill && node.fill.length > 0 && node.fill[0].type === 'solid') {
      const paint = new this.ck.Paint()
      const color = parseColor(this.ck, node.fill[0].color ?? '#cccccc')
      paint.setColor(color)
      canvas.drawRect(
        this.ck.XYWHRect(rn.absX, rn.absY, rn.absW, rn.absH),
        paint,
      )
      paint.delete()
    }
    return
  }

  // LOD Tier 2: node nhỏ (<24px) → vẽ fill + stroke, BỎ: text, shadow, blur, image
  if (pixelW < 24 && pixelH < 24) {
    this.drawSimplifiedNode(canvas, rn)
    return
  }

  // Full render (existing code)
  this.drawFullNode(canvas, rn, selectedIds)
}
```

Tách code render hiện tại ra method `drawFullNode()`. Thêm method `drawSimplifiedNode()`:

```typescript
private drawSimplifiedNode(canvas: Canvas, rn: RenderNode) {
  // Chỉ vẽ fill color + stroke outline, không text, không effects
  const node = rn.node
  const paint = new this.ck.Paint()

  // Fill
  if (node.fill && node.fill.length > 0) {
    const fill = node.fill[0]
    if (fill.type === 'solid') {
      paint.setColor(parseColor(this.ck, fill.color ?? '#cccccc'))
      paint.setStyle(this.ck.PaintStyle.Fill)
      canvas.drawRect(this.ck.XYWHRect(rn.absX, rn.absY, rn.absW, rn.absH), paint)
    }
  }

  // Stroke
  if (node.stroke?.color) {
    paint.setColor(parseColor(this.ck, node.stroke.color))
    paint.setStyle(this.ck.PaintStyle.Stroke)
    paint.setStrokeWidth((node.stroke.width ?? 1))
    canvas.drawRect(this.ck.XYWHRect(rn.absX, rn.absY, rn.absW, rn.absH), paint)
  }

  paint.delete()
}
```

**Expected gain:** render() từ ~500ms → ~20-30ms ở zoom thấp (2-10%)

---

### Fix W1-2: Cache BFS Connection Maps

**File:** `src/canvas/skia/skia-engine.ts`
**Vấn đề:** Khoảng line 861–910, `outMap`/`inMap` và BFS traversal được tạo lại TỪ ĐẦU mỗi render frame.

**Thêm cache fields vào class SkiaEngine:**
```typescript
// Connection BFS cache — invalidated when selection or connections change
private _bfsSelectionKey = ''          // JSON.stringify(selectedIds) snapshot
private _bfsConnectionsKey = ''        // JSON.stringify(connections) snapshot
private _cachedConnectedIds: Set<string> = new Set()
private _cachedChainConns: Set<unknown> = new Set()
```

**Sửa đoạn BFS trong render() thành:**
```typescript
if (showConnections && selectedIds.size > 0 && !this.isPanning) {
  const allConnections = docState.document.connections ?? []

  // Tạo cache key
  const selKey = [...selectedIds].sort().join(',')
  const connKey = String(allConnections.length)  // dùng length thay JSON để nhanh hơn

  // Chỉ rebuild khi selection hoặc connections thay đổi
  if (selKey !== this._bfsSelectionKey || connKey !== this._bfsConnectionsKey) {
    this._bfsSelectionKey = selKey
    this._bfsConnectionsKey = connKey

    // Build maps (chỉ khi cache invalid)
    const outMap = new Map<string, typeof allConnections>()
    const inMap = new Map<string, typeof allConnections>()
    for (const c of allConnections) {
      const outs = outMap.get(c.sourceElementId) ?? []
      outs.push(c)
      outMap.set(c.sourceElementId, outs)
      const ins = inMap.get(c.targetFrameId) ?? []
      ins.push(c)
      inMap.set(c.targetFrameId, ins)
    }

    // BFS
    const visitedIds = new Set<string>(selectedIds)
    const chainConns = new Set<typeof allConnections[0]>()
    const queue = [...selectedIds]
    while (queue.length > 0) {
      const id = queue.shift()!
      for (const c of outMap.get(id) ?? []) {
        chainConns.add(c)
        if (!visitedIds.has(c.targetFrameId)) {
          visitedIds.add(c.targetFrameId); queue.push(c.targetFrameId)
        }
      }
      for (const c of inMap.get(id) ?? []) {
        chainConns.add(c)
        if (!visitedIds.has(c.sourceElementId)) {
          visitedIds.add(c.sourceElementId); queue.push(c.sourceElementId)
        }
      }
    }

    const connectedIds = new Set<string>(visitedIds)
    for (const id of visitedIds) {
      const parent = docState.getParentOf(id)
      if (parent) connectedIds.add(parent.id)
    }

    this._cachedConnectedIds = connectedIds
    this._cachedChainConns = chainConns as Set<unknown>
  }

  // Dùng cached results để render (code render giữ nguyên)
  const connectedIds = this._cachedConnectedIds
  const chainConns = this._cachedChainConns
  // ... phần còn lại của connection rendering ...
}
```

**Thêm invalidation** trong `syncFromDocument()` (sau khi rebuild renderNodes):
```typescript
// Invalidate BFS cache khi document thay đổi
this._bfsSelectionKey = ''
this._bfsConnectionsKey = ''
```

**Expected gain:** Loại bỏ O(connections) blocking work mỗi frame → smooth 60fps khi navigate.

---

### Fix W1-3: Canvas tabIndex + Auto-focus

**File:** `src/canvas/skia/skia-canvas.tsx`
**Vị trí:** JSX return, khoảng line 1552

**Hiện tại:**
```tsx
<canvas
  ref={canvasRef}
  className="absolute inset-0 w-full h-full"
/>
```

**Sửa thành:**
```tsx
<canvas
  ref={canvasRef}
  tabIndex={0}
  className="absolute inset-0 w-full h-full outline-none"
/>
```

**Thêm auto-focus** trong useEffect init (sau `engine.init(canvasEl)`):
```typescript
engine.init(canvasEl)
canvasEl.focus()   // ← thêm dòng này
setSkiaEngineRef(engine)
```

**Expected gain:** Keyboard shortcuts (delete, undo, arrow keys) hoạt động ngay khi mount, không cần click canvas trước.

---

## Wave 2 — Structural (Sau Wave 1, ~2-3 ngày)

---

### Fix W2-1: Hierarchical Viewport Culling

**File:** `src/canvas/skia/skia-engine.ts`
**Vị trí:** Function `flattenToRenderNodes()` (hoặc nơi nó được định nghĩa — có thể trong cùng file hoặc `canvas-layout-engine.ts`)

**Ý tưởng:** Trước khi recurse vào children của một container frame, check xem container đó có nằm trong viewport không. Nếu không → skip toàn bộ subtree.

```typescript
function flattenToRenderNodes(
  nodes: PenNode[],
  offsetX = 0, offsetY = 0,
  // ... existing params ...
  viewport?: { left: number; top: number; right: number; bottom: number }  // ← thêm param
): RenderNode[] {
  for (const node of nodes) {
    // ... existing visibility check ...

    // Hierarchical culling: nếu có viewport và node là container frame
    // nằm hoàn toàn ngoài viewport → skip toàn bộ subtree
    if (viewport && node.type === 'frame' && 'children' in node && node.children) {
      const nodeAbsX = offsetX + (node.x ?? 0)
      const nodeAbsY = offsetY + (node.y ?? 0)
      const nodeW = typeof node.width === 'number' ? node.width : 0
      const nodeH = typeof node.height === 'number' ? node.height : 0

      if (nodeAbsX + nodeW < viewport.left ||
          nodeAbsX > viewport.right ||
          nodeAbsY + nodeH < viewport.top ||
          nodeAbsY > viewport.bottom) {
        continue  // Skip toàn bộ subtree
      }
    }

    // ... existing flatten logic ...
  }
}
```

**Gọi với viewport** trong `syncFromDocument()`:
```typescript
// Tính viewport bounds trong scene coordinates
const vpLeft = -this.panX / this.zoom
const vpTop = -this.panY / this.zoom
const vpRight = vpLeft + (this.canvasEl?.clientWidth ?? 1200) / this.zoom
const vpBottom = vpTop + (this.canvasEl?.clientHeight ?? 800) / this.zoom
const viewport = { left: vpLeft - 200, top: vpTop - 200, right: vpRight + 200, bottom: vpBottom + 200 }

this.renderNodes = flattenToRenderNodes(measured, 0, 0, undefined, undefined, undefined, 0, viewport)
```

**Expected gain:** syncFromDocument giảm từ O(n) → O(visible_nodes) khi user zoom vào một vùng cụ thể.

---

### Fix W2-2: Async syncFromDocument

**File:** `src/canvas/skia/skia-engine.ts`

**Ý tưởng:** Không block main thread. Dùng `requestIdleCallback` cho phase nặng.

```typescript
private _syncAbortController: AbortController | null = null

async syncFromDocumentAsync() {
  // Abort bất kỳ sync đang chạy
  this._syncAbortController?.abort()
  this._syncAbortController = new AbortController()
  const signal = this._syncAbortController.signal

  if (this.dragSyncSuppressed) return
  const docState = useDocumentStore.getState()
  const activePageId = useCanvasStore.getState().activePageId

  // Phase 1: Change detection (sync, O(1), nhanh)
  const pageChildren = getActivePageChildren(docState.document, activePageId)
  if (pageChildren === this.lastSyncChildrenRef && activePageId === this.lastSyncPageId) {
    this.markDirty()
    return
  }
  this.lastSyncPageId = activePageId
  this.lastSyncChildrenRef = pageChildren
  this.benchmarkPending = true

  // Phase 2: Heavy computation (async via requestIdleCallback)
  await new Promise<void>((resolve) => {
    const runPhase2 = (deadline: IdleDeadline) => {
      if (signal.aborted) { resolve(); return }
      // ... resolveRefs, resolveDataBinding, resolveNodeForCanvas, ...
      // ... flattenToRenderNodes, spatialIndex.rebuild ...
      this.markDirty()
      resolve()
    }
    requestIdleCallback(runPhase2, { timeout: 500 })
  })
}
```

**Lưu ý:** Subscription trong `skia-canvas.tsx` cần đổi thành:
```typescript
useDocumentStore.subscribe(() => {
  if (syncTimer) return
  syncTimer = requestAnimationFrame(() => {
    syncTimer = null
    engineRef.current?.syncFromDocumentAsync()  // ← async version
  })
})
```

---

## Thứ tự implement

```
Ngày 1:
  [ ] W1-3: tabIndex + focus (5 phút)
  [ ] W1-2: BFS cache (2-3 giờ)
  [ ] W1-1: LOD rendering (4-6 giờ)

Ngày 2-3:
  [ ] W2-1: Hierarchical culling (1 ngày)

Ngày 4-5:
  [ ] W2-2: Async syncFromDocument (2 ngày)
```

---

## Files cần đọc trước khi implement

```
src/canvas/skia/skia-engine.ts      ← core engine, render loop, BFS
src/canvas/skia/skia-renderer.ts    ← drawNode implementation
src/canvas/skia/skia-canvas.tsx     ← React component, event handlers, init
src/canvas/canvas-layout-engine.ts  ← computeLayoutPositions, flattenToRenderNodes
src/canvas/skia/skia-viewport.ts    ← viewport math
```

## Commit convention

```
fix(canvas): add LOD rendering tiers to skip expensive draw calls at low zoom
fix(canvas): cache BFS connection maps to avoid O(n) rebuild per frame
fix(canvas): add tabIndex and auto-focus to canvas element
perf(canvas): add hierarchical viewport culling to flattenToRenderNodes
perf(canvas): make syncFromDocument async with requestIdleCallback
```
