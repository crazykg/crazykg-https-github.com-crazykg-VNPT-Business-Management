<?php

namespace Tests\Feature;

use App\Models\InternalUser;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Tests\TestCase;

class ContractTermPersistenceTest extends TestCase
{
    protected function setUp(): void
    {
        parent::setUp();

        $this->withoutMiddleware();
        $this->setUpSchema();
        $this->actingAs(InternalUser::query()->findOrFail(1));
    }

    public function test_it_creates_contract_with_term_fields(): void
    {
        $this->postJson('/api/v5/contracts', [
            'contract_code' => 'HD-001',
            'contract_name' => 'Hop dong giam sat SOC',
            'signer_user_id' => 1,
            'customer_id' => 1,
            'project_id' => 1,
            'value' => 982019190,
            'payment_cycle' => 'YEARLY',
            'status' => 'DRAFT',
            'sign_date' => '2026-03-01',
            'effective_date' => '2026-03-01',
            'term_unit' => 'DAY',
            'term_value' => 50,
            'expiry_date_manual_override' => false,
        ])
            ->assertCreated()
            ->assertJsonPath('data.payment_cycle', 'YEARLY')
            ->assertJsonPath('data.signer_user_id', 1)
            ->assertJsonPath('data.dept_id', 10)
            ->assertJsonPath('data.term_unit', 'DAY')
            ->assertJsonPath('data.term_value', 50)
            ->assertJsonPath('data.expiry_date_manual_override', false)
            ->assertJsonPath('data.expiry_date', '2026-04-19');

        $stored = DB::table('contracts')->where('contract_code', 'HD-001')->first();
        $this->assertNotNull($stored);
        $this->assertSame('YEARLY', $stored->payment_cycle);
        $this->assertSame(1, (int) $stored->signer_user_id);
        $this->assertSame(10, (int) $stored->dept_id);
        $this->assertSame('DAY', $stored->term_unit);
        $this->assertSame(50.0, (float) $stored->term_value);
        $this->assertSame(0, (int) $stored->expiry_date_manual_override);
        $this->assertSame('2026-04-19', $stored->expiry_date);
    }

    public function test_it_creates_initial_contract_without_project_and_persists_project_type_code(): void
    {
        $this->postJson('/api/v5/contracts', [
            'contract_code' => 'HD-INITIAL-001',
            'contract_name' => 'Hop dong dau ky',
            'signer_user_id' => 1,
            'customer_id' => 1,
            'project_id' => null,
            'project_type_code' => 'THUE_DICH_VU_COSAN',
            'value' => 125000000,
            'payment_cycle' => 'MONTHLY',
            'status' => 'DRAFT',
            'sign_date' => '2026-03-01',
            'effective_date' => '2026-03-01',
            'term_unit' => 'MONTH',
            'term_value' => 12,
            'expiry_date_manual_override' => false,
        ])
            ->assertCreated()
            ->assertJsonPath('data.project_id', null)
            ->assertJsonPath('data.customer_id', 1)
            ->assertJsonPath('data.project_type_code', 'THUE_DICH_VU_COSAN');

        $stored = DB::table('contracts')->where('contract_code', 'HD-INITIAL-001')->first();
        $this->assertNotNull($stored);
        $this->assertNull($stored->project_id);
        $this->assertSame(1, (int) $stored->customer_id);
        $this->assertSame('THUE_DICH_VU_COSAN', $stored->project_type_code);
    }

    public function test_it_derives_customer_from_project_and_clears_initial_project_type_on_update(): void
    {
        DB::table('contracts')->insert([
            'id' => 101,
            'contract_code' => 'HD-101',
            'contract_name' => 'Hop dong dau ky can chuyen mode',
            'customer_id' => 2,
            'project_id' => null,
            'project_type_code' => 'THUE_DICH_VU_COSAN',
            'dept_id' => 10,
            'signer_user_id' => 1,
            'value' => 99000000,
            'payment_cycle' => 'MONTHLY',
            'status' => 'DRAFT',
            'sign_date' => '2026-03-01',
            'effective_date' => '2026-03-01',
            'expiry_date' => '2026-04-30',
            'term_unit' => 'MONTH',
            'term_value' => 2,
            'expiry_date_manual_override' => 0,
            'created_by' => 1,
            'updated_by' => 1,
            'created_at' => now(),
            'updated_at' => now(),
            'deleted_at' => null,
        ]);

        $this->putJson('/api/v5/contracts/101', [
            'signer_user_id' => 1,
            'project_id' => 1,
            'customer_id' => 2,
            'project_type_code' => null,
            'sign_date' => '2026-03-01',
            'effective_date' => '2026-03-01',
        ])
            ->assertOk()
            ->assertJsonPath('data.project_id', 1)
            ->assertJsonPath('data.customer_id', 1)
            ->assertJsonPath('data.project_type_code', null);

        $stored = DB::table('contracts')->where('id', 101)->first();
        $this->assertNotNull($stored);
        $this->assertSame(1, (int) $stored->project_id);
        $this->assertSame(1, (int) $stored->customer_id);
        $this->assertNull($stored->project_type_code);
    }

    public function test_it_rejects_conflicting_project_and_initial_project_type_payload(): void
    {
        $this->postJson('/api/v5/contracts', [
            'contract_code' => 'HD-CONFLICT-001',
            'contract_name' => 'Hop dong mau thuan',
            'signer_user_id' => 1,
            'customer_id' => 2,
            'project_id' => 1,
            'project_type_code' => 'DAU_TU',
            'value' => 1000000,
            'payment_cycle' => 'ONCE',
            'status' => 'DRAFT',
            'sign_date' => '2026-03-01',
            'effective_date' => '2026-03-01',
        ])
            ->assertStatus(422)
            ->assertJsonValidationErrors(['project_type_code']);
    }

    public function test_it_updates_and_lists_contract_term_fields(): void
    {
        DB::table('contracts')->insert([
            'id' => 100,
            'contract_code' => 'HD-100',
            'contract_name' => 'Hop dong ban dau',
            'customer_id' => 1,
            'project_id' => 1,
            'project_type_code' => null,
            'dept_id' => 10,
            'signer_user_id' => 1,
            'value' => 150000000,
            'payment_cycle' => 'ONCE',
            'status' => 'DRAFT',
            'sign_date' => '2026-03-01',
            'effective_date' => '2026-03-01',
            'expiry_date' => null,
            'term_unit' => null,
            'term_value' => null,
            'expiry_date_manual_override' => 0,
            'created_by' => 1,
            'updated_by' => 1,
            'created_at' => now(),
            'updated_at' => now(),
            'deleted_at' => null,
        ]);

        $this->putJson('/api/v5/contracts/100', [
            'signer_user_id' => 1,
            'payment_cycle' => 'MONTHLY',
            'term_unit' => 'MONTH',
            'term_value' => 2,
            'expiry_date_manual_override' => false,
            'sign_date' => '2026-03-01',
            'effective_date' => '2026-03-01',
        ])
            ->assertOk()
            ->assertJsonPath('data.payment_cycle', 'MONTHLY')
            ->assertJsonPath('data.signer_user_id', 1)
            ->assertJsonPath('data.dept_id', 10)
            ->assertJsonPath('data.dept_code', 'P10')
            ->assertJsonPath('data.dept_name', 'Phong giai phap 10')
            ->assertJsonPath('data.term_unit', 'MONTH')
            ->assertJsonPath('data.term_value', 2)
            ->assertJsonPath('data.expiry_date_manual_override', false)
            ->assertJsonPath('data.expiry_date', '2026-04-30');

        $stored = DB::table('contracts')->where('id', 100)->first();
        $this->assertNotNull($stored);
        $this->assertSame('MONTHLY', $stored->payment_cycle);
        $this->assertSame(1, (int) $stored->signer_user_id);
        $this->assertSame(10, (int) $stored->dept_id);
        $this->assertSame('MONTH', $stored->term_unit);
        $this->assertSame(2.0, (float) $stored->term_value);
        $this->assertSame(0, (int) $stored->expiry_date_manual_override);
        $this->assertSame('2026-04-30', $stored->expiry_date);

        $this->getJson('/api/v5/contracts?page=1&per_page=10')
            ->assertOk()
            ->assertJsonPath('data.0.id', 100)
            ->assertJsonPath('data.0.payment_cycle', 'MONTHLY')
            ->assertJsonPath('data.0.signer_user_id', 1)
            ->assertJsonPath('data.0.dept_id', 10)
            ->assertJsonPath('data.0.signer_user_code', 'U001')
            ->assertJsonPath('data.0.signer_full_name', 'Tester')
            ->assertJsonPath('data.0.term_unit', 'MONTH')
            ->assertJsonPath('data.0.term_value', 2)
            ->assertJsonPath('data.0.expiry_date_manual_override', false)
            ->assertJsonPath('data.0.expiry_date', '2026-04-30');
    }

    public function test_it_persists_and_returns_pdf_contract_attachments(): void
    {
        $createResponse = $this->postJson('/api/v5/contracts', [
            'contract_code' => 'HD-ATT-001',
            'contract_name' => 'Hop dong co file PDF',
            'signer_user_id' => 1,
            'customer_id' => 1,
            'project_id' => 1,
            'value' => 125000000,
            'payment_cycle' => 'ONCE',
            'status' => 'DRAFT',
            'attachments' => [
                [
                    'id' => 'temp-1',
                    'fileName' => 'hop-dong-da-ky.pdf',
                    'fileUrl' => 'https://example.test/contracts/hop-dong-da-ky.pdf',
                    'fileSize' => 4096,
                    'mimeType' => 'application/pdf',
                    'createdAt' => '2026-04-11T09:00:00Z',
                    'storagePath' => 'contracts/hop-dong-da-ky.pdf',
                    'storageDisk' => 'local',
                    'storageVisibility' => 'private',
                ],
            ],
        ]);

        $createResponse
            ->assertCreated()
            ->assertJsonPath('data.attachments.0.fileName', 'hop-dong-da-ky.pdf')
            ->assertJsonPath('data.attachments.0.mimeType', 'application/pdf');

        $contractId = (int) $createResponse->json('data.id');
        $this->assertGreaterThan(0, $contractId);
        $this->assertSame(
            'hop-dong-da-ky.pdf',
            DB::table('attachments')
                ->where('reference_type', 'CONTRACT')
                ->where('reference_id', $contractId)
                ->value('file_name')
        );

        $this->putJson("/api/v5/contracts/{$contractId}", [
            'signer_user_id' => 1,
            'attachments' => [
                [
                    'id' => 'temp-2',
                    'fileName' => 'phu-luc-hop-dong.pdf',
                    'fileUrl' => 'https://example.test/contracts/phu-luc-hop-dong.pdf',
                    'fileSize' => 2048,
                    'mimeType' => 'application/pdf',
                    'createdAt' => '2026-04-11T10:00:00Z',
                    'storagePath' => 'contracts/phu-luc-hop-dong.pdf',
                    'storageDisk' => 'local',
                    'storageVisibility' => 'private',
                ],
            ],
        ])
            ->assertOk()
            ->assertJsonPath('data.attachments.0.fileName', 'phu-luc-hop-dong.pdf');

        $this->assertSame(1, DB::table('attachments')->where('reference_type', 'CONTRACT')->where('reference_id', $contractId)->count());
        $this->assertSame(
            'phu-luc-hop-dong.pdf',
            DB::table('attachments')
                ->where('reference_type', 'CONTRACT')
                ->where('reference_id', $contractId)
                ->value('file_name')
        );

        $this->getJson("/api/v5/contracts/{$contractId}")
            ->assertOk()
            ->assertJsonPath('data.attachments.0.fileName', 'phu-luc-hop-dong.pdf')
            ->assertJsonPath('data.attachments.0.mimeType', 'application/pdf');
    }

    public function test_it_deletes_contract_attachment_rows_when_contract_is_deleted(): void
    {
        DB::table('contracts')->insert([
            'id' => 301,
            'contract_code' => 'HD-DEL-301',
            'contract_name' => 'Hop dong can xoa file dinh kem',
            'customer_id' => 1,
            'project_id' => 1,
            'project_type_code' => null,
            'dept_id' => 10,
            'signer_user_id' => 1,
            'value' => 125000000,
            'payment_cycle' => 'ONCE',
            'status' => 'DRAFT',
            'sign_date' => '2026-03-01',
            'effective_date' => '2026-03-01',
            'expiry_date' => '2026-12-31',
            'term_unit' => 'DAY',
            'term_value' => 30,
            'expiry_date_manual_override' => 0,
            'created_by' => 1,
            'updated_by' => 1,
            'created_at' => now(),
            'updated_at' => now(),
            'deleted_at' => null,
        ]);

        DB::table('attachments')->insert([
            'reference_type' => 'CONTRACT',
            'reference_id' => 301,
            'file_name' => 'hop-dong-da-ky.pdf',
            'file_url' => 'https://example.test/contracts/hop-dong-da-ky.pdf',
            'drive_file_id' => null,
            'file_size' => 4096,
            'mime_type' => 'application/pdf',
            'storage_disk' => 'local',
            'storage_path' => 'contracts/hop-dong-da-ky.pdf',
            'storage_visibility' => 'private',
            'created_by' => 1,
            'updated_by' => 1,
            'created_at' => now(),
            'updated_at' => now(),
            'deleted_at' => null,
        ]);

        $this->assertSame(1, DB::table('attachments')->where('reference_type', 'CONTRACT')->where('reference_id', 301)->count());

        $this->deleteJson('/api/v5/contracts/301')
            ->assertOk();

        $this->assertSame(0, DB::table('attachments')->where('reference_type', 'CONTRACT')->where('reference_id', 301)->count());
    }

    public function test_it_rejects_non_pdf_contract_attachments(): void
    {
        $this->postJson('/api/v5/contracts', [
            'contract_code' => 'HD-ATT-ERR',
            'contract_name' => 'Hop dong sai dinh dang file',
            'signer_user_id' => 1,
            'customer_id' => 1,
            'project_id' => 1,
            'value' => 125000000,
            'payment_cycle' => 'ONCE',
            'status' => 'DRAFT',
            'attachments' => [
                [
                    'fileName' => 'hop-dong.docx',
                    'fileUrl' => 'https://example.test/contracts/hop-dong.docx',
                    'fileSize' => 1024,
                    'mimeType' => 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
                ],
            ],
        ])
            ->assertStatus(422)
            ->assertJsonValidationErrors(['attachments.0']);
    }

    public function test_it_filters_contract_index_by_source_mode(): void
    {
        DB::table('contracts')->insert([
            [
                'id' => 201,
                'contract_code' => 'HD-PROJECT-201',
                'contract_name' => 'Hop dong theo du an',
                'customer_id' => 1,
                'project_id' => 1,
                'project_type_code' => null,
                'dept_id' => 10,
                'signer_user_id' => 1,
                'value' => 150000000,
                'payment_cycle' => 'ONCE',
                'status' => 'SIGNED',
                'sign_date' => '2026-03-01',
                'effective_date' => '2026-03-01',
                'expiry_date' => '2026-12-31',
                'term_unit' => 'DAY',
                'term_value' => 30,
                'expiry_date_manual_override' => 0,
                'created_by' => 1,
                'updated_by' => 1,
                'created_at' => now(),
                'updated_at' => now(),
                'deleted_at' => null,
            ],
            [
                'id' => 202,
                'contract_code' => 'HD-INITIAL-202',
                'contract_name' => 'Hop dong dau ky',
                'customer_id' => 2,
                'project_id' => null,
                'project_type_code' => 'THUE_DICH_VU_COSAN',
                'dept_id' => 10,
                'signer_user_id' => 1,
                'value' => 98000000,
                'payment_cycle' => 'MONTHLY',
                'status' => 'DRAFT',
                'sign_date' => '2026-03-15',
                'effective_date' => '2026-03-15',
                'expiry_date' => '2027-03-14',
                'term_unit' => 'MONTH',
                'term_value' => 12,
                'expiry_date_manual_override' => 0,
                'created_by' => 1,
                'updated_by' => 1,
                'created_at' => now(),
                'updated_at' => now(),
                'deleted_at' => null,
            ],
        ]);

        $projectResponse = $this->getJson('/api/v5/contracts?page=1&per_page=10&filters[source_mode]=PROJECT')
            ->assertOk();
        $this->assertSame([201], collect($projectResponse->json('data'))->pluck('id')->all());

        $initialResponse = $this->getJson('/api/v5/contracts?page=1&per_page=10&filters[source_mode]=INITIAL')
            ->assertOk();
        $this->assertSame([202], collect($initialResponse->json('data'))->pluck('id')->all());
    }

    public function test_it_updates_signer_and_reassigns_contract_department(): void
    {
        DB::table('contracts')->insert([
            'id' => 102,
            'contract_code' => 'HD-102',
            'contract_name' => 'Hop dong doi nguoi ky',
            'customer_id' => 1,
            'project_id' => 1,
            'project_type_code' => null,
            'dept_id' => 10,
            'signer_user_id' => 1,
            'value' => 88000000,
            'payment_cycle' => 'ONCE',
            'status' => 'DRAFT',
            'sign_date' => '2026-03-01',
            'effective_date' => '2026-03-01',
            'expiry_date' => '2026-03-31',
            'term_unit' => 'DAY',
            'term_value' => 31,
            'expiry_date_manual_override' => 0,
            'created_by' => 1,
            'updated_by' => 1,
            'created_at' => now(),
            'updated_at' => now(),
            'deleted_at' => null,
        ]);

        $this->putJson('/api/v5/contracts/102', [
            'signer_user_id' => 2,
            'sign_date' => '2026-03-01',
            'effective_date' => '2026-03-01',
        ])
            ->assertOk()
            ->assertJsonPath('data.signer_user_id', 2)
            ->assertJsonPath('data.signer_user_code', 'U002')
            ->assertJsonPath('data.signer_full_name', 'Approver 20')
            ->assertJsonPath('data.dept_id', 20)
            ->assertJsonPath('data.dept_code', 'P20')
            ->assertJsonPath('data.dept_name', 'Phong giai phap 20');

        $stored = DB::table('contracts')->where('id', 102)->first();
        $this->assertNotNull($stored);
        $this->assertSame(2, (int) $stored->signer_user_id);
        $this->assertSame(20, (int) $stored->dept_id);
    }

    public function test_it_rejects_signer_without_valid_department(): void
    {
        $this->postJson('/api/v5/contracts', [
            'contract_code' => 'HD-NO-DEPT',
            'contract_name' => 'Hop dong signer loi',
            'signer_user_id' => 4,
            'customer_id' => 1,
            'project_id' => 1,
            'value' => 1000000,
            'payment_cycle' => 'ONCE',
            'status' => 'DRAFT',
        ])
            ->assertStatus(422)
            ->assertJsonValidationErrors(['signer_user_id']);
    }

    public function test_it_returns_scoped_signer_options(): void
    {
        $this->getJson('/api/v5/contracts/signer-options')
            ->assertOk()
            ->assertJsonPath('data.0.id', 1)
            ->assertJsonPath('data.0.user_code', 'U001')
            ->assertJsonPath('data.0.department_id', 10)
            ->assertJsonPath('data.0.dept_code', 'P10')
            ->assertJsonPath('data.1.id', 2)
            ->assertJsonPath('data.1.user_code', 'U002')
            ->assertJsonMissing(['id' => 3]);
    }

    public function test_it_returns_only_active_allowlisted_signer_options(): void
    {
        DB::table('contract_signer_masters')
            ->where('internal_user_id', 2)
            ->update(['is_active' => false]);

        $this->getJson('/api/v5/contracts/signer-options')
            ->assertOk()
            ->assertJsonFragment([
                'id' => 1,
                'user_code' => 'U001',
            ])
            ->assertJsonMissing([
                'id' => 2,
                'user_code' => 'U002',
            ]);
    }

    public function test_it_backfills_contract_signer_masters_from_existing_contract_signers(): void
    {
        DB::table('contract_signer_masters')->delete();
        DB::table('contracts')->insert([
            [
                'id' => 401,
                'contract_code' => 'HD-BF-401',
                'contract_name' => 'Backfill 401',
                'customer_id' => 1,
                'project_id' => 1,
                'project_type_code' => null,
                'dept_id' => 10,
                'signer_user_id' => 1,
                'value' => 1,
                'payment_cycle' => 'ONCE',
                'status' => 'DRAFT',
                'created_at' => now(),
                'updated_at' => now(),
                'deleted_at' => null,
            ],
            [
                'id' => 402,
                'contract_code' => 'HD-BF-402',
                'contract_name' => 'Backfill 402',
                'customer_id' => 1,
                'project_id' => 1,
                'project_type_code' => null,
                'dept_id' => 20,
                'signer_user_id' => 2,
                'value' => 1,
                'payment_cycle' => 'ONCE',
                'status' => 'DRAFT',
                'created_at' => now(),
                'updated_at' => now(),
                'deleted_at' => null,
            ],
        ]);

        $migration = require base_path('database/migrations/2026_04_11_170100_backfill_contract_signer_masters_from_contracts.php');
        $migration->up();

        $rows = DB::table('contract_signer_masters')
            ->orderBy('internal_user_id')
            ->get(['internal_user_id', 'is_active'])
            ->map(fn (object $row): array => [
                'internal_user_id' => (int) $row->internal_user_id,
                'is_active' => (bool) $row->is_active,
            ])
            ->all();

        $this->assertSame([
            ['internal_user_id' => 1, 'is_active' => true],
            ['internal_user_id' => 2, 'is_active' => true],
        ], $rows);
    }

    public function test_it_resolves_signer_option_ownership_department_to_solution_center_or_self(): void
    {
        $this->seedOwnershipDepartmentFixtures();

        $this->getJson('/api/v5/contracts/signer-options')
            ->assertOk()
            ->assertJsonFragment([
                'id' => 12,
                'user_code' => 'U012',
                'department_id' => 110,
                'dept_code' => 'TTKDGP',
                'dept_name' => 'Trung tam Kinh doanh Giai phap',
            ])
            ->assertJsonFragment([
                'id' => 13,
                'user_code' => 'U013',
                'department_id' => 130,
                'dept_code' => 'VNPT_CAIRANG',
                'dept_name' => 'VNPT Cai Rang',
            ]);
    }

    public function test_it_stores_solution_child_signer_under_solution_center_ownership_department(): void
    {
        $this->seedOwnershipDepartmentFixtures();

        $this->postJson('/api/v5/contracts', [
            'contract_code' => 'HD-OWN-001',
            'contract_name' => 'Hop dong ownership giai phap',
            'signer_user_id' => 12,
            'customer_id' => 1,
            'project_id' => null,
            'project_type_code' => 'THUE_DICH_VU_COSAN',
            'value' => 1000000,
            'payment_cycle' => 'ONCE',
            'status' => 'DRAFT',
            'sign_date' => '2026-03-01',
            'effective_date' => '2026-03-01',
        ])
            ->assertCreated()
            ->assertJsonPath('data.signer_user_id', 12)
            ->assertJsonPath('data.dept_id', 110)
            ->assertJsonPath('data.dept_code', 'TTKDGP')
            ->assertJsonPath('data.dept_name', 'Trung tam Kinh doanh Giai phap');

        $stored = DB::table('contracts')->where('contract_code', 'HD-OWN-001')->first();
        $this->assertNotNull($stored);
        $this->assertSame(12, (int) $stored->signer_user_id);
        $this->assertSame(110, (int) $stored->dept_id);
    }

    public function test_it_keeps_vnpt_area_signer_under_its_own_ownership_department_on_update(): void
    {
        $this->seedOwnershipDepartmentFixtures();

        DB::table('contracts')->insert([
            'id' => 103,
            'contract_code' => 'HD-103',
            'contract_name' => 'Hop dong cap nhat ownership',
            'customer_id' => 1,
            'project_id' => 1,
            'project_type_code' => null,
            'dept_id' => 10,
            'signer_user_id' => 1,
            'value' => 1000000,
            'payment_cycle' => 'ONCE',
            'status' => 'DRAFT',
            'sign_date' => '2026-03-01',
            'effective_date' => '2026-03-01',
            'expiry_date' => null,
            'term_unit' => null,
            'term_value' => null,
            'expiry_date_manual_override' => 0,
            'created_by' => 1,
            'updated_by' => 1,
            'created_at' => now(),
            'updated_at' => now(),
            'deleted_at' => null,
        ]);

        $this->putJson('/api/v5/contracts/103', [
            'signer_user_id' => 13,
            'payment_cycle' => 'ONCE',
            'sign_date' => '2026-03-01',
            'effective_date' => '2026-03-01',
        ])
            ->assertOk()
            ->assertJsonPath('data.signer_user_id', 13)
            ->assertJsonPath('data.dept_id', 130)
            ->assertJsonPath('data.dept_code', 'VNPT_CAIRANG')
            ->assertJsonPath('data.dept_name', 'VNPT Cai Rang');

        $stored = DB::table('contracts')->where('id', 103)->first();
        $this->assertNotNull($stored);
        $this->assertSame(13, (int) $stored->signer_user_id);
        $this->assertSame(130, (int) $stored->dept_id);
    }

    private function setUpSchema(): void
    {
        Schema::dropIfExists('user_dept_scopes');
        Schema::dropIfExists('attachments');
        Schema::dropIfExists('contracts');
        Schema::dropIfExists('contract_signer_masters');
        Schema::dropIfExists('project_types');
        Schema::dropIfExists('projects');
        Schema::dropIfExists('customers');
        Schema::dropIfExists('departments');
        Schema::dropIfExists('internal_users');

        Schema::create('departments', function (Blueprint $table): void {
            $table->bigIncrements('id');
            $table->string('dept_code', 50)->nullable();
            $table->string('dept_name', 255)->nullable();
            $table->unsignedBigInteger('parent_id')->nullable();
            $table->timestamp('deleted_at')->nullable();
        });

        Schema::create('internal_users', function (Blueprint $table): void {
            $table->bigIncrements('id');
            $table->string('user_code', 50)->nullable();
            $table->string('username', 100)->nullable();
            $table->string('full_name', 255)->nullable();
            $table->unsignedBigInteger('department_id')->nullable();
            $table->string('password')->nullable();
            $table->rememberToken();
            $table->timestamp('deleted_at')->nullable();
        });

        Schema::create('user_dept_scopes', function (Blueprint $table): void {
            $table->bigIncrements('id');
            $table->unsignedBigInteger('user_id');
            $table->unsignedBigInteger('dept_id');
            $table->string('scope_type', 32)->default('DEPT_ONLY');
        });

        Schema::create('customers', function (Blueprint $table): void {
            $table->bigIncrements('id');
            $table->string('customer_code', 50)->nullable();
            $table->string('customer_name', 255)->nullable();
            $table->timestamp('created_at')->nullable();
            $table->timestamp('updated_at')->nullable();
            $table->timestamp('deleted_at')->nullable();
        });

        Schema::create('projects', function (Blueprint $table): void {
            $table->bigIncrements('id');
            $table->string('project_code', 50)->nullable();
            $table->string('project_name', 255)->nullable();
            $table->unsignedBigInteger('customer_id')->nullable();
            $table->unsignedBigInteger('dept_id')->nullable();
            $table->string('investment_mode', 100)->nullable();
            $table->timestamp('created_at')->nullable();
            $table->timestamp('updated_at')->nullable();
            $table->timestamp('deleted_at')->nullable();
        });

        Schema::create('project_types', function (Blueprint $table): void {
            $table->bigIncrements('id');
            $table->string('type_code', 100)->nullable();
            $table->string('type_name', 255)->nullable();
            $table->timestamp('created_at')->nullable();
            $table->timestamp('updated_at')->nullable();
        });

        Schema::create('contracts', function (Blueprint $table): void {
            $table->bigIncrements('id');
            $table->string('contract_code', 100)->nullable();
            $table->string('contract_name', 255)->nullable();
            $table->unsignedBigInteger('customer_id')->nullable();
            $table->unsignedBigInteger('project_id')->nullable();
            $table->string('project_type_code', 100)->nullable();
            $table->unsignedBigInteger('dept_id')->nullable();
            $table->unsignedBigInteger('signer_user_id')->nullable();
            $table->decimal('value', 18, 2)->default(0);
            $table->string('payment_cycle', 32)->nullable();
            $table->string('status', 32)->nullable();
            $table->date('sign_date')->nullable();
            $table->date('effective_date')->nullable();
            $table->date('expiry_date')->nullable();
            $table->string('term_unit', 10)->nullable();
            $table->decimal('term_value', 10, 2)->nullable();
            $table->boolean('expiry_date_manual_override')->default(false);
            $table->string('data_scope', 255)->nullable();
            $table->unsignedBigInteger('created_by')->nullable();
            $table->unsignedBigInteger('updated_by')->nullable();
            $table->timestamp('created_at')->nullable();
            $table->timestamp('updated_at')->nullable();
            $table->timestamp('deleted_at')->nullable();
        });

        Schema::create('contract_signer_masters', function (Blueprint $table): void {
            $table->bigIncrements('id');
            $table->unsignedBigInteger('internal_user_id');
            $table->boolean('is_active')->default(true);
            $table->timestamp('created_at')->nullable();
            $table->unsignedBigInteger('created_by')->nullable();
            $table->timestamp('updated_at')->nullable();
            $table->unsignedBigInteger('updated_by')->nullable();
        });

        Schema::create('attachments', function (Blueprint $table): void {
            $table->bigIncrements('id');
            $table->string('reference_type', 100);
            $table->unsignedBigInteger('reference_id');
            $table->string('file_name', 255);
            $table->text('file_url')->nullable();
            $table->string('drive_file_id', 255)->nullable();
            $table->unsignedBigInteger('file_size')->default(0);
            $table->string('mime_type', 255)->nullable();
            $table->string('storage_disk', 100)->nullable();
            $table->string('storage_path', 500)->nullable();
            $table->string('storage_visibility', 50)->nullable();
            $table->unsignedBigInteger('created_by')->nullable();
            $table->unsignedBigInteger('updated_by')->nullable();
            $table->timestamp('created_at')->nullable();
            $table->timestamp('updated_at')->nullable();
            $table->timestamp('deleted_at')->nullable();
        });

        DB::table('departments')->insert([
            'id' => 10,
            'dept_code' => 'P10',
            'dept_name' => 'Phong giai phap 10',
            'parent_id' => null,
            'deleted_at' => null,
        ]);

        DB::table('departments')->insert([
            'id' => 20,
            'dept_code' => 'P20',
            'dept_name' => 'Phong giai phap 20',
            'parent_id' => null,
            'deleted_at' => null,
        ]);

        DB::table('departments')->insert([
            'id' => 30,
            'dept_code' => 'P30',
            'dept_name' => 'Phong giai phap 30',
            'parent_id' => null,
            'deleted_at' => null,
        ]);

        DB::table('internal_users')->insert([
            'id' => 1,
            'user_code' => 'U001',
            'username' => 'tester',
            'full_name' => 'Tester',
            'department_id' => 10,
            'password' => bcrypt('secret'),
            'remember_token' => null,
            'deleted_at' => null,
        ]);

        DB::table('internal_users')->insert([
            'id' => 2,
            'user_code' => 'U002',
            'username' => 'approver20',
            'full_name' => 'Approver 20',
            'department_id' => 20,
            'password' => bcrypt('secret'),
            'remember_token' => null,
            'deleted_at' => null,
        ]);

        DB::table('internal_users')->insert([
            'id' => 3,
            'user_code' => 'U003',
            'username' => 'outsider30',
            'full_name' => 'Outsider 30',
            'department_id' => 30,
            'password' => bcrypt('secret'),
            'remember_token' => null,
            'deleted_at' => null,
        ]);

        DB::table('internal_users')->insert([
            'id' => 4,
            'user_code' => 'U004',
            'username' => 'nodept',
            'full_name' => 'No Department',
            'department_id' => null,
            'password' => bcrypt('secret'),
            'remember_token' => null,
            'deleted_at' => null,
        ]);

        DB::table('user_dept_scopes')->insert([
            ['user_id' => 1, 'dept_id' => 10, 'scope_type' => 'DEPT_ONLY'],
            ['user_id' => 1, 'dept_id' => 20, 'scope_type' => 'DEPT_ONLY'],
        ]);

        DB::table('contract_signer_masters')->insert([
            [
                'id' => 1,
                'internal_user_id' => 1,
                'is_active' => true,
                'created_at' => now(),
                'updated_at' => now(),
            ],
            [
                'id' => 2,
                'internal_user_id' => 2,
                'is_active' => true,
                'created_at' => now(),
                'updated_at' => now(),
            ],
        ]);

        DB::table('customers')->insert([
            'id' => 1,
            'customer_code' => 'KH001',
            'customer_name' => 'Trung tam Phong chong HIV',
            'created_at' => now(),
            'updated_at' => now(),
            'deleted_at' => null,
        ]);

        DB::table('customers')->insert([
            'id' => 2,
            'customer_code' => 'KH002',
            'customer_name' => 'Benh vien Da khoa',
            'created_at' => now(),
            'updated_at' => now(),
            'deleted_at' => null,
        ]);

        DB::table('projects')->insert([
            'id' => 1,
            'project_code' => 'DA016',
            'project_name' => 'Du an giam sat SOC',
            'customer_id' => 1,
            'dept_id' => 10,
            'investment_mode' => 'DAU_TU',
            'created_at' => now(),
            'updated_at' => now(),
            'deleted_at' => null,
        ]);

        DB::table('project_types')->insert([
            [
                'id' => 1,
                'type_code' => 'DAU_TU',
                'type_name' => 'Dau tu',
                'created_at' => now(),
                'updated_at' => now(),
            ],
            [
                'id' => 2,
                'type_code' => 'THUE_DICH_VU_DACTHU',
                'type_name' => 'Thue dich vu CNTT dac thu',
                'created_at' => now(),
                'updated_at' => now(),
            ],
            [
                'id' => 3,
                'type_code' => 'THUE_DICH_VU_COSAN',
                'type_name' => 'Thue dich vu CNTT co san',
                'created_at' => now(),
                'updated_at' => now(),
            ],
        ]);
    }

    private function seedOwnershipDepartmentFixtures(): void
    {
        DB::table('departments')->insert([
            'id' => 100,
            'dept_code' => 'BGDVT',
            'dept_name' => 'Ban giam doc Vien Thong',
            'parent_id' => null,
            'deleted_at' => null,
        ]);

        DB::table('departments')->insert([
            'id' => 110,
            'dept_code' => 'TTKDGP',
            'dept_name' => 'Trung tam Kinh doanh Giai phap',
            'parent_id' => 100,
            'deleted_at' => null,
        ]);

        DB::table('departments')->insert([
            'id' => 120,
            'dept_code' => 'PGP2',
            'dept_name' => 'Phong giai phap 2',
            'parent_id' => 110,
            'deleted_at' => null,
        ]);

        DB::table('departments')->insert([
            'id' => 130,
            'dept_code' => 'VNPT_CAIRANG',
            'dept_name' => 'VNPT Cai Rang',
            'parent_id' => 100,
            'deleted_at' => null,
        ]);

        DB::table('internal_users')->insert([
            'id' => 12,
            'user_code' => 'U012',
            'username' => 'pgp2signer',
            'full_name' => 'Approver PGP2',
            'department_id' => 120,
            'password' => bcrypt('secret'),
            'remember_token' => null,
            'deleted_at' => null,
        ]);

        DB::table('internal_users')->insert([
            'id' => 13,
            'user_code' => 'U013',
            'username' => 'kvsigner',
            'full_name' => 'Approver KV',
            'department_id' => 130,
            'password' => bcrypt('secret'),
            'remember_token' => null,
            'deleted_at' => null,
        ]);

        DB::table('user_dept_scopes')->insert([
            ['user_id' => 1, 'dept_id' => 110, 'scope_type' => 'DEPT_ONLY'],
            ['user_id' => 1, 'dept_id' => 120, 'scope_type' => 'DEPT_ONLY'],
            ['user_id' => 1, 'dept_id' => 130, 'scope_type' => 'DEPT_ONLY'],
        ]);

        DB::table('contract_signer_masters')->insert([
            [
                'id' => 12,
                'internal_user_id' => 12,
                'is_active' => true,
                'created_at' => now(),
                'updated_at' => now(),
            ],
            [
                'id' => 13,
                'internal_user_id' => 13,
                'is_active' => true,
                'created_at' => now(),
                'updated_at' => now(),
            ],
        ]);
    }
}
