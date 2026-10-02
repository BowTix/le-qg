<?php
require_once __DIR__ . '/../src/Config/Database.php';

$db = App\Config\Database::getConnection();
$cols = $db->query("SHOW COLUMNS FROM users LIKE 'last_login_date'")->fetchAll();
if (empty($cols)) {
    $db->exec("ALTER TABLE users ADD COLUMN last_login_date DATE NULL AFTER craft_stars");
    echo "Added last_login_date column to users.\n";
} else {
    echo "last_login_date column already exists.\n";
}
