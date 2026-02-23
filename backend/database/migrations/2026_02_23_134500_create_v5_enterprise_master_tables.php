<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (! Schema::hasTable('departments')) {
            Schema::create('departments', function (Blueprint $table) {
                $table->id();
                $table->string('dept_code', 100)->unique();
                $table->string('dept_name');
                $table->foreignId('parent_id')->nullable()->constrained('departments')->nullOnDelete();
                $table->string('dept_path')->nullable();
                $table->boolean('is_active')->default(true);
                $table->string('status', 20)->default('ACTIVE');
                $table->string('data_scope')->nullable();
                $table->unsignedBigInteger('created_by')->nullable();
                $table->unsignedBigInteger('updated_by')->nullable();
                $table->timestamps();
            });
        }

        if (! Schema::hasTable('customers')) {
            Schema::create('customers', function (Blueprint $table) {
                $table->id();
                $table->string('uuid', 36)->nullable()->unique();
                $table->string('customer_code', 100)->unique();
                $table->string('customer_name');
                $table->string('tax_code', 100)->nullable();
                $table->text('address')->nullable();
                $table->string('data_scope')->nullable();
                $table->unsignedBigInteger('created_by')->nullable();
                $table->unsignedBigInteger('updated_by')->nullable();
                $table->timestamps();
            });
        }

        if (! Schema::hasTable('vendors')) {
            Schema::create('vendors', function (Blueprint $table) {
                $table->id();
                $table->string('uuid', 36)->nullable()->unique();
                $table->string('vendor_code', 100)->unique();
                $table->string('vendor_name');
                $table->string('data_scope')->nullable();
                $table->unsignedBigInteger('created_by')->nullable();
                $table->unsignedBigInteger('updated_by')->nullable();
                $table->timestamps();
            });
        }

        if (! Schema::hasTable('employees')) {
            Schema::create('employees', function (Blueprint $table) {
                $table->id();
                $table->string('uuid', 36)->nullable()->unique();
                $table->string('username', 100)->unique();
                $table->string('full_name');
                $table->string('email')->unique();
                $table->string('status', 20)->default('ACTIVE');
                $table->foreignId('department_id')->nullable()->constrained('departments')->nullOnDelete();
                $table->unsignedBigInteger('position_id')->nullable();
                $table->string('data_scope')->nullable();
                $table->unsignedBigInteger('created_by')->nullable();
                $table->unsignedBigInteger('updated_by')->nullable();
                $table->timestamps();
            });
        }

        if (! Schema::hasTable('projects')) {
            Schema::create('projects', function (Blueprint $table) {
                $table->id();
                $table->string('project_code', 100)->unique();
                $table->string('project_name');
                $table->foreignId('customer_id')->nullable()->constrained('customers')->nullOnDelete();
                $table->string('status', 20)->default('PLANNING');
                $table->string('data_scope')->nullable();
                $table->unsignedBigInteger('created_by')->nullable();
                $table->unsignedBigInteger('updated_by')->nullable();
                $table->timestamps();
            });
        }

        if (! Schema::hasTable('contracts')) {
            Schema::create('contracts', function (Blueprint $table) {
                $table->id();
                $table->string('contract_code', 100)->unique();
                $table->string('contract_name');
                $table->foreignId('customer_id')->constrained('customers');
                $table->foreignId('project_id')->nullable()->constrained('projects')->nullOnDelete();
                $table->decimal('value', 18, 2)->default(0);
                $table->string('status', 20)->default('DRAFT');
                $table->string('data_scope')->nullable();
                $table->unsignedBigInteger('created_by')->nullable();
                $table->unsignedBigInteger('updated_by')->nullable();
                $table->timestamps();
            });
        }

        if (! Schema::hasTable('opportunities')) {
            Schema::create('opportunities', function (Blueprint $table) {
                $table->id();
                $table->string('opp_name');
                $table->foreignId('customer_id')->constrained('customers');
                $table->decimal('amount', 18, 2)->default(0);
                $table->string('stage', 20)->default('NEW');
                $table->string('data_scope')->nullable();
                $table->unsignedBigInteger('created_by')->nullable();
                $table->unsignedBigInteger('updated_by')->nullable();
                $table->timestamps();
            });
        }
    }

    public function down(): void
    {
        Schema::disableForeignKeyConstraints();
        Schema::dropIfExists('opportunities');
        Schema::dropIfExists('contracts');
        Schema::dropIfExists('projects');
        Schema::dropIfExists('employees');
        Schema::dropIfExists('vendors');
        Schema::dropIfExists('customers');
        Schema::dropIfExists('departments');
        Schema::enableForeignKeyConstraints();
    }
};
