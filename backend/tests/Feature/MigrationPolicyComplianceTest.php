<?php

namespace Tests\Feature;

use Tests\TestCase;

class MigrationPolicyComplianceTest extends TestCase
{
    /**
     * @var array<int, string>
     */
    private const INDEX_MIGRATIONS = [
        'database/migrations/2026_03_01_010000_add_performance_indexes_for_request_lists.php',
        'database/migrations/2026_03_01_183000_add_phase2_support_request_filter_indexes.php',
        'database/migrations/2026_03_01_191000_add_programming_worklog_indexes.php',
        'database/migrations/2026_03_23_110000_add_covering_indexes_for_customer_insight.php',
        'database/migrations/2026_03_25_200000_add_performance_indexes_to_fee_collection.php',
    ];

    public function test_index_migrations_follow_a12_mysql_guard_and_online_ddl_policy(): void
    {
        foreach (self::INDEX_MIGRATIONS as $relativePath) {
            $content = file_get_contents(base_path($relativePath));

            $this->assertIsString($content, sprintf('Could not read migration %s', $relativePath));
            $this->assertStringContainsString(
                "DB::getDriverName() === 'mysql'",
                $content,
                sprintf('Migration %s must guard MySQL-specific index DDL.', $relativePath)
            );
            $this->assertStringContainsString(
                'ALGORITHM=INPLACE LOCK=NONE',
                $content,
                sprintf('Migration %s must use MySQL online DDL for index creation.', $relativePath)
            );
        }
    }
}
