# Git Workflow & Coding Rules (BẮT BUỘC)

File này quy định quy trình làm việc với Git và các quy tắc coding cho project VNPT Business Management.

## Quy trình code task mới (feature/bugfix/refactor)

### 1. Chuẩn bị Git Branch

```bash
# Về main và cập nhật
git checkout main
git fetch origin
git pull origin main

# Tạo nhánh mới (format: username/task-name)
git checkout -b username/task-name
# Ví dụ: john/fix-contract-modal hoặc tung/add-fee-collection-feature
```

### 2. Làm tươi Context & Đọc Plan

- Đọc file `CLAUDE.md` để nắm conventions
- Đọc file `GIT_RULES_WORKFLOWS.md` này để nắm quy tắc git workflow
- Kiểm tra `plan-code/` xem đã có plan cho task chưa
- Nếu chưa có plan → tạo file mới: `plan-code/<Ten_Chuc_Nang_Nam-MM-DD>.md`
- Nếu đã có plan → đối chiếu với codebase hiện tại, cập nhật status

### 3. Thực Hiện Code

**Tuân thủ:**
- Conventions trong `CLAUDE.md`
- Patterns hiện có (state management, API calls, pagination)

**KHÔNG được tự ý thay đổi khi chưa được phép:**

| Area | Files/Patterns không được sửa |
|------|-------------------------------|
| Frontend | `App.tsx` (refactor lớn), state management pattern, routing structure |
| Frontend Utils | `revenueDisplay.ts`, `dateDisplay.ts`, `authorization.ts`, `importParser.ts`, `exportUtils.ts` |
| Backend Core | `V5MasterDataController.php`, `routes/api.php`, middleware stack |
| Backend Services | DomainService pattern hiện có |
| Database | Schema tables hiện có (chỉ thêm column mới qua migration) |

**Nếu cần refactor lớn → PHẢI HỎI USER TRƯỚC**

### 4. Commit Convention

```
Format: <type>(<scope>): <message>

Types: feat | fix | refactor | chore | test
Scopes: frontend | backend | database

Ví dụ:
- feat(fee-collection): add bulk invoice generation
- fix(backend): resolve customer-request transition bug
- refactor(frontend): extract modal logic to custom hook
```

### 5. Merge Main Trước Khi Push

```bash
git fetch origin main
git merge origin/main
```

**QUY TẮC XỬ LÝ CONFLICT (BẮT BUỘC):**

- **Nguyên tắc: "GIỮ CẢ HAI"** — không được mất code từ main hoặc branch

- **Ví dụ cụ thể:**
  - main có: `function a(), b(), c(), d()`
  - branch có: `function a(), b(), c(), e()`
  - **KẾT QUẢ BẮT BUỘC:** `function a(), b(), c(), d(), e()`

- **KHÔNG được:**
  - ✘ Mất function từ main
  - ✘ Mất function từ branch
  - ✘ Override toàn bộ file khi conflict

- **Test sau merge:**
  - Chạy tests (nếu có)
  - Test thủ công feature liên quan

### 6. Push & Pull Request

```bash
git push origin username/task-name
```

**PR description bao gồm:**
- Link đến plan file trong `plan-code/` (nếu có)
- Danh sách changes
- Test instructions
- Note: "Đã merge main mới nhất"

---

## Quick Reference Commands

```bash
# Tạo branch mới
git checkout -b username/task-name

# Cập nhật branch từ main
git fetch origin main
git merge origin/main

# Xem conflict status
git status

# Hủy merge khi có vấn đề
git merge --abort

# Push branch lên remote
git push origin username/task-name