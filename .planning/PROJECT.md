# Project: PenBoard

**Created:** 2026-03-15
**Type:** Fork & Extend
**Base:** [OpenPencil](https://github.com/ZSeven-W/openpencil) v0.4.1 (MIT License)
**Current Version:** v1.0 (shipped 2026-03-17)

## Vision

PenBoard = OpenPencil + Storyboard Intelligence. A local-first design tool with screen connections, data entities, reusable components with arguments, and design token management.

**Core Value:** Visual design canvas where users can design UI screens, connect them into flows, link designs to data models, and generate code — all in one tool.

## Current State

Shipped v1.0 with 65,359 LOC TypeScript across 278 source files.

**What's working:**

- Full canvas design tool (11 shape types, selection, resize, undo/redo, components, variables)
- Screen connections via property panel with canvas badge overlay
- Notion-like data entity management (9 field types, filter/sort views)
- ERD page visualization with SkiaErdRenderer
- Reusable component system with 5 argument types and drag-connect binding
- Connection highlight mode with focus+dim arrows and navigate modal
- Design token panel with grouped variables and VariablePicker on 7+ fields
- Canvas context menu, component sidebar, insert from components
- MCP server (stdio + HTTP), 20+ tools
- Electron desktop app (macOS, Windows, Linux)
- AI multi-agent design generation, Figma import
- Code generation (React, Vue, Svelte, Flutter, SwiftUI, Compose, React Native)

## Origin

Forked from OpenPencil because:
- Full source (420 files, MIT license)
- CanvasKit/Skia canvas engine (GPU-accelerated)
- Already has: 11 shape types, selection/resize, undo/redo, components, variables, MCP server, code gen, Figma import, AI multi-agent, Electron

Previous OpenBoard (Vite React + Express + Prisma) abandoned in favor of this fork.

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Runtime | Bun >= 1.0 |
| Frontend | React 19 + TanStack Start + Tailwind v4 |
| Canvas | CanvasKit/Skia (WASM, WebGL) |
| State | Zustand 5 |
| Server | Nitro (h3) |
| Desktop | Electron 35 |
| AI | Claude Agent SDK, Anthropic SDK, Copilot SDK, OpenCode SDK |
| MCP | @modelcontextprotocol/sdk |
| Build | Vite 7 + esbuild |

## File Format

`.pb` files (default), `.op` (legacy read support) — JSON, Git-friendly, diffable.

## Key Architecture

- **Document model**: `PenDocument → PenPage[] → PenNode[]` with `connections[]`, `dataEntities[]`
- **Page types**: `screen` (design canvas), `erd` (data visualization), `component` (reusable definitions)
- **Canvas**: SkiaEngine class (WebGL, dirty-flag rendering, R-tree spatial indexing)
- **Components**: `FrameNode.reusable=true` = definition, `RefNode` = instance, `ComponentArgument[]` for rich props
- **Rendering pipeline**: resolveRefs → resolveArguments → resolveVariables → premeasureText → flattenToRenderNodes → Skia render
- **Connections**: Document-level `PenConnection[]` with sourceElement, targetPage/Frame, trigger, transition
- **Data entities**: `DataEntity[]` with typed fields, sample rows, relation edges, views
- **ERD renderer**: Dedicated `SkiaErdRenderer` class for table node visualization
- **MCP**: Full server (stdio + HTTP), 20+ tools for design manipulation
- **Electron**: Main process forks Nitro, port discovery via `~/.penboard/.port`
- **App model**: Local-only, file-based — no auth, no database, no server persistence

## Key Decisions

| Decision | Choice | Outcome |
| -------- | ------ | ------- |
| App model | Local-only, file-based | Simplified architecture, fast development |
| Canvas engine | CanvasKit/Skia (inherited) | GPU-accelerated, 60fps with 100+ nodes |
| Screen model | Page = Screen | Leveraged existing multi-page system |
| Connections | Document-level array | Easy querying, auto-cascade on delete |
| Data entities | In .pb file | No separate DB needed, portable |
| Component args | 5 types (text/number/boolean/select/color) | Rich enough for real-world components |
| Variable grouping | Name-based heuristic | Automatic categorization without config |
| ERD renderer | Dedicated SkiaErdRenderer | Keeps main engine focused |

## v2 Ideas (Deferred)

- Collaboration (multiple users editing simultaneously)
- Component variants/states (hover, active, disabled)
- Responsive breakpoints
- Animation transitions
- BMAD workflow integration
- Pre-built input controls (text inputs, dropdowns, buttons)
- Custom PenBoard logo

---
*Last updated: 2026-03-17 after v1.0 milestone*
