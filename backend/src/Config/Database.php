<?php
namespace App\Config;

use PDO;
use PDOException;

class Database {
    private static $connection = null;

    private static function loadEnv() {
        $envFile = dirname(__DIR__, 2) . '/.env';
        if (file_exists($envFile)) {
            $lines = file($envFile, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES);
            foreach ($lines as $line) {
                $line = trim($line);
                if (empty($line) || strpos($line, '#') === 0) {
                    continue;
                }
                $parts = explode('=', $line, 2);
                if (count($parts) === 2) {
                    $key = trim($parts[0]);
                    $val = trim($parts[1]);
                    if (preg_match('/^"([^"]*)"$/', $val, $matches) || preg_match("/^'([^']*)'$/", $val, $matches)) {
                        $val = $matches[1];
                    }
                    putenv("$key=$val");
                    $_ENV[$key] = $val;
                    $_SERVER[$key] = $val;
                }
            }
        }
    }

    public static function getConnection() {
        if (self::$connection === null) {
            self::loadEnv();

            $host = getenv('DB_HOST') ?: '127.0.0.1';
            $port = getenv('DB_PORT') ?: '3306';
            $dbName = getenv('DB_NAME') ?: 'quiz_db';
            $user = getenv('DB_USER') ?: 'root';
            $pass = getenv('DB_PASS') !== false ? getenv('DB_PASS') : '';
            $sslCa = getenv('DB_SSL_CA') ?: null;

            try {
                $dsn = "mysql:host=$host;port=$port;dbname=$dbName;charset=utf8mb4";
                $options = [
                    PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
                    PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
                    PDO::ATTR_EMULATE_PREPARES => false,
                ];

                if ($sslCa) {
                    $caPath = dirname(__DIR__, 2) . '/' . $sslCa;
                    if (file_exists($caPath)) {
                        $options[PDO::MYSQL_ATTR_SSL_CA] = $caPath;
                    }
                }

                self::$connection = new PDO($dsn, $user, $pass, $options);
            } catch (PDOException $e) {
                // Return a clean 500 server error
                http_response_code(500);
                echo json_encode(["error" => "Database connection failure: " . $e->getMessage()]);
                exit(1);
            }
        }
        return self::$connection;
    }
}
