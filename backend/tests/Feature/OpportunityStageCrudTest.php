<?php

namespace Tests\Feature;

use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Tests\TestCase;

class OpportunityStageCrudTest extends TestCase
{
    protected function setUp(): void
    {
        parent::setUp();

        $this->withoutMiddleware();
        $this->setUpSchema();
    }

    public function test_it_creates_lists_and_updates_opportunity_stages_via_api(): void
    {
        $createResponse = $this->postJson('/api/v5/opportunity-stages', [
            'stage_code' => 'FOLLOW_UP',
            'stage_name' => 'Theo doi',
            'sort_order' => 10,
        ]);

        $createResponse
            ->assertCreated()
            ->assertJsonPath('data.id', 1)
            ->assertJsonPath('data.stage_code', 'FOLLOW_UP')
            ->assertJsonPath('data.stage_name', 'Theo doi')
            ->assertJsonPath('data.used_in_opportunities', 0)
            ->assertJsonPath('data.is_code_editable', true);

        DB::table('opportunities')->insert([
            'id' => 1,
            'stage' => 'FOLLOW_UP',
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        $listResponse = $this->getJson('/api/v5/opportunity_stages?include_inactive=1');

        $listResponse
            ->assertOk()
            ->assertJsonCount(1, 'data')
            ->assertJsonPath('data.0.stage_code', 'FOLLOW_UP')
            ->assertJsonPath('data.0.used_in_opportunities', 1)
            ->assertJsonPath('data.0.is_code_editable', false);

        $updateResponse = $this->putJson('/api/v5/opportunity_stages/1', [
            'stage_name' => 'Theo doi moi',
            'description' => 'Cap nhat ten',
            'is_active' => false,
        ]);

        $updateResponse
            ->assertOk()
            ->assertJsonPath('data.stage_code', 'FOLLOW_UP')
            ->assertJsonPath('data.stage_name', 'Theo doi moi')
            ->assertJsonPath('data.description', 'Cap nhat ten')
            ->assertJsonPath('data.is_active', false)
            ->assertJsonPath('data.used_in_opportunities', 1);
    }

    private function setUpSchema(): void
    {
        Schema::dropIfExists('opportunities');
        Schema::dropIfExists('opportunity_stages');

        Schema::create('opportunity_stages', function (Blueprint $table): void {
            $table->bigIncrements('id');
            $table->string('stage_code', 50);
            $table->string('stage_name', 120);
            $table->string('description', 255)->nullable();
            $table->boolean('is_terminal')->default(false);
            $table->boolean('is_active')->default(true);
            $table->integer('sort_order')->default(0);
            $table->timestamp('created_at')->nullable();
            $table->timestamp('updated_at')->nullable();
        });

        Schema::create('opportunities', function (Blueprint $table): void {
            $table->bigIncrements('id');
            $table->string('stage', 50)->nullable();
            $table->timestamp('deleted_at')->nullable();
            $table->timestamp('created_at')->nullable();
            $table->timestamp('updated_at')->nullable();
        });
    }
}
