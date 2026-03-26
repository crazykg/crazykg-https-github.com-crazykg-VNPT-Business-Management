<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (! Schema::hasTable('product_quotations')) {
            Schema::create('product_quotations', function (Blueprint $table): void {
                $table->id();
                $table->uuid('uuid')->unique();
                $table->unsignedBigInteger('customer_id')->nullable();
                $table->string('recipient_name', 255);
                $table->string('sender_city', 120)->nullable();
                $table->date('quote_date')->nullable();
                $table->text('scope_summary')->nullable();
                $table->decimal('vat_rate', 5, 2)->nullable()->default(10.00);
                $table->unsignedSmallInteger('validity_days')->default(90);
                $table->text('notes_text')->nullable();
                $table->text('contact_line')->nullable();
                $table->text('closing_message')->nullable();
                $table->string('signatory_title', 255)->nullable();
                $table->string('signatory_unit', 255)->nullable();
                $table->string('signatory_name', 255)->nullable();
                $table->decimal('subtotal', 18, 2)->default(0.00);
                $table->decimal('vat_amount', 18, 2)->default(0.00);
                $table->decimal('total_amount', 18, 2)->default(0.00);
                $table->text('total_in_words')->nullable();
                $table->boolean('uses_multi_vat_template')->default(false);
                $table->string('content_hash', 64)->nullable();
                $table->unsignedInteger('latest_version_no')->default(0);
                $table->timestamp('last_printed_at')->nullable();
                $table->unsignedBigInteger('last_printed_by')->nullable();
                $table->string('status', 30)->default('DRAFT');
                $table->unsignedBigInteger('created_by')->nullable();
                $table->unsignedBigInteger('updated_by')->nullable();
                $table->timestamps();
                $table->softDeletes();

                $table->index(['status', 'updated_at'], 'idx_product_quotations_status_updated');
                $table->index(['customer_id', 'created_at'], 'idx_product_quotations_customer_created');
            });
        }

        if (! Schema::hasTable('product_quotation_items')) {
            Schema::create('product_quotation_items', function (Blueprint $table): void {
                $table->id();
                $table->unsignedBigInteger('quotation_id');
                $table->unsignedInteger('sort_order')->default(0);
                $table->unsignedBigInteger('product_id')->nullable();
                $table->string('product_name', 500);
                $table->string('unit', 100)->nullable();
                $table->decimal('quantity', 18, 2)->default(0.00);
                $table->decimal('unit_price', 18, 2)->default(0.00);
                $table->decimal('vat_rate', 5, 2)->nullable();
                $table->decimal('vat_amount', 18, 2)->nullable();
                $table->decimal('line_total', 18, 2)->default(0.00);
                $table->decimal('total_with_vat', 18, 2)->nullable();
                $table->text('note')->nullable();
                $table->timestamps();

                $table->index(['quotation_id', 'sort_order'], 'idx_product_quotation_items_parent_sort');
            });
        }

        if (! Schema::hasTable('product_quotation_versions')) {
            Schema::create('product_quotation_versions', function (Blueprint $table): void {
                $table->id();
                $table->unsignedBigInteger('quotation_id');
                $table->unsignedInteger('version_no');
                $table->string('template_key', 40);
                $table->string('status', 20)->default('PENDING');
                $table->string('filename', 255)->nullable();
                $table->date('quote_date');
                $table->string('recipient_name', 255);
                $table->string('sender_city', 120)->nullable();
                $table->text('scope_summary')->nullable();
                $table->decimal('vat_rate', 5, 2)->nullable();
                $table->unsignedSmallInteger('validity_days')->default(90);
                $table->text('notes_text')->nullable();
                $table->text('contact_line')->nullable();
                $table->text('closing_message')->nullable();
                $table->string('signatory_title', 255)->nullable();
                $table->string('signatory_unit', 255)->nullable();
                $table->string('signatory_name', 255)->nullable();
                $table->decimal('subtotal', 18, 2)->default(0.00);
                $table->decimal('vat_amount', 18, 2)->default(0.00);
                $table->decimal('total_amount', 18, 2)->default(0.00);
                $table->text('total_in_words')->nullable();
                $table->boolean('uses_multi_vat_template')->default(false);
                $table->string('content_hash', 64)->nullable();
                $table->timestamp('printed_at')->nullable();
                $table->unsignedBigInteger('printed_by')->nullable();
                $table->json('metadata')->nullable();
                $table->timestamp('created_at')->useCurrent();

                $table->unique(['quotation_id', 'version_no'], 'uq_product_quotation_versions_parent_version');
                $table->index(['quotation_id', 'printed_at'], 'idx_product_quotation_versions_parent_printed');
            });
        }

        if (! Schema::hasTable('product_quotation_version_items')) {
            Schema::create('product_quotation_version_items', function (Blueprint $table): void {
                $table->id();
                $table->unsignedBigInteger('version_id');
                $table->unsignedInteger('sort_order')->default(0);
                $table->unsignedBigInteger('product_id')->nullable();
                $table->string('product_name', 500);
                $table->string('unit', 100)->nullable();
                $table->decimal('quantity', 18, 2)->default(0.00);
                $table->decimal('unit_price', 18, 2)->default(0.00);
                $table->decimal('vat_rate', 5, 2)->nullable();
                $table->decimal('vat_amount', 18, 2)->nullable();
                $table->decimal('line_total', 18, 2)->default(0.00);
                $table->decimal('total_with_vat', 18, 2)->nullable();
                $table->text('note')->nullable();

                $table->index(['version_id', 'sort_order'], 'idx_product_quotation_version_items_parent_sort');
            });
        }

        if (! Schema::hasTable('product_quotation_events')) {
            Schema::create('product_quotation_events', function (Blueprint $table): void {
                $table->id();
                $table->unsignedBigInteger('quotation_id');
                $table->unsignedBigInteger('version_id')->nullable();
                $table->unsignedInteger('version_no')->nullable();
                $table->string('event_type', 50);
                $table->string('event_status', 20)->nullable();
                $table->string('template_key', 40)->nullable();
                $table->string('filename', 255)->nullable();
                $table->string('content_hash', 64)->nullable();
                $table->json('metadata')->nullable();
                $table->string('url')->nullable();
                $table->string('ip_address', 45)->nullable();
                $table->string('user_agent')->nullable();
                $table->unsignedBigInteger('created_by')->nullable();
                $table->dateTime('created_at')->useCurrent();

                $table->index(['quotation_id', 'created_at'], 'idx_product_quotation_events_parent_created');
                $table->index(['version_id', 'created_at'], 'idx_product_quotation_events_version_created');
                $table->index(['event_type', 'created_at'], 'idx_product_quotation_events_type_created');
            });
        }
    }

    public function down(): void
    {
        Schema::dropIfExists('product_quotation_events');
        Schema::dropIfExists('product_quotation_version_items');
        Schema::dropIfExists('product_quotation_versions');
        Schema::dropIfExists('product_quotation_items');
        Schema::dropIfExists('product_quotations');
    }
};
