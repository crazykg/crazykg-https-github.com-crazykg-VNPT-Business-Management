<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class ProductQuotationDefaultSetting extends Model
{
    protected $table = 'product_quotation_default_settings';

    protected $fillable = [
        'user_id',
        'scope_summary',
        'validity_days',
        'notes_text',
        'contact_line',
        'closing_message',
        'signatory_title',
        'signatory_unit',
        'signatory_name',
        'created_by',
        'updated_by',
    ];

    protected $casts = [
        'user_id' => 'integer',
        'validity_days' => 'integer',
        'created_by' => 'integer',
        'updated_by' => 'integer',
    ];
}
