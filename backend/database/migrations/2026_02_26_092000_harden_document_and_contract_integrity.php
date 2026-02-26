<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        $this->addAttachmentReferenceIndex();
        $this->hardenDocumentsCustomerConstraint();
        $this->hardenContractsDepartmentConstraint();
    }

    public function down(): void
    {
        $this->dropForeignIfExists('documents', 'fk_doc_customer');
        $this->dropIndexIfExists('documents', 'idx_documents_customer_id');

        $this->dropForeignIfExists('contracts', 'fk_contracts_dept_id');
        $this->dropIndexIfExists('contracts', 'idx_contracts_dept_id');

        $this->dropIndexIfExists('attachments', 'idx_attachments_reference');
    }

    private function addAttachmentReferenceIndex(): void
    {
        if (
            ! Schema::hasTable('attachments') ||
            ! Schema::hasColumn('attachments', 'reference_type') ||
            ! Schema::hasColumn('attachments', 'reference_id')
        ) {
            return;
        }

        if ($this->indexExists('attachments', 'idx_attachments_reference')) {
            return;
        }

        Schema::table('attachments', function (Blueprint $table): void {
            $table->index(['reference_type', 'reference_id'], 'idx_attachments_reference');
        });
    }

    private function hardenDocumentsCustomerConstraint(): void
    {
        if (! Schema::hasTable('documents') || ! Schema::hasColumn('documents', 'customer_id')) {
            return;
        }

        $this->alterDocumentsCustomerIdNullable();

        DB::table('documents')
            ->where('customer_id', 0)
            ->update(['customer_id' => null]);

        if (! Schema::hasTable('customers') || ! Schema::hasColumn('customers', 'id')) {
            return;
        }

        $this->cleanupDocumentCustomerOrphans();

        if (! $this->indexExists('documents', 'idx_documents_customer_id')) {
            Schema::table('documents', function (Blueprint $table): void {
                $table->index('customer_id', 'idx_documents_customer_id');
            });
        }

        if (! $this->foreignKeyExistsForColumn('documents', 'customer_id')) {
            Schema::table('documents', function (Blueprint $table): void {
                $table->foreign('customer_id', 'fk_doc_customer')
                    ->references('id')
                    ->on('customers')
                    ->nullOnDelete();
            });
        }
    }

    private function hardenContractsDepartmentConstraint(): void
    {
        if (! Schema::hasTable('contracts') || ! Schema::hasColumn('contracts', 'dept_id')) {
            return;
        }

        if (! Schema::hasTable('departments') || ! Schema::hasColumn('departments', 'id')) {
            return;
        }

        $this->cleanupContractDepartmentOrphans();

        if (! $this->indexExists('contracts', 'idx_contracts_dept_id')) {
            Schema::table('contracts', function (Blueprint $table): void {
                $table->index('dept_id', 'idx_contracts_dept_id');
            });
        }

        if (! $this->foreignKeyExistsForColumn('contracts', 'dept_id')) {
            Schema::table('contracts', function (Blueprint $table): void {
                $table->foreign('dept_id', 'fk_contracts_dept_id')
                    ->references('id')
                    ->on('departments')
                    ->nullOnDelete();
            });
        }
    }

    private function alterDocumentsCustomerIdNullable(): void
    {
        $driver = DB::getDriverName();

        if ($driver === 'mysql') {
            DB::statement('ALTER TABLE `documents` MODIFY `customer_id` BIGINT UNSIGNED NULL');
            return;
        }

        Schema::table('documents', function (Blueprint $table): void {
            $table->unsignedBigInteger('customer_id')->nullable()->change();
        });
    }

    private function cleanupDocumentCustomerOrphans(): void
    {
        if (DB::getDriverName() === 'mysql') {
            DB::statement('
                UPDATE `documents` d
                LEFT JOIN `customers` c ON c.id = d.customer_id
                SET d.customer_id = NULL
                WHERE d.customer_id IS NOT NULL
                  AND c.id IS NULL
            ');
            return;
        }

        $validCustomerIds = DB::table('customers')->pluck('id')->all();
        DB::table('documents')
            ->whereNotNull('customer_id')
            ->whereNotIn('customer_id', $validCustomerIds)
            ->update(['customer_id' => null]);
    }

    private function cleanupContractDepartmentOrphans(): void
    {
        if (DB::getDriverName() === 'mysql') {
            DB::statement('
                UPDATE `contracts` c
                LEFT JOIN `departments` d ON d.id = c.dept_id
                SET c.dept_id = NULL
                WHERE c.dept_id IS NOT NULL
                  AND d.id IS NULL
            ');
            return;
        }

        $validDepartmentIds = DB::table('departments')->pluck('id')->all();
        DB::table('contracts')
            ->whereNotNull('dept_id')
            ->whereNotIn('dept_id', $validDepartmentIds)
            ->update(['dept_id' => null]);
    }

    private function indexExists(string $table, string $index): bool
    {
        if (! Schema::hasTable($table) || DB::getDriverName() !== 'mysql') {
            return false;
        }

        $database = DB::getDatabaseName();
        if (! is_string($database) || $database === '') {
            return false;
        }

        return DB::table('information_schema.statistics')
            ->where('table_schema', $database)
            ->where('table_name', $table)
            ->where('index_name', $index)
            ->exists();
    }

    private function foreignKeyExistsForColumn(string $table, string $column): bool
    {
        if (! Schema::hasTable($table) || DB::getDriverName() !== 'mysql') {
            return false;
        }

        $database = DB::getDatabaseName();
        if (! is_string($database) || $database === '') {
            return false;
        }

        return DB::table('information_schema.key_column_usage')
            ->where('table_schema', $database)
            ->where('table_name', $table)
            ->where('column_name', $column)
            ->whereNotNull('referenced_table_name')
            ->exists();
    }

    private function dropIndexIfExists(string $table, string $index): void
    {
        if (! Schema::hasTable($table) || ! $this->indexExists($table, $index)) {
            return;
        }

        Schema::table($table, function (Blueprint $tableBlueprint) use ($index): void {
            $tableBlueprint->dropIndex($index);
        });
    }

    private function dropForeignIfExists(string $table, string $foreign): void
    {
        if (! Schema::hasTable($table) || DB::getDriverName() !== 'mysql') {
            return;
        }

        $database = DB::getDatabaseName();
        if (! is_string($database) || $database === '') {
            return;
        }

        $exists = DB::table('information_schema.table_constraints')
            ->where('table_schema', $database)
            ->where('table_name', $table)
            ->where('constraint_name', $foreign)
            ->where('constraint_type', 'FOREIGN KEY')
            ->exists();

        if (! $exists) {
            return;
        }

        Schema::table($table, function (Blueprint $tableBlueprint) use ($foreign): void {
            $tableBlueprint->dropForeign($foreign);
        });
    }
};

