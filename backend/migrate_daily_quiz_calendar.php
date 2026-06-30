<?php
/**
 * Database Migration: Daily Quiz & Calendar Management
 */

require_once __DIR__ . '/src/Config/Database.php';

use App\Config\Database;

echo "=== STARTING DAILY QUIZ CALENDAR MIGRATION ===\n";

try {
    $db = Database::getConnection();

    // 1. Create daily_quizzes table
    echo "-> Creating 'daily_quizzes' table...\n";
    $db->exec("
        CREATE TABLE IF NOT EXISTS daily_quizzes (
            date DATE PRIMARY KEY,
            q1_id INT NOT NULL,
            q2_id INT NOT NULL,
            q3_id INT NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (q1_id) REFERENCES questions(id) ON DELETE CASCADE,
            FOREIGN KEY (q2_id) REFERENCES questions(id) ON DELETE CASCADE,
            FOREIGN KEY (q3_id) REFERENCES questions(id) ON DELETE CASCADE
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    ");
    echo "✅ Table 'daily_quizzes' created successfully.\n";

} catch (\PDOException $e) {
    echo "❌ Error creating 'daily_quizzes' table: " . $e->getMessage() . "\n";
}

try {
    $db = Database::getConnection();

    // 2. Create daily_quiz_attempts table
    echo "-> Creating 'daily_quiz_attempts' table...\n";
    $db->exec("
        CREATE TABLE IF NOT EXISTS daily_quiz_attempts (
            id INT AUTO_INCREMENT PRIMARY KEY,
            user_id INT NOT NULL,
            date DATE NOT NULL,
            q1_correct TINYINT(1) NOT NULL,
            q2_correct TINYINT(1) NOT NULL,
            q3_correct TINYINT(1) NOT NULL,
            score INT NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            UNIQUE KEY uq_user_daily (user_id, date),
            FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
            FOREIGN KEY (date) REFERENCES daily_quizzes(date) ON DELETE CASCADE
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    ");
    echo "✅ Table 'daily_quiz_attempts' created successfully.\n";

} catch (\PDOException $e) {
    echo "❌ Error creating 'daily_quiz_attempts' table: " . $e->getMessage() . "\n";
}

echo "=== MIGRATION COMPLETED SUCCESSFULLY ===\n";
