# Kế hoạch Nâng cấp Kiến trúc Hệ thống VNPT Business Management — v1

> Tài liệu này là bản điều chỉnh từ `Nang_cap_kien_truc_he_thong.md` sau vòng review thứ hai.
> Mục tiêu của bản v1 là giữ nguyên kiến trúc đích, nhưng sửa lại mô hình triển khai để:
> - rollback thực sự dùng được
> - giảm blast radius của các đợt cutover lớn
> - nới timeline cho đúng với khối lượng verification bắt buộc

## 1. Bối cảnh và mục tiêu

`V5MasterDataController.php` hiện là điểm nghẽn lớn nhất của backend:
- file rất lớn
- ôm nhiều domain
- khó test độc lập
- merge conflict cao
- khó tách trách nhiệm khi nhiều người cùng sửa

**Mục tiêu không đổi**:
- tách code còn lại trong `V5MasterDataController.php`
- hội tụ vào pattern hiện có: `V5 controller + DomainService`
- không tạo kiến trúc song song mới
- giữ nguyên API contract
- chỉ xóa `V5MasterDataController.php` khi toàn bộ cutover đã hoàn tất và verify xong

## 2. Những điều chỉnh chính sau review

### 2.1. Rollback phải dùng `pre-batch ref`, không dùng `HEAD`

Bản cũ dùng `git checkout HEAD -- ...` cho rollback. Cách đó không an toàn vì sau khi batch đã merge vào branch hiện tại, `HEAD` chính là phiên bản mới đang lỗi.

**Bản v1 thay bằng nguyên tắc bắt buộc**:
- trước mỗi batch phải tạo một `pre-batch ref`
- rollback luôn restore từ `pre-batch ref`
- không được viết lệnh rollback tham chiếu `HEAD`

Mẫu tên ref:

```bash
git tag -f v5mdc-batch-03-pre
```

Hoặc nếu không muốn dùng tag:

```bash
git branch -f v5mdc-batch-03-pre
```

### 2.2. UserAccess không còn là một rollback unit 10k+ dòng

Khối UserAccess được chẻ lại thành 4 wave:
- Wave 08: extract nội bộ, chưa cutover route
- Wave 09: read endpoints
- Wave 10: role/permission writes
- Wave 11: dept-scope cutover

Mục tiêu là:
- tách rủi ro theo hành vi
- tạo điểm dừng tự nhiên giữa các phần
- tránh một lần cutover quá lớn vào mega-method `updateUserDeptScopes`

### 2.3. Timeline đổi từ “lạc quan” sang “có buffer thực chiến”

Bản cũ ước tính `~15 ngày`, chưa phản ánh:
- baseline capture
- response snapshot
- rollback drill
- hardening sau batch high-risk
- signed-route verification
- deprecated alias verification

**Bản v1 chuyển sang tổng ~24-27 ngày làm việc**, gồm:
- execution waves
- buffer cho high-risk waves
- hardening và cleanup

## 3. Kiến trúc đích giữ nguyên

### 3.1. Quy tắc hội tụ

- Module đã có V5 controller: merge vào controller/service existing
- Module chưa có V5 controller: tạo controller mới trong `app/Http/Controllers/Api/V5/`
- Service đặt trong `app/Services/V5/Domain/`
- Không tạo `app/Modules/`
- Không đổi DI pattern hiện tại
- Không tranh thủ “refactor logic” trong cùng wave cutover

### 3.2. Phạm vi delivery

**Phạm vi logic vẫn là các domain trong plan gốc**.

**Nhưng delivery không còn đi theo 10 đợt lớn**.
Thay vào đó, bản v1 dùng **18 wave cutover nhỏ hơn**, để mỗi wave có:
- baseline riêng
- verification riêng
- rollback riêng
- criteria go/no-go rõ ràng

## 4. Quy tắc bắt buộc trước khi bắt đầu mỗi wave

### 4.1. Tạo `pre-batch ref`

Ví dụ với Wave 05:

```bash
git switch main
git pull --ff-only origin main
git switch -c refactor/v5mdc-wave-05-opportunity
git tag -f v5mdc-wave-05-pre
```

### 4.2. Capture baseline

Mỗi wave phải lưu baseline tối thiểu:

```bash
mkdir -p /tmp/v5mdc-wave-05
php artisan route:list --path=api/v5 > /tmp/v5mdc-wave-05/routes.txt
php artisan route:list --path=api/v5/opportunities --columns=method,uri,name,action,middleware > /tmp/v5mdc-wave-05/opportunity-routes.txt
composer test > /tmp/v5mdc-wave-05/composer-test.txt
```

Nếu wave có route đặc biệt, phải capture thêm:
- deprecated aliases
- signed download routes
- heavy throttle middleware
- sample JSON responses trước cutover

### 4.3. Không trộn schema change vào wave refactor controller

Mỗi wave trong plan này là **controller/service cutover**, không phải DB schema change.

Nếu phát sinh nhu cầu:
- thêm cột
- đổi kiểu dữ liệu
- thêm bảng
- sửa procedure

thì phải tách ra thành nhánh/PR khác.

Điều này giúp rollback controller không bị dính rollback schema.

### 4.4. Không xóa methods gốc trước sign-off

Nguyên tắc giữ nguyên:
- có thể copy/move logic
- có thể đổi routes
- nhưng chỉ xóa public methods trong `V5MasterDataController.php` sau khi wave pass đủ gate

## 5. Delivery waves mới

## 5.1. Bảng tổng hợp

| Wave | Scope | Loại | Rủi ro | Ghi chú |
|------|-------|------|--------|--------|
| 01 | Vendor + Business + System | Mixed | Thấp | Validate quy trình |
| 02 | Product + Customer + Calendar | Mixed | Thấp | Bắt đầu kiểm tra cache + alias |
| 03 | AuditLog + Workflow + SupportConfig-Positions | Type A | Thấp | Chuẩn hóa route middleware |
| 04 | CustomerPersonnel | Type A | Trung bình | Cross-dep đã được giải quyết |
| 05 | Opportunity | Type B | Trung bình | Existing controller cutover |
| 06 | Project + Department | Type B | Trung bình | Cùng cụm existing V5 controllers |
| 07 | Employee | Type A | Trung bình | Alias `/employees` vs `/internal-users` |
| 08 | UserAccess internal extract only | Type A-no-cutover | Cao | Chưa đổi route, chỉ bóc helper/service |
| 09 | UserAccess read endpoints | Type A | Trung bình-Cao | `roles`, `permissions`, `userAccess` |
| 10 | UserAccess role/permission writes | Type A | Cao | `updateUserRoles`, `updateUserPermissions` |
| 11 | UserAccess dept-scope cutover | Type A | Cao | `updateUserDeptScopes` đi riêng |
| 12 | CustomerRequest | Type B | Cao | Import/export + workflow |
| 13 | Contract | Type B | Cao | Payment generation/schedules |
| 14 | SupportConfig còn lại | Type A | Trung bình | Service groups, statuses, SLA |
| 15 | Integration | Type A | Cao | B2 + Google Drive + settings |
| 16 | SupportRequest | Type A | Cao | Bulk + export + legacy behavior |
| 17 | Document | Type A | Cao | Signed routes là điểm chết |
| 18 | Final cleanup | Cleanup | Thấp | Xóa V5MasterDataController |

### 5.2. Lý do chẻ lại

So với plan cũ:
- `CustomerRequest` và `Contract` không còn gộp chung
- `SupportRequest` và `Document` không còn gộp chung
- `UserAccess` được chẻ thành nhiều wave có blast radius nhỏ hơn

Đây là thay đổi bắt buộc để rollback và review có ý nghĩa thực tế.

## 6. Chi tiết các wave high-risk

### 6.1. Wave 08 — UserAccess internal extract only

**Mục tiêu**:
- chưa đổi route
- chưa đổi controller binding
- chỉ bóc helper methods từ mega-method sang `UserDeptScopeService`
- giữ endpoint `updateUserDeptScopes` vẫn chạy qua `V5MasterDataController`

**Kết quả mong muốn**:
- service mới tồn tại
- V5MDC delegate bớt logic nội bộ cho service
- behavior không đổi
- có characterization tests rõ ràng

**Gate bắt buộc**:
- `composer test`
- test chuyên biệt cho `updateUserDeptScopes`
- response snapshot trước/sau không đổi

**Go/No-Go**:
- nếu characterization tests chưa đủ thì dừng ở wave này, không bước sang Wave 09

### 6.2. Wave 09 — UserAccess read endpoints

Move:
- `roles`
- `permissions`
- `userAccess`

**Không move writes trong wave này**.

Mục tiêu:
- giảm rủi ro auth mutation
- xác minh route/controller binding mới với read-only flows trước

### 6.3. Wave 10 — UserAccess role/permission writes

Move:
- `updateUserRoles`
- `updateUserPermissions`

**Không đụng `updateUserDeptScopes`**.

Gate riêng:
- role assignment
- permission assignment
- unauthorized behavior
- audit side effects nếu có

### 6.4. Wave 11 — UserAccess dept-scope cutover

Chỉ thực hiện sau khi Wave 08-10 ổn.

Move:
- route/controller cutover của `updateUserDeptScopes`

Gate bắt buộc:
- tất cả scenario dept scope hiện có
- permission boundaries
- response contract
- route binding assertions

**Nếu fail ở đây, rollback chỉ riêng wave này, không rollback cả read + role/permission waves.**

### 6.5. Wave 13 — Contract tách riêng

Lý do:
- payment generation là vùng rủi ro logic, không nên gộp cùng CustomerRequest
- regression ở contract có thể ảnh hưởng dữ liệu tài chính/kế hoạch thanh toán

Gate tối thiểu:
- milestone generation
- cycle-based generation
- allocation modes
- regenerate schedule
- confirmation flow

**Rule bổ sung**:
Nếu diff wave 13 vượt quá giới hạn sau thì phải tách tiếp thành `13A` và `13B`:
- >30 files touched
- hoặc >800 changed lines hành vi
- hoặc test failures cần fix >1 ngày

### 6.6. Wave 17 — Document tách riêng và đứng sau SupportRequest

Document chứa signed routes đặc biệt:
- `/documents/attachments/{id}/download`
- `/attachments/{id}/download`
- `/documents/attachments/temp-download`

Wave này phải có route group riêng cho signed routes và verify:
- không auth vẫn tải được signed URL hợp lệ
- signed URL hết hạn trả `403`
- URI exact match không đổi

**Nếu signed routes hỏng → rollback cùng ngày, không fix nóng trên main.**

## 7. Verification gates chuẩn cho mọi wave

## 7.1. Gates bắt buộc

| Category | Gate |
|----------|------|
| Route parity | route count/module route list không đổi ngoài phần chủ đích |
| Middleware parity | middleware stack giữ nguyên |
| Alias parity | deprecated aliases vẫn đáp ứng |
| Response contract | JSON shape trước/sau không đổi |
| Auth parity | unauthenticated vẫn 401 đúng chỗ |
| Permission parity | unauthorized vẫn 403 đúng chỗ |
| Cache parity | write xong read phản ánh đúng nếu module có cache |
| Test suite | `composer test` pass |
| Frontend smoke | `npm run lint && npm test` khi endpoint đang được UI dùng |

## 7.2. Gates bổ sung theo loại wave

### Với heavy throttle endpoints

Phải verify:

```bash
php artisan route:list --path=api/v5/{module} --columns=method,uri,middleware
```

### Với signed routes

Phải verify:
- signed URL hợp lệ không cần auth
- signed URL hết hạn trả `403`
- đúng URI và đúng middleware `signed:relative`

### Với deprecated aliases

Phải verify:
- route còn sống
- có `deprecated.route:*`
- response không drift

## 7.3. Baseline artifacts phải giữ đến hết project

Mỗi wave phải giữ:
- route list before/after
- middleware list before/after
- sample responses before/after
- composer test output
- note các file bị touch

Khuyến nghị lưu theo cấu trúc:

```text
plan-code/batch-baselines/
  wave-01/
  wave-02/
  ...
```

## 8. Rollback strategy mới

## 8.1. Quy tắc chung

Rollback luôn restore từ `PRE_REF`, ví dụ:

```bash
PRE_REF=v5mdc-wave-05-pre
```

**Không dùng `HEAD` trong rollback docs.**

## 8.2. Type A — New controller waves

Áp dụng cho:
- Business
- System
- Product
- Calendar
- AuditLog
- Workflow
- SupportConfig-Positions
- CustomerPersonnel
- Employee
- UserAccess waves
- SupportConfig còn lại
- Integration
- SupportRequest
- Document

Template:

```bash
PRE_REF=v5mdc-wave-XX-pre

git restore --source="$PRE_REF" routes/api.php
git restore --source="$PRE_REF" tests/Feature/V5DomainRouteBindingTest.php
php artisan route:clear
php artisan config:clear
php artisan cache:clear
composer test
```

## 8.3. Type B — Merge-into-existing waves

Áp dụng cho:
- Vendor
- Customer
- Opportunity
- Project
- Department
- CustomerRequest
- Contract

Template:

```bash
PRE_REF=v5mdc-wave-XX-pre

git restore --source="$PRE_REF" routes/api.php
git restore --source="$PRE_REF" app/Services/V5/Domain/<Module>DomainService.php
git restore --source="$PRE_REF" app/Http/Controllers/Api/V5/<Module>Controller.php
git restore --source="$PRE_REF" tests/Feature/V5DomainRouteBindingTest.php
php artisan route:clear
php artisan config:clear
php artisan cache:clear
composer test
```

## 8.4. Mixed waves

Wave mixed phải restore union của:
- routes
- touched existing controller/service files
- route binding tests
- module-specific feature tests nếu đã chỉnh assertion

## 8.5. Stop / Continue criteria

| Condition | Action |
|-----------|--------|
| Tất cả tests pass, contract không đổi | Continue |
| 1-2 test failures, fix trong <0.5 ngày | Fix rồi re-run gates |
| >2 test failures | Rollback về `PRE_REF` |
| Signed routes fail | Rollback ngay |
| Deprecated aliases 404 | Rollback ngay |
| Response drift không chủ đích | Rollback ngay |
| Need schema change để “cứu” wave refactor | Tách scope, không vá trong cùng wave |

## 9. Chiến lược private methods

### 9.1. Shared utilities

Giữ hướng cũ:
- shared methods tiếp tục đi vào Shared Services
- auth/scope helpers tiếp tục hội tụ về `V5DomainSupportService`

### 9.2. Domain-specific helpers

Không cố maintain bảng private-method mapping khổng lồ ngay trong master plan này.

Thay vào đó, mỗi wave phải sinh ra **wave worksheet** gồm:
- danh sách public methods được move
- danh sách private methods đi kèm
- file đích
- file bị touch

Khuyến nghị:

```text
plan-code/wave-05_opportunity.md
plan-code/wave-09_user-access-read.md
```

Lý do:
- giảm stale data trong master plan
- review từng wave dễ hơn
- rollback scope rõ hơn

## 10. Test strategy

## 10.1. Bắt buộc update dần route-binding tests

`V5DomainRouteBindingTest.php` phải được update theo từng wave, không dồn cuối.

Mỗi wave phải xác minh:
- route action đúng controller mới
- middleware stack không drift
- aliases vẫn trỏ đúng canonical handlers

## 10.2. Characterization tests cho high-risk areas

Trước khi cutover các wave sau, phải có characterization tests đủ dày:
- UserAccess DeptScope
- Contract payment generation
- CustomerRequest import/export
- Document signed downloads
- SupportRequest bulk/export

Nếu chưa có characterization tests đủ tốt, không được cutover.

## 10.3. Frontend verification

Nguyên tắc vẫn là:
- không đổi API contract
- không chủ động sửa frontend vì refactor backend

Nhưng mỗi wave có UI phụ thuộc phải chạy:

```bash
cd frontend
npm run lint
npm test
```

Nếu wave chạm module đang dùng ở UI nhiều, nên có smoke checklist thủ công:
- load page
- list
- create/update/delete
- filter/search/export nếu có

## 11. Timeline điều chỉnh

## 11.1. Execution estimate

| Wave | Effort | Risk |
|------|--------|------|
| 01 | 0.5 ngày | Thấp |
| 02 | 1 ngày | Thấp |
| 03 | 0.75 ngày | Thấp |
| 04 | 0.75 ngày | Trung bình |
| 05 | 1 ngày | Trung bình |
| 06 | 1.25 ngày | Trung bình |
| 07 | 1.5 ngày | Trung bình |
| 08 | 1 ngày | Cao |
| 09 | 1 ngày | Trung bình-Cao |
| 10 | 1 ngày | Cao |
| 11 | 1.5 ngày | Cao |
| 12 | 1.5 ngày | Cao |
| 13 | 1.75 ngày | Cao |
| 14 | 1 ngày | Trung bình |
| 15 | 1.5 ngày | Cao |
| 16 | 2 ngày | Cao |
| 17 | 1.75 ngày | Cao |
| 18 | 0.5 ngày | Thấp |
| **Subtotal execution** | **~21.25 ngày** | |

## 11.2. Buffer bắt buộc

Reserved buffer:
- 0.5 ngày sau Wave 08
- 0.5 ngày sau Wave 11
- 0.5 ngày sau Wave 13
- 0.5 ngày sau Wave 15
- 1 ngày sau Wave 16-17
- 1.5 ngày global stabilization trước cleanup

**Subtotal buffer/hardening: ~4.5-5.0 ngày**

## 11.3. Tổng timeline mới

**Tổng thực tế: ~24-27 ngày làm việc**

Đây là mốc nên dùng cho planning/commitment.
Mốc cũ `~15 ngày` chỉ phù hợp nếu:
- cắt bỏ bớt verification
- hoặc chấp nhận tăng xác suất regression

Bản v1 **không khuyến nghị** cách đó.

## 12. Điều kiện để xóa V5MasterDataController.php

Chỉ thực hiện cleanup khi tất cả điều kiện sau đều đúng:

- không còn route nào trỏ vào `V5MasterDataController`
- route count parity đã được check ở wave cuối
- deprecated aliases còn sống đúng deadline
- signed routes chạy đúng không auth
- heavy throttle routes đúng middleware
- `composer test` pass
- route-binding assertions đã cập nhật xong
- toàn bộ wave worksheets đã được review

Actions:
1. Xóa `app/Http/Controllers/Api/V5MasterDataController.php`
2. Xóa import còn sót trong `routes/api.php`
3. Clean test assertions cũ
4. Chạy full verify lần cuối
5. Tag release sau stabilization

## 13. Nguyên tắc thực thi

1. API contract không đổi
2. Backward compatibility không đổi
3. Không refactor business logic trong cùng wave cutover
4. Không trộn schema change vào wave refactor controller
5. Rollback phải restore từ `PRE_REF`
6. High-risk waves phải có characterization tests trước cutover
7. Không xóa methods gốc trước sign-off
8. Mỗi wave phải có baseline artifacts và worksheet riêng

## 14. Kết luận

Kiến trúc đích của plan gốc vẫn đúng.

Điểm cần sửa không phải là “nên tách hay không”, mà là **tách theo đơn vị nào để rollout an toàn**.

Bản v1 ưu tiên:
- rollback làm được thật
- wave nhỏ hơn ở vùng rủi ro cao
- timeline đúng với chi phí verify

Đây là bản nên dùng để triển khai thực tế và review tiếp ở cấp wave-by-wave.
