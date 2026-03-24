<?php

namespace Tests\Feature;

use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Tests\TestCase;

class BusinessCrudTest extends TestCase
{
    protected function setUp(): void
    {
        parent::setUp();

        $this->withoutMiddleware();
        $this->setUpSchema();
    }

    public function test_it_creates_lists_and_updates_businesses_with_focal_point_fields(): void
    {
        $createResponse = $this->postJson('/api/v5/businesses', [
            'domain_code' => 'KD001',
            'domain_name' => 'Trung tam du lieu',
            'focal_point_name' => 'Nguyen Viet Hung (TT.DAS)',
            'focal_point_phone' => '0889773979',
            'focal_point_email' => 'ndvhung@vnpt.vn',
        ]);

        $createResponse
            ->assertCreated()
            ->assertJsonPath('data.id', 1)
            ->assertJsonPath('data.domain_code', 'KD001')
            ->assertJsonPath('data.domain_name', 'Trung tam du lieu')
            ->assertJsonPath('data.focal_point_name', 'Nguyen Viet Hung (TT.DAS)')
            ->assertJsonPath('data.focal_point_phone', '0889773979')
            ->assertJsonPath('data.focal_point_email', 'ndvhung@vnpt.vn');

        $listResponse = $this->getJson('/api/v5/businesses');

        $listResponse
            ->assertOk()
            ->assertJsonCount(1, 'data')
            ->assertJsonPath('data.0.focal_point_name', 'Nguyen Viet Hung (TT.DAS)')
            ->assertJsonPath('data.0.focal_point_phone', '0889773979')
            ->assertJsonPath('data.0.focal_point_email', 'ndvhung@vnpt.vn');

        $updateResponse = $this->putJson('/api/v5/businesses/1', [
            'domain_name' => 'Trung tam du lieu moi',
            'focal_point_phone' => '0909123456',
            'focal_point_email' => 'hung.updated@vnpt.vn',
        ]);

        $updateResponse
            ->assertOk()
            ->assertJsonPath('data.id', 1)
            ->assertJsonPath('data.domain_name', 'Trung tam du lieu moi')
            ->assertJsonPath('data.focal_point_name', 'Nguyen Viet Hung (TT.DAS)')
            ->assertJsonPath('data.focal_point_phone', '0909123456')
            ->assertJsonPath('data.focal_point_email', 'hung.updated@vnpt.vn');

        $this->assertSame(
            'hung.updated@vnpt.vn',
            DB::table('business_domains')->where('id', 1)->value('focal_point_email')
        );
    }

    public function test_it_rejects_invalid_focal_point_email(): void
    {
        $response = $this->postJson('/api/v5/businesses', [
            'domain_code' => 'KD002',
            'domain_name' => 'Phan mem',
            'focal_point_email' => 'email-khong-hop-le',
        ]);

        $response
            ->assertStatus(422)
            ->assertJsonValidationErrors(['focal_point_email']);
    }

    private function setUpSchema(): void
    {
        Schema::dropIfExists('business_domains');

        Schema::create('business_domains', function (Blueprint $table): void {
            $table->bigIncrements('id');
            $table->string('domain_code', 50)->unique();
            $table->string('domain_name', 100);
            $table->string('focal_point_name', 255)->nullable();
            $table->string('focal_point_phone', 50)->nullable();
            $table->string('focal_point_email', 255)->nullable();
            $table->timestamp('created_at')->nullable();
            $table->timestamp('updated_at')->nullable();
        });
    }
}
