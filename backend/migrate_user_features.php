<?php
/**
 * Database Migration: Add Email Verification, Profile custom fields, and Friendships table
 * Run this from the CLI: php backend/migrate_user_features.php
 */

require_once __DIR__ . '/src/Config/Database.php';

use App\Config\Database;

echo "=== STARTING USER FEATURES MIGRATION ===\n";

try {
    $db = Database::getConnection();

    // 1. Check and add columns to users table
    $stmt = $db->query("DESCRIBE users");
    $columns = $stmt->fetchAll(PDO::FETCH_COLUMN);

    if (!in_array('email', $columns)) {
        echo "-> Adding 'email' column to users...\n";
        $db->exec("ALTER TABLE users ADD COLUMN email VARCHAR(100) DEFAULT NULL");
        $db->exec("CREATE UNIQUE INDEX idx_users_email ON users(email)");
    } else {
        echo "-> Column 'email' already exists.\n";
    }

    if (!in_array('is_verified', $columns)) {
        echo "-> Adding 'is_verified' column to users...\n";
        $db->exec("ALTER TABLE users ADD COLUMN is_verified TINYINT(1) NOT NULL DEFAULT 0");
        // Auto-verify existing seeded users (e.g. admin, alice, bob)
        $db->exec("UPDATE users SET is_verified = 1");
    } else {
        echo "-> Column 'is_verified' already exists.\n";
    }

    if (!in_array('verification_code', $columns)) {
        echo "-> Adding 'verification_code' column to users...\n";
        $db->exec("ALTER TABLE users ADD COLUMN verification_code VARCHAR(6) DEFAULT NULL");
    } else {
        echo "-> Column 'verification_code' already exists.\n";
    }

    if (!in_array('bio', $columns)) {
        echo "-> Adding 'bio' column to users...\n";
        $db->exec("ALTER TABLE users ADD COLUMN bio TEXT DEFAULT NULL");
    } else {
        echo "-> Column 'bio' already exists.\n";
    }

    if (!in_array('avatar_url', $columns)) {
        echo "-> Adding 'avatar_url' column to users...\n";
        $db->exec("ALTER TABLE users ADD COLUMN avatar_url VARCHAR(255) DEFAULT NULL");
    } else {
        echo "-> Column 'avatar_url' already exists.\n";
    }

    // 2. Create Friendships Table
    echo "-> Checking/Creating 'friendships' table...\n";
    $db->exec("CREATE TABLE IF NOT EXISTS friendships (
        id INT AUTO_INCREMENT PRIMARY KEY,
        user_id INT NOT NULL,
        friend_id INT NOT NULL,
        status ENUM('pending', 'accepted') NOT NULL DEFAULT 'pending',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        FOREIGN KEY (friend_id) REFERENCES users(id) ON DELETE CASCADE,
        UNIQUE KEY unique_friendship (user_id, friend_id)
    ) ENGINE=InnoDB");

    echo "✅ Migration completed successfully.\n";
} catch (\PDOException $e) {
    echo "❌ Migration failed: " . $e->getMessage() . "\n";
    exit(1);
}
