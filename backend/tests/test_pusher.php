<?php
/**
 * Test script for App\Utils\Pusher
 * Run: php test_pusher.php
 */

spl_autoload_register(function ($class) {
    $prefix = 'App\\';
    $base_dir = __DIR__ . '/../src/';
    $len = strlen($prefix);
    if (strncmp($prefix, $class, $len) !== 0) return;
    $relative_class = substr($class, $len);
    $file = $base_dir . str_replace('\\', '/', $relative_class) . '.php';
    if (file_exists($file)) require $file;
});

// Load Env manually by triggering Database connection or reading .env
require_once __DIR__ . '/../src/Config/Database.php';
// This loads env vars into $_ENV and getenv
App\Config\Database::getConnection();

echo "=== STARTING PUSHER BROADCAST TEST ===\n";
echo "App ID: " . (getenv('PUSHER_APP_ID') ?: 'NOT SET') . "\n";
echo "Key: " . (getenv('PUSHER_KEY') ?: 'NOT SET') . "\n";
echo "Secret: " . (getenv('PUSHER_SECRET') ? '***' : 'NOT SET') . "\n";
echo "Cluster: " . (getenv('PUSHER_CLUSTER') ?: 'NOT SET') . "\n";

$channel = "test-channel";
$event = "test-event";
$payload = ["message" => "Hello WebSockets!", "timestamp" => time()];

echo "-> Triggering test broadcast to channel '$channel'...\n";
$success = App\Utils\Pusher::trigger($channel, $event, $payload);

if ($success) {
    echo "✅ Success! Event broadcasted to Pusher successfully!\n";
} else {
    echo "❌ Failed to broadcast event. Check credentials and curl errors.\n";
}
