<?php
namespace App\Utils;

class Pusher {
    /**
     * Triggers an event on a channel using Pusher REST API.
     * Signs the request using HMAC-SHA256 signature algorithm.
     */
    public static function trigger(string $channel, string $event, $data): bool {
        // Load env variables if not set in $_ENV/$_SERVER (normally loaded in Database connection but let's be safe)
        $appId = getenv('PUSHER_APP_ID') ?: ($_ENV['PUSHER_APP_ID'] ?? ($_SERVER['PUSHER_APP_ID'] ?? null));
        $appKey = getenv('PUSHER_KEY') ?: ($_ENV['PUSHER_KEY'] ?? ($_SERVER['PUSHER_KEY'] ?? null));
        $appSecret = getenv('PUSHER_SECRET') ?: ($_ENV['PUSHER_SECRET'] ?? ($_SERVER['PUSHER_SECRET'] ?? null));
        $cluster = getenv('PUSHER_CLUSTER') ?: ($_ENV['PUSHER_CLUSTER'] ?? ($_SERVER['PUSHER_CLUSTER'] ?? 'eu'));

        if (!$appId || !$appKey || !$appSecret) {
            // Silently log error and return if credentials are missing
            error_log("Pusher Error: PUSHER_APP_ID, PUSHER_KEY, or PUSHER_SECRET not set in .env");
            return false;
        }

        $path = "/apps/$appId/events";
        $encodedData = is_string($data) ? $data : json_encode($data);
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

        $url = "https://api-$cluster.pusher.com$path?$queryString&auth_signature=$signature";

        $ch = curl_init($url);
        curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
        curl_setopt($ch, CURLOPT_POST, true);
        curl_setopt($ch, CURLOPT_POSTFIELDS, $body);
        curl_setopt($ch, CURLOPT_HTTPHEADER, ['Content-Type: application/json']);
        curl_setopt($ch, CURLOPT_SSL_VERIFYPEER, false);
        curl_setopt($ch, CURLOPT_SSL_VERIFYHOST, false);
        
        $response = curl_exec($ch);
        $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
        curl_close($ch);

        if ($httpCode !== 200) {
            error_log("Pusher API returned HTTP Code $httpCode: $response");
            return false;
        }

        return true;
    }
}
