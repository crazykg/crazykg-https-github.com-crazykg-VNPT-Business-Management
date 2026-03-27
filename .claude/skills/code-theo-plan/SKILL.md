---
name: code-theo-plan
description: Thực hiện code theo file plan trong thư mục plan-code
disable-model-invocation: true
---

# Code theo plan

Bạn đang xử lý lệnh `/code-theo-plan <ten plan>`.
Đối số người dùng nhập nằm trong `$ARGUMENTS`.

Thực hiện theo thứ tự:

1. Nếu `$ARGUMENTS` trống, hỏi user cung cấp tên plan.
2. Tìm file plan trong `plan-code/` theo các cách:
   - khớp chính xác tên file
   - khớp không phân biệt hoa/thường
   - khớp gần đúng có chứa chuỗi
3. Nếu có nhiều kết quả, liệt kê tối đa 5 file phù hợp nhất và yêu cầu user chọn 1 file.
4. Đọc plan đã chọn, tóm tắt ngắn phạm vi sẽ làm.
5. Thực thi code bám sát plan; không mở rộng scope ngoài plan nếu user chưa yêu cầu.
6. Sau mỗi mốc chính, báo tiến độ ngắn và cập nhật task list.
7. Khi hoàn tất, báo rõ:
   - file đã sửa
   - test/lint đã chạy (nếu có)
   - mục plan đã xong và mục còn lại (nếu có)

Ràng buộc bắt buộc:
- Tuân thủ `CLAUDE.md` và `GIT_RULES_WORKFLOWS.md`.
- Không sửa các file/area protected nếu chưa có xác nhận của user.
- Nếu thay đổi nhiều file hoặc có quyết định kiến trúc, vào plan mode trước khi implement.
