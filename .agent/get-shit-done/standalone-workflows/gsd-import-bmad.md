---
description: Import BMAD planning artifacts (PRD, Architecture, Epics) into GSD milestone/phase structure
---

# Import BMAD → GSD

## Objective

Đọc các planning artifacts từ BMAD (PRD, Architecture, Epics & Stories) và chuyển đổi sang cấu trúc GSD (PROJECT.md, REQUIREMENTS.md, ROADMAP.md) để GSD có thể execute.

## Prerequisites

- BMAD đã chạy xong Phase 1-3 (có PRD, Architecture, Epics)
- GSD đã được cài đặt trong project

## Steps

### Step 1: Tìm và đọc BMAD artifacts

Tìm các file planning artifacts trong project:

```
_bmad-output/planning-artifacts/PRD.md
_bmad-output/planning-artifacts/architecture.md
_bmad-output/planning-artifacts/epics/    (thư mục chứa các epic files)
```

Nếu không tìm thấy ở vị trí mặc định, hỏi user vị trí chính xác.

Đọc toàn bộ nội dung của:
1. PRD.md — lấy project vision, goals, requirements, success metrics
2. architecture.md — lấy tech stack, system design, constraints
3. Tất cả epic files — lấy danh sách epics và stories

### Step 2: Tạo/Cập nhật PROJECT.md

Tạo hoặc cập nhật `.planning/PROJECT.md` với nội dung tổng hợp từ BMAD:

```markdown
# [Project Name from PRD]

## Vision
[Lấy từ PRD - Executive Summary & Vision]

## Tech Stack
[Lấy từ architecture.md - Tech Stack section]

## Architecture Overview
[Tóm tắt từ architecture.md - key decisions, patterns]

## Current Milestone
[Milestone name - typically v1.0 or the main goal from PRD]

## History
- [date] — Imported from BMAD planning artifacts (PRD + Architecture + Epics)
```

### Step 3: Tạo REQUIREMENTS.md

Tạo `.planning/REQUIREMENTS.md` bằng cách tổng hợp từ PRD:

```markdown
# Requirements — [Milestone Name]

## Functional Requirements
[Lấy từ PRD - Functional Requirements section]

## Non-Functional Requirements
[Lấy từ PRD - Non-Functional Requirements section]

## User Journeys
[Lấy từ PRD - User Journeys section]

## Success Metrics
[Lấy từ PRD - Success Metrics section]

## Source
Imported from BMAD PRD: `_bmad-output/planning-artifacts/PRD.md`
```

### Step 4: Chuyển Epics → Phases trong ROADMAP.md

Đây là bước quan trọng nhất. Mapping rule:

| BMAD | GSD |
|------|-----|
| Epic | Nhóm phases (comment header trong ROADMAP) |
| Story | Phase |

Tạo `.planning/ROADMAP.md`:

```markdown
# Roadmap — [Milestone Name]

## Milestone: [Name] (current)

<!-- Epic 1: [Epic Name] -->
- Phase 1: [Story 1 title] `[slug]`
- Phase 2: [Story 2 title] `[slug]`

<!-- Epic 2: [Epic Name] -->
- Phase 3: [Story 3 title] `[slug]`
- Phase 4: [Story 4 title] `[slug]`
...
```

**Slug generation**: lowercase, spaces → hyphens, remove special chars.
Ví dụ: "User Authentication Flow" → `user-authentication-flow`

### Step 5: Tạo Phase directories

Với mỗi phase trong ROADMAP, tạo thư mục:

```
.planning/phases/[N]-[slug]/
```

Ví dụ:
```
.planning/phases/1-user-authentication-flow/
.planning/phases/2-dashboard-layout/
.planning/phases/3-order-management/
```

### Step 6: Tạo/Cập nhật STATE.md

Tạo `.planning/STATE.md`:

```markdown
# State

## Current
- milestone: [Milestone Name]
- phase: 1
- status: planning
- last-action: Imported from BMAD

## Roadmap Evolution
- [date]: Initial roadmap created from BMAD Epics & Stories ([N] phases)
```

### Step 7: Xác nhận với user

Hiển thị cho user:
1. Số lượng epics đã import
2. Số lượng stories → phases đã tạo
3. Cấu trúc ROADMAP.md
4. Gợi ý bước tiếp theo: `/gsd-plan-phase 1`

## Notes

- Giữ nguyên BMAD artifacts — không xóa, không sửa
- GSD files là bản "translated" để GSD workflows có thể đọc
- Nếu cần thêm phase sau này, dùng `/gsd-add-phase` như bình thường
- Architecture document nên được link trong PROJECT.md để các phase plan có thể reference
