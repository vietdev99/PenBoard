import { defineEventHandler, getRouterParam } from 'h3'
import { getPreviewData } from '../../utils/preview-state'

/**
 * GET /api/preview/:id -- Serves the preview HTML page.
 *
 * The preview page is a self-contained HTML document that:
 * 1. Fetches the latest preview data from the server
 * 2. Connects to the SSE endpoint for hot reload notifications
 * 3. Re-fetches and re-renders when updates arrive
 *
 * NOTE: The actual HTML generation from PenDocument is deferred to
 * the preview-html-generator module (plan 07-01). For now we serve
 * a bootstrap page that loads data via API and renders a placeholder.
 */
export default defineEventHandler((event) => {
  const id = getRouterParam(event, 'id')
  if (!id) {
    return new Response('Missing preview ID', {
      status: 400,
      headers: { 'Content-Type': 'text/plain' },
    })
  }

  const data = getPreviewData(id)
  if (!data) {
    return new Response(
      'Preview not found. Open preview from the editor.',
      { status: 404, headers: { 'Content-Type': 'text/plain' } },
    )
  }

  // Serve a self-contained preview HTML page with SSE hot reload
  const html = buildPreviewHTML(id, data.doc.name || 'PenBoard Preview')

  return new Response(html, {
    status: 200,
    headers: { 'Content-Type': 'text/html; charset=utf-8' },
  })
})

/**
 * Build the preview bootstrap HTML.
 * This page connects to SSE for hot reload and renders the document.
 * Once the preview-html-generator is available (plan 07-01), the
 * server-side rendering will replace this client-side bootstrap.
 */
function buildPreviewHTML(previewId: string, title: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${escapeHtml(title)} - Preview</title>
  <style>
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background: #f5f5f5;
      color: #333;
      display: flex;
      align-items: center;
      justify-content: center;
      min-height: 100vh;
    }
    #preview-root {
      width: 100%;
      max-width: 1440px;
      margin: 0 auto;
      padding: 16px;
    }
    .preview-loading {
      text-align: center;
      padding: 48px;
      color: #666;
    }
    .preview-frame {
      background: #fff;
      border-radius: 8px;
      box-shadow: 0 1px 3px rgba(0,0,0,0.1);
      padding: 24px;
      margin-bottom: 16px;
    }
    .preview-status {
      position: fixed;
      bottom: 8px;
      right: 8px;
      font-size: 11px;
      color: #999;
      background: rgba(255,255,255,0.9);
      padding: 2px 8px;
      border-radius: 4px;
    }
    .preview-status.connected { color: #22c55e; }
    .preview-status.disconnected { color: #ef4444; }
  </style>
</head>
<body>
  <div id="preview-root">
    <div class="preview-loading">Loading preview...</div>
  </div>
  <div id="preview-status" class="preview-status disconnected">Connecting...</div>
  <script>
    (function() {
      var previewId = ${JSON.stringify(previewId)};
      var statusEl = document.getElementById('preview-status');
      var rootEl = document.getElementById('preview-root');

      // Connect to SSE for hot reload
      var evtSource = null;
      function connectSSE() {
        evtSource = new EventSource('/api/preview/events?id=' + encodeURIComponent(previewId));
        evtSource.onopen = function() {
          statusEl.textContent = 'Live';
          statusEl.className = 'preview-status connected';
        };
        evtSource.onmessage = function(e) {
          try {
            var data = JSON.parse(e.data);
            if (data.type === 'preview:update') {
              window.location.reload();
            }
          } catch(err) {}
        };
        evtSource.onerror = function() {
          statusEl.textContent = 'Disconnected';
          statusEl.className = 'preview-status disconnected';
          evtSource.close();
          setTimeout(connectSSE, 3000);
        };
      }
      connectSSE();

      // Render a basic preview of the document data
      statusEl.textContent = 'Connected';
      statusEl.className = 'preview-status connected';
      rootEl.innerHTML = '<div class="preview-frame"><p>Preview is ready. Design content will render here when the preview renderer (plan 07-01) is integrated.</p></div>';
    })();
  </script>
</body>
</html>`
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}
