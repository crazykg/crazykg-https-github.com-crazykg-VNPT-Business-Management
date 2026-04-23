<!-- gitnexus:start -->
# GitNexus — Code Intelligence

This project is indexed by GitNexus as **QLCV** (12998 symbols, 35527 relationships, 300 execution flows). Use the GitNexus MCP tools to understand code, assess impact, and navigate safely.

> If any GitNexus tool warns the index is stale, run `npx gitnexus analyze` in terminal first.

## Always Do

- **MUST run impact analysis before editing any symbol.** Before modifying a function, class, or method, run `gitnexus_impact({target: "symbolName", direction: "upstream"})` and report the blast radius (direct callers, affected processes, risk level) to the user.
- **MUST run `gitnexus_detect_changes()` before committing** to verify your changes only affect expected symbols and execution flows.
- **MUST warn the user** if impact analysis returns HIGH or CRITICAL risk before proceeding with edits.
- When exploring unfamiliar code, use `gitnexus_query({query: "concept"})` to find execution flows instead of grepping. It returns process-grouped results ranked by relevance.
- When you need full context on a specific symbol — callers, callees, which execution flows it participates in — use `gitnexus_context({name: "symbolName"})`.

## When Debugging

1. `gitnexus_query({query: "<error or symptom>"})` — find execution flows related to the issue
2. `gitnexus_context({name: "<suspect function>"})` — see all callers, callees, and process participation
3. `READ gitnexus://repo/QLCV/process/{processName}` — trace the full execution flow step by step
4. For regressions: `gitnexus_detect_changes({scope: "compare", base_ref: "main"})` — see what your branch changed

## When Refactoring

- **Renaming**: MUST use `gitnexus_rename({symbol_name: "old", new_name: "new", dry_run: true})` first. Review the preview — graph edits are safe, text_search edits need manual review. Then run with `dry_run: false`.
- **Extracting/Splitting**: MUST run `gitnexus_context({name: "target"})` to see all incoming/outgoing refs, then `gitnexus_impact({target: "target", direction: "upstream"})` to find all external callers before moving code.
- After any refactor: run `gitnexus_detect_changes({scope: "all"})` to verify only expected files changed.

## Never Do

- NEVER edit a function, class, or method without first running `gitnexus_impact` on it.
- NEVER ignore HIGH or CRITICAL risk warnings from impact analysis.
- NEVER rename symbols with find-and-replace — use `gitnexus_rename` which understands the call graph.
- NEVER commit changes without running `gitnexus_detect_changes()` to check affected scope.

## Tools Quick Reference

| Tool | When to use | Command |
|------|-------------|---------|
| `query` | Find code by concept | `gitnexus_query({query: "auth validation"})` |
| `context` | 360-degree view of one symbol | `gitnexus_context({name: "validateUser"})` |
| `impact` | Blast radius before editing | `gitnexus_impact({target: "X", direction: "upstream"})` |
| `detect_changes` | Pre-commit scope check | `gitnexus_detect_changes({scope: "staged"})` |
| `rename` | Safe multi-file rename | `gitnexus_rename({symbol_name: "old", new_name: "new", dry_run: true})` |
| `cypher` | Custom graph queries | `gitnexus_cypher({query: "MATCH ..."})` |

## Impact Risk Levels

| Depth | Meaning | Action |
|-------|---------|--------|
| d=1 | WILL BREAK — direct callers/importers | MUST update these |
| d=2 | LIKELY AFFECTED — indirect deps | Should test |
| d=3 | MAY NEED TESTING — transitive | Test if critical path |

## Resources

| Resource | Use for |
|----------|---------|
| `gitnexus://repo/QLCV/context` | Codebase overview, check index freshness |
| `gitnexus://repo/QLCV/clusters` | All functional areas |
| `gitnexus://repo/QLCV/processes` | All execution flows |
| `gitnexus://repo/QLCV/process/{name}` | Step-by-step execution trace |

## Self-Check Before Finishing

Before completing any code modification task, verify:
1. `gitnexus_impact` was run for all modified symbols
2. No HIGH/CRITICAL risk warnings were ignored
3. `gitnexus_detect_changes()` confirms changes match expected scope
4. All d=1 (WILL BREAK) dependents were updated

## Keeping the Index Fresh

After committing code changes, the GitNexus index becomes stale. Re-run analyze to update it:

```bash
npx gitnexus analyze
```

If the index previously included embeddings, preserve them by adding `--embeddings`:

```bash
npx gitnexus analyze --embeddings
```

To check whether embeddings exist, inspect `.gitnexus/meta.json` — the `stats.embeddings` field shows the count (0 means no embeddings). **Running analyze without `--embeddings` will delete any previously generated embeddings.**

> Claude Code users: A PostToolUse hook handles this automatically after `git commit` and `git merge`.

## CLI

| Task | Read this skill file |
|------|---------------------|
| Understand architecture / "How does X work?" | `.claude/skills/gitnexus/gitnexus-exploring/SKILL.md` |
| Blast radius / "What breaks if I change X?" | `.claude/skills/gitnexus/gitnexus-impact-analysis/SKILL.md` |
| Trace bugs / "Why is X failing?" | `.claude/skills/gitnexus/gitnexus-debugging/SKILL.md` |
| Rename / extract / split / refactor | `.claude/skills/gitnexus/gitnexus-refactoring/SKILL.md` |
| Tools, resources, schema reference | `.claude/skills/gitnexus/gitnexus-guide/SKILL.md` |
| Index, status, clean, wiki CLI commands | `.claude/skills/gitnexus/gitnexus-cli/SKILL.md` |

<!-- gitnexus:end -->

# Codex Repo Guide

This section complements the GitNexus rules above. Keep the GitNexus block intact and treat both sections as active instructions for this repo.

## Project Overview

- Tên dự án: `VNPT Business Management` / `QLCV`
- Mục tiêu: hệ thống CRM/ERP nội bộ để quản lý hợp đồng, dự án, báo giá sản phẩm, Customer Request Workflow (CRC), thu cước, doanh thu và dữ liệu master
- Stack chính:
  - Frontend: `React 19` + `Vite 6` + `TypeScript` + `TailwindCSS` + `React Query` + `Zustand`
  - Backend: `Laravel 12` + `PHP 8.2` + `Laravel Sanctum` + `Redis`
  - Database: `MySQL` là DB chính; `SQLite` chỉ là fallback/test option trong cấu hình Laravel
  - Testing: `Vitest`, `Playwright`, `PHPUnit`
- Phần quan trọng nhất trong repo:
  - `frontend/`
  - `backend/`
  - `database/`
  - `docs/`
  - `perf/`
  - `testcases/`

## Setup

- Repo tách thành 2 app độc lập; luôn chạy lệnh trong đúng thư mục con
- Cài dependencies:
  - `cd frontend && npm install`
  - `cd backend && composer install`
  - `cd backend && npm install`
- Chuẩn bị env:
  - `cd frontend && cp .env.example .env.local`
  - `cd backend && cp .env.example .env`
  - `cd backend && php artisan key:generate`
- Database:
  - `cd backend && php artisan migrate`
- Chạy local:
  - `cd frontend && npm run dev`
  - `cd backend && php artisan serve --host=127.0.0.1 --port=8002`
  - hoặc `cd backend && composer dev` khi cần server + queue + logs + vite cùng lúc
- Build:
  - `cd frontend && npm run build`
  - `cd backend && npm run build`
- Test:
  - `cd frontend && npm run test`
  - `cd backend && php artisan test`
  - `cd backend && composer test`

## Architecture

- `frontend/`: SPA chính, tập trung ở `components/`, `hooks/`, `services/`, `types/`, `__tests__/`, `e2e/`
- `backend/`: Laravel API + business logic, trọng tâm ở `app/Services/V5/Domain/`, `app/Http/`, `routes/`, `tests/Feature/`
- `backend/database/`: migrations, seeders, factories của Laravel
- `database/sql-patches/`: SQL patch forward-only và artifact phục vụ release/manual DB sync
- `docs/`: tài liệu nghiệp vụ theo domain như `crc`, `products`, `contracts`, `projects`, `fee-collection`, `revenue-mgmt`
- `perf/`: smoke/load scenarios cho API
- `testcases/`: manual test case và tài liệu kiểm thử

## Coding Rules

- Không tự ý đổi tên symbol lớn nếu chưa đánh giá impact; với symbol code thì tuân thủ rule GitNexus ở đầu file
- Ưu tiên sửa tối thiểu, đúng phạm vi yêu cầu
- Không tạo file mới nếu có thể tái sử dụng cấu trúc cũ
- Giữ style theo code hiện có của dự án
- Chỉ thêm comment khi thực sự cần giải thích logic khó
- Không đổi contract API hoặc response shape nếu chưa kiểm tra caller phía frontend/backend liên quan
- Nếu thay đổi schema, phải kiểm tra cả migration Laravel và nhu cầu cập nhật `database/sql-patches/` khi task liên quan release/DB patch

## Workflow Rules

- Khi tạo chức năng mới, màn hình mới, API mới, service mới hoặc module mới:
  - mặc định phải đọc lại `AGENTS.md` trước khi bắt đầu implement
  - coi `AGENTS.md` là entrypoint và source of truth mặc định cho workflow tạo mới
  - nếu task có UI, tiếp tục áp dụng đầy đủ section `UI Rule (Embedded)` trong chính `AGENTS.md`
  - nếu có tài liệu khác, chỉ dùng như tài liệu bổ sung sau khi đã đối chiếu với `AGENTS.md`
- Trước khi sửa code:
  - đọc file liên quan
  - xác định entrypoint và phạm vi ảnh hưởng
  - nếu sửa symbol code, chạy impact analysis theo GitNexus rule ở trên
- Sau khi sửa:
  - chạy test/lint/build phù hợp với đúng scope
  - báo rõ file nào đã đổi
  - nêu phần chưa verify được nếu có
  - nếu có migration, nói rõ người chạy local/prod cần migrate gì
- Với UI:
  - bắt buộc đọc section `UI Rule (Embedded)` trong chính `AGENTS.md` trước khi sửa UI
  - không cần đọc thêm `plan-code/UI-Rule.md` trong workflow UI thường ngày
  - bắt buộc đối chiếu lại với section `UI Rule (Embedded)` sau khi sửa xong
  - kiểm tra desktop + mobile
  - không phá vỡ layout cũ ngoài phạm vi task
- Với flow đi qua nhiều lớp:
  - ưu tiên verify đủ `frontend + backend + database` nếu thay đổi chạm qua cả ba lớp

## UI Standard Policy

- `AGENTS.md` là entrypoint duy nhất cho workflow của repo này.
- Khi tạo chức năng mới, mặc định quay về `AGENTS.md` trước rồi mới đọc thêm tài liệu khác nếu cần.
- Với task UI, source of truth nằm trong section `UI Rule (Embedded)` của chính `AGENTS.md`.
- Không dùng tài liệu ngoài repo làm source of truth cho UI trong workflow thường ngày.
- Không yêu cầu đọc thêm `plan-code/UI-Rule.md` nếu section `UI Rule (Embedded)` đã có mặt trong `AGENTS.md`.
- Khi task liên quan UI, AI phải đọc ít nhất các phần sau trong section `UI Rule (Embedded)` trước khi code:
  - `Global CSS Variables`
  - `Typography Standard`
  - `Modal / Dialog / Drawer`
  - `Accessibility — WCAG 2.2`
  - `Responsive Standard`
  - `Danh sách AI phải làm trước khi kết thúc task UI`

## UI Coding Rules

- CRUD/admin UI phải bám theo design language của `integration-settings` về màu, bố cục, surface layering, nav rail, toolbar density và shell layout.
- Ưu tiên dùng token repo và global CSS variables `--ui-*` theo section `UI Rule (Embedded)`; không hardcode hex, font-family, z-index, spacing, radius, shadow nếu đã có token hoặc var phù hợp.
- Khi cần mở rộng token toàn cục, phải theo naming convention `--ui-*`, không tạo hệ đặt tên khác.
- Typography phải theo role trong section `UI Rule (Embedded)`; không trộn tuỳ tiện font-size/font-weight giữa menu, label, button, dropdown và input.
- Button, input, select, search, table, card, toast, tooltip, badge, empty state, navigation và modal phải cùng sizing language theo section `UI Rule (Embedded)`.
- Không tạo class ad-hoc cho button, modal shell, sticky footer nếu shared primitive đã cover use case.
- Không được sinh thêm `view-helper`, `render-helper`, `ui-helper` hoặc wrapper hiển thị chỉ để bọc vài dòng JSX/className mà không giảm lặp thực sự.
- Không tạo helper gây dư thừa lớp hiển thị, thêm node DOM không cần thiết, hoặc làm UI khó trace/chỉnh sửa hơn.
- Chỉ được tách helper UI khi nó thật sự:
  - chuẩn hoá primitive dùng chung
  - giảm lặp rõ ràng ở nhiều nơi
  - hoặc cô lập một khối render có ý nghĩa nghiệp vụ/giao diện rõ ràng
- Nếu shared primitive chưa có, vẫn phải code đúng spec trong section `UI Rule (Embedded)`, không được “tạm làm khác”.
- Với layout CRUD/admin dạng cấu hình, form dài hoặc editor, ưu tiên pattern:
  - page wrapper
  - compact header
  - main shell
  - rail hoặc toolbar nếu có
  - content pane
  - info strip hoặc sticky footer

## Modal and Overlay Policy

- Mọi modal/dialog/drawer mới hoặc được sửa phải tuân thủ phần `Modal / Dialog / Drawer` trong section `UI Rule (Embedded)`.
- Modal phải có:
  - variant kích thước rõ ràng
  - backdrop chuẩn
  - panel max-height hợp lý
  - body scroll nội bộ nếu dài
  - header/footer rõ ràng
  - sticky footer khi CTA quan trọng
  - `role="dialog"`
  - `aria-modal="true"`
  - focus trap
- Không để page scroll nền chạy sai khi modal chặn tương tác đang mở.
- Mobile modal dài ưu tiên bottom sheet hoặc full-screen sheet; không giữ modal desktop nhỏ ở giữa màn hình mobile.
- Không tự nghĩ ra hành vi đóng modal khác chuẩn nếu không có lý do rõ ràng; mọi ngoại lệ phải báo trong kết quả cuối.

## UI Verification Policy

- Sau mọi thay đổi UI, AI phải tự đối chiếu lại với section `UI Rule (Embedded)` thay vì chỉ nhìn “thấy ổn”.
- Checklist đối chiếu tối thiểu:
  - token màu, spacing, radius, shadow, z-index đúng chuẩn
  - typography role đúng chuẩn
  - button/input/select/dropdown/modal cùng sizing language
  - modal/dialog semantics đúng
  - responsive đúng ở mobile và desktop
  - accessibility cơ bản gồm keyboard, focus, aria-label, error announcement nếu có
- Khi sửa frontend UI code, mặc định chạy `cd frontend && npm run lint` nếu không có lý do rõ ràng để bỏ qua.
- Nếu chưa verify được responsive, accessibility, hoặc modal behavior, phải nói rõ trong báo cáo cuối.

## Do

- Ưu tiên solution đơn giản, dễ maintain
- Giữ tương thích với code hiện tại
- Báo risk nếu thay đổi có thể ảnh hưởng nhiều nơi
- Ưu tiên targeted test gần với phạm vi sửa trước khi nghĩ tới full suite
- Khi sửa bug, cố gắng truy ra nguyên nhân gốc rồi mới vá

## Don’t

- Không dùng lệnh phá huỷ như reset cứng
- Không revert thay đổi của người khác nếu chưa được yêu cầu
- Không refactor lan rộng khi user chỉ yêu cầu fix nhỏ
- Không chỉnh sửa dump/patch SQL cũ ngoài phạm vi task release hoặc DB sync rõ ràng

## Testing

- Frontend:
  - `cd frontend && npm run test`
- Type check:
  - `cd frontend && npm run lint`
- Frontend build:
  - `cd frontend && npm run build`
- Backend:
  - `cd backend && php artisan test`
  - `cd backend && composer test`

## Definition of Done

- Code chạy được trong phạm vi bị sửa
- Không có lỗi syntax/type ở phần bị sửa
- Đã verify bằng test/build phù hợp
- Nếu có migration hoặc bước manual, đã nêu rõ
- Báo rõ kết quả và giới hạn xác minh

## Module Notes

### Customer Request

- File frontend chính: `frontend/components/customer-request/*`
- Hub lớn: `frontend/components/CustomerRequestManagementHub.tsx`
- Khi sửa flow trạng thái, phải kiểm tra cả UI + API + dữ liệu hiển thị
- Không đổi workflow/status contract nếu chưa rà caller và registry tương ứng ở backend

### Product Quotation

- File frontend chính: `frontend/components/ProductQuotationTab.tsx`
- Backend chính: `backend/app/Services/V5/Domain/ProductQuotationDomainService.php`
- Export/in ấn: `backend/app/Services/V5/Domain/ProductQuotationExportService.php`
- Khi sửa product/package selection, phải verify cả lưu draft, version history, export và print

### Auth

- Không đổi contract response nếu chưa kiểm tra caller
- Kiểm tra tác động tới `frontend/services/v5Api.ts`, auth refresh, tab eviction và các util phân quyền trước khi sửa

## Output Expectations

- Trả lời ngắn gọn
- Nêu rõ:
  - đã sửa gì
  - verify bằng gì
  - còn rủi ro gì


## UI Rule (Embedded)

- Section này là bản sync trực tiếp từ `plan-code/UI-Rule.md` để AI chỉ cần đọc `AGENTS.md` trong workflow thường ngày.
- Khi làm UI, ưu tiên đọc section này trong `AGENTS.md`; không cần đọc thêm file UI rule riêng nếu không có yêu cầu đặc biệt.
- Nếu trong section bên dưới có nhắc tới tài liệu nguồn hoặc file tham chiếu, đó chỉ là provenance; không phải yêu cầu đọc thêm trong workflow UI hằng ngày.

## Mục đích

Tài liệu này là **bộ quy tắc thiết kế UI chuẩn** cho QLCV để mọi AI coder và mọi lập trình viên tham gia cùng code theo một chuẩn thống nhất.

Áp dụng mặc định cho:

- menu, sidebar, tab, toolbar
- form, input, search, select, dropdown
- modal, drawer, sticky footer
- table, data grid, card, empty state
- toast, tooltip, badge, trạng thái UI
- các màn CRUD/admin UI và các màn nghiệp vụ nội bộ

Không áp dụng cứng cho:

- dashboard hero hoặc data-visual storytelling
- print/export template
- landing/marketing page

Nếu một màn cần ngoại lệ, phải ghi rõ lý do trong phần báo cáo cuối hoặc trong tài liệu thiết kế tương ứng.

## Nguồn chuẩn

Section UI này đã được sync vào `AGENTS.md` để dùng như nguồn chuẩn duy nhất trong workflow UI hằng ngày.

Thứ tự ưu tiên khi có mâu thuẫn:

1. Quy tắc trong section `UI Rule (Embedded)` của `AGENTS.md`
2. Các primitive, token và component hiện có nếu chúng đã tuân thủ section này

Nguyên tắc áp dụng:

- `integration-settings` chỉ là nguồn gốc design language đã được hấp thụ vào rule này; không yêu cầu đọc lại file gốc trong workflow thường ngày.
- Không dùng `plan-code/UI-Rule.md`, `docs/ui-redesign.md` hay tài liệu ngoài repo làm source of truth khi section này đã có trong `AGENTS.md`.
- Nếu cần mở rộng rule UI, cập nhật trực tiếp trong `AGENTS.md` để giữ một nguồn duy nhất.

## Quy tắc bắt buộc

- Mọi UI mới hoặc UI được sửa phải tuân thủ tài liệu này.
- Không được tự nghĩ thêm một design language riêng cho từng màn.
- Không được hardcode màu, z-index, font-family, spacing, radius, shadow khi repo đã có token hoặc pattern tương ứng.
- Không được tạo class ad-hoc cho button, modal shell, sticky footer nếu shared primitive đã cover use case.
- Khi chưa có primitive chung hoàn chỉnh, phải code **mô phỏng đúng spec trong file này**, không được “tạm làm khác”.
- Mọi thay đổi UI phải tự kiểm tra responsive và accessibility trước khi coi là hoàn thành.

## Design Tokens

### Global CSS Variables

Mọi màn CRUD/admin mới hoặc được sửa phải lấy style nền từ `integration-settings` và khai báo các biến toàn cục theo ngôn ngữ dưới đây trong `frontend/index.css` hoặc file theme gốc tương đương.

```css
:root {
  --ui-font-family: var(--dashboard-font);
  --ui-page-bg: var(--dashboard-bg);              /* #F9F9FF */
  --ui-surface-bg: #FFFFFF;
  --ui-surface-subtle: #F8FAFC;
  --ui-surface-subtle-tint: rgba(248, 250, 252, 0.60);
  --ui-border: #E2E8F0;
  --ui-border-soft: #F1F5F9;
  --ui-text-title: #003F7A;
  --ui-text-default: #334155;
  --ui-text-muted: #64748B;
  --ui-text-subtle: #94A3B8;
  --ui-accent: #00AEEF;
  --ui-accent-soft: rgba(0, 174, 239, 0.10);
  --ui-primary: #004481;
  --ui-primary-hover: #003F7A;
  --ui-success-bg: #D1FAE5;
  --ui-success-fg: #047857;
  --ui-danger-bg: #FEE2E2;
  --ui-danger-fg: #B91C1C;
  --ui-neutral-badge-bg: #E2E8F0;
  --ui-neutral-badge-fg: #64748B;

  --ui-page-padding: 12px;
  --ui-page-padding-bottom: 24px;
  --ui-shell-radius: 8px;
  --ui-control-radius: 6px;
  --ui-pill-radius: 9999px;
  --ui-nav-rail-width: 176px;
  --ui-toolbar-padding-x: 16px;
  --ui-toolbar-padding-y: 8px;
  --ui-section-padding: 16px;
  --ui-grid-gap-x: 16px;
  --ui-grid-gap-y: 12px;
  --ui-shell-min-height: 460px;
  --ui-shadow-shell: 0 1px 2px rgba(15, 23, 42, 0.06);
  --ui-modal-backdrop: rgba(15, 23, 42, 0.45);
  --ui-modal-max-height: min(90vh, calc(100dvh - 32px));
  --ui-modal-radius: 16px;
  --ui-modal-header-min-height: 48px;
  --ui-modal-footer-min-height: 56px;
  --ui-modal-footer-gap: 8px;
  --ui-modal-mobile-radius: 20px;
}
```

Quy tắc:

- Không hardcode lại các giá trị trên trong từng component nếu đã có global var tương ứng.
- Component mới phải ưu tiên dùng semantic var hoặc utility map từ các var này.
- Nếu cần mở rộng token, phải thêm theo cùng naming convention `--ui-*`, không tạo hệ đặt tên khác.
- Màu, khoảng cách và shell layout của CRUD/admin phải suy ra từ bộ var này trước khi được phép tạo ngoại lệ.

### Typography

- Font mặc định dùng `var(--dashboard-font)` hoặc `font-sans`.
- Stack chuẩn:
  - `sans-serif`
  - `system-ui`
  - `-apple-system`
  - `BlinkMacSystemFont`
  - `"Segoe UI"`
  - `Roboto`
  - `"Helvetica Neue"`
  - `Arial`
- Chỉ cho `font-mono` với dữ liệu kỹ thuật như mã, ID, hash, JSON, token preview.
- Không dùng `font-serif` trong CRUD/admin UI thao tác thường ngày.
- Không dùng quá `2` font family trong cùng một sản phẩm. Với QLCV, mặc định chỉ dùng:
  - sans stack chuẩn
  - `font-mono` cho code-like data

### Color

Chuẩn màu của CRUD/admin phải bám theo style `integration-settings`, nghĩa là dùng nền sáng rất nhẹ, panel trắng, viền xám lạnh mảnh, accent xanh cyan cho trạng thái active và CTA chính dùng xanh đậm của thương hiệu.

Mapping chuẩn:

| Vai trò | Token / Var chuẩn | Giá trị chuẩn | Cách dùng |
|---------|-------------------|---------------|-----------|
| Page background | `surface` / `--ui-page-bg` | `#F9F9FF` | canvas toàn trang |
| Main shell / card nền chính | `surface-container-lowest` / `--ui-surface-bg` | `#FFFFFF` | card lớn, content pane, modal panel |
| Subtle surface | `surface-low` / `--ui-surface-subtle` | `#F8FAFC` | nav rail, info strip, disabled read-only block |
| Subtle tint surface | `--ui-surface-subtle-tint` | `rgba(248,250,252,0.60)` | nền rail nhẹ kiểu `integration-settings` |
| Main border | `outline-variant` + neutral border / `--ui-border` | `#E2E8F0` | shell border, divider chính |
| Soft border | `--ui-border-soft` | `#F1F5F9` | toolbar divider, section separator mảnh |
| Title text | `deep-teal` / `--ui-text-title` | `#003F7A` | page title, active nav text mạnh |
| Default text | `on-surface` / `--ui-text-default` | `#334155` | toolbar text, body label mạnh |
| Muted text | `on-surface-variant` / `--ui-text-muted` | `#64748B` | helper, meta, phụ đề |
| Subtle text | `--ui-text-subtle` | `#94A3B8` | caption nhỏ, nav sublabel, placeholder phụ |
| Active accent | `secondary` / `--ui-accent` | `#00AEEF` | icon active, rail border active, trạng thái sáng |
| Active accent soft | `--ui-accent-soft` | `rgba(0,174,239,0.10)` | active nav background, selection tint |
| Primary CTA | `primary` / `--ui-primary` | `#004481` | nút lưu/chính |
| Primary CTA hover | `deep-teal` / `--ui-primary-hover` | `#003F7A` | hover CTA chính |
| Success badge | `--ui-success-bg` + `--ui-success-fg` | `#D1FAE5` + `#047857` | badge thành công |
| Danger badge | `--ui-danger-bg` + `--ui-danger-fg` | `#FEE2E2` + `#B91C1C` | badge lỗi |
| Neutral badge | `--ui-neutral-badge-bg` + `--ui-neutral-badge-fg` | `#E2E8F0` + `#64748B` | badge chưa cấu hình / trạng thái trung tính |

Quy tắc:

- Ưu tiên semantic color theo nghĩa, không theo sở thích thị giác.
- Không dùng quá `2` màu nhấn mạnh trong cùng một view CRUD/admin. Mặc định là `secondary` cho active/highlight và `primary` cho CTA chính.
- Không dùng màu đỏ cho mục đích trang trí gây hiểu nhầm với lỗi/nguy hiểm.
- Không hardcode hex mới trong component nếu token repo đã đủ.
- Không dùng màu là tín hiệu duy nhất cho trạng thái quan trọng.
- Có thể dùng nguyên tắc bố cục màu `60–30–10`, nhưng màu thực tế vẫn phải lấy từ token repo.
- Không dùng `secondary` làm màu body text trên nền sáng.
- Title cấp trang và heading quan trọng trong CRUD/admin ưu tiên `deep-teal`, không dùng đen tuyệt đối.
- Background mặc định của CRUD/admin không phải trắng phẳng toàn trang; phải là `surface` kiểu `integration-settings`.

### Spacing

Mọi spacing phải là bội số của `4` hoặc `8`.

Bộ spacing chuẩn:

- `4px`
- `8px`
- `12px`
- `16px`
- `24px`
- `32px`
- `48px`
- `64px`

Quy tắc:

- Không dùng `5px`, `7px`, `9px`, `13px`, `15px` cho margin, padding, gap.
- Gap giữa button trong cùng cụm ưu tiên `8–12px`.
- Gap giữa section lớn ưu tiên `32–64px`.
- Label với field: `6–8px`.
- Field với helper/error: `4–6px`.
- Field với field: `16–20px`.

### Radius

Single source of truth cho radius là token `--ui-*`, không dùng `rounded`, `rounded-lg`, `rounded-full` ad-hoc trong CRUD/admin khi đã có token tương ứng.

Map bắt buộc:

- button / input / select / search / info strip nested / panel con: `var(--ui-control-radius)` = `6px`
- shell chính / card / dropdown / data grid container / content pane: `var(--ui-shell-radius)` = `8px`
- modal / dialog desktop: `var(--ui-modal-radius)` = `16px`
- bottom sheet / mobile full-height panel: `var(--ui-modal-mobile-radius)` = `20px`
- pill / avatar / chip / badge / switch track-thumb: `var(--ui-pill-radius)` = `9999px`

Quy tắc:

- Component nhỏ dùng radius nhỏ hơn component lớn.
- Nested surface phải có radius nhỏ hơn lớp ngoài.
- Không trộn tuỳ tiện nhiều hệ radius trong cùng một màn khi token đã đủ cover use case.
- Nếu một component mới cần radius khác token chuẩn, phải bổ sung token `--ui-*` trước rồi mới dùng.

### Shadow

Shadow dùng theo bậc:

- nhẹ cho input/card default
- vừa cho card hover/dropdown
- mạnh cho modal/popover lớn

Quy tắc:

- Không thay đổi shadow ngẫu nhiên từng màn.
- Default shadow phải nhẹ, hover mới tăng elevation.
- Glow shadow chỉ dùng cho CTA đặc biệt nếu thật sự cần.
- Không dùng glow cho mọi element.

### Z-Index

Chỉ dùng hệ thống lớp sau:

- base: `0`
- raised: `1–9`
- dropdown: `100`
- sticky: `200`
- drawer: `300`
- backdrop: `400`
- modal: `500`
- popover: `600`
- tooltip: `700`
- toast: `800`
- loading: `900`

Quy tắc:

- Không hardcode `z-index: 9999`.
- Tooltip không được bị modal che.
- Toast không được thấp hơn tooltip hoặc modal.

### Layout Foundation

Bố cục chuẩn cho CRUD/admin phải mô phỏng shell của `integration-settings` trước khi nghĩ đến biến thể khác.

Mẫu chuẩn:

- Outer page wrapper dùng `--ui-page-padding` và `--ui-page-padding-bottom`.
- Page header là cụm compact:
  - icon chip `28x28`
  - title + subtitle bên trái
  - action nhỏ bên phải
- Main shell là một khối chính:
  - nền `--ui-surface-bg`
  - viền `1px solid var(--ui-border)`
  - radius `--ui-shell-radius`
  - shadow `--ui-shadow-shell`
  - `overflow: hidden`
  - min-height theo `--ui-shell-min-height` khi là settings/editor panel
- Nếu có left rail nội bộ trong shell:
  - width mặc định `--ui-nav-rail-width`
  - nền `--ui-surface-subtle-tint`
  - border-right `1px solid var(--ui-border)`
  - heading nhỏ uppercase ở đầu rail
- Content pane bên phải gồm:
  - top toolbar `padding-inline: var(--ui-toolbar-padding-x)` và `padding-block: var(--ui-toolbar-padding-y)`
  - body `padding: var(--ui-section-padding)`
  - form grid `gap-x: var(--ui-grid-gap-x)` và `gap-y: var(--ui-grid-gap-y)`
- Footer/info strip hoặc sticky footer phải tách lớp rõ:
  - nền subtle
  - border mảnh
  - không hòa lẫn với form body

Quy tắc:

- Một màn CRUD/admin không nên nhảy qua quá nhiều lớp surface trong cùng một viewport.
- Ưu tiên một shell chính rõ ràng thay vì nhiều card nhỏ chồng chéo khi tác vụ là cấu hình/form dài.
- Rail, toolbar, body và footer phải đọc được như bốn vùng có cấu trúc, không được dính thành một khối trắng vô định.
- Nếu không dùng left rail, vẫn giữ ngôn ngữ shell, toolbar và section padding của `integration-settings`.

## Typography Standard

### Root Typography

Theo `frontend/index.css`:

- mobile/tablet root font-size: `14px`
- laptop+ root font-size: `15px`

### Scale chuẩn cho QLCV CRUD/Admin UI

- Page title / modal title / card title chính:
  - `text-sm font-bold leading-tight`
- Toolbar title / dense section title:
  - `text-xs font-bold`
- Nav item / tab label / form label / button label / dropdown item:
  - `text-xs font-semibold`
- Input / select / textarea value mặc định:
  - `text-sm`
- Secondary subtitle / helper / meta line:
  - `text-[11px]`
- Tertiary helper / note / micro caption / config hint:
  - `text-[10px]`
- Dense table header / group header:
  - `text-[10px] font-bold uppercase tracking-wider`
- Badge text / state chip nhỏ:
  - `text-[10px] font-bold`
- Technical/code content:
  - `font-mono text-xs`
  - hoặc `font-mono text-[11px]` nếu chuỗi dài cần đọc rõ hơn

### Quy tắc typography bắt buộc

- Không trộn `text-sm` và `text-xs` trong cùng một loại control dropdown.
- Không trộn `font-medium` và `font-semibold` cho sidebar/menu label cùng cấp.
- Input value và trigger text của select phải theo cùng một scale typography của CRUD form.
- Body text không được nhỏ hơn `14px`.
- Heading không dùng letter-spacing dương.
- Label/badge uppercase chỉ dùng cho text ngắn.
- Không uppercase body text dài.
- Text block dài nên giữ chiều rộng đọc khoảng `60–75` ký tự mỗi dòng khi có thể.
- Text muted vẫn phải đủ tương phản để đọc được.

### Typography ngoại lệ

- `font-mono` chỉ dùng cho code-like data.
- `font-serif` chỉ được phép ở print/export template nếu có lý do nghiệp vụ rõ ràng.
- Dashboard hero có thể dùng scale khác, nhưng phải nhất quán riêng trong chính dashboard đó.

## Button

### Size chuẩn

| Size | Height | Padding | Font | Radius | Ghi chú |
|------|--------|---------|------|--------|---------|
| XS | 28px | 6px × 12px | 12px | 6px | Chỉ dùng khi thật sự chật |
| SM | 32px | 8px × 16px | 13px | 8px | Dense action |
| MD | 40px | 10px × 20px | 14px | 8px | Mặc định |
| LG | 48px | 12px × 24px | 15px | 10px | Prominent CTA |
| XL | 56px | 14px × 32px | 16px | 12px | Rất hiếm |

### Quy tắc bắt buộc

- Button height không dưới `32px`.
- Touch target trên mobile phải ít nhất `44x44px`.
- Primary CTA trên mobile ưu tiên `w-full`.
- Disabled phải có:
  - opacity giảm
  - `cursor: not-allowed`
  - chặn tương tác
- Loading button phải:
  - có spinner hoặc indicator
  - chặn double-click
- Focus state phải có focus ring rõ ràng.
- Text button phải rõ nghĩa:
  - tốt: `Lưu`, `Lưu cấu hình`, `Tạo mới`, `Xóa hợp đồng`
  - tránh: `OK`, `Submit`, `Yes`

### States chuẩn

- hover:
  - `100–150ms`
  - có thể dùng `translateY(-1px đến -2px)` hoặc đổi màu nhẹ
- active:
  - `80–100ms`
  - không scale/phản hồi quá mạnh
- focus:
  - outline/ring rõ
- disabled:
  - không chỉ đổi màu text

## Input, Select, Search, Form

### Input / Select Size

| Size | Height | Padding | Font | Radius |
|------|--------|---------|------|--------|
| SM | 32px | 6px × 10px | 13px | 6px |
| MD | 40px | 10px × 14px | 14px | 8px |
| LG | 48px | 12px × 16px | 16px | 10px |

Quy tắc:

- CRUD form mặc định dùng `MD`.
- Mobile ưu tiên `44px+`.
- Trigger của select phải cùng height với input cùng size.

### Input States

- default: border rõ, không quá nhạt
- hover: border tăng tương phản nhẹ
- focus: border semantic + ring rõ
- error: border error + error text
- disabled: nhìn khác rõ nhưng vẫn đọc được

### Form Rules

- Label luôn hiển thị phía trên field.
- Không dùng placeholder thay label.
- Required phải có dấu `*` hoặc dấu hiệu tương đương.
- Error phải có message cụ thể, không chỉ đổi viền đỏ.
- Validate ưu tiên `on-blur`, không quấy rầy người dùng khi đang gõ.
- Không reset toàn bộ form khi submit lỗi.
- Textarea chỉ cho `resize: vertical` nếu cần resize.
- `type`, `inputmode`, `autocomplete` phải đúng với ngữ nghĩa trường.
- Form nhiều bước phải có progress rõ ràng.
- Không yêu cầu confirm password trừ case tạo mới thật sự cần.

### Search Rules

- Search bar luôn có icon kính lúp bên trái.
- Khi có nội dung phải có clear action rõ ràng.
- Search gọi API nên debounce khoảng `300ms`.
- Search no-result phải có empty state + gợi ý từ khóa/bộ lọc.
- Mobile search ưu tiên full-width.
- `Escape` nên clear hoặc đóng state liên quan nếu hợp lý.

### Select / Dropdown Rules

- Dropdown dài phải auto-flip khi gần đáy viewport.
- Không để menu bị crop.
- Dropdown item thường không wrap nhiều dòng; ưu tiên ellipsis + tooltip.
- Từ `8` lựa chọn trở lên nên có search.
- Từ `20` lựa chọn trở lên thì search là bắt buộc.
- Hỗ trợ keyboard:
  - `ArrowUp`
  - `ArrowDown`
  - `Enter`
  - `Space`
  - `Escape`
  - `Home`
  - `End`

## Modal / Dialog / Drawer

### Variant chuẩn

| Variant | Desktop | Tablet | Mobile | Use case |
|---------|---------|--------|--------|----------|
| XS | max 400px | 80% | 90% | confirm/alert |
| SM | max 520px | 85% | 90% | form ngắn |
| MD | max 672px | 75–80% | 90–95% | mặc định |
| LG | max 800px | 85–90% | full-width sheet | form phức tạp |
| XL | max 1024px | 90–95% | full-screen | editor/workflow |
| Full | 100vw × 100vh | 100% | 100% | workflow lớn |

### Backdrop và Panel Shell

- Backdrop mặc định dùng `var(--ui-modal-backdrop)` với lớp tối xanh lạnh nhẹ, không dùng đen đặc.
- Modal panel dùng:
  - nền `var(--ui-surface-bg)`
  - viền `1px solid var(--ui-border)`
  - radius `16px`
  - shadow mạnh hơn shell thường, ưu tiên cùng họ với `shadow-cloud`
  - max-height `var(--ui-modal-max-height)`
- Modal panel phải luôn nằm trên backdrop và không bị footer/toast che sai tầng.
- Confirm/alert modal không được dùng panel quá cao làm loãng quyết định chính.

### Cấu trúc bắt buộc

- Header rõ ràng:
  - icon nếu cần
  - title
  - close action
- Body scroll nội bộ khi dài
- Footer action rõ ràng
- Footer sticky khi modal dài và có CTA quan trọng

### Header / Body / Footer Standard

- Header tối thiểu cao `var(--ui-modal-header-min-height)`.
- Header nên sticky khi modal dài hoặc có nhiều field khiến body phải scroll.
- Header phải có:
  - title
  - close action
  - subtitle hoặc meta nếu cần, nhưng không làm header cao quá mức
- Body là vùng scroll chính; không để toàn bộ panel scroll nếu modal có header/footer cố định.
- Body phải có khoảng đệm đủ để nội dung cuối không bị footer che.
- Footer tối thiểu cao `var(--ui-modal-footer-min-height)`.
- Footer action mặc định đặt bên phải trên desktop/tablet.
- Trên mobile, footer action ưu tiên:
  - stack dọc
  - hoặc primary full-width + secondary full-width
- Gap giữa các CTA trong footer dùng `var(--ui-modal-footer-gap)`.
- Sticky footer phải có:
  - nền riêng
  - border-top mảnh
  - không trong suốt
  - không để body text nhìn xuyên phía dưới

### Scroll và Kích thước

- Modal dài phải tuân thủ công thức:
  - panel giới hạn theo `var(--ui-modal-max-height)`
  - body tự scroll nội bộ
  - header và footer không bị cuốn mất
- Không để xuất hiện đồng thời:
  - page scroll phía sau
  - và panel scroll toàn khối
  nếu có thể tránh bằng body scroll lock + internal scroll đúng chỗ.
- Khi modal mở, phải khóa scroll của trang nền nếu đây là modal chặn tương tác.
- Nếu nội dung rất dài trên mobile, ưu tiên full-screen sheet thay vì cố nhét vào modal giữa màn.
- Confirm modal và form ngắn không nên có scrollbar nếu có thể giữ nội dung gọn trong một viewport.

### Accessibility và hành vi

- Có `role="dialog"`.
- Có `aria-modal="true"`.
- Có focus trap.
- `Escape` đóng modal nếu không có ràng buộc đặc biệt.
- Focus ban đầu phải vào phần tử hợp lý.
- Không mở modal mà không có user trigger trừ khi là flow bắt buộc có lý do rõ ràng.
- Không nest modal trong modal nếu không có lý do đặc biệt.
- Click backdrop mặc định được phép đóng với modal thường.
- Với modal destructive, modal form chưa lưu, hoặc flow bắt buộc:
  - có thể chặn đóng bằng backdrop
  - nhưng phải có lý do rõ ràng
  - và phải báo cho user biết cách thoát
- Nút đóng phải luôn truy cập được bằng bàn phím và có `aria-label` rõ nghĩa.
- Focus khi mở modal nên vào:
  - title container với modal đọc thông tin
  - hoặc field đầu tiên với modal nhập liệu
  - hoặc nút an toàn nhất với confirm/destructive modal
- Focus khi đóng modal phải trả về trigger hợp lý trước đó nếu còn tồn tại trong DOM.

### Mobile Rules

- Modal thao tác dài trên mobile ưu tiên bottom sheet hoặc full-screen sheet.
- Không giữ modal desktop bé tí ở giữa màn mobile.
- Bottom sheet mobile nên có:
  - radius trên `20–24px`
  - safe-area padding đáy
  - CTA dễ chạm
- Không để close action hoặc CTA cuối bị vướng `safe-area` trên iPhone.
- Modal mobile nếu có hơn `2` action thì không dàn ngang chật; ưu tiên xếp dọc.

## Navigation

### Sidebar / Top Nav / Bottom Nav

- Side nav desktop ưu tiên rộng `220–280px`.
- Top nav desktop cao khoảng `56–64px`.
- Bottom nav mobile dùng khi thật sự phù hợp, tối đa `5` mục.

### Quy tắc

- Active state phải rõ bằng màu + trạng thái icon/hình, không chỉ đổi nhẹ màu chữ.
- Nav quan trọng nên sticky khi cần.
- Mobile navigation không được che safe area iOS.
- Trang sâu nên có breadcrumb nếu cần ngữ cảnh điều hướng.

## Table / Data Grid

### Kích thước

| Element | Desktop | Mobile |
|---------|---------|--------|
| Row height | 48–56px | 44px |
| Header | 40–48px | 40px |
| Cell padding | 12–16px × 8–12px | 12px × 8px |
| Body font | 14px | 13–14px |
| Header font | 12px đậm uppercase | 12px đậm |

### Quy tắc

- Header nên sticky nếu bảng scroll dọc.
- Số căn phải.
- Text căn trái.
- Icon căn giữa.
- Với bảng `w-full table-fixed`, không được khóa width px cho toàn bộ cột trên desktop rộng.
- Phải chia cột theo 2 nhóm:
  - cột utility fixed width: mã, ngày, số tiền, trạng thái, action, badge ngắn
  - cột nội dung co giãn: tên, mô tả, khách hàng, ghi chú, text dài
- Ít nhất phải để `1–2` cột text hấp thụ phần không gian dư; không để browser tự dàn dư vào các cột utility gây khoảng trắng lệch nhau.
- Khi cần `min-width`, phải tính theo tổng cột fixed width cộng vùng an toàn cho các cột text, thay vì khóa cứng tất cả cột bằng px.
- Nội dung dài ưu tiên ellipsis + tooltip.
- Không load hàng nghìn rows cùng lúc nếu có thể paginate hoặc virtualize.
- Table phải có empty state rõ ràng.
- Không dùng `<table>` để dàn layout không phải dữ liệu bảng.

## Card

- Một card chỉ nên biểu diễn một concept rõ ràng.
- Card không thay thế cho table nếu dữ liệu có tính bảng rõ ràng.
- Grid card ưu tiên:
  - mobile `1` cột
  - tablet `2` cột
  - laptop `3` cột
  - desktop `3–4` cột
- Text dài trong card phải clamp hợp lý.
- Ảnh trong card phải giữ aspect ratio cố định nếu có media.

## Empty State

- Empty state phải có ít nhất `1` CTA rõ ràng.
- Text nên mang tính hướng dẫn hành động.
- Search no-result phải gợi ý đổi từ khóa hoặc filter.
- Không để trang trắng hoàn toàn khi empty.
- Loading state và empty state không được dùng chung một biểu hiện.

## Tooltip

- Tooltip chỉ dành cho nội dung ngắn, tối đa khoảng `2` câu.
- Tooltip phải hiện được cả khi focus bằng bàn phím.
- Nếu tooltip giải thích cho control, nên dùng `aria-describedby` hoặc pattern truy cập tương đương.
- Không dùng tooltip cho thông tin bắt buộc để hoàn thành tác vụ.
- Không nhét interactive content như button/link vào tooltip chuẩn.
- Trên mobile, tooltip không phải pattern mặc định; ưu tiên inline helper hoặc disclosure khác.

## Toast / Notification

- Toast desktop ưu tiên rộng `320–400px`.
- Toast mobile không được che navigation chính.
- Error toast hoặc toast có action không nên auto-dismiss quá nhanh.
- Toast phải có close action rõ ràng.
- Toast phải có semantics như:
  - `role="alert"`
  - hoặc `aria-live`
- Không stack quá `3` toast cùng lúc.

## Icon Guidelines

- QLCV đang dùng Material Symbols làm icon system mặc định, nên phải ưu tiên hệ icon này để đồng nhất repo.
- Nếu cần icon custom ngoài bộ icon hiện có, ưu tiên SVG.
- Decorative icon nên có `aria-hidden="true"`.
- Icon-only button bắt buộc có `aria-label`.
- Trong cùng một cụm UI phải thống nhất phong cách icon.
- Không scale icon nhỏ dưới `12px`.

## Motion, Skeleton, Micro-Interaction

### Duration chuẩn

- hover: `100–150ms`
- active: `80–100ms`
- input focus: `150ms`
- toggle: `150–200ms`
- dropdown open: `180–220ms`
- modal open: `250–300ms`

### Quy tắc

- Chỉ animate chủ yếu `transform` và `opacity`.
- Tránh animate `width`, `height`, `top`, `left` cho tương tác thường ngày.
- Bắt buộc tôn trọng `prefers-reduced-motion`.
- Micro-interaction thông thường không quá `300ms`.
- Animation nên xuất hiện khi user trigger.

### Skeleton

- Skeleton phải giống shape content thật.
- Loading dài hơn `10s` nên có progress rõ ràng nếu phù hợp.
- Skeleton không được thay thế empty state.

### Destructive Interaction

- Hành động xoá có thể cân nhắc undo toast `3–5s` nếu phù hợp nghiệp vụ.

## Dark Mode, Transparency, Glass

- QLCV hiện chưa dùng dark mode làm chuẩn chính.
- Tuy vậy, component mới không được chặn khả năng hỗ trợ dark mode sau này.
- Nếu một màn có dark mode:
  - phải dùng token nền/surface/text riêng
  - không dùng pure black `#000000` làm nền chính
  - nên cân nhắc `prefers-color-scheme`
- Glassmorphism không phải style mặc định cho CRUD/admin UI.
- Nếu dùng glass:
  - phải có fallback khi không hỗ trợ `backdrop-filter`
  - phải cân nhắc `prefers-reduced-transparency`
  - không dùng glass cho form thao tác chính hoặc text dài

## Modern CSS và Tokens

- Ưu tiên design token và CSS custom properties.
- Có thể dùng:
  - `@layer`
  - container queries
  - `:has()`
  khi giúp giảm JS điều khiển UI.
- Không lạm dụng `!important`.
- Token nên đi theo tầng:
  - Primitive
  - Semantic
  - Component

## Accessibility — WCAG 2.2

### Bắt buộc

- Focus visible rõ ràng, không được xoá outline mà không có thay thế.
- Focus indicator phải đủ dày và đủ contrast.
- Touch target tối thiểu phải đạt mức thực dụng theo WCAG 2.2; trên mobile ưu tiên `44x44`.
- Keyboard navigation phải đầy đủ cho control tương tác.
- Không dùng `<div onClick>` thay `<button>` nếu phần tử đó là hành động.
- Ưu tiên semantic HTML:
  - `<button>`
  - `<nav>`
  - `<main>`
  - `<dialog>` hoặc pattern tương đương
- Icon-only button phải có `aria-label`.
- Modal phải có ARIA đúng.
- Error quan trọng nên được screen reader nhận biết bằng `role="alert"` hoặc `aria-live`.
- Không dùng màu là tín hiệu duy nhất.
- Contrast text thường phải đủ mạnh để đọc được.

### Ghi nhớ các điểm WCAG 2.2 nên rà

- Focus Appearance
- Target Size
- Dragging alternatives nếu có drag action
- Không yêu cầu nhập lại dữ liệu đã có
- Không dùng cơ chế xác thực gây tải nhận thức không cần thiết

## Responsive Standard

### Breakpoints nên test

- `320`
- `375`
- `390`
- `768`
- `1024`
- `1440`
- `1920`

### Quy tắc layout

- Mobile-first là mặc định.
- Chỉ mở rộng bằng `min-width` nếu không có lý do khác.
- Hover effect phải có guard `@media (hover: hover)` hoặc tương đương.
- Thành phần dính cạnh dưới trên iOS phải xét safe area khi cần.
- Text dài không được trải toàn màn hình rộng.

### Device behavior

- mobile:
  - button quan trọng full-width
  - form `1` cột
  - modal ưu tiên sheet/full-width
- tablet:
  - form `1–2` cột
  - layout bắt đầu mở rộng
- desktop:
  - form `2–3` cột nếu hợp lý
  - sidebar/top nav theo pattern hiện có

## UI Testing Rules

Mỗi thay đổi UI phải kiểm tra tối thiểu:

- spacing nhất quán
- typography đúng scale
- semantic color đúng nghĩa
- alignment icon/text ổn định
- overflow không phá layout
- empty/loading/error states rõ ràng
- keyboard navigation không bị hỏng
- focus visible còn hoạt động

### Breakpoint checklist

- `320px`
- `375px`
- `390px`
- `768px`
- `1024px`
- `1440px`
- `1920px`

### Kiểm tra bổ sung khi phù hợp

- dark mode
- browser zoom `200%`
- safe area iOS
- toast timing
- modal focus trap
- dropdown keyboard navigation
- error `role="alert"`

## Quick Reference

### Component Sizes

| Component | Mobile | Tablet | Desktop |
|-----------|--------|--------|---------|
| Button MD | 44px ưu tiên | 40–44px | 40px |
| Input MD | 44px ưu tiên | 40px | 40px |
| Search | full-width 44px | 40px | 40px, 240–480px |
| Modal MD | 90–95% / sheet | 75–80% | max 672px |
| Modal LG | full/sheet | 85–90% | max 800px |
| Toast | tránh che nav | bottom hoặc theo layout | top-right |

### Z-Index Quick Map

| 100 | 200 | 300 | 400 | 500 | 600 | 700 | 800 | 900 |
|-----|-----|-----|-----|-----|-----|-----|-----|-----|
| dropdown | sticky | drawer | backdrop | modal | popover | tooltip | toast | loading |

## Danh sách AI phải làm trước khi kết thúc task UI

- Đối chiếu thiết kế với tài liệu này.
- Không hardcode giá trị lẻ về spacing.
- Không hardcode font family hoặc hex mới nếu token repo đã có.
- Kiểm tra button, input, modal, dropdown có cùng sizing language.
- Kiểm tra typography role đúng chuẩn.
- Kiểm tra responsive ở các breakpoint bắt buộc.
- Kiểm tra accessibility cơ bản:
  - keyboard
  - focus
  - aria-label
  - modal/dialog semantics
  - error announcement nếu có
- Báo rõ ngoại lệ nếu màn phải lệch chuẩn.
