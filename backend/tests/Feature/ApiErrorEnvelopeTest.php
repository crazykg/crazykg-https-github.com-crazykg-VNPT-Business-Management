<?php

namespace Tests\Feature;

use Tests\TestCase;

class ApiErrorEnvelopeTest extends TestCase
{
    public function test_validation_exceptions_return_standardized_error_envelope_with_legacy_errors_key(): void
    {
        $response = $this->postJson('/api/v5/auth/login', []);

        $response
            ->assertStatus(422)
            ->assertJsonPath('error.code', 'VALIDATION_FAILED')
            ->assertJsonPath('code', 'VALIDATION_FAILED')
            ->assertJsonPath('request_id', fn ($value) => is_string($value) && $value !== '')
            ->assertJsonStructure([
                'error' => ['code', 'message', 'request_id', 'errors'],
                'errors' => ['username', 'password'],
            ]);
    }

    public function test_unauthenticated_requests_return_standardized_error_envelope(): void
    {
        $response = $this->getJson('/api/v5/auth/me');

        $response
            ->assertStatus(401)
            ->assertJsonPath('error.code', 'UNAUTHENTICATED')
            ->assertJsonPath('error.message', 'Unauthenticated.')
            ->assertJsonPath('code', 'UNAUTHENTICATED')
            ->assertJsonPath('message', 'Unauthenticated.')
            ->assertJsonPath('request_id', fn ($value) => is_string($value) && $value !== '');
    }
}
