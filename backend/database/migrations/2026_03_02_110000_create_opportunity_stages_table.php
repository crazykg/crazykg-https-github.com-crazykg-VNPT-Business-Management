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
        if (! Schema::hasTable('opportunity_stages')) {
            Schema::create('opportunity_stages', function (Blueprint $table): void {
                $table->id();
                $table->string('stage_code', 50)->unique('uq_opportunity_stages_stage_code');
                $table->string('stage_name', 120);
                $table->string('description', 255)->nullable();
                $table->boolean('is_terminal')->default(false);
                $table->boolean('is_active')->default(true);
                $table->integer('sort_order')->default(0);
                $table->unsignedBigInteger('created_by')->nullable();
                $table->unsignedBigInteger('updated_by')->nullable();
                $table->timestamps();

                $table->index(['is_active', 'sort_order'], 'idx_opportunity_stages_active_sort');
            });
        }

        $this->seedDefaultOpportunityStages();
        $this->backfillOpportunityStagesFromOpportunities();
    }

    public function down(): void
    {
        Schema::dropIfExists('opportunity_stages');
    }

    private function seedDefaultOpportunityStages(): void
    {
        if (! Schema::hasTable('opportunity_stages')) {
            return;
        }

        $defaults = [
            ['stage_code' => 'NEW', 'stage_name' => 'Mới', 'is_terminal' => false, 'sort_order' => 10],
            ['stage_code' => 'PROPOSAL', 'stage_name' => 'Đề xuất', 'is_terminal' => false, 'sort_order' => 20],
            ['stage_code' => 'NEGOTIATION', 'stage_name' => 'Đàm phán', 'is_terminal' => false, 'sort_order' => 30],
            ['stage_code' => 'WON', 'stage_name' => 'Thắng', 'is_terminal' => true, 'sort_order' => 40],
            ['stage_code' => 'LOST', 'stage_name' => 'Thất bại', 'is_terminal' => true, 'sort_order' => 50],
        ];

        foreach ($defaults as $row) {
            DB::table('opportunity_stages')->updateOrInsert(
                ['stage_code' => $row['stage_code']],
                [
                    'stage_name' => $row['stage_name'],
                    'description' => null,
                    'is_terminal' => $row['is_terminal'],
                    'is_active' => true,
                    'sort_order' => $row['sort_order'],
                    'updated_at' => now(),
                    'created_at' => now(),
                ]
            );
        }
    }

    private function backfillOpportunityStagesFromOpportunities(): void
    {
        if (! Schema::hasTable('opportunity_stages') || ! Schema::hasTable('opportunities')) {
            return;
        }

        if (! Schema::hasColumn('opportunities', 'stage')) {
            return;
        }

        $query = DB::table('opportunities')
            ->whereNotNull('stage')
            ->whereRaw('TRIM(stage) <> ?', ['']);

        if (Schema::hasColumn('opportunities', 'id')) {
            $query->selectRaw('TRIM(stage) as stage_value, MIN(id) as first_seen_id')
                ->groupBy('stage_value')
                ->orderBy('first_seen_id');
        } else {
            $query->selectRaw('TRIM(stage) as stage_value')
                ->groupBy('stage_value')
                ->orderBy('stage_value');
        }

        if (Schema::hasColumn('opportunities', 'deleted_at')) {
            $query->whereNull('deleted_at');
        }

        $rawStages = $query->pluck('stage_value');

        $usedCodes = [];
        $existingCodes = DB::table('opportunity_stages')->pluck('stage_code');
        foreach ($existingCodes as $existingCode) {
            $normalized = $this->sanitizeOpportunityStageCode((string) $existingCode);
            if ($normalized !== '') {
                $usedCodes[$normalized] = true;
            }
        }

        $nextSortOrder = max(
            100,
            ((int) DB::table('opportunity_stages')->max('sort_order')) + 10
        );

        foreach ($rawStages as $stageValue) {
            $mappedCode = $this->mapLegacyOpportunityStage((string) $stageValue);
            $stageCode = $this->sanitizeOpportunityStageCode($mappedCode);

            if ($stageCode === '' || isset($usedCodes[$stageCode])) {
                continue;
            }

            DB::table('opportunity_stages')->insert([
                'stage_code' => $stageCode,
                'stage_name' => $stageCode,
                'description' => null,
                'is_terminal' => false,
                'is_active' => true,
                'sort_order' => $nextSortOrder,
                'created_at' => now(),
                'updated_at' => now(),
            ]);

            $usedCodes[$stageCode] = true;
            $nextSortOrder += 10;
        }
    }

    private function mapLegacyOpportunityStage(string $value): string
    {
        $normalized = $this->sanitizeOpportunityStageCode($value);

        return match ($normalized) {
            'LEAD', 'QUALIFIED' => 'NEW',
            'CLOSED_WON' => 'WON',
            'CLOSED_LOST' => 'LOST',
            default => $normalized,
        };
    }

    private function sanitizeOpportunityStageCode(string $value): string
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

        return substr($normalized, 0, 50);
    }
};
