# KẾ HOẠCH REFACTOR CRC WORKFLOW-DYNAMIC NATIVE

**Ngày tạo:** 2026-03-31
**Phạm vi:** Customer Request Management (CRC)
**Trạng thái:** Draft for implementation

---

## 1. Context

CRC hiện đang ở trạng thái “nửa động nửa tĩnh”:
- luồng chuyển trạng thái đã đi theo cấu hình workflow ở backend
- nhưng metadata runtime vẫn bị hardcode ở nhiều nơi qua `CustomerRequestCaseRegistry`, `customer_request_status_catalogs`, và các rule local trong frontend `presentation.ts`

Vì tính năng chưa có dữ liệu production chính thức, đây là thời điểm phù hợp để refactor luôn sang mô hình **workflow-dynamic native**, thay vì tiếp tục vá catalog tĩnh.

### Mục tiêu chính
- workflow config trở thành nguồn sự thật duy nhất cho metadata runtime của CRC
- backend không còn phụ thuộc runtime vào `CustomerRequestCaseRegistry`
- frontend không còn tự suy luận status/transition/action bằng map cứng
- `nguoi_xu_ly_id` vẫn được giữ làm field master cho “Người xử lý hiện tại”, nhưng cách xác định handler phải đi theo metadata workflow động

---

## 2. Nhận định sau khi rà soát codebase

### 2.1. Backend hiện còn hardcode ở các điểm chính
- `backend/app/Services/V5/Domain/CustomerRequestCaseRegistry.php`
  - hardcode `status_name_vi`, `table_name`, `list_columns`, `form_fields`
- `backend/app/Services/V5/CustomerRequest/CustomerRequestCaseReadQueryService.php`
  - còn join `customer_request_status_catalogs` để lấy label / handler metadata
- `backend/app/Services/V5/CustomerRequest/CustomerRequestCaseReadModelService.php`
  - còn fallback về registry và mapping owner theo status code
- `backend/app/Services/V5/CustomerRequest/CustomerRequestCaseWriteService.php`
  - còn hardcode validate form, apply defaults, allowed targets, owner sync
- `backend/app/Services/V5/Domain/CustomerRequestCaseDomainService.php`
  - vẫn shape transition/detail bằng rule cứng sau khi đọc DB transitions

### 2.2. Frontend hiện còn hardcode ở các điểm chính
- `frontend/components/customer-request/presentation.ts`
  - `STATUS_COLOR_MAP`
  - alias status
  - hidden statuses
  - intake-lane branching
  - synthetic PM decision node
  - primary action logic
  - owner inference
- `frontend/components/CustomerRequestManagementHub.tsx`
  - còn reshape transition options local
- `frontend/components/customer-request/dispatcherWorkspace.ts`
  - bucket/group logic vẫn dựa trên tập status code cứng
- `frontend/components/customer-request/hooks/useCustomerRequestTransition.ts`
  - success label và một phần target handling vẫn phụ thuộc map local

### 2.3. Khoảng trống kiến trúc hiện tại
- workflow hiện điều khiển **flow** khá tốt
- nhưng metadata runtime của CRC chưa thật sự đi theo workflow
- `customer_request_status_catalogs` hiện chưa đủ giàu để thay thế registry/presentation hardcode

---

## 3. Recommended architecture

## 3.1. Dùng CRC workflow metadata trong DB làm runtime source of truth

Giữ `customer_request_status_catalogs` và `customer_request_status_transitions` làm nền runtime hiện có, nhưng mở rộng để chúng chứa đủ metadata mà hiện nay đang bị hardcode.

### Status metadata tối thiểu cần có
- `group_code`
- `group_label`
- `list_columns_json`
- `form_fields_json`
- `ui_meta_json`
  - màu hiển thị
  - hidden / visible
  - alias
  - bucket / workspace grouping
  - action hint
  - terminal flag
  - owner hint
- `handler_field`
- `storage_mode` hoặc cờ tương đương để biết status lưu trên master hay detail table

### Transition metadata tối thiểu cần có
- `transition_meta_json`
  - decision context / outcome
  - actor / role restrictions
  - lane restrictions
  - payload defaults
  - synthetic option grouping
  - action label / action tone nếu cần

### Master metadata cần có
- `master_fields_json` hoặc nguồn config tương đương cho phần field chung của CRC

---

## 3.2. `CustomerRequestCaseRegistry` chỉ còn là nguồn seed tạm thời

Refactor theo hướng:
- migration seed metadata DB từ registry hiện tại + các rule frontend hiện đang hardcode
- runtime backend/frontend chỉ đọc từ metadata DB
- sau khi rollout ổn định thì loại bỏ dependency runtime vào registry

Registry không còn là runtime source of truth.

---

## 3.3. Tạo một backend metadata provider thống nhất

Tạo service chuyên trách trong `backend/app/Services/V5/CustomerRequest/` để expose thống nhất:
- `getMasterFields()`
- `getStatusCatalog()`
- `getStatusMeta(statusCode)`
- `getAllowedTransitions(statusCode, caseContext)`
- `getStatusFormFields(statusCode)`
- `getStatusListColumns(statusCode)`
- `resolveHandlerField(statusCode)`
- `resolveUiMeta(statusCode)`

Service này phải là entry point chung cho:
- read query
- read model
- domain service
- write service

Không để mỗi service fallback một kiểu như hiện nay.

---

## 4. Implementation plan

## 4.1. Phase A — Mở rộng schema metadata

### Việc làm
- thêm migration mở rộng `customer_request_status_catalogs`
- thêm migration mở rộng `customer_request_status_transitions`
- thêm chỗ chứa `master_fields` động nếu chưa có bảng/cột phù hợp

### Dữ liệu seed ban đầu lấy từ
- `backend/app/Services/V5/Domain/CustomerRequestCaseRegistry.php`
- `frontend/components/customer-request/presentation.ts`
- các rule hiện có trong:
  - `CustomerRequestCaseWriteService.php`
  - `CustomerRequestCaseDomainService.php`

### Kết quả mong muốn
DB đủ giàu để backend không phải quay lại hỏi registry/map cứng nữa.

---

## 4.2. Phase B — Xây backend metadata provider

### Việc làm
- tạo metadata provider mới
- normalize toàn bộ status/transition metadata từ DB
- chuẩn hóa output cho catalog/detail/transition APIs

### Refactor các file chính
- `backend/app/Services/V5/CustomerRequest/CustomerRequestCaseReadQueryService.php`
- `backend/app/Services/V5/CustomerRequest/CustomerRequestCaseReadModelService.php`
- `backend/app/Services/V5/Domain/CustomerRequestCaseDomainService.php`

### Kết quả mong muốn
- list/detail/timeline/process catalog đều dùng chung nguồn metadata động
- label/handler/process info không còn chắp vá nhiều nguồn

---

## 4.3. Phase C — Chuyển write path sang metadata động

### Việc làm
- thay validate form theo registry bằng `form_fields_json`
- resolve status storage/table theo metadata DB
- resolve `handler_field` và owner sync theo metadata DB
- tiếp tục sync `customer_request_cases.nguoi_xu_ly_id` như field master

### File chính
- `backend/app/Services/V5/CustomerRequest/CustomerRequestCaseWriteService.php`

### Lưu ý
Các side-effect nghiệp vụ thật sự quan trọng như:
- `performer_user_id`
- `completed_at`
- `reported_to_customer_at`
- các cột master tương tự

có thể vẫn cần lớp projection rõ ràng ở backend, nhưng lớp đó phải đọc rule từ metadata thay vì switch cứng toàn bộ theo status code.

---

## 4.4. Phase D — Đưa toàn bộ transition shaping về backend

### Việc làm
- bỏ filter transition hardcode rải rác ở domain/write service
- tạo evaluator chung dựa trên metadata workflow động để quyết định:
  - allowed next statuses
  - previous statuses
  - decision options
  - hidden/synthetic transition options
  - lane logic (`dispatch_route`, PM/self-handle, ...)

### Kết quả mong muốn
Frontend chỉ render transition options backend trả về, không tự shape lại.

---

## 4.5. Phase E — Refactor frontend về render-only

### Việc làm
Refactor các file sau để chỉ render metadata backend trả về:
- `frontend/components/customer-request/presentation.ts`
- `frontend/components/CustomerRequestManagementHub.tsx`
- `frontend/components/customer-request/hooks/useCustomerRequestTransition.ts`
- `frontend/components/customer-request/hooks/useCustomerRequestDetail.ts`
- `frontend/components/customer-request/dispatcherWorkspace.ts`
- `frontend/components/customer-request/CustomerRequestTransitionModal.tsx`

### Loại bỏ dần khỏi frontend
- `STATUS_COLOR_MAP`
- status alias map
- hidden status logic
- intake-lane branching
- synthetic PM decision node
- local primary-action logic
- owner inference performer/dispatcher/receiver
- workspace bucket theo status-code set cứng

### Kết quả mong muốn
Frontend không cần biết nghiệp vụ transition/status chi tiết; chỉ cần render payload backend.

---

## 4.6. Phase F — Dọn dependency runtime tĩnh

### Việc làm
- gỡ runtime usage của `CustomerRequestCaseRegistry`
- chỉ giữ registry làm seed tham chiếu tạm thời nếu còn cần
- sau khi xác nhận đủ metadata DB thì dọn hẳn

---

## 5. Vai trò của `nguoi_xu_ly_id`

`nguoi_xu_ly_id` vẫn nên được giữ lại vì nó giải quyết đúng một nhu cầu rất thực tế:
- frontend và báo cáo cần một nguồn chung về “Người xử lý hiện tại”
- không phải suy luận từ nhiều field status-specific

### Nguyên tắc
- `nguoi_xu_ly_id` là canonical current handler field trên `customer_request_cases`
- nhưng rule xác định handler hiện tại phải đi theo metadata động:
  - `handler_field`
  - owner hint
  - transition/default rule
- `serializeCaseRow()` tiếp tục trả:
  - `nguoi_xu_ly_id`
  - `nguoi_xu_ly_name`

---

## 6. Critical files

### Backend
- `backend/database/migrations/2026_03_16_220000_create_customer_request_case_workflow_tables.php`
- `backend/database/migrations/2026_03_21_100200_seed_v4_status_catalog_and_transitions.php`
- migration mới mở rộng metadata cho `customer_request_status_catalogs` / `customer_request_status_transitions`
- `backend/app/Services/V5/Domain/CustomerRequestCaseRegistry.php`
- `backend/app/Services/V5/CustomerRequest/CustomerRequestCaseReadQueryService.php`
- `backend/app/Services/V5/CustomerRequest/CustomerRequestCaseReadModelService.php`
- `backend/app/Services/V5/CustomerRequest/CustomerRequestCaseWriteService.php`
- `backend/app/Services/V5/Domain/CustomerRequestCaseDomainService.php`
- service metadata/evaluator mới trong `backend/app/Services/V5/CustomerRequest/`

### Frontend
- `frontend/components/CustomerRequestManagementHub.tsx`
- `frontend/components/customer-request/presentation.ts`
- `frontend/components/customer-request/hooks/useCustomerRequestDetail.ts`
- `frontend/components/customer-request/hooks/useCustomerRequestTransition.ts`
- `frontend/components/customer-request/dispatcherWorkspace.ts`
- `frontend/components/customer-request/CustomerRequestTransitionModal.tsx`
- `frontend/types.ts` hoặc `frontend/types/customerRequest.ts`

---

## 7. Verification

### Backend
- API status catalog trả đủ metadata động cho mỗi status:
  - label
  - group
  - storage mode / table
  - form fields
  - list columns
  - handler field
  - ui meta
- API transition/detail trả transition options đã được backend shape xong
- save/transition chạy chỉ dựa vào metadata DB đã seed
- `nguoi_xu_ly_id` vẫn sync đúng sau save/transition ở các status chính

### Frontend
- CRC list/detail/hover/workspace/transition modal render đúng khi backend đổi label/color/group/action mà không cần sửa code map local
- không còn phụ thuộc vào status-code set cứng trong presentation/workspace

### Test đề xuất
- Frontend:
  - `cd frontend && npx vitest run __tests__/crc-status-v4.test.ts`
- Backend:
  - thêm test chứng minh một status mới/metadata mới chỉ cần seed config là xuất hiện đúng mà không cần thêm hardcode PHP/TS
- Nếu env không chạy được PHPUnit:
  - verify bằng API thực tế các endpoint CRC list/detail/transition/statuses

---

## 8. 5 điểm đã chốt trước khi code

Sau khi đối chiếu lại code hiện tại, 5 điểm còn thiếu đã được chốt như sau.

### 8.1. Chốt nơi lưu `master_fields` động
**Quyết định:** tạo bảng metadata riêng cho workflow CRC, gắn theo `workflow_definition_id`.

Lý do:
- `customer_request_status_catalogs` là metadata theo từng status; `master_fields` là metadata cấp workflow/catalog tổng thể, không thuộc riêng một status.
- `frontend` hiện đang đọc process catalog theo shape:
  - `master_fields: YeuCauProcessField[]`
  - `groups: YeuCauProcessGroup[]`
  tại `frontend/types.ts:1227`
- nếu nhét `master_fields` vào một row status bất kỳ sẽ làm sai ngữ nghĩa và khó mở rộng multi-workflow.

**Đề xuất cụ thể:**
- thêm bảng mới, ví dụ `customer_request_workflow_metadata`
- khóa chính logic: `workflow_definition_id`
- cột tối thiểu:
  - `workflow_definition_id`
  - `master_fields_json`
  - `catalog_ui_meta_json` (nếu cần cho group-level metadata dùng chung)
  - timestamps

**Hệ quả implementation:**
- `fetchYeuCauProcessCatalog()` vẫn có thể giữ contract `master_fields + groups`, nhưng backend sẽ assemble từ:
  - `customer_request_workflow_metadata.master_fields_json`
  - các row status thuộc workflow đó

### 8.2. Chốt khóa metadata theo workflow nào
**Quyết định:** metadata status/transition phải gắn theo `workflow_definition_id + status_code`, không dùng global status code làm source of truth duy nhất.

Lý do:
- model `WorkflowDefinition` đã là thực thể active/default theo `process_type`, có `config` riêng (`backend/app/Models/WorkflowDefinition.php:50-74`)
- `WorkflowTransition` hiện đã mang `workflow_definition_id` (`backend/app/Models/WorkflowTransition.php:43-65`)
- nếu chỉ khóa theo global `status_code` thì cùng một `status_code` ở 2 workflow khác nhau sẽ không thể có:
  - label khác nhau
  - form fields khác nhau
  - list columns khác nhau
  - transition meta khác nhau

**Đề xuất cụ thể:**
- thêm `workflow_definition_id` vào `customer_request_status_catalogs`
- unique key nên chuyển thành kiểu:
  - `(workflow_definition_id, status_code)`
- `customer_request_status_transitions` cũng phải có hoặc chuẩn hóa theo:
  - `workflow_definition_id`
  - `from_status_code`
  - `to_status_code`
  - `direction`

**Hệ quả implementation:**
- metadata provider luôn phải resolve workflow hiện tại của case trước, rồi mới đọc status metadata.
- `customer_request_cases` cần tiếp tục mang `workflow_definition_id` ổn định làm khóa runtime.

### 8.3. Chốt ranh giới giữa metadata động và side-effect nghiệp vụ
**Quyết định:** chia thành 2 lớp rõ ràng.

#### A. Metadata-driven
Các phần sau được đưa ra metadata động:
- label / group / màu / visibility
- `form_fields`
- `list_columns`
- `handler_field`
- `storage_mode` / `table_name`
- transition options / action label / decision context
- bucket / workspace grouping hint

#### B. Explicit domain projection trong PHP
Các side-effect cập nhật master case column vẫn giữ explicit code ở backend, nhưng được kích hoạt theo metadata thay vì switch cứng toàn bộ theo status code.

Danh sách hiện đã xác định từ `CustomerRequestCaseWriteService.php`:
- luôn explicit:
  - `current_status_code` (`CustomerRequestCaseWriteService.php:1024`)
  - `current_status_instance_id`
  - `current_status_changed_at`
  - `updated_by`
- explicit projection theo payload/status:
  - `performer_user_id` (`CustomerRequestCaseWriteService.php:1029-1030`)
  - `dispatcher_user_id` (`CustomerRequestCaseWriteService.php:1033-1034`)
  - `nguoi_xu_ly_id` (`CustomerRequestCaseWriteService.php:1037-1043`)
  - `completed_at` (`CustomerRequestCaseWriteService.php:1055-1056`)
  - `reported_to_customer_at` (`CustomerRequestCaseWriteService.php:1058-1059`)
- explicit defaulting/projected handler logic hiện còn ở:
  - `applyStatusDefaults()` (`CustomerRequestCaseWriteService.php:728`)
  - `syncCaseCurrentStatus()` (`CustomerRequestCaseWriteService.php:1017`)

**Kết luận chốt:**
- không đưa các side-effect master-field quan trọng thành JSON “tù mù” 100%
- thay vào đó dùng metadata để quyết định *rule nào áp dụng*, còn thao tác cập nhật master case vẫn nằm trong PHP projection layer rõ ràng

### 8.4. Chốt migration/backfill strategy
**Quyết định:** rollout theo 4 migration/data steps tách biệt.

#### Step 1 — Schema
- thêm `workflow_definition_id` vào `customer_request_status_catalogs` nếu chưa có
- thêm các cột metadata JSON cho status
- thêm các cột metadata JSON cho transitions
- thêm bảng `customer_request_workflow_metadata`

#### Step 2 — Seed metadata
- seed metadata ban đầu từ:
  - `CustomerRequestCaseRegistry::masterFields()` (`backend/app/Services/V5/Domain/CustomerRequestCaseRegistry.php:10`)
  - `CustomerRequestCaseRegistry::definitions()` (`backend/app/Services/V5/Domain/CustomerRequestCaseRegistry.php:88`)
  - các rule hiện đang hardcode ở `presentation.ts:84-260`
  - các default/transition rules đang có trong `CustomerRequestCaseWriteService.php`
- seed theo từng workflow active/default đang tồn tại, không seed global một bản duy nhất

#### Step 3 — Backfill runtime linkage
- backfill `customer_request_cases.workflow_definition_id` nếu còn case cũ chưa có
- backfill `customer_request_status_catalogs.workflow_definition_id` cho các row status hiện tại
- backfill các status đang thiếu metadata nhưng đã tồn tại trong registry/runtime
- không backfill “mù” các row không còn dùng

#### Step 4 — Compatibility window
- trong một vòng rollout ngắn, metadata provider có thể fallback sang registry nếu row metadata thiếu
- sau khi seed xong và verify ổn, xóa fallback runtime

**Nguyên tắc tránh nổ endpoint:**
- mọi read path mới phải guard khi metadata DB chưa đầy đủ
- chỉ bỏ fallback sau khi migration + seed + verification hoàn thành

### 8.5. Chốt contract payload backend → frontend
**Quyết định:** giữ shape chính hiện tại để giảm blast radius, nhưng mở rộng nó để frontend không cần suy luận local nữa.

#### A. Process catalog payload
Giữ shape hiện tại theo `frontend/types.ts:1201-1229`:
- `master_fields: YeuCauProcessField[]`
- `groups: YeuCauProcessGroup[]`

Mỗi `YeuCauProcessMeta` mở rộng thêm tối thiểu:
- `ui_meta?: {`
  - `color_token?: string`
  - `hidden_in_ui?: boolean`
  - `alias_of?: string | null`
  - `bucket_code?: string | null`
  - `owner_mode?: string | null`
  - `primary_action?: { kind: string; label: string; icon?: string; target_status_code?: string | null } | null`
  - `is_terminal?: boolean`
  - `is_runtime_only?: boolean`
  - `storage_mode?: 'master' | 'detail'`
  - `workflow_definition_id?: string | number`
`}`

#### B. Process detail payload
Giữ shape hiện tại theo `frontend/types.ts:1589-1605`:
- `yeu_cau`
- `current_status`
- `current_process`
- `process`
- `allowed_next_processes`
- `allowed_previous_processes`
- `available_actions`

Mở rộng thêm:
- `workflow_definition_id`
- `owner_meta?: {`
  - `handler_field?: string | null`
  - `handler_user_id?: string | number | null`
  - `handler_user_name?: string | null`
  - `owner_mode?: string | null`
`}`

#### C. Transition option payload
Không chỉ trả `YeuCauProcessMeta[]` đơn thuần; mỗi option trong `allowed_next_processes` phải chứa đủ:
- `process_code`
- `process_label`
- `decision_context_code`
- `decision_outcome_code`
- `decision_source_status_code`
- `ui_meta.primary_action`
- `ui_meta.hidden_in_ui`
- `ui_meta.alias_of`
- `transition_meta?: {`
  - `action_label?: string`
  - `action_icon?: string`
  - `action_tone?: string`
  - `requires_handler?: boolean`
  - `synthetic_group_key?: string | null`
  - `lane_key?: string | null`
`}`

#### D. Available actions payload
Thay vì frontend tự suy luận mạnh như hiện tại, `available_actions` nên được backend enrich thêm label/UI hint:
- ví dụ không chỉ `can_add_worklog`, mà còn có thể có `quick_actions?: []`
- nếu chưa muốn đổi lớn ngay, ít nhất backend phải trả đủ transition/process metadata để `presentation.ts` không phải tự dựng quick action như hiện tại

**Kết luận chốt:**
- giữ backward-compatible contract cơ bản
- enrich metadata trong chính các object hiện có
- tránh tạo thêm một contract hoàn toàn mới khiến frontend/backend đổi quá lớn cùng lúc

---

## 9. Kết luận

Plan này giờ đã chốt đủ 5 điểm thiết kế quan trọng trước khi code:
- nơi lưu `master_fields`
- khóa metadata theo workflow
- ranh giới metadata vs domain side-effects
- strategy migration/backfill
- contract payload backend → frontend

Với trạng thái hiện tại của repo, hướng triển khai phù hợp nhất là:
1. mở rộng metadata DB theo workflow
2. seed từ registry + hardcode hiện tại
3. dựng metadata provider
4. refactor backend read/write/evaluator
5. refactor frontend về render-only
6. xóa dần runtime fallback tĩnh

Plan này hiện đã đủ chi tiết để bắt đầu implement mà không phải đổi schema/API contract giữa chừng.