# Luồng Xử Lý Quản Lý Yêu Cầu Khách Hàng (Customer Request Management)

## Tổng quan

Tài liệu này mô tả luồng xử lý chức năng Quản lý yêu cầu khách hàng (Customer Request Management) trong hệ thống, bao gồm các bảng database liên quan và sơ đồ luồng nghiệp vụ.

---

## 1. Ma Trận Chuyển Tiếp Theo Quy Trình (Workflow Transition Matrix)

Dưới đây là ma trận chuyển tiếp giữa các task trong quy trình xử lý yêu cầu:

| Quy trình | Tác nhân | Task hiện tại | Task tiếp theo |
|-----------|----------|---------------|----------------|
| **Bắt đầu** | Tất cả | Tiếp nhận | Giao R thực hiện |
| **Bắt đầu** | Tất cả | Tiếp nhận | Giao PM/Trả YC cho PM |
| | R | Giao R thực hiện | R Đang thực hiện |
| | R | Giao R thực hiện | Giao PM/Trả YC cho PM |
| | A | Giao PM/Trả YC cho PM | Không tiếp nhận |
| | A | Giao PM/Trả YC cho PM | Chờ khách hàng cung cấp thông tin |
| | A | Giao PM/Trả YC cho PM | Giao R thực hiện |
| | A | Giao PM/Trả YC cho PM | Chuyển BA Phân tích |
| | A | Giao PM/Trả YC cho PM | Chuyển DMS |
| | A | Giao PM/Trả YC cho PM | Lập trình |
| | A | Giao PM/Trả YC cho PM | Hoàn thành |
| | A | Hoàn thành | Giao R thực hiện |
| | Tất cả | Hoàn thành | Giao PM/Trả YC cho PM |
| | Tất cả | Hoàn thành | Thông báo khách hàng |
| | R | R Đang thực hiện | Hoàn thành |
| | R | R Đang thực hiện | Giao PM/Trả YC cho PM |
| | Tất cả | Không tiếp nhận | Thông báo khách hàng |
| | Tất cả | Không tiếp nhận | Giao PM/Trả YC cho PM |
| | Tất cả | Chờ khách hàng cung cấp thông tin | Giao R thực hiện |
| | Tất cả | Chờ khách hàng cung cấp thông tin | Giao PM/Trả YC cho PM |
| | R | Chuyển BA Phân tích | Chuyển BA Phân tích hoàn thành |
| | R | Chuyển BA Phân tích | Chuyển BA Phân tích tạm ngưng |
| | R | Chuyển BA Phân tích | Giao PM/Trả YC cho PM |
| | Tất cả | Chuyển BA Phân tích hoàn thành | Chuyển DMS |
| | Tất cả | Chuyển BA Phân tích hoàn thành | Lập trình |
| | R | Chuyển BA Phân tích hoàn thành | Giao PM/Trả YC cho PM |
| | Tất cả | Chuyển BA Phân tích tạm ngưng | Chuyển BA Phân tích |
| | R | Chuyển BA Phân tích tạm ngưng | Chuyển BA Phân tích hoàn thành |
| | R | Chuyển BA Phân tích tạm ngưng | Giao PM/Trả YC cho PM |
| | Tất cả | Chuyển DMS | Tạo task |
| | Tất cả | Chuyển DMS | Giao PM/Trả YC cho PM |
| | Tất cả | Tạo task | DMS Đang thực hiện |
| | Tất cả | Tạo task | Giao PM/Trả YC cho PM |
| | Tất cả | DMS Đang thực hiện | Hoàn thành |
| | Tất cả | DMS Đang thực hiện | DMS tạm ngưng |
| | Tất cả | DMS Đang thực hiện | Giao PM/Trả YC cho PM |
| | Tất cả | DMS tạm ngưng | DMS Đang thực hiện |
| | Tất cả | DMS tạm ngưng | Giao PM/Trả YC cho PM |
| | R | Lập trình | Dev đang thực hiện |
| | R | Lập trình | Giao PM/Trả YC cho PM |
| | R | Dev đang thực hiện | Hoàn thành |
| | R | Dev đang thực hiện | Dev tạm ngưng |
| | R | Dev đang thực hiện | Giao PM/Trả YC cho PM |
| | R | Dev tạm ngưng | Dev đang thực hiện |
| | R | Dev tạm ngưng | Giao PM/Trả YC cho PM |
| **Kết thúc** | Tất cả | Thông báo khách hàng | Giao PM/Trả YC cho PM |

### Ghi chú quy trình:
- **I**: Thấy hết - Thêm I theo task
- **C**: Thấy hết - Thêm nhãn
- **360**: Cho phép cập nhật và hiển thị toàn bộ quá trình

---

## 2. Giải Mã Tác Nhân

| Ký hiệu | Tác nhân | Mô tả |
|---------|----------|-------|
| **R** | Receiver/Creator | Người tiếp nhận yêu cầu |
| **A** | Admin/PM | Người điều phối (Project Manager) |
| **Tất cả** | Tất cả vai trò | Mọi vai trò đều có thể thực hiện |

---

## 3. Các Trạng Thái Chính (Task States)

### 3.1. Nhóm trạng thái tiếp nhận và điều phối
| Task | Mô tả |
|------|-------|
| **Tiếp nhận** | Yêu cầu mới được tiếp nhận |
| **Giao R thực hiện** | Giao cho người tiếp nhận xử lý |
| **Giao PM/Trả YC cho PM** | Giao cho PM điều phối |

### 3.2. Nhóm trạng thái xử lý trực tiếp
| Task | Mô tả |
|------|-------|
| **R Đang thực hiện** | Người tiếp nhận đang xử lý |
| **Không tiếp nhận** | Yêu cầu không được tiếp nhận |
| **Chờ khách hàng cung cấp thông tin** | Đợi thông tin từ khách hàng |

### 3.3. Nhóm trạng thái phân tích
| Task | Mô tả |
|------|-------|
| **Chuyển BA Phân tích** | Chuyển cho BA phân tích yêu cầu |
| **Chuyển BA Phân tích hoàn thành** | BA đã hoàn thành phân tích |
| **Chuyển BA Phân tích tạm ngưng** | BA tạm ngưng phân tích |

### 3.4. Nhóm trạng thái lập trình
| Task | Mô tả |
|------|-------|
| **Lập trình** | Chuyển sang nhóm lập trình |
| **Dev đang thực hiện** | Developer đang code |
| **Dev tạm ngưng** | Developer tạm ngưng |

### 3.5. Nhóm trạng thái DMS
| Task | Mô tả |
|------|-------|
| **Chuyển DMS** | Chuyển sang hệ thống DMS |
| **Tạo task** | Tạo task trên DMS |
| **DMS Đang thực hiện** | Đang xử lý trên DMS |
| **DMS tạm ngưng** | Tạm ngưng xử lý DMS |

### 3.6. Nhóm trạng thái hoàn thành
| Task | Mô tả |
|------|-------|
| **Hoàn thành** | Yêu cầu đã hoàn thành |
| **Thông báo khách hàng** | Đã thông báo kết quả cho khách hàng |

---

## 4. Sơ Đồ Luồng Nghiệp Vụ

### 4.1. Luồng Tổng Quát

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                        LUỒNG XỬ LÝ YÊU CẦU                                   │
└─────────────────────────────────────────────────────────────────────────────┘

    ┌──────────────┐
    │   TIẾP NHẬN  │
    │  (Bắt đầu)   │
    └──────┬───────┘
           │
     ┌─────┴─────┐
     │           │
     ▼           ▼
┌─────────┐ ┌─────────────┐
│Giao R   │ │Giao PM/     │
│thực hiện│ │Trả YC cho PM│
└────┬────┘ └──────┬──────┘
     │             │
     │             ├─────────────────────────────────────────┐
     │             │                                         │
     ▼             ▼                                         ▼
┌─────────┐ ┌─────────────┐                         ┌───────────────┐
│R Đang   │ │Không tiếp   │                         │Chờ KH cung    │
│thực hiện│ │nhận         │                         │cấp thông tin  │
└────┬────┘ └──────┬──────┘                         └───────┬───────┘
     │             │                                        │
     │             └──────────────────┬─────────────────────┘
     │                                │
     ▼                                ▼
┌─────────────────────────────────────────────────────────────┐
│                    HOÀN THÀNH                                │
└─────────────────────────────────────────────────────────────┘
     │
     ▼
┌─────────────────────────────────────────────────────────────┐
│               THÔNG BÁO KHÁCH HÀNG                           │
│                    (Kết thúc)                                │
└─────────────────────────────────────────────────────────────┘
```

### 4.2. Luồng Phân Tích (BA)

```
┌─────────────────┐
│Chuyển BA        │
│Phân tích        │
└────────┬────────┘
         │
    ┌────┴────┐
    │         │
    ▼         ▼
┌─────────┐ ┌─────────┐
│BA Hoàn  │ │BA Tạm   │
│thành    │ │ngưng    │
└────┬────┘ └────┬────┘
     │           │
     │           └──────────┐
     │                      │
     ▼                      ▼
┌─────────────────┐  ┌─────────────────┐
│Chuyển DMS       │  │Chuyển BA        │
│Lập trình        │  │Phân tích        │
└─────────────────┘  └─────────────────┘
```

### 4.3. Luồng Lập Trình (Dev)

```
┌──────────────┐
│  Lập trình   │
└──────┬───────┘
       │
       ▼
┌──────────────┐
│Dev Đang      │
│thực hiện     │
└──────┬───────┘
       │
  ┌────┴────┐
  │         │
  ▼         ▼
┌─────────┐ ┌─────────┐
│Hoàn     │ │Dev Tạm  │
│thành    │ │ngưng    │
└─────────┘ └────┬────┘
                 │
                 └──────────┐
                            │
                            ▼
                     ┌──────────────┐
                     │Dev Đang      │
                     │thực hiện     │
                     └──────────────┘
```

### 4.4. Luồng DMS

```
┌──────────────┐
│  Chuyển DMS  │
└──────┬───────┘
       │
       ▼
┌──────────────┐
│  Tạo task    │
└──────┬───────┘
       │
       ▼
┌──────────────┐
│DMS Đang      │
│thực hiện     │
└──────┬───────┘
       │
  ┌────┴────┐
  │         │
  ▼         ▼
┌─────────┐ ┌─────────┐
│Hoàn     │ │DMS Tạm  │
│thành    │ │ngưng    │
└─────────┘ └────┬────┘
                 │
                 └──────────┐
                            │
                            ▼
                     ┌──────────────┐
                     │DMS Đang      │
                     │thực hiện     │
                     └──────────────┘
```

---

## 5. Các Table Database Liên Quan

### 5.1. Bảng Chính (Core Tables)

#### `customer_request_cases` - Bảng trung tâm
Bảng master lưu trữ thông tin yêu cầu khách hàng.

| Cột | Kiểu | Mô tả |
|-----|------|-------|
| `id` | bigint | ID yêu cầu (Primary Key) |
| `request_code` | varchar(50) | Mã yêu cầu (Unique) |
| `customer_id` | bigint | Khách hàng (FK → customers) |
| `customer_personnel_id` | bigint | Người yêu cầu phía khách hàng |
| `support_service_group_id` | bigint | Nhóm hỗ trợ |
| `received_by_user_id` | bigint | Người tiếp nhận (FK → internal_users) |
| `dispatcher_user_id` | bigint | Người điều phối (FK → internal_users) |
| `performer_user_id` | bigint | Người xử lý (FK → internal_users) |
| `summary` | varchar(500) | Nội dung yêu cầu |
| `description` | text | Mô tả chi tiết |
| `priority` | tinyint | Độ ưu tiên 1-4 |
| `current_status_code` | varchar(80) | Trạng thái hiện tại |
| `created_by`, `updated_by` | bigint | Người tạo/cập nhật |

### 5.2. Bảng Trạng Thái

#### `customer_request_status_catalogs` - Danh mục trạng thái
| Cột | Kiểu | Mô tả |
|-----|------|-------|
| `id` | bigint | ID trạng thái (PK) |
| `status_code` | varchar(80) | Mã trạng thái |
| `status_name_vi` | varchar(255) | Tên tiếng Việt |
| `table_name` | varchar(120) | Tên bảng |

#### `customer_request_status_instances` - Chuỗi trạng thái
| Cột | Kiểu | Mô tả |
|-----|------|-------|
| `id` | bigint | ID instance (PK) |
| `request_case_id` | bigint | FK yêu cầu |
| `status_code` | varchar(80) | Mã trạng thái |
| `is_current` | boolean | Là trạng thái hiện tại |

### 5.3. Bảng Hỗ Trợ

| Table | Mô tả |
|-------|-------|
| `customer_request_estimates` | Ước lượng giờ |
| `customer_request_worklogs` | Worklog thực hiện |
| `customer_request_escalations` | Thác quyền/Khó khăn |
| `customer_request_status_ref_tasks` | Task tham chiếu |
| `customer_request_status_attachments` | File đính kèm |

---

## 6. Các Vai Trò và Quyền Hạn

| Vai trò | Ký hiệu | Quyền chính |
|---------|---------|-------------|
| **Receiver/Creator** | R | - Tiếp nhận yêu cầu<br>- Giao việc cho mình<br>- Thực hiện và hoàn thành |
| **Admin/PM** | A | - Điều phối yêu cầu<br>- Giao cho R hoặc các nhóm<br>- Phê duyệt hoàn thành |
| **Tất cả** | Tất cả | - Xem toàn bộ quy trình<br>- Chuyển tiếp theo quy định |

---

## 7. Quy Tắc Chuyển Trạng Thái

### 7.1. Từ trạng thái "Tiếp nhận"
- Có thể → **Giao R thực hiện**
- Có thể → **Giao PM/Trả YC cho PM**

### 7.2. Từ trạng thái "Giao R thực hiện" (R thực hiện)
- Có thể → **R Đang thực hiện**
- Có thể → **Giao PM/Trả YC cho PM**

### 7.3. Từ trạng thái "Giao PM/Trả YC cho PM" (A thực hiện)
- Có thể → **Không tiếp nhận**
- Có thể → **Chờ khách hàng cung cấp thông tin**
- Có thể → **Giao R thực hiện**
- Có thể → **Chuyển BA Phân tích**
- Có thể → **Chuyển DMS**
- Có thể → **Lập trình**
- Có thể → **Hoàn thành**

### 7.4. Từ trạng thái "Hoàn thành"
- A có thể → **Giao R thực hiện**
- Tất cả có thể → **Giao PM/Trả YC cho PM**
- Tất cả có thể → **Thông báo khách hàng**

### 7.5. Từ trạng thái "R Đang thực hiện" (R thực hiện)
- Có thể → **Hoàn thành**
- Có thể → **Giao PM/Trả YC cho PM**

### 7.6. Từ trạng thái "Chuyển BA Phân tích" (R thực hiện)
- Có thể → **Chuyển BA Phân tích hoàn thành**
- Có thể → **Chuyển BA Phân tích tạm ngưng**
- Có thể → **Giao PM/Trả YC cho PM**

### 7.7. Từ trạng thái "Chuyển BA Phân tích hoàn thành"
- Tất cả có thể → **Chuyển DMS**
- Tất cả có thể → **Lập trình**
- R có thể → **Giao PM/Trả YC cho PM**

### 7.8. Từ trạng thái "Chuyển BA Phân tích tạm ngưng" (R thực hiện)
- Có thể → **Chuyển BA Phân tích**
- Có thể → **Chuyển BA Phân tích hoàn thành**
- Có thể → **Giao PM/Trả YC cho PM**

### 7.9. Từ trạng thái "Chuyển DMS"
- Tất cả có thể → **Tạo task**
- Tất cả có thể → **Giao PM/Trả YC cho PM**

### 7.10. Từ trạng thái "Tạo task"
- Tất cả có thể → **DMS Đang thực hiện**
- Tất cả có thể → **Giao PM/Trả YC cho PM**

### 7.11. Từ trạng thái "DMS Đang thực hiện"
- Tất cả có thể → **Hoàn thành**
- Tất cả có thể → **DMS tạm ngưng**
- Tất cả có thể → **Giao PM/Trả YC cho PM**

### 7.12. Từ trạng thái "DMS tạm ngưng"
- Tất cả có thể → **DMS Đang thực hiện**
- Tất cả có thể → **Giao PM/Trả YC cho PM**

### 7.13. Từ trạng thái "Lập trình" (R thực hiện)
- Có thể → **Dev đang thực hiện**
- Có thể → **Giao PM/Trả YC cho PM**

### 7.14. Từ trạng thái "Dev đang thực hiện" (R thực hiện)
- Có thể → **Hoàn thành**
- Có thể → **Dev tạm ngưng**
- Có thể → **Giao PM/Trả YC cho PM**

### 7.15. Từ trạng thái "Dev tạm ngưng" (R thực hiện)
- Có thể → **Dev đang thực hiện**
- Có thể → **Giao PM/Trả YC cho PM**

---

## 8. Entity Relationship Diagram (ERD)

```
┌─────────────────────────┐
│   customer_request_cases│ (PK: id)
├─────────────────────────┤
│ id                  (PK)│
│ request_code            │
│ customer_id         (FK)│───┐
│ customer_personnel_id(FK)│──┤
│ support_service_...  │  │  │
│ received_by_user_id(FK)│──┼──┤
│ dispatcher_user_id (FK)│──┼──┼──┐
│ performer_user_id  (FK)│──┼──┼──┤
│ current_status_... │  │  │  │  │
│ summary               │  │  │  │  │
│ description           │  │  │  │  │
│ priority              │  │  │  │  │
│ created_by         (FK)│──┼──┼──┤
│ updated_by         (FK)│──┼──┼──┤
└─────────────────────────┘  │  │  │
         │                   │  │  │
         │ 1:N               │  │  │
         ▼                   │  │  │
┌─────────────────────────┐  │  │  │
│customer_request_status_ │  │  │  │
│       instances         │  │  │  │
├─────────────────────────┤  │  │  │
│ id                  (PK)│  │  │  │
│ request_case_id     (FK)│◄─┘  │  │
│ status_code             │     │  │
│ is_current              │     │  │
└─────────────────────────┘     │  │
         │                      │  │
         │ 1:1                  │  │
         │                      │  │
         ▼                      │  │
┌─────────────────────────┐    │  │
│   STATUS TABLES         │    │  │
│                         │    │  │
│ - estimates             │    │  │
│ - worklogs              │    │  │
│ - escalations           │    │  │
│ - ref_tasks             │    │  │
│ - attachments           │    │  │
└─────────────────────────┘    │  │
                               │  │
┌─────────────────────────┐    │  │
│   internal_users        │◄───┘  │
├─────────────────────────┤       │
│ id                  (PK)│       │
│ full_name               │       │
│ email                   │       │
└─────────────────────────┘       │
                                  │
┌─────────────────────────┐       │
│   customers             │◄──────┘
├─────────────────────────┤
│ id                  (PK)│
│ customer_name           │
└─────────────────────────┘
```

---

## 9. Quy Trình Tạo Yêu Cầu Mới (Cập Nhật)

### 9.1. Nguồn Dữ Liệu Nhân Sự Từ Dự Án

Danh sách nhân sự để phân công được load từ chức năng **Quản lý dự án (/projects)** → **Đội ngũ dự án**.

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    NGUỒN DỮ LIỆU NHÂN SỰ                                     │
└─────────────────────────────────────────────────────────────────────────────┘

    ┌─────────────────┐
    │  QUẢN LÝ DỰ ÁN  │
    │  (/projects)    │
    └────────┬────────┘
             │
             ▼
    ┌─────────────────┐
    │  ĐỘI NGŨ DỰ ÁN  │
    │  (Project Team) │
    └────────┬────────┘
             │
             │ Lưu trữ RACI assignments
             ▼
    ┌─────────────────────────────────────────────────────────────┐
    │  PROJECT_RACI_ASSIGNMENTS TABLE                             │
    │                                                              │
    │  - project_item_id: Hạng mục dự án                         │
    │  - user_id: Người dùng                                     │
    │  - raci_role: RACI role (R, A, C, I)                       │
    │  - created_at, updated_at                                  │
    └─────────────────────────────────────────────────────────────┘
```

### 9.2. Cơ Chế Load Danh Sách Theo Vai Trò

| Vai trò trong workflow | Nguồn dữ liệu | Mô tả |
|------------------------|---------------|-------|
| **R (Receiver/Creator)** | `project_raci_assignments` với `raci_role = 'R'` | Chỉ load những người có vai trò R trong dự án |
| **A (Admin/PM)** | `project_raci_assignments` với `raci_role = 'A'` | Chỉ load những người có vai trò A trong dự án |
| **Tất cả** | Toàn bộ `project_raci_assignments` của dự án | Load tất cả nhân sự trong đội ngũ dự án |

### 9.3. API Load Nhân Sự Theo Dự Án

```
GET /api/v5/projects/{projectItemId}/raci-users?role={R|A|all}
```

**Response:**
```json
{
  "data": [
    {
      "id": 1,
      "full_name": "Nguyễn Văn A",
      "email": "a@example.com",
      "raci_role": "R"
    },
    {
      "id": 2,
      "full_name": "Trần Thị B",
      "email": "b@example.com",
      "raci_role": "A"
    }
  ]
}
```

### 9.4. Luồng Tạo Yêu Cầu Không Chọn Hướng Xử Lý

Khi người dùng click **"Thêm yêu cầu"**, form tạo mới sẽ hiển thị mà **không có ô chọn "Hướng xử lý"**. 

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    LUỒNG TẠO YÊU CẦU MỚI (CẬP NHẬT)                          │
└─────────────────────────────────────────────────────────────────────────────┘

    ┌──────────────┐
    │  CLICK "THÊM │
    │   YÊU CẦU"   │
    └──────┬───────┘
           │
           ▼
    ┌─────────────────────────────────────────────────────────────┐
    │  FORM TẠO MỚI HIỂN THỊ                                       │
    │  ┌───────────────────────────────────────────────────────┐  │
    │  │ Các trường thông tin cơ bản:                          │  │
    │  │ - Khách hàng                                          │  │
    │  │ - Nhóm hỗ trợ                                         │  │
    │  │ - Tóm tắt yêu cầu                                     │  │
    │  │ - Mô tả chi tiết                                      │  │
    │  │ - Priority                                            │  │
    │  │ - Attachments                                         │  │
    │  │ - Reference tasks                                     │  │
    │  └───────────────────────────────────────────────────────┘  │
    │                                                              │
    │  ⚠️ KHÔNG CÓ ô chọn "Hướng xử lý"                           │
    └─────────────────────────────────────────────────────────────┘
           │
           │ Người dùng nhập thông tin và click "Lưu"
           ▼
    ┌─────────────────────────────────────────────────────────────┐
    │  LƯU YÊU CẦU VỚI TRẠNG THÁI MẶC ĐỊNH                        │
    │                                                              │
    │  - status_code: `new_intake` (Mới tiếp nhận)               │
    │  - dispatch_route: NULL (chưa xác định)                    │
    │  - performer_user_id: NULL (chưa gán)                      │
    │  - dispatcher_user_id: NULL (chưa gán)                     │
    └─────────────────────────────────────────────────────────────┘
           │
           ▼
    ┌─────────────────────────────────────────────────────────────┐
    │  YÊU CẦU ĐƯỢC TẠO THÀNH CÔNG                                │
    │  và chuyển sang trạng thái "Tiếp nhận"                      │
    └─────────────────────────────────────────────────────────────┘
           │
           │ Từ đây, các vai trò có thể thực hiện các transitions
           ▼
    ┌─────────────────────────────────────────────────────────────┐
    │  CÁC TRANSITIONS CÓ THỂ THỰC HIỆN                           │
    │  (theo ma trận chuyển tiếp đã định nghĩa)                   │
    │                                                              │
    │  - Tất cả: Tiếp nhận → Giao R thực hiện                    │
    │  - Tất cả: Tiếp nhận → Giao PM/Trả YC cho PM               │
    └─────────────────────────────────────────────────────────────┘
```

### 9.5. Lợi Ích Của Việc Không Chọn Hướng Xử Lý Khi Tạo

| Trước (Có ô chọn) | Sau (Không có ô chọn) |
|-------------------|----------------------|
| Người tạo phải quyết định ngay | Người tạo chỉ cần nhập thông tin cơ bản |
| Có thể chọn sai do thiếu thông tin | PM/người có thẩm quyền sẽ quyết định sau |
| Tăng độ phức tạp form tạo | Form tạo đơn giản, tập trung vào nội dung |
| Khó thay đổi sau khi tạo | Dễ dàng điều phối sau khi tạo |

### 9.6. Các Bước Tiếp Theo Sau Khi Tạo Yêu Cầu

Sau khi yêu cầu được tạo với trạng thái `new_intake`:

| Vai trò | Hành động có thể |
|---------|-----------------|
| **Người tạo (R)** | - Giao cho mình thực hiện<br>- Giao cho PM điều phối |
| **Admin/PM (A)** | - Giao cho R<br>- Giao cho BA phân tích<br>- Chuyển DMS<br>- Giao lập trình<br>- Hoàn thành ngay (nếu yêu cầu đơn giản) |

---

## 10. Thiết Kế Table Cho Ma Trận Chuyển Tiếp

### 10.1. Table: `workflow_transitions`

Table này lưu trữ toàn bộ ma trận chuyển tiếp giữa các task trong quy trình.

```sql
CREATE TABLE workflow_transitions (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY COMMENT 'ID chuyển tiếp',
    
    -- Phạm vi quy trình
    process_type VARCHAR(50) NOT NULL DEFAULT 'customer_request' COMMENT 'Loại quy trình',
    workflow_group VARCHAR(100) NOT NULL DEFAULT 'default' COMMENT 'Nhóm workflow',
    
    -- Thông tin chuyển tiếp
    from_task_code VARCHAR(100) NOT NULL COMMENT 'Mã task nguồn',
    from_task_name_vi VARCHAR(255) COMMENT 'Tên task nguồn tiếng Việt',
    to_task_code VARCHAR(100) NOT NULL COMMENT 'Mã task đích',
    to_task_name_vi VARCHAR(255) COMMENT 'Tên task đích tiếng Việt',
    
    -- Vai trò được phép thực hiện
    allowed_roles JSON COMMENT 'Danh sách vai trò được phép: ["R", "A", "all"]',
    is_auto_transition BOOLEAN DEFAULT FALSE COMMENT 'Tự động chuyển hay cần xác nhận',
    
    -- Cấu hình hiển thị
    sort_order SMALLINT UNSIGNED DEFAULT 0 COMMENT 'Thứ tự hiển thị',
    is_active BOOLEAN DEFAULT TRUE COMMENT 'Còn hiệu lực',
    is_default BOOLEAN DEFAULT FALSE COMMENT 'Là đường dẫn mặc định',
    
    -- Metadata bổ sung
    transition_config JSON COMMENT 'Cấu hình bổ sung (notification, validation, etc.)',
    description TEXT COMMENT 'Mô tả chuyển tiếp',
    
    -- Audit
    created_by BIGINT UNSIGNED COMMENT 'Người tạo',
    updated_by BIGINT UNSIGNED COMMENT 'Người cập nhật',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    deleted_at TIMESTAMP NULL COMMENT 'Soft delete',
    
    -- Indexes
    INDEX idx_from_task (from_task_code, is_active),
    INDEX idx_to_task (to_task_code, is_active),
    INDEX idx_process_type (process_type, workflow_group, is_active),
    INDEX idx_allowed_roles ((CAST(allowed_roles AS CHAR(255) ARRAY))),
    
    -- Foreign keys (optional)
    FOREIGN KEY (created_by) REFERENCES internal_users(id) ON DELETE SET NULL,
    FOREIGN KEY (updated_by) REFERENCES internal_users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Ma trận chuyển tiếp workflow';
```

### 10.2. Dữ Liệu Seed Mẫu

```sql
-- Insert dữ liệu từ ma trận chuyển tiếp
INSERT INTO workflow_transitions (
    process_type, workflow_group,
    from_task_code, from_task_name_vi,
    to_task_code, to_task_name_vi,
    allowed_roles, is_active, sort_order
) VALUES
-- Bắt đầu → Tiếp nhận
('customer_request', 'default', 'start', 'Bắt đầu', 'new_intake', 'Tiếp nhận', '["all"]', TRUE, 1),

-- Từ Tiếp nhận
('customer_request', 'default', 'new_intake', 'Tiếp nhận', 'assigned_to_receiver', 'Giao R thực hiện', '["all"]', TRUE, 10),
('customer_request', 'default', 'new_intake', 'Tiếp nhận', 'pending_dispatch', 'Giao PM/Trả YC cho PM', '["all"]', TRUE, 20),

-- Từ Giao R thực hiện
('customer_request', 'default', 'assigned_to_receiver', 'Giao R thực hiện', 'receiver_in_progress', 'R Đang thực hiện', '["R"]', TRUE, 30),
('customer_request', 'default', 'assigned_to_receiver', 'Giao R thực hiện', 'pending_dispatch', 'Giao PM/Trả YC cho PM', '["R"]', TRUE, 40),

-- Từ Giao PM/Trả YC cho PM
('customer_request', 'default', 'pending_dispatch', 'Giao PM/Trả YC cho PM', 'not_executed', 'Không tiếp nhận', '["A"]', TRUE, 50),
('customer_request', 'default', 'pending_dispatch', 'Giao PM/Trả YC cho PM', 'waiting_customer_feedback', 'Chờ KH cung cấp thông tin', '["A"]', TRUE, 60),
('customer_request', 'default', 'pending_dispatch', 'Giao PM/Trả YC cho PM', 'assigned_to_receiver', 'Giao R thực hiện', '["A"]', TRUE, 70),
('customer_request', 'default', 'pending_dispatch', 'Giao PM/Trả YC cho PM', 'analysis', 'Chuyển BA Phân tích', '["A"]', TRUE, 80),
('customer_request', 'default', 'pending_dispatch', 'Giao PM/Trả YC cho PM', 'dms_transfer', 'Chuyển DMS', '["A"]', TRUE, 90),
('customer_request', 'default', 'pending_dispatch', 'Giao PM/Trả YC cho PM', 'coding', 'Lập trình', '["A"]', TRUE, 100),
('customer_request', 'default', 'pending_dispatch', 'Giao PM/Trả YC cho PM', 'completed', 'Hoàn thành', '["A"]', TRUE, 110),

-- Từ Hoàn thành
('customer_request', 'default', 'completed', 'Hoàn thành', 'assigned_to_receiver', 'Giao R thực hiện', '["A"]', TRUE, 120),
('customer_request', 'default', 'completed', 'Hoàn thành', 'pending_dispatch', 'Giao PM/Trả YC cho PM', '["all"]', TRUE, 130),
('customer_request', 'default', 'completed', 'Hoàn thành', 'customer_notified', 'Thông báo khách hàng', '["all"]', TRUE, 140),

-- Từ R Đang thực hiện
('customer_request', 'default', 'receiver_in_progress', 'R Đang thực hiện', 'completed', 'Hoàn thành', '["R"]', TRUE, 150),
('customer_request', 'default', 'receiver_in_progress', 'R Đang thực hiện', 'pending_dispatch', 'Giao PM/Trả YC cho PM', '["R"]', TRUE, 160),

-- Từ Không tiếp nhận
('customer_request', 'default', 'not_executed', 'Không tiếp nhận', 'customer_notified', 'Thông báo khách hàng', '["all"]', TRUE, 170),
('customer_request', 'default', 'not_executed', 'Không tiếp nhận', 'pending_dispatch', 'Giao PM/Trả YC cho PM', '["all"]', TRUE, 180),

-- Từ Chờ KH cung cấp thông tin
('customer_request', 'default', 'waiting_customer_feedback', 'Chờ KH cung cấp thông tin', 'assigned_to_receiver', 'Giao R thực hiện', '["all"]', TRUE, 190),
('customer_request', 'default', 'waiting_customer_feedback', 'Chờ KH cung cấp thông tin', 'pending_dispatch', 'Giao PM/Trả YC cho PM', '["all"]', TRUE, 200),

-- Từ Chuyển BA Phân tích
('customer_request', 'default', 'analysis', 'Chuyển BA Phân tích', 'analysis_completed', 'BA Phân tích hoàn thành', '["R"]', TRUE, 210),
('customer_request', 'default', 'analysis', 'Chuyển BA Phân tích', 'analysis_suspended', 'BA Phân tích tạm ngưng', '["R"]', TRUE, 220),
('customer_request', 'default', 'analysis', 'Chuyển BA Phân tích', 'pending_dispatch', 'Giao PM/Trả YC cho PM', '["R"]', TRUE, 230),

-- Từ BA Phân tích hoàn thành
('customer_request', 'default', 'analysis_completed', 'BA Phân tích hoàn thành', 'dms_transfer', 'Chuyển DMS', '["all"]', TRUE, 240),
('customer_request', 'default', 'analysis_completed', 'BA Phân tích hoàn thành', 'coding', 'Lập trình', '["all"]', TRUE, 250),
('customer_request', 'default', 'analysis_completed', 'BA Phân tích hoàn thành', 'pending_dispatch', 'Giao PM/Trả YC cho PM', '["R"]', TRUE, 260),

-- Từ BA Phân tích tạm ngưng
('customer_request', 'default', 'analysis_suspended', 'BA Phân tích tạm ngưng', 'analysis', 'Chuyển BA Phân tích', '["all"]', TRUE, 270),
('customer_request', 'default', 'analysis_suspended', 'BA Phân tích tạm ngưng', 'analysis_completed', 'BA Phân tích hoàn thành', '["R"]', TRUE, 280),
('customer_request', 'default', 'analysis_suspended', 'BA Phân tích tạm ngưng', 'pending_dispatch', 'Giao PM/Trả YC cho PM', '["R"]', TRUE, 290),

-- Từ Chuyển DMS
('customer_request', 'default', 'dms_transfer', 'Chuyển DMS', 'dms_task_created', 'Tạo task', '["all"]', TRUE, 300),
('customer_request', 'default', 'dms_transfer', 'Chuyển DMS', 'pending_dispatch', 'Giao PM/Trả YC cho PM', '["all"]', TRUE, 310),

-- Từ Tạo task
('customer_request', 'default', 'dms_task_created', 'Tạo task', 'dms_in_progress', 'DMS Đang thực hiện', '["all"]', TRUE, 320),
('customer_request', 'default', 'dms_task_created', 'Tạo task', 'pending_dispatch', 'Giao PM/Trả YC cho PM', '["all"]', TRUE, 330),

-- Từ DMS Đang thực hiện
('customer_request', 'default', 'dms_in_progress', 'DMS Đang thực hiện', 'completed', 'Hoàn thành', '["all"]', TRUE, 340),
('customer_request', 'default', 'dms_in_progress', 'DMS Đang thực hiện', 'dms_suspended', 'DMS tạm ngưng', '["all"]', TRUE, 350),
('customer_request', 'default', 'dms_in_progress', 'DMS Đang thực hiện', 'pending_dispatch', 'Giao PM/Trả YC cho PM', '["all"]', TRUE, 360),

-- Từ DMS tạm ngưng
('customer_request', 'default', 'dms_suspended', 'DMS tạm ngưng', 'dms_in_progress', 'DMS Đang thực hiện', '["all"]', TRUE, 370),
('customer_request', 'default', 'dms_suspended', 'DMS tạm ngưng', 'pending_dispatch', 'Giao PM/Trả YC cho PM', '["all"]', TRUE, 380),

-- Từ Lập trình
('customer_request', 'default', 'coding', 'Lập trình', 'coding_in_progress', 'Dev đang thực hiện', '["R"]', TRUE, 390),
('customer_request', 'default', 'coding', 'Lập trình', 'pending_dispatch', 'Giao PM/Trả YC cho PM', '["R"]', TRUE, 400),

-- Từ Dev đang thực hiện
('customer_request', 'default', 'coding_in_progress', 'Dev đang thực hiện', 'completed', 'Hoàn thành', '["R"]', TRUE, 410),
('customer_request', 'default', 'coding_in_progress', 'Dev đang thực hiện', 'coding_suspended', 'Dev tạm ngưng', '["R"]', TRUE, 420),
('customer_request', 'default', 'coding_in_progress', 'Dev đang thực hiện', 'pending_dispatch', 'Giao PM/Trả YC cho PM', '["R"]', TRUE, 430),

-- Từ Dev tạm ngưng
('customer_request', 'default', 'coding_suspended', 'Dev tạm ngưng', 'coding_in_progress', 'Dev đang thực hiện', '["R"]', TRUE, 440),
('customer_request', 'default', 'coding_suspended', 'Dev tạm ngưng', 'pending_dispatch', 'Giao PM/Trả YC cho PM', '["R"]', TRUE, 450),

-- Kết thúc: Thông báo khách hàng
('customer_request', 'default', 'customer_notified', 'Thông báo khách hàng', 'pending_dispatch', 'Giao PM/Trả YC cho PM', '["all"]', TRUE, 460);
```

### 10.3. Query Examples

#### Lấy tất cả transitions khả dụng từ một task
```sql
SELECT 
    to_task_code,
    to_task_name_vi,
    allowed_roles,
    sort_order
FROM workflow_transitions
WHERE from_task_code = 'pending_dispatch'
  AND is_active = TRUE
ORDER BY sort_order;
```

#### Kiểm tra xem một role có thể thực hiện transition không
```sql
SELECT EXISTS(
    SELECT 1 FROM workflow_transitions
    WHERE from_task_code = 'pending_dispatch'
      AND to_task_code = 'completed'
      AND is_active = TRUE
      AND JSON_CONTAINS(allowed_roles, '"A"')
) AS can_transition;
```

#### Lấy transition mặc định từ một task
```sql
SELECT * FROM workflow_transitions
WHERE from_task_code = 'new_intake'
  AND is_active = TRUE
  AND is_default = TRUE
ORDER BY sort_order
LIMIT 1;
```

### 10.4. API Endpoints Cho Workflow Transitions

| Method | Endpoint | Mô tả |
|--------|----------|-------|
| GET | `/api/v5/workflow-transitions?from_task={code}` | Lấy transitions khả dụng |
| GET | `/api/v5/workflow-transitions/{id}` | Chi tiết transition |
| POST | `/api/v5/workflow-transitions` | Tạo transition mới |
| PUT | `/api/v5/workflow-transitions/{id}` | Cập nhật transition |
| DELETE | `/api/v5/workflow-transitions/{id}` | Xóa transition (soft delete) |
| POST | `/api/v5/workflow-transitions/validate` | Validate transition có hợp lệ |

---

## 11. Tổng Kết

Hệ thống Quản lý yêu cầu khách hàng được thiết kế theo mô hình workflow-driven với các đặc điểm chính:

1. **Task-driven workflow**: Mỗi task quyết định các bước tiếp theo khả dụng
2. **Role-based transitions**: Quyền chuyển trạng thái dựa trên vai trò (R, A, Tất cả)
3. **Multiple execution paths**: Hỗ trợ nhiều nhánh xử lý (R thực hiện, BA, Dev, DMS)
4. **Flexible routing**: Có thể quay lại các bước trước hoặc chuyển nhánh linh hoạt
5. **Audit trail**: Lưu trữ lịch sử chuyển trạng thái
6. **Integration-ready**: Liên kết với customers, internal_users, và các entity khác

---

## 12. Tóm Tắt Plan Thực Hiện

### 12.1. Tổng Quan

Hệ thống Quản lý yêu cầu khách hàng sẽ được nâng cấp theo mô hình workflow-driven với các thay đổi chính:

| Aspect | Hiện tại | Mục tiêu |
|--------|----------|----------|
| Tạo yêu cầu | Có ô chọn hướng xử lý | Không có ô chọn hướng xử lý |
| Phân công | Hardcode | Theo RACI từ dự án |
| Chuyển trạng thái | Frontend-driven | Backend-driven theo config |
| Nhân sự | Danh sách tĩnh | Load từ project_raci_assignments |

### 12.2. Frontend - Bổ Sung và Thay Đổi

#### 12.2.1. Component CustomerRequestCreateModal
**Thay đổi:**
- ❌ **XÓA**: Ô chọn "Hướng xử lý" (dispatch_route selector)
- ✅ **GIỮ NGUYÊN**: Các trường thông tin cơ bản
  - Khách hàng
  - Nhóm hỗ trợ
  - Tóm tắt yêu cầu
  - Mô tả chi tiết
  - Priority
  - Attachments
  - Reference tasks

**File liên quan:**
- `frontend/components/customer-request/CustomerRequestCreateModal.tsx`

#### 12.2.2. Component CustomerRequestFieldRenderer
**Bổ sung:**
- ✅ Logic load danh sách nhân sự theo project_item_id
- ✅ Filter danh sách theo vai trò R/A/Tất cả

**File liên quan:**
- `frontend/components/customer-request/CustomerRequestFieldRenderer.tsx`

#### 12.2.3. API Integration
**Bổ sung hook mới:**
```typescript
// hooks/useProjectRaciUsers.ts
export const useProjectRaciUsers = (
  projectItemId: string | number,
  role: 'R' | 'A' | 'all'
) => {
  // GET /api/v5/projects/{projectItemId}/raci-users?role={role}
}
```

#### 12.2.4. Transition Modal
**Thay đổi:**
- ✅ Load danh sách người dùng theo vai trò từ workflow_transitions
- ✅ Hiển thị available_actions từ backend response

**File liên quan:**
- `frontend/components/customer-request/CustomerRequestTransitionModal.tsx`

### 12.3. Backend - Bổ Sung và Thay Đổi

#### 12.3.1. SQL Script (Không dùng Migration)

**Lưu ý:** Hệ thống sử dụng SQL script trực tiếp thay vì Laravel Migration.

**Thư mục chứa SQL script:**
```
qlcv2/database/sql-patches/2026-03-26_workflow_transitions/
├── 001_create_workflow_transitions_table.sql
├── 002_seed_workflow_transitions.sql
└── README.md
```

**Cách thực thi:**
1. Đặt thư mục script vào `qlcv2/database/sql-patches/`
2. Cấu hình trong `thongtin.txt`:
   ```
   database mysql: 
     host: localhost
     password: rỗng
     port: 3306
     username: root
   ```
3. Chạy script SQL:
   ```bash
   # Kết nối MySQL và chạy script
   mysql -h localhost -P 3306 -u root < database/sql-patches/2026-03-26_workflow_transitions/001_create_workflow_transitions_table.sql
   
   # Chạy seed dữ liệu
   mysql -h localhost -P 3306 -u root < database/sql-patches/2026-03-26_workflow_transitions/002_seed_workflow_transitions.sql
   ```

**Nội dung file 001_create_workflow_transitions_table.sql:**
```sql
-- ============================================
-- Script: Tạo bảng workflow_transitions
-- Ngày: 2026-03-26
-- Mô tả: Bảng lưu trữ ma trận chuyển tiếp workflow
-- ============================================

USE vnpt_business_db;

-- Tạo bảng workflow_transitions
CREATE TABLE IF NOT EXISTS workflow_transitions (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY COMMENT 'ID chuyển tiếp',
    
    -- Phạm vi quy trình
    process_type VARCHAR(50) NOT NULL DEFAULT 'customer_request' COMMENT 'Loại quy trình',
    workflow_group VARCHAR(100) NOT NULL DEFAULT 'default' COMMENT 'Nhóm workflow',
    
    -- Thông tin chuyển tiếp
    from_task_code VARCHAR(100) NOT NULL COMMENT 'Mã task nguồn',
    from_task_name_vi VARCHAR(255) COMMENT 'Tên task nguồn tiếng Việt',
    to_task_code VARCHAR(100) NOT NULL COMMENT 'Mã task đích',
    to_task_name_vi VARCHAR(255) COMMENT 'Tên task đích tiếng Việt',
    
    -- Vai trò được phép thực hiện
    allowed_roles JSON COMMENT 'Danh sách vai trò được phép: ["R", "A", "all"]',
    is_auto_transition BOOLEAN DEFAULT FALSE COMMENT 'Tự động chuyển hay cần xác nhận',
    
    -- Cấu hình hiển thị
    sort_order SMALLINT UNSIGNED DEFAULT 0 COMMENT 'Thứ tự hiển thị',
    is_active BOOLEAN DEFAULT TRUE COMMENT 'Còn hiệu lực',
    is_default BOOLEAN DEFAULT FALSE COMMENT 'Là đường dẫn mặc định',
    
    -- Metadata bổ sung
    transition_config JSON COMMENT 'Cấu hình bổ sung (notification, validation, etc.)',
    description TEXT COMMENT 'Mô tả chuyển tiếp',
    
    -- Audit
    created_by BIGINT UNSIGNED COMMENT 'Người tạo',
    updated_by BIGINT UNSIGNED COMMENT 'Người cập nhật',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT 'Thời điểm tạo',
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT 'Thời điểm cập nhật',
    deleted_at TIMESTAMP NULL COMMENT 'Thời điểm xóa mềm',
    
    -- Indexes
    INDEX idx_from_task (from_task_code, is_active),
    INDEX idx_to_task (to_task_code, is_active),
    INDEX idx_process_type (process_type, workflow_group, is_active)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Ma trận chuyển tiếp workflow';
```

**Nội dung file 002_seed_workflow_transitions.sql:**
```sql
-- ============================================
-- Script: Seed dữ liệu workflow_transitions
-- Ngày: 2026-03-26
-- Mô tả: Insert 46 transitions từ ma trận chuyển tiếp
-- ============================================

USE vnpt_business_db;

-- Xóa dữ liệu cũ (nếu cần)
-- TRUNCATE TABLE workflow_transitions;

-- Insert transitions
INSERT INTO workflow_transitions (
    process_type, workflow_group,
    from_task_code, from_task_name_vi,
    to_task_code, to_task_name_vi,
    allowed_roles, is_active, sort_order
) VALUES
-- Bắt đầu → Tiếp nhận
('customer_request', 'default', 'start', 'Bắt đầu', 'new_intake', 'Tiếp nhận', '["all"]', TRUE, 1),

-- Từ Tiếp nhận
('customer_request', 'default', 'new_intake', 'Tiếp nhận', 'assigned_to_receiver', 'Giao R thực hiện', '["all"]', TRUE, 10),
('customer_request', 'default', 'new_intake', 'Tiếp nhận', 'pending_dispatch', 'Giao PM/Trả YC cho PM', '["all"]', TRUE, 20),

-- ... (tiếp tục các transitions khác như đã định nghĩa)
;
```

**File README.md:**
```markdown
# Workflow Transitions SQL Patch

## Ngày tạo: 2026-03-26

## Mô tả
Tạo bảng workflow_transitions để lưu trữ ma trận chuyển tiếp workflow cho chức năng Quản lý yêu cầu khách hàng.

## Files
- `001_create_workflow_transitions_table.sql` - Tạo bảng
- `002_seed_workflow_transitions.sql` - Seed dữ liệu

## Cách chạy
```bash
# Chạy trên local
mysql -h localhost -P 3306 -u root < 001_create_workflow_transitions_table.sql
mysql -h localhost -P 3306 -u root < 002_seed_workflow_transitions.sql

# Chạy trên production (cập nhật thông tin kết nối)
mysql -h {host} -P {port} -u {username} -p < 001_create_workflow_transitions_table.sql
mysql -h {host} -P {port} -u {username} -p < 002_seed_workflow_transitions.sql
```

## Rollback (nếu cần)
```sql
DROP TABLE IF EXISTS workflow_transitions;
```
```

#### 12.3.2. Model
**File mới:**
- `backend/app/Models/WorkflowTransition.php`

```php
class WorkflowTransition extends Model
{
    protected $table = 'workflow_transitions';
    
    protected $fillable = [
        'process_type',
        'workflow_group',
        'from_task_code',
        'from_task_name_vi',
        'to_task_code',
        'to_task_name_vi',
        'allowed_roles', // JSON
        'is_auto_transition',
        'sort_order',
        'is_active',
        'is_default',
        'transition_config', // JSON
        'description',
    ];
    
    protected $casts = [
        'allowed_roles' => 'array',
        'transition_config' => 'array',
        'is_auto_transition' => 'boolean',
        'is_active' => 'boolean',
        'is_default' => 'boolean',
    ];
}
```

#### 12.3.3. Service
**File mới:**
- `backend/app/Services/V5/Workflow/WorkflowTransitionService.php`

**Chức năng:**
```php
class WorkflowTransitionService
{
    // Lấy transitions khả dụng từ một task
    public function getAvailableTransitions(string $fromTaskCode, string $role = null): Collection;
    
    // Kiểm tra role có thể thực hiện transition không
    public function canTransition(string $fromTaskCode, string $toTaskCode, string $role): bool;
    
    // Lấy transition mặc định
    public function getDefaultTransition(string $fromTaskCode): ?WorkflowTransition;
    
    // Validate transition
    public function validateTransition(string $fromTaskCode, string $toTaskCode, string $role): bool;
}
```

#### 12.3.4. Controller
**File mới/bổ sung:**
- `backend/app/Http/Controllers/Api/V5/WorkflowTransitionController.php`

**Endpoints:**
```php
// GET /api/v5/workflow-transitions
public function index(Request $request): JsonResponse;

// GET /api/v5/workflow-transitions/{id}
public function show(int $id): JsonResponse;

// POST /api/v5/workflow-transitions
public function store(Request $request): JsonResponse;

// PUT /api/v5/workflow-transitions/{id}
public function update(Request $request, int $id): JsonResponse;

// DELETE /api/v5/workflow-transitions/{id}
public function destroy(int $id): JsonResponse;

// POST /api/v5/workflow-transitions/validate
public function validate(Request $request): JsonResponse;
```

#### 12.3.5. Project RACI API
**File mới:**
- `backend/app/Http/Controllers/Api/V5/ProjectRaciController.php`

**Endpoint:**
```php
// GET /api/v5/projects/{projectItemId}/raci-users?role={R|A|all}
public function raciUsers(int $projectItemId, Request $request): JsonResponse
{
    $role = $request->get('role', 'all');
    
    $query = DB::table('project_raci_assignments')
        ->join('internal_users', 'project_raci_assignments.user_id', '=', 'internal_users.id')
        ->where('project_raci_assignments.project_item_id', $projectItemId);
    
    if ($role !== 'all') {
        $query->where('project_raci_assignments.raci_role', $role);
    }
    
    $users = $query->select('internal_users.*', 'project_raci_assignments.raci_role')->get();
    
    return response()->json(['data' => $users]);
}
```

#### 12.3.6. CustomerRequestController Update
**Bổ sung:**
- ✅ Inject WorkflowTransitionService
- ✅ Validate transition theo config khi update
- ✅ Trả về available_actions trong response

**File liên quan:**
- `backend/app/Http/Controllers/Api/V5/CustomerRequestController.php`

#### 12.3.7. CustomerRequestWorkflowService Update
**Bổ sung:**
- ✅ Logic kiểm tra allowed_roles
- ✅ Resolve available_actions theo role context

**File liên quan:**
- `backend/app/Services/V5/Workflow/CustomerRequestWorkflowService.php`

### 12.4. Database - SQL Scripts (Không dùng Migration)

#### 12.4.1. Cấu Trúc Thư Mục SQL Scripts

```
qlcv2/database/sql-patches/2026-03-26_workflow_transitions/
├── 001_create_workflow_transitions_table.sql    (Tạo bảng)
├── 002_seed_workflow_transitions.sql            (Seed dữ liệu)
└── README.md                                     (Hướng dẫn)
```

#### 12.4.2. Cách Thực Thi SQL Scripts

**Bước 1:** Kiểm tra kết nối database trong `thongtin.txt`:
```
database mysql: 
  host: localhost
  password: rỗng
  port: 3306
  username: root
```

**Bước 2:** Chạy script SQL từ command line:
```bash
cd c:\Users\pchgi\Documents\code\qlcv2

# Chạy script tạo bảng
mysql -h localhost -P 3306 -u root < database/sql-patches/2026-03-26_workflow_transitions/001_create_workflow_transitions_table.sql

# Chạy script seed dữ liệu
mysql -h localhost -P 3306 -u root < database/sql-patches/2026-03-26_workflow_transitions/002_seed_workflow_transitions.sql
```

**Hoặc sử dụng MySQL Workbench/HeidiSQL:**
1. Mở MySQL Workbench/HeidiSQL
2. Kết nối với database `vnpt_business_db`
3. Mở file `001_create_workflow_transitions_table.sql` và execute
4. Mở file `002_seed_workflow_transitions.sql` và execute

#### 12.4.3. Table Đã Tồn Tại (Sử dụng lại)
- `project_raci_assignments` - Lưu RACI assignments của dự án
- `customer_request_cases` - Bảng trung tâm
- `customer_request_status_catalogs` - Danh mục trạng thái
- `customer_request_status_instances` - Chuỗi trạng thái

### 12.5. Timeline Thực Hiện Đề Xuất

| Phase | Công việc | Estimated Time |
|-------|-----------|----------------|
| **Phase 1** | Tạo SQL scripts trong database/sql-patches/ | 0.5 day |
| **Phase 2** | Chạy SQL scripts + Tạo Model | 0.5 day |
| **Phase 3** | Backend Service + Controller | 1 day |
| **Phase 4** | Project RACI API | 0.5 day |
| **Phase 5** | Frontend CreateModal update | 0.5 day |
| **Phase 6** | Frontend Transition integration | 1 day |
| **Phase 7** | Testing + Bug fixes | 0.5 day |

**Tổng thời gian ước tính:** 4.5 days

---

## Phụ Lục: Mapping Trạng Thái Với Database

| Task trong Excel | status_code tương ứng | table_name |
|-----------------|----------------------|------------|
| Tiếp nhận | `new_intake` | customer_request_cases |
| Giao R thực hiện | `assigned_to_receiver` | customer_request_cases |
| Giao PM/Trả YC cho PM | `pending_dispatch` | customer_request_pending_dispatch |
| R Đang thực hiện | `in_progress` | customer_request_in_progress |
| Không tiếp nhận | `not_executed` | customer_request_not_executed |
| Chờ khách hàng cung cấp thông tin | `waiting_customer_feedback` | customer_request_waiting_customer_feedbacks |
| Chuyển BA Phân tích | `analysis` | customer_request_analysis |
| Chuyển BA Phân tích hoàn thành | `analysis_completed` | customer_request_analysis |
| Chuyển BA Phân tích tạm ngưng | `analysis_suspended` | customer_request_analysis |
| Chuyển DMS | `dms_transfer` | customer_request_dms_transfer |
| Tạo task | `dms_task_created` | customer_request_dms_transfer |
| DMS Đang thực hiện | `dms_in_progress` | customer_request_dms_transfer |
| DMS tạm ngưng | `dms_suspended` | customer_request_dms_transfer |
| Lập trình | `coding` | customer_request_coding |
| Dev đang thực hiện | `coding_in_progress` | customer_request_coding |
| Dev tạm ngưng | `coding_suspended` | customer_request_coding |
| Hoàn thành | `completed` | customer_request_completed |
| Thông báo khách hàng | `customer_notified` | customer_request_customer_notified |