<?php
/**
 * Database Migration: Seeding shop items and collectible cards catalog to the database
 */

require_once __DIR__ . '/../src/Config/Database.php';

use App\Config\Database;

echo "=== STARTING CATALOG MIGRATION TO DATABASE ===\n";

try {
    $db = Database::getConnection();

    // 1. Create cards table
    echo "-> Creating cards table...\n";
    $db->exec("
        CREATE TABLE IF NOT EXISTS cards (
            id VARCHAR(50) PRIMARY KEY,
            name VARCHAR(100) NOT NULL,
            rarity VARCHAR(20) NOT NULL,
            card_set VARCHAR(50) NOT NULL,
            description TEXT DEFAULT NULL,
            image_url VARCHAR(255) DEFAULT NULL
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    ");
    echo "✅ Success creating cards table!\n";

    // 2. Create cosmetics table
    echo "-> Creating cosmetics table...\n";
    $db->exec("
        CREATE TABLE IF NOT EXISTS cosmetics (
            id VARCHAR(50) PRIMARY KEY,
            item_type VARCHAR(20) NOT NULL,
            item_value VARCHAR(100) NOT NULL,
            name VARCHAR(100) NOT NULL,
            price INT DEFAULT NULL,
            rarity VARCHAR(20) NOT NULL,
            is_exclusive TINYINT(1) NOT NULL DEFAULT 0
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    ");
    echo "✅ Success creating cosmetics table!\n";

    // 3. Add foreign key constraint to user_cards if not already exists
    echo "-> Adding foreign key constraints to user_cards table...\n";
    try {
        $db->exec("
            ALTER TABLE user_cards 
            ADD CONSTRAINT fk_user_cards_card 
            FOREIGN KEY (card_id) REFERENCES cards(id) ON DELETE CASCADE
        ");
        echo "✅ Success adding foreign key constraint!\n";
    } catch (\PDOException $e) {
        echo "⚠️ Info/Warning (FK might already exist): " . $e->getMessage() . "\n";
    }

} catch (\PDOException $e) {
    echo "❌ Database error during table creation: " . $e->getMessage() . "\n";
    exit(1);
}

// 4. Seed Data
try {
    $db->beginTransaction();

    // Clear old catalog data to allow clean re-seeding
    $db->exec("DELETE FROM cosmetics");
    $db->exec("DELETE FROM cards");

    echo "-> Seeding cosmetics...\n";
    $cosmeticsData = [
        // Pseudo colors
        ['color_red', 'color', '#ef4444', 'Rouge Flamboyant', 200, 'common', 0],
        ['color_blue', 'color', '#3b82f6', 'Bleu Impérial', 200, 'common', 0],
        ['color_green', 'color', '#10b981', 'Vert Émeraude', 200, 'common', 0],
        ['color_purple', 'color', '#8b5cf6', 'Violet Mystique', 400, 'rare', 0],
        ['color_orange', 'color', '#f97316', 'Orange Électrique', 400, 'rare', 0],
        ['color_pink', 'color', '#ec4899', 'Rose Néon', 600, 'rare', 0],
        ['color_gold', 'color', '#eab308', 'Doré Royal', 1000, 'legendary', 0],
        ['color_rainbow', 'color', 'rainbow', 'Arc-en-ciel (Animé)', null, 'legendary', 1],

        // Avatar borders
        ['border_silver', 'border', 'border-silver', 'Bordure Argentée', 300, 'rare', 0],
        ['border_gold', 'border', 'border-gold', 'Bordure Dorée', 800, 'legendary', 0],
        ['border_neon', 'border', 'border-neon', 'Bordure Néon', 1200, 'legendary', 0],
        ['border_fire', 'border', 'border-fire', 'Bordure de Feu', 1500, 'legendary', 0],
        ['border_cosmic', 'border', 'border-cosmic', 'Bordure Cosmique (Animée)', null, 'legendary', 1],

        // Titles
        ['title_novice', 'title', 'Le Novice', 'Le Novice', 100, 'common', 0],
        ['title_encyclopedia', 'title', 'L\'Encyclopédie', 'L\'Encyclopédie', 450, 'rare', 0],
        ['title_judge', 'title', 'Le Magistrat', 'Le Magistrat', 500, 'rare', 0],
        ['title_imposteur', 'title', 'L\'Imposteur', 'L\'Imposteur', 500, 'rare', 0],
        ['title_invincible', 'title', 'L\'Invincible', 'L\'Invincible', 800, 'legendary', 0],
        ['title_brain', 'title', 'Le Cerveau', 'Le Cerveau', 1000, 'legendary', 0],
        ['title_historical', 'title', 'Le Génie Historique', 'Le Génie Historique', null, 'legendary', 1]
    ];

    $stmtCos = $db->prepare("
        INSERT INTO cosmetics (id, item_type, item_value, name, price, rarity, is_exclusive) 
        VALUES (?, ?, ?, ?, ?, ?, ?)
    ");
    foreach ($cosmeticsData as $item) {
        $stmtCos->execute($item);
    }
    echo "✅ Seeded " . count($cosmeticsData) . " cosmetics.\n";

    echo "-> Seeding collectible cards...\n";
    $cardsData = [
        ['card_novice', 'Le Débutant', 'common', 'Les Clichés', 'Un joueur fraîchement arrivé sur Le QG, plein d\'ambitions.', null],
        ['card_rubis', 'Rubis', 'common', 'Les Couleurs', 'La couleur rouge, chaude et intense, symbole de passion.', null],
        ['card_saphir', 'Saphir', 'common', 'Les Couleurs', 'Le bleu profond de la sagesse et de la tranquillité.', null],
        ['card_emeraude', 'Émeraude', 'common', 'Les Couleurs', 'Un éclat vert brillant représentant la croissance et l\'espoir.', null],
        ['card_einstein', 'Albert Einstein', 'rare', 'Les Célébrités', 'Le grand théoricien de la relativité générale.', null],
        ['card_napoleon', 'Napoléon Bonaparte', 'rare', 'Les Célébrités', 'Empereur des Français et grand stratège militaire.', null],
        ['card_juge', 'Le Juge', 'rare', 'Les Modes', 'Celui qui tranche impitoyablement dans Le Tribunal.', null],
        ['card_neon', 'Lumière Néon', 'rare', 'Les Clichés', 'Le rose électrique et vibrant des arcades rétro.', null],
        ['card_imposteur', 'L\'Imposteur', 'legendary', 'Les Modes', 'Un agent infiltré qui tente de saboter la cohésion du groupe.', null],
        ['card_curie', 'Marie Curie', 'legendary', 'Les Célébrités', 'Pionnière de la radioactivité et double lauréate du Prix Nobel.', null],
        ['card_cleopatre', 'Cléopâtre', 'legendary', 'Les Célébrités', 'La légendaire reine d\'Égypte antique au charisme captivant.', null],
        ['card_soleil', 'Le Roi Soleil', 'legendary', 'Les Célébrités', 'Louis XIV, le monarque bâtisseur de Versailles.', null],
        ['card_cyber', 'Cyberpunk', 'legendary', 'Les Clichés', 'L\'esthétique futuriste high-tech sous la pluie acide.', null],
        ['card_dragon', 'Le Dragon', 'legendary', 'Les Clichés', 'Une créature de feu mythologique et destructrice.', null],
        ['card_astronaute', 'L\'Astronaute', 'legendary', 'Les Clichés', 'Un explorateur spatial perdu dans l\'immensité du vide.', null],
        ['card_rainbow', 'Arc-en-ciel', 'legendary', 'Les Clichés', 'Le spectre lumineux complet animé en continu.', null],
        ['card_eiffel', 'Tour Eiffel', 'rare', 'Les Monuments', 'La dame de fer qui domine fièrement le ciel de Paris.', null],
        ['card_muraille', 'Grande Muraille', 'rare', 'Les Monuments', 'Une fortification défensive millénaire visible de l\'espace.', null],
        ['card_pyramides', 'Pyramides de Gizeh', 'rare', 'Les Monuments', 'Les tombeaux géants des pharaons de l\'Ancien Empire.', null],
        ['card_liberte', 'Statue de la Liberté', 'rare', 'Les Monuments', 'Symbole universel de liberté érigé dans la baie de New York.', null],
        ['card_f40', 'Ferrari F40', 'legendary', 'Les Voitures', 'La supercar italienne brute légendaire des années 80.', null],
        ['card_chiron', 'Bugatti Chiron', 'legendary', 'Les Voitures', 'Un monstre de puissance moderne atteignant les 400 km/h.', null],
        ['card_911', 'Porsche 911', 'legendary', 'Les Voitures', 'La silhouette indémodable de la sportive allemande par excellence.', null],
        ['card_tesla', 'Tesla Roadster', 'legendary', 'Les Voitures', 'L\'accélération électrique foudroyante qui défie les lois physiques.', null]
    ];

    $stmtCard = $db->prepare("
        INSERT INTO cards (id, name, rarity, card_set, description, image_url) 
        VALUES (?, ?, ?, ?, ?, ?)
    ");
    foreach ($cardsData as $card) {
        $stmtCard->execute($card);
    }
    echo "✅ Seeded " . count($cardsData) . " cards.\n";

    $db->commit();
    echo "=== CATALOG MIGRATION COMPLETED SUCCESSFULLY ===\n";

} catch (Exception $e) {
    if (isset($db) && $db->inTransaction()) {
        $db->rollBack();
    }
    echo "❌ Error seeding data: " . $e->getMessage() . "\n";
    exit(1);
}
