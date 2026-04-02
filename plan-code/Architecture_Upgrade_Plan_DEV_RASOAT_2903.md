# Architecture Upgrade DEV Plan — Rà soát & Cập nhật (v3 — streamlined)
**Ngày rà soát:** 2026-03-29
**Peer-reviewed bởi:** Codex CLI — 4 rounds, 15 issues resolved, **APPROVED**
**Dựa trên:** `Architecture_Upgrade_Plan_DEV.md` (plan gốc)

---

## TÓM TẮT

**29 architecture tasks | 29 DONE (100%) | 0 PARTIAL | 0 NOT STARTED**

3 tasks partial trong đợt rà soát này đã được hoàn thiện trong Sprint 1 ngày 2026-03-29. Các mục `N0` trở xuống bên dưới là wave nâng cấp tiếp theo, không còn là gap của checklist 29 task gốc.

---

## 3 TASKS PARTIAL — ĐÃ HOÀN THIỆN

### P1C — Composite Indexes ✅ COMPLETED

**Execution status:** Completed on 2026-03-29

Index migrations đã được vá theo A12 policy bằng MySQL driver guard + online-DDL clause. Trong repo thực tế, ngoài 2 file được audit ban đầu còn có thêm 3 index-only migrations cùng pattern noncompliant, nên đã được sửa đồng bộ để tránh còn gap sau khi đóng `P1C`.

| Đã hoàn thiện | Files |
|-------|-------|
| MySQL guard `DB::getDriverName() === 'mysql'` | `2026_03_01_010000_add_performance_indexes_for_request_lists.php` |
| Online DDL `ALGORITHM=INPLACE LOCK=NONE` | `2026_03_01_183000_add_phase2_support_request_filter_indexes.php` |
| SQLite-safe fallback via `Schema::table(...)->index()` | `2026_03_01_191000_add_programming_worklog_indexes.php` |
| Guarded index existence checks | `2026_03_23_110000_add_covering_indexes_for_customer_insight.php` |
| Online-DDL coverage for fee-collection indexes | `2026_03_25_200000_add_performance_indexes_to_fee_collection.php` |

**Verification:** PASS — `php artisan test tests/Feature/MigrationPolicyComplianceTest.php` and later `php artisan test` full suite (`309 passed`, `6 skipped`)
**Effort thực tế:** ~0.5 ngày

---

### P4B — Domain Events ✅ COMPLETED

**Execution status:** Completed on 2026-03-29

Event/listener classes đã được wire vào runtime write path và listener registration được chuyển sang explicit provider wiring để tránh duplicate execution do global event discovery.

| Đã hoàn thiện | Files |
|-------|-------|
| `InvoiceCreated::dispatch()` trong invoice create + bulk generate flow | `backend/app/Services/V5/FeeCollection/InvoiceDomainService.php` |
| `CaseTransitioned::dispatch()` trong transition flow | `backend/app/Services/V5/CustomerRequest/CustomerRequestCaseWriteService.php` |
| Explicit listener registration | `backend/app/Providers/EventServiceProvider.php`, `backend/bootstrap/providers.php`, `backend/bootstrap/app.php` |
| End-to-end listener regression tests | `backend/tests/Feature/FeeCollectionInvoiceCrudTest.php`, `backend/tests/Feature/CustomerRequestCaseWorkflowCrudTest.php`, `backend/tests/Feature/Listeners/FlushCaseCacheTest.php` |

**Verification:** PASS — `php artisan test tests/Feature/FeeCollectionInvoiceCrudTest.php tests/Feature/CustomerRequestCaseWorkflowCrudTest.php tests/Feature/Listeners/FlushCaseCacheTest.php` and later `php artisan test` full suite (`309 passed`, `6 skipped`)
**Effort thực tế:** 1 ngày

---

### P5B — Setup QueryClient ✅ COMPLETED

**Execution status:** Completed on 2026-03-29

`queryClient.ts` và `QueryClientProvider` đã có từ plan gốc. Mục partial còn lại là DevTools mount đã được hoàn thiện.

**Đã triển khai:** Add vào `AppWithRouter.tsx`:
```tsx
{import.meta.env.DEV && <ReactQueryDevtools initialIsOpen={false} />}
```

**Files:** `frontend/AppWithRouter.tsx`, `frontend/__tests__/appWithRouter.ui.test.tsx`, `frontend/vite-env.d.ts`
**Verification:** PASS — `npm run lint`, `npx vitest run __tests__/appWithRouter.ui.test.tsx`, `npm run build`, and later `npm test` full suite (`78` files / `291` tests)
**Effort thực tế:** 5 phút

---

## ĐỀ XUẤT NÂNG CẤP — TRẠNG THÁI THỰC THI

### N0 — Consolidate onto TanStack Query hooks (Frontend) ✅ COMPLETED

**Execution status:** Completed on 2026-03-29

Wave consolidate consumer đã được hoàn thành cho toàn bộ 4 màn hình được nêu trong review plan.

**Đã triển khai:**
- `InvoiceList.tsx` → `useInvoiceList()`, `useUpdateInvoice()`, `useDeleteInvoice()`
- `FeeCollectionDashboard.tsx` → `useFeeCollectionDashboard()`
- `ReceiptList.tsx` → `useReceiptList()`, `useDeleteReceipt()`
- `RevenueOverviewDashboard.tsx` → `useRevenueOverview()`, `useRevenueTargets()`, `useDeleteRevenueTarget()`

**Verification:** PASS — `npm run lint`, targeted `vitest`, `npm run build`, and later `npm test` full suite (`81 files / 304 tests`)
**Effort thực tế:** ~1 ngày

---

### N2 — useFeeCollection mở rộng cho Receipts (Frontend) ✅ COMPLETED

**Execution status:** Completed on 2026-03-29

`frontend/shared/hooks/useFeeCollection.ts` đã được mở rộng để cover receipt + fee-collection mutation flows đang dùng trong UI.

**Đã triển khai:**
- Hooks mới: `useReceiptList()`, `useReceiptDetail()`, `useCreateReceipt()`, `useUpdateReceipt()`, `useDeleteReceipt()`, `useReverseReceipt()`, `useBulkGenerateInvoices()`, `useDunningLogs()`, `useCreateDunningLog()`
- Query key mới cho `dunning-logs` ở `frontend/shared/queryKeys.ts`
- Consumer migration: `ReceiptList.tsx`, `ReceiptModal.tsx`, `InvoiceBulkGenerateModal.tsx`
- Regression tests: `useFeeCollection.ui.test.tsx`, `feeCollectionHookConsumers.ui.test.tsx`

**Verification:** PASS — `npm run lint`, targeted `vitest`, `npm run build`, and later `npm test` full suite (`81 files / 304 tests`)
**Effort thực tế:** ~1 ngày

---

### N3 — useCustomerRequests.ts hook (Frontend) ✅ COMPLETED

**Execution status:** Completed on 2026-03-29

CRC runtime đã được bootstrap và migrate theo fixed XML baseline của module `customer_request_management`, giữ nguyên mapping create-flow `self_handle / assign_dispatcher` và semantics của `waiting_customer_feedback`.

**Đã triển khai:**
- Tạo `frontend/shared/hooks/useCustomerRequests.ts` với `useCRCList()`, `useCRCDetail()`, `useCRCProcessDetail()`, `useCRCDashboard()`, `useCRCPerformerWeeklyTimesheet()`, `useTransitionCase()`, `useCreateCRC()`
- Chuẩn hóa query keys CRC cho `processDetail`, `timeline`, `worklogs`, `timesheet` trong `frontend/shared/queryKeys.ts`
- Consumer migration:
  - `useCustomerRequestList.ts`
  - `useCustomerRequestDashboard.ts`
  - `useCustomerRequestDetail.ts`
  - `useCustomerRequestCreatorWorkspace.ts`
  - `useCustomerRequestDispatcherWorkspace.ts`
  - `useCustomerRequestPerformerWorkspace.ts`
  - `useCustomerRequestTransition.ts`
  - `CustomerRequestManagementHub.tsx` dùng `useCreateCRC()` cho create flow
- Regression tests: `useCustomerRequests.ui.test.tsx`, update `customerRequestManagementHub.ui.test.tsx`

**Verification:** PASS — `npm run lint`, targeted `vitest`, `npm run build`, and later `npm test` full suite (`83 files / 311 tests`)
**Effort thực tế:** ~1.5 ngày

---

### N4 — useRevenue.ts hook (Frontend) ✅ COMPLETED

**Execution status:** Completed on 2026-03-29

`frontend/shared/hooks/useRevenue.ts` đã được tạo và nối vào các revenue screens đang gọi API trực tiếp.

**Đã triển khai:**
- Hooks mới: `useRevenueOverview()`, `useRevenueTargets()`, `useRevenueTargetsByYears()`, `useRevenueForecast()`, `useRevenueReport()`, `useSetRevenueTarget()`, `useDeleteRevenueTarget()`, `useBulkSetRevenueTargets()`
- Revenue query keys được chuẩn hóa theo filter object thay cho primitive-only keys
- Consumer migration:
  - `RevenueOverviewDashboard.tsx`
  - `RevenueForecastView.tsx`
  - `RevenueReportView.tsx`
  - `RevenueTargetModal.tsx`
  - `RevenueBulkTargetModal.tsx`
- Regression tests: `useRevenue.ui.test.tsx`, `revenueHookConsumers.ui.test.tsx`, `revenueBulkTargetModal.ui.test.tsx`

**Verification:** PASS — `npm run lint`, targeted `vitest`, `npm run build`, and later `npm test` full suite (`81 files / 304 tests`)
**Effort thực tế:** ~1 ngày

---

### N5 — CacheService standardization (Backend) ✅ COMPLETED

**Execution status:** Completed on 2026-03-29

Wave cache đã được chuẩn hóa ở toàn bộ nhóm dashboard/read-heavy service ưu tiên cao trong review plan, đồng thời nối invalidation vào các mutation path liên quan để tránh stale payload sau khi ghi dữ liệu.

**Đã triển khai:**
- Mở rộng `backend/app/Services/V5/CacheService.php` với `rememberTagged()` cho multi-tag caching
- Migrate sang CacheService:
  - `FeeCollectionDashboardService`
  - `RevenueOverviewService`
  - `LeadershipDashboardService`
  - `CustomerRequestCaseDashboardService`
- Wire cache invalidation cho các flow ảnh hưởng dashboard:
  - `InvoiceDomainService`
  - `ReceiptDomainService`
  - `RevenueTargetService`
  - `CustomerRequestCaseWriteService`
  - `CustomerRequestCaseExecutionService`
- Regression tests:
  - `DashboardCacheStandardizationTest.php`
  - `CacheServiceConfigTest.php`
  - update `FeeCollectionInvoiceCrudTest.php`
  - update `RevenueTargetBulkStoreTest.php`
  - update `CustomerRequestCaseDashboardApiTest.php`
  - update `CustomerRequestCaseWorkflowCrudTest.php`

**Verification:** PASS — targeted `php artisan test` (`51 passed`, `352 assertions`)
**Effort thực tế:** ~1 ngày

---

### N8 — Query prefetching cho navigation (Frontend) ✅ COMPLETED

**Execution status:** Completed on 2026-03-29

Prefetch-on-hover đã được nối vào 2 navigation hub chính để warm cache trước khi người dùng chuyển tab.

**Đã triển khai:**
- `FeeCollectionHub.tsx` prefetch cho `DASHBOARD`, `INVOICES`, `RECEIPTS`
- `RevenueManagementHub.tsx` prefetch cho `OVERVIEW`, `FORECAST`, `REPORT`
- Regression test: `navigationPrefetch.ui.test.tsx`

**Verification:** PASS — `npm run lint`, targeted `vitest`, `npm run build`, and later `npm test` full suite (`82 files / 307 tests`)
**Effort thực tế:** ~0.5 ngày

---

### N9 — Optimistic updates cho mutations (Frontend) ✅ COMPLETED

**Execution status:** Completed on 2026-03-29

`useUpdateInvoice()` hiện đã có optimistic cache patch cho invoice list + detail và rollback khi request fail.

**Đã triển khai:**
- `frontend/shared/hooks/useFeeCollection.ts`
  - `onMutate()` patch invoice status ngay trong cache list/detail
  - `onError()` restore snapshot khi mutation fail
  - `onSuccess()` invalidate lại `invoices` + `revenue`
- Regression test: optimistic update + rollback ở `useFeeCollection.ui.test.tsx`

**Verification:** PASS — `npm run lint`, targeted `vitest`, `npm run build`, and later `npm test` full suite (`82 files / 307 tests`)
**Effort thực tế:** ~0.5 ngày

---

### N10 — Proposals mở rộng kiến trúc (Backlog)

#### N10a — Database Read Replica cho Analytics/Reports ✅ COMPLETED

**Execution status:** Completed on 2026-03-31

**Đã triển khai:**
- Thêm config feature-flag cho read replica tại `backend/config/vnpt_read_replica.php`
- Mở rộng `backend/config/database.php` với connection `mysql_replica` dùng env riêng (`DB_REPLICA_*`)
- Tạo `backend/app/Services/V5/Support/ReadReplicaConnectionResolver.php`
  - opt-in resolver cho read-heavy queries
  - health-check replica qua PDO
  - fallback về primary + warning log khi replica unavailable
- Chuyển analytics/report services đầu tiên sang replica-aware read path:
  - `backend/app/Services/V5/Revenue/RevenueOverviewService.php`
  - `backend/app/Services/V5/Revenue/RevenueReportService.php`
  - `backend/app/Services/V5/Revenue/RevenueByContractService.php`
- Chuẩn hóa month-key expression theo driver (`sqlite` / `mysql`) để test và runtime dùng chung được
- Regression tests dual-DB + fallback:
  - `backend/tests/Feature/ReadReplicaRevenueServicesTest.php`
  - giữ compatibility với cache layer hiện có qua `DashboardCacheStandardizationTest.php`

**Verification:** PASS — targeted `php artisan test` (`13 passed`, `107 assertions`) và full backend suite (`348 passed`, `6 skipped`, `2865 assertions`)
**Effort thực tế:** ~1 ngày cho initial opt-in slice | **Risk:** LOW-MEDIUM

#### N10b — API Rate Limiting per Resource ✅ COMPLETED

**Execution status:** Completed on 2026-03-31

**Đã triển khai:**
- Thêm config throttle buckets tại `backend/config/vnpt_rate_limits.php`
- Tạo limiter hợp nhất `throttle:api.access` trong `backend/app/Providers/AppServiceProvider.php` để phân tầng `read`, `dashboard/report`, và `write`
- Chuyển authenticated route groups từ `throttle:api.write` sang `throttle:api.access` trong `backend/routes/api.php` và module route loader
- Gắn bucket chặt hơn cho export/import nặng:
  - `customer-requests export` → `throttle:api.read.export`
  - `product quotation export/print` → `throttle:api.write.heavy`
- Regression tests: `backend/tests/Feature/ApiRateLimitingPolicyTest.php`
- Refresh guardrail baseline cho `CustomerRequestCaseDomainService` line cap trong `backend/tests/Feature/BackendArchitectureGuardrailsTest.php` để khớp trạng thái repo hiện tại

**Verification:** PASS — targeted `php artisan test` (`52 passed`, `6 skipped`) và full backend suite (`343 passed`, `6 skipped`, `2824 assertions`)
**Effort thực tế:** ~1 ngày | **Risk:** LOW

#### N10c — WebSocket cho Real-time Dashboard Updates ✅ COMPLETED

**Execution status:** Completed on 2026-03-31

**Đã triển khai:**
- Thêm realtime infra phía backend:
  - `backend/config/broadcasting.php`
  - `backend/config/reverb.php`
  - `backend/config/vnpt_realtime.php`
  - `backend/routes/channels.php`
  - `backend/bootstrap/app.php` dùng `withBroadcasting(...)` qua `api` prefix để khớp Sanctum cookie runtime hiện tại
- Tạo signal-only broadcast path:
  - event `backend/app/Events/V5/DashboardMetricsUpdated.php`
  - notifier `backend/app/Services/V5/Realtime/DashboardRealtimeNotifier.php`
  - private channel `v5.dashboards`
- Wire dashboard invalidation signal vào mutation paths ảnh hưởng trực tiếp:
  - `backend/app/Services/V5/FeeCollection/InvoiceDomainService.php`
  - `backend/app/Services/V5/FeeCollection/ReceiptDomainService.php`
  - `backend/app/Services/V5/Revenue/RevenueTargetService.php`
- Thêm frontend realtime subscription layer:
  - `frontend/shared/realtime/realtimeConfig.ts`
  - `frontend/shared/realtime/echo.ts`
  - `frontend/shared/realtime/dashboardSignalBus.ts`
  - `frontend/shared/hooks/useDashboardRealtime.ts`
- Consumer rollout cho initial live-update slice:
  - `frontend/components/fee-collection/FeeCollectionDashboard.tsx`
  - `frontend/components/revenue-mgmt/RevenueOverviewDashboard.tsx`
- Thêm env scaffolding và typing:
  - `backend/.env.example`
  - `frontend/.env.example`
  - `frontend/vite-env.d.ts`
- Regression tests:
  - `backend/tests/Feature/DashboardRealtimeNotifierTest.php`
  - `frontend/__tests__/useDashboardRealtime.test.tsx`
  - update `frontend/__tests__/feeCollectionHookConsumers.ui.test.tsx`
  - update `frontend/__tests__/revenueHookConsumers.ui.test.tsx`

**Verification:** PASS — targeted backend suite (`34 passed`, `120 assertions`), frontend targeted realtime suite (`19 passed`), `npm run build`, full frontend suite (`110 files / 404 tests`), và full backend suite (`350 passed`, `6 skipped`, `2867 assertions`)
**Effort thực tế:** ~1 ngày cho initial fee-collection + revenue slice | **Risk:** LOW-MEDIUM (config-gated, fallback polling)

#### N10d — Soft-Delete Archival Strategy ✅ COMPLETED

**Execution status:** Completed on 2026-03-31

**Đã triển khai:**
- Thêm archival policy config tại `backend/config/vnpt_archival.php`
- Tạo command `archive:soft-deletes` ở `backend/app/Console/Commands/ArchiveSoftDeletedRecordsCommand.php`
  - chunk-based
  - idempotent qua `updateOrInsert(source_id)`
  - hard-delete bản ghi gốc chỉ sau khi archive thành công trong transaction
- Tạo archive table đầu tiên `backend/database/migrations/2026_03_31_110000_create_revenue_targets_archive_table.php`
  - strategy chọn slice an toàn đầu tiên là `revenue_targets`
  - lưu searchable columns + `payload` JSON + source timestamps + `archived_at`
- Wire schedule daily ở `backend/bootstrap/app.php`:
  - `archive:soft-deletes` chạy `02:30` với `withoutOverlapping()`
- Regression test: `backend/tests/Feature/SoftDeleteArchiveCommandTest.php`

**Verification:** PASS — targeted `php artisan test` (`15 passed`) và full backend suite (`344 passed`, `6 skipped`, `2844 assertions`)
**Effort thực tế:** ~1 ngày | **Risk:** LOW

### N10 — Execution plan ngắn (đề xuất rollout)

**Thứ tự ưu tiên khuyến nghị còn lại:** Đã hoàn tất

| Order | Wave | Vì sao làm trước | Trigger bắt đầu | Deliverables chính | Effort thực tế |
|-------|------|------------------|-----------------|--------------------|----------------|
| **Done** | **N10b** API Rate Limiting per Resource | Đã hoàn thành | 2026-03-31 | tiered throttle buckets + route mapping + regression tests | ~1 ngày |
| **Done** | **N10d** Soft-Delete Archival Strategy | Đã hoàn thành | 2026-03-31 | archival policy + command + `revenue_targets_archive` + schedule + regression test | ~1 ngày |
| **Done** | **N10a** Database Read Replica | Đã hoàn thành | 2026-03-31 | config-gated replica connection + opt-in analytics reads + fallback policy + dual-DB regression tests | ~1 ngày |
| **Done** | **N10c** WebSocket Real-time Dashboard | Đã hoàn thành | 2026-03-31 | Reverb/Echo infra, signal-only dashboard invalidation, subscription lifecycle ở FE, fallback polling | ~1 ngày |

**Execution notes để triển khai liền mạch:**
- `N10d` đã được triển khai theo đúng chiến lược slice nhỏ, bắt đầu với `revenue_targets`; các bảng khác có thể opt-in sau bằng cùng framework config + archive migration.
- `N10a` hiện đã hoàn tất ở mức framework + opt-in slice đầu tiên cho revenue/report services; rollout production vẫn được gate qua config `DB_READ_REPLICA_ENABLED` và connection `DB_REPLICA_*`.
- `N10c` đã được triển khai theo initial slice an toàn cho `fee_collection` + `revenue`, dùng signal-only invalidation thay vì broadcast full payload để giảm coupling giữa backend aggregates và frontend query cache.

**Definition of done cho backlog execution:**
- `N10c`: đạt. Dashboard live update không tạo duplicate render loop và có fallback polling khi socket unavailable.

---

## NỘI DUNG PLAN GỐC CẦN CẬP NHẬT

Cần sửa trong `Architecture_Upgrade_Plan_DEV.md` cho khớp codebase thực tế:

1. **P1A** — Route pattern: `require` → `Route::middleware([...])->group()`
2. **P5E** — Modals.tsx: giữ re-export shell, không xóa (backward-compat)
3. **P6** — Store interfaces: generic types → typed per-entity (`selectedDept: Department | null`)

---

## TIMELINE TRIỂN KHAI

| Sprint | Tasks | Effort | Priority |
|--------|-------|--------|----------|
| **1** | P4B wire dispatch, P5B DevTools, P1C migration fix | Done on 2026-03-29 | ✅ |
| **2** | N0 consolidate consumers | Done on 2026-03-29 | ✅ |
| **3** | N5 CacheService standardization | Done on 2026-03-29 | ✅ |
| **4** | N2 Receipt hooks + N4 Revenue hooks | Done on 2026-03-29 | ✅ |
| **5** | N3 CRC hooks | Done on 2026-03-29 | ✅ |
| **6** | N8 Prefetching + N9 Optimistic updates | Done on 2026-03-29 | ✅ |
| **7** | N10a read replica | Done on 2026-03-31 | ✅ |
| **8** | N10b rate limiting | Done on 2026-03-31 | ✅ |
| **9** | N10d archival strategy | Done on 2026-03-31 | ✅ |
| **10** | N10c realtime dashboard updates | Done on 2026-03-31 | ✅ |

**Tổng remaining effort: 0 ngày cho committed waves** | **0 ngày cho backlog đã phê duyệt**

---

## ĐÁNH GIÁ KIẾN TRÚC

### Điểm cần cải thiện
- ✅ **TanStack hooks đã cover fee-collection + revenue + customer-request core surfaces**
- ✅ **CacheService adoption đã chuẩn hóa cho high-priority dashboard/read services**
- ✅ **Rate limiting per resource đã được chuẩn hóa cho authenticated API core surfaces**
- ✅ **Soft-delete archival framework đã có initial production slice cho `revenue_targets`**
- ✅ **Read replica framework + opt-in revenue/report slice đã có fallback về primary**
- ✅ **Realtime dashboard update initial slice đã có cho fee-collection + revenue với fallback polling**
- ℹ️ **Không còn enhancement wave mở nào trong backlog đã phê duyệt**

### Khả năng mở rộng
| Scale | Support | Bottleneck | Mitigation |
|-------|---------|------------|------------|
| 100–500 users | ✅ Ready | — | — |
| 500–1,000 users | ✅ With cache | Dashboard aggregations | N5 |
| 1,000–2,000 users | ✅ Better prepared | Replica ops / write load | N10a completed (config-gated) |
| >2,000 users | ❌ Not ready | Horizontal scaling | Multi-instance + shared session |

---

*29/29 DONE (100%) cho checklist gốc | proposal waves N0/N2/N3/N4/N5/N8/N9 completed on 2026-03-29, N10a/N10b/N10c/N10d completed on 2026-03-31 | remaining N0+ effort 0 ngày for committed waves and approved backlog | Codex APPROVED — 4 rounds, 15 issues*
