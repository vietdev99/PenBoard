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

// --- Tool definitions (shared across all Server instances) ---

export const TOOL_DEFINITIONS = [
  {
    name: 'open_document',
    description:
      'Open an existing .pb/.op file or connect to the live Electron canvas. Returns document metadata, context summary, and design prompt. Always call this first. Omit filePath to connect to the live canvas.',
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
        pageId: { type: 'string', description: 'Target page ID (defaults to first page)' },
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
        pageId: { type: 'string', description: 'Target page ID (defaults to first page)' },
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
        pageId: { type: 'string', description: 'Target page ID (defaults to first page)' },
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
        pageId: { type: 'string', description: 'Target page ID (defaults to first page)' },
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
        pageId: { type: 'string', description: 'Target page ID (defaults to first page)' },
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
        pageId: { type: 'string', description: 'Target page ID (defaults to first page)' },
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
        pageId: { type: 'string', description: 'Target page ID (defaults to first page)' },
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
        pageId: { type: 'string', description: 'Target page ID (defaults to first page)' },
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
        pageId: { type: 'string', description: 'Target page ID (defaults to first page)' },
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
        pageId: { type: 'string', description: 'Target page ID (defaults to first page)' },
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
      'Add a new page to a .pb/.op file. If the document has no pages yet, the existing children are migrated to the first page automatically.',
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
    description: 'Remove a page from a .pb/.op file. Cannot remove the last remaining page.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        filePath: { type: 'string', description: 'Path to .pb/.op file, or omit to use the live canvas (default)' },
        pageId: { type: 'string', description: 'ID of the page to remove' },
      },
      required: ['pageId'],
    },
  },
  {
    name: 'rename_page',
    description: 'Rename a page in a .pb/.op file.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        filePath: { type: 'string', description: 'Path to .pb/.op file, or omit to use the live canvas (default)' },
        pageId: { type: 'string', description: 'ID of the page to rename' },
        name: { type: 'string', description: 'New page name' },
      },
      required: ['pageId', 'name'],
    },
  },
  {
    name: 'reorder_page',
    description: 'Move a page to a new position (index) in a .pb/.op file.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        filePath: { type: 'string', description: 'Path to .pb/.op file, or omit to use the live canvas (default)' },
        pageId: { type: 'string', description: 'ID of the page to move' },
        index: { type: 'number', description: 'New zero-based index for the page' },
      },
      required: ['pageId', 'index'],
    },
  },
  {
    name: 'duplicate_page',
    description:
      'Duplicate a page (deep-clone with new IDs) and insert the copy right after the original.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        filePath: { type: 'string', description: 'Path to .pb/.op file, or omit to use the live canvas (default)' },
        pageId: { type: 'string', description: 'ID of the page to duplicate' },
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
      'Always set postProcess=true when generating designs for best visual quality.',
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
        pageId: { type: 'string', description: 'Target page ID (defaults to first page)' },
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
        pageId: { type: 'string', description: 'Target page ID (for list_bindings, defaults to first page)' },
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
        pageId: { type: 'string', description: 'Target page ID (mutually exclusive with nodeId)' },
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
        pageId: { type: 'string', description: 'Target page ID' },
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
  {
    name: 'manage_connections',
    description:
      'CRUD operations for screen connections (navigation arrows between pages). Actions: add_connection, update_connection, remove_connection, list_connections.',
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
        sourcePageId: { type: 'string', description: 'Source page ID (for add)' },
        targetPageId: { type: 'string', description: 'Target page ID (for add)' },
        targetFrameId: { type: 'string', description: 'Target frame ID within target page (optional)' },
        label: { type: 'string', description: 'Connection label (optional)' },
        triggerEvent: { type: 'string', enum: ['click', 'hover', 'submit'], description: 'Trigger event type (for add)' },
        transitionType: { type: 'string', enum: ['push', 'modal', 'replace'], description: 'Transition type (for add)' },
        updates: { type: 'object', description: 'Partial connection updates (for update_connection)' },
        pageId: { type: 'string', description: 'Filter connections by page ID (for list_connections)' },
      },
      required: ['action'],
    },
  },
]

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

    default:
      throw new Error(`Unknown tool: ${name}`)
  }
}
