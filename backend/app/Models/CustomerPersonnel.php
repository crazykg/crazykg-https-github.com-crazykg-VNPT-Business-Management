<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;

class CustomerPersonnel extends Model
{
    use SoftDeletes;

    protected $table = 'customer_personnel';
}
