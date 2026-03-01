Tôi cần thực hiện các thay đổi sau trong dự án VNPT Business Management:

## Yêu cầu tổng quan
Trong modal "Tạo trạng thái yêu cầu hỗ trợ": bỏ checkbox "Trạng thái kết thúc", thay bằng checkbox "Chuyển Dev". Khi user chọn trạng thái có cấu hình "Chuyển dev" trong form yêu cầu hỗ trợ, hiện thêm nút "Chuyển dev" màu cam bên cạnh nút Lưu. Bấm nút đó sẽ đóng form hỗ trợ, chuyển sang tab yêu cầu lập trình và mở form "Thêm yêu cầu lập trình" với dữ liệu tự động điền sẵn từ form hỗ trợ.

## Chi tiết từng bước

### Bước 1: Sửa frontend/types.ts
Thêm field is_transfer_dev?: boolean vào interface SupportRequestStatusOption (khoảng line 390-403).

### Bước 2: Sửa modal tạo trạng thái trong frontend/components/SupportRequestList.tsx
- Thêm state: const [newStatusIsTransferDev, setNewStatusIsTransferDev] = useState(false);
- Trong modal "Tạo trạng thái yêu cầu hỗ trợ" (khoảng line 3637-3645): XÓA checkbox "Trạng thái kết thúc" (newStatusIsTerminal). Thay bằng checkbox mới label "Chuyển dev" dùng state newStatusIsTransferDev.
- Trong hàm handleCreateStatus (khoảng line 2254): thêm is_transfer_dev: newStatusIsTransferDev vào payload. Bỏ hoặc hardcode false cho is_terminal.
- Trong hàm resetCreateStatusModalState (khoảng line 1470): thêm setNewStatusIsTransferDev(false).

### Bước 3: Thêm logic tra cứu trạng thái chuyển dev trong SupportRequestList.tsx
- Trong useMemo statusDefinitions (khoảng line 1066-1130): thêm field is_transfer_dev: boolean vào type, map giá trị từ supportRequestStatuses data tương tự cách map is_terminal.
- Thêm useMemo mới statusTransferDevMap (tương tự statusRequiresCompletionMap ở line 1147): duyệt statusDefinitions, tạo Map<string, boolean> với key là status code, value là is_transfer_dev.

### Bước 4: Thêm nút "Chuyển dev" trong form yêu cầu hỗ trợ (SupportRequestList.tsx)
- Thêm prop mới vào interface SupportRequestListProps: onTransferDev?: (data: { customer_id: string; project_id: string; product_id: string; project_item_id: string; service_group_id: string; support_request_id?: string | number }) => void;
- Thêm hàm handleTransferDev: lấy customer_id, project_id, product_id, project_item_id, service_group_id từ formData, lấy support_request_id từ editingRequest?.id, gọi onTransferDev(data) rồi closeFormModal().
- Ở khu vực nút Lưu trong form: thêm điều kiện nếu statusTransferDevMap.get(formData.status) === true và onTransferDev tồn tại thì hiện thêm nút "Chuyển dev" màu cam (bg-orange-500), type="button", onClick gọi handleTransferDev. Nút này KHÔNG lưu form.

### Bước 5: Sửa frontend/App.tsx
- Thêm hàm handleTransferDevFromSupport nhận data từ SupportRequestList. Hàm này:
  + Tạo object prefill với source_type: 'FROM_SUPPORT', support_request_id, customer_id, project_id, product_id, project_item_id, service_group_id (convert sang Number).
  + Gọi setSelectedProgrammingRequest(prefill as IProgrammingRequest)
  + Gọi setProgrammingRequestModalMode('create')
  + Gọi setIsProgrammingRequestModalOpen(true)
  + Gọi setActiveTab('programming_requests')
- Truyền prop onTransferDev={handleTransferDevFromSupport} xuống component SupportRequestList (khoảng line 4361-4387).

### Bước 6: Backend migration
Tạo file migration mới trong backend/database/migrations/ để thêm cột is_transfer_dev (boolean, default false) vào bảng support_request_statuses.

### Bước 7: Backend controller
Trong file backend/app/Http/Controllers/Api/V5MasterDataController.php: tìm hàm CRUD cho support_request_statuses, thêm is_transfer_dev vào validation rules, payload, và select columns.

## Lưu ý
- KHÔNG cần sửa file ProgrammingRequestModal.tsx vì nó đã hỗ trợ sẵn nhận initialData với source_type FROM_SUPPORT.
- Giữ nguyên state newStatusIsTerminal trong code nhưng không hiện trên UI nữa.
- Dữ liệu gửi qua form lập trình gồm: Khách hàng, Dự án, Sản phẩm (từ Phần mềm triển khai), Nhóm Zalo/Telegram yêu cầu, ID yêu cầu hỗ trợ.
