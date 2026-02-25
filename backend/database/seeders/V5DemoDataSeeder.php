<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Str;

class V5DemoDataSeeder extends Seeder
{
    public function run(): void
    {
        $departments = $this->seedDepartments();
        $internalUsers = $this->seedInternalUsers($departments);
        $businessDomains = $this->seedBusinessDomains();
        $vendors = $this->seedVendors();
        $this->seedProducts($businessDomains, $vendors);
        $customers = $this->seedCustomers();
        $this->seedCustomerPersonnel($customers);
        $opportunities = $this->seedOpportunities($customers, $internalUsers, $departments);
        $projects = $this->seedProjects($customers, $opportunities);
        $this->seedContracts($projects, $customers, $departments);
        $documentTypes = $this->seedDocumentTypes();
        $this->seedDocuments($customers, $projects, $documentTypes);
        $this->seedReminders($internalUsers);
        $this->seedUserDeptHistory($internalUsers, $departments);

        $actors = [
            'admin' => $internalUsers['admin'] ?? null,
            'sales' => $internalUsers['sales'] ?? null,
            'system' => $internalUsers['system'] ?? null,
        ];

        $this->seedAuditLogs($actors);
    }

    /**
     * @return array{root:?int,sales:?int,tech:?int}
     */
    private function seedDepartments(): array
    {
        if (! $this->hasTable('departments')) {
            return ['root' => null, 'sales' => null, 'tech' => null];
        }

        $rootId = $this->upsertDepartment('BGĐVT', 'Ban giám đốc Viễn Thông', null);
        $salesId = $this->upsertDepartment('PB002', 'Phòng Kinh doanh', $rootId);
        $techId = $this->upsertDepartment('PB003', 'Phòng Kỹ thuật', $rootId);

        if ($this->hasColumn('departments', 'dept_path')) {
            if ($rootId !== null) {
                DB::table('departments')->where('id', $rootId)->update([
                    'dept_path' => $rootId.'/',
                ]);
            }
            if ($salesId !== null && $rootId !== null) {
                DB::table('departments')->where('id', $salesId)->update([
                    'dept_path' => $rootId.'/'.$salesId.'/',
                ]);
            }
            if ($techId !== null && $rootId !== null) {
                DB::table('departments')->where('id', $techId)->update([
                    'dept_path' => $rootId.'/'.$techId.'/',
                ]);
            }
        }

        return ['root' => $rootId, 'sales' => $salesId, 'tech' => $techId];
    }

    private function upsertDepartment(string $code, string $name, ?int $parentId): ?int
    {
        $existing = DB::table('departments')->where('dept_code', $code)->first();

        $payload = $this->filterColumns('departments', [
            'dept_name' => $name,
            'parent_id' => $parentId,
            'dept_path' => $parentId ? ($parentId.'/0/') : '0/',
            'is_active' => 1,
            'status' => 'ACTIVE',
            'data_scope' => 'ALL',
            'updated_at' => now(),
        ]);

        if ($existing) {
            DB::table('departments')->where('id', $existing->id)->update($payload);

            return (int) $existing->id;
        }

        $insert = $this->filterColumns('departments', [
            'dept_code' => $code,
            'dept_name' => $name,
            'parent_id' => $parentId,
            'dept_path' => $parentId ? ($parentId.'/0/') : '0/',
            'is_active' => 1,
            'status' => 'ACTIVE',
            'data_scope' => 'ALL',
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        if (! $this->hasColumn('departments', 'id')) {
            DB::table('departments')->insert($insert);

            return null;
        }

        return (int) DB::table('departments')->insertGetId($insert);
    }

    /**
     * @param array{root:?int,sales:?int,tech:?int} $departments
     * @return array{admin:?int,sales:?int,system:?int}
     */
    private function seedInternalUsers(array $departments): array
    {
        if (! $this->hasTable('internal_users')) {
            return ['admin' => null, 'sales' => null, 'system' => null];
        }

        $salesDeptId = $departments['sales'] ?? $departments['root'] ?? null;
        $techDeptId = $departments['tech'] ?? $departments['root'] ?? null;
        $defaultPasswordHash = '$2y$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi';

        $adminId = $this->upsertInternalUser([
            'user_code' => 'INT9001',
            'username' => 'admin.demo',
            'password' => $defaultPasswordHash,
            'full_name' => 'Nguyễn Quản Trị',
            'email' => 'admin.demo@vnpt.vn',
            'status' => 'ACTIVE',
            'department_id' => $techDeptId,
            'position_id' => 1,
            'job_title_raw' => 'System Administrator',
            'date_of_birth' => '1990-01-15',
            'gender' => 'MALE',
            'vpn_status' => 'YES',
            'ip_address' => '10.10.10.10',
        ]);

        $salesId = $this->upsertInternalUser([
            'user_code' => 'INT9002',
            'username' => 'sales.demo',
            'password' => $defaultPasswordHash,
            'full_name' => 'Trần Kinh Doanh',
            'email' => 'sales.demo@vnpt.vn',
            'status' => 'ACTIVE',
            'department_id' => $salesDeptId,
            'position_id' => 2,
            'job_title_raw' => 'Sales Executive',
            'date_of_birth' => '1994-05-20',
            'gender' => 'FEMALE',
            'vpn_status' => 'NO',
            'ip_address' => '10.10.10.21',
        ]);

        $systemId = $this->upsertInternalUser([
            'user_code' => 'INT9003',
            'username' => 'system.demo',
            'password' => $defaultPasswordHash,
            'full_name' => 'Lê Hệ Thống',
            'email' => 'system.demo@vnpt.vn',
            'status' => 'SUSPENDED',
            'department_id' => $techDeptId,
            'position_id' => 3,
            'job_title_raw' => 'Automation Operator',
            'date_of_birth' => '1988-11-11',
            'gender' => 'OTHER',
            'vpn_status' => 'YES',
            'ip_address' => '10.10.10.99',
        ]);

        return ['admin' => $adminId, 'sales' => $salesId, 'system' => $systemId];
    }

    /**
     * @param array<string,mixed> $data
     */
    private function upsertInternalUser(array $data): ?int
    {
        $lookup = null;
        if ($this->hasColumn('internal_users', 'username') && ! empty($data['username'])) {
            $lookup = ['username', $data['username']];
        } elseif ($this->hasColumn('internal_users', 'user_code') && ! empty($data['user_code'])) {
            $lookup = ['user_code', $data['user_code']];
        } elseif ($this->hasColumn('internal_users', 'email') && ! empty($data['email'])) {
            $lookup = ['email', $data['email']];
        }

        if ($lookup === null) {
            return null;
        }

        [$lookupKey, $lookupValue] = $lookup;
        $existing = DB::table('internal_users')->where($lookupKey, $lookupValue)->first();

        $payload = $this->filterColumns('internal_users', [
            'uuid' => (string) Str::uuid(),
            'user_code' => $data['user_code'] ?? null,
            'username' => $data['username'] ?? null,
            'password' => $data['password'] ?? null,
            'full_name' => $data['full_name'] ?? null,
            'email' => $data['email'] ?? null,
            'status' => $data['status'] ?? 'ACTIVE',
            'department_id' => $data['department_id'] ?? null,
            'position_id' => $data['position_id'] ?? null,
            'job_title_raw' => $data['job_title_raw'] ?? null,
            'date_of_birth' => $data['date_of_birth'] ?? null,
            'gender' => $data['gender'] ?? null,
            'vpn_status' => $data['vpn_status'] ?? null,
            'ip_address' => $data['ip_address'] ?? null,
            'updated_at' => now(),
        ]);

        if ($existing) {
            DB::table('internal_users')->where('id', $existing->id)->update($payload);

            return (int) $existing->id;
        }

        $insert = array_merge(
            $this->filterColumns('internal_users', [
                'created_at' => now(),
            ]),
            $payload
        );

        if (! $this->hasColumn('internal_users', 'id')) {
            DB::table('internal_users')->insert($insert);

            return null;
        }

        return (int) DB::table('internal_users')->insertGetId($insert);
    }

    /**
     * @return array{domain_a:?int,domain_b:?int}
     */
    private function seedBusinessDomains(): array
    {
        if (! $this->hasTable('business_domains')) {
            return ['domain_a' => null, 'domain_b' => null];
        }

        $domainA = $this->upsertByUnique('business_domains', 'domain_code', 'KD006', [
            'domain_name' => 'Y tế số',
        ]);

        $domainB = $this->upsertByUnique('business_domains', 'domain_code', 'KD003', [
            'domain_name' => 'An toàn thông tin',
        ]);

        return ['domain_a' => $domainA, 'domain_b' => $domainB];
    }

    /**
     * @return array{vendor_a:?int,vendor_b:?int}
     */
    private function seedVendors(): array
    {
        if (! $this->hasTable('vendors')) {
            return ['vendor_a' => null, 'vendor_b' => null];
        }

        $vendorA = $this->upsertByUnique('vendors', 'vendor_code', 'DT006', [
            'vendor_name' => 'VNPT IT',
            'is_active' => 1,
        ]);

        $vendorB = $this->upsertByUnique('vendors', 'vendor_code', 'DT007', [
            'vendor_name' => 'FPT IS',
            'is_active' => 1,
        ]);

        return ['vendor_a' => $vendorA, 'vendor_b' => $vendorB];
    }

    /**
     * @param array{domain_a:?int,domain_b:?int} $domains
     * @param array{vendor_a:?int,vendor_b:?int} $vendors
     */
    private function seedProducts(array $domains, array $vendors): void
    {
        if (! $this->hasTable('products')) {
            return;
        }

        $domainA = $domains['domain_a'] ?? null;
        $domainB = $domains['domain_b'] ?? null;
        $vendorA = $vendors['vendor_a'] ?? null;
        $vendorB = $vendors['vendor_b'] ?? null;

        if ($domainA !== null && $vendorA !== null) {
            $this->upsertByUnique('products', 'product_code', 'VNPT_HIS', [
                'product_name' => 'Giải pháp VNPT HIS',
                'domain_id' => $domainA,
                'vendor_id' => $vendorA,
                'standard_price' => 150000000,
            ]);
        }

        if ($domainB !== null && $vendorB !== null) {
            $this->upsertByUnique('products', 'product_code', 'SOC_MONITOR', [
                'product_name' => 'Dịch vụ giám sát SOC',
                'domain_id' => $domainB,
                'vendor_id' => $vendorB,
                'standard_price' => 80000000,
            ]);
        }
    }

    /**
     * @return array{customer_a:?int,customer_b:?int}
     */
    private function seedCustomers(): array
    {
        if (! $this->hasTable('customers')) {
            return ['customer_a' => null, 'customer_b' => null];
        }

        $customerA = $this->upsertByUnique('customers', 'customer_code', 'KH001', [
            'customer_name' => 'Ngân hàng Vietcombank',
            'tax_code' => '0100112437',
            'address' => '198 Trần Quang Khải, Hoàn Kiếm, Hà Nội',
            'is_active' => 1,
        ]);

        $customerB = $this->upsertByUnique('customers', 'customer_code', 'KH002', [
            'customer_name' => 'Tập đoàn Petrolimex',
            'tax_code' => '0100107370',
            'address' => 'Số 1 Khâm Thiên, Đống Đa, Hà Nội',
            'is_active' => 1,
        ]);

        return ['customer_a' => $customerA, 'customer_b' => $customerB];
    }

    /**
     * @param array{customer_a:?int,customer_b:?int} $customers
     */
    private function seedCustomerPersonnel(array $customers): void
    {
        if (! $this->hasTable('customer_personnel')) {
            return;
        }

        $rows = [
            [
                'customer_id' => $customers['customer_a'] ?? null,
                'full_name' => 'Nguyễn Văn A',
                'position_type' => 'GIAM_DOC',
                'phone' => '0912345678',
                'email' => 'nguyenvana@vietcombank.com.vn',
                'date_of_birth' => '1980-05-15',
                'status' => 'ACTIVE',
            ],
            [
                'customer_id' => $customers['customer_b'] ?? null,
                'full_name' => 'Trần Thị B',
                'position_type' => 'TRUONG_PHONG',
                'phone' => '0987654321',
                'email' => 'tranthib@petrolimex.com.vn',
                'date_of_birth' => '1985-08-20',
                'status' => 'ACTIVE',
            ],
        ];

        foreach ($rows as $row) {
            $customerId = $row['customer_id'];
            if ($customerId === null || ! $this->hasColumn('customer_personnel', 'customer_id') || ! $this->hasColumn('customer_personnel', 'full_name')) {
                continue;
            }

            $existing = DB::table('customer_personnel')
                ->where('customer_id', $customerId)
                ->where('full_name', $row['full_name'])
                ->first();

            $payload = $this->filterColumns('customer_personnel', [
                'position_type' => $row['position_type'],
                'phone' => $row['phone'],
                'email' => $row['email'],
                'date_of_birth' => $row['date_of_birth'],
                'status' => $row['status'],
                'updated_at' => now(),
            ]);

            if ($existing) {
                if (! empty($payload)) {
                    DB::table('customer_personnel')->where('id', $existing->id)->update($payload);
                }
                continue;
            }

            DB::table('customer_personnel')->insert($this->filterColumns('customer_personnel', [
                'customer_id' => $customerId,
                'full_name' => $row['full_name'],
                'position_type' => $row['position_type'],
                'phone' => $row['phone'],
                'email' => $row['email'],
                'date_of_birth' => $row['date_of_birth'],
                'status' => $row['status'],
                'created_at' => now(),
                'updated_at' => now(),
            ]));
        }
    }

    /**
     * @param array{customer_a:?int,customer_b:?int} $customers
     * @param array{admin:?int,sales:?int,system:?int} $internalUsers
     * @param array{root:?int,sales:?int,tech:?int} $departments
     * @return array{opp_a:?int,opp_b:?int}
     */
    private function seedOpportunities(array $customers, array $internalUsers, array $departments): array
    {
        if (! $this->hasTable('opportunities')) {
            return ['opp_a' => null, 'opp_b' => null];
        }

        $ownerId = $internalUsers['sales'] ?? $internalUsers['admin'] ?? null;
        if ($ownerId === null) {
            return ['opp_a' => null, 'opp_b' => null];
        }

        $oppA = null;
        if (($customers['customer_a'] ?? null) !== null) {
            $oppA = $this->upsertByUnique('opportunities', 'opp_name', 'Triển khai VNPT HIS cho Vietcombank', [
                'customer_id' => $customers['customer_a'],
                'amount' => 150000000,
                'expected_value' => 150000000,
                'probability' => 70,
                'stage' => 'PROPOSAL',
                'dept_id' => $departments['sales'] ?? $departments['root'] ?? null,
                'owner_id' => $ownerId,
            ]);
        }

        $oppB = null;
        if (($customers['customer_b'] ?? null) !== null) {
            $oppB = $this->upsertByUnique('opportunities', 'opp_name', 'Dịch vụ SOC cho Petrolimex', [
                'customer_id' => $customers['customer_b'],
                'amount' => 80000000,
                'expected_value' => 80000000,
                'probability' => 60,
                'stage' => 'NEGOTIATION',
                'dept_id' => $departments['sales'] ?? $departments['root'] ?? null,
                'owner_id' => $ownerId,
            ]);
        }

        return ['opp_a' => $oppA, 'opp_b' => $oppB];
    }

    /**
     * @param array{customer_a:?int,customer_b:?int} $customers
     * @param array{opp_a:?int,opp_b:?int} $opportunities
     * @return array{project_a:?int,project_b:?int}
     */
    private function seedProjects(array $customers, array $opportunities): array
    {
        if (! $this->hasTable('projects')) {
            return ['project_a' => null, 'project_b' => null];
        }

        $projectA = null;
        if (($customers['customer_a'] ?? null) !== null) {
            $projectA = $this->upsertByUnique('projects', 'project_code', 'DA001', [
                'project_name' => 'Dự án VNPT HIS - Vietcombank',
                'customer_id' => $customers['customer_a'],
                'opportunity_id' => $opportunities['opp_a'] ?? null,
                'investment_mode' => 'DAU_TU',
                'start_date' => '2026-01-10',
                'expected_end_date' => '2026-12-31',
                'status' => 'ONGOING',
            ]);
        }

        $projectB = null;
        if (($customers['customer_b'] ?? null) !== null) {
            $projectB = $this->upsertByUnique('projects', 'project_code', 'DA002', [
                'project_name' => 'Dự án SOC - Petrolimex',
                'customer_id' => $customers['customer_b'],
                'opportunity_id' => $opportunities['opp_b'] ?? null,
                'investment_mode' => 'THUE_DICH_VU',
                'start_date' => '2026-02-01',
                'expected_end_date' => '2026-10-01',
                'status' => 'PLANNING',
            ]);
        }

        return ['project_a' => $projectA, 'project_b' => $projectB];
    }

    /**
     * @param array{project_a:?int,project_b:?int} $projects
     * @param array{customer_a:?int,customer_b:?int} $customers
     * @param array{root:?int,sales:?int,tech:?int} $departments
     */
    private function seedContracts(array $projects, array $customers, array $departments): void
    {
        if (! $this->hasTable('contracts')) {
            return;
        }

        if (($projects['project_a'] ?? null) !== null && ($customers['customer_a'] ?? null) !== null) {
            $this->upsertByUnique('contracts', 'contract_code', 'HD001', [
                'contract_name' => 'Hợp đồng triển khai VNPT HIS',
                'project_id' => $projects['project_a'],
                'customer_id' => $customers['customer_a'],
                'sign_date' => '2026-01-15',
                'expiry_date' => '2026-12-31',
                'value' => 150000000,
                'total_value' => 150000000,
                'status' => 'SIGNED',
                'dept_id' => $departments['sales'] ?? $departments['root'] ?? null,
            ]);
        }

        if (($projects['project_b'] ?? null) !== null && ($customers['customer_b'] ?? null) !== null) {
            $this->upsertByUnique('contracts', 'contract_code', 'HD002', [
                'contract_name' => 'Hợp đồng dịch vụ SOC',
                'project_id' => $projects['project_b'],
                'customer_id' => $customers['customer_b'],
                'sign_date' => '2026-02-20',
                'expiry_date' => '2026-12-20',
                'value' => 80000000,
                'total_value' => 80000000,
                'status' => 'PENDING',
                'dept_id' => $departments['sales'] ?? $departments['root'] ?? null,
            ]);
        }
    }

    /**
     * @return array{type_a:?int,type_b:?int}
     */
    private function seedDocumentTypes(): array
    {
        if (! $this->hasTable('document_types')) {
            return ['type_a' => null, 'type_b' => null];
        }

        $typeA = $this->upsertByUnique('document_types', 'type_code', 'DT001', [
            'type_name' => 'Hợp đồng kinh tế',
        ]);

        $typeB = $this->upsertByUnique('document_types', 'type_code', 'DT002', [
            'type_name' => 'Biên bản nghiệm thu',
        ]);

        return ['type_a' => $typeA, 'type_b' => $typeB];
    }

    /**
     * @param array{customer_a:?int,customer_b:?int} $customers
     * @param array{project_a:?int,project_b:?int} $projects
     * @param array{type_a:?int,type_b:?int} $documentTypes
     */
    private function seedDocuments(array $customers, array $projects, array $documentTypes): void
    {
        if (! $this->hasTable('documents')) {
            return;
        }

        if (($customers['customer_a'] ?? null) !== null && ($documentTypes['type_a'] ?? null) !== null) {
            $this->upsertByUnique('documents', 'document_code', 'DOC001', [
                'document_name' => 'Hợp đồng VNPT HIS - Bản chính',
                'document_type_id' => $documentTypes['type_a'],
                'customer_id' => $customers['customer_a'],
                'project_id' => $projects['project_a'] ?? null,
                'expiry_date' => '2026-12-31',
                'status' => 'ACTIVE',
            ]);
        }

        if (($customers['customer_b'] ?? null) !== null && ($documentTypes['type_b'] ?? null) !== null) {
            $this->upsertByUnique('documents', 'document_code', 'DOC002', [
                'document_name' => 'Biên bản nghiệm thu giai đoạn 1',
                'document_type_id' => $documentTypes['type_b'],
                'customer_id' => $customers['customer_b'],
                'project_id' => $projects['project_b'] ?? null,
                'expiry_date' => '2026-09-30',
                'status' => 'ACTIVE',
            ]);
        }
    }

    /**
     * @param array{admin:?int,sales:?int,system:?int} $internalUsers
     */
    private function seedReminders(array $internalUsers): void
    {
        if (! $this->hasTable('reminders')) {
            return;
        }

        $assignee = $internalUsers['sales'] ?? $internalUsers['admin'] ?? null;
        if ($assignee === null) {
            return;
        }

        $this->upsertByUnique('reminders', 'reminder_title', 'Gửi báo cáo tuần cho khách hàng', [
            'content' => 'Tổng hợp tiến độ và gửi báo cáo tuần.',
            'remind_date' => now()->addDays(1)->format('Y-m-d 09:00:00'),
            'assigned_to' => $assignee,
            'status' => 'ACTIVE',
            'is_read' => 0,
        ]);

        $this->upsertByUnique('reminders', 'reminder_title', 'Nhắc lịch họp kickoff dự án', [
            'content' => 'Chuẩn bị nội dung họp kickoff với khách hàng.',
            'remind_date' => now()->addDays(3)->format('Y-m-d 14:00:00'),
            'assigned_to' => $assignee,
            'status' => 'ACTIVE',
            'is_read' => 0,
        ]);
    }

    /**
     * @param array{admin:?int,sales:?int,system:?int} $internalUsers
     * @param array{root:?int,sales:?int,tech:?int} $departments
     */
    private function seedUserDeptHistory(array $internalUsers, array $departments): void
    {
        if (! $this->hasTable('user_dept_history')) {
            return;
        }

        $userId = $internalUsers['sales'] ?? $internalUsers['admin'] ?? null;
        $fromDept = $departments['root'] ?? null;
        $toDept = $departments['sales'] ?? null;

        if ($userId === null || $toDept === null || ! $this->hasColumn('user_dept_history', 'user_id')) {
            return;
        }

        $transferDate = now()->subDays(10)->format('Y-m-d');

        $existing = DB::table('user_dept_history')
            ->when($this->hasColumn('user_dept_history', 'to_dept_id'), fn ($query) => $query->where('to_dept_id', $toDept))
            ->when($this->hasColumn('user_dept_history', 'transfer_date'), fn ($query) => $query->where('transfer_date', $transferDate))
            ->where('user_id', $userId)
            ->first();

        $payload = $this->filterColumns('user_dept_history', [
            'from_dept_id' => $fromDept,
            'to_dept_id' => $toDept,
            'transfer_date' => $transferDate,
            'decision_number' => 'QD-2026-001',
            'reason' => 'Điều chuyển phục vụ dự án trọng điểm.',
            'updated_at' => now(),
        ]);

        if ($existing) {
            DB::table('user_dept_history')->where('id', $existing->id)->update($payload);
            return;
        }

        DB::table('user_dept_history')->insert($this->filterColumns('user_dept_history', [
            'user_id' => $userId,
            'from_dept_id' => $fromDept,
            'to_dept_id' => $toDept,
            'transfer_date' => $transferDate,
            'decision_number' => 'QD-2026-001',
            'reason' => 'Điều chuyển phục vụ dự án trọng điểm.',
            'created_at' => now(),
            'updated_at' => now(),
        ]));
    }

    /**
     * @param array<string,mixed> $payload
     */
    private function upsertByUnique(string $table, string $lookupColumn, mixed $lookupValue, array $payload): ?int
    {
        if (! $this->hasTable($table) || ! $this->hasColumn($table, $lookupColumn)) {
            return null;
        }

        $existing = DB::table($table)->where($lookupColumn, $lookupValue)->first();

        $updatePayload = $this->filterColumns($table, array_merge(
            $payload,
            ['updated_at' => now()],
        ));

        if ($existing) {
            if (! empty($updatePayload)) {
                DB::table($table)->where($lookupColumn, $lookupValue)->update($updatePayload);
            }

            return $this->hasColumn($table, 'id') ? (int) ($existing->id ?? 0) : null;
        }

        $insertPayload = $this->filterColumns($table, array_merge(
            [$lookupColumn => $lookupValue],
            $payload,
            ['created_at' => now(), 'updated_at' => now()],
        ));

        if (empty($insertPayload)) {
            return null;
        }

        if (! $this->hasColumn($table, 'id')) {
            DB::table($table)->insert($insertPayload);

            return null;
        }

        return (int) DB::table($table)->insertGetId($insertPayload);
    }

    /**
     * @param array{admin:?int,sales:?int,system:?int} $actors
     */
    private function seedAuditLogs(array $actors): void
    {
        if (! $this->hasTable('audit_logs')) {
            return;
        }

        $now = now();
        $rows = [
            [
                'uuid' => '11111111-1111-1111-1111-111111111111',
                'event' => 'INSERT',
                'auditable_type' => 'internal_users',
                'auditable_id' => 9001,
                'old_values' => null,
                'new_values' => json_encode(['status' => 'ACTIVE', 'vpn_status' => 'YES']),
                'url' => '/api/v5/internal-users',
                'ip_address' => '10.10.10.10',
                'user_agent' => 'Seeder/Test',
                'created_at' => $now->copy()->subMinutes(25)->format('Y-m-d H:i:s'),
                'created_by' => $actors['admin'],
            ],
            [
                'uuid' => '22222222-2222-2222-2222-222222222222',
                'event' => 'UPDATE',
                'auditable_type' => 'internal_users',
                'auditable_id' => 9002,
                'old_values' => json_encode(['vpn_status' => 'NO']),
                'new_values' => json_encode(['vpn_status' => 'YES']),
                'url' => '/api/v5/internal-users/9002',
                'ip_address' => '10.10.10.21',
                'user_agent' => 'Seeder/Test',
                'created_at' => $now->copy()->subMinutes(15)->format('Y-m-d H:i:s'),
                'created_by' => null, // Test fallback: "Hệ thống"
            ],
            [
                'uuid' => '33333333-3333-3333-3333-333333333333',
                'event' => 'DELETE',
                'auditable_type' => 'projects',
                'auditable_id' => 3001,
                'old_values' => json_encode(['status' => 'PLANNING']),
                'new_values' => null,
                'url' => '/api/v5/projects/3001',
                'ip_address' => '10.10.10.99',
                'user_agent' => 'Seeder/Test',
                'created_at' => $now->copy()->subMinutes(5)->format('Y-m-d H:i:s'),
                'created_by' => 999999, // Test fallback: "Unknown User"
            ],
        ];

        foreach ($rows as $row) {
            $query = DB::table('audit_logs');
            if ($this->hasColumn('audit_logs', 'uuid')) {
                $query->where('uuid', $row['uuid']);
            } else {
                $query
                    ->where('event', $row['event'])
                    ->where('auditable_type', $row['auditable_type'])
                    ->where('auditable_id', $row['auditable_id'])
                    ->where('created_at', $row['created_at']);
            }

            $exists = $query->exists();
            if ($exists) {
                continue;
            }

            DB::table('audit_logs')->insert($this->filterColumns('audit_logs', $row));
        }
    }

    private function hasTable(string $table): bool
    {
        try {
            return Schema::hasTable($table);
        } catch (\Throwable) {
            return false;
        }
    }

    private function hasColumn(string $table, string $column): bool
    {
        if (! $this->hasTable($table)) {
            return false;
        }

        try {
            return Schema::hasColumn($table, $column);
        } catch (\Throwable) {
            return false;
        }
    }

    /**
     * @param array<string,mixed> $payload
     * @return array<string,mixed>
     */
    private function filterColumns(string $table, array $payload): array
    {
        $filtered = [];
        foreach ($payload as $column => $value) {
            if ($this->hasColumn($table, (string) $column)) {
                $filtered[$column] = $value;
            }
        }

        return $filtered;
    }
}
