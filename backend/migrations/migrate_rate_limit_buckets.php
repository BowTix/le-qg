<?php

require_once dirname(__DIR__) . '/src/Config/Database.php';

use App\Config\Database;

$db = Database::getConnection();
$db->exec("
    CREATE TABLE IF NOT EXISTS rate_limit_buckets (
        ip VARCHAR(45) NOT NULL,
        window_start INT UNSIGNED NOT NULL,
        request_count INT UNSIGNED NOT NULL DEFAULT 1,
        PRIMARY KEY (ip, window_start),
        KEY idx_rate_limit_window (window_start)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
");

echo "Migration rate_limit_buckets appliquée.\n";
