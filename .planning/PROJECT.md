# Project: PenBoard

**Created:** 2026-03-15
**Type:** Fork & Extend
**Base:** [OpenPencil](https://github.com/ZSeven-W/openpencil) v0.4.1 (MIT License)

## Vision

PenBoard = OpenPencil + Storyboard Intelligence. Design tool with screen connections, data entities, shared views, and project management.

**Core Value:** Visual design canvas where users can design UI screens, connect them into flows, link designs to data models, and generate code — all in one tool.

## Origin

Forked from OpenPencil because:
- Full source (420 files, MIT license)
- CanvasKit/Skia canvas engine (GPU-accelerated)
- Already has: 11 shape types, selection/resize, undo/redo, components, variables, MCP server, code gen, Figma import, AI multi-agent, Electron
- Missing only: backend, screen connections, storyboard overview, data entities, shared views

Previous OpenBoard (Vite React + Express + Prisma) abandoned in favor of this fork.

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Runtime | Bun >= 1.0 |
| Frontend | React 19 + TanStack Start + Tailwind v4 |
| Canvas | CanvasKit/Skia (WASM, WebGL) |
| State | Zustand 5 |
| Server | Nitro (h3) |
| Database | Prisma + SQLite (to be added) |
| Desktop | Electron 35 |
| AI | Claude Agent SDK, Anthropic SDK, Copilot SDK, OpenCode SDK |
| MCP | @modelcontextprotocol/sdk |
| Build | Vite 7 + esbuild |

## File Format

`.op` files — JSON, gzip optional, Git-friendly, diffable.

## Key Architecture

- **Document model**: `PenDocument → PenPage[] → PenNode[]`
- **Canvas**: SkiaEngine class (WebGL, dirty-flag rendering, R-tree spatial indexing)
- **Components**: `FrameNode.reusable=true` = definition, `RefNode` = instance
- **Rendering pipeline**: resolveRefs → resolveVariables → premeasureText → flattenToRenderNodes → Skia render
- **MCP**: Full server (stdio + HTTP), 20+ tools for design manipulation
- **Electron**: Main process forks Nitro, port discovery via `~/.penboard/.port`

## Storyboard Extensions (to build)

1. **Backend**: Auth + Projects + Screen persistence (Prisma + SQLite)
2. **Storyboard Overview**: All screens as thumbnails on overview canvas
3. **Screen Connections**: Arrows with metadata (trigger, transition, label)
4. **Data Entities**: Visual ERD + data entity shapes on design canvas
5. **Shared Views**: Reusable layout fragments (leverages component system)
6. **Design Tokens UI**: Token management panel (leverages variables system)

---
*Project initialized: 2026-03-15*
