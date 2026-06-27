<?php
/**
 * Database Migration: QG Mini-Games & Quiz HQ Expansion
 */

require_once __DIR__ . '/src/Config/Database.php';

use App\Config\Database;

echo "=== STARTING HQ MINI-GAMES MIGRATION ===\n";

try {
    $db = Database::getConnection();

    // 1. Add game_mode to lobbies table
    echo "-> Adding 'game_mode' to lobbies table...\n";
    $db->exec("
        ALTER TABLE lobbies 
        ADD COLUMN game_mode ENUM('classic', 'sudden_death', 'speed_blitz', 'guess_number') NOT NULL DEFAULT 'classic'
    ");
} catch (\PDOException $e) {
    echo "⚠️ Info/Warning: " . $e->getMessage() . "\n";
}

try {
    $db = Database::getConnection();

    // 2. Add gameplay & reaction columns to lobby_players
    echo "-> Adding gameplay and reaction columns to lobby_players table...\n";
    $db->exec("
        ALTER TABLE lobby_players 
        ADD COLUMN is_eliminated TINYINT(1) NOT NULL DEFAULT 0,
        ADD COLUMN last_guess INT DEFAULT NULL,
        ADD COLUMN reaction VARCHAR(10) DEFAULT NULL,
        ADD COLUMN reaction_sent_at BIGINT UNSIGNED DEFAULT NULL
    ");
} catch (\PDOException $e) {
    echo "⚠️ Info/Warning: " . $e->getMessage() . "\n";
}

try {
    $db = Database::getConnection();

    // 3. Add question_type and correct_value to questions table
    echo "-> Adding question_type and correct_value columns to questions table...\n";
    $db->exec("
        ALTER TABLE questions 
        ADD COLUMN question_type ENUM('multiple_choice', 'guess_number') NOT NULL DEFAULT 'multiple_choice',
        ADD COLUMN correct_value INT DEFAULT NULL
    ");
} catch (\PDOException $e) {
    echo "⚠️ Info/Warning: " . $e->getMessage() . "\n";
}

try {
    $db = Database::getConnection();

    // 4. Create matches table for history logging
    echo "-> Creating matches history table...\n";
    $db->exec("
        CREATE TABLE IF NOT EXISTS matches (
            id INT AUTO_INCREMENT PRIMARY KEY,
            room_code VARCHAR(10) NOT NULL,
            game_mode VARCHAR(30) NOT NULL,
            pack_name VARCHAR(100) NOT NULL,
            winner_username VARCHAR(50) DEFAULT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    ");
} catch (\PDOException $e) {
    echo "❌ Error creating matches table: " . $e->getMessage() . "\n";
}

try {
    $db = Database::getConnection();

    // 5. Seed a dedicated "Le Juste Nombre" Pack
    echo "-> Seeding 'Le Juste Nombre' pack...\n";
    
    // Check if it already exists
    $stmtCheck = $db->prepare("SELECT id FROM packs WHERE name = ?");
    $stmtCheck->execute(["Le Juste Nombre"]);
    $packId = $stmtCheck->fetchColumn();

    if (!$packId) {
        $stmtInsert = $db->prepare("INSERT INTO packs (name, description, creator_id, is_validated) VALUES (?, ?, 1, 1)");
        $stmtInsert->execute([
            "Le Juste Nombre",
            "Estimez la bonne valeur chiffrée le plus précisément possible ! Proche de la vérité = un maximum de points !"
        ]);
        $packId = $db->lastInsertId();
        echo "✅ Created 'Le Juste Nombre' pack with ID: $packId\n";
    } else {
        echo "ℹ️ Pack 'Le Juste Nombre' already exists (ID: $packId). Clearing its questions to re-seed...\n";
        $db->prepare("DELETE FROM questions WHERE pack_id = ?")->execute([$packId]);
    }

    // Seed 10 numerical questions
    $questions = [
        ["En quelle année est sorti le tout premier iPhone (Apple) ?", 2007],
        ["Combien de cœurs possède une pieuvre dans son corps ?", 3],
        ["Quelle est la vitesse approximative de la lumière (en milliers de km/s) ?", 300],
        ["Combien de touches comporte un piano standard (touches blanches et noires) ?", 88],
        ["Combien de pays sont membres de l'Union Européenne actuellement ?", 27],
        ["En quelle année l'Homme a-t-il marché sur la Lune pour la première fois (Apollo 11) ?", 1969],
        ["Combien de secondes y a-t-il dans une heure ?", 3600],
        ["Quel est le numéro atomique de l'or (symbole Au) ?", 79],
        ["Combien de marches compte la Tour Eiffel jusqu'au sommet public (3ème étage) ?", 1665],
        ["En quelle année le World Wide Web a-t-il été proposé par Tim Berners-Lee ?", 1989]
    ];

    $stmtQ = $db->prepare("
        INSERT INTO questions (pack_id, question_text, opt_a, opt_b, opt_c, opt_d, correct_opt, question_type, correct_value) 
        VALUES (?, ?, '', '', '', '', 'A', 'guess_number', ?)
    ");

    foreach ($questions as $q) {
        $stmtQ->execute([$packId, $q[0], $q[1]]);
    }

    echo "✅ Seeded 10 estimation questions successfully.\n";

} catch (\Exception $e) {
    echo "❌ Error seeding pack: " . $e->getMessage() . "\n";
}

echo "=== MIGRATION COMPLETED SUCCESSFULLY ===\n";
