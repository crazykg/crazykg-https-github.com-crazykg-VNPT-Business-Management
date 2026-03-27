# Documentation Template - Workflow 5 Bước

## Cấu trúc Tài liệu

```markdown
# <Tên Tài liệu>

**Cập nhật**: YYYY-MM-DD

## Mục lục

1. [Tổng quan](#tổng-quan)
2. [Kiến trúc](#kiến-trúc)
3. [Hướng dẫn Sử dụng](#hướng-dẫn-sử-dụng)
4. [Quy ước](#quy-ước)
5. [Ví dụ](#ví-dụ)

---

## 1. Tổng quan

### Mục đích
- Mô tả ngắn gọn mục đích của tài liệu
- Đối tượng độc giả
- Phạm vi áp dụng

### Thuật ngữ
| Thuật ngữ | Định nghĩa |
|-----------|------------|
| Term 1    | Definition |
| Term 2    | Definition |

---

## 2. Kiến trúc

### Tổng quan Hệ thống

```
Sơ đồ kiến trúc hoặc flow diagram
```

### Components

| Component | Mô tả | File Location |
|-----------|-------|---------------|
| Component A | Description | path/to/file |
| Component B | Description | path/to/file |

### Database Schema

```sql
-- Table structure
CREATE TABLE example (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  name VARCHAR(255) NOT NULL,
  created_at TIMESTAMP NULL DEFAULT NULL,
  updated_at TIMESTAMP NULL DEFAULT NULL,
  PRIMARY KEY (id)
);
```

---

## 3. Hướng dẫn Sử dụng

### Bước 1: Chuẩn bị
```bash
# Commands cần chạy
cd backend
composer install
```

### Bước 2: Cấu hình
```env
# Environment variables
DB_CONNECTION=mysql
DB_HOST=127.0.0.1
```

### Bước 3: Chạy Migration
```bash
php artisan migrate
```

### Bước 4: Kiểm tra
```bash
php artisan test
```

### Bước 5: Deploy
```bash
# Production deployment steps
npm run build
```

---

## 4. Quy ước

### Coding Standards

#### Frontend
```typescript
// TypeScript/React conventions
export const useCustomHook = () => {
  const [state, setState] = useState(initialState)
  
  return { state, setState }
}
```

#### Backend
```php
// PHP/Laravel conventions
class ExampleService
{
    public function __construct(
        private V5DomainSupportService $support
    ) {}
    
    public function exampleMethod(): array
    {
        return $results;
    }
}
```

### Git Workflow

```bash
# Branch naming
git checkout -b username/task-name

# Commit convention
git commit -m "type(scope): message"
# Types: feat | fix | refactor | chore | test
# Scopes: frontend | backend | database
```

### Testing

```bash
# Backend tests
cd backend && php artisan test --filter=ExampleTest

# Frontend tests
cd frontend && npm run test
```

---

## 5. Ví dụ

### Use Case 1: CRUD Operation

```typescript
// Frontend example
const ExampleComponent = () => {
  const [data, setData] = useState([])
  
  const fetchData = async () => {
    const response = await fetchExampleData()
    setData(response.data)
  }
  
  return <div>{/* JSX */}</div>
}
```

### Use Case 2: API Endpoint

```php
// Backend example
class ExampleController extends Controller
{
    public function index(Request $request)
    {
        $data = $this->domainService->listItems(
            $request->only(['q', 'sort_key', 'page'])
        );
        
        return response()->json(['data' => $data]);
    }
}
```

### Use Case 3: Database Query

```php
// Eloquent query with guards
if ($this->support->hasColumn('examples', 'custom_field')) {
    $query->where('custom_field', $value);
}
```

---

## Tài liệu Tham khảo

- `CLAUDE.md` - Project conventions
- `GIT_RULES_WORKFLOWS.md` - Git workflow
- `init-he-thong.md` - Setup guide
- `CODE_BASE_HE_THONG.md` - Codebase overview

## Lịch sử Thay đổi

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | YYYY-MM-DD | Author | Initial version |
| 1.1 | YYYY-MM-DD | Author | Bug fixes |

---

*Tài liệu này được tạo theo workflow 5 bước.*
```

## Workflow 5 Bước để Tạo Tài liệu

### Bước 1: Thu thập Yêu cầu
- Xác định mục đích tài liệu
- Xác định đối tượng độc giả
- Liệt kê các chủ đề cần cover

### Bước 2: Nghiên cứu
- Đọc code liên quan
- Phỏng vấn developers
- Thu thập ví dụ thực tế

### Bước 3: Lập dàn ý
- Tạo mục lục
- Xác định sections chính
- Lên kế hoạch screenshots/diagrams

### Bước 4: Viết nội dung
- Viết theo dàn ý
- Thêm code examples
- Include warnings/notes

### Bước 5: Review và Cập nhật
- Review với team
- Cập nhật theo feedback
- Lên lịch review định kỳ

## Best Practices

1. **Ngắn gọn**: Mỗi section không quá 500 từ
2. **Rõ ràng**: Sử dụng headings và bullet points
3. **Nhất quán**: Theo template này cho tất cả docs
4. **Cập nhật**: Review ít nhất mỗi quarter
5. **Ví dụ**: Luôn include code examples
