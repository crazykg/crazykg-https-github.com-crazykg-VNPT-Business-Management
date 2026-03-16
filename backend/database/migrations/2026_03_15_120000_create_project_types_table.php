<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Str;

return new class extends Migration
{
    public function up(): void
    {
        if (! Schema::hasTable('project_types')) {
            Schema::create('project_types', function (Blueprint $table): void {
                $table->id();
                $table->string('type_code', 100)->unique('uq_project_types_type_code');
                $table->string('type_name', 120);
                $table->string('description', 255)->nullable();
                $table->boolean('is_active')->default(true);
                $table->integer('sort_order')->default(0);
                $table->unsignedBigInteger('created_by')->nullable();
                $table->unsignedBigInteger('updated_by')->nullable();
                $table->timestamps();

                $table->index(['is_active', 'sort_order'], 'idx_project_types_active_sort');
            });
        }

        $this->seedDefaultProjectTypes();
        $this->backfillProjectTypesFromProjects();
    }

    public function down(): void
    {
        Schema::dropIfExists('project_types');
    }

    private function seedDefaultProjectTypes(): void
    {
        if (! Schema::hasTable('project_types')) {
            return;
        }

        $defaults = [
            ['type_code' => 'DAU_TU',       'type_name' => 'Đầu tư',             'sort_order' => 10],
            ['type_code' => 'THUE_DICH_VU_DACTHU',  'type_name' => 'Thuê dịch vụ CNTT đặc thù', 'sort_order' => 20],
        ];

        foreach ($defaults as $row) {
            DB::table('project_types')->updateOrInsert(
                ['type_code' => $row['type_code']],
                [
                    'type_name'   => $row['type_name'],
                    'description' => null,
                    'is_active'   => true,
                    'sort_order'  => $row['sort_order'],
                    'created_at'  => now(),
                    'updated_at'  => now(),
                ]
            );
        }
    }

    private function backfillProjectTypesFromProjects(): void
    {
        if (! Schema::hasTable('project_types') || ! Schema::hasTable('projects')) {
            return;
        }

        if (! Schema::hasColumn('projects', 'investment_mode')) {
            return;
        }

        $query = DB::table('projects')
            ->whereNotNull('investment_mode')
            ->whereRaw('TRIM(investment_mode) <> ?', ['']);

        if (Schema::hasColumn('projects', 'id')) {
            $query->selectRaw('TRIM(investment_mode) as mode_value, MIN(id) as first_seen_id')
                ->groupBy('mode_value')
                ->orderBy('first_seen_id');
        } else {
            $query->selectRaw('TRIM(investment_mode) as mode_value')
                ->groupBy('mode_value')
                ->orderBy('mode_value');
        }

        $rawModes = $query->pluck('mode_value');

        $usedCodes = [];
        $existingCodes = DB::table('project_types')->pluck('type_code');
        foreach ($existingCodes as $code) {
            $normalized = $this->sanitizeProjectTypeCode((string) $code);
            if ($normalized !== '') {
                $usedCodes[$normalized] = true;
            }
        }

        $nextSortOrder = max(
            100,
            ((int) DB::table('project_types')->max('sort_order')) + 10
        );

        foreach ($rawModes as $modeValue) {
            $typeCode = $this->sanitizeProjectTypeCode((string) $modeValue);

            if ($typeCode === '' || isset($usedCodes[$typeCode])) {
                continue;
            }

            DB::table('project_types')->insert([
                'type_code'  => $typeCode,
                'type_name'  => $typeCode,
                'description' => null,
                'is_active'  => true,
                'sort_order' => $nextSortOrder,
                'created_at' => now(),
                'updated_at' => now(),
            ]);

            $usedCodes[$typeCode] = true;
            $nextSortOrder += 10;
        }
    }

    private function sanitizeProjectTypeCode(string $value): string
    {
        $trimmed = trim($value);
        if ($trimmed === '') {
            return '';
        }

        $ascii = Str::ascii($trimmed);
        $upper = function_exists('mb_strtoupper')
            ? mb_strtoupper($ascii, 'UTF-8')
            : strtoupper($ascii);

        $normalized = preg_replace('/[^A-Z0-9]+/', '_', $upper);
        $normalized = preg_replace('/_+/', '_', (string) $normalized);
        $normalized = trim((string) $normalized, '_');

        return substr($normalized, 0, 100);
    }
};
