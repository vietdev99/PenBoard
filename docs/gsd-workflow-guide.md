# GSD Workflow — Hướng dẫn sử dụng toàn diện

**GSD** (Get Shit Done) là hệ thống quản lý project dạng phân cấp, tối ưu cho solo agentic development với Claude Code. GSD tự động hóa toàn bộ quy trình: từ nghiên cứu, lập kế hoạch, thực thi, đến kiểm tra — thông qua một đội ngũ agent chuyên biệt.

## Mục lục

- [Cài đặt & Cập nhật](#cài-đặt--cập-nhật)
- [Quick Start](#quick-start)
- [Triết lý & Kiến trúc](#triết-lý--kiến-trúc)
  - [Vòng đời project](#vòng-đời-project)
  - [Hệ thống Agent](#hệ-thống-agent)
  - [Nguyên tắc cốt lõi](#nguyên-tắc-cốt-lõi)
- [Tất cả lệnh GSD](#tất-cả-lệnh-gsd)
  - [1. Khởi tạo Project](#1-khởi-tạo-project)
  - [2. Thảo luận & Nghiên cứu Phase](#2-thảo-luận--nghiên-cứu-phase)
  - [3. Lập kế hoạch Phase](#3-lập-kế-hoạch-phase)
  - [4. Thực thi Phase](#4-thực-thi-phase)
  - [5. Autonomous Mode — Chạy tự động](#5-autonomous-mode--chạy-tự-động)
  - [6. Quick Mode — Task ad-hoc](#6-quick-mode--task-ad-hoc)
  - [7. UI Design — Thiết kế giao diện](#7-ui-design--thiết-kế-giao-diện)
  - [8. Kiểm tra & Xác minh](#8-kiểm-tra--xác-minh)
  - [9. Test tự động](#9-test-tự-động)
  - [10. Debug có hệ thống](#10-debug-có-hệ-thống)
  - [11. Todo — Capture ý tưởng](#11-todo--capture-ý-tưởng)
  - [12. Quản lý Roadmap](#12-quản-lý-roadmap)
  - [13. Quản lý Milestone](#13-quản-lý-milestone)
  - [14. Theo dõi tiến độ & Session](#14-theo-dõi-tiến-độ--session)
  - [15. Cấu hình & Tiện ích](#15-cấu-hình--tiện-ích)
- [Flags & Tùy chọn nâng cao](#flags--tùy-chọn-nâng-cao)
- [Cấu trúc thư mục .planning/](#cấu-trúc-thư-mục-planning)
- [Pipeline nội bộ chi tiết](#pipeline-nội-bộ-chi-tiết)
- [Workflow phổ biến (có giải thích)](#workflow-phổ-biến-có-giải-thích)
- [Chế độ hoạt động](#chế-độ-hoạt-động)
- [Cấu hình config.json](#cấu-hình-configjson)
- [Tips & Best Practices](#tips--best-practices)

---

## Cài đặt & Cập nhật

**Cài đặt lần đầu:**

```bash
npx get-shit-done-cc@latest
```

**Cập nhật lên phiên bản mới:**

```
/gsd:update
```

- Hiển thị so sánh version cũ/mới
- Hiển thị changelog cho các version bạn đã miss
- Highlight breaking changes
- Xác nhận trước khi install

**Reapply patches sau update:**

```
/gsd:reapply-patches
```

Nếu bạn đã sửa đổi local các file GSD, lệnh này giúp reapply những thay đổi đó sau khi update.

---

## Quick Start

```
/gsd:new-project          # 1. Khởi tạo: hỏi → nghiên cứu → requirements → roadmap
/clear
/gsd:discuss-phase 1      # 2. (Tùy chọn) Thảo luận tầm nhìn phase
/clear
/gsd:plan-phase 1         # 3. Lập kế hoạch chi tiết
/clear
/gsd:execute-phase 1      # 4. Thực thi
/clear
/gsd:verify-work 1        # 5. Kiểm tra kết quả
```

Lặp lại bước 2-5 cho các phase tiếp theo. `/clear` giữa mỗi bước lớn để giữ context window gọn — GSD lưu mọi thứ vào file, không mất gì.

---

## Triết lý & Kiến trúc

### Vòng đời project

```
                    ┌─────────────────────────────────┐
                    │       MILESTONE LIFECYCLE        │
                    └─────────────────────────────────┘

 ┌──────────┐    ┌──────────────┐    ┌───────────────┐    ┌──────────────┐
 │  new-     │    │  discuss-    │    │  plan-        │    │  execute-    │
 │  project  │───▶│  phase       │───▶│  phase        │───▶│  phase       │
 │           │    │  (tùy chọn)  │    │               │    │              │
 └──────────┘    └──────────────┘    └───────────────┘    └──────┬───────┘
      │                                                          │
      ▼                                                          ▼
 PROJECT.md          CONTEXT.md           PLAN.md          SUMMARY.md
 REQUIREMENTS.md                                           VERIFICATION.md
 ROADMAP.md
 STATE.md                                                        │
                                                                 ▼
                    ┌──────────────┐    ┌───────────────┐    ┌──────────┐
                    │  verify-     │    │  add-tests    │    │  Lặp lại │
                    │  work (UAT)  │◀───│  (tùy chọn)  │◀───│  phase   │
                    └──────┬───────┘    └───────────────┘    │  tiếp    │
                           │                                 └──────────┘
                           ▼
                    ┌──────────────┐    ┌───────────────┐
                    │  audit-      │───▶│  complete-    │───▶ git tag + archive
                    │  milestone   │    │  milestone    │
                    └──────────────┘    └───────────────┘
```

### Hệ thống Agent

GSD không phải một script đơn lẻ — nó là một **hệ thống đa agent** chuyên biệt:

| Agent | Vai trò | Được spawn bởi |
|-------|---------|-----------------|
| **gsd-project-researcher** | Nghiên cứu domain ecosystem (4 agent song song) | `new-project`, `new-milestone` |
| **gsd-research-synthesizer** | Tổng hợp kết quả nghiên cứu thành SUMMARY.md | `new-project` |
| **gsd-roadmapper** | Tạo roadmap với phase breakdown | `new-project`, `new-milestone` |
| **gsd-codebase-mapper** | Phân tích codebase hiện có (song song theo focus area) | `map-codebase` |
| **gsd-phase-researcher** | Nghiên cứu cách implement một phase cụ thể | `plan-phase`, `research-phase` |
| **gsd-planner** | Tạo PLAN.md với task breakdown chi tiết | `plan-phase`, `quick` |
| **gsd-plan-checker** | Xác minh plan đạt goal trước khi thực thi | `plan-phase` |
| **gsd-executor** | Thực thi plan với atomic commits | `execute-phase`, `quick` |
| **gsd-verifier** | Xác minh goal đạt được (không chỉ task hoàn thành) | `execute-phase` |
| **gsd-integration-checker** | Kiểm tra cross-phase wiring và E2E flows | `audit-milestone` |
| **gsd-debugger** | Debug theo phương pháp khoa học | `debug` |
| **gsd-ui-researcher** | Tạo UI design contract (UI-SPEC.md) | `ui-phase` |
| **gsd-ui-checker** | Verify UI-SPEC theo 6 dimensions | `ui-phase` |
| **gsd-ui-auditor** | 6-pillar visual audit trên code đã implement | `ui-review` |
| **gsd-nyquist-auditor** | Audit test coverage, generate missing tests | `validate-phase` |

### Nguyên tắc cốt lõi

**1. Task completion ≠ Goal achievement**

Một task "tạo chat component" có thể hoàn thành khi component là placeholder. Task done — nhưng goal "working chat interface" chưa đạt.

GSD verify theo hướng **goal-backward**:
- Điều gì phải ĐÚNG để goal đạt được?
- Điều gì phải TỒN TẠI để những điều đó đúng?
- Điều gì phải ĐƯỢC NỐI để artifacts hoạt động?

**2. User = Visionary, Claude = Builder**

Trong `discuss-phase`, user biết:
- Hình dung nó hoạt động thế nào
- Look/feel ra sao
- Cái gì essential vs nice-to-have

Claude không hỏi user về codebase patterns, technical risks, hay implementation approach — đó là việc của researcher và planner.

**3. Scope guardrail**

Phase boundary từ ROADMAP.md là CỐ ĐỊNH. Discussion chỉ clarify HOW, không thêm scope mới. Nếu user suggest scope creep, GSD capture vào "Deferred Ideas" và quay lại focus.

---

## Tất cả lệnh GSD

### 1. Khởi tạo Project

#### `/gsd:new-project`

Khởi tạo project mới từ đầu. Một lệnh duy nhất: từ ý tưởng → sẵn sàng lập kế hoạch.

**Quy trình (unified flow):**
1. **Deep questioning** — Hỏi sâu để hiểu bạn muốn xây gì
2. **Brownfield detection** — Phát hiện code có sẵn, đề xuất `map-codebase` trước
3. **Config** — Chọn mode (interactive/yolo), depth, agents
4. **Research** (tùy chọn) — Spawn 4 researcher agent song song nghiên cứu domain
5. **Requirements** — Phân loại v1 (must)/v2 (later)/out-of-scope
6. **Roadmap** — Breakdown thành phases với success criteria

**Tạo ra:**
```
.planning/
├── PROJECT.md          # Tầm nhìn, tech stack, decisions
├── config.json         # Workflow mode & agent gates
├── research/           # Domain research (nếu chọn)
│   └── SUMMARY.md
├── REQUIREMENTS.md     # Requirements có REQ-ID
├── ROADMAP.md          # Phases ánh xạ tới requirements
└── STATE.md            # Bộ nhớ project
```

```
/gsd:new-project
/gsd:new-project --auto @prd.md    # Auto mode: skip hỏi, extract từ PRD
```

**Flag `--auto`:** Bỏ qua deep questioning, extract context từ file/text truyền vào. Tự chọn YOLO mode, auto-approve requirements & roadmap. Cần truyền kèm document mô tả ý tưởng.

#### `/gsd:map-codebase`

Phân tích codebase hiện có cho **brownfield project** (project đã có code sẵn).

- Spawn nhiều Explore agent song song, phân theo focus area
- Tạo **7 tài liệu phân tích** trong `.planning/codebase/`:

| File | Nội dung |
|------|----------|
| `STACK.md` | Ngôn ngữ, framework, dependencies |
| `ARCHITECTURE.md` | Patterns, layers, data flow |
| `STRUCTURE.md` | Directory layout, key files |
| `CONVENTIONS.md` | Coding standards, naming |
| `TESTING.md` | Test setup, patterns |
| `INTEGRATIONS.md` | External services, APIs |
| `CONCERNS.md` | Tech debt, known issues |

**Luôn dùng trước `/gsd:new-project` khi project đã có code.**

```
/gsd:map-codebase
```

---

### 2. Thảo luận & Nghiên cứu Phase

Đây là bước **tùy chọn nhưng rất quan trọng** trước khi plan. GSD cung cấp 3 công cụ ở giai đoạn này:

#### `/gsd:discuss-phase <số>`

**Mục đích:** Trích xuất implementation decisions từ bạn. Bạn là visionary — Claude là builder. Claude không hỏi về kỹ thuật, chỉ hỏi về tầm nhìn.

**Cách hoạt động:**
1. Đọc phase goal từ ROADMAP.md
2. **Nhận diện gray areas** — những quyết định có thể đi nhiều hướng:
   - Cái users SẼ THẤY → visual, interactions, states
   - Cái users SẼ GỌI → interface, responses, errors
   - Cái users SẼ CHẠY → invocation, output, behavior
3. **Hỏi từng gray area** — cho bạn chọn, hoặc bạn nói "Claude tự quyết"
4. **Capture decisions** vào `CONTEXT.md`

**`CONTEXT.md` feed vào đâu?**
- **Researcher** → đọc để biết CẦN nghiên cứu GÌ ("user muốn card layout" → nghiên cứu card component patterns)
- **Planner** → đọc để biết decisions nào ĐÃ LOCK ("pull-to-refresh" → planner đưa vào task specs)

**Scope guardrail:** Phase boundary là CỐ ĐỊNH. Nếu bạn suggest feature mới, GSD capture vào "Deferred Ideas" và redirect về focus hiện tại.

**Flags:**

| Flag | Tác dụng |
|------|----------|
| `--batch` | Hỏi 2-5 câu liên quan cùng lúc thay vì từng câu một — nhanh hơn |
| `--batch=N` | Giống `--batch` nhưng fix số câu per batch (ví dụ: `--batch=3`) |
| `--auto` | Claude tự chọn recommended option cho mỗi gray area — bỏ qua hỏi đáp hoàn toàn |

```
/gsd:discuss-phase 2                  # Hỏi từng câu (mặc định)
/gsd:discuss-phase 2 --batch          # Hỏi 2-5 câu cùng lúc
/gsd:discuss-phase 2 --batch=3        # Fix 3 câu per batch
/gsd:discuss-phase 2 --auto           # Tự động — Claude chọn recommended defaults
```

#### `/gsd:research-phase <số>`

**Mục đích:** Nghiên cứu chuyên sâu cho domain phức tạp/niche. Không phải "chọn library nào" mà là "cách expert build cái này".

**Khi nào cần:** 3D/games, audio processing, ML, shader, real-time, hoặc bất kỳ domain nào Claude chưa chắc best practices.

**Tạo ra:** `RESEARCH.md` — stack chuẩn, architecture patterns, pitfalls, ecosystem knowledge.

```
/gsd:research-phase 3
```

> **Lưu ý:** Thường không cần gọi trực tiếp vì `plan-phase` đã tích hợp research tự động. Chỉ dùng khi cần nghiên cứu sâu hơn mức mặc định.

#### `/gsd:list-phase-assumptions <số>`

**Mục đích:** Xem Claude định tiếp cận phase thế nào TRƯỚC khi plan.

- Hiển thị approach dự kiến
- Cho phép điều chỉnh nếu Claude hiểu sai
- **Không tạo file** — chỉ output trên conversation
- Rẻ nhất để phản biện sớm

```
/gsd:list-phase-assumptions 3
```

---

### 3. Lập kế hoạch Phase

#### `/gsd:plan-phase <số>`

**Lệnh quan trọng nhất.** Tạo kế hoạch thực thi chi tiết, trải qua pipeline 3 agent với revision loop.

**Pipeline nội bộ:**
```
┌────────────────┐     ┌──────────────┐     ┌────────────────┐
│  Phase         │     │  Planner     │     │  Plan Checker  │
│  Researcher    │────▶│  (gsd-       │────▶│  (gsd-plan-    │
│  (gsd-phase-   │     │  planner)    │     │  checker)      │
│  researcher)   │     │              │     │                │
└────────────────┘     └──────────────┘     └───────┬────────┘
                                                    │
                                          ┌─────────┴─────────┐
                                          │ Pass?             │
                                          │ Yes → Done        │
                                          │ No → Quay lại     │
                                          │   Planner (max 3  │
                                          │   iterations)     │
                                          └───────────────────┘
```

1. **Researcher** — Nghiên cứu cách implement (nếu cần), tạo `RESEARCH.md`
2. **Planner** — Tạo `PLAN.md` với task breakdown, dependencies, verification criteria
3. **Checker** — Xác minh plan có đạt goal không (goal-backward analysis)
4. **Revision loop** — Nếu checker reject, quay lại planner (tối đa 3 lần)

**Discovery levels** (tự động quyết định hoặc override):

| Level | Tên | Thời gian | Khi nào |
|-------|-----|-----------|---------|
| 1 | Quick Verify | 2-5 phút | Xác nhận syntax, single library |
| 2 | Standard | 15-30 phút | So sánh options, new integration |
| 3 | Deep Dive | 1+ giờ | Architectural decisions, novel problems |

**Flags:**

| Flag | Tác dụng |
|------|----------|
| `--research` | Force chạy researcher (dù đã có RESEARCH.md) |
| `--skip-research` | Bỏ qua researcher |
| `--skip-verify` | Bỏ qua plan checker |
| `--prd <filepath>` | PRD Express Path — bỏ qua discuss-phase, PRD thành locked decisions |
| `--gaps` | Chỉ plan cho gaps từ UAT/audit |

```
/gsd:plan-phase 1                        # Cơ bản
/gsd:plan-phase 2 --skip-research        # Bỏ qua research
/gsd:plan-phase 3 --prd ./specs/auth.md  # Dùng PRD có sẵn
/gsd:plan-phase 4 --gaps                 # Plan lấp gaps
```

**Kết quả:** `.planning/phases/XX-name/XX-01-PLAN.md` (hỗ trợ nhiều plan per phase)

---

### 4. Thực thi Phase

#### `/gsd:execute-phase <số>`

Thực thi tất cả plans trong một phase qua **wave-based parallel execution**.

**Cách hoạt động:**

1. **Discover plans** — Quét tất cả `*-PLAN.md` chưa có `*-SUMMARY.md` tương ứng
2. **Group into waves** — Plans có `wave` frontmatter được nhóm lại
3. **Execute waves tuần tự** — Wave 1 xong → Wave 2 bắt đầu
4. **Trong cùng wave** — Plans chạy song song (nếu `parallelization: true`)
5. **Mỗi plan** → spawn `gsd-executor` agent riêng, atomic commits
6. **Sau tất cả plans** → spawn `gsd-verifier` agent xác minh goal
7. **Cập nhật** REQUIREMENTS.md, ROADMAP.md, STATE.md

**Branching strategies** (cấu hình trong config.json):
- `"none"` — Commit trên branch hiện tại
- `"phase"` — Tạo branch riêng per phase
- `"milestone"` — Tạo branch riêng per milestone

```
/gsd:execute-phase 1
/gsd:execute-phase 5.1          # Phase dạng decimal cũng được
/gsd:execute-phase 3 --gaps-only # Chỉ execute gap closure plans
```

**Output per plan:**
- `XX-YY-SUMMARY.md` — Tóm tắt: gì đã làm, files changed, decisions
- Git commits — Atomic, mỗi task logic = 1 commit

**Output per phase:**
- `VERIFICATION.md` — Kết quả verify goal-backward

---

### 5. Autonomous Mode — Chạy tự động

#### `/gsd:autonomous`

Chạy **tất cả phases còn lại** một cách tự động — mỗi phase qua pipeline: discuss → plan → execute.

**Khi nào dùng:**
- Roadmap rõ ràng, bạn tin tưởng pipeline
- Muốn chạy qua đêm hoặc không cần can thiệp
- Phase goals đã đủ chi tiết trong ROADMAP.md

**Cách hoạt động:**

```
Per phase (lần lượt):
1. Smart Discuss   → Tự phân tích gray areas, đề xuất proposals
                     Nếu có CONTEXT.md → skip
2. Plan            → Spawn researcher + planner + checker
3. Execute         → Wave-based parallel execution
4. Verify          → Goal-backward verification
5. Xử lý kết quả  → Pass → next phase / Fail → retry/skip/stop
```

**Xử lý lỗi:** Khi một phase fail verification, 3 options:
- **Retry** — Thử lại phase đó
- **Skip** — Bỏ qua, tiếp tục phase sau
- **Stop** — Dừng autonomous mode, trả control cho bạn

**Lifecycle cuối cùng:** Khi tất cả phases hoàn thành → tự động chạy audit → complete milestone → cleanup.

```
/gsd:autonomous                  # Bắt đầu từ phase chưa hoàn thành đầu tiên
/gsd:autonomous --from 3         # Bắt đầu từ phase 3
```

> **Lưu ý:** Autonomous mode vẫn tôn trọng config — nếu `mode: interactive`, nó sẽ pause ở critical checkpoints.

---

### 6. Quick Mode — Task ad-hoc

#### `/gsd:quick`

Thực thi task nhỏ với GSD guarantees (atomic commits, STATE.md tracking) nhưng **bỏ qua** researcher, checker, verifier mặc định.

**Pipeline rút gọn:**
```
User mô tả task → [Discussion] → [Research] → Planner → [Checker] → Executor → [Verifier] → Done
                    (--discuss)   (--research)             (--full)               (--full)
```

**Khi nào dùng:**
- Bug fix đã biết rõ nguyên nhân
- Refactor nhỏ
- Thêm 1 feature đơn giản
- Bất kỳ task nào bạn biết chính xác cần làm

**Task nằm ở đâu:** `.planning/quick/NNN-slug/` (riêng biệt với phases)

**Flags (composable — kết hợp được):**

| Flag | Tác dụng |
|------|----------|
| `--full` | Bật plan checking (max 2 iterations) + post-execution verification |
| `--discuss` | Lightweight discussion trước planning — surface gray areas |
| `--research` | Spawn focused research agent trước planning |

```
/gsd:quick                                          # Cơ bản: planner + executor
/gsd:quick Fix the z-index on dropdown modal        # Mô tả trực tiếp
/gsd:quick --full Add retry logic to API            # Full quality pipeline
/gsd:quick --discuss --research Implement OAuth     # Discussion + research + plan + execute
/gsd:quick --discuss --research --full Add caching  # Tất cả agents: discussion + research + checker + verifier
```

---

### 7. UI Design — Thiết kế giao diện

#### `/gsd:ui-phase <số>`

Tạo **UI design contract** (`UI-SPEC.md`) cho frontend phases. Chạy TRƯỚC `plan-phase` để planner có spec thiết kế.

**Cách hoạt động:**

1. **Check prerequisites** — Cần CONTEXT.md (từ `discuss-phase`) hoặc RESEARCH.md
2. **Spawn gsd-ui-researcher** — Tạo UI-SPEC.md với:
   - Layout structure cho mỗi screen/component
   - Responsive breakpoints
   - Interaction patterns
   - Visual hierarchy
   - Accessibility requirements
3. **Spawn gsd-ui-checker** — Verify UI-SPEC theo 6 dimensions
4. **Revision loop** — Max 2 iterations nếu checker tìm issues

**Output:** `.planning/phases/XX-name/UI-SPEC.md`

```
/gsd:ui-phase 3          # Tạo UI spec cho phase 3
```

> **Khi nào dùng:** Phase có frontend components (forms, dashboards, layouts). Không cần cho backend-only phases.

#### `/gsd:ui-review <số>`

**Retroactive 6-pillar visual audit** — chạy SAU khi code đã implement để kiểm tra chất lượng UI.

**6 Pillars đánh giá:**
1. **Layout & Spacing** — Alignment, padding consistency, grid adherence
2. **Typography** — Font hierarchy, sizing, readability
3. **Color & Contrast** — Palette consistency, accessibility (WCAG)
4. **Interactive States** — Hover, focus, active, disabled states
5. **Responsive** — Breakpoint behavior, mobile-first
6. **Accessibility** — ARIA labels, keyboard navigation, screen reader

**Cách hoạt động:**
1. Đọc SUMMARY.md → xác định files đã implement
2. Spawn **gsd-ui-auditor** → scan code, đánh giá 6 pillars
3. Tạo `UI-REVIEW.md` với score per pillar + findings

```
/gsd:ui-review 3         # Audit UI quality cho phase 3
```

---

### 8. Kiểm tra & Xác minh

#### `/gsd:verify-work <phase>`

**User Acceptance Testing (UAT) dạng hội thoại.** Bạn test, Claude ghi nhận.

**Cách hoạt động:**
1. Đọc SUMMARY.md → trích xuất testable deliverables
2. Trình bày từng test case → bạn trả lời yes/no
3. Test fail → Claude tự động chẩn đoán
4. Tạo fix plan nếu có issues → sẵn sàng re-execute

```
/gsd:verify-work 3
```

**Output:** Cập nhật trực tiếp hoặc tạo gap plans.

#### `/gsd:audit-milestone`

**Audit toàn bộ milestone** trước khi archive — xem đã đạt đúng intent ban đầu chưa.

- Đọc tất cả `VERIFICATION.md` của các phases
- Kiểm tra requirements coverage (REQ-ID mapping)
- Spawn **integration checker** cho cross-phase wiring và E2E flows
- Tạo `MILESTONE-AUDIT.md` với gaps và tech debt

```
/gsd:audit-milestone
```

#### `/gsd:plan-milestone-gaps`

Sau audit, tự động tạo phases mới để lấp gaps.

- Đọc `MILESTONE-AUDIT.md` → nhóm gaps thành phases
- Ưu tiên theo requirement priority (must > should > nice)
- Thêm gap closure phases vào ROADMAP.md
- Sẵn sàng cho `/gsd:plan-phase`

```
/gsd:plan-milestone-gaps
```

---

### 9. Test tự động

#### `/gsd:add-tests <phase> [instructions]`

Sinh unit test và E2E test cho phase đã hoàn thành.

**Cách hoạt động:**
1. Đọc SUMMARY.md, CONTEXT.md, và implementation thực tế
2. **Phân loại** mỗi file thay đổi: TDD (unit) / E2E (browser) / Skip
3. Trình bày test plan → bạn approve
4. Generate tests theo RED-GREEN convention

```
/gsd:add-tests 3
/gsd:add-tests 3 focus on edge cases in pricing module
```

---

### 10. Debug có hệ thống

#### `/gsd:debug [mô tả vấn đề]`

Debug theo **phương pháp khoa học** với state bền vững qua context reset.

**Quy trình:**
1. **Thu thập triệu chứng** — Adaptive questioning
2. **Tạo debug file** — `.planning/debug/[slug].md`
3. **Điều tra** — Evidence → Hypothesis → Test → Repeat
4. **State persists** — File debug sống sót qua `/clear`
5. **Archive** — Resolved issues → `.planning/debug/resolved/`

**Tính năng đặc biệt: sống sót qua `/clear`**

```
/gsd:debug "form submission fails silently"  # Bắt đầu session mới
# ... điều tra, context đầy lên ...
/clear
/gsd:debug                                    # Resume — tự đọc file debug
```

#### Diagnose Issues (nội bộ)

Sau UAT phát hiện gaps, GSD có thể spawn **debug agent song song per gap** để tìm root cause trước khi plan fix. Điều này giúp:

- UAT nói WHAT is broken (triệu chứng)
- Debug agent tìm WHY (root cause)
- Plan-phase `--gaps` tạo targeted fixes dựa trên actual causes, không phải guesswork

---

### 11. Todo — Capture ý tưởng

#### `/gsd:add-todo [mô tả]`

Capture nhanh ý tưởng hoặc task bất chợt.

- Trích xuất context từ conversation hiện tại (hoặc dùng mô tả truyền vào)
- Tạo file todo trong `.planning/todos/pending/`
- Infer area từ file paths để nhóm
- Kiểm tra trùng lặp trước khi tạo
- Cập nhật STATE.md todo count

```
/gsd:add-todo                              # Infer từ conversation context
/gsd:add-todo Fix modal z-index            # Mô tả trực tiếp
/gsd:add-todo Add token refresh to auth    # Cụ thể hơn
```

#### `/gsd:check-todos [area]`

Xem danh sách todo pending, chọn cái để làm.

- Liệt kê tất cả todo: title, area, tuổi (bao lâu rồi)
- Lọc theo area (nếu truyền vào)
- Load full context cho todo được chọn
- Route tới action phù hợp: work now / add to phase / brainstorm
- Move todo sang `done/` khi bắt đầu làm

```
/gsd:check-todos              # Tất cả
/gsd:check-todos api          # Chỉ area "api"
/gsd:check-todos frontend     # Chỉ area "frontend"
```

---

### 12. Quản lý Roadmap

#### `/gsd:add-phase <mô tả>`

Thêm phase mới vào **cuối** milestone hiện tại. Dùng sequential number tiếp theo.

```
/gsd:add-phase "Add admin dashboard"
```

#### `/gsd:insert-phase <sau-số> <mô tả>`

Chèn phase **khẩn cấp** giữa các phase hiện có. Tạo số thập phân (ví dụ: 7.1 giữa 7 và 8).

**Khi nào dùng:** Phát hiện công việc phải xử lý NGAY giữa milestone, không thể chờ tới cuối.

```
/gsd:insert-phase 7 "Fix critical auth bug"
# Kết quả: Phase 7.1 — có thể plan và execute ngay
```

#### `/gsd:remove-phase <số>`

Xóa phase **tương lai** (chưa bắt đầu) và đánh số lại.

- Chỉ hoạt động với phases chưa started
- Xóa thư mục phase và references
- Renumber tất cả phases sau đó
- Git commit giữ lại record lịch sử

```
/gsd:remove-phase 17
# Phase 17 xóa, phases 18-20 → 17-19
```

---

### 13. Quản lý Milestone

#### `/gsd:new-milestone <tên>`

Bắt đầu milestone mới. Flow giống `new-project` nhưng cho project đã tồn tại (có PROJECT.md).

- Deep questioning cho scope milestone mới
- Optional research
- Requirements + roadmap mới

```
/gsd:new-milestone "v2.0 Features"
```

#### `/gsd:complete-milestone <version>`

Hoàn thành và archive milestone.

**Quy trình:**
1. Tạo entry trong `MILESTONES.md` với stats
2. Archive chi tiết vào `milestones/` directory
3. Tạo **git tag** cho release
4. Chuẩn bị workspace cho version tiếp theo

```
/gsd:complete-milestone 1.0.0
```

---

### 14. Theo dõi tiến độ & Session

#### `/gsd:progress`

Kiểm tra trạng thái project và **thông minh route** tới hành động tiếp theo.

- **Progress bar trực quan** + phần trăm hoàn thành
- Tóm tắt recent work từ SUMMARY files
- Hiển thị vị trí hiện tại
- **Smart routing:**
  - Có plan chưa execute → đề xuất execute
  - Phase chưa có plan → đề xuất plan
  - 100% milestone → phát hiện và đề xuất complete

```
/gsd:progress
```

#### `/gsd:resume-work`

Khôi phục full context khi tiếp tục từ session trước.

- Đọc STATE.md + PROJECT.md
- Phát hiện interrupted agent (nếu có) và đề xuất resume
- Hiển thị vị trí + recent progress
- Route tới next actions

**Trigger tự nhiên:** "continue", "what's next", "where were we", "resume"

```
/gsd:resume-work
```

#### `/gsd:pause-work`

Lưu context khi tạm dừng giữa chừng.

- Tạo `.continue-here` file với current state
- Cập nhật STATE.md phần session continuity
- Capture in-progress work context

```
/gsd:pause-work
```

---

### 15. Cấu hình & Tiện ích

#### `/gsd:settings`

Cấu hình tương tác:
- Toggle agents (researcher, plan_checker, verifier)
- Chọn model profile
- Thay đổi workflow mode
- Cập nhật `.planning/config.json`

```
/gsd:settings
```

#### `/gsd:set-profile <profile>`

Chuyển nhanh model profile cho GSD agents.

| Profile | Planning | Execution | Research/Verify | Chi phí |
|---------|----------|-----------|-----------------|---------|
| `quality` | Opus | Opus | Opus | Cao nhất |
| `balanced` | Opus | Sonnet | Sonnet | Trung bình |
| `budget` | Sonnet | Sonnet | Haiku | Thấp nhất |
| `inherit` | Session model | Session model | Session model | Tùy session |

```
/gsd:set-profile quality     # Task quan trọng
/gsd:set-profile balanced    # Phát triển chính (mặc định)
/gsd:set-profile budget      # Khám phá, prototyping
/gsd:set-profile inherit     # Dùng model của session hiện tại (hữu ích cho OpenCode /model)
```

#### `/gsd:health`

Kiểm tra sức khỏe thư mục `.planning/`.

- Detect missing files, invalid config, inconsistent state, orphaned plans
- Status: HEALTHY / DEGRADED / BROKEN
- **Flag `--repair`:** Tự động fix các issues có thể auto-fix

```
/gsd:health             # Chỉ báo cáo
/gsd:health --repair    # Báo cáo + auto-fix
```

#### `/gsd:cleanup`

Archive thư mục phase từ milestone đã hoàn thành.

- Nhận diện phases từ completed milestones còn nằm trong `.planning/phases/`
- Dry-run summary trước khi move
- Move vào `.planning/milestones/v{X.Y}-phases/`

```
/gsd:cleanup
```

#### `/gsd:stats`

Hiển thị **dashboard thống kê project** — nhanh gọn, visual.

- Progress bar trực quan
- Bảng phases (status, plans, tasks)
- Requirements coverage
- Git metrics (commits, branches)
- Timeline (ngày bắt đầu, last activity)

```
/gsd:stats
```

#### `/gsd:validate-phase <số>`

**Retroactive Nyquist validation audit** — kiểm tra test coverage cho phase đã hoàn thành.

- Đọc SUMMARY.md → map requirements to tasks
- Gap analysis: classify requirements (COVERED / PARTIAL / MISSING)
- Spawn **gsd-nyquist-auditor** → generate missing tests
- Tạo/cập nhật `VALIDATION.md`

```
/gsd:validate-phase 3
```

> **Khi nào dùng:** Sau execute-phase, khi muốn đảm bảo test coverage đủ cho requirements.

#### Các lệnh khác

| Lệnh | Mô tả |
|-------|--------|
| `/gsd:help` | Hiển thị bảng tham chiếu lệnh |
| `/gsd:update` | Cập nhật GSD + changelog |
| `/gsd:reapply-patches` | Reapply local modifications sau update |
| `/gsd:join-discord` | Tham gia cộng đồng Discord |

---

## Flags & Tùy chọn nâng cao

Tổng hợp tất cả flags có thể dùng:

| Lệnh | Flag | Tác dụng |
|-------|------|----------|
| `new-project` | `--auto @file.md` | Auto mode: skip hỏi, extract từ document |
| `discuss-phase` | `--batch` | Hỏi 2-5 câu cùng lúc thay vì từng câu |
| `discuss-phase` | `--batch=N` | Fix N câu per batch |
| `discuss-phase` | `--auto` | Claude tự chọn recommended defaults, bỏ qua hỏi đáp |
| `plan-phase` | `--research` | Force chạy researcher |
| `plan-phase` | `--skip-research` | Bỏ qua researcher |
| `plan-phase` | `--skip-verify` | Bỏ qua plan checker |
| `plan-phase` | `--prd <path>` | PRD Express Path: PRD → locked decisions |
| `plan-phase` | `--gaps` | Chỉ plan cho gap closure |
| `execute-phase` | `--gaps-only` | Chỉ execute gap closure plans |
| `autonomous` | `--from N` | Bắt đầu từ phase N thay vì phase chưa hoàn thành đầu tiên |
| `quick` | `--full` | Bật plan checking + verification |
| `quick` | `--discuss` | Lightweight discussion trước planning |
| `quick` | `--research` | Spawn focused research agent trước planning |
| `health` | `--repair` | Auto-fix issues |
| `add-tests` | `<phase> <text>` | Kèm instructions cho test generation |

---

## Cấu trúc thư mục .planning/

```
.planning/
├── PROJECT.md                # Tầm nhìn project, tech stack, key decisions
├── REQUIREMENTS.md           # Requirements có REQ-ID, phân loại v1/v2
├── ROADMAP.md                # Breakdown phases với success criteria
├── STATE.md                  # Bộ nhớ project — "não" của GSD
├── RETROSPECTIVE.md          # Living retrospective (cập nhật mỗi milestone)
├── MILESTONES.md             # Lịch sử milestones đã hoàn thành
├── config.json               # Workflow mode, agent gates, model profile
│
├── research/                 # Domain research (từ new-project)
│   └── SUMMARY.md
│
├── codebase/                 # Codebase map (từ map-codebase)
│   ├── STACK.md
│   ├── ARCHITECTURE.md
│   ├── STRUCTURE.md
│   ├── CONVENTIONS.md
│   ├── TESTING.md
│   ├── INTEGRATIONS.md
│   └── CONCERNS.md
│
├── phases/                   # Thư mục per-phase
│   ├── 01-clone-rebrand/
│   │   ├── CONTEXT.md            # Tầm nhìn (từ discuss-phase)
│   │   ├── RESEARCH.md           # Nghiên cứu (từ research-phase / plan-phase)
│   │   ├── DISCOVERY.md          # Discovery (tự động từ plan-phase)
│   │   ├── 01-01-PLAN.md         # Kế hoạch thực thi
│   │   ├── 01-01-SUMMARY.md      # Tóm tắt sau thực thi
│   │   └── VERIFICATION.md       # Kết quả verify goal
│   ├── 02-backend/
│   │   ├── 02-01-PLAN.md         # Plan 1 (wave 1)
│   │   ├── 02-01-SUMMARY.md
│   │   ├── 02-02-PLAN.md         # Plan 2 (wave 1 hoặc 2)
│   │   └── 02-02-SUMMARY.md
│   └── 05.1-hotfix/              # Phase chèn (decimal)
│       ├── 05.1-01-PLAN.md
│       └── 05.1-01-SUMMARY.md
│
├── quick/                    # Quick tasks (ad-hoc)
│   ├── 001-fix-dropdown/
│   │   ├── PLAN.md
│   │   └── SUMMARY.md
│   └── 002-add-retry/
│       ├── PLAN.md
│       └── SUMMARY.md
│
├── todos/                    # Captured ideas
│   ├── pending/
│   │   └── fix-modal-z-index.md
│   └── done/
│       └── add-dark-mode.md
│
├── debug/                    # Debug sessions
│   ├── form-submit-silent.md     # Active session
│   └── resolved/
│       └── login-button-crash.md # Archived
│
└── milestones/               # Archived milestones
    ├── v1.0-ROADMAP.md
    ├── v1.0-REQUIREMENTS.md
    └── v1.0-phases/
        ├── 01-foundation/
        └── 02-core-features/
```

---

## Pipeline nội bộ chi tiết

### Khi bạn gõ `/gsd:plan-phase 3`:

```
1. Init         → Đọc config.json, xác định models, flags, existing artifacts
2. Validate     → Phase tồn tại trong ROADMAP.md? Thư mục có chưa?
3. PRD check    → Nếu có --prd flag → tạo CONTEXT.md từ PRD, bỏ qua discuss
4. Discovery    → Tự quyết định depth (verify/standard/deep):
                   Level 1: Chỉ xác nhận syntax → không tạo file
                   Level 2: So sánh options → tạo DISCOVERY.md
                   Level 3: Deep dive → DISCOVERY.md chi tiết + validation gates
5. Research     → Spawn gsd-phase-researcher nếu cần → RESEARCH.md
6. Planning     → Spawn gsd-planner → XX-YY-PLAN.md
7. Checking     → Spawn gsd-plan-checker → goal-backward analysis
8. Revision     → Nếu checker reject → quay lại planner (max 3 lần)
9. Done         → PLAN.md sẵn sàng cho execute
```

### Khi bạn gõ `/gsd:execute-phase 3`:

```
1. Init         → Đọc plans, tìm incomplete plans (chưa có SUMMARY)
2. Branch       → Tạo branch nếu config branching != "none"
3. Wave group   → Plans nhóm theo wave number từ frontmatter
4. Execute      → Mỗi wave:
                   ├── Plans song song (nếu parallelization: true)
                   ├── Mỗi plan → spawn gsd-executor
                   ├── Executor: đọc plan → code → test → atomic commit
                   └── Tạo SUMMARY.md per plan
5. Verify       → Spawn gsd-verifier → goal-backward analysis
                   ├── What must be TRUE?
                   ├── What must EXIST?
                   └── What must be WIRED?
6. Update       → Cập nhật REQUIREMENTS.md, ROADMAP.md, STATE.md
7. Report       → VERIFICATION.md với kết quả
```

### Khi bạn gõ `/gsd:verify-work 3`:

```
1. Extract      → Đọc SUMMARY.md → testable deliverables
2. Present      → Từng test case, bạn trả lời yes/no
3. Diagnose     → Test fail → chẩn đoán (optional: spawn debug agents song song)
4. Fix plan     → Gaps → /gsd:plan-phase --gaps → targeted fixes
5. Re-execute   → /gsd:execute-phase --gaps-only
```

---

## Workflow phổ biến (có giải thích)

### A. Project mới từ đầu (Greenfield)

```
/gsd:new-project
```

Claude hỏi bạn về ý tưởng, scope, tech preferences. Cuối cùng tạo ra toàn bộ planning infrastructure. **Đây là khoảnh khắc leverage cao nhất** — đầu tư thời gian trả lời kỹ ở đây sẽ tiết kiệm rất nhiều thời gian sau.

```
/clear
/gsd:discuss-phase 1
```

Truyền đạt tầm nhìn cụ thể. Nếu bạn không có ý kiến đặc biệt, có thể skip bước này.

```
/clear
/gsd:plan-phase 1
```

Claude tự nghiên cứu, lên plan, tự kiểm tra plan. Bạn review PLAN.md.

```
/clear
/gsd:execute-phase 1
```

Agent thực thi code, commit, verify.

```
/clear
/gsd:verify-work 1
```

Bạn test thủ công, báo pass/fail. Claude fix nếu cần.

### B. Project đã có code (Brownfield)

```
/gsd:map-codebase        # Hiểu codebase trước
/clear
/gsd:new-project         # Lên kế hoạch dựa trên hiểu biết
```

`map-codebase` tạo 7 tài liệu phân tích. `new-project` đọc chúng để hiểu context.

### C. Tiếp tục sau khi nghỉ

```
/gsd:resume-work         # Full context restoration
# hoặc
/gsd:progress            # Xem tổng quan + smart routing
```

Cả hai đều đọc STATE.md. `progress` compact hơn, `resume-work` chi tiết hơn.

### D. Tạm dừng an toàn

```
/gsd:pause-work          # Lưu state + .continue-here
# ... nghỉ ...
/gsd:resume-work         # Tiếp tục chính xác
```

### E. Task nhỏ xen giữa phases

```
/gsd:quick Fix the z-index issue on dropdown
```

Nhanh, gọn, vẫn có commit message chuẩn và STATE.md tracking.

### F. Phát hiện bug giữa chừng

```
/gsd:debug "login button doesn't respond on mobile"
# Claude điều tra...
/clear                   # Context đầy
/gsd:debug               # Resume ngay
```

### G. Công việc khẩn cấp giữa milestone

```
/gsd:insert-phase 5 "Critical security patch"
/clear
/gsd:plan-phase 5.1
/clear
/gsd:execute-phase 5.1
```

### H. Hoàn thành milestone

```
/gsd:audit-milestone                   # Audit trước
/gsd:plan-milestone-gaps               # Plan fix nếu có gaps
# Execute gap phases...
/gsd:complete-milestone 1.0.0          # Archive + git tag
/clear
/gsd:new-milestone "v2.0 Features"     # Bắt đầu milestone mới
```

### I. Dùng PRD có sẵn

```
/gsd:plan-phase 5 --prd ./specs/data-entities.md
```

Skip discuss-phase hoàn toàn. Mọi thứ trong PRD trở thành locked decisions.

### J. Tự động hoàn toàn (new-project)

```
/gsd:new-project --auto @project-idea.md
```

Skip hỏi đáp, auto-approve requirements và roadmap. Dùng khi bạn đã có document mô tả rõ ràng.

### K. Autonomous — chạy tất cả phases

```
/gsd:autonomous                  # Từ phase chưa xong đầu tiên
/gsd:autonomous --from 3         # Từ phase 3
```

GSD tự discuss → plan → execute → verify mỗi phase. Dừng khi gặp blocker hoặc hết phases.

### L. UI Design workflow

```
/gsd:discuss-phase 3             # Clarify tầm nhìn UI
/clear
/gsd:ui-phase 3                  # Tạo UI-SPEC.md
/clear
/gsd:plan-phase 3                # Plan đọc UI-SPEC.md
/clear
/gsd:execute-phase 3             # Implement
/clear
/gsd:ui-review 3                 # 6-pillar visual audit
```

### M. Quick task với full quality

```
/gsd:quick --discuss --research --full Add JWT refresh token
```

Composable flags: discussion + research + plan checking + verification. Chất lượng ngang phase nhưng cho single task.

---

## Chế độ hoạt động

### Interactive Mode

- Xác nhận mỗi quyết định lớn
- Tạm dừng tại checkpoints để phê duyệt
- Hướng dẫn nhiều hơn
- **Phù hợp:** Lần đầu dùng GSD, project quan trọng, cần kiểm soát

### YOLO Mode

- Tự động phê duyệt hầu hết quyết định
- Thực thi plans không hỏi
- Chỉ dừng tại critical checkpoints
- **Phù hợp:** Quen GSD rồi, project cá nhân, muốn tốc độ

**Thay đổi bất kỳ lúc nào:**

```
/gsd:settings
# hoặc sửa trực tiếp .planning/config.json
```

---

## Cấu hình config.json

File `.planning/config.json` — "não" cấu hình của GSD:

```json
{
  "mode": "yolo",
  "depth": "comprehensive",
  "parallelization": true,
  "commit_docs": true,
  "model_profile": "quality",
  "workflow": {
    "research": true,
    "plan_check": true,
    "verifier": true
  }
}
```

### Bảng tùy chọn đầy đủ

| Key | Giá trị | Mô tả |
|-----|---------|--------|
| `mode` | `interactive` / `yolo` | Chế độ xác nhận quyết định |
| `depth` | `comprehensive` / `standard` | Mức độ chi tiết trong planning |
| `parallelization` | `true` / `false` | Plans trong cùng wave chạy song song? |
| `commit_docs` | `true` / `false` | Planning files commit vào git? |
| `model_profile` | `quality` / `balanced` / `budget` / `inherit` | Model AI profile cho agents |
| `workflow.research` | `true` / `false` | Bật/tắt researcher agent |
| `workflow.plan_check` | `true` / `false` | Bật/tắt plan checker agent |
| `workflow.verifier` | `true` / `false` | Bật/tắt verifier agent |
| `branching_strategy` | `none` / `phase` / `milestone` | Chiến lược git branching |

### Planning files private (không commit vào git)

```json
{
  "planning": {
    "commit_docs": false,
    "search_gitignored": true
  }
}
```

Khi `commit_docs: false`:
- Thêm `.planning/` vào `.gitignore`
- Hữu ích cho: OSS contributions, client projects, giữ planning private
- `search_gitignored: true` — để ripgrep vẫn search được trong `.planning/`

---

## Tips & Best Practices

### 1. `/clear` là bạn thân

Context window có giới hạn. GSD lưu MỌI THỨ vào file — bạn không mất gì khi `/clear`. Ngược lại, context gọn = Claude suy nghĩ tốt hơn.

**Rule of thumb:** `/clear` sau mỗi lệnh GSD lớn (new-project, plan-phase, execute-phase).

### 2. `discuss-phase` — đầu tư sớm, tiết kiệm sau

Nếu bạn có bất kỳ ý kiến cụ thể nào về phase (layout, behavior, look/feel), `discuss-phase` là nơi truyền đạt. Decisions ở đây cascade xuống toàn bộ pipeline.

### 3. `list-phase-assumptions` — phản biện rẻ nhất

Trước khi Claude plan (tốn token), xem nó định làm gì. Sửa hiểu lầm lúc này rẻ hơn 10x so với sửa code.

### 4. Chọn profile phù hợp task

| Tình huống | Profile |
|------------|---------|
| Khám phá, thử nghiệm | `budget` |
| Development hàng ngày | `balanced` |
| Feature quan trọng, architectural decisions | `quality` |
| Dùng model đã chọn trong OpenCode | `inherit` |

Chuyển nhanh: `/gsd:set-profile budget`

### 5. `quick` cho 80% công việc nhỏ

Không phải mọi thứ cần full pipeline 5 agent. Bug fix, thêm field, sửa style — `/gsd:quick` là đủ.

### 6. Debug session = persistent

Khác mọi conversation khác, `/gsd:debug` sống sót qua `/clear`. Debug → clear → resume → tiếp tục điều tra. Không mất context.

### 7. Todo = inbox của developer

Đang code mà nghĩ ra cái cần làm? `/gsd:add-todo` ngay. Quay lại khi rảnh: `/gsd:check-todos`. Đừng để ý tưởng bay mất.

### 8. Audit trước khi complete

Luôn `/gsd:audit-milestone` trước `/gsd:complete-milestone`. Audit phát hiện gaps mà verify-work từng phase có thể miss (cross-phase wiring, integration issues).

### 9. Brownfield: map → plan → execute

Đừng new-project trên codebase có sẵn mà không map trước. `map-codebase` cho Claude biết convention, patterns, và concerns — plan sẽ chất lượng hơn rất nhiều.

### 10. `--prd` khi đã có spec rõ ràng

Có PRD/spec chi tiết? Đừng lãng phí thời gian `discuss-phase`. Dùng `--prd` để biến spec thành locked decisions ngay.
