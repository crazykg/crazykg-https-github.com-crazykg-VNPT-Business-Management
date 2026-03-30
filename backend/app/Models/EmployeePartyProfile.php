<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class EmployeePartyProfile extends Model
{
    protected $table = 'employee_party_profiles';

    protected $fillable = [
        'employee_id',
        'ethnicity',
        'religion',
        'hometown',
        'professional_qualification',
        'political_theory_level',
        'party_card_number',
        'notes',
        'created_by',
        'updated_by',
    ];

    public function employee(): BelongsTo
    {
        return $this->belongsTo(InternalUser::class, 'employee_id');
    }
}
