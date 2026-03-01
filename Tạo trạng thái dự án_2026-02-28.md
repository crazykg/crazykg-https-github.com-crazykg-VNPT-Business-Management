Tôi cần thêm tính năng "Tạo trạng thái dự án" trong form Thêm mới/Cập nhật Dự án. Logic hoàn toàn tương tự cách "Tạo trạng thái" đang hoạt động trong form Thêm yêu cầu hỗ trợ (SupportRequestList.tsx).

## Tình trạng hiện tại

Trạng thái dự án đang HARDCODED:
- Frontend: PROJECT_STATUSES trong frontend/constants.ts (line 101-107) gồm 5 giá trị cố định: TRIAL, ONGOING, WARRANTY, COMPLETED, CANCELLED.
- Frontend: Form dự án ở frontend/components/Modals.tsx (line 2113-2118) dùng component FormSelect với options={PROJECT_STATUSES} cố định.
- Backend: Cột status trong bảng projects là ENUM('TRIAL','ONGOING','WARRANTY','COMPLETED','CANCELLED').
- KHÔNG có bảng project_statuses nào trong database.

## Yêu cầu

Chuyển trạng thái dự án từ hardcoded sang dynamic, cho phép user tạo trạng thái mới ngay trong form. Tham chiếu hoàn toàn theo pattern của SupportRequestList.tsx.

## Pattern tham chiếu: SupportRequestList.tsx

File: frontend/components/SupportRequestList.tsx
- Nút "Tạo trạng thái" nằm cạnh label "Trạng thái" (line 3278-3285): nút nhỏ có icon add, text "Tạo trạng thái"
- Modal tạo trạng thái (line 3574-3736): form với các field Mã trạng thái, Tên trạng thái, Mô tả, checkboxes, và phần Import hàng loạt
- State quản lý modal (line 1023-1028): isCreateStatusOpen, newStatusCode, newStatusName, newStatusDescription, newStatusRequiresDates, newStatusIsTerminal
- Hàm xử lý (line 2228-2271): handleCreateStatus - validate, gọi API, auto-select status mới
- Backend API: POST /api/v5/support-request-statuses (V5MasterDataController.php line 1687)
- Bảng DB: support_request_statuses (migration 2026_02_28_020000)

## Chi tiết từng bước

### Bước 1: Tạo bảng project_statuses trong database

Tạo file migration mới: backend/database/migrations/2026_02_28_060000_create_project_statuses_table.php
- Copy cấu trúc từ 2026_02_28_020000_create_support_request_statuses_table.php
- Bảng project_statuses gồm: id, status_code (varchar 50 unique), status_name (varchar 120), description (varchar 255 nullable), is_active (boolean default true), sort_order (unsigned int default 0), created_by (foreign key nullable), updated_by (foreign key nullable), timestamps
- KHÔNG cần requires_completion_dates và is_terminal (khác với support request)
- Seed 5 trạng thái mặc định từ PROJECT_STATUSES: TRIAL/Dùng thử, ONGOING/Đang triển khai theo hợp đồng, WARRANTY/Đã kết thúc - còn Bảo hành bảo trì, COMPLETED/Đã kết thúc, CANCELLED/Đã Huỷ

### Bước 2: Đổi cột status trong bảng projects từ ENUM sang VARCHAR

Tạo migration mới để ALTER TABLE projects MODIFY COLUMN status VARCHAR(50) NOT NULL DEFAULT 'TRIAL'. Điều này cho phép lưu status_code tùy ý thay vì chỉ 5 giá trị ENUM cố định.

### Bước 3: Backend - Thêm API endpoints cho project_statuses

File: backend/app/Http/Controllers/Api/V5MasterDataController.php
- Thêm hàm storeProjectStatus (copy logic từ storeSupportRequestStatus line 1687-1758, đổi tên bảng thành project_statuses, bỏ requires_completion_dates và is_terminal)
- Thêm hàm storeProjectStatusesBulk (copy từ storeSupportRequestStatusesBulk line 1760+)
- Thêm hàm getProjectStatuses để fetch danh sách trạng thái (copy pattern từ getSupportRequestStatuses, đổi bảng)

File routes: Thêm routes mới:
- GET /api/v5/project-statuses → getProjectStatuses
- POST /api/v5/project-statuses → storeProjectStatus
- POST /api/v5/project-statuses/bulk → storeProjectStatusesBulk

### Bước 4: Frontend - Thêm interface ProjectStatusOption

File: frontend/types.ts
- Thêm interface mới:
```typescript
export interface ProjectStatusOption {
  id: string | number | null;
  status_code: string;
  status_name: string;
  description?: string | null;
  is_active?: boolean;
  sort_order?: number | null;
  created_at?: string | null;
  created_by?: string | number | null;
  updated_at?: string | null;
  updated_by?: string | number | null;
}
```

### Bước 5: Frontend - Thêm API service functions

File: frontend/services/v5Api.ts
- Thêm hàm fetchProjectStatuses(): GET /api/v5/project-statuses
- Thêm hàm createProjectStatus(payload): POST /api/v5/project-statuses
- Thêm hàm createProjectStatusesBulk(payloads): POST /api/v5/project-statuses/bulk

### Bước 6: Frontend - Load và quản lý projectStatuses trong App.tsx

File: frontend/App.tsx
- Thêm state: const [projectStatuses, setProjectStatuses] = useState<ProjectStatusOption[]>([]);
- Load projectStatuses khi app init (trong hàm loadMasterData hoặc tương tự)
- Thêm hàm handleCreateProjectStatus tương tự handleCreateSupportRequestStatus
- Thêm hàm handleCreateProjectStatusesBulk
- Truyền thêm props xuống ProjectFormModal:
  + projectStatuses={projectStatuses}
  + onCreateProjectStatus={handleCreateProjectStatus}
  + onCreateProjectStatusesBulk={handleCreateProjectStatusesBulk}

### Bước 7: Frontend - Sửa ProjectFormModal trong Modals.tsx

File: frontend/components/Modals.tsx

7a. Cập nhật ProjectFormModalProps (line 1663-1673):
- Thêm props: projectStatuses: ProjectStatusOption[], onCreateProjectStatus: (payload) => Promise<ProjectStatusOption>, onCreateProjectStatusesBulk: (payloads) => Promise<BulkMutationResult<ProjectStatusOption>>

7b. Thêm state quản lý modal tạo trạng thái (copy pattern từ SupportRequestList):
- isCreateStatusOpen, newStatusCode, newStatusName, newStatusDescription
- statusFormError, statusFormSuccess, isCreatingStatus
- statusImportText, statusImportFile (cho import hàng loạt)

7c. Tạo statusOptions từ projectStatuses + PROJECT_STATUSES fallback:
- Dùng useMemo merge projectStatuses (từ DB) với PROJECT_STATUSES (fallback mặc định)
- Format thành { value: status_code, label: status_name } cho dropdown

7d. Thay thế FormSelect cũ (line 2113-2118):
- Bỏ: <FormSelect label="Trạng thái" ... options={PROJECT_STATUSES} />
- Thay bằng layout mới: label "Trạng thái" + nút "Tạo trạng thái" (icon add) ở cùng hàng, bên dưới là SearchableSelect/FormSelect với options từ statusOptions dynamic

7e. Thêm modal "Tạo trạng thái dự án":
- Copy toàn bộ cấu trúc modal từ SupportRequestList.tsx (line 3574-3736)
- Giữ: Mã trạng thái, Tên trạng thái, Mô tả
- Giữ: Phần Import hàng loạt (paste text + upload file)
- BỎ: checkbox "Bắt buộc nhập Hạn/Ngày hoàn thành" và "Trạng thái kết thúc" (không cần cho dự án)
- Đổi title thành "Tạo trạng thái dự án"

7f. Thêm hàm handleCreateStatus (copy logic từ SupportRequestList.tsx line 2228-2271):
- Validate tên trạng thái bắt buộc
- Auto-generate mã từ tên nếu để trống
- Kiểm tra trùng mã
- Gọi onCreateProjectStatus(payload)
- Thành công: auto-select trạng thái mới vào formData.status, đóng modal

7g. Thêm hàm handleCreateStatusBulk (copy logic từ SupportRequestList):
- Hỗ trợ import từ text và file
- Gọi onCreateProjectStatusesBulk

## Lưu ý quan trọng

- Giữ nguyên PROJECT_STATUSES trong constants.ts làm fallback/default. Khi DB chưa có data, dropdown vẫn hiển thị 5 trạng thái mặc định.
- Khi tạo trạng thái mới, tự động chọn trạng thái đó trong form (giống SupportRequestList handleCreateStatus line 2263).
- Cần copy các hàm helper từ SupportRequestList nếu chưa có: sanitizeStatusCode, buildStatusCodeFromName, parseStatusDraftsFromPlainText, loadStatusDraftsFromFile, parseStatusDraftsFromSheet. Hoặc extract chúng ra file utils chung để cả 2 nơi dùng lại.
- ProjectStatus type trong types.ts hiện là union type cố định. Cần đổi thành string để chấp nhận status_code tùy ý: export type ProjectStatus = string;
- Form dự án nằm trong Modals.tsx (không phải file riêng), nên cần cẩn thận khi sửa để không ảnh hưởng các modal khác trong file.
