<?php
/**
 * Database Migration: L'Imposteur Game Mode & Seeds
 * Run: php backend/migrations/migrate_imposteur.php
 */

require_once __DIR__ . '/../src/Config/Database.php';

use App\Config\Database;

echo "=== STARTING L'IMPOSTEUR MIGRATION ===\n";

try {
    $db = Database::getConnection();

    // 1. Alter game_mode enum in lobbies table
    echo "-> Modifying 'game_mode' column in lobbies table...\n";
    $db->exec("
        ALTER TABLE lobbies 
        MODIFY COLUMN game_mode ENUM('classic', 'sudden_death', 'speed_blitz', 'guess_number', 'tribunal', 'imposteur') NOT NULL DEFAULT 'classic'
    ");
    echo "✅ Column 'game_mode' modified successfully.\n";
} catch (\PDOException $e) {
    echo "⚠️ Info/Warning (lobbies game_mode): " . $e->getMessage() . "\n";
}

try {
    $db = Database::getConnection();

    // 2. Add imposteur columns to lobbies
    echo "-> Adding imposteur columns to lobbies table...\n";
    $db->exec("
        ALTER TABLE lobbies 
        ADD COLUMN imposteur_word_innocent VARCHAR(100) DEFAULT NULL,
        ADD COLUMN imposteur_word_imposteur VARCHAR(100) DEFAULT NULL,
        ADD COLUMN imposteur_theme VARCHAR(100) DEFAULT NULL,
        ADD COLUMN imposteur_phase ENUM('debate', 'voting', 'results') DEFAULT NULL,
        ADD COLUMN imposteur_eliminated_user_id INT DEFAULT NULL
    ");
    echo "✅ Lobbies columns added successfully.\n";
} catch (\PDOException $e) {
    echo "⚠️ Info/Warning (lobbies columns): " . $e->getMessage() . "\n";
}

try {
    $db = Database::getConnection();

    // 3. Add imposteur columns to lobby_players
    echo "-> Adding imposteur columns to lobby_players table...\n";
    $db->exec("
        ALTER TABLE lobby_players 
        ADD COLUMN imposteur_role ENUM('innocent', 'imposteur') DEFAULT NULL,
        ADD COLUMN imposteur_word VARCHAR(100) DEFAULT NULL,
        ADD COLUMN imposteur_voted_for_user_id INT DEFAULT NULL
    ");
    echo "✅ Lobby_players columns added successfully.\n";
} catch (\PDOException $e) {
    echo "⚠️ Info/Warning (lobby_players columns): " . $e->getMessage() . "\n";
}

try {
    $db = Database::getConnection();

    // 4. Create imposteur_words table
    echo "-> Creating 'imposteur_words' table...\n";
    $db->exec("
        CREATE TABLE IF NOT EXISTS imposteur_words (
            id INT AUTO_INCREMENT PRIMARY KEY,
            word_innocent VARCHAR(100) NOT NULL,
            word_imposteur VARCHAR(100) NOT NULL,
            theme VARCHAR(100) NOT NULL
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    ");
    echo "✅ Table 'imposteur_words' created successfully.\n";
} catch (\PDOException $e) {
    echo "❌ Error creating 'imposteur_words' table: " . $e->getMessage() . "\n";
}

try {
    $db = Database::getConnection();

    // 5. Seed word pairs
    echo "-> Seeding 'imposteur_words' table...\n";
    
    // Check if it already has entries
    $count = $db->query("SELECT COUNT(*) FROM imposteur_words")->fetchColumn();
    if ($count == 0) {
        $words = [
            ["Lion", "Tigre", "Animaux"],
            ["Château", "Palais", "Bâtiments"],
            ["Bain", "Douche", "Maison"],
            ["Guitare", "Violon", "Musique"],
            ["Pomme", "Poire", "Fruits"],
            ["Stylo", "Crayon", "Bureau"],
            ["Café", "Thé", "Boissons"],
            ["Avion", "Hélicoptère", "Transport"],
            ["Voiture", "Moto", "Transport"],
            ["Miroir", "Fenêtre", "Objets"],
            ["Montagne", "Colline", "Nature"],
            ["Rivière", "Lac", "Nature"],
            ["Pizza", "Quiche", "Nourriture"],
            ["Soleil", "Lune", "Astronomie"],
            ["Football", "Rugby", "Sports"],
            ["Tennis", "Ping-pong", "Sports"],
            ["Médecin", "Infirmier", "Métiers"],
            ["Professeur", "Instituteur", "Métiers"],
            ["Chapeau", "Casquette", "Vêtements"],
            ["Chaussure", "Botte", "Vêtements"],
            ["Chocolat", "Nutella", "Nourriture"],
            ["Plage", "Piscine", "Loisirs"],
            ["Cinéma", "Théâtre", "Loisirs"],
            ["Bière", "Vin", "Boissons"],
            ["Chaussette", "Collant", "Vêtements"]
        ];

        $stmt = $db->prepare("INSERT INTO imposteur_words (word_innocent, word_imposteur, theme) VALUES (?, ?, ?)");
        foreach ($words as $w) {
            $stmt->execute($w);
        }
        echo "✅ Seeded " . count($words) . " word pairs successfully.\n";
    } else {
        echo "ℹ️ Table 'imposteur_words' already has entries, skipping seed.\n";
    }

} catch (\PDOException $e) {
    echo "❌ Error seeding words: " . $e->getMessage() . "\n";
}

try {
    $db = Database::getConnection();

    // 6. Seed a dedicated "L'Imposteur" Pack
    echo "-> Seeding 'L'Imposteur' pack...\n";
    
    $stmtCheck = $db->prepare("SELECT id FROM packs WHERE name = ?");
    $stmtCheck->execute(["L'Imposteur"]);
    $packId = $stmtCheck->fetchColumn();

    if (!$packId) {
        $stmtInsert = $db->prepare("INSERT INTO packs (name, description, creator_id, is_validated) VALUES (?, ?, 1, 1)");
        $stmtInsert->execute([
            "L'Imposteur",
            "Jeu de rôles et de bluff IRL. Trouvez l'intrus parmi vous !"
        ]);
        $packId = $db->lastInsertId();
        echo "✅ Created 'L'Imposteur' pack with ID: $packId\n";
    } else {
        echo "ℹ️ Pack 'L'Imposteur' already exists (ID: $packId).\n";
    }
} catch (\PDOException $e) {
    echo "❌ Error seeding Imposteur pack: " . $e->getMessage() . "\n";
}

echo "=== MIGRATION COMPLETED SUCCESSFULLY ===\n";
