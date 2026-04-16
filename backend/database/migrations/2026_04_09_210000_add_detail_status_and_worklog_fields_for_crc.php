<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (Schema::hasTable('customer_request_worklogs')) {
            Schema::table('customer_request_worklogs', function (Blueprint $table): void {
                if (! Schema::hasColumn('customer_request_worklogs', 'difficulty_note')) {
                    $table->text('difficulty_note')->nullable()->after('work_content');
                }

                if (! Schema::hasColumn('customer_request_worklogs', 'proposal_note')) {
                    $table->text('proposal_note')->nullable()->after('difficulty_note');
                }

                if (! Schema::hasColumn('customer_request_worklogs', 'difficulty_status')) {
                    $table->string('difficulty_status', 30)->nullable()->after('proposal_note');
                }

                if (! Schema::hasColumn('customer_request_worklogs', 'detail_status_action')) {
                    $table->string('detail_status_action', 30)->nullable()->after('difficulty_status');
                }
            });
        }

        if (! Schema::hasTable('customer_request_status_detail_states')) {
            Schema::create('customer_request_status_detail_states', function (Blueprint $table): void {
                $table->bigIncrements('id');
                $table->unsignedBigInteger('request_case_id');
                $table->unsignedBigInteger('status_instance_id');
                $table->string('status_code', 80)->nullable();
                $table->string('detail_status', 30);
                $table->dateTime('started_at')->nullable();
                $table->dateTime('completed_at')->nullable();
                $table->unsignedBigInteger('changed_by')->nullable();
                $table->text('note')->nullable();
                $table->timestamps();

                $table->index(['request_case_id', 'status_instance_id'], 'idx_cr_detail_state_case_instance');
                $table->unique(['status_instance_id'], 'uq_cr_detail_state_instance');
            });
        }

        if (! Schema::hasTable('customer_request_status_detail_logs')) {
            Schema::create('customer_request_status_detail_logs', function (Blueprint $table): void {
                $table->bigIncrements('id');
                $table->unsignedBigInteger('request_case_id');
                $table->unsignedBigInteger('status_instance_id');
                $table->string('status_code', 80)->nullable();
                $table->string('from_detail_status', 30)->nullable();
                $table->string('to_detail_status', 30);
                $table->unsignedBigInteger('changed_by')->nullable();
                $table->string('source', 50)->nullable();
                $table->timestamps();

                $table->index(['request_case_id', 'status_instance_id'], 'idx_cr_detail_log_case_instance');
            });
        }
    }

    public function down(): void
    {
        if (Schema::hasTable('customer_request_worklogs')) {
            Schema::table('customer_request_worklogs', function (Blueprint $table): void {
                foreach (['detail_status_action', 'difficulty_status', 'proposal_note', 'difficulty_note'] as $column) {
                    if (Schema::hasColumn('customer_request_worklogs', $column)) {
                        $table->dropColumn($column);
                    }
                }
            });
        }

        Schema::dropIfExists('customer_request_status_detail_logs');
        Schema::dropIfExists('customer_request_status_detail_states');
    }
};
