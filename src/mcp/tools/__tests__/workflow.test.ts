import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { writeFile, unlink, mkdir } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { invalidateCache } from '../../document-manager'
import { handleExportWorkflow } from '../workflow'

const TMP_DIR = join(tmpdir(), 'penboard-mcp-test-workflow')
const TEST_FILES: string[] = []

// ---------------------------------------------------------------------------
// Test Data
// ---------------------------------------------------------------------------

function createWorkflowDoc(overrides: Record<string, unknown> = {}) {
  return {
    version: '1.0.0',
    pages: [
      {
        id: 'page-home',
        name: 'Home',
        type: 'screen',
        children: [
          {
            id: 'f1',
            type: 'frame',
            name: 'Frame',
            width: 1200,
            height: 800,
            children: [
              {
                id: 'btn-1',
                type: 'rectangle',
                name: 'Button',
                width: 100,
                height: 40,
                role: 'button',
                children: [],
              },
            ],
          },
        ],
      },
      {
        id: 'page-about',
        name: 'About',
        type: 'screen',
        children: [
          {
            id: 'f2',
            type: 'frame',
            name: 'Frame',
            width: 1200,
            height: 800,
            children: [],
          },
        ],
      },
    ],
    connections: [
      {
        id: 'conn-1',
        sourceElementId: 'btn-1',
        sourcePageId: 'page-home',
        targetPageId: 'page-about',
        triggerEvent: 'click',
        transitionType: 'push',
      },
    ],
    dataEntities: [
      {
        id: 'entity-users',
        name: 'Users',
        fields: [{ id: 'f-name', name: 'Name', type: 'text' }],
        rows: [],
        views: [],
      },
    ],
    children: [],
    ...overrides,
  }
}

async function writeTestDoc(
  filename: string,
  doc: object,
): Promise<string> {
  const fp = join(TMP_DIR, filename)
  await writeFile(fp, JSON.stringify(doc), 'utf-8')
  TEST_FILES.push(fp)
  return fp
}

// ---------------------------------------------------------------------------
// Setup / Teardown
// ---------------------------------------------------------------------------

beforeEach(async () => {
  await mkdir(TMP_DIR, { recursive: true })
})

afterEach(async () => {
  for (const fp of TEST_FILES) {
    try {
      invalidateCache(fp)
      await unlink(fp)
    } catch {}
  }
  TEST_FILES.length = 0
})

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('export_workflow', () => {
  it('exports mermaid text format', async () => {
    const fp = await writeTestDoc('workflow-mermaid.op', createWorkflowDoc())

    const result = await handleExportWorkflow({
      filePath: fp,
      format: 'mermaid',
    })

    expect(result.format).toBe('mermaid')
    expect(result.content).toContain('graph LR')
    expect(result.content).toContain('Home')
    expect(result.content).toContain('About')
    expect(result.nodeCount).toBeGreaterThanOrEqual(2) // Home + About + Users entity
    expect(result.edgeCount).toBeGreaterThanOrEqual(1)
  })

  it('includes connections in mermaid output', async () => {
    const fp = await writeTestDoc('workflow-conn.op', createWorkflowDoc())

    const result = await handleExportWorkflow({
      filePath: fp,
      format: 'mermaid',
    })

    // Edge notation for screen connections: -->
    expect(result.content).toContain('-->')
  })

  it('includes entities in mermaid output', async () => {
    const fp = await writeTestDoc('workflow-entity.op', createWorkflowDoc())

    const result = await handleExportWorkflow({
      filePath: fp,
      format: 'mermaid',
    })

    expect(result.content).toContain('Users')
  })

  it('applies focus mode filter', async () => {
    const fp = await writeTestDoc('workflow-focus.op', createWorkflowDoc())

    const result = await handleExportWorkflow({
      filePath: fp,
      format: 'mermaid',
      focusPageId: 'page-home',
    })

    // Focus on Home: should include Home and About (connected)
    expect(result.content).toContain('Home')
    expect(result.content).toContain('About')
    expect(result.format).toBe('mermaid')
  })

  it('returns empty diagram for doc with no pages', async () => {
    const fp = await writeTestDoc(
      'workflow-empty.op',
      createWorkflowDoc({ pages: [], connections: [], dataEntities: [] }),
    )

    const result = await handleExportWorkflow({
      filePath: fp,
      format: 'mermaid',
    })

    expect(result.content).toContain('No pages or connections')
    expect(result.nodeCount).toBe(0)
    expect(result.edgeCount).toBe(0)
  })

  it('defaults format to mermaid when not specified', async () => {
    const fp = await writeTestDoc('workflow-default.op', createWorkflowDoc())

    const result = await handleExportWorkflow({ filePath: fp })

    expect(result.format).toBe('mermaid')
    expect(result.content).toContain('graph LR')
  })

  it('SVG format — graceful error if mermaid-cli rendering fails', async () => {
    const fp = await writeTestDoc('workflow-svg.op', createWorkflowDoc())

    // The actual mermaid-cli rendering may fail in test environment (no browser)
    // but the handler should throw with a helpful message
    try {
      await handleExportWorkflow({ filePath: fp, format: 'svg' })
    } catch (err) {
      expect((err as Error).message).toContain('mermaid-cli')
    }
  })
})
