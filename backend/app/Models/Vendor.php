<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class Vendor extends Model
{
    protected $table = 'vendors';

    protected $fillable = [
        'uuid',
        'vendor_code',
        'vendor_name',
        'data_scope',
        'created_by',
        'updated_by',
    ];
}

