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

        $url = "http://api-$cluster.pusher.com$path?$queryString&auth_signature=$signature";

        $ch = curl_init($url);
        curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
        curl_setopt($ch, CURLOPT_POST, true);
        curl_setopt($ch, CURLOPT_POSTFIELDS, $body);
        curl_setopt($ch, CURLOPT_HTTPHEADER, ['Content-Type: application/json']);
        curl_setopt($ch, CURLOPT_SSL_VERIFYPEER, false);
        curl_setopt($ch, CURLOPT_SSL_VERIFYHOST, false);
        // Force IPv4 resolution to prevent slow IPv6 lookup on Windows local dev
        curl_setopt($ch, CURLOPT_IPRESOLVE, CURL_IPRESOLVE_V4);
        // Short, hard timeouts: this call must never become the bottleneck
        // for the player's own request. If Pusher is slow/down, we fail
        // fast and the requesting player still gets their response on time.
        curl_setopt($ch, CURLOPT_CONNECTTIMEOUT_MS, 1000);
        curl_setopt($ch, CURLOPT_TIMEOUT_MS, 1500);

        $response = curl_exec($ch);
        $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
        curl_close($ch);

        if ($httpCode !== 200) {
            error_log("Pusher API returned HTTP Code $httpCode: $response");
            return false;
        }

        return true;
    }

    /**
     * Flushes the HTTP response to the client now (if running under
     * PHP-FPM), so any code that runs after this call (e.g. a Pusher
     * broadcast) does not make the requesting player wait for it.
     *
     * IMPORTANT: call this AFTER echo-ing the JSON response, never before
     * — otherwise the response gets cut off before it's even generated.
     * On non-FPM setups (Apache mod_php, php -S) this is a no-op; the
     * short timeouts on trigger()/triggerAsync() keep the extra wait
     * bounded to ~1-1.5s in that case.
     */
    public static function finishResponse(): void {
        if (function_exists('fastcgi_finish_request')) {
            fastcgi_finish_request();
        } else {
            if (!headers_sent()) {
                header("Connection: close");
            }
            while (ob_get_level() > 0) {
                ob_end_flush();
            }
            flush();
        }
    }

    /**
     * Alias for trigger(), used at every broadcast call site in the
     * controller. The actual "don't make the player wait" behavior comes
     * from calling Pusher::finishResponse() right after echo-ing the
     * response and BEFORE calling this — see broadcastLobbyState() call
     * sites in LobbyController. This method itself stays synchronous;
     * its short timeouts (set in trigger()) just guarantee it can never
     * hang indefinitely if Pusher is slow or unreachable.
     */
    public static function triggerAsync(string $channel, string $event, $data): void {
        self::trigger($channel, $event, $data);
    }
}