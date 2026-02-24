<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class Position extends Model
{
    protected $table = 'positions';

    protected $fillable = [
        'pos_code',
        'pos_name',
        'pos_level',
        'is_active',
        'created_by',
        'updated_by',
    ];
}
