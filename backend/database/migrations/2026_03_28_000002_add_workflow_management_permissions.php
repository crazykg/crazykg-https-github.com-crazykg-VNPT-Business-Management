<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * Migration: Add Workflow Management Permissions
 * 
 * Seed permissions for the Workflow Management module.
 * 
 * Permissions added:
 * - workflow.manage: Quản lý luồng công việc (workflow definitions & transitions)
 * 
 * Permission được auto-assign cho ADMIN role.
 */
return new class extends Migration
{
    public function up(): void
    {
        // Insert workflow.manage permission
        $permId = DB::table('permissions')->insertGetId([
            'perm_key' => 'workflow.manage',
            'perm_name' => 'Quản lý luồng công việc',
            'perm_group' => 'workflow',
            'is_active' => 1,
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        // Grant to ADMIN role
        $adminRole = DB::table('roles')->where('role_code', 'ADMIN')->first();
        
        if ($adminRole && $permId) {
            // Check if already exists
            $exists = DB::table('role_permission')
                ->where('role_id', $adminRole->id)
                ->where('permission_id', $permId)
                ->exists();
            
            if (!$exists) {
                DB::table('role_permission')->insert([
                    'role_id' => $adminRole->id,
                    'permission_id' => $permId,
                    'created_at' => now(),
                    'updated_at' => now(),
                ]);
            }
        }
    }

    public function down(): void
    {
        // Remove from role_permission
        $perm = DB::table('permissions')->where('perm_key', 'workflow.manage')->first();
        
        if ($perm) {
            DB::table('role_permission')->where('permission_id', $perm->id)->delete();
            DB::table('permissions')->where('id', $perm->id)->delete();
        }
    }
};
