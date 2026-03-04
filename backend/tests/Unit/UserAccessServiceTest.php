<?php

namespace Tests\Unit;

use App\Support\Auth\UserAccessService;
use PHPUnit\Framework\TestCase;

class UserAccessServiceTest extends TestCase
{
    public function test_has_permission_denies_empty_permission_key(): void
    {
        $service = new class extends UserAccessService
        {
            public function permissionKeysForUser(int $userId): array
            {
                return ['employees.read'];
            }
        };

        $this->assertFalse($service->hasPermission(10, ''));
        $this->assertFalse($service->hasPermission(10, '   '));
    }

    public function test_has_permission_grants_valid_permission_when_present(): void
    {
        $service = new class extends UserAccessService
        {
            public function permissionKeysForUser(int $userId): array
            {
                return ['employees.read', 'employees.write'];
            }
        };

        $this->assertTrue($service->hasPermission(10, 'employees.read'));
    }

    public function test_has_permission_denies_when_permission_is_missing(): void
    {
        $service = new class extends UserAccessService
        {
            public function permissionKeysForUser(int $userId): array
            {
                return ['employees.read'];
            }
        };

        $this->assertFalse($service->hasPermission(10, 'employees.delete'));
    }
}

