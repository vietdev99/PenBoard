// ---------------------------------------------------------------------------
// Tool Registry — Centralized tool definitions + handler dispatch for MCP
// Extracted from server.ts to stay under 800 LOC limit.
// ---------------------------------------------------------------------------

import { handleOpenDocument } from './tools/open-document'
import { handleBatchGet } from './tools/batch-get'
import {
  handleInsertNode,
  handleUpdateNode,
  handleDeleteNode,
  handleMoveNode,
  handleCopyNode,
  handleReplaceNode,
} from './tools/node-crud'
import { handleGetVariables, handleSetVariables, handleSetThemes } from './tools/variables'
import { handleImportSvg } from './tools/import-svg'
import { handleSnapshotLayout } from './tools/snapshot-layout'
import { handleFindEmptySpace } from './tools/find-empty-space'
import { handleSaveThemePreset, handleLoadThemePreset, handleListThemePresets } from './tools/theme-presets'
import {
  handleAddPage,
  handleRemovePage,
  handleRenamePage,
  handleReorderPage,
  handleDuplicatePage,
} from './tools/pages'
import { handleBatchDesign } from './tools/batch-design'
import { buildDesignPrompt, listPromptSections } from './tools/design-prompt'
import { handleDesignSkeleton } from './tools/design-skeleton'
import { handleDesignContent } from './tools/design-content'
import { handleDesignRefine } from './tools/design-refine'
import { handleGetSelection } from './tools/get-selection'
import { LAYERED_DESIGN_TOOLS } from './tools/layered-design-defs'
import { handleManageDataBinding } from './tools/data-binding'
import { handleSetContext, handleGetContext } from './tools/context'
import { handleManageEntities } from './tools/entities'
import { handleManageConnections } from './tools/connections'
import { PREVIEW_TOOLS, handleGeneratePreview } from './tools/preview'
import { WORKFLOW_TOOLS, handleExportWorkflow } from './tools/workflow'
import {
  WORKSPACE_TOOLS,
  handleWriteFlow,
  handleReadFlow,
  handleListFlows,
  handleWriteDoc,
  handleReadDoc,
} from './tools/workspace'
import { handleGetProjectContext } from './tools/project-context'
import { FORMAT_FLOW_TOOLS, handleFormatFlow } from './tools/format-flow'
import { openDocument, saveDocument, resolveDocPath, getCachedFilePath, fetchLiveFilePath, LIVE_CANVAS_PATH } from './document-manager'

// --- Tool definitions (shared across all Server instances) ---

export const TOOL_DEFINITIONS = [
  {
    name: 'open_document',
    description:
      'Open an existing .pb/.op file or connect to the live Electron canvas. Returns document metadata, context summary, and design prompt. Always call this first. Omit filePath to connect to the live canvas. ' +
      'IMPORTANT — Page = Module architecture: each page is a MODULE (e.g. "Tasks", "Team", "Settings") that contains MULTIPLE related views as root-level frames laid out side by side on the canvas. ' +
      'For example, a "Tasks" module page would contain: Task List view + Task Detail view + Create Task dialog + Edit Task form. ' +
      'Do NOT create one page per view — group related views into the same page module. Use find_empty_space to position additional views next to existing ones.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        filePath: {
          type: 'string',
          description:
            'Absolute path to the .pb/.op file to open or create. Omit to connect to the live Electron canvas, or pass "live://canvas" explicitly.',
        },
      },
      required: [],
    },
  },
  {
    name: 'batch_get',
    description:
      'Search and read nodes. With no patterns/nodeIds, returns top-level children. Search by type/name regex, or read specific IDs. ' +
      'readDepth controls how deep children are included in results (default 1, use higher to see nested structure). ' +
      'Returns nodes with children truncated to "..." beyond readDepth.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        filePath: { type: 'string', description: 'Path to .pb/.op file, or omit to use the live canvas (default)' },
        patterns: {
          type: 'array',
          description: 'Search patterns to match nodes',
          items: {
            type: 'object',
            properties: {
              type: { type: 'string', description: 'Node type (frame, text, rectangle, etc.)' },
              name: { type: 'string', description: 'Regex pattern to match node name' },
              reusable: { type: 'boolean', description: 'Match reusable components' },
            },
          },
        },
        nodeIds: { type: 'array', items: { type: 'string' }, description: 'Specific node IDs to read' },
        parentId: { type: 'string', description: 'Limit search to children of this parent node' },
        readDepth: { type: 'number', description: 'How deep to include children in results (default 1)' },
        searchDepth: { type: 'number', description: 'How deep to search for matching nodes (default unlimited)' },
        pageId: { type: 'string', description: 'Target page/module ID (defaults to first page). Each page is a module that can contain multiple screens/views.' },
      },
      required: [],
    },
  },
  {
    name: 'get_selection',
    description:
      'Get the currently selected nodes on the live canvas. Returns the full node data for each selected element. ' +
      'Use this to inspect what the user has selected without needing to search.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        filePath: { type: 'string', description: 'Path to .pb/.op file, or omit to use the live canvas (default)' },
        readDepth: { type: 'number', description: 'How deep to include children in results (default 2)' },
      },
      required: [],
    },
  },
  {
    name: 'insert_node',
    description:
      'Insert a new node into the document. Node types: frame, rectangle, ellipse, text, path, image, group, line, polygon, ref. ' +
      'Fill is always an array: [{ type: "solid", color: "#hex" }]. ' +
      'When inserting a frame at root level and an empty root frame exists, it is auto-replaced. ' +
      'Multiple root-level frames SHOULD be placed on the same page to represent related views within a module (e.g. list + detail + create form). ' +
      'Use find_empty_space(direction="right") to position additional views next to existing ones. ' +
      'Returns the final node state (after post-processing if enabled).',
    inputSchema: {
      type: 'object' as const,
      properties: {
        filePath: { type: 'string', description: 'Path to .pb/.op file, or omit to use the live canvas (default)' },
        parent: {
          type: ['string', 'null'] as const,
          description: 'Parent node ID, or null for root level',
        },
        data: {
          type: 'object',
          description:
            'PenNode data. Required: type. Key props by type:\n' +
            '- frame: width, height, layout (none|vertical|horizontal), gap, padding, justifyContent, alignItems, clipContent, children[]\n' +
            '- text: content (required), fontSize, fontWeight, fontFamily, textGrowth (auto|fixed-width), lineHeight, fill\n' +
            '- rectangle/ellipse: width, height, fill, stroke, cornerRadius\n' +
            '- path: d (SVG path string) or name (icon name like "SearchIcon"), width, height\n' +
            '- image: src (URL), width, height\n' +
            'Common: name, role, x, y, opacity, fill (array), stroke, effects, cornerRadius',
        },
        postProcess: {
          type: 'boolean',
          description:
            'Apply post-processing (role defaults, icon resolution, sanitization). Always use when generating designs.',
        },
        canvasWidth: {
          type: 'number',
          description:
            'Canvas width for post-processing layout (default 1200, use 375 for mobile).',
        },
        pageId: { type: 'string', description: 'Target page/module ID (defaults to first page). Each page is a module that can contain multiple screens/views as separate root-level frames.' },
      },
      required: ['parent', 'data'],
    },
  },
  {
    name: 'update_node',
    description:
      'Update properties of an existing node. Only provided properties are shallow-merged; unmentioned properties remain unchanged. Returns the updated node state.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        filePath: { type: 'string', description: 'Path to .pb/.op file, or omit to use the live canvas (default)' },
        nodeId: { type: 'string', description: 'ID of the node to update' },
        data: {
          type: 'object',
          description: 'Properties to merge into the node (fill, width, name, etc.)',
        },
        postProcess: {
          type: 'boolean',
          description: 'Apply post-processing after update.',
        },
        canvasWidth: {
          type: 'number',
          description: 'Canvas width for post-processing layout (default 1200).',
        },
        pageId: { type: 'string', description: 'Target page/module ID (defaults to first page). Each page is a module that can contain multiple screens/views.' },
      },
      required: ['nodeId', 'data'],
    },
  },
  {
    name: 'delete_node',
    description: 'Delete a node (and all its children) from a .pb/.op file.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        filePath: { type: 'string', description: 'Path to .pb/.op file, or omit to use the live canvas (default)' },
        nodeId: { type: 'string', description: 'ID of the node to delete' },
        pageId: { type: 'string', description: 'Target page/module ID (defaults to first page). Each page is a module that can contain multiple screens/views.' },
      },
      required: ['nodeId'],
    },
  },
  {
    name: 'move_node',
    description:
      'Move a node to a new parent (or root level) in a .pb/.op file. Optionally specify insertion index.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        filePath: { type: 'string', description: 'Path to .pb/.op file, or omit to use the live canvas (default)' },
        nodeId: { type: 'string', description: 'ID of the node to move' },
        parent: {
          type: ['string', 'null'] as const,
          description: 'New parent node ID, or null for root level',
        },
        index: {
          type: 'number',
          description: 'Insertion index within the parent (default: append at end)',
        },
        pageId: { type: 'string', description: 'Target page/module ID (defaults to first page). Each page is a module that can contain multiple screens/views.' },
      },
      required: ['nodeId', 'parent'],
    },
  },
  {
    name: 'copy_node',
    description:
      'Deep-copy an existing node (with new IDs) and insert the clone under a parent. Optionally apply property overrides.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        filePath: { type: 'string', description: 'Path to .pb/.op file, or omit to use the live canvas (default)' },
        sourceId: { type: 'string', description: 'ID of the node to copy' },
        parent: {
          type: ['string', 'null'] as const,
          description: 'Parent node ID for the clone, or null for root level',
        },
        overrides: {
          type: 'object',
          description: 'Properties to override on the cloned node (name, x, y, etc.)',
        },
        pageId: { type: 'string', description: 'Target page/module ID (defaults to first page). Each page is a module that can contain multiple screens/views.' },
      },
      required: ['sourceId', 'parent'],
    },
  },
  {
    name: 'replace_node',
    description:
      'Replace a node with entirely new data. The old node is removed and a new node is inserted at the same position.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        filePath: { type: 'string', description: 'Path to .pb/.op file, or omit to use the live canvas (default)' },
        nodeId: { type: 'string', description: 'ID of the node to replace' },
        data: {
          type: 'object',
          description: 'Complete new PenNode data (type, name, width, height, fill, children, ...)',
        },
        postProcess: {
          type: 'boolean',
          description: 'Apply post-processing after replacement.',
        },
        canvasWidth: {
          type: 'number',
          description: 'Canvas width for post-processing layout (default 1200).',
        },
        pageId: { type: 'string', description: 'Target page/module ID (defaults to first page). Each page is a module that can contain multiple screens/views.' },
      },
      required: ['nodeId', 'data'],
    },
  },
  {
    name: 'import_svg',
    description:
      'Import a local SVG file into a .pb/.op document as editable PenNodes. Supports path, rect, circle, ellipse, line, polygon, polyline, and nested groups. No network access required.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        filePath: { type: 'string', description: 'Path to .pb/.op file, or omit to use the live canvas (default)' },
        svgPath: { type: 'string', description: 'Absolute path to a local .svg file' },
        parent: {
          type: ['string', 'null'] as const,
          description: 'Parent node ID, or null/omit for root level',
        },
        maxDim: {
          type: 'number',
          description: 'Max dimension to scale SVG to (default 400)',
        },
        postProcess: {
          type: 'boolean',
          description: 'Apply post-processing (role defaults, icon resolution, sanitization).',
        },
        canvasWidth: {
          type: 'number',
          description: 'Canvas width for post-processing layout (default 1200).',
        },
        pageId: { type: 'string', description: 'Target page/module ID (defaults to first page). Each page is a module that can contain multiple screens/views.' },
      },
      required: ['svgPath'],
    },
  },
  {
    name: 'get_variables',
    description: 'Get all design variables and themes defined in a .pb/.op file.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        filePath: { type: 'string', description: 'Path to .pb/.op file, or omit to use the live canvas (default)' },
      },
      required: [],
    },
  },
  {
    name: 'set_variables',
    description: 'Add or update design variables in a .pb/.op file. By default merges with existing variables.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        filePath: { type: 'string', description: 'Path to .pb/.op file, or omit to use the live canvas (default)' },
        variables: { type: 'object', description: 'Variables to set (name -> { type, value })' },
        replace: { type: 'boolean', description: 'Replace all variables instead of merging (default false)' },
      },
      required: ['variables'],
    },
  },
  {
    name: 'set_themes',
    description:
      'Create or update theme axes and their variants in a .pb/.op file. Each theme axis (e.g. "Color Scheme") has an array of variant names (e.g. ["Light", "Dark"]). Multiple independent axes are supported. By default merges with existing themes.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        filePath: { type: 'string', description: 'Path to .pb/.op file, or omit to use the live canvas (default)' },
        themes: {
          type: 'object',
          description:
            'Theme axes to set (axis name -> variant names array). Example: { "Color": ["Light", "Dark"], "Density": ["Compact", "Comfortable"] }',
        },
        replace: {
          type: 'boolean',
          description: 'Replace all themes instead of merging (default false)',
        },
      },
      required: ['themes'],
    },
  },
  {
    name: 'snapshot_layout',
    description: 'Get the hierarchical bounding box layout tree of an .op file. Useful for understanding spatial arrangement.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        filePath: { type: 'string', description: 'Path to .pb/.op file, or omit to use the live canvas (default)' },
        parentId: { type: 'string', description: 'Only return layout under this parent node' },
        maxDepth: { type: 'number', description: 'Max depth to traverse (default 1)' },
        pageId: { type: 'string', description: 'Target page/module ID (defaults to first page). Each page is a module that can contain multiple screens/views.' },
      },
      required: [],
    },
  },
  {
    name: 'find_empty_space',
    description: 'Find empty canvas space in a given direction for placing new content.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        filePath: { type: 'string', description: 'Path to .pb/.op file, or omit to use the live canvas (default)' },
        width: { type: 'number', description: 'Required width of empty space' },
        height: { type: 'number', description: 'Required height of empty space' },
        padding: { type: 'number', description: 'Minimum padding from other elements (default 50)' },
        direction: { type: 'string', enum: ['top', 'right', 'bottom', 'left'], description: 'Direction to search for empty space' },
        nodeId: { type: 'string', description: 'Search relative to this node (default: entire canvas)' },
        pageId: { type: 'string', description: 'Target page/module ID (defaults to first page). Each page is a module that can contain multiple screens/views.' },
      },
      required: ['width', 'height', 'direction'],
    },
  },
  {
    name: 'save_theme_preset',
    description: 'Save the themes and variables from a .pb/.op document as a reusable .optheme preset file.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        filePath: { type: 'string', description: 'Path to .pb/.op file, or omit to use the live canvas (default)' },
        presetPath: { type: 'string', description: 'Absolute path for the output .optheme file' },
        name: { type: 'string', description: 'Display name for the preset (defaults to file name)' },
      },
      required: ['presetPath'],
    },
  },
  {
    name: 'load_theme_preset',
    description: 'Load a .optheme preset file and merge its themes and variables into a .pb/.op document.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        filePath: { type: 'string', description: 'Path to .pb/.op file, or omit to use the live canvas (default)' },
        presetPath: { type: 'string', description: 'Absolute path to the .optheme file to load' },
      },
      required: ['presetPath'],
    },
  },
  {
    name: 'list_theme_presets',
    description: 'List all .optheme preset files in a directory.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        directory: { type: 'string', description: 'Absolute path to the directory to scan' },
      },
      required: ['directory'],
    },
  },
  {
    name: 'add_page',
    description:
      'Add a new page (module) to a .pb/.op file. IMPORTANT: Pages are MODULES, not individual views. ' +
      'Each page groups related views together — e.g. a "Tasks" module contains Task List + Task Detail + Create Task + Edit Task as separate root-level frames on the same canvas. ' +
      'Only create a new page when adding a genuinely different feature module (e.g. "Dashboard", "Tasks", "Team", "Settings"). ' +
      'Do NOT create a new page for every single screen. If the document has no pages yet, the existing children are migrated to the first page automatically.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        filePath: { type: 'string', description: 'Path to .pb/.op file, or omit to use the live canvas (default)' },
        name: { type: 'string', description: 'Page name (default: "Page N")' },
        type: { type: 'string', enum: ['screen', 'erd', 'component'], description: 'Page type (default: screen)' },
        children: {
          type: 'array',
          description:
            'Initial child nodes for the page. Defaults to a single empty 1200x800 white frame.',
          items: { type: 'object' },
        },
      },
      required: [],
    },
  },
  {
    name: 'remove_page',
    description: 'Remove a page (module) from a .pb/.op file. This removes the entire module and all its screens/views. Cannot remove the last remaining page.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        filePath: { type: 'string', description: 'Path to .pb/.op file, or omit to use the live canvas (default)' },
        pageId: { type: 'string', description: 'ID of the page/module to remove' },
      },
      required: ['pageId'],
    },
  },
  {
    name: 'rename_page',
    description: 'Rename a page (module) in a .pb/.op file. The name applies to the entire module workspace, not a single screen.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        filePath: { type: 'string', description: 'Path to .pb/.op file, or omit to use the live canvas (default)' },
        pageId: { type: 'string', description: 'ID of the page/module to rename' },
        name: { type: 'string', description: 'New page name' },
      },
      required: ['pageId', 'name'],
    },
  },
  {
    name: 'reorder_page',
    description: 'Move a page (module) to a new position (index) in a .pb/.op file. Reorders the module within the document tab bar.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        filePath: { type: 'string', description: 'Path to .pb/.op file, or omit to use the live canvas (default)' },
        pageId: { type: 'string', description: 'ID of the page/module to reorder' },
        index: { type: 'number', description: 'New zero-based index for the page' },
      },
      required: ['pageId', 'index'],
    },
  },
  {
    name: 'duplicate_page',
    description:
      'Duplicate a page/module (deep-clone all screens/views with new IDs) and insert the copy right after the original.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        filePath: { type: 'string', description: 'Path to .pb/.op file, or omit to use the live canvas (default)' },
        pageId: { type: 'string', description: 'ID of the page/module to duplicate' },
        name: { type: 'string', description: 'Name for the duplicated page (default: "original copy")' },
      },
      required: ['pageId'],
    },
  },
  {
    name: 'get_design_prompt',
    description:
      'Get design knowledge prompt. Use "section" to retrieve a focused subset instead of the full prompt. ' +
      'Sections: schema (PenNode types), layout (flexbox rules), roles (semantic roles), text (typography/CJK/copywriting), ' +
      'style (visual style policy), icons (icon names), examples (design examples), guidelines (design tips), planning (layered workflow guide). ' +
      'Omit section for the full prompt.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        section: {
          type: 'string',
          enum: ['all', 'schema', 'layout', 'roles', 'text', 'style', 'icons', 'examples', 'guidelines', 'planning'],
          description:
            'Which section of design knowledge to retrieve. Default: all. Use "planning" for layered generation workflow.',
        },
      },
      required: [],
    },
  },
  {
    name: 'batch_design',
    description:
      'Execute batch design operations in a compact DSL. Each line is one operation:\n' +
      '  binding=I(parent, { ...nodeData })  -- Insert node (binding captures new ID)\n' +
      '  U(path, { ...updates })             -- Update node properties\n' +
      '  binding=C(sourceId, parent, { overrides })  -- Copy node\n' +
      '  binding=R(path, { ...newNodeData }) -- Replace node\n' +
      '  M(nodeId, parent, index?)           -- Move node\n' +
      '  D(nodeId)                           -- Delete node\n' +
      'Use null for root-level parent. Reference previous bindings by name. ' +
      'Path expressions support binding+"/ childId" for nested access. ' +
      'Always set postProcess=true when generating designs for best visual quality. ' +
      'TIP: Each page is a MODULE — insert multiple root-level frames (views) on the same page for related screens (e.g. list + detail + create form). Use find_empty_space to position them.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        filePath: { type: 'string', description: 'Path to .pb/.op file, or omit to use the live canvas (default)' },
        operations: {
          type: 'string',
          description:
            'DSL operations, one per line. Example:\nroot=I(null, { "type": "frame", "name": "Page", "width": 1200, "height": 0, "layout": "vertical", "children": [...] })',
        },
        postProcess: {
          type: 'boolean',
          description:
            'Apply post-processing (role defaults, icon resolution, layout sanitization). Always true for design generation.',
        },
        canvasWidth: {
          type: 'number',
          description: 'Canvas width for post-processing (default 1200, use 375 for mobile).',
        },
        pageId: { type: 'string', description: 'Target page/module ID (defaults to first page). Each page is a module that can contain multiple screens/views.' },
      },
      required: ['operations'],
    },
  },
  ...LAYERED_DESIGN_TOOLS,

  // -----------------------------------------------------------------------
  // New tools: data-binding, context, entities, connections
  // -----------------------------------------------------------------------
  {
    name: 'manage_data_binding',
    description:
      'Manage data bindings on nodes. Actions: set_binding (attach entity to node with field mappings), ' +
      'remove_binding (detach), list_bindings (list all bound nodes on a page).',
    inputSchema: {
      type: 'object' as const,
      properties: {
        filePath: { type: 'string', description: 'Path to .pb/.op file, or omit for live canvas' },
        action: {
          type: 'string',
          enum: ['set_binding', 'remove_binding', 'list_bindings'],
          description: 'Action to perform',
        },
        nodeId: { type: 'string', description: 'Target node ID (for set_binding / remove_binding)' },
        entityId: { type: 'string', description: 'Entity ID to bind to (for set_binding)' },
        fieldMappings: {
          type: 'array',
          description: 'Field-to-slot mappings (for set_binding)',
          items: {
            type: 'object',
            properties: {
              slotKey: { type: 'string', description: 'Visual slot key (e.g. col-0)' },
              fieldId: { type: 'string', description: 'DataField ID to bind' },
            },
            required: ['slotKey', 'fieldId'],
          },
        },
        pageId: { type: 'string', description: 'Target page/module ID (for list_bindings, defaults to first page). Each page is a module that can contain multiple screens/views.' },
      },
      required: ['action'],
    },
  },
  {
    name: 'set_context',
    description:
      'Set an AI-readable context annotation on a node or page. Context helps AI agents understand the purpose of design elements.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        filePath: { type: 'string', description: 'Path to .pb/.op file, or omit for live canvas' },
        nodeId: { type: 'string', description: 'Target node ID (mutually exclusive with pageId)' },
        pageId: { type: 'string', description: 'Target page/module ID (mutually exclusive with nodeId). Each page is a module that can contain multiple screens/views.' },
        context: { type: 'string', description: 'Context annotation text' },
      },
      required: ['context'],
    },
  },
  {
    name: 'get_context',
    description:
      'Get the AI-readable context annotation from a node or page. At least one of nodeId or pageId must be provided.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        filePath: { type: 'string', description: 'Path to .pb/.op file, or omit for live canvas' },
        nodeId: { type: 'string', description: 'Target node ID' },
        pageId: { type: 'string', description: 'Target page/module ID. Each page is a module that can contain multiple screens/views.' },
      },
      required: [],
    },
  },
  {
    name: 'manage_entities',
    description:
      'CRUD operations for data entities (Notion-like tables). Actions: add_entity, update_entity, remove_entity, ' +
      'add_field, update_field, remove_field, add_row, update_row, remove_row, list_entities, get_entity, ' +
      'add_view, remove_view, update_view. Entity removal cascades: cleans dangling data bindings and relation fields.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        filePath: { type: 'string', description: 'Path to .pb/.op file, or omit for live canvas' },
        action: {
          type: 'string',
          enum: [
            'add_entity', 'update_entity', 'remove_entity',
            'add_field', 'update_field', 'remove_field',
            'add_row', 'update_row', 'remove_row',
            'list_entities', 'get_entity',
            'add_view', 'remove_view', 'update_view',
          ],
          description: 'CRUD action to perform',
        },
        entityId: { type: 'string', description: 'Target entity ID' },
        name: { type: 'string', description: 'Entity or field name (for add/update)' },
        fieldId: { type: 'string', description: 'Target field ID' },
        field: {
          type: 'object',
          description: 'Field definition for add_field (name, type required)',
          properties: {
            name: { type: 'string' },
            type: { type: 'string', enum: ['text', 'number', 'boolean', 'date', 'select', 'relation'] },
            isPrimaryKey: { type: 'boolean' },
            isForeignKey: { type: 'boolean' },
            options: { type: 'array', items: { type: 'string' } },
            relatedEntityId: { type: 'string' },
            relatedFieldId: { type: 'string' },
            relationCardinality: { type: 'string', enum: ['1:1', '1:N', 'N:M'] },
            required: { type: 'boolean' },
            defaultValue: {},
          },
        },
        fieldUpdates: { type: 'object', description: 'Partial field updates for update_field' },
        rowId: { type: 'string', description: 'Target row ID' },
        fieldValues: { type: 'object', description: 'Field values for add_row / update_row' },
        viewId: { type: 'string', description: 'Target view ID' },
        viewName: { type: 'string', description: 'View name (for add_view)' },
        viewUpdates: { type: 'object', description: 'Partial view updates for update_view' },
      },
      required: ['action'],
    },
  },
  ...PREVIEW_TOOLS,
  ...WORKFLOW_TOOLS,
  ...WORKSPACE_TOOLS,
  ...FORMAT_FLOW_TOOLS,
  {
    name: 'manage_connections',
    description:
      'CRUD operations for screen connections (navigation arrows between pages/modules). Actions: add_connection, update_connection, remove_connection, list_connections. ' +
      'Pages act as modules — connections link screens/views across different modules.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        filePath: { type: 'string', description: 'Path to .pb/.op file, or omit for live canvas' },
        action: {
          type: 'string',
          enum: ['add_connection', 'update_connection', 'remove_connection', 'list_connections'],
          description: 'Action to perform',
        },
        connectionId: { type: 'string', description: 'Target connection ID (for update/remove)' },
        sourceElementId: { type: 'string', description: 'Source node ID (for add)' },
        sourcePageId: { type: 'string', description: 'Source page/module ID (for add)' },
        targetPageId: { type: 'string', description: 'Target page/module ID (for add)' },
        targetFrameId: { type: 'string', description: 'Target frame ID within target page (optional)' },
        label: { type: 'string', description: 'Connection label (optional)' },
        triggerEvent: { type: 'string', enum: ['click', 'hover', 'submit'], description: 'Trigger event type (for add)' },
        transitionType: { type: 'string', enum: ['push', 'modal', 'replace'], description: 'Transition type (for add)' },
        updates: { type: 'object', description: 'Partial connection updates (for update_connection)' },
        pageId: { type: 'string', description: 'Filter connections by page/module ID (for list_connections)' },
      },
      required: ['action'],
    },
  },
  {
    name: 'generate_preview',
    description:
      'Generate an interactive HTML preview for a screen page and return its URL. Requires a running PenBoard instance. Only screen pages are previewable (ERD and component pages return an error). Each call generates a fresh static snapshot.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        filePath: { type: 'string', description: 'Path to .pb/.op file, or omit for live canvas' },
        pageId: { type: 'string', description: 'ID of the page to preview (must be a screen page)' },
        frameId: { type: 'string', description: 'Optional: preview only this specific frame instead of the entire page' },
      },
      required: ['pageId'],
    },
  },
  {
    name: 'export_workflow',
    description:
      'Export the workflow diagram showing screen connections and data flows. Formats: "mermaid" (text, always available), "svg" (base64, requires mermaid-cli), "png" (base64, requires mermaid-cli). Use focusPageId to filter to a specific page and its neighbors.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        filePath: { type: 'string', description: 'Path to .pb/.op file, or omit for live canvas' },
        format: { type: 'string', enum: ['mermaid', 'svg', 'png'], description: 'Output format (default: mermaid)' },
        focusPageId: { type: 'string', description: 'Optional: filter diagram to this page and its direct neighbors' },
      },
      required: [],
    },
  },
  {
    name: 'write_flow',
    description:
      'Create or update a mermaid flow document in .penboard/flows/{group}/{name}.md. ' +
      'Creates the directory structure if needed. Auto-updates manifest.json. ' +
      'Use group to organize flows (e.g. "business", "technical"). Defaults to "general".',
    inputSchema: {
      type: 'object' as const,
      properties: {
        name: { type: 'string', description: 'Flow file name (without .md extension), e.g. "auth-flow"' },
        content: { type: 'string', description: 'Full markdown content including mermaid code blocks' },
        group: {
          type: 'string',
          description: 'Flow group/category (e.g. "business", "technical"). Defaults to "general".',
        },
      },
      required: ['name', 'content'],
    },
  },
  {
    name: 'read_flow',
    description: 'Read a flow document from .penboard/flows/{group}/{name}.md. Defaults to "general" group.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        name: { type: 'string', description: 'Flow file name (without .md extension)' },
        group: {
          type: 'string',
          description: 'Flow group/category. Defaults to "general".',
        },
      },
      required: ['name'],
    },
  },
  {
    name: 'list_flows',
    description: 'List all mermaid business flow documents across all groups in .penboard/flows/ workspace directory.',
    inputSchema: {
      type: 'object' as const,
      properties: {},
      required: [],
    },
  },
  {
    name: 'write_doc',
    description:
      'Write or update a context document in .penboard/docs/ workspace directory. Useful for AI-readable project documentation. Auto-updates manifest.json.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        category: { type: 'string', description: 'Document category subfolder, e.g. "context", "specs"' },
        name: { type: 'string', description: 'Document file name (without .md extension)' },
        content: { type: 'string', description: 'Full markdown content' },
      },
      required: ['category', 'name', 'content'],
    },
  },
  {
    name: 'read_doc',
    description: 'Read a context document from .penboard/docs/ workspace directory.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        category: { type: 'string', description: 'Document category subfolder' },
        name: { type: 'string', description: 'Document file name (without .md extension)' },
      },
      required: ['category', 'name'],
    },
  },
  {
    name: 'get_project_context',
    description:
      'Get complete project context in one call — pages, screens, entities (ERD), connections (navigation), ' +
      'workflow diagram, business flow documents, and context docs. Designed for AI agents to fully understand ' +
      'the project before making changes. Always call this first when joining a project.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        filePath: { type: 'string', description: 'Path to .pb/.op file, or omit for live canvas' },
        includeFlowContent: {
          type: 'boolean',
          description: 'Include full markdown content of flow documents (default: true). Set false for summary only.',
        },
        includeDocContent: {
          type: 'boolean',
          description: 'Include full markdown content of context docs (default: true). Set false for summary only.',
        },
        nodeDepth: {
          type: 'number',
          description: 'Depth of node tree summary per frame (default: 2). Higher = more detail, more tokens.',
        },
      },
      required: [],
    },
  },
  {
    name: 'save_document',
    description:
      'Save the current document to disk. For live canvas, fetches the current state and writes to the associated .pb file. ' +
      'For file-based MCP, saves the cached document to the specified path. ' +
      'Use filePath to explicitly set the save target, or omit to auto-detect from the live canvas.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        filePath: {
          type: 'string',
          description: 'Target .pb/.op file path to save to. Omit to auto-detect from the live canvas.',
        },
      },
      required: [],
    },
  },
]

// --- save_document handler ---

async function handleSaveDocumentTool(params: { filePath?: string }): Promise<{ ok: true; filePath: string }> {
  let targetPath = params.filePath

  if (!targetPath) {
    // Try to detect from cached file path first
    targetPath = getCachedFilePath()
    // Fallback: ask the live canvas for its file path
    if (!targetPath) {
      targetPath = (await fetchLiveFilePath()) ?? undefined
    }
    if (!targetPath) {
      throw new Error(
        'No file path available. The document has not been saved before. ' +
        'Provide a filePath parameter (e.g. "C:/path/to/project.pb") to save.',
      )
    }
  }

  const resolvedPath = resolveDocPath(targetPath)
  if (resolvedPath === LIVE_CANVAS_PATH) {
    throw new Error('Cannot save to live://canvas. Provide an actual file path.')
  }

  // Fetch the current document (from live canvas or cache)
  const doc = await openDocument(LIVE_CANVAS_PATH).catch(() => null)
    ?? await openDocument(resolvedPath)
  await saveDocument(resolvedPath, doc)
  return { ok: true, filePath: resolvedPath }
}

// --- Tool execution handler ---

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- MCP args are validated at runtime by the protocol
export async function handleToolCall(name: string, args: Record<string, unknown> | undefined): Promise<string> {
  // MCP protocol guarantees args match the inputSchema; cast via `unknown` to the handler's param type.
  const a = (args ?? {}) as any  // eslint-disable-line @typescript-eslint/no-explicit-any
  switch (name) {
    case 'open_document':
      return JSON.stringify(await handleOpenDocument(a), null, 2)
    case 'batch_get':
      return JSON.stringify(await handleBatchGet(a), null, 2)
    case 'get_selection':
      return JSON.stringify(await handleGetSelection(a), null, 2)
    case 'insert_node':
      return JSON.stringify(await handleInsertNode(a), null, 2)
    case 'update_node':
      return JSON.stringify(await handleUpdateNode(a), null, 2)
    case 'delete_node':
      return JSON.stringify(await handleDeleteNode(a), null, 2)
    case 'move_node':
      return JSON.stringify(await handleMoveNode(a), null, 2)
    case 'copy_node':
      return JSON.stringify(await handleCopyNode(a), null, 2)
    case 'replace_node':
      return JSON.stringify(await handleReplaceNode(a), null, 2)
    case 'import_svg':
      return JSON.stringify(await handleImportSvg(a), null, 2)
    case 'get_variables':
      return JSON.stringify(await handleGetVariables(a), null, 2)
    case 'set_variables':
      return JSON.stringify(await handleSetVariables(a), null, 2)
    case 'set_themes':
      return JSON.stringify(await handleSetThemes(a), null, 2)
    case 'snapshot_layout':
      return JSON.stringify(await handleSnapshotLayout(a), null, 2)
    case 'find_empty_space':
      return JSON.stringify(await handleFindEmptySpace(a), null, 2)
    case 'save_theme_preset':
      return JSON.stringify(await handleSaveThemePreset(a), null, 2)
    case 'load_theme_preset':
      return JSON.stringify(await handleLoadThemePreset(a), null, 2)
    case 'list_theme_presets':
      return JSON.stringify(await handleListThemePresets(a), null, 2)
    case 'add_page':
      return JSON.stringify(await handleAddPage(a), null, 2)
    case 'remove_page':
      return JSON.stringify(await handleRemovePage(a), null, 2)
    case 'rename_page':
      return JSON.stringify(await handleRenamePage(a), null, 2)
    case 'reorder_page':
      return JSON.stringify(await handleReorderPage(a), null, 2)
    case 'duplicate_page':
      return JSON.stringify(await handleDuplicatePage(a), null, 2)
    case 'get_design_prompt':
      return JSON.stringify(
        {
          section: (a.section as string | undefined) ?? 'all',
          availableSections: listPromptSections(),
          designPrompt: buildDesignPrompt(a.section as string | undefined),
        },
        null,
        2,
      )
    case 'batch_design':
      return JSON.stringify(await handleBatchDesign(a), null, 2)
    case 'design_skeleton':
      return JSON.stringify(await handleDesignSkeleton(a), null, 2)
    case 'design_content':
      return JSON.stringify(await handleDesignContent(a), null, 2)
    case 'design_refine':
      return JSON.stringify(await handleDesignRefine(a), null, 2)

    // New tools
    case 'manage_data_binding':
      return JSON.stringify(await handleManageDataBinding(a), null, 2)
    case 'set_context':
      return JSON.stringify(await handleSetContext(a), null, 2)
    case 'get_context':
      return JSON.stringify(await handleGetContext(a), null, 2)
    case 'manage_entities':
      return JSON.stringify(await handleManageEntities(a), null, 2)
    case 'manage_connections':
      return JSON.stringify(await handleManageConnections(a), null, 2)
    case 'generate_preview':
      return JSON.stringify(await handleGeneratePreview(a), null, 2)
    case 'export_workflow':
      return JSON.stringify(await handleExportWorkflow(a), null, 2)
    case 'write_flow':
      return JSON.stringify(await handleWriteFlow(a), null, 2)
    case 'read_flow':
      return JSON.stringify(await handleReadFlow(a), null, 2)
    case 'list_flows':
      return JSON.stringify(await handleListFlows(a), null, 2)
    case 'write_doc':
      return JSON.stringify(await handleWriteDoc(a), null, 2)
    case 'read_doc':
      return JSON.stringify(await handleReadDoc(a), null, 2)
    case 'get_project_context':
      return JSON.stringify(await handleGetProjectContext(a), null, 2)
    case 'save_document':
      return JSON.stringify(await handleSaveDocumentTool(a), null, 2)
    case 'format_flow':
      return JSON.stringify(await handleFormatFlow(a), null, 2)

    default:
      throw new Error(`Unknown tool: ${name}`)
  }
}
