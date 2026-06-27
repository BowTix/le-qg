<?php
namespace App\Config;

use PDO;
use PDOException;

class Database {
    private static $connection = null;

    public static function getConnection() {
        if (self::$connection === null) {
            $host = '127.0.0.1';
            $dbName = 'quiz_db';
            $user = 'root';
            $pass = '';

            try {
                self::$connection = new PDO(
                    "mysql:host=$host;dbname=$dbName;charset=utf8mb4",
                    $user,
                    $pass,
                    [
                        PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
                        PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
                        PDO::ATTR_EMULATE_PREPARES => false,
                    ]
                );
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
