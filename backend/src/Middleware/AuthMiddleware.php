<?php
namespace App\Middleware;

use App\Utils\JWT;

class AuthMiddleware {
    /**
     * Authenticates the request by checking for a valid Bearer JWT.
     * Stores user context in $_REQUEST['user'] and returns it.
     * Terminates the request with 401 if unauthorized.
     */
    public static function authenticate(): array {
        $headers = getallheaders();
        
        // Handle variations in header casing
        $authHeader = '';
        foreach ($headers as $key => $value) {
            if (strcasecmp($key, 'Authorization') === 0) {
                $authHeader = $value;
                break;
            }
        }

        if (empty($authHeader) && isset($_SERVER['HTTP_AUTHORIZATION'])) {
            $authHeader = $_SERVER['HTTP_AUTHORIZATION'];
        }

        if (!empty($authHeader) && preg_match('/Bearer\s(\S+)/', $authHeader, $matches)) {
            $token = $matches[1];
            $payload = JWT::decode($token);
            
            if ($payload) {
                $_REQUEST['user'] = $payload;
                return $payload;
            }
        }

        http_response_code(401);
        header('Content-Type: application/json');
        echo json_encode(["error" => "Unauthorized. Valid token required."]);
        exit();
    }

    /**
     * Authenticates and verifies that the user is an admin.
     * Terminates the request with 403 if user is not an admin.
     */
    public static function requireAdmin(): array {
        $user = self::authenticate();
        
        if (($user['role'] ?? 'user') !== 'admin') {
            http_response_code(403);
            header('Content-Type: application/json');
            echo json_encode(["error" => "Forbidden. Admin privileges required."]);
            exit();
        }

        return $user;
    }
}

// Polyfill getallheaders() if it doesn't exist (e.g. in some CLI or non-Apache setups)
if (!function_exists('getallheaders')) {
    function getallheaders() {
        $headers = [];
        foreach ($_SERVER as $name => $value) {
            if (substr($name, 0, 5) == 'HTTP_') {
                $headers[str_replace(' ', '-', ucwords(strtolower(str_replace('_', ' ', substr($name, 5)))))] = $value;
            }
        }
        return $headers;
    }
}
