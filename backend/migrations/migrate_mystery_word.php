<?php
/**
 * Migration: Create user_mystery_word_attempts table for Mot Mystere
 * Run: php backend/migrations/migrate_mystery_word.php
 */

require_once __DIR__ . '/../src/Config/Database.php';

use App\Config\Database;

echo "=== MIGRATION: MOT MYSTERE (WORDLE) ===\n";

try {
    $db = Database::getConnection();

    $sql = "
        CREATE TABLE IF NOT EXISTS user_mystery_word_attempts (
            id INT AUTO_INCREMENT PRIMARY KEY,
            user_id INT NOT NULL,
            game_date DATE NOT NULL,
            guesses JSON NOT NULL,
            status ENUM('in_progress', 'won', 'lost') NOT NULL DEFAULT 'in_progress',
            attempts_count TINYINT NOT NULL DEFAULT 0,
            score_awarded INT NOT NULL DEFAULT 0,
            coins_awarded INT NOT NULL DEFAULT 0,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            UNIQUE KEY unique_user_day (user_id, game_date),
            INDEX idx_user (user_id),
            INDEX idx_date (game_date),
            CONSTRAINT fk_mystery_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    ";

    $db->exec($sql);
    echo "✅ Table 'user_mystery_word_attempts' created or already exists.\n";
} catch (\PDOException $e) {
    echo "❌ Migration failed: " . $e->getMessage() . "\n";
    exit(1);
}
