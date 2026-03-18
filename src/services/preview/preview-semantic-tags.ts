/**
 * Maps PenNode semantic roles to appropriate HTML tags for preview rendering.
 *
 * Used by preview-html-generator to produce semantically correct HTML output
 * instead of wrapping everything in <div>.
 */

/** Role → HTML tag mapping. */
export const ROLE_TAG_MAP: Record<string, string> = {
  // Navigation
  navbar: 'nav',
  'nav-links': 'ul',
  'nav-link': 'li',
  sidebar: 'aside',

  // Interactive
  button: 'button',
  'icon-button': 'button',
  input: 'input',
  'form-input': 'input',
  textarea: 'textarea',
  checkbox: 'input',
  radio: 'input',
  dropdown: 'select',
  select: 'select',
  'search-bar': 'div',

  // Display
  badge: 'span',
  tag: 'span',
  chip: 'span',

  // Layout
  section: 'section',
  'form-group': 'form',
  hero: 'section',
  card: 'article',
  footer: 'footer',
  header: 'header',
  'main-content': 'main',

  // Table
  table: 'table',
  'table-header': 'thead',
  'table-row': 'tr',
  'table-cell': 'td',

  // Typography
  heading: 'h2',
  subheading: 'h3',
  paragraph: 'p',
  caption: 'span',
}

/**
 * Get the semantic HTML tag for a node based on its role and type.
 *
 * @param role - Semantic role from PenNode.role
 * @param nodeType - The PenNode type (frame, text, etc.)
 * @param fontSize - Optional font size for text node heuristic
 * @returns The HTML tag name
 */
export function getSemanticTag(
  role: string | undefined,
  nodeType: string,
  fontSize?: number,
): string {
  if (role && role in ROLE_TAG_MAP) {
    return ROLE_TAG_MAP[role]
  }

  // Text node heuristic based on font size
  if (nodeType === 'text') {
    if (fontSize !== undefined) {
      if (fontSize >= 32) return 'h1'
      if (fontSize >= 24) return 'h2'
      if (fontSize >= 20) return 'h3'
    }
    return 'p'
  }

  return 'div'
}
