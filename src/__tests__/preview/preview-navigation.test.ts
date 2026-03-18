import { describe, it, expect } from 'vitest'
import {
  buildConnectionMap,
  generateNavigationJS,
  generateNavigationCSS,
} from '@/services/preview/preview-navigation'
import type { ScreenConnection } from '@/types/pen'

describe('buildConnectionMap', () => {
  it('builds JS object literal from connections', () => {
    const connections: ScreenConnection[] = [
      {
        id: 'c1',
        sourceElementId: 'btn-1',
        sourcePageId: 'page-a',
        targetPageId: 'page-b',
        targetFrameId: 'frame-1',
        triggerEvent: 'click',
        transitionType: 'push',
      },
      {
        id: 'c2',
        sourceElementId: 'link-2',
        sourcePageId: 'page-a',
        targetPageId: 'page-c',
        triggerEvent: 'hover',
        transitionType: 'modal',
      },
      {
        id: 'c3',
        sourceElementId: 'form-3',
        sourcePageId: 'page-b',
        targetPageId: 'page-a',
        triggerEvent: 'submit',
        transitionType: 'replace',
      },
    ]

    const result = buildConnectionMap(connections)
    // Should contain the source element IDs as keys
    expect(result).toContain('"btn-1"')
    expect(result).toContain('"link-2"')
    expect(result).toContain('"form-3"')
    // Should contain target page IDs
    expect(result).toContain('page-b')
    expect(result).toContain('page-c')
    expect(result).toContain('page-a')
    // Should contain transition types
    expect(result).toContain('push')
    expect(result).toContain('modal')
    expect(result).toContain('replace')
    // Should contain trigger types
    expect(result).toContain('click')
    expect(result).toContain('hover')
    expect(result).toContain('submit')
    // Should contain targetFrameId when present
    expect(result).toContain('frame-1')
  })

  it('returns empty object literal for empty array', () => {
    const result = buildConnectionMap([])
    expect(result).toBe('{}')
  })
})

describe('generateNavigationJS', () => {
  const connections: ScreenConnection[] = [
    {
      id: 'c1',
      sourceElementId: 'btn-1',
      sourcePageId: 'page-a',
      targetPageId: 'page-b',
      triggerEvent: 'click',
      transitionType: 'push',
    },
  ]
  const pages = [
    { id: 'page-a', name: 'Home' },
    { id: 'page-b', name: 'About' },
  ]

  it('includes popstate listener for browser back', () => {
    const js = generateNavigationJS(connections, pages, 'page-a', 'prev-1')
    expect(js).toContain('popstate')
  })

  it('includes click event delegation for data-nav-click elements', () => {
    const js = generateNavigationJS(connections, pages, 'page-a', 'prev-1')
    expect(js).toContain('data-nav-click')
  })

  it('includes hover event delegation for data-nav-hover elements', () => {
    const js = generateNavigationJS(connections, pages, 'page-a', 'prev-1')
    expect(js).toContain('data-nav-hover')
  })

  it('includes submit event delegation for data-nav-submit elements', () => {
    const js = generateNavigationJS(connections, pages, 'page-a', 'prev-1')
    expect(js).toContain('data-nav-submit')
  })

  it('includes history.pushState for push transitions', () => {
    const js = generateNavigationJS(connections, pages, 'page-a', 'prev-1')
    expect(js).toContain('pushState')
  })

  it('includes history.replaceState for replace transitions', () => {
    const js = generateNavigationJS(connections, pages, 'page-a', 'prev-1')
    expect(js).toContain('replaceState')
  })

  it('includes modal overlay creation for modal transitions', () => {
    const js = generateNavigationJS(connections, pages, 'page-a', 'prev-1')
    expect(js).toContain('modal-backdrop')
  })

  it('includes scrollIntoView for targetFrameId', () => {
    const js = generateNavigationJS(connections, pages, 'page-a', 'prev-1')
    expect(js).toContain('scrollIntoView')
  })

  it('includes showNotFound with "Page not found" message', () => {
    const js = generateNavigationJS(connections, pages, 'page-a', 'prev-1')
    expect(js).toContain('Page not found')
  })

  it('includes hotspot toggle function', () => {
    const js = generateNavigationJS(connections, pages, 'page-a', 'prev-1')
    expect(js).toContain('__toggleHotspots')
  })
})

describe('generateNavigationCSS', () => {
  it('includes slideOutLeft keyframes', () => {
    const css = generateNavigationCSS()
    expect(css).toContain('slideOutLeft')
  })

  it('includes modal-backdrop styles', () => {
    const css = generateNavigationCSS()
    expect(css).toContain('modal-backdrop')
  })

  it('includes hotspot-active highlight class', () => {
    const css = generateNavigationCSS()
    expect(css).toContain('hotspot-active')
  })

  it('includes cursor pointer for nav elements on hover', () => {
    const css = generateNavigationCSS()
    expect(css).toContain('cursor: pointer')
  })
})
