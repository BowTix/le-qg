<?php
namespace App\Middleware;

use App\Config\Database;

class RateLimiter {
    /**
     * Checks if the client has exceeded the rate limit (5 requests per second)
     */
    public static function checkLimit() {
        $ip = $_SERVER['REMOTE_ADDR'] ?? '127.0.0.1';
        $endpoint = parse_url($_SERVER['REQUEST_URI'] ?? '', PHP_URL_PATH);
        $now = time();

        try {
            $db = Database::getConnection();

            // 1. Purge entries older than 2 seconds (buffer to keep table size tiny)
            $stmtClean = $db->prepare("DELETE FROM rate_limits WHERE timestamp < ?");
            $stmtClean->execute([$now - 2]);

            // 2. Count requests in the last 1 second
            $stmtCount = $db->prepare("SELECT COUNT(*) FROM rate_limits WHERE ip = ? AND timestamp >= ?");
            $stmtCount->execute([$ip, $now - 1]);
            $requestCount = (int) $stmtCount->fetchColumn();

            if ($requestCount >= 5) {
                http_response_code(429);
                header('Content-Type: application/json');
                echo json_encode([
                    "error" => "Rate limit exceeded (Max 5 requests/sec). Stop spamming the endpoints!"
                ]);
                exit();
            }

            // 3. Record the current request
            $stmtInsert = $db->prepare("INSERT INTO rate_limits (ip, endpoint, timestamp) VALUES (?, ?, ?)");
            $stmtInsert->execute([$ip, $endpoint, $now]);

        } catch (\PDOException $e) {
            // Log database errors silently, but don't crash the request if rate limiting table fails
            error_log("RateLimiter DB Error: " . $e->getMessage());
        }
    }
}
