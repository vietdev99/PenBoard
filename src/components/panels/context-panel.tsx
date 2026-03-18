import { useState, useEffect, useCallback, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { Sparkles, Loader2, ChevronDown, ChevronRight } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useCanvasStore } from '@/stores/canvas-store'
import { useDocumentStore, getActivePageChildren } from '@/stores/document-store'
import { useHistoryStore } from '@/stores/history-store'
import { useAIStore } from '@/stores/ai-store'
import type { PenNode, PenPage, RefNode } from '@/types/pen'

// ---------------------------------------------------------------------------
// AI Suggest
// ---------------------------------------------------------------------------

async function suggestContext(
  node: PenNode,
  signal: AbortSignal,
): Promise<string> {
  const n = node as unknown as Record<string, unknown>
  const nodeInfo = {
    type: node.type,
    name: node.name,
    role: n.role,
    width: n.width,
    height: n.height,
    childCount:
      'children' in node && Array.isArray(n.children)
        ? (n.children as unknown[]).length
        : 0,
  }

  // Resolve provider and model from AI store (same pattern as ai-chat-handlers)
  const aiState = useAIStore.getState()
  const model = aiState.model
  const provider = aiState.modelGroups.find((g) =>
    g.models.some((m) => m.value === model),
  )?.provider

  if (!model || !provider) {
    throw new Error('No AI model configured. Please select a model in the AI panel first.')
  }

  const response = await fetch('/api/ai/generate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      system:
        'You are a UI/UX context annotator. Given a design element, write a brief 1-3 sentence description of its purpose and behavior. Be specific and actionable. Do not use markdown formatting.',
      message: `Describe the purpose of this UI element:\n${JSON.stringify(nodeInfo, null, 2)}`,
      model,
      provider,
    }),
    signal,
  })
  if (!response.ok) throw new Error('AI suggest failed')
  const data = (await response.json()) as { text?: string; error?: string }
  if (data.error) throw new Error(data.error)
  return data.text?.trim() ?? ''
}

// ---------------------------------------------------------------------------
// ContextEditorWithPreview
// ---------------------------------------------------------------------------

type SubTab = 'edit' | 'preview'

interface EditorProps {
  value: string
  onChange: (v: string) => void
  placeholder: string
  disabled?: boolean
}

function ContextEditorWithPreview({
  value,
  onChange,
  placeholder,
  disabled,
}: EditorProps) {
  const { t } = useTranslation()
  const [subTab, setSubTab] = useState<SubTab>('edit')

  return (
    <div className="flex flex-col flex-1 min-h-0">
      {/* Sub-tab toggle */}
      <div className="flex items-center gap-1 px-2 py-1 border-b border-border shrink-0">
        <button
          type="button"
          onClick={() => setSubTab('edit')}
          className={cn(
            'text-[10px] font-medium px-1.5 py-0.5 rounded transition-colors',
            subTab === 'edit'
              ? 'bg-secondary text-foreground'
              : 'text-muted-foreground hover:text-foreground',
          )}
        >
          {t('context.editTab')}
        </button>
        <button
          type="button"
          onClick={() => setSubTab('preview')}
          className={cn(
            'text-[10px] font-medium px-1.5 py-0.5 rounded transition-colors',
            subTab === 'preview'
              ? 'bg-secondary text-foreground'
              : 'text-muted-foreground hover:text-foreground',
          )}
        >
          {t('context.previewTab')}
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto min-h-0">
        {subTab === 'edit' ? (
          <textarea
            className="w-full h-full min-h-[120px] bg-transparent text-foreground text-xs p-2 resize-none outline-none border border-border rounded focus:border-primary/50"
            placeholder={placeholder}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            disabled={disabled}
          />
        ) : value ? (
          <div className="p-2">
            <ReactMarkdown
              remarkPlugins={[remarkGfm]}
              components={{
                h1: ({ children }) => (
                  <h1 className="text-sm font-bold text-foreground mb-1">
                    {children}
                  </h1>
                ),
                h2: ({ children }) => (
                  <h2 className="text-xs font-semibold text-foreground mb-1">
                    {children}
                  </h2>
                ),
                h3: ({ children }) => (
                  <h3 className="text-xs font-medium text-foreground mb-0.5">
                    {children}
                  </h3>
                ),
                p: ({ children }) => (
                  <p className="text-xs text-foreground/80 leading-relaxed mb-1">
                    {children}
                  </p>
                ),
                ul: ({ children }) => (
                  <ul className="text-xs list-disc pl-4 mb-1">{children}</ul>
                ),
                ol: ({ children }) => (
                  <ol className="text-xs list-decimal pl-4 mb-1">
                    {children}
                  </ol>
                ),
                li: ({ children }) => (
                  <li className="text-xs text-foreground/80 mb-0.5">
                    {children}
                  </li>
                ),
                a: ({ href, children }) => (
                  <a
                    href={href}
                    className="text-primary underline"
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    {children}
                  </a>
                ),
                code: ({ children }) => (
                  <code className="bg-secondary px-1 py-0.5 rounded text-[10px]">
                    {children}
                  </code>
                ),
                pre: ({ children }) => (
                  <pre className="bg-secondary p-2 rounded text-[10px] overflow-x-auto mb-1">
                    {children}
                  </pre>
                ),
                blockquote: ({ children }) => (
                  <blockquote className="border-l-2 border-border pl-2 text-xs text-muted-foreground mb-1">
                    {children}
                  </blockquote>
                ),
              }}
            >
              {value}
            </ReactMarkdown>
          </div>
        ) : (
          <p className="text-muted-foreground text-xs italic p-2">
            No context yet
          </p>
        )}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// PageContextEditor
// ---------------------------------------------------------------------------

function PageContextEditor() {
  const { t } = useTranslation()
  const activePageId = useCanvasStore((s) => s.activePageId)
  const document = useDocumentStore((s) => s.document)
  const page = document.pages?.find((p) => p.id === activePageId) as
    | PenPage
    | undefined

  const [localValue, setLocalValue] = useState(page?.context ?? '')
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const pendingValueRef = useRef<string | null>(null)

  // Reset local value when page changes
  useEffect(() => {
    setLocalValue(page?.context ?? '')
  }, [activePageId, page?.context])

  const flushPageContext = useCallback((value: string) => {
    if (!activePageId) return
    const doc = useDocumentStore.getState().document
    const currentPage = doc.pages?.find((p) => p.id === activePageId)
    if (!currentPage) return
    useHistoryStore.getState().pushState(doc)
    const updatedPages = doc.pages?.map((p) =>
      p.id === activePageId
        ? { ...p, context: value || undefined }
        : p,
    )
    useDocumentStore.setState({
      document: { ...doc, pages: updatedPages },
      isDirty: true,
    })
  }, [activePageId])

  const debouncedSave = useCallback(
    (value: string) => {
      pendingValueRef.current = value
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current)
      saveTimerRef.current = setTimeout(() => {
        flushPageContext(value)
        pendingValueRef.current = null
      }, 500)
    },
    [flushPageContext],
  )

  // Flush pending save on unmount
  useEffect(() => {
    return () => {
      if (saveTimerRef.current) {
        clearTimeout(saveTimerRef.current)
        saveTimerRef.current = null
        if (pendingValueRef.current !== null) {
          flushPageContext(pendingValueRef.current)
          pendingValueRef.current = null
        }
      }
    }
  }, [flushPageContext])

  const handleChange = useCallback(
    (value: string) => {
      setLocalValue(value)
      debouncedSave(value)
    },
    [debouncedSave],
  )

  return (
    <div className="flex flex-col flex-1 min-h-0 p-2">
      <div className="text-[10px] font-medium text-muted-foreground mb-1">
        {t('context.pageContext')}
      </div>
      <ContextEditorWithPreview
        value={localValue}
        onChange={handleChange}
        placeholder={t('context.pagePlaceholder')}
      />
    </div>
  )
}

// ---------------------------------------------------------------------------
// SingleNodeContextEditor
// ---------------------------------------------------------------------------

function SingleNodeContextEditor({ nodeId }: { nodeId: string }) {
  const { t } = useTranslation()
  const getNodeById = useDocumentStore((s) => s.getNodeById)
  const updateNode = useDocumentStore((s) => s.updateNode)
  const activePageId = useCanvasStore((s) => s.activePageId)
  const children = useDocumentStore((s) =>
    getActivePageChildren(s.document, activePageId),
  )
  // Force re-render when children change
  void children

  const node = getNodeById(nodeId)

  const [localValue, setLocalValue] = useState(node?.context ?? '')
  const [isSuggesting, setIsSuggesting] = useState(false)
  const [suggestError, setSuggestError] = useState<string | null>(null)
  const abortRef = useRef<AbortController | null>(null)
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const pendingValueRef = useRef<string | null>(null)

  // Reset local value when nodeId changes
  useEffect(() => {
    setLocalValue(node?.context ?? '')
  }, [nodeId]) // eslint-disable-line react-hooks/exhaustive-deps

  // Flush pending save & abort AI request when nodeId changes or component unmounts
  useEffect(() => {
    return () => {
      abortRef.current?.abort()
      if (saveTimerRef.current) {
        clearTimeout(saveTimerRef.current)
        saveTimerRef.current = null
        // Flush: save immediately instead of discarding
        if (pendingValueRef.current !== null) {
          useDocumentStore.getState().updateNode(nodeId, { context: pendingValueRef.current || undefined } as Partial<PenNode>)
          pendingValueRef.current = null
        }
      }
    }
  }, [nodeId])

  const debouncedSave = useCallback(
    (value: string) => {
      pendingValueRef.current = value
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current)
      saveTimerRef.current = setTimeout(() => {
        updateNode(nodeId, { context: value || undefined } as Partial<PenNode>)
        pendingValueRef.current = null
      }, 500)
    },
    [nodeId, updateNode],
  )

  const handleChange = useCallback(
    (value: string) => {
      setLocalValue(value)
      debouncedSave(value)
    },
    [debouncedSave],
  )

  const handleAiSuggest = useCallback(async () => {
    if (!node) return
    abortRef.current?.abort()
    const controller = new AbortController()
    abortRef.current = controller
    setIsSuggesting(true)
    setSuggestError(null)
    try {
      const suggestion = await suggestContext(node, controller.signal)
      if (!controller.signal.aborted && suggestion) {
        setLocalValue(suggestion)
        debouncedSave(suggestion)
      }
    } catch (err) {
      if (!controller.signal.aborted) {
        const msg = err instanceof Error ? err.message : 'AI suggest failed'
        setSuggestError(msg)
      }
    } finally {
      if (!controller.signal.aborted) {
        setIsSuggesting(false)
      }
    }
  }, [node, debouncedSave])

  if (!node) return null

  // Check for ref node (component instance) to show inherited context
  const isRefNode = node.type === 'ref'
  const refTarget = isRefNode
    ? getNodeById((node as RefNode).ref)
    : undefined
  const inheritedContext = refTarget?.context

  return (
    <div className="flex flex-col flex-1 min-h-0 p-2">
      {/* Header with AI Suggest button */}
      <div className="flex items-center justify-between mb-1 shrink-0">
        <div className="text-[10px] font-medium text-muted-foreground truncate">
          {node.name || node.type}
        </div>
        <button
          type="button"
          onClick={handleAiSuggest}
          disabled={isSuggesting}
          className={cn(
            'flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded transition-colors',
            isSuggesting
              ? 'text-muted-foreground cursor-not-allowed'
              : 'text-muted-foreground hover:text-foreground hover:bg-secondary',
          )}
          title={t('context.aiSuggest')}
        >
          {isSuggesting ? (
            <Loader2 className="w-3 h-3 animate-spin" />
          ) : (
            <Sparkles className="w-3 h-3" />
          )}
          <span>
            {isSuggesting
              ? t('context.aiSuggesting')
              : t('context.aiSuggest')}
          </span>
        </button>
      </div>

      {/* AI Suggest error */}
      {suggestError && (
        <div className="text-destructive text-[10px] px-1 mb-1 shrink-0 truncate" title={suggestError}>
          {suggestError}
        </div>
      )}

      {/* Inherited component context (read-only) */}
      {isRefNode && inheritedContext && (
        <div className="text-muted-foreground text-[10px] italic border border-border rounded p-1.5 mb-1 shrink-0">
          <span className="font-medium">
            {t('context.componentContext')}:
          </span>{' '}
          {inheritedContext}
        </div>
      )}

      <ContextEditorWithPreview
        value={localValue}
        onChange={handleChange}
        placeholder={t('context.placeholder')}
      />
    </div>
  )
}

// ---------------------------------------------------------------------------
// MultiSelectContextList
// ---------------------------------------------------------------------------

function MultiSelectContextList({ selectedIds }: { selectedIds: string[] }) {
  const { t } = useTranslation()
  const getNodeById = useDocumentStore((s) => s.getNodeById)
  const updateNode = useDocumentStore((s) => s.updateNode)
  const [expandedId, setExpandedId] = useState<string | null>(null)

  return (
    <div className="flex flex-col flex-1 min-h-0 overflow-y-auto">
      <div className="text-[10px] font-medium text-muted-foreground px-2 py-1 shrink-0">
        {t('context.multiSelect', { count: selectedIds.length })}
      </div>
      {selectedIds.map((id) => (
        <MultiSelectItem
          key={id}
          nodeId={id}
          getNodeById={getNodeById}
          updateNode={updateNode}
          isExpanded={expandedId === id}
          onToggle={() => setExpandedId(expandedId === id ? null : id)}
        />
      ))}
    </div>
  )
}

function MultiSelectItem({
  nodeId,
  getNodeById,
  updateNode,
  isExpanded,
  onToggle,
}: {
  nodeId: string
  getNodeById: (id: string) => PenNode | undefined
  updateNode: (id: string, updates: Partial<PenNode>) => void
  isExpanded: boolean
  onToggle: () => void
}) {
  const { t } = useTranslation()
  const node = getNodeById(nodeId)
  const [localValue, setLocalValue] = useState(node?.context ?? '')
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const pendingValueRef = useRef<string | null>(null)

  useEffect(() => {
    setLocalValue(node?.context ?? '')
  }, [nodeId]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    return () => {
      if (saveTimerRef.current) {
        clearTimeout(saveTimerRef.current)
        saveTimerRef.current = null
        if (pendingValueRef.current !== null) {
          useDocumentStore.getState().updateNode(nodeId, { context: pendingValueRef.current || undefined } as Partial<PenNode>)
          pendingValueRef.current = null
        }
      }
    }
  }, [nodeId])

  const debouncedSave = useCallback(
    (value: string) => {
      pendingValueRef.current = value
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current)
      saveTimerRef.current = setTimeout(() => {
        updateNode(nodeId, { context: value || undefined } as Partial<PenNode>)
        pendingValueRef.current = null
      }, 500)
    },
    [nodeId, updateNode],
  )

  const handleChange = useCallback(
    (value: string) => {
      setLocalValue(value)
      debouncedSave(value)
    },
    [debouncedSave],
  )

  if (!node) return null

  return (
    <div className="border-b border-border">
      <button
        type="button"
        onClick={onToggle}
        className="flex items-center gap-1 w-full px-2 py-1 text-xs text-foreground hover:bg-secondary/50 transition-colors"
      >
        {isExpanded ? (
          <ChevronDown className="w-3 h-3 shrink-0" />
        ) : (
          <ChevronRight className="w-3 h-3 shrink-0" />
        )}
        <span className="truncate">{node.name || node.type}</span>
      </button>
      {isExpanded && (
        <div className="px-2 pb-2">
          <ContextEditorWithPreview
            value={localValue}
            onChange={handleChange}
            placeholder={t('context.placeholder')}
          />
        </div>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// ContextPanel (default export)
// ---------------------------------------------------------------------------

export default function ContextPanel() {
  const selectedIds = useCanvasStore((s) => s.selection.selectedIds)

  if (selectedIds.length === 0) {
    return <PageContextEditor />
  }

  if (selectedIds.length === 1) {
    return <SingleNodeContextEditor nodeId={selectedIds[0]} />
  }

  return <MultiSelectContextList selectedIds={selectedIds} />
}
