<?php
/**
 * Database Migration: Add 'open' question type support
 * Run this from the CLI: php backend/migrate_open_questions.php
 */

require_once __DIR__ . '/src/Config/Database.php';

use App\Config\Database;

echo "=== STARTING OPEN QUESTIONS MIGRATION ===\n";

try {
    $db = Database::getConnection();

    // Modify question_type ENUM to add 'open'
    echo "-> Modifying 'question_type' enum in questions table...\n";
    $db->exec("
        ALTER TABLE questions 
        MODIFY COLUMN question_type ENUM('multiple_choice', 'guess_number', 'open') NOT NULL DEFAULT 'multiple_choice'
    ");
    echo "✅ Migration completed successfully.\n";
} catch (\PDOException $e) {
    echo "❌ Migration failed: " . $e->getMessage() . "\n";
    exit(1);
}
