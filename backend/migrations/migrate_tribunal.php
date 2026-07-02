<?php
/**
 * Database Migration: Le Tribunal Game Mode & Seeds
 */

require_once __DIR__ . '/../src/Config/Database.php';

use App\Config\Database;

echo "=== STARTING LE TRIBUNAL MIGRATION ===\n";

try {
    $db = Database::getConnection();

    // 1. Alter game_mode enum in lobbies table
    echo "-> Modifying 'game_mode' column in lobbies table...\n";
    $db->exec("
        ALTER TABLE lobbies 
        MODIFY COLUMN game_mode ENUM('classic', 'sudden_death', 'speed_blitz', 'guess_number', 'tribunal') NOT NULL DEFAULT 'classic'
    ");
    echo "✅ Column 'game_mode' modified successfully.\n";
} catch (\PDOException $e) {
    echo "⚠️ Info/Warning: " . $e->getMessage() . "\n";
}

try {
    $db = Database::getConnection();

    // 2. Add tribunal_phase and tribunal_phase_ends_at to lobbies
    echo "-> Adding tribunal columns to lobbies table...\n";
    $db->exec("
        ALTER TABLE lobbies 
        ADD COLUMN tribunal_phase ENUM('writing', 'voting', 'results') DEFAULT NULL,
        ADD COLUMN tribunal_phase_ends_at BIGINT DEFAULT NULL
    ");
    echo "✅ Columns 'tribunal_phase' and 'tribunal_phase_ends_at' added successfully.\n";
} catch (\PDOException $e) {
    echo "⚠️ Info/Warning: " . $e->getMessage() . "\n";
}

try {
    $db = Database::getConnection();

    // 3. Create tribunal_submissions table
    echo "-> Creating 'tribunal_submissions' table...\n";
    $db->exec("
        CREATE TABLE IF NOT EXISTS tribunal_submissions (
            id INT AUTO_INCREMENT PRIMARY KEY,
            lobby_id INT NOT NULL,
            round_number INT NOT NULL,
            user_id INT NOT NULL,
            answer_text TEXT NOT NULL,
            voted_for_user_id INT DEFAULT NULL,
            FOREIGN KEY (lobby_id) REFERENCES lobbies(id) ON DELETE CASCADE,
            FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    ");
    echo "✅ Table 'tribunal_submissions' created successfully.\n";
} catch (\PDOException $e) {
    echo "❌ Error creating 'tribunal_submissions' table: " . $e->getMessage() . "\n";
}

try {
    $db = Database::getConnection();

    // 4. Seed "Le Tribunal" pack and prompts
    echo "-> Seeding 'Le Tribunal' pack...\n";
    
    // Check if it already exists
    $stmtCheck = $db->prepare("SELECT id FROM packs WHERE name = ?");
    $stmtCheck->execute(["Le Tribunal"]);
    $packId = $stmtCheck->fetchColumn();

    if (!$packId) {
        $stmtInsert = $db->prepare("INSERT INTO packs (name, description, creator_id, is_validated) VALUES (?, ?, 1, 1)");
        $stmtInsert->execute([
            "Le Tribunal",
            "Exprimez votre créativité ! Inventez des réponses hilarantes à des dilemmes et votez pour vos préférées."
        ]);
        $packId = $db->lastInsertId();
        echo "✅ Created 'Le Tribunal' pack with ID: $packId\n";
    } else {
        echo "ℹ️ Pack 'Le Tribunal' already exists (ID: $packId). Clearing its questions to re-seed...\n";
        $db->prepare("DELETE FROM questions WHERE pack_id = ?")->execute([$packId]);
    }

    // Seed 15 open prompts
    $prompts = [
        "Inventez la pire excuse pour un retard en daily meeting.",
        "Quel serait le titre de la biographie non autorisée de votre patron ?",
        "Trouvez un slogan accrocheur et absurde pour vendre de l'eau en poudre.",
        "Si vous deviez renommer le langage PHP en quelque chose de plus honnête, ce serait quoi ?",
        "Quelle est la pire idée de cadeau pour un mariage ?",
        "Si l'intelligence artificielle remplaçait les avocats, quelle serait leur première plaidoirie ?",
        "Inventez une fausse loi physique qui expliquerait pourquoi le café refroidit trop vite.",
        "Quel est le pire nom possible pour un salon de coiffure ?",
        "Que dit un développeur senior pour masquer le fait qu'il n'a aucune idée de comment réparer le bug ?",
        "Si vous deviez inventer une nouvelle touche sur le clavier, quelle serait sa fonction ?",
        "Quel animal ferait le pire animal de compagnie de bureau ?",
        "Quelle excuse donneriez-vous pour justifier le fait d'avoir mangé le repas d'un collègue dans le frigo ?",
        "Si les ordinateurs pouvaient parler, quelle serait leur plainte principale ?",
        "Quelle serait la pire idée de fonctionnalité à ajouter sur une application de rencontre ?",
        "Trouvez le titre du film d'horreur le moins effrayant de l'histoire."
    ];

    $stmtInsertQ = $db->prepare("
        INSERT INTO questions (pack_id, question_text, opt_a, opt_b, opt_c, opt_d, correct_opt, question_type) 
        VALUES (?, ?, '', '', '', '', 'A', 'open')
    ");

    foreach ($prompts as $pText) {
        $stmtInsertQ->execute([$packId, $pText]);
    }
    
    echo "✅ Seeded 15 prompts successfully.\n";

} catch (\PDOException $e) {
    echo "❌ Error seeding Tribunal pack: " . $e->getMessage() . "\n";
}

echo "=== MIGRATION COMPLETED SUCCESSFULLY ===\n";
