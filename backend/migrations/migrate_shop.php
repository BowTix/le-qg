<?php
/**
 * Database Migration: Shop & Collectible Cards
 */

require_once __DIR__ . '/../src/Config/Database.php';

use App\Config\Database;

echo "=== STARTING SHOP & CARDS MIGRATION ===\n";

try {
    $db = Database::getConnection();

    // 1. Add columns to users table
    echo "-> Adding cosmetic columns to users table...\n";
    $db->exec("
        ALTER TABLE users 
        ADD COLUMN equipped_border VARCHAR(100) DEFAULT NULL,
        ADD COLUMN equipped_color VARCHAR(50) DEFAULT NULL,
        ADD COLUMN equipped_title VARCHAR(100) DEFAULT NULL
    ");
    echo "✅ Success adding users columns!\n";
} catch (\PDOException $e) {
    echo "⚠️ Info/Warning (Users columns might already exist): " . $e->getMessage() . "\n";
}

try {
    $db = Database::getConnection();

    // 2. Create user_cards table
    echo "-> Creating user_cards table...\n";
    $db->exec("
        CREATE TABLE IF NOT EXISTS user_cards (
            id INT AUTO_INCREMENT PRIMARY KEY,
            user_id INT NOT NULL,
            card_id VARCHAR(50) NOT NULL,
            quantity INT NOT NULL DEFAULT 1,
            unlocked_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            UNIQUE KEY user_card (user_id, card_id),
            CONSTRAINT fk_cards_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    ");
    echo "✅ Success creating user_cards table!\n";
} catch (\PDOException $e) {
    echo "❌ Error creating user_cards table: " . $e->getMessage() . "\n";
}

try {
    $db = Database::getConnection();

    // 3. Create user_cosmetics table
    echo "-> Creating user_cosmetics table...\n";
    $db->exec("
        CREATE TABLE IF NOT EXISTS user_cosmetics (
            id INT AUTO_INCREMENT PRIMARY KEY,
            user_id INT NOT NULL,
            item_type VARCHAR(50) NOT NULL,
            item_value VARCHAR(100) NOT NULL,
            unlocked_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            UNIQUE KEY user_item (user_id, item_type, item_value),
            CONSTRAINT fk_cosmetics_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    ");
    echo "✅ Success creating user_cosmetics table!\n";
} catch (\PDOException $e) {
    echo "❌ Error creating user_cosmetics table: " . $e->getMessage() . "\n";
}

echo "=== MIGRATION COMPLETED ===\n";
