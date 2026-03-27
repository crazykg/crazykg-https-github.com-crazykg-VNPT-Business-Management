# Danh sách Skills - Workflow 5 Bước

**Cập nhật**: 2026-03-27

## Skills Hiện có

### 1. code-theo-plan ✅
- **Location**: `.claude/skills/code-theo-plan/SKILL.md`
- **Mô tả**: Thực hiện code theo file plan trong thư mục `plan-code/`
- **Workflow**:
  1. Kiểm tra arguments
  2. Tìm file plan trong `plan-code/`
  3. Đọc và tóm tắt plan
  4. Thực thi code bám sát plan
  5. Báo cáo tiến độ và hoàn tất

### 2. template 📝
- **Location**: `.claude/skills/template/SKILL.md`
- **Mô tả**: Template cho việc tạo skills mới
- **Workflow**: 5 bước chuẩn cho tất cả skills

## Skills Đề xuất (Chưa implement)

### 3. review-code (Đề xuất)
- **Mô tả**: Review code changes trước khi merge
- **Workflow**:
  1. Đọc file changes
  2. Check conventions
  3. Tìm bugs/potential issues
  4. Đề xuất improvements
  5. Tạo report

### 4. write-tests (Đề xuất)
- **Mô tả**: Tạo test files cho feature mới
- **Workflow**:
  1. Phân tích feature
  2. Xác định test cases
  3. Viết test code
  4. Chạy tests
  5. Báo cáo coverage

### 5. refactor-code (Đề xuất)
- **Mô tả**: Refactor code theo best practices
- **Workflow**:
  1. Identify code smells
  2. Plan refactoring
  3. Execute changes
  4. Run tests
  5. Document changes

### 6. debug-issue (Đề xuất)
- **Mô tả**: Debug và fix issues
- **Workflow**:
  1. Reproduce issue
  2. Analyze logs/code
  3. Identify root cause
  4. Implement fix
  5. Verify fix

### 7. create-docs (Đề xuất)
- **Mô tả**: Tạo tài liệu cho feature
- **Workflow**:
  1. Gather requirements
  2. Research code
  3. Create outline
  4. Write content
  5. Review & update

### 8. security-audit (Đề xuất)
- **Mô tả**: Audit security vulnerabilities
- **Workflow**:
  1. Scan codebase
  2. Identify vulnerabilities
  3. Assess risk level
  4. Recommend fixes
  5. Generate report

### 9. performance-review (Đề xuất)
- **Mô tả**: Review và optimize performance
- **Workflow**:
  1. Profile application
  2. Identify bottlenecks
  3. Plan optimizations
  4. Implement changes
  5. Measure improvements

### 10. migrate-data (Đề xuất)
- **Mô tả**: Migration dữ liệu giữa versions
- **Workflow**:
  1. Analyze schema changes
  2. Create migration plan
  3. Write migration scripts
  4. Test migration
  5. Deploy & verify

### 11. api-integration (Đề xuất)
- **Mô tả**: Integrate với third-party APIs
- **Workflow**:
  1. Read API docs
  2. Design integration
  3. Implement code
  4. Test integration
  5. Document usage

## Skill Template Structure

Tất cả skills tuân theo cấu trúc chung:

```markdown
---
name: <skill-name>
description: <Mô tả ngắn>
disable-model-invocation: true
---

# <Skill Name>

## Workflow 5 Bước

### Bước 1: Thu thập thông tin
- Xác định yêu cầu
- Validate input

### Bước 2: Tìm kiếm và Phân tích
- Tìm file/tài liệu
- Phân tích nội dung

### Bước 3: Lập kế hoạch
- Tóm tắt phạm vi
- Liệt kê files sẽ sửa

### Bước 4: Thực thi
- Implement theo plan
- Tuân thủ conventions

### Bước 5: Báo cáo và Hoàn tất
- Liệt kê changes
- Chạy tests
- Cập nhật task list

## Ràng buộc
- Tuân thủ CLAUDE.md
- Tuân thủ GIT_RULES_WORKFLOWS.md
- Không sửa protected files
```

## Cách Sử dụng Skills

### Lệnh cơ bản
```bash
/<skill-name> <arguments>
```

### Ví dụ
```bash
/code-theo-plan Nang_cap_kien_truc_he_thong_v1.md
/review-code backend/app/Services/V5/Domain
/write-tests frontend/components/customer-request
```

## Quy trình Tạo Skill Mới

1. **Tạo thư mục**: `.claude/skills/<skill-name>/`
2. **Tạo file SKILL.md**: Theo template ở trên
3. **Test skill**: Chạy lệnh `/<skill-name>` với arguments mẫu
4. **Document**: Thêm vào file này
5. **Review**: Đảm bảo tuân thủ conventions

## Best Practices

### Đặt tên
- Sử dụng kebab-case: `code-theo-plan`, `review-code`
- Tên ngắn gọn, mô tả rõ chức năng
- Sử dụng tiếng Việt không dấu hoặc English

### Nội dung
- Mô tả ngắn gọn trong frontmatter
- Workflow 5 bước rõ ràng
- Examples cụ thể
- Ràng buộc bắt buộc

### Testing
- Test với arguments hợp lệ
- Test với arguments trống
- Test error handling
- Test edge cases

## Metrics

| Metric | Value |
|--------|-------|
| Total Skills | 11 (2 implemented, 9 proposed) |
| Implementation Rate | 18% |
| Average Workflow Steps | 5 |
| Documentation Coverage | 100% |

## Next Steps

1. ✅ Implement `code-theo-plan` skill
2. ✅ Create skill template
3. ⏳ Implement `review-code` skill
4. ⏳ Implement `write-tests` skill
5. ⏳ Implement remaining skills

---

*Tài liệu này được cập nhật khi có skills mới.*
