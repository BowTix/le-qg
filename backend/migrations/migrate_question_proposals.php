<?php
/**
 * Creates the moderation queue used for community question proposals.
 * Run: php backend/migrations/migrate_question_proposals.php
 */

require_once __DIR__ . '/../src/Config/Database.php';

use App\Config\Database;

try {
    $db = Database::getConnection();
    $db->exec("
        CREATE TABLE IF NOT EXISTS question_proposals (
            id INT AUTO_INCREMENT PRIMARY KEY,
            pack_id INT NOT NULL,
            contributor_id INT DEFAULT NULL,
            question_text TEXT NOT NULL,
            opt_a VARCHAR(255) NOT NULL,
            opt_b VARCHAR(255) NOT NULL DEFAULT '',
            opt_c VARCHAR(255) NOT NULL DEFAULT '',
            opt_d VARCHAR(255) NOT NULL DEFAULT '',
            correct_opt CHAR(1) NOT NULL DEFAULT 'A',
            question_type VARCHAR(32) NOT NULL DEFAULT 'qcm',
            media_url VARCHAR(255) DEFAULT NULL,
            status ENUM('pending', 'approved', 'rejected') NOT NULL DEFAULT 'pending',
            reviewed_by INT DEFAULT NULL,
            reviewed_at DATETIME DEFAULT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            INDEX idx_question_proposals_status (status, created_at),
            INDEX idx_question_proposals_pack (pack_id),
            CONSTRAINT fk_question_proposals_pack FOREIGN KEY (pack_id) REFERENCES packs(id) ON DELETE CASCADE,
            CONSTRAINT fk_question_proposals_contributor FOREIGN KEY (contributor_id) REFERENCES users(id) ON DELETE SET NULL,
            CONSTRAINT fk_question_proposals_reviewer FOREIGN KEY (reviewed_by) REFERENCES users(id) ON DELETE SET NULL
        ) ENGINE=InnoDB
    ");
    echo "question_proposals table ready.\n";
} catch (Throwable $error) {
    fwrite(STDERR, "Migration failed: " . $error->getMessage() . "\n");
    exit(1);
}
