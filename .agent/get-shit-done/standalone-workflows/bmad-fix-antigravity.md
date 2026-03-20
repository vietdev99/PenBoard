---
description: Fix BMAD workflows visibility after npx bmad-method install. Run this after installing BMAD in any project.
---

# Fix BMAD Workflows for Antigravity IDE

## Problem
After running `npx bmad-method install`, BMAD creates workflow files in `.agent/workflows/` but Antigravity IDE doesn't detect them because they were created by an external process. Only files created by Antigravity's own `write_to_file` tool are indexed.

## Instructions

You MUST follow these steps exactly:

### Step 1: Find all BMAD workflow files

Use `run_command` to list all bmad-* files and their contents:

```bash
cd ".agent/workflows" && for f in bmad-*.md; do echo "===FILE:${f}==="; cat "$f"; echo "===END==="; done
```

### Step 2: Re-create each file using write_to_file

For EACH file found in Step 1:
1. Parse the file content (everything between `===FILE:xxx===` and `===END===`)
2. Remove the `name:` line from the YAML frontmatter (keep only `description:`)
3. Use the `write_to_file` tool with `Overwrite: true` to re-create the file at `.agent/workflows/<filename>`
4. Process files in batches of 10 for efficiency (parallel write_to_file calls)

### Step 3: Clean up and verify

After all files are re-created:
1. Count the total files: `ls .agent/workflows/bmad-*.md | wc -l`
2. Report to the user how many workflows were fixed
3. Suggest the user type `/bmad` to verify all workflows appear in the dropdown

### Important Notes
- Do NOT modify the file content except removing the `name:` line from frontmatter
- Keep the `description:` field exactly as-is
- Keep all body content (steps, agent-activation, etc.) exactly as-is
- Process ALL bmad-*.md files, not just a subset
