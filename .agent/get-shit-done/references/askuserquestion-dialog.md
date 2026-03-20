<askuserquestion_implementation>

## AskUserQuestion — Antigravity Runtime

In Antigravity/Kiro runtimes, `AskUserQuestion` is NOT a native tool. Instead, use the `dialog-server.js` utility via `run_command` to show interactive browser-based dialogs.

### How It Works

When a GSD workflow says `AskUserQuestion(...)`, translate it to a `run_command` call that pipes JSON to `dialog-server.js`:

```bash
echo '<JSON>' | node "$HOME/.antigravity/get-shit-done/dialog/gsd-dialog/dialog-server.js"
```

The command opens a Chrome window with a tabbed dialog form. It blocks until the user clicks Submit or Cancel, then outputs JSON to stdout.

### JSON Input Format

```json
{
  "title": "Window Title",
  "questions": [
    {
      "id": "unique_id",
      "label": "Tab Label",
      "type": "single_select",
      "description": "Context/explanation shown at top of tab",
      "message": "The question text (bold)",
      "options": ["Option A", "Option B", "Option C"]
    }
  ]
}
```

### Mapping AskUserQuestion to JSON

When you see this in a workflow:
```
AskUserQuestion([
  {
    question: "Which model profile?",
    header: "Model",
    multiSelect: false,
    options: [
      { label: "Quality", description: "Opus everywhere" },
      { label: "Balanced", description: "Opus+Sonnet mix" }
    ]
  },
  {
    question: "Enable research?",
    header: "Research",
    multiSelect: false,
    options: [
      { label: "Yes", description: "Research before planning" },
      { label: "No", description: "Skip research" }
    ]
  }
])
```

Translate to this JSON:
```json
{
  "title": "GSD Settings",
  "questions": [
    {
      "id": "model",
      "label": "Model",
      "type": "select_with_desc",
      "message": "Which model profile?",
      "options": ["Quality", "Balanced"],
      "descriptions": ["Opus everywhere", "Opus+Sonnet mix"]
    },
    {
      "id": "research",
      "label": "Research",
      "type": "select_with_desc",
      "message": "Enable research?",
      "options": ["Yes", "No"],
      "descriptions": ["Research before planning", "Skip research"]
    }
  ]
}
```

### Translation Rules

| Workflow Field | JSON Field | Notes |
|---|---|---|
| `header` | `label` | Tab label (short) |
| `question` | `message` | Bold question text |
| `multiSelect: false` | `type: "single_select"` | Pick one |
| `multiSelect: true` | `type: "multi_select"` | Pick many |
| `options[].label` | `options[]` | Option text array |
| `options[].description` | `descriptions[]` | Use `select_with_desc` type |
| (text input needed) | `type: "text_input"` | Free text |
| (select OR custom text) | `type: "select_with_text"` | Mutually exclusive |
| (multi-select + text) | `type: "multi_select_with_text"` | Both allowed |

### Question Types

- **`single_select`** — Pick exactly one option (radio buttons)
- **`multi_select`** — Pick multiple options (checkboxes)
- **`text_input`** — Free text input
- **`select_with_text`** — Pick one OR type custom (mutually exclusive)
- **`multi_select_with_text`** — Pick multiple AND optional text notes
- **`select_with_desc`** — Pick one with markdown description preview panel

### When options have descriptions, use `select_with_desc`

If options have `description` fields, use `select_with_desc` type with a `descriptions` array matching the options order. This shows a split panel with markdown-rendered descriptions.

### Batching Multiple Questions

When a workflow calls `AskUserQuestion` with an array of questions, **combine them all into one dialog call** with one `questions` array. Each question becomes a tab. The user answers all at once and clicks Submit.

**DO NOT** show multiple separate dialogs. Always batch into one.

### Finding dialog-server.js

```bash
GSD_DIALOG=""
for dir in "$HOME/.antigravity/get-shit-done/dialog" ".agent/get-shit-done/dialog" "$HOME/.kiro/get-shit-done/dialog"; do
  [ -f "$dir/gsd-dialog/dialog-server.js" ] && GSD_DIALOG="$dir/gsd-dialog/dialog-server.js" && break
done
[ -z "$GSD_DIALOG" ] && [ -f "./dialog/gsd-dialog/dialog-server.js" ] && GSD_DIALOG="./dialog/gsd-dialog/dialog-server.js"
```

### Reading the Response

The stdout JSON looks like:
```json
{
  "cancelled": false,
  "answers": [
    { "id": "model", "type": "select_with_desc", "selected": "Balanced", "description": "..." },
    { "id": "research", "type": "select_with_desc", "selected": "Yes", "description": "..." }
  ]
}
```

- If `cancelled: true` — user clicked Cancel, treat as abort
- Each answer has `id` matching the question `id`
- `selected` contains the chosen option label(s)
- `text` contains custom text (for `select_with_text` / `multi_select_with_text`)
- `value` contains text (for `text_input`)

### Single Question Shorthand

For a single question (no array), you can still use the same format with one item in `questions`. The dialog will show one tab.

### Important

- **Always use `run_command`** with `WaitMsBeforeAsync` set to a small value (e.g., 500) so it runs in background
- **Use `command_status`** with a long `WaitDurationSeconds` (e.g., 300) to wait for user response
- The Submit button is **disabled** until all tabs have answers
- The Chrome window **auto-closes** after Submit/Cancel

</askuserquestion_implementation>
