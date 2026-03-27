# Skill Template - Workflow 5 Bước

## Cấu trúc Skill

```markdown
---
name: <skill-name>
description: <Mô tả ngắn gọn về skill>
disable-model-invocation: true
---

# <Skill Name>

Bạn đang xử lý lệnh `/<skill-name> <arguments>`.
Đối số người dùng nhập nằm trong `$ARGUMENTS`.

## Workflow 5 Bước

### Bước 1: Thu thập thông tin
- Xác định yêu cầu từ `$ARGUMENTS`
- Nếu thiếu thông tin, hỏi user cung cấp chi tiết
- Validate input đầu vào

### Bước 2: Tìm kiếm và Phân tích
- Tìm file/tài liệu liên quan trong codebase
- Đọc và phân tích nội dung
- Xác định phạm vi công việc

### Bước 3: Lập kế hoạch
- Tóm tắt ngắn gọn những gì sẽ làm
- Liệt kê các file sẽ sửa đổi
- Xác định các ràng buộc và quy ước cần tuân thủ

### Bước 4: Thực thi
- Thực hiện công việc theo kế hoạch
- Tuân thủ conventions trong `CLAUDE.md` và `GIT_RULES_WORKFLOWS.md`
- Không mở rộng scope ngoài yêu cầu nếu chưa có xác nhận

### Bước 5: Báo cáo và Hoàn tất
- Báo cáo tiến độ sau mỗi mốc chính
- Khi hoàn tất, liệt kê:
  - File đã sửa đổi
  - Test/lint đã chạy (nếu có)
  - Cập nhật task list

## Ràng buộc Bắt buộc

- Tuân thủ `CLAUDE.md` và `GIT_RULES_WORKFLOWS.md`
- Không sửa protected files nếu chưa có xác nhận
- Vào plan mode trước khi implement thay đổi lớn
- Giữ nguyên conventions hiện có

## Ví dụ Sử dụng

```bash
/<skill-name> <arguments>
```

## Tham chiếu

- `CLAUDE.md` - Project conventions
- `GIT_RULES_WORKFLOWS.md` - Git workflow
- `init-he-thong.md` - Setup guide
- `CODE_BASE_HE_THONG.md` - Codebase overview
