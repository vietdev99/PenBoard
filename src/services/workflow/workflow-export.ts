// ---------------------------------------------------------------------------
// Workflow Export Utilities
// ---------------------------------------------------------------------------

/** Copy mermaid text to clipboard */
export async function exportMermaid(mermaidText: string): Promise<void> {
  await navigator.clipboard.writeText(mermaidText)
}

/** Download SVG element as .svg file */
export function exportSVG(svgElement: SVGElement, filename = 'workflow.svg'): void {
  const serializer = new XMLSerializer()
  const svgString = serializer.serializeToString(svgElement)
  const blob = new Blob([svgString], { type: 'image/svg+xml;charset=utf-8' })
  downloadBlob(blob, filename)
}

/** Rasterize SVG to PNG and download */
export function exportPNG(
  svgElement: SVGElement,
  filename = 'workflow.png',
  scale = 2,
): Promise<void> {
  return new Promise((resolve, reject) => {
    const serializer = new XMLSerializer()
    const svgString = serializer.serializeToString(svgElement)
    const svgBlob = new Blob([svgString], { type: 'image/svg+xml;charset=utf-8' })
    const url = URL.createObjectURL(svgBlob)

    const img = new Image()
    img.onload = () => {
      const canvas = document.createElement('canvas')
      canvas.width = img.width * scale
      canvas.height = img.height * scale
      const ctx = canvas.getContext('2d')
      if (!ctx) {
        URL.revokeObjectURL(url)
        reject(new Error('Failed to get canvas context'))
        return
      }
      ctx.scale(scale, scale)
      ctx.drawImage(img, 0, 0)
      canvas.toBlob((blob) => {
        URL.revokeObjectURL(url)
        if (blob) {
          downloadBlob(blob, filename)
          resolve()
        } else {
          reject(new Error('Failed to create PNG blob'))
        }
      }, 'image/png')
    }
    img.onerror = () => {
      URL.revokeObjectURL(url)
      reject(new Error('Failed to load SVG image'))
    }
    img.src = url
  })
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}
