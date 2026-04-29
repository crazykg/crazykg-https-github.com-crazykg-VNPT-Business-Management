# Forward-Only SQL Patch Set

- Scope: bổ sung bảng `project_procedure_public_shares` để tạo link public 7 ngày cho modal thủ tục dự án.
- Source parity:
  - `backend/database/migrations/2026_04_29_120000_create_project_procedure_public_shares_table.php`
  - `backend/database/migrations/2026_04_29_130000_drop_created_by_foreign_from_project_procedure_public_shares.php`
  - `backend/database/migrations/2026_04_29_140000_add_access_key_hash_to_project_procedure_public_shares.php`

## Apply Order

1. `2026-04-29_01_project_procedure_public_shares_schema.sql`
2. `2026-04-29_02_migration_bookkeeping.sql`

## Notes

- Patch forward-only cho MySQL 8, tạo bảng nếu chưa tồn tại.
- `created_by` nullable và không có foreign key tới `users`, để link public vẫn tạo được khi user nội bộ cũ không còn khớp bảng `users`.
- Public token chỉ lưu dạng hash trong `token_hash`; token plaintext không được lưu DB.
- `access_key_hash` nullable, chỉ lưu hash của mã truy cập public; mã plaintext không được lưu DB.
