/**
 * Preview HTML generation engine.
 *
 * Transforms PenNode trees into self-contained, interactive HTML documents
 * with resolved data bindings, semantic tags, CSS variables, and strict CSP.
 *
 * This is the core rendering engine for the interactive preview feature.
 * Does NOT import from codegen/html-generator.ts (keeps code-panel generator clean),
 * but replicates CSS generation patterns with preview-specific extensions.
 */

import type {
  PenDocument,
  PenNode,
  PenPage,
  ContainerProps,
  TextNode,
  ScreenConnection,
} from '@/types/pen'
import type { PenFill, PenStroke, PenEffect, ShadowEffect } from '@/types/styles'
import { isVariableRef } from '@/variables/resolve-variables'
import { variableNameToCSS, generateCSSVariables } from '@/services/codegen/css-variables-generator'
import { resolvePageForPreview } from '@/services/preview/preview-data-resolver'
import { getSemanticTag } from '@/services/preview/preview-semantic-tags'
import { generateNavigationJS, generateNavigationCSS } from '@/services/preview/preview-navigation'
import { generateToolbarHTML, generateToolbarCSS, generateToolbarJS } from '@/services/preview/preview-toolbar'
import { lookupIconByName } from '@/services/ai/icon-resolver'

// ---------------------------------------------------------------------------
// CSS helper functions (replicated from html-generator.ts with preview extensions)
// ---------------------------------------------------------------------------

function varOrLiteral(value: string): string {
  if (isVariableRef(value)) {
    return `var(${variableNameToCSS(value.slice(1))})`
  }
  return value
}

let classCounter = 0

function resetClassCounter(): void {
  classCounter = 0
}

function nextClassName(prefix: string): string {
  classCounter++
  return `pv-${prefix}-${classCounter}`
}

function indent(depth: number): string {
  return '  '.repeat(depth)
}

function escapeHTML(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function fillToCSS(fills: PenFill[] | undefined): Record<string, string> {
  if (!fills || fills.length === 0) return {}
  const fill = fills[0]
  if (fill.type === 'solid') {
    return { background: varOrLiteral(fill.color) }
  }
  if (fill.type === 'linear_gradient') {
    if (!fill.stops?.length) return {}
    const angle = fill.angle ?? 180
    const stops = fill.stops
      .map((s) => `${varOrLiteral(s.color)} ${Math.round(s.offset * 100)}%`)
      .join(', ')
    return { background: `linear-gradient(${angle}deg, ${stops})` }
  }
  if (fill.type === 'radial_gradient') {
    if (!fill.stops?.length) return {}
    const stops = fill.stops
      .map((s) => `${varOrLiteral(s.color)} ${Math.round(s.offset * 100)}%`)
      .join(', ')
    return { background: `radial-gradient(circle, ${stops})` }
  }
  return {}
}

function strokeToCSS(stroke: PenStroke | undefined): Record<string, string> {
  if (!stroke) return {}
  const css: Record<string, string> = {}
  if (typeof stroke.thickness === 'string' && isVariableRef(stroke.thickness)) {
    css['border-width'] = varOrLiteral(stroke.thickness)
  } else {
    const thickness =
      typeof stroke.thickness === 'number'
        ? stroke.thickness
        : stroke.thickness[0]
    css['border-width'] = `${thickness}px`
  }
  css['border-style'] = 'solid'
  if (stroke.fill && stroke.fill.length > 0) {
    const sf = stroke.fill[0]
    if (sf.type === 'solid') {
      css['border-color'] = varOrLiteral(sf.color)
    }
  }
  return css
}

function effectsToCSS(effects: PenEffect[] | undefined): Record<string, string> {
  if (!effects || effects.length === 0) return {}
  const shadows: string[] = []
  for (const effect of effects) {
    if (effect.type === 'shadow') {
      const s = effect as ShadowEffect
      const insetStr = s.inner ? 'inset ' : ''
      shadows.push(
        `${insetStr}${s.offsetX}px ${s.offsetY}px ${s.blur}px ${s.spread}px ${s.color}`,
      )
    }
  }
  if (shadows.length > 0) {
    return { 'box-shadow': shadows.join(', ') }
  }
  return {}
}

function cornerRadiusToCSS(
  cr: number | [number, number, number, number] | undefined,
): Record<string, string> {
  if (cr === undefined) return {}
  if (typeof cr === 'number') {
    return cr === 0 ? {} : { 'border-radius': `${cr}px` }
  }
  return {
    'border-radius': `${cr[0]}px ${cr[1]}px ${cr[2]}px ${cr[3]}px`,
  }
}

function layoutToCSS(node: ContainerProps): Record<string, string> {
  const css: Record<string, string> = {}
  if (node.layout === 'vertical') {
    css.display = 'flex'
    css['flex-direction'] = 'column'
  } else if (node.layout === 'horizontal') {
    css.display = 'flex'
    css['flex-direction'] = 'row'
  }
  if (node.gap !== undefined) {
    if (typeof node.gap === 'string' && isVariableRef(node.gap)) {
      css.gap = varOrLiteral(node.gap)
    } else if (typeof node.gap === 'number') {
      css.gap = `${node.gap}px`
    }
  }
  if (node.padding !== undefined) {
    if (typeof node.padding === 'string' && isVariableRef(node.padding)) {
      css.padding = varOrLiteral(node.padding)
    } else if (typeof node.padding === 'number') {
      css.padding = `${node.padding}px`
    } else if (Array.isArray(node.padding)) {
      css.padding = node.padding.map((p) => `${p}px`).join(' ')
    }
  }
  if (node.justifyContent) {
    const map: Record<string, string> = {
      start: 'flex-start',
      center: 'center',
      end: 'flex-end',
      space_between: 'space-between',
      space_around: 'space-around',
    }
    css['justify-content'] = map[node.justifyContent] ?? node.justifyContent
  }
  if (node.alignItems) {
    const map: Record<string, string> = {
      start: 'flex-start',
      center: 'center',
      end: 'flex-end',
    }
    css['align-items'] = map[node.alignItems] ?? node.alignItems
  }
  if (node.clipContent) {
    css.overflow = 'hidden'
  }
  return css
}

// ---------------------------------------------------------------------------
// CSS rule management
// ---------------------------------------------------------------------------

interface CSSRule {
  className: string
  properties: Record<string, string>
}

function cssRulesToString(rules: CSSRule[]): string {
  return rules
    .map((r) => {
      const props = Object.entries(r.properties)
        .map(([k, v]) => `  ${k}: ${v};`)
        .join('\n')
      return `.${r.className} {\n${props}\n}`
    })
    .join('\n\n')
}

// ---------------------------------------------------------------------------
// Text content extraction
// ---------------------------------------------------------------------------

function getTextContent(node: TextNode): string {
  if (typeof node.content === 'string') return node.content
  return node.content.map((s) => s.text).join('')
}

// ---------------------------------------------------------------------------
// Node HTML generation
// ---------------------------------------------------------------------------

function generateNodeHTML(
  node: PenNode,
  depth: number,
  rules: CSSRule[],
  connections: ScreenConnection[],
  parentLayout?: 'vertical' | 'horizontal' | 'none',
): string {
  const pad = indent(depth)

  // Skip hidden nodes
  if (node.visible === false) return ''

  const css: Record<string, string> = {}
  const inFlexParent = parentLayout === 'vertical' || parentLayout === 'horizontal'

  // Position: skip absolute positioning for children inside flex containers
  if (node.x !== undefined || node.y !== undefined) {
    if (!inFlexParent) {
      css.position = 'absolute'
      if (node.x !== undefined) css.left = `${node.x}px`
      if (node.y !== undefined) css.top = `${node.y}px`
    }
  }

  // Opacity
  if (node.opacity !== undefined && node.opacity !== 1) {
    if (typeof node.opacity === 'string' && isVariableRef(node.opacity)) {
      css.opacity = varOrLiteral(node.opacity)
    } else if (typeof node.opacity === 'number') {
      css.opacity = String(node.opacity)
    }
  }

  // Rotation
  if (node.rotation) {
    css.transform = `rotate(${node.rotation}deg)`
  }

  // Build connection attributes
  const connAttrs = buildConnectionAttrs(node.id, connections)
  const nodeIdAttr = `id="node-${node.id}"`

  switch (node.type) {
    case 'frame':
    case 'rectangle':
    case 'group': {
      // Handle sizing: fill_container → 100% or flex:1, fit_content → auto, number → px
      if (node.width === 'fill_container') {
        css.width = inFlexParent && parentLayout === 'horizontal' ? undefined! : '100%'
        if (inFlexParent && parentLayout === 'horizontal') css.flex = '1'
      } else if (node.width === 'fit_content') {
        css.width = 'auto'
      } else if (typeof node.width === 'number') {
        css.width = `${node.width}px`
      }
      if (node.height === 'fill_container') {
        css.height = inFlexParent && parentLayout === 'vertical' ? undefined! : '100%'
        if (inFlexParent && parentLayout === 'vertical') css.flex = '1'
      } else if (node.height === 'fit_content') {
        css.height = 'auto'
      } else if (typeof node.height === 'number') {
        css.height = `${node.height}px`
      }
      // Clean up undefined values
      if (!css.width) delete css.width
      if (!css.height) delete css.height
      Object.assign(css, fillToCSS(node.fill))
      Object.assign(css, strokeToCSS(node.stroke))
      Object.assign(css, cornerRadiusToCSS(node.cornerRadius))
      Object.assign(css, effectsToCSS(node.effects))
      Object.assign(css, layoutToCSS(node))

      // Determine this node's layout for children positioning
      const nodeLayout: 'vertical' | 'horizontal' | 'none' = node.layout === 'vertical'
        ? 'vertical'
        : node.layout === 'horizontal'
          ? 'horizontal'
          : 'none'

      // Ensure frame/group acts as positioning context for absolute children
      const children = node.children ?? []
      if (children.length > 0 && !css.position && nodeLayout === 'none') {
        css.position = 'relative'
      }

      // Handle table role with proper HTML table structure (before pushing generic CSS)
      if (node.role === 'table') {
        return generateTableHTMLNode(node, pad, nodeIdAttr, rules, connections)
      }

      const tag = getSemanticTag(node.role, node.type)
      const className = nextClassName(
        node.name?.replace(/\s+/g, '-').toLowerCase() ?? node.type,
      )
      rules.push({ className, properties: css })

      // Handle special interactive roles
      if (node.role === 'input' || node.role === 'form-input') {
        const placeholder = getFirstTextContent(node)
        return `${pad}<input ${nodeIdAttr} class="${className}" type="text" placeholder="${escapeHTML(placeholder)}"${connAttrs} />`
      }
      if (node.role === 'textarea') {
        const placeholder = getFirstTextContent(node)
        return `${pad}<textarea ${nodeIdAttr} class="${className}" placeholder="${escapeHTML(placeholder)}"${connAttrs}></textarea>`
      }
      if (node.role === 'checkbox') {
        return `${pad}<input ${nodeIdAttr} class="${className}" type="checkbox"${connAttrs} />`
      }
      if (node.role === 'radio') {
        return `${pad}<input ${nodeIdAttr} class="${className}" type="radio"${connAttrs} />`
      }
      if (node.role === 'dropdown' || node.role === 'select') {
        return generateSelectHTML(node, pad, nodeIdAttr, className, connAttrs)
      }

      if (children.length === 0) {
        return `${pad}<${tag} ${nodeIdAttr} class="${className}"${connAttrs}></${tag}>`
      }
      const childrenHTML = children
        .map((c) => generateNodeHTML(c, depth + 1, rules, connections, nodeLayout))
        .join('\n')
      return `${pad}<${tag} ${nodeIdAttr} class="${className}"${connAttrs}>\n${childrenHTML}\n${pad}</${tag}>`
    }

    case 'ellipse': {
      if (typeof node.width === 'number') css.width = `${node.width}px`
      if (typeof node.height === 'number') css.height = `${node.height}px`
      css['border-radius'] = '50%'
      Object.assign(css, fillToCSS(node.fill))
      Object.assign(css, strokeToCSS(node.stroke))
      Object.assign(css, effectsToCSS(node.effects))
      const className = nextClassName(
        node.name?.replace(/\s+/g, '-').toLowerCase() ?? 'ellipse',
      )
      rules.push({ className, properties: css })
      return `${pad}<div ${nodeIdAttr} class="${className}"${connAttrs}></div>`
    }

    case 'text': {
      if (node.width === 'fill_container') {
        css.width = '100%'
      } else if (typeof node.width === 'number') {
        css.width = `${node.width}px`
      }
      if (typeof node.height === 'number') css.height = `${node.height}px`
      if (node.fill) {
        const fill = node.fill[0]
        if (fill?.type === 'solid') css.color = varOrLiteral(fill.color)
      }
      if (node.fontSize) css['font-size'] = `${node.fontSize}px`
      if (node.fontWeight) css['font-weight'] = String(node.fontWeight)
      if (node.fontStyle === 'italic') css['font-style'] = 'italic'
      if (node.textAlign) css['text-align'] = node.textAlign
      if (node.fontFamily)
        css['font-family'] = `'${node.fontFamily}', sans-serif`
      if (node.lineHeight) css['line-height'] = String(node.lineHeight)
      if (node.letterSpacing)
        css['letter-spacing'] = `${node.letterSpacing}px`
      if (node.underline) css['text-decoration'] = 'underline'
      if (node.strikethrough) css['text-decoration'] = 'line-through'
      Object.assign(css, effectsToCSS(node.effects))

      const className = nextClassName(
        node.name?.replace(/\s+/g, '-').toLowerCase() ?? 'text',
      )
      rules.push({ className, properties: css })

      const tag = getSemanticTag(node.role, node.type, node.fontSize)
      const text = escapeHTML(getTextContent(node))
      return `${pad}<${tag} ${nodeIdAttr} class="${className}"${connAttrs}>${text}</${tag}>`
    }

    case 'line': {
      const w =
        node.x2 !== undefined ? Math.abs(node.x2 - (node.x ?? 0)) : 0
      css.width = `${w}px`
      if (node.stroke) {
        const thickness =
          typeof node.stroke.thickness === 'number'
            ? node.stroke.thickness
            : node.stroke.thickness[0]
        css['border-top-width'] = `${thickness}px`
        css['border-top-style'] = 'solid'
        if (node.stroke.fill && node.stroke.fill.length > 0) {
          const sf = node.stroke.fill[0]
          if (sf.type === 'solid')
            css['border-top-color'] = varOrLiteral(sf.color)
        }
      }
      const className = nextClassName(
        node.name?.replace(/\s+/g, '-').toLowerCase() ?? 'line',
      )
      rules.push({ className, properties: css })
      return `${pad}<hr ${nodeIdAttr} class="${className}"${connAttrs} />`
    }

    case 'polygon':
    case 'path': {
      if (typeof node.width === 'number') css.width = `${node.width}px`
      if (typeof node.height === 'number') css.height = `${node.height}px`
      Object.assign(css, fillToCSS(node.fill))
      const className = nextClassName(
        node.name?.replace(/\s+/g, '-').toLowerCase() ?? node.type,
      )
      rules.push({ className, properties: css })

      if (node.type === 'path') {
        const w = typeof node.width === 'number' ? node.width : 24
        const h = typeof node.height === 'number' ? node.height : 24
        const fillColor =
          node.fill?.[0]?.type === 'solid'
            ? varOrLiteral(node.fill[0].color)
            : 'currentColor'
        return `${pad}<svg ${nodeIdAttr} class="${className}" viewBox="0 0 ${w} ${h}"${connAttrs}>\n${pad}  <path d="${node.d}" fill="${fillColor}" />\n${pad}</svg>`
      }
      return `${pad}<div ${nodeIdAttr} class="${className}"${connAttrs}></div>`
    }

    case 'image': {
      if (typeof node.width === 'number') css.width = `${node.width}px`
      if (typeof node.height === 'number') css.height = `${node.height}px`
      const fit =
        node.objectFit === 'fit'
          ? 'contain'
          : node.objectFit === 'crop'
            ? 'cover'
            : 'fill'
      css['object-fit'] = fit
      Object.assign(css, cornerRadiusToCSS(node.cornerRadius))
      Object.assign(css, effectsToCSS(node.effects))
      const className = nextClassName(
        node.name?.replace(/\s+/g, '-').toLowerCase() ?? 'image',
      )
      rules.push({ className, properties: css })
      return `${pad}<img ${nodeIdAttr} class="${className}" src="${node.src}" alt="${escapeHTML(node.name ?? 'image')}"${connAttrs} />`
    }

    case 'icon_font': {
      const size = typeof node.width === 'number' ? node.width : 24
      css.width = `${size}px`
      css.height = `${size}px`
      const iconColor = node.fill?.[0]?.type === 'solid'
        ? varOrLiteral(node.fill[0].color)
        : 'currentColor'
      const className = nextClassName(
        node.name?.replace(/\s+/g, '-').toLowerCase() ?? 'icon',
      )
      rules.push({ className, properties: css })

      // Resolve icon to inline SVG via icon-resolver
      const iconName = node.iconFontName ?? node.name ?? 'circle'
      const iconMatch = lookupIconByName(iconName)
      if (iconMatch) {
        const strokeOrFill = iconMatch.style === 'stroke'
          ? `fill="none" stroke="${iconColor}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"`
          : `fill="${iconColor}"`
        return `${pad}<svg ${nodeIdAttr} class="${className}" viewBox="0 0 24 24" ${strokeOrFill}${connAttrs}>\n${pad}  <path d="${iconMatch.d}" />\n${pad}</svg>`
      }
      // Fallback: render a placeholder circle
      return `${pad}<svg ${nodeIdAttr} class="${className}" viewBox="0 0 24 24" fill="none" stroke="${iconColor}" stroke-width="2"${connAttrs}>\n${pad}  <circle cx="12" cy="12" r="10" />\n${pad}</svg>`
    }

    case 'ref':
      // RefNodes should be expanded by resolvePageForPreview before reaching here.
      // Fallback to a comment if not expanded.
      return `${pad}<!-- Component: ${(node as import('@/types/pen').RefNode).ref} -->`

    default:
      return `${pad}<!-- Unknown node -->`
  }
}

// ---------------------------------------------------------------------------
// Connection attribute builder
// ---------------------------------------------------------------------------

function buildConnectionAttrs(
  nodeId: string,
  connections: ScreenConnection[],
): string {
  const nodeConns = connections.filter((c) => c.sourceElementId === nodeId)
  if (nodeConns.length === 0) return ''

  const attrs: string[] = []
  for (const conn of nodeConns) {
    if (conn.triggerEvent === 'click') {
      attrs.push(`data-nav-click="${conn.sourceElementId}"`)
    } else if (conn.triggerEvent === 'hover') {
      attrs.push(`data-nav-hover="${conn.sourceElementId}"`)
    } else if (conn.triggerEvent === 'submit') {
      attrs.push(`data-nav-submit="${conn.sourceElementId}"`)
    }
  }
  attrs.push('tabindex="0"')
  return ' ' + attrs.join(' ')
}

// ---------------------------------------------------------------------------
// Helper: extract first text content from children
// ---------------------------------------------------------------------------

function getFirstTextContent(node: PenNode): string {
  if ('children' in node && node.children) {
    for (const child of node.children) {
      if (child.type === 'text') {
        return getTextContent(child as TextNode)
      }
    }
  }
  return ''
}

// ---------------------------------------------------------------------------
// Helper: generate <table> from table role
// ---------------------------------------------------------------------------

function generateTableHTMLNode(
  node: PenNode,
  pad: string,
  nodeIdAttr: string,
  rules: CSSRule[],
  _connections: ScreenConnection[],
): string {
  const children = ('children' in node && node.children) ? node.children : []
  if (children.length === 0) return `${pad}<table ${nodeIdAttr}></table>`

  const tableCss: Record<string, string> = {
    'border-collapse': 'collapse',
    'width': '100%',
  }
  if ('width' in node && typeof node.width === 'number') tableCss.width = `${node.width}px`
  if (node.x !== undefined || node.y !== undefined) {
    tableCss.position = 'absolute'
    if (node.x !== undefined) tableCss.left = `${node.x}px`
    if (node.y !== undefined) tableCss.top = `${node.y}px`
  }
  if ('stroke' in node) Object.assign(tableCss, strokeToCSS(node.stroke))
  if ('cornerRadius' in node) Object.assign(tableCss, cornerRadiusToCSS(node.cornerRadius))
  if ('fill' in node) Object.assign(tableCss, fillToCSS(node.fill))

  const tableClassName = nextClassName('table')
  rules.push({ className: tableClassName, properties: tableCss })

  // Cell style
  const cellClassName = nextClassName('table-cell')
  rules.push({
    className: cellClassName,
    properties: {
      padding: '8px 12px',
      'border-bottom': '1px solid #e5e7eb',
      'text-align': 'left',
      'font-size': '14px',
    },
  })
  const thClassName = nextClassName('table-th')
  rules.push({
    className: thClassName,
    properties: {
      padding: '8px 12px',
      'border-bottom': '2px solid #d1d5db',
      'text-align': 'left',
      'font-size': '14px',
      'font-weight': '600',
    },
  })

  // Categorize children: first frame with text children = header, table-row role = data rows
  let headerRow: PenNode | undefined
  const dataRows: PenNode[] = []

  for (const child of children) {
    if (child.role === 'table-row') {
      dataRows.push(child)
    } else if (
      !headerRow &&
      child.type === 'frame' &&
      'children' in child &&
      child.children?.some((gc) => gc.type === 'text')
    ) {
      headerRow = child
    }
    // skip separators (lines, rectangles without text)
  }

  const lines: string[] = []
  lines.push(`${pad}<table ${nodeIdAttr} class="${tableClassName}">`)

  // Thead
  if (headerRow) {
    lines.push(`${pad}  <thead>`)
    lines.push(`${pad}    <tr>`)
    const headerChildren = ('children' in headerRow && headerRow.children) ? headerRow.children : []
    for (const cell of headerChildren) {
      if (cell.type === 'text') {
        const text = escapeHTML(getTextContent(cell as TextNode))
        lines.push(`${pad}      <th class="${thClassName}">${text}</th>`)
      }
    }
    lines.push(`${pad}    </tr>`)
    lines.push(`${pad}  </thead>`)
  }

  // Tbody
  if (dataRows.length > 0) {
    lines.push(`${pad}  <tbody>`)
    for (const row of dataRows) {
      lines.push(`${pad}    <tr>`)
      const rowChildren = ('children' in row && row.children) ? row.children : []
      for (const cell of rowChildren) {
        if (cell.type === 'text') {
          const text = escapeHTML(getTextContent(cell as TextNode))
          lines.push(`${pad}      <td class="${cellClassName}">${text}</td>`)
        } else if ('children' in cell && cell.children) {
          // Cell might be a frame wrapping text
          const innerText = cell.children
            .filter((c) => c.type === 'text')
            .map((c) => escapeHTML(getTextContent(c as TextNode)))
            .join(' ')
          lines.push(`${pad}      <td class="${cellClassName}">${innerText}</td>`)
        }
      }
      lines.push(`${pad}    </tr>`)
    }
    lines.push(`${pad}  </tbody>`)
  }

  lines.push(`${pad}</table>`)
  return lines.join('\n')
}

// ---------------------------------------------------------------------------
// Helper: generate <select> from dropdown/select role
// ---------------------------------------------------------------------------

function generateSelectHTML(
  node: PenNode,
  pad: string,
  nodeIdAttr: string,
  className: string,
  connAttrs: string,
): string {
  const children = ('children' in node && node.children) ? node.children : []
  const options = children
    .filter((c) => c.type === 'text')
    .map((c) => {
      const text = escapeHTML(getTextContent(c as TextNode))
      return `${pad}  <option>${text}</option>`
    })

  if (options.length === 0) {
    return `${pad}<select ${nodeIdAttr} class="${className}"${connAttrs}></select>`
  }

  return `${pad}<select ${nodeIdAttr} class="${className}"${connAttrs}>\n${options.join('\n')}\n${pad}</select>`
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Generate HTML + CSS for a page's nodes.
 *
 * @param pageChildren - The resolved PenNode array for the page
 * @param connections - Screen connections for navigation attributes
 * @returns Object with html (page body content) and css (style rules)
 */
export function generatePageHTML(
  pageChildren: PenNode[],
  connections: ScreenConnection[],
): { html: string; css: string } {
  resetClassCounter()
  const rules: CSSRule[] = []

  const childrenHTML = pageChildren
    .map((n) => generateNodeHTML(n, 2, rules, connections))
    .join('\n')

  const html = `    <div class="page-root">\n${childrenHTML}\n    </div>`
  const css = cssRulesToString(rules)

  return { html, css }
}

/**
 * Generate a complete self-contained HTML document for preview.
 *
 * Produces a multi-page document with:
 * - All screen pages rendered as page-container divs (initial page active)
 * - Navigation JS with hash routing and transition animations
 * - Toolbar with back, breadcrumb, hotspots, refresh, download
 * - CSS variables, generated styles, transition CSS, toolbar CSS
 * - SSE hot reload listener
 *
 * @param doc - The PenDocument to render
 * @param pageId - Target page ID (null for first screen page)
 * @param frameId - Optional target frame ID within the page
 * @param previewId - Unique preview session ID for SSE hot reload
 * @returns Complete HTML document string
 */
export function generatePreviewHTML(
  doc: PenDocument,
  pageId: string | null,
  frameId: string | null,
  previewId: string,
): string {
  const connections = doc.connections ?? []

  // Determine the initial target page
  const initialPage = findTargetPage(doc, pageId)
  const pageName = initialPage?.name ?? 'Preview'
  const initialPageId = initialPage?.id ?? 'default'

  // Gather all screen pages for multi-page rendering
  const screenPages = getScreenPages(doc)

  // Build page containers and collect all CSS
  const allCSS: string[] = []
  const pageContainers: string[] = []
  const pageList: { id: string; name: string }[] = []
  let effectiveInitialPageId = initialPageId

  for (const sp of screenPages) {
    const isInitialPage = sp.id === initialPageId

    // Filter out reusable component definitions before rendering
    const previewChildren = getPreviewableChildren(sp.children)

    // Check for multi-view: 2+ root-level frames → each frame becomes a separate view
    const rootFrames = previewChildren.filter((c) => c.type === 'frame')

    if (rootFrames.length > 1) {
      // Multi-view: each root frame becomes its own navigable page-container
      for (let fi = 0; fi < rootFrames.length; fi++) {
        const frame = rootFrames[fi]
        const isFirstFrame = fi === 0

        // First frame inherits the page ID; others get frame-suffixed ID
        const containerId = isFirstFrame ? sp.id : `${sp.id}__frame-${frame.id}`

        // Determine if this container should be initially active
        let isInitial = false
        if (isInitialPage) {
          if (frameId && frame.id === frameId) {
            isInitial = true
            effectiveInitialPageId = containerId
          } else if (!frameId && isFirstFrame) {
            isInitial = true
          }
        }

        // Zero-out canvas position so the frame fills the preview viewport
        const viewNode: PenNode = { ...frame, x: 0, y: 0 } as PenNode
        const resolvedNodes = resolvePageForPreview([viewNode], doc)
        const { html: pageHTML, css: generatedCSS } = generatePageHTML(resolvedNodes, connections)

        if (generatedCSS) allCSS.push(generatedCSS)

        const activeClass = isInitial ? ' active' : ''
        pageContainers.push(
          `  <div id="page-${escapeHTML(containerId)}" class="page-container${activeClass}">\n${pageHTML}\n  </div>`,
        )

        pageList.push({ id: containerId, name: frame.name || `${sp.name} - View ${fi + 1}` })
      }
    } else {
      // Single view: all children in one container (excluding component definitions)
      let pageNodes: PenNode[] = previewChildren
      if (isInitialPage && frameId && pageNodes.length > 0) {
        const frame = findFrameById(pageNodes, frameId)
        if (frame && 'children' in frame && frame.children) {
          pageNodes = frame.children
        }
      }

      const resolvedNodes = resolvePageForPreview(pageNodes, doc)
      const { html: pageHTML, css: generatedCSS } = generatePageHTML(resolvedNodes, connections)

      if (generatedCSS) allCSS.push(generatedCSS)

      const isInitial = sp.id === initialPageId
      const activeClass = isInitial ? ' active' : ''
      pageContainers.push(
        `  <div id="page-${escapeHTML(sp.id)}" class="page-container${activeClass}">\n${pageHTML}\n  </div>`,
      )

      pageList.push({ id: sp.id, name: sp.name })
    }
  }

  // If no screen pages found, render doc.children as default page (excluding components)
  if (screenPages.length === 0) {
    let targetNodes = getPreviewableChildren(doc.children)
    if (frameId && targetNodes.length > 0) {
      const frame = findFrameById(targetNodes, frameId)
      if (frame && 'children' in frame && frame.children) {
        targetNodes = frame.children
      }
    }
    const resolvedNodes = resolvePageForPreview(targetNodes, doc)
    const { html: pageHTML, css: generatedCSS } = generatePageHTML(
      resolvedNodes,
      connections,
    )
    if (generatedCSS) allCSS.push(generatedCSS)
    pageContainers.push(
      `  <div id="page-default" class="page-container active">\n${pageHTML}\n  </div>`,
    )
    pageList.push({ id: 'default', name: 'Preview' })
  }

  // Generate CSS variables from document
  const cssVariables = generateCSSVariables(doc)

  // Generate navigation and toolbar assets
  const navCSS = generateNavigationCSS()
  const toolbarCSS = generateToolbarCSS()
  const toolbarHTML = generateToolbarHTML(pageName)

  const toolbarJS = generateToolbarJS()
  const navJS = generateNavigationJS(connections, pageList, effectiveInitialPageId, previewId)

  // Build complete HTML document
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; img-src data: blob:; font-src data:;" />
  <title>Preview - ${escapeHTML(pageName)}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { overflow: auto; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; }
    .page-root { position: relative; }
    ${toolbarCSS}
    ${navCSS}
    ${cssVariables}
    ${allCSS.join('\n    ')}
  </style>
</head>
<body>
  ${toolbarHTML}
${pageContainers.join('\n')}
  <script>
    ${toolbarJS}
    ${navJS}
  </script>
</body>
</html>`
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/**
 * Get all screen-type pages from the document (ERD/component pages are not previewable).
 * Filters out pages that are explicitly typed as 'erd' or 'component',
 * and pages whose children are ALL reusable component definitions.
 */
function getScreenPages(doc: PenDocument): PenPage[] {
  if (!doc.pages || doc.pages.length === 0) return []
  return doc.pages.filter((p) => {
    // Explicit type filtering
    if (p.type === 'erd' || p.type === 'component') return false
    // Filter out pages where ALL children are reusable component definitions
    const previewable = getPreviewableChildren(p.children)
    return previewable.length > 0
  })
}

/**
 * Filter out reusable component definitions from children.
 * Components (reusable: true) are definitions, not screen content.
 */
function getPreviewableChildren(children: PenNode[]): PenNode[] {
  return children.filter((n) => !(n.type === 'frame' && (n as import('@/types/pen').FrameNode).reusable))
}

function findTargetPage(
  doc: PenDocument,
  pageId: string | null,
): PenPage | undefined {
  if (!doc.pages || doc.pages.length === 0) return undefined

  // If pageId specified, find that page
  if (pageId) {
    return doc.pages.find((p) => p.id === pageId)
  }

  // Default: first screen page, or first page
  return (
    doc.pages.find((p) => p.type === 'screen') ?? doc.pages[0]
  )
}

function findFrameById(
  nodes: PenNode[],
  frameId: string,
): PenNode | undefined {
  for (const node of nodes) {
    if (node.id === frameId) return node
    if ('children' in node && node.children) {
      const found = findFrameById(node.children, frameId)
      if (found) return found
    }
  }
  return undefined
}
