<?php

namespace App\Support\Http;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Http\Request;

trait ResolvesValidatedInput
{
    /**
     * @return array<string, mixed>
     */
    protected function validatedInput(Request $request, array $fallbackRules = []): array
    {
        if ($request instanceof FormRequest) {
            return $request->validated();
        }

        if ($fallbackRules !== []) {
            return $request->validate($fallbackRules);
        }

        return $request->all();
    }
}
