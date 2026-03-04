<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\SoftDeletes;

class Customer extends Model
{
    use SoftDeletes;

    protected $table = 'customers';

    protected $fillable = [
        'uuid',
        'customer_code',
        'customer_name',
        'tax_code',
        'address',
        'data_scope',
        'created_by',
        'updated_by',
    ];

    public function projects(): HasMany
    {
        return $this->hasMany(Project::class, 'customer_id');
    }

    public function contracts(): HasMany
    {
        return $this->hasMany(Contract::class, 'customer_id');
    }

    public function opportunities(): HasMany
    {
        return $this->hasMany(Opportunity::class, 'customer_id');
    }
}
