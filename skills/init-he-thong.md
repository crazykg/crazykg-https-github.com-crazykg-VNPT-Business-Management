# Skill: init-he-thong

## Mục Đích

Skill này tự động cập nhật file `CODE_BASE_HE_THONG.md` với thông tin mới nhất từ codebase mỗi khi agent mới bắt đầu session.

## Khi Nào Chạy

```
Mỗi khi agent framework khác bắt đầu session:
1. Chạy skill: init-he-thong
2. Đợi cập nhật hoàn tất
3. Bắt đầu task chính
```

## Tính Năng

| Tính năng | Mô tả |
|-----------|-------|
| **Change Detection** | So sánh với lần quét trước, chỉ báo cáo thay đổi thực sự |
| **Version Tracking** | Phát hiện thay đổi versions (React, Laravel, etc.) |
| **Structure Scanning** | Quét components, stores, hooks, services |
| **Tech Stack Update** | Tự động update Tech Stack table trong markdown |
| **E2E Test Count** | Đếm số lượng Playwright E2E tests |
| **Timeout Protection** | 30s timeout để tránh treo script |
| **State Persistence** | Lưu `.last-scan.json` để so sánh lần sau |

---

## Quy Trình Thực Hiện

### Bước 1: Load Previous Scan

```
- Đọc file `.last-scan.json` (nếu tồn tại)
- Dùng để so sánh với kết quả quét hiện tại
- Phát hiện thay đổi: thêm, xóa, update
```

### Bước 2: Quét Dependency Versions

**Frontend (`frontend/package.json`):**
- Đọc versions: `react`, `vite`, `typescript`, `zustand`, `tailwindcss`, `playwright`, `vitest`
- So sánh với lần trước → phát hiện thay đổi

**Backend (`backend/composer.json`):**
- Đọc versions: `php`, `laravel/framework`, `laravel/sanctum`, `phpunit`
- So sánh với lần trước → phát hiện thay đổi

---

### Bước 3: Quét Cấu Trúc Thư Mục

**Frontend Components:**
```
Quét: frontend/components/
- Đếm số lượng component directories
- So sánh với lần trước → phát hiện component mới/xóa
```

**Frontend Stores:**
```
Quét: frontend/shared/stores/*.ts
- Liệt kê Zustand store files
- So sánh với lần trước
```

**Frontend Hooks:**
```
Quét: frontend/hooks/ và frontend/components/**/hooks/
- Liệt kê custom hooks
- So sánh với lần trước
```

**Backend Services:**
```
Quét: backend/app/Services/V5/
- Liệt kê service directories
- So sánh với lần trước
```

**Backend Migrations:**
```
Quét: backend/database/migrations/
- Lấy 5 migrations mới nhất
```

---

### Bước 4: Quét Test Files

```
Frontend Unit Tests: frontend/__tests__/
Frontend E2E Tests:  frontend/e2e/
Backend Tests:       backend/tests/

- Đếm số lượng test files
- So sánh với lần trước → phát hiện thay đổi
```

---

### Bước 5: Cập Nhật CODE_BASE_HE_THONG.md

**Update Tech Stack Table:**
- Nếu version thay đổi → update table ngay trong markdown
- Ví dụ: React 19.0.0 → 19.2.4

**Append Changelog:**
- Xóa changelog cũ (giữ chỉ 1 entry mới nhất)
- Thêm changelog mới với:
  - Danh sách thay đổi phát hiện
  - Thống kê codebase
  - Versions hiện tại

---

### Bước 6: Lưu State

```
Lưu vào .last-scan.json:
- Timestamp
- Versions (frontend, backend)
- Components list
- Stores list
- Hooks list
- Services list
- Test counts
```

---

### Bước 7: Báo Cáo Kết Quả

```
✅ Update complete in 0.07s!

📊 No significant changes detected

📈 Stats:
   Frontend: 6 components, 4 stores, 37 hooks
   E2E Tests: 7
   Backend: 13 services
   Tests: FE=49, BE=0
```

Hoặc nếu có thay đổi:

```
✅ Update complete in 0.12s!

📊 3 changes detected:
   - Frontend Versions: updated - react: ^19.0.0 → ^19.2.4
   - Frontend Components: added - +1: new-feature
   - Frontend Tests: updated - 45 → 49 tests
```

---

## Script Tự Động Hóa

### Chạy Trực Tiếp

```bash
# From project root
node scripts/update-codebase-docs.js
```

### Chạy Qua NPM

```bash
npm run update:docs
# hoặc
npm run skill:init
```

---

## Checklist Khi Chạy Skill

- [x] Load `.last-scan.json` (nếu có)
- [x] Đọc `frontend/package.json` → extract versions
- [x] Đọc `backend/composer.json` → extract versions
- [x] Quét `frontend/components/` → list components
- [x] Quét `frontend/shared/stores/` → list stores
- [x] Quét `frontend/hooks/` và `components/**/hooks/` → list hooks
- [x] Quét `frontend/e2e/` → count E2E tests
- [x] Quét `backend/app/Services/V5/` → list services
- [x] Quét `backend/database/migrations/` → latest migrations
- [x] Quét test files (FE unit, FE e2e, BE)
- [x] So sánh với `.last-scan.json` → phát hiện thay đổi
- [x] Update Tech Stack table (nếu version thay đổi)
- [x] Append changelog vào `CODE_BASE_HE_THONG.md`
- [x] Lưu `.last-scan.json` mới
- [x] Báo cáo kết quả

---

## Lưu Ý

1. **Không overwrite** - Chỉ update sections có thay đổi
2. **Giữ nguyên format** - Không thay đổi cấu trúc markdown
3. **Bảo mật** - Không commit sensitive info (API keys, passwords)
4. **Performance** - Giới hạn scan depth (max 3 levels cho components)
5. **Idempotent** - Chạy nhiều lần cùng kết quả nếu không có thay đổi
6. **Timeout** - 30s timeout để tránh treo script

---

## Files Liên Quan

| File | Mục đích |
|------|----------|
| `skills/init-he-thong.md` | Skill documentation (file này) |
| `scripts/update-codebase-docs.js` | Automation script |
| `CODE_BASE_HE_THONG.md` | Output file - codebase documentation |
| `.last-scan.json` | State file - kết quả quét lần trước |
| `package.json` | Root package.json với npm scripts |

---

## Integration with AI Agents

### For Claude Code

Add to `.claude/settings.json`:
```json
{
  "onSessionStart": ["skill: init-he-thong"]
}
```

### For Qwen Code

Add to `.qwen/settings.json`:
```json
{
  "onSessionStart": ["skill: init-he-thong"]
}
```

### For Other Agents

Khi agent mới bắt đầu session, chạy:
```
1. Check if CODE_BASE_HE_THONG.md exists
2. If older than 24 hours or first run:
   - Execute: node scripts/update-codebase-docs.js
   - Read updated file for context
3. Proceed with user's task
```

---

## Version History

| Version | Date | Changes |
|---------|------|---------|
| 1.0 | 2026-03-27 | Initial creation |
| 1.1 | 2026-03-27 | Added change detection, Tech Stack update, E2E test count, timeout protection |
