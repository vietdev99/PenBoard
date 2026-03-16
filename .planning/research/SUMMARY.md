# Research Summary: OpenPencil Fork for PenBoard

**Researched:** 2026-03-15
**Confidence:** HIGH (source code verified via GitHub API)

## Executive Summary

OpenPencil (ZSeven-W/openpencil) is an MIT-licensed, fully open-source AI-native vector design tool. It uses CanvasKit/Skia (WASM) for GPU-accelerated rendering, React 19 + TanStack Start for the frontend, Zustand 5 for state management, and Nitro for the server. The project has 420 files, 126 commits, and 6 contributors.

## Architecture

### Canvas Engine (src/canvas/skia/)
- **SkiaEngine**: WebGL surface (fallback software), dirty-flag rendering, R-tree spatial indexing
- **Pipeline**: syncFromDocument() → resolveRefs → resolveVariables → premeasureTextHeights → flattenToRenderNodes → Skia render
- **Performance**: RAF loop, renders only when dirty. Text raster cache (300 entries), paragraph cache (200 entries)

### Document Model (src/types/pen.ts)
- **PenDocument**: version, themes, variables, pages[], children[]
- **PenPage**: id, name, children[]
- **Node types**: frame, group, rectangle, ellipse, line, polygon, path, text, image, icon_font, ref
- **Components**: FrameNode.reusable=true + RefNode with descendant overrides
- **Variables**: ThemedValue with multi-theme support

### State Management (src/stores/)
- **documentStore**: Node CRUD, tree manipulation, history integration
- **canvasStore**: Viewport, selection, activePageId
- **historyStore**: Undo/redo (300 states max, 300ms debounce)
- **aiStore**: AI chat, agent orchestration

### MCP Server (src/mcp/)
- **Transport**: stdio (CLI) + Streamable HTTP
- **Tools**: 20+ tools — batch_get, batch_design, insert/update/delete/copy/replace_node, variables, themes, pages, layout, find_empty_space, design_skeleton/content/refine
- **Sync**: Nitro as message bus (SSE broadcast), MCP pushes → SSE → renderer

### Build System
- Bun + Vite + TanStack Start + Nitro
- CanvasKit WASM in public/canvaskit/
- Electron: fork Nitro, port discovery via ~/.openpencil/.port
- esbuild for MCP server + Electron compilation

## What's Suitable for PenBoard

| OpenPencil Feature | PenBoard Use |
|-------------------|-------------|
| CanvasKit/Skia engine | Screen design canvas (as-is) |
| Multi-page | One page per screen + overview + ERD |
| Component system | Shared views (reusable=true + RefNode) |
| Variables system | Design tokens ($variable:name) |
| MCP server | AI tool integration (as-is) |
| Code generation | Export to React/HTML/Vue/etc. (as-is) |
| Figma import | Import existing designs (as-is) |
| Auto-layout | CSS Flexbox-like layout (as-is) |
| AI multi-agent | Design assistance (as-is) |

## What Needs Adding

| Feature | Approach |
|---------|----------|
| Backend (DB, auth) | Prisma + SQLite, Nitro API routes |
| Project management | New routes + dashboard UI |
| Screen persistence | Save PenPage JSON per screen |
| Storyboard overview | Special page with ScreenPreviewNodes |
| Screen connections | ConnectionNode (line + metadata) |
| ERD | New page type with TableNode + RelationEdge |
| Data entity shapes | DataEntityBadge node on design pages |

## Risks

1. **CanvasKit WASM size (~5MB)**: Mitigate with lazy-load + cache
2. **Immature codebase (126 commits)**: May have bugs
3. **Possibly AI-generated code**: Need thorough testing
4. **TanStack Start unfamiliarity**: Learning curve
5. **Skia debugging**: Harder than DOM-based debugging

---
*Research completed: 2026-03-15*
