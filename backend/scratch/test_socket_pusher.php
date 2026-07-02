<?php
// Load env vars
require_once __DIR__ . '/../src/Config/Database.php';
App\Config\Database::getConnection();

$appId = getenv('PUSHER_APP_ID');
$appKey = getenv('PUSHER_KEY');
$appSecret = getenv('PUSHER_SECRET');
$cluster = getenv('PUSHER_CLUSTER') ?: 'eu';

$channel = "test-channel";
$event = "test-event";
$data = ["message" => "Socket test", "timestamp" => time()];

$path = "/apps/$appId/events";
$encodedData = json_encode($data);
$body = json_encode([
    'name' => $event,
    'channels' => [$channel],
    'data' => $encodedData
]);

$params = [
    'auth_key' => $appKey,
    'auth_timestamp' => time(),
    'auth_version' => '1.0',
    'body_md5' => md5($body)
];

ksort($params);
$queryString = http_build_query($params);
$stringToSign = "POST\n$path\n$queryString";
$signature = hash_hmac('sha256', $stringToSign, $appSecret);

$url = "http://api-$cluster.pusher.com$path?$queryString&auth_signature=$signature";

// Benchmark socket method
$start = microtime(true);

$parts = parse_url($url);
$host = $parts['host'];
$port = 80;

$fp = fsockopen('tcp://' . $host, $port, $errno, $errstr, 1.0);
if ($fp) {
    $out = "POST " . $parts['path'] . "?" . $parts['query'] . " HTTP/1.1\r\n";
    $out .= "Host: " . $host . "\r\n";
    $out .= "Content-Type: application/json\r\n";
    $out .= "Content-Length: " . strlen($body) . "\r\n";
    $out .= "Connection: Close\r\n\r\n";
    $out .= $body;
    
    fwrite($fp, $out);
    fclose($fp);
    $socket_success = true;
} else {
    $socket_success = false;
}
$socket_time = microtime(true) - $start;

echo "Socket Time: " . round($socket_time * 1000, 2) . "ms (Success: " . ($socket_success ? "yes" : "no") . ")\n";
