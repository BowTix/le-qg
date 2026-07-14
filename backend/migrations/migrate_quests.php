<?php
require_once __DIR__ . '/../src/Config/Database.php';

use App\Config\Database;

echo "=== STARTING QUESTS MIGRATION ===\n";

try {
    $db = Database::getConnection();

    // 1. Create quests table
    echo "-> Creating 'quests' table...\n";
    $db->exec("
        CREATE TABLE IF NOT EXISTS quests (
            id INT AUTO_INCREMENT PRIMARY KEY,
            type ENUM('daily', 'weekly') NOT NULL,
            title VARCHAR(255) NOT NULL,
            description VARCHAR(255) NOT NULL,
            target_type VARCHAR(50) NOT NULL,
            target_value INT NOT NULL,
            reward_coins INT NOT NULL,
            reward_xp INT NOT NULL
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    ");
    echo "✅ Table 'quests' checked/created successfully.\n";

    // 2. Create user_quests table
    echo "-> Creating 'user_quests' table...\n";
    $db->exec("
        CREATE TABLE IF NOT EXISTS user_quests (
            id INT AUTO_INCREMENT PRIMARY KEY,
            user_id INT NOT NULL,
            quest_id INT NOT NULL,
            progress INT NOT NULL DEFAULT 0,
            is_claimed TINYINT NOT NULL DEFAULT 0,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            expires_at TIMESTAMP NOT NULL,
            UNIQUE KEY user_quest_expires (user_id, quest_id, expires_at),
            CONSTRAINT fk_user_quests_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
            CONSTRAINT fk_user_quests_quest FOREIGN KEY (quest_id) REFERENCES quests(id) ON DELETE CASCADE
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    ");
    echo "✅ Table 'user_quests' checked/created successfully.\n";

    // 3. Seed default quests (Truncate table first to allow updates)
    echo "-> Clearing old quests and seeding updated quests catalog...\n";
    $db->exec("DELETE FROM quests");

    $defaultQuests = [
        // Daily Quests (Objectifs rapides du jour)
        ['daily', 'Assiduité du jour', 'Répondez correctement à 10 questions en mode Solo', 'solo_questions', 10, 100, 30],
        ['daily', 'Client mystère', 'Ouvrez 1 coffre/booster dans la boutique', 'open_chests', 1, 100, 20],
        ['daily', 'Connexion quotidienne', 'Connectez-vous au site aujourd\'hui', 'login', 1, 50, 10],
        ['daily', 'Chasseur de pièces', 'Gagnez un total de 300 pièces aujourd\'hui', 'coins_earned', 300, 150, 40],
        
        // Weekly Quests (Gros objectifs de fond pour la semaine)
        ['weekly', 'Le banquier du QG', 'Gagnez un total de 7500 pièces cette semaine', 'coins_earned', 7500, 1500, 400],
        ['weekly', 'Collectionneur légendaire', 'Débloquez 12 nouvelles cartes uniques pour votre album', 'cards_unlocked', 12, 1200, 500],
        ['weekly', 'Grand maître du Mix', 'Répondez correctement à 250 questions en mode Solo', 'solo_questions', 250, 1000, 350],
        ['weekly', 'Magnat de la boutique', 'Ouvrez un total de 20 boosters dans la boutique', 'open_chests', 20, 1000, 300],
        ['weekly', 'Pilier du QG', 'Cumulez 5 connexions cette semaine', 'login', 5, 500, 200]
    ];

    $stmtInsert = $db->prepare("
        INSERT INTO quests (type, title, description, target_type, target_value, reward_coins, reward_xp) 
        VALUES (?, ?, ?, ?, ?, ?, ?)
    ");

    foreach ($defaultQuests as $q) {
        $stmtInsert->execute($q);
    }
    echo "✅ Quests catalog updated and seeded successfully.\n";

    echo "=== MIGRATION COMPLETED SUCCESSFULLY ===\n";

} catch (\PDOException $e) {
    echo "❌ Error during migration: " . $e->getMessage() . "\n";
    exit(1);
}
