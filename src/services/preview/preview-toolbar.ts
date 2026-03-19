/**
 * Preview toolbar HTML, CSS, and JS generation.
 *
 * Produces the fixed toolbar at the top of the preview HTML with:
 * back navigation, breadcrumb, hotspot toggle, refresh, download HTML,
 * and toolbar visibility toggle. Follows OS dark/light mode.
 */

// ---------------------------------------------------------------------------
// Toolbar CSS
// ---------------------------------------------------------------------------

/**
 * Generate CSS for the preview toolbar.
 * Includes dark theme by default with light mode via prefers-color-scheme.
 */
export function generateToolbarCSS(): string {
  return `
.preview-toolbar {
  position: fixed; top: 0; left: 0; right: 0; z-index: 9999;
  display: flex; align-items: center; justify-content: space-between;
  height: 40px; padding: 0 12px;
  background: #1a1a1a; color: #e0e0e0;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
  font-size: 13px; border-bottom: 1px solid #333;
  transition: transform 200ms ease;
}
.preview-toolbar.hidden { transform: translateY(-100%); }
.preview-toolbar-left, .preview-toolbar-center, .preview-toolbar-right {
  display: flex; align-items: center; gap: 8px;
}
.preview-toolbar-center { flex: 1; justify-content: center; }
.preview-toolbar button {
  background: transparent; border: 1px solid #444; color: #e0e0e0;
  padding: 4px 10px; border-radius: 4px; cursor: pointer; font-size: 12px;
  transition: background 150ms ease;
}
.preview-toolbar button:hover { background: #333; }
.preview-toolbar button.active { background: #3b82f6; border-color: #3b82f6; }
.preview-toolbar .breadcrumb { color: #999; }
.preview-toolbar select {
  background: transparent; border: 1px solid #444; color: #e0e0e0;
  padding: 4px 8px; border-radius: 4px; font-size: 12px; cursor: pointer;
  max-width: 300px;
}
.preview-toolbar select:focus { outline: none; border-color: #3b82f6; }
body { padding-top: 40px; }
body.toolbar-hidden { padding-top: 0; }
@media (prefers-color-scheme: light) {
  .preview-toolbar { background: #f5f5f5; color: #333; border-bottom-color: #ddd; }
  .preview-toolbar button { border-color: #ccc; color: #333; }
  .preview-toolbar button:hover { background: #e0e0e0; }
  .preview-toolbar select { border-color: #ccc; color: #333; background: #fff; }
  .preview-toolbar .breadcrumb { color: #666; }
}
`
}

// ---------------------------------------------------------------------------
// Toolbar HTML
// ---------------------------------------------------------------------------

/**
 * Generate HTML string for the preview toolbar.
 *
 * @param pageName - Initial page name for the breadcrumb
 * @param pages - Array of {id, name} for the page selector dropdown
 * @param initialPageId - Currently active page ID
 * @returns Toolbar HTML string
 */
export function generateToolbarHTML(
  pageName: string,
  pages?: { id: string; name: string }[],
  initialPageId?: string,
): string {
  const escaped = pageName.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

  // Build page selector dropdown if multiple pages/views exist
  let pageSelector = `<span class="breadcrumb" id="preview-breadcrumb">${escaped}</span>`
  if (pages && pages.length > 1) {
    // Group pages by their parent page name (if available)
    const groups = new Map<string, typeof pages>()
    for (const p of pages) {
      const group = (p as any).group || ''
      if (!groups.has(group)) groups.set(group, [])
      groups.get(group)!.push(p)
    }

    let optionsHTML = ''
    for (const [groupName, items] of groups) {
      const escapedGroup = groupName.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
      const itemsHTML = items
        .map((p) => {
          const sel = p.id === initialPageId ? ' selected' : ''
          const name = p.name.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
          return `<option value="${p.id}"${sel}>${name}</option>`
        })
        .join('')

      if (groupName && groups.size > 1) {
        optionsHTML += `<optgroup label="${escapedGroup}">${itemsHTML}</optgroup>`
      } else {
        optionsHTML += itemsHTML
      }
    }

    pageSelector = `<select id="preview-page-select" onchange="window.__navigateToPage(this.value)">${optionsHTML}</select>`
  }

  return `<div class="preview-toolbar" id="preview-toolbar">
  <div class="preview-toolbar-left">
    <button onclick="history.back()" title="Back">&#8592; Back</button>
  </div>
  <div class="preview-toolbar-center">
    ${pageSelector}
  </div>
  <div class="preview-toolbar-right">
    <button onclick="window.__toggleHotspots();this.classList.toggle('active')" title="Toggle Hotspots">Hotspots</button>
    <button onclick="window.location.reload()" title="Refresh">Refresh</button>
    <button onclick="window.__downloadHTML()" title="Download HTML">Download</button>
    <button onclick="window.__toggleToolbar()" title="Toggle Toolbar">&#8212;</button>
  </div>
</div>`
}

// ---------------------------------------------------------------------------
// Toolbar JS
// ---------------------------------------------------------------------------

/**
 * Generate inline JS for toolbar toggle and HTML download functionality.
 *
 * Download removes the SSE script (EventSource) since it won't work offline.
 */
export function generateToolbarJS(): string {
  return `window.__toggleToolbar = function() {
  var tb = document.getElementById('preview-toolbar');
  tb.classList.toggle('hidden');
  document.body.classList.toggle('toolbar-hidden');
};
window.__downloadHTML = function() {
  var html = document.documentElement.outerHTML;
  html = html.replace(/<script>[\\s\\S]*?EventSource[\\s\\S]*?<\\/script>/g, '');
  var blob = new Blob(['<!DOCTYPE html>' + html], { type: 'text/html' });
  var a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = (document.title || 'preview') + '.html';
  a.click();
  URL.revokeObjectURL(a.href);
};`
}
