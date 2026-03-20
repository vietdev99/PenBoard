---
name: gsd-dialog
description: How to implement AskUserQuestion using the browser-based dialog system (dialog-server.js) instead of plain text. Read this whenever you see AskUserQuestion in a GSD workflow.
---

# GSD Dialog — AskUserQuestion Implementation

When running GSD workflows (e.g., `/gsd-settings`, `/gsd-new-project`, `/gsd-discuss-phase`), you'll see `AskUserQuestion(...)` pseudo-code. This is **NOT a native tool** in Antigravity. Instead, use `dialog-server.js` via `run_command`.

## Quick Example

When a workflow says:
```
AskUserQuestion({
  header: "Model",
  question: "Which model profile?",
  multiSelect: false,
  options: [
    { label: "Quality", description: "Opus everywhere" },
    { label: "Balanced", description: "Opus+Sonnet mix" }
  ]
})
```

You run:
```bash
echo '{"title":"GSD Settings","questions":[{"id":"model","label":"Model","type":"select_with_desc","message":"Which model profile?","options":["Quality","Balanced"],"descriptions":["Opus everywhere","Opus+Sonnet mix"]}]}' | node "$GSD_DIALOG"
```

## Finding dialog-server.js

Always find the script first:
```bash
GSD_DIALOG=""
for dir in "$HOME/.antigravity/get-shit-done/dialog" ".agent/get-shit-done/dialog" "$HOME/.kiro/get-shit-done/dialog"; do
  [ -f "$dir/gsd-dialog/dialog-server.js" ] && GSD_DIALOG="$dir/gsd-dialog/dialog-server.js" && break
done
[ -z "$GSD_DIALOG" ] && [ -f "./dialog/gsd-dialog/dialog-server.js" ] && GSD_DIALOG="./dialog/gsd-dialog/dialog-server.js"
```

## Translation Rules

| AskUserQuestion | dialog-server.js JSON |
|---|---|
| `header` → | `label` (tab name) |
| `question` → | `message` (bold question) |
| `multiSelect: false` → | `type: "single_select"` or `"select_with_desc"` |
| `multiSelect: true` → | `type: "multi_select"` |
| `options[].label` → | `options[]` array |
| `options[].description` → | `descriptions[]` array → use `"select_with_desc"` type |
| (free text) → | `type: "text_input"` |

**Key rule**: If options have `description` fields, use `"select_with_desc"` type (shows markdown preview panel).

## Batching: Always combine into ONE dialog

When a workflow calls `AskUserQuestion([...multiple questions...])`, put ALL questions in one `questions` array. Each question = one tab. User answers all at once.

**NEVER show multiple separate dialogs when the workflow batches questions.**

## run_command Pattern

```javascript
// Use WaitMsBeforeAsync: 500 (background), then command_status with long wait
run_command({
  CommandLine: `echo '${JSON.stringify(dialogData)}' | node "$GSD_DIALOG"`,
  WaitMsBeforeAsync: 500
})
// Then:
command_status({ CommandId: "...", WaitDurationSeconds: 300 })
```

## Response Format

```json
{
  "cancelled": false,
  "answers": [
    { "id": "model", "type": "select_with_desc", "selected": "Balanced", "description": "..." }
  ]
}
```

- `cancelled: true` → user clicked Cancel → abort workflow
- `selected` → chosen option label
- `text` → custom text (for `select_with_text` types)
- `value` → text content (for `text_input`)

## Available Types

| Type | Use Case |
|---|---|
| `single_select` | Pick exactly one (no descriptions) |
| `multi_select` | Pick multiple (no descriptions) |
| `text_input` | Free text input |
| `select_with_text` | Pick one OR type custom (mutually exclusive) |
| `multi_select_with_text` | Pick multiple + optional text |
| `select_with_desc` | Pick one with markdown description panel |
