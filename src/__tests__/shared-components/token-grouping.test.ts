import { describe, it, expect } from 'vitest'
import type { VariableDefinition } from '@/types/variables'

// We need to mock React hooks because variables-panel is a React component module
// but groupVariablesByCategory is a pure exported function
vi.mock('react', async (importOriginal) => {
  const actual = await importOriginal()
  return actual
})

// Mock the stores imported by variables-panel (not used by the pure function, but required for module load)
vi.mock('@/stores/document-store', () => ({ useDocumentStore: vi.fn() }))
vi.mock('@/stores/canvas-store', () => ({ useCanvasStore: vi.fn() }))
vi.mock('@/stores/theme-preset-store', () => ({ useThemePresetStore: vi.fn() }))
vi.mock('@/utils/theme-preset-io', () => ({ exportThemePreset: vi.fn(), importThemePreset: vi.fn() }))
vi.mock('./variable-row', () => ({ default: vi.fn() }))
vi.mock('./variable-group', () => ({ default: vi.fn() }))

import { vi } from 'vitest'
import { groupVariablesByCategory } from '@/components/panels/variables-panel'

function colorVar(): VariableDefinition { return { type: 'color', value: '#FF0000' } }
function numVar(): VariableDefinition { return { type: 'number', value: 0 } }
function strVar(): VariableDefinition { return { type: 'string', value: '' } }

describe('groupVariablesByCategory', () => {
  it('places color type variables in Colors group', () => {
    const entries: [string, VariableDefinition][] = [
      ['primary-color', colorVar()],
      ['bg', colorVar()],
    ]
    const groups = groupVariablesByCategory(entries)
    expect(groups.Colors).toHaveLength(2)
    expect(groups.Spacing).toHaveLength(0)
    expect(groups.Typography).toHaveLength(0)
    expect(groups.Other).toHaveLength(0)
  })

  it('places number variables in Spacing by default', () => {
    const entries: [string, VariableDefinition][] = [
      ['spacing-md', numVar()],
      ['gap-large', numVar()],
      ['padding-sm', numVar()],
    ]
    const groups = groupVariablesByCategory(entries)
    expect(groups.Spacing).toHaveLength(3)
    expect(groups.Typography).toHaveLength(0)
  })

  it('places number variables with font in name in Typography', () => {
    const entries: [string, VariableDefinition][] = [
      ['font-size', numVar()],
      ['fontSize', numVar()],
    ]
    const groups = groupVariablesByCategory(entries)
    expect(groups.Typography).toHaveLength(2)
    expect(groups.Spacing).toHaveLength(0)
  })

  it('places number variables with size in name in Typography', () => {
    const groups = groupVariablesByCategory([['size-h1', numVar()]])
    expect(groups.Typography).toHaveLength(1)
  })

  it('places number variables with line in name in Typography', () => {
    const groups = groupVariablesByCategory([['line-height', numVar()]])
    expect(groups.Typography).toHaveLength(1)
  })

  it('places number variables with letter in name in Typography', () => {
    const groups = groupVariablesByCategory([['letter-spacing', numVar()]])
    expect(groups.Typography).toHaveLength(1)
  })

  it('places number variables with text in name in Typography', () => {
    const groups = groupVariablesByCategory([['text-size', numVar()]])
    expect(groups.Typography).toHaveLength(1)
  })

  it('places number variables with typo in name in Typography', () => {
    const groups = groupVariablesByCategory([['typo-caption', numVar()]])
    expect(groups.Typography).toHaveLength(1)
  })

  it('places string variables with font in name in Typography', () => {
    const entries: [string, VariableDefinition][] = [
      ['font-family', strVar()],
      ['fontFamily', strVar()],
    ]
    const groups = groupVariablesByCategory(entries)
    expect(groups.Typography).toHaveLength(2)
    expect(groups.Other).toHaveLength(0)
  })

  it('places string variables without font in name in Other', () => {
    const entries: [string, VariableDefinition][] = [
      ['border-radius', strVar()],
      ['shadow', strVar()],
    ]
    const groups = groupVariablesByCategory(entries)
    expect(groups.Other).toHaveLength(2)
    expect(groups.Typography).toHaveLength(0)
  })

  it('returns empty groups for empty input', () => {
    const groups = groupVariablesByCategory([])
    expect(groups.Colors).toHaveLength(0)
    expect(groups.Spacing).toHaveLength(0)
    expect(groups.Typography).toHaveLength(0)
    expect(groups.Other).toHaveLength(0)
  })

  it('correctly mixes all categories', () => {
    const entries: [string, VariableDefinition][] = [
      ['primary', colorVar()],
      ['spacing-md', numVar()],
      ['font-size', numVar()],
      ['font-family', strVar()],
      ['border-style', strVar()],
    ]
    const groups = groupVariablesByCategory(entries)
    expect(groups.Colors).toHaveLength(1)
    expect(groups.Spacing).toHaveLength(1)
    expect(groups.Typography).toHaveLength(2)
    expect(groups.Other).toHaveLength(1)
  })

  it('heuristic is case-insensitive', () => {
    const entries: [string, VariableDefinition][] = [
      ['FONT-SIZE', numVar()],
      ['SPACING-LG', numVar()],
    ]
    const groups = groupVariablesByCategory(entries)
    expect(groups.Typography).toHaveLength(1)
    expect(groups.Spacing).toHaveLength(1)
  })
})
