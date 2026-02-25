<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Str;

return new class extends Migration
{
    private const ROOT_DEPARTMENT_CODE = 'BGĐVT';

    public function up(): void
    {
        if (! Schema::hasTable('departments') || ! Schema::hasColumn('departments', 'id') || ! Schema::hasColumn('departments', 'dept_code')) {
            return;
        }

        $rootDepartment = $this->resolveRootDepartment();
        if (! $rootDepartment instanceof \stdClass) {
            $createdRootId = $this->createRootDepartment();
            if ($createdRootId === null) {
                throw new \RuntimeException('Không thể tạo phòng ban gốc BGĐVT (Ban giám đốc Viễn Thông).');
            }

            $rootDepartment = (object) [
                'id' => $createdRootId,
                'dept_code' => self::ROOT_DEPARTMENT_CODE,
            ];
        }

        $rootDepartmentId = (int) ($rootDepartment->id ?? 0);
        if ($rootDepartmentId <= 0) {
            throw new \RuntimeException('ID phòng ban gốc BGĐVT không hợp lệ.');
        }

        if ((string) ($rootDepartment->dept_code ?? '') !== self::ROOT_DEPARTMENT_CODE) {
            DB::table('departments')
                ->where('id', $rootDepartmentId)
                ->update(['dept_code' => self::ROOT_DEPARTMENT_CODE]);
        }

        if (Schema::hasColumn('departments', 'dept_path')) {
            DB::table('departments')
                ->where('id', $rootDepartmentId)
                ->update(['dept_path' => $rootDepartmentId.'/']);
        }

        if (Schema::hasColumn('departments', 'parent_id')) {
            DB::table('departments')
                ->where('id', $rootDepartmentId)
                ->update(['parent_id' => null]);

            DB::table('departments')
                ->where('id', '!=', $rootDepartmentId)
                ->where(function ($query) use ($rootDepartmentId): void {
                    $query->whereNull('parent_id')
                        ->orWhere('parent_id', '!=', $rootDepartmentId);
                })
                ->update(['parent_id' => $rootDepartmentId]);
        }

        if (! Schema::hasTable('internal_users') || ! Schema::hasColumn('internal_users', 'department_id')) {
            return;
        }

        DB::table('internal_users')
            ->whereNull('department_id')
            ->update(['department_id' => $rootDepartmentId]);

        if (DB::getDriverName() === 'sqlite') {
            return;
        }

        $this->dropDepartmentForeignKeys();
        $this->setInternalUsersDepartmentNullable(false);
        $this->addDepartmentForeignKey(true);
    }

    public function down(): void
    {
        if (! Schema::hasTable('internal_users') || ! Schema::hasColumn('internal_users', 'department_id')) {
            return;
        }

        if (DB::getDriverName() === 'sqlite') {
            return;
        }

        $this->dropDepartmentForeignKeys();
        $this->setInternalUsersDepartmentNullable(true);
        $this->addDepartmentForeignKey(false);
    }

    private function resolveRootDepartment(): ?\stdClass
    {
        $columns = ['id', 'dept_code'];
        if (Schema::hasColumn('departments', 'dept_name')) {
            $columns[] = 'dept_name';
        }

        $departments = DB::table('departments')
            ->select($columns)
            ->orderBy('id')
            ->get();

        foreach ($departments as $department) {
            if ($this->isRootDepartmentCode((string) ($department->dept_code ?? ''))) {
                return $department;
            }
        }

        if (! Schema::hasColumn('departments', 'dept_name')) {
            return null;
        }

        foreach ($departments as $department) {
            if ($this->isRootDepartmentName((string) ($department->dept_name ?? ''))) {
                return $department;
            }
        }

        return null;
    }

    private function createRootDepartment(): ?int
    {
        if (! Schema::hasColumn('departments', 'dept_name')) {
            return null;
        }

        $payload = [
            'dept_code' => self::ROOT_DEPARTMENT_CODE,
            'dept_name' => 'Ban giám đốc Viễn Thông',
        ];

        if (Schema::hasColumn('departments', 'parent_id')) {
            $payload['parent_id'] = null;
        }
        if (Schema::hasColumn('departments', 'is_active')) {
            $payload['is_active'] = 1;
        }
        if (Schema::hasColumn('departments', 'status')) {
            $payload['status'] = 'ACTIVE';
        }
        if (Schema::hasColumn('departments', 'data_scope')) {
            $payload['data_scope'] = 'ALL';
        }
        if (Schema::hasColumn('departments', 'dept_path')) {
            $payload['dept_path'] = '0/';
        }
        if (Schema::hasColumn('departments', 'created_at')) {
            $payload['created_at'] = now();
        }
        if (Schema::hasColumn('departments', 'updated_at')) {
            $payload['updated_at'] = now();
        }

        if (! Schema::hasColumn('departments', 'id')) {
            DB::table('departments')->insert($payload);

            return null;
        }

        return (int) DB::table('departments')->insertGetId($payload);
    }

    private function isRootDepartmentCode(string $deptCode): bool
    {
        $normalized = function_exists('mb_strtoupper')
            ? mb_strtoupper(trim($deptCode), 'UTF-8')
            : strtoupper(trim($deptCode));
        $normalized = str_replace([' ', '-', '_'], '', $normalized);

        return in_array($normalized, [self::ROOT_DEPARTMENT_CODE, 'BGDVT'], true);
    }

    private function isRootDepartmentName(string $deptName): bool
    {
        $normalized = strtolower(trim(Str::ascii($deptName)));
        $normalized = preg_replace('/[\s\-_]+/', ' ', $normalized) ?? '';

        return $normalized === 'ban giam doc vien thong';
    }

    private function dropDepartmentForeignKeys(): void
    {
        $driver = DB::getDriverName();

        if ($driver === 'mysql') {
            $database = DB::getDatabaseName();
            $constraintNames = DB::table('information_schema.KEY_COLUMN_USAGE')
                ->select('CONSTRAINT_NAME')
                ->where('TABLE_SCHEMA', $database)
                ->where('TABLE_NAME', 'internal_users')
                ->where('COLUMN_NAME', 'department_id')
                ->whereNotNull('REFERENCED_TABLE_NAME')
                ->pluck('CONSTRAINT_NAME')
                ->unique()
                ->values()
                ->all();

            foreach ($constraintNames as $constraintName) {
                DB::statement(sprintf(
                    'ALTER TABLE `internal_users` DROP FOREIGN KEY `%s`',
                    str_replace('`', '``', (string) $constraintName)
                ));
            }

            return;
        }

        if ($driver === 'pgsql') {
            $rows = DB::select(
                <<<SQL
                SELECT con.conname AS constraint_name
                FROM pg_constraint con
                JOIN pg_class rel ON rel.oid = con.conrelid
                JOIN pg_attribute att ON att.attrelid = rel.oid AND att.attnum = ANY(con.conkey)
                WHERE con.contype = 'f'
                  AND rel.relname = ?
                  AND att.attname = ?
                SQL,
                ['internal_users', 'department_id']
            );

            foreach ($rows as $row) {
                $constraintName = str_replace('"', '""', (string) ($row->constraint_name ?? ''));
                if ($constraintName === '') {
                    continue;
                }

                DB::statement(sprintf(
                    'ALTER TABLE "internal_users" DROP CONSTRAINT "%s"',
                    $constraintName
                ));
            }

            return;
        }

        try {
            Schema::table('internal_users', function (Blueprint $table): void {
                $table->dropForeign(['department_id']);
            });
        } catch (\Throwable) {
            // Best effort: unsupported drivers may not expose FK metadata uniformly.
        }
    }

    private function setInternalUsersDepartmentNullable(bool $nullable): void
    {
        $driver = DB::getDriverName();

        if ($driver === 'mysql') {
            DB::statement(sprintf(
                'ALTER TABLE `internal_users` MODIFY `department_id` BIGINT UNSIGNED %s',
                $nullable ? 'NULL' : 'NOT NULL'
            ));

            return;
        }

        if ($driver === 'pgsql') {
            DB::statement(sprintf(
                'ALTER TABLE "internal_users" ALTER COLUMN "department_id" %s',
                $nullable ? 'DROP NOT NULL' : 'SET NOT NULL'
            ));

            return;
        }

        if ($driver === 'sqlsrv') {
            DB::statement(sprintf(
                'ALTER TABLE [internal_users] ALTER COLUMN [department_id] BIGINT %s',
                $nullable ? 'NULL' : 'NOT NULL'
            ));

            return;
        }

        Schema::table('internal_users', function (Blueprint $table) use ($nullable): void {
            $table->unsignedBigInteger('department_id')->nullable($nullable)->change();
        });
    }

    private function addDepartmentForeignKey(bool $restrictOnDelete): void
    {
        Schema::table('internal_users', function (Blueprint $table) use ($restrictOnDelete): void {
            $foreign = $table->foreign('department_id', 'fk_internal_users_department_id')
                ->references('id')
                ->on('departments');

            if ($restrictOnDelete) {
                $foreign->restrictOnDelete();
            } else {
                $foreign->nullOnDelete();
            }
        });
    }
};
