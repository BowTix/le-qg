<?php
namespace App\Utils;

class JWT {
    // Secret key for signing (ideally loaded from environment, fallback to a secure hardcoded string)
    private static $secret = 'super_secret_anti_cheat_quiz_key_2026_!#@$';

    public static function getSecret() {
        return self::$secret;
    }

    /**
     * Base64URL Encode
     */
    public static function base64UrlEncode(string $data): string {
        return str_replace(['+', '/', '='], ['-', '_', ''], base64_encode($data));
    }

    /**
     * Base64URL Decode
     */
    public static function base64UrlDecode(string $data): string {
        $remainder = strlen($data) % 4;
        if ($remainder) {
            $padlen = 4 - $remainder;
            $data .= str_repeat('=', $padlen);
        }
        return base64_decode(str_replace(['-', '_'], ['+', '/'], $data));
    }

    /**
     * Encode payload into a JWT
     */
    public static function encode(array $payload, int $expiryInSeconds = 28800): string {
        $header = json_encode(['alg' => 'HS256', 'typ' => 'JWT']);
        
        // Add expiration if requested
        if (!isset($payload['exp']) && $expiryInSeconds > 0) {
            $payload['exp'] = time() + $expiryInSeconds;
        }

        $base64UrlHeader = self::base64UrlEncode($header);
        $base64UrlPayload = self::base64UrlEncode(json_encode($payload));

        $signature = hash_hmac('sha256', "$base64UrlHeader.$base64UrlPayload", self::$secret, true);
        $base64UrlSignature = self::base64UrlEncode($signature);

        return "$base64UrlHeader.$base64UrlPayload.$base64UrlSignature";
    }

    /**
     * Decode and verify a JWT. Returns null if invalid or expired.
     */
    public static function decode(string $token): ?array {
        $parts = explode('.', $token);
        if (count($parts) !== 3) {
            return null;
        }

        list($base64UrlHeader, $base64UrlPayload, $base64UrlSignature) = $parts;

        // Verify Signature
        $signature = self::base64UrlDecode($base64UrlSignature);
        $expectedSignature = hash_hmac('sha256', "$base64UrlHeader.$base64UrlPayload", self::$secret, true);

        if (!hash_equals($signature, $expectedSignature)) {
            return null; // Signature verification failed
        }

        $payload = json_decode(self::base64UrlDecode($base64UrlPayload), true);
        if (!$payload) {
            return null;
        }

        // Verify Expiration
        if (isset($payload['exp']) && $payload['exp'] < time()) {
            return null; // Token expired
        }

        return $payload;
    }

    /**
     * Generates a signed Answer Token specifically for the speed timer.
     * Contains the question_id and the sent_at millisecond timestamp.
     */
    public static function generateAnswerToken(int $questionId, array $extra = []): string {
        // Use a millisecond timestamp for high precision anti-bot check
        $sentAt = (int) (microtime(true) * 1000);
        $payload = array_merge([
            'question_id' => $questionId,
            'sent_at' => $sentAt,
            'exp' => time() + 30 // Question answer session expires after 30 seconds
        ], $extra);
        return self::encode($payload, 30);
    }
}
