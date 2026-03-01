<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class StoreWorklogRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'phase' => ['required', Rule::in(['ANALYZE', 'CODE', 'UPCODE', 'NOTIFY', 'OTHER'])],
            'content' => ['required', 'string'],
            'logged_date' => ['required', 'date', 'before_or_equal:today'],
            'hours_spent' => ['required', 'numeric', 'min:0.01', 'max:24'],
            'hours_estimated' => ['nullable', 'numeric', 'min:0.01', 'max:24'],
        ];
    }
}
