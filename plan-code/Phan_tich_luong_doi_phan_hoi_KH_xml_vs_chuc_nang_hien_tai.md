# Phan tich luong PM danh gia thieu thong tin KH giua XML moi va runtime CRC

## Pham vi doi chieu
- XML baseline moi:
  - `/Users/pvro86gmail.com/Library/Mobile Documents/com~apple~CloudDocs/Temp trong ngày/workflowa.drawio.xml`
- XML cu de doi chieu thay doi:
  - `/Users/pvro86gmail.com/Library/Mobile Documents/com~apple~CloudDocs/Temp trong ngày/workflowa (1).drawio.xml`
- Runtime:
  - `frontend/components/customer-request/createFlow.ts`
  - `frontend/components/CustomerRequestManagementHub.tsx`
  - `frontend/components/customer-request/presentation.ts`
  - `frontend/components/customer-request/hooks/useCustomerRequestTransition.ts`
  - `backend/app/Services/V5/CustomerRequest/CustomerRequestCaseWriteService.php`
  - `backend/app/Services/V5/Domain/CustomerRequestCaseDomainService.php`
  - `backend/app/Services/V5/CustomerRequest/CustomerRequestCaseReadModelService.php`

## 0. Nguyen tac doc XML da chot

### 0.1. Chi hinh thoi dau tien di vao form tiep nhan
- Hinh thoi:
  - `Nguoi nhap YC danh gia kha nang tu ho tro, giao viec`
- Runtime create form chi map 2 nhanh:
  - `Giao YC cho R` -> `self_handle`
  - `Giao YC cho PM` -> `assign_pm`

### 0.2. Cac hinh thoi sau do la decision step ben ngoai create flow
- Cac diamond sau khi case da duoc tao khong duoc bien thanh branch create moi.
- Chung phai duoc map vao:
  - quick action
  - modal nghiep vu
  - runtime decision semantics
  - metadata timeline / audit

### 0.3. Runtime khong can tao status moi chi de bat chuoc diamond
- XML mo ta decision.
- Runtime duoc phep tai su dung status dich that.
- Vi vay `PM danh gia thieu TT KH` la decision step, khong phai status moi.

## 1. XML moi khac XML cu o dau

### 1.1. XML moi them mot diamond PM moi
- XML moi co them diamond:
  - `PM danh gia ly do do thieu thong tin tu khach hang`
- Diamond nay xuat hien o nhanh PM ngay sau intake.

### 1.2. XML cu da co mot diamond PM cu cung nghia
- XML cu von da co nhanh:
  - `PM danh gia ly do chua thuc hien duoc do khach hang chua cung cap du thong tin`
- Diamond nay nam sau nhanh `Tra YC cho PM`.

### 1.3. Ket luan nghiep vu
- XML moi khong tao ra status moi.
- XML moi yeu cau runtime hieu rang co **hai diem PM khac nhau ve vi tri** nhung **cung mot nghia decision**:
  - `Co, thieu thong tin KH` -> `waiting_customer_feedback`
  - `Khong, ly do khac` -> `not_executed`

## 2. Runtime CRC da align nhu the nao

### 2.1. Create flow van giu dung quy tac hinh thoi dau tien
- `self_handle` va `assign_pm` van la hai gia tri form intake.
- Khong dua diamond PM moi vao create form.

### 2.2. UI da gom hai diamond PM thanh mot decision step thong nhat
- Trong UI, ca hai truong hop:
  - `new_intake` o lane PM
  - `returned_to_manager`
- deu hien cung mot decision:
  - `PM danh gia thieu TT KH`

### 2.3. Backend da duoc day semantics xuong runtime
- Backend khong con chi tra ve raw transition vo nghia.
- Khi transition roi vao 2 dich:
  - `waiting_customer_feedback`
  - `not_executed`
- va nguon la:
  - `new_intake` lane PM
  - hoac `returned_to_manager`
- backend tu sinh metadata decision:
  - `decision_context_code = pm_missing_customer_info_review`
  - `decision_outcome_code = customer_missing_info | other_reason`
  - `decision_source_status_code = new_intake | returned_to_manager`

## 3. Anh xa nghiep vu da chot

| Diem trong XML | Dieu kien runtime | Status dich that | Decision metadata |
| --- | --- | --- | --- |
| `PM danh gia ly do do thieu thong tin tu khach hang` | `new_intake` lane PM -> `waiting_customer_feedback` | `waiting_customer_feedback` | `pm_missing_customer_info_review / customer_missing_info / new_intake` |
| `PM danh gia ly do do thieu thong tin tu khach hang` | `new_intake` lane PM -> `not_executed` | `not_executed` | `pm_missing_customer_info_review / other_reason / new_intake` |
| `PM danh gia ly do chua thuc hien duoc do KH chua cung cap du thong tin` | `returned_to_manager` -> `waiting_customer_feedback` | `waiting_customer_feedback` | `pm_missing_customer_info_review / customer_missing_info / returned_to_manager` |
| `PM danh gia ly do chua thuc hien duoc do KH chua cung cap du thong tin` | `returned_to_manager` -> `not_executed` | `not_executed` | `pm_missing_customer_info_review / other_reason / returned_to_manager` |

## 4. Timeline va audit sau khi align

### 4.1. Timeline
- `customer_request_status_instances` da luu:
  - `decision_context_code`
  - `decision_outcome_code`
  - `decision_source_status_code`
- API timeline tra them:
  - 3 field metadata tren
  - `decision_reason_label`
  - `ly_do`

### 4.2. Audit
- Moi status instance moi duoc ghi audit kem metadata decision.
- Muc tieu:
  - nhin lich su se biet PM da chon nhanh nao
  - khong chi thay raw status dich

## 5. Rule server-side de tranh lech UI va API

### 5.1. Backend tu suy ra decision metadata
- Neu API duoc goi truc tiep ma khong gui metadata, server van tu gan duoc tu:
  - `from_status`
  - `to_status`
  - intake lane

### 5.2. Backend chan metadata sai
- Neu client gui:
  - `decision_outcome_code`
  - `decision_context_code`
  - `decision_source_status_code`
- nhung khong khop voi nghia XML, server tra `422`.

## 6. Nhung gi khong thay doi
- Khong them status moi.
- Khong doi schema `customer_request_status_transitions`.
- Khong dua diamond PM vao create form.
- `waiting_customer_feedback` van la status cho that.
- `not_executed` van la status ket qua that.

## 7. Ket luan
- XML moi them mot diamond PM moi, nhung ban chat nghiep vu la cung mot decision da co trong XML cu.
- Runtime CRC da duoc align theo huong dung:
  - create form chi xu ly hinh thoi dau tien
  - hai diamond PM duoc gom thanh mot decision semantics thong nhat
  - status dich van giu nguyen
  - timeline va audit da mang du nghia nghiep vu theo XML moi
