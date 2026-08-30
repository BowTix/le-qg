<?php
/**
 * Database Migration: Add google_id column and allow NULL password_hash for OAuth users
 * Run: php backend/migrations/migrate_google_oauth.php
 */

require_once __DIR__ . '/../src/Config/Database.php';

use App\Config\Database;

echo "=== STARTING GOOGLE OAUTH MIGRATION ===\n";

try {
    $db = Database::getConnection();

    $stmt = $db->query("DESCRIBE users");
    $columns = $stmt->fetchAll(PDO::FETCH_COLUMN);

    if (!in_array('google_id', $columns)) {
        echo "-> Adding 'google_id' column to users table...\n";
        $db->exec("ALTER TABLE users ADD COLUMN google_id VARCHAR(255) DEFAULT NULL AFTER email");
        $db->exec("CREATE UNIQUE INDEX idx_users_google_id ON users(google_id)");
        echo "-> 'google_id' column added successfully.\n";
    } else {
        echo "-> 'google_id' column already exists.\n";
    }

    // Make password_hash nullable for OAuth-only users
    echo "-> Ensuring password_hash can be NULL for OAuth users...\n";
    $db->exec("ALTER TABLE users MODIFY COLUMN password_hash VARCHAR(255) DEFAULT NULL");

    echo "✅ Google OAuth migration completed successfully.\n";
} catch (\PDOException $e) {
    echo "❌ Migration failed: " . $e->getMessage() . "\n";
    exit(1);
}
