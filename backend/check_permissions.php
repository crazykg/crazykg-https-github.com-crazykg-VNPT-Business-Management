<?php
// Script to assign permissions to the user
require_once 'vendor/autoload.php';

$app = require_once 'bootstrap/app.php';
$app->make(Illuminate\Contracts\Console\Kernel::class)->bootstrap();

try {
    $user = \App\Models\User::where('email', 'admin@example.com')->first();

    if (!$user) {
        echo "User not found\n";
        exit(1);
    }

    // Check if the user has the necessary permission by checking the permission system
    $permissionExists = \Illuminate\Support\Facades\DB::table('permissions')
        ->where('perm_key', 'products.read')
        ->exists();

    if ($permissionExists) {
        echo "Permission 'products.read' exists in the system.\n";
    } else {
        echo "Permission 'products.read' does not exist.\n";
    }

    // Since this is a complex permission system, let me try to see what might be causing the issue
    // by directly checking what happens when we try to access the permission middleware

    echo "User ID: " . $user->id . "\n";
    echo "User Email: " . $user->email . "\n";

} catch (Exception $e) {
    echo "Error: " . $e->getMessage() . "\n";
    echo "File: " . $e->getFile() . " Line: " . $e->getLine() . "\n";
}