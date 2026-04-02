<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('product_quotation_default_settings', function (Blueprint $table): void {
            $table->id();
            $table->unsignedBigInteger('user_id')->unique();
            $table->text('scope_summary')->nullable();
            $table->unsignedSmallInteger('validity_days')->default(90);
            $table->text('notes_text')->nullable();
            $table->text('contact_line')->nullable();
            $table->text('closing_message')->nullable();
            $table->string('signatory_title', 255)->nullable();
            $table->string('signatory_unit', 255)->nullable();
            $table->string('signatory_name', 255)->nullable();
            $table->unsignedBigInteger('created_by')->nullable();
            $table->unsignedBigInteger('updated_by')->nullable();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('product_quotation_default_settings');
    }
};
