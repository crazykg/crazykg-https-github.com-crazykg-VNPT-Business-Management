<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    private const PROCEDURE_NAME = 'sp_generate_contract_payments';

    public function up(): void
    {
        if (DB::getDriverName() !== 'mysql') {
            return;
        }

        DB::unprepared(sprintf('DROP PROCEDURE IF EXISTS `%s`', self::PROCEDURE_NAME));
    }

    public function down(): void
    {
        // No-op: the application no longer relies on this legacy stored procedure.
    }
};
