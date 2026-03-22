<?php

namespace Tests\Feature;

use App\Services\V5\V5DomainSupportService;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Tests\TestCase;

class V5DomainSupportUserSourceTest extends TestCase
{
    protected function setUp(): void
    {
        parent::setUp();

        Schema::dropIfExists('internal_users');
        Schema::dropIfExists('users');
    }

    public function test_it_prefers_internal_users_for_default_owner_and_owner_lookup(): void
    {
        $this->createInternalUsersTable();
        $this->createUsersTable();

        DB::table('internal_users')->insert([
            'id' => 10,
            'username' => 'internal.owner',
        ]);

        DB::table('users')->insert([
            [
                'id' => 10,
                'name' => 'Legacy Shadow Owner',
            ],
            [
                'id' => 99,
                'name' => 'Legacy Only Owner',
            ],
        ]);

        /** @var V5DomainSupportService $support */
        $support = app(V5DomainSupportService::class);

        $this->assertSame(10, $support->resolveDefaultOwnerId());
        $this->assertTrue($support->ownerExists(10));
        $this->assertFalse($support->ownerExists(99));
    }

    public function test_it_does_not_fallback_to_legacy_users_when_internal_users_is_missing(): void
    {
        $this->createUsersTable();

        DB::table('users')->insert([
            'id' => 99,
            'name' => 'Legacy Only Owner',
        ]);

        /** @var V5DomainSupportService $support */
        $support = app(V5DomainSupportService::class);

        $this->assertNull($support->resolveDefaultOwnerId());
        $this->assertFalse($support->ownerExists(99));
    }

    private function createInternalUsersTable(): void
    {
        Schema::create('internal_users', function (Blueprint $table): void {
            $table->bigIncrements('id');
            $table->string('username')->nullable();
        });
    }

    private function createUsersTable(): void
    {
        Schema::create('users', function (Blueprint $table): void {
            $table->bigIncrements('id');
            $table->string('name')->nullable();
        });
    }
}
