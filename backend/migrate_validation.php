<?php
/**
 * Database Migration: User Theme Creator & Validation Column Setup
 * Run this from the CLI: php migrate_validation.php
 */

$host = '127.0.0.1';
$dbName = 'quiz_db';
$user = 'root';
$pass = '';

try {
    $pdo = new PDO("mysql:host=$host;dbname=$dbName;charset=utf8mb4", $user, $pass, [
        PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION
    ]);
    echo "Connected to MySQL database 'quiz_db' successfully.\n";

    // 1. Check if 'creator_id' column exists
    $stmt = $pdo->query("SHOW COLUMNS FROM packs LIKE 'creator_id'");
    $columnExists = $stmt->fetch();

    if (!$columnExists) {
        // Add creator_id and is_validated
        $pdo->exec("ALTER TABLE packs ADD COLUMN creator_id INT DEFAULT NULL");
        $pdo->exec("ALTER TABLE packs ADD COLUMN is_validated TINYINT(1) NOT NULL DEFAULT 0");
        
        // Add foreign key constraint
        $pdo->exec("ALTER TABLE packs ADD CONSTRAINT fk_packs_creator FOREIGN KEY (creator_id) REFERENCES users(id) ON DELETE SET NULL");
        
        echo "Columns 'creator_id' and 'is_validated' added to 'packs' table.\n";
    } else {
        echo "Columns already exist in 'packs' table. Skipping addition.\n";
    }

    // 2. Validate seeded default packs (id 1 and 2)
    $pdo->exec("UPDATE packs SET is_validated = 1 WHERE id IN (1, 2)");
    echo "Seeded default packs set to validated.\n";

    // 3. Make sure setup_db.php is updated too for fresh installs (we will do this next)
    echo "Migration completed successfully.\n";

} catch (PDOException $e) {
    echo "Migration failed: " . $e->getMessage() . "\n";
    exit(1);
}
