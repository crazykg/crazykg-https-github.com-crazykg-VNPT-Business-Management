<?php

namespace Tests\Feature;

use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Tests\TestCase;

class AuditLogPrefersInternalUsersTest extends TestCase
{
    protected function setUp(): void
    {
        parent::setUp();

        $this->withoutMiddleware();
        $this->setUpSchema();
    }

    public function test_it_resolves_audit_actor_only_from_internal_users(): void
    {
        DB::table('internal_users')->insert([
            'id' => 1,
            'username' => 'internal.actor',
            'full_name' => 'Internal Actor',
        ]);

        DB::table('users')->insert([
            [
                'id' => 1,
                'name' => 'Legacy Shadow Actor',
            ],
            [
                'id' => 2,
                'name' => 'Legacy Only Actor',
            ],
        ]);

        DB::table('audit_logs')->insert([
            [
                'id' => 1,
                'event' => 'UPDATE',
                'auditable_type' => 'customers',
                'auditable_id' => 10,
                'created_by' => 1,
                'created_at' => now(),
            ],
            [
                'id' => 2,
                'event' => 'DELETE',
                'auditable_type' => 'customers',
                'auditable_id' => 11,
                'created_by' => 2,
                'created_at' => now()->subMinute(),
            ],
        ]);

        $response = $this->getJson('/api/v5/audit-logs');

        $response->assertOk();

        /** @var Collection<int, array<string, mixed>> $rows */
        $rows = collect($response->json('data'));

        $internalActorRow = $rows->firstWhere('id', 1);
        $legacyOnlyActorRow = $rows->firstWhere('id', 2);

        $this->assertIsArray($internalActorRow);
        $this->assertSame('Internal Actor', $internalActorRow['actor']['full_name']);
        $this->assertSame('internal.actor', $internalActorRow['actor']['username']);

        $this->assertIsArray($legacyOnlyActorRow);
        $this->assertNull($legacyOnlyActorRow['actor']);
    }

    private function setUpSchema(): void
    {
        Schema::dropIfExists('audit_logs');
        Schema::dropIfExists('internal_users');
        Schema::dropIfExists('users');

        Schema::create('internal_users', function (Blueprint $table): void {
            $table->bigIncrements('id');
            $table->string('username')->nullable();
            $table->string('full_name')->nullable();
        });

        Schema::create('users', function (Blueprint $table): void {
            $table->bigIncrements('id');
            $table->string('name')->nullable();
        });

        Schema::create('audit_logs', function (Blueprint $table): void {
            $table->bigIncrements('id');
            $table->uuid('uuid')->nullable();
            $table->string('event')->nullable();
            $table->string('auditable_type')->nullable();
            $table->unsignedBigInteger('auditable_id')->nullable();
            $table->json('old_values')->nullable();
            $table->json('new_values')->nullable();
            $table->string('url')->nullable();
            $table->string('ip_address')->nullable();
            $table->text('user_agent')->nullable();
            $table->unsignedBigInteger('created_by')->nullable();
            $table->timestamp('created_at')->nullable();
        });
    }
}
