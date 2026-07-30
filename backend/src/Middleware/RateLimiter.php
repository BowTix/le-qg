<?php
namespace App\Middleware;

use App\Config\Database;

class RateLimiter {
    /**
     * Production uses one atomic database operation per request. The local
     * PHP development server skips this remote-DB limiter entirely.
     */
    public static function checkLimit() {
        if (PHP_SAPI === 'cli-server') {
            return;
        }

        $ip = $_SERVER['REMOTE_ADDR'] ?? '127.0.0.1';
        $now = time();

        try {
            $db = Database::getConnection();
            $stmt = $db->prepare("
                INSERT INTO rate_limit_buckets (ip, window_start, request_count)
                VALUES (?, ?, 1)
                ON DUPLICATE KEY UPDATE
                    request_count = LAST_INSERT_ID(request_count + 1)
            ");
            $stmt->execute([$ip, $now]);
            $requestCount = $stmt->rowCount() === 1
                ? 1
                : (int) $db->lastInsertId();

            if ($requestCount > 30) {
                http_response_code(429);
                header('Content-Type: application/json');
                echo json_encode([
                    "error" => "Rate limit exceeded (Max 30 requests/sec). Stop spamming the endpoints!"
                ]);
                exit();
            }

            // Keep cleanup off the hot path for 99.9% of requests.
            if (random_int(1, 1000) === 1) {
                $db->prepare("DELETE FROM rate_limit_buckets WHERE window_start < ?")
                    ->execute([$now - 3600]);
            }
        } catch (\PDOException $e) {
            // Log database errors silently, but don't crash the request if rate limiting table fails
            error_log("RateLimiter DB Error: " . $e->getMessage());
        }
    }
}
