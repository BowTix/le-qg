<?php
/**
 * Database Migration: Add support for Kculture questions (qcm, open, media)
 * Run: php backend/migrations/migrate_kculture_questions.php
 */

require_once __DIR__ . '/../src/Config/Database.php';

use App\Config\Database;

echo "=== STARTING KCULTURE QUESTIONS MIGRATION ===\n";

try {
    $db = Database::getConnection();

    // 1. Check if media_url column exists
    $columns = $db->query("SHOW COLUMNS FROM questions")->fetchAll(PDO::FETCH_COLUMN);
    
    if (!in_array('media_url', $columns)) {
        echo "-> Adding 'media_url' column to 'questions'...\n";
        $db->exec("ALTER TABLE questions ADD COLUMN media_url VARCHAR(255) DEFAULT NULL");
    } else {
        echo "-> 'media_url' column already exists, skipping addition.\n";
    }

    // 2. Temporarily modify question_type column to VARCHAR to allow new values
    echo "-> Changing 'question_type' to VARCHAR to perform mapping...\n";
    $db->exec("
        ALTER TABLE questions 
        MODIFY COLUMN question_type VARCHAR(50) NOT NULL DEFAULT 'multiple_choice'
    ");

    // 3. Update existing records
    echo "-> Mapping old question types to (qcm, open, media)...\n";
    $db->exec("UPDATE questions SET question_type = 'qcm' WHERE question_type = 'multiple_choice'");
    $db->exec("UPDATE questions SET question_type = 'open' WHERE question_type IN ('guess_number', 'open')");

    // 4. Change question_type to ENUM('qcm', 'open', 'media')
    echo "-> Changing 'question_type' to ENUM('qcm', 'open', 'media')...\n";
    $db->exec("
        ALTER TABLE questions 
        MODIFY COLUMN question_type ENUM('qcm', 'open', 'media') NOT NULL DEFAULT 'qcm'
    ");

    // 5. Change lobbies.game_mode column to VARCHAR(50)
    echo "-> Changing lobbies.game_mode to VARCHAR(50)...\n";
    $db->exec("
        ALTER TABLE lobbies 
        MODIFY COLUMN game_mode VARCHAR(50) NOT NULL DEFAULT 'kculture'
    ");

    // 6. Update existing lobbies to 'kculture' (optional but clean)
    $db->exec("UPDATE lobbies SET game_mode = 'kculture'");

    echo "✅ Migration completed successfully.\n";
} catch (\PDOException $e) {
    echo "❌ Migration failed: " . $e->getMessage() . "\n";
    exit(1);
}
