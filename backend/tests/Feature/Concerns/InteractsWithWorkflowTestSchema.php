<?php

namespace Tests\Feature\Concerns;

use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

trait InteractsWithWorkflowTestSchema
{
    protected function setUpWorkflowSchema(): void
    {
        Schema::disableForeignKeyConstraints();
        Schema::dropIfExists('customer_request_status_transitions');
        Schema::dropIfExists('workflow_definitions');
        Schema::enableForeignKeyConstraints();

        Schema::create('workflow_definitions', function (Blueprint $table): void {
            $table->bigIncrements('id');
            $table->string('code', 50)->unique();
            $table->string('name', 255);
            $table->text('description')->nullable();
            $table->string('process_type', 80)->default('customer_request');
            $table->boolean('is_active')->default(false);
            $table->boolean('is_default')->default(false);
            $table->string('version', 20)->default('1.0');
            $table->json('config')->nullable();
            $table->unsignedBigInteger('created_by')->nullable();
            $table->unsignedBigInteger('updated_by')->nullable();
            $table->dateTime('activated_at')->nullable();
            $table->timestamps();
            $table->softDeletes();
        });

        Schema::create('customer_request_status_transitions', function (Blueprint $table): void {
            $table->bigIncrements('id');
            $table->unsignedBigInteger('workflow_definition_id');
            $table->string('from_status_code', 80);
            $table->string('to_status_code', 80);
            $table->json('allowed_roles')->nullable();
            $table->json('required_fields')->nullable();
            $table->json('transition_config')->nullable();
            $table->unsignedInteger('sort_order')->default(0);
            $table->boolean('is_active')->default(true);
            $table->timestamps();

            $table->unique(
                ['workflow_definition_id', 'from_status_code', 'to_status_code'],
                'uq_workflow_definition_transition'
            );
        });
    }
}
