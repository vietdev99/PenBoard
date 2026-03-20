---
description: Test GSD dialog modals with all question types
---

# Test GSD Dialog Modals

This workflow launches the browser-based dialog system with sample data to test all modal types.

## Steps

// turbo-all

1. Launch the dialog directly via stdin pipe (no temp file needed):
```bash
GSD_DIALOG=""
for dir in "$HOME/.antigravity/get-shit-done/dialog" ".agent/get-shit-done/dialog" "$HOME/.kiro/get-shit-done/dialog"; do
  if [ -f "$dir/gsd-dialog/dialog-server.js" ]; then GSD_DIALOG="$dir/gsd-dialog/dialog-server.js"; break; fi
done
if [ -z "$GSD_DIALOG" ] && [ -f "./dialog/gsd-dialog/dialog-server.js" ]; then
  GSD_DIALOG="./dialog/gsd-dialog/dialog-server.js"
fi
echo '{"title":"GSD: Test All Modal Types","questions":[{"id":"project_type","label":"Select+Desc","type":"select_with_desc","description":"Split-panel selection with markdown description preview. Click each option to see its rendered description on the right.","message":"Select a project type:","options":["Web App","API Server","CLI Tool","Mobile App"],"descriptions":["**Full-stack web application**\n\nBuilt with React frontend + Node.js backend.\n\n- Server-side rendering (SSR)\n- TypeScript throughout\n- State management with `Redux` or `Zustand`\n- Hot module replacement","**RESTful API Server**\n\nBuilt with Express.js framework.\n\n- JWT authentication & RBAC authorization\n- Database ORM with `Prisma`\n- OpenAPI/Swagger documentation\n- Rate limiting & caching","**Command-line Tool**\n\nCross-platform CLI utility.\n\n- Argument parsing with `commander`\n- Colored terminal output\n- Interactive prompts\n- Configuration file support","**React Native Mobile App**\n\nCross-platform mobile application.\n\n- iOS + Android from single codebase\n- Navigation stack with `React Navigation`\n- Native module bridges\n- Push notifications"]},{"id":"framework","label":"Single+Text","type":"select_with_text","description":"Single selection with custom text alternative. They are mutually exclusive.","message":"Choose a framework or type your own:","options":["React","Vue","Svelte","Angular","Next.js","Nuxt"],"placeholder":"Or type a custom framework name:"},{"id":"features","label":"Multi+Text","type":"multi_select_with_text","description":"Multi-selection with additional text field for notes. Both work together.","message":"Select features to include:","options":["Authentication","Database ORM","REST API","GraphQL","WebSocket","Redis Cache","Unit Tests","E2E Tests","CI/CD Pipeline","Docker","Kubernetes","Monitoring"],"placeholder":"Additional requirements or notes:"},{"id":"single_choice","label":"Single","type":"single_select","description":"Simple single selection.","message":"Choose your primary database:","options":["PostgreSQL","MySQL","MongoDB","SQLite","Redis","DynamoDB"]},{"id":"multi_choice","label":"Multi","type":"multi_select","description":"Simple multi-selection — click to toggle.","message":"Select target platforms:","options":["Web Browser","iOS","Android","Windows Desktop","macOS Desktop","Linux Desktop"]},{"id":"project_name","label":"Text","type":"text_input","description":"Simple text input.","message":"Enter your project name:","placeholder":"my-awesome-project"}]}' | node "$GSD_DIALOG"
```

The command will block until you interact with the dialog and click Submit or Cancel.

2. After the dialog closes, read the output. The result is a JSON object:
```json
{
  "cancelled": false,
  "answers": [
    { "id": "project_type", "type": "select_with_desc", "selected": "Web App", "description": "..." },
    { "id": "framework", "type": "select_with_text", "selected": null, "text": "custom" },
    { "id": "features", "type": "multi_select_with_text", "selected": ["Auth"], "text": "notes" },
    { "id": "single_choice", "type": "single_select", "selected": "PostgreSQL" },
    { "id": "multi_choice", "type": "multi_select", "selected": ["Web", "iOS"] },
    { "id": "project_name", "type": "text_input", "value": "my-project" }
  ]
}
```
