<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    private const TABLE = 'project_procedure_public_shares';
    private const CONSTRAINT = 'project_procedure_public_shares_created_by_foreign';

    public function up(): void
    {
        if (! Schema::hasTable(self::TABLE) || ! $this->hasCreatedByForeign()) {
            return;
        }

        Schema::table(self::TABLE, function (Blueprint $table): void {
            $table->dropForeign(self::CONSTRAINT);
        });
    }

    public function down(): void
    {
        if (! Schema::hasTable(self::TABLE) || ! Schema::hasTable('users') || $this->hasCreatedByForeign()) {
            return;
        }

        Schema::table(self::TABLE, function (Blueprint $table): void {
            $table->foreign('created_by')
                ->references('id')
                ->on('users')
                ->nullOnDelete();
        });
    }

    private function hasCreatedByForeign(): bool
    {
        if (DB::connection()->getDriverName() !== 'mysql') {
            return false;
        }

        return DB::table('information_schema.referential_constraints')
            ->where('constraint_schema', DB::getDatabaseName())
            ->where('table_name', self::TABLE)
            ->where('constraint_name', self::CONSTRAINT)
            ->exists();
    }
};
