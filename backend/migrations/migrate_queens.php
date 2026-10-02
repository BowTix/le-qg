<?php
require_once __DIR__ . '/../src/Config/Database.php';

use App\Config\Database;

try {
    $db = Database::getConnection();
    echo "Connected to DB successfully.\n";

    // 1. Table for caching daily Queens grids
    $db->exec("
        CREATE TABLE IF NOT EXISTS daily_queens_grids (
            id INT AUTO_INCREMENT PRIMARY KEY,
            play_date DATE UNIQUE NOT NULL,
            grid_size TINYINT NOT NULL DEFAULT 8,
            regions JSON NOT NULL,
            solution VARCHAR(64) NOT NULL,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    ");
    echo "Table daily_queens_grids ready.\n";

    // 2. Table for tracking user Queens attempts and progress
    $db->exec("
        CREATE TABLE IF NOT EXISTS user_queens_attempts (
            id INT AUTO_INCREMENT PRIMARY KEY,
            user_id INT NOT NULL,
            play_date DATE NOT NULL,
            grid_state VARCHAR(64) NOT NULL,
            time_spent_seconds INT DEFAULT 0,
            status ENUM('in_progress', 'completed') DEFAULT 'in_progress',
            coins_awarded INT DEFAULT 0,
            score_awarded INT DEFAULT 0,
            completed_at DATETIME NULL,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            UNIQUE KEY unique_user_queens_date (user_id, play_date),
            FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    ");
    echo "Table user_queens_attempts ready.\n";

    echo "Migration completed successfully!\n";
} catch (Exception $e) {
    echo "Migration failed: " . $e->getMessage() . "\n";
    exit(1);
}
