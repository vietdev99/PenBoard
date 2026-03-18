/**
 * Preview navigation JS and CSS generation.
 *
 * Produces inline JavaScript and CSS for hash-based page navigation
 * with push/modal/replace transitions, event delegation for
 * click/hover/submit triggers, hotspot mode, browser back/forward,
 * keyboard accessibility, and targetFrameId scrolling.
 */

import type { ScreenConnection } from '@/types/pen'

// ---------------------------------------------------------------------------
// Connection map builder
// ---------------------------------------------------------------------------

/**
 * Build a JS object literal string mapping sourceElementId to connection details.
 *
 * @param connections - Array of ScreenConnections
 * @returns JS object literal string (not JSON) for inline script embedding
 */
export function buildConnectionMap(connections: ScreenConnection[]): string {
  if (connections.length === 0) return '{}'

  const entries = connections.map((conn) => {
    const parts: string[] = [
      `targetPageId: "${conn.targetPageId}"`,
      `transition: "${conn.transitionType}"`,
      `trigger: "${conn.triggerEvent}"`,
    ]
    if (conn.targetFrameId) {
      parts.push(`targetFrameId: "${conn.targetFrameId}"`)
    }
    return `"${conn.sourceElementId}": { ${parts.join(', ')} }`
  })

  return `{ ${entries.join(', ')} }`
}

// ---------------------------------------------------------------------------
// Navigation CSS
// ---------------------------------------------------------------------------

/**
 * Generate CSS for page transitions, modal overlays, hotspot highlights,
 * hover states, and not-found page.
 */
export function generateNavigationCSS(): string {
  return `
/* Page transitions */
.page-container { display: none; position: relative; min-height: 100vh; }
.page-container.active { display: block; }

/* Push transition: slide left */
@keyframes slideOutLeft { from { transform: translateX(0); opacity: 1; } to { transform: translateX(-30%); opacity: 0; } }
@keyframes slideInRight { from { transform: translateX(30%); opacity: 0; } to { transform: translateX(0); opacity: 1; } }
.slide-out-left { animation: slideOutLeft 250ms ease forwards; }
.slide-in-right { animation: slideInRight 250ms ease forwards; }

/* Modal transition: fade overlay */
.modal-backdrop { position: fixed; inset: 0; background: rgba(0,0,0,0.5); z-index: 1000; display: flex; align-items: center; justify-content: center; animation: fadeIn 200ms ease; }
.modal-content { background: var(--bg, #fff); border-radius: 12px; max-width: 90vw; max-height: 90vh; overflow: auto; animation: scaleIn 200ms ease; }
@keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
@keyframes scaleIn { from { transform: scale(0.95); opacity: 0; } to { transform: scale(1); opacity: 1; } }

/* Hover state for clickable elements */
[data-nav-click], [data-nav-hover], [data-nav-submit] { cursor: pointer; transition: box-shadow 150ms ease; }
[data-nav-click]:hover, [data-nav-hover]:hover, [data-nav-submit]:hover { box-shadow: 0 0 0 2px rgba(59,130,246,0.5); }

/* Hotspot highlights */
.hotspot-active [data-nav-click], .hotspot-active [data-nav-hover], .hotspot-active [data-nav-submit] {
  outline: 2px dashed rgba(59,130,246,0.8); outline-offset: 2px;
}

/* Not found page */
.not-found { display: flex; flex-direction: column; align-items: center; justify-content: center; min-height: 50vh; gap: 16px; font-family: -apple-system, sans-serif; }
.not-found h2 { font-size: 24px; color: #666; }
.not-found button { padding: 8px 24px; border: 1px solid #ccc; border-radius: 6px; background: #fff; cursor: pointer; font-size: 14px; }
`
}

// ---------------------------------------------------------------------------
// Navigation JS
// ---------------------------------------------------------------------------

/**
 * Generate inline JavaScript (IIFE) for preview navigation.
 *
 * Includes: hash routing, push/modal/replace transitions, event delegation
 * for click/hover/submit, browser back/forward, hotspot toggle, keyboard
 * accessibility, targetFrameId scrolling, Page not found handling, SSE hot reload.
 *
 * @param connections - Array of ScreenConnections
 * @param pages - Array of {id, name} for page name lookup
 * @param initialPageId - The initially active page ID
 * @param previewId - Preview session ID for SSE hot reload
 * @returns Complete inline JS string
 */
export function generateNavigationJS(
  connections: ScreenConnection[],
  pages: { id: string; name: string }[],
  initialPageId: string,
  previewId: string,
): string {
  const connectionMap = buildConnectionMap(connections)
  const pageNameMap =
    '{ ' +
    pages.map((p) => `"${p.id}": "${p.name}"`).join(', ') +
    ' }'

  return `(function() {
  var connections = ${connectionMap};
  var pages = ${pageNameMap};
  var initialPageId = '${initialPageId}';

  function getActivePageId() {
    var hash = window.location.hash.slice(1);
    return hash || initialPageId;
  }

  function showPage(pageId) {
    document.querySelectorAll('.page-container').forEach(function(el) {
      el.classList.remove('active', 'slide-out-left', 'slide-in-right');
    });
    document.querySelectorAll('.modal-backdrop').forEach(function(el) { el.remove(); });

    var target = document.getElementById('page-' + pageId);
    if (!target) { showNotFound(pageId); return; }
    target.classList.add('active');
    updateBreadcrumb(pageId);
  }

  function navigateTo(targetPageId, transition, targetFrameId) {
    var current = document.querySelector('.page-container.active');

    if (transition === 'modal') {
      var backdrop = document.createElement('div');
      backdrop.className = 'modal-backdrop';
      backdrop.onclick = function(e) { if (e.target === backdrop) { history.back(); } };
      var content = document.createElement('div');
      content.className = 'modal-content';
      var targetEl = document.getElementById('page-' + targetPageId);
      if (!targetEl) { showNotFound(targetPageId); return; }
      content.innerHTML = targetEl.innerHTML;
      backdrop.appendChild(content);
      document.body.appendChild(backdrop);
      history.pushState({ pageId: targetPageId, modal: true }, '', '#' + targetPageId);
    } else if (transition === 'push') {
      if (current) current.classList.add('slide-out-left');
      var target = document.getElementById('page-' + targetPageId);
      if (!target) { showNotFound(targetPageId); return; }
      setTimeout(function() {
        if (current) current.classList.remove('active', 'slide-out-left');
        target.classList.add('active', 'slide-in-right');
        setTimeout(function() { target.classList.remove('slide-in-right'); }, 260);
      }, 250);
      history.pushState({ pageId: targetPageId }, '', '#' + targetPageId);
    } else {
      if (current) current.classList.remove('active');
      var target = document.getElementById('page-' + targetPageId);
      if (!target) { showNotFound(targetPageId); return; }
      target.classList.add('active');
      history.replaceState({ pageId: targetPageId }, '', '#' + targetPageId);
    }

    if (targetFrameId) {
      setTimeout(function() {
        var frame = document.getElementById('node-' + targetFrameId);
        if (frame) frame.scrollIntoView({ behavior: 'smooth' });
      }, 300);
    }

    updateBreadcrumb(targetPageId);
  }

  function showNotFound(pageId) {
    var existing = document.getElementById('not-found-page');
    if (existing) existing.remove();
    var div = document.createElement('div');
    div.id = 'not-found-page';
    div.className = 'not-found page-container active';
    div.innerHTML = '<h2>Page not found</h2><p>Page "' + pageId + '" does not exist</p><button onclick="history.back()">Go Back</button>';
    document.body.appendChild(div);
  }

  function updateBreadcrumb(pageId) {
    var bc = document.getElementById('preview-breadcrumb');
    if (bc) bc.textContent = pages[pageId] || pageId;
  }

  // Event delegation: click
  document.addEventListener('click', function(e) {
    var el = e.target.closest('[data-nav-click]');
    if (el) {
      var connId = el.getAttribute('data-nav-click');
      var conn = connections[connId];
      if (conn) navigateTo(conn.targetPageId, conn.transition, conn.targetFrameId);
    }
  });

  // Event delegation: hover (mouseenter)
  document.addEventListener('mouseenter', function(e) {
    var el = e.target.closest ? e.target.closest('[data-nav-hover]') : null;
    if (el) {
      var connId = el.getAttribute('data-nav-hover');
      var conn = connections[connId];
      if (conn) navigateTo(conn.targetPageId, conn.transition, conn.targetFrameId);
    }
  }, true);

  // Event delegation: submit
  document.addEventListener('submit', function(e) {
    var el = e.target.closest('[data-nav-submit]');
    if (el) {
      e.preventDefault();
      var connId = el.getAttribute('data-nav-submit');
      var conn = connections[connId];
      if (conn) navigateTo(conn.targetPageId, conn.transition, conn.targetFrameId);
    }
  });

  // Keyboard: Enter/Space on focusable nav elements
  document.addEventListener('keydown', function(e) {
    if (e.key === 'Enter' || e.key === ' ') {
      var el = e.target.closest('[data-nav-click]');
      if (el) {
        e.preventDefault();
        var connId = el.getAttribute('data-nav-click');
        var conn = connections[connId];
        if (conn) navigateTo(conn.targetPageId, conn.transition, conn.targetFrameId);
      }
    }
  });

  // Browser back/forward
  window.addEventListener('popstate', function(e) {
    var pageId = (e.state && e.state.pageId) ? e.state.pageId : initialPageId;
    showPage(pageId);
  });

  // Hotspot mode
  window.__toggleHotspots = function() {
    document.body.classList.toggle('hotspot-active');
  };

  // Initialize hash
  var startPage = getActivePageId();
  if (startPage !== initialPageId) showPage(startPage);
  history.replaceState({ pageId: startPage }, '', '#' + startPage);
  updateBreadcrumb(startPage);

  // SSE hot reload
  var evtSource = new EventSource('/api/preview/events?id=' + '${previewId}');
  evtSource.onmessage = function(e) {
    try { var data = JSON.parse(e.data); if (data.type === 'preview:update') window.location.reload(); } catch(err) {}
  };
})();`
}
