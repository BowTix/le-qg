<?php
/**
 * Database Migration: Add season_id, card_number and is_collector to cards table
 */

require_once __DIR__ . '/../src/Config/Database.php';

use App\Config\Database;

echo "=== MIGRATION: CARDS SEASONS & NUMBERING ===\n";

try {
    $db = Database::getConnection();

    // 1. Check existing columns
    $existingCols = [];
    $stmt = $db->query("SHOW COLUMNS FROM cards");
    while ($row = $stmt->fetch(\PDO::FETCH_ASSOC)) {
        $existingCols[] = $row['Field'];
    }

    // 2. Add season_id if not exists
    if (!in_array('season_id', $existingCols)) {
        echo "-> Adding column season_id...\n";
        $db->exec("ALTER TABLE cards ADD COLUMN season_id INT NOT NULL DEFAULT 1 AFTER card_set");
        echo "✅ season_id added.\n";
    } else {
        echo "ℹ️ Column season_id already exists.\n";
    }

    // 3. Add card_number if not exists
    if (!in_array('card_number', $existingCols)) {
        echo "-> Adding column card_number...\n";
        $db->exec("ALTER TABLE cards ADD COLUMN card_number INT NOT NULL DEFAULT 1 AFTER season_id");
        echo "✅ card_number added.\n";
    } else {
        echo "ℹ️ Column card_number already exists.\n";
    }

    // 4. Add is_collector if not exists
    if (!in_array('is_collector', $existingCols)) {
        echo "-> Adding column is_collector...\n";
        $db->exec("ALTER TABLE cards ADD COLUMN is_collector TINYINT(1) NOT NULL DEFAULT 0 AFTER card_number");
        echo "✅ is_collector added.\n";
    } else {
        echo "ℹ️ Column is_collector already exists.\n";
    }

    // 5. Add indexes if not exists
    try {
        $db->exec("CREATE INDEX idx_cards_season_number ON cards (season_id, card_number)");
        echo "✅ Index idx_cards_season_number created.\n";
    } catch (\PDOException $e) {
        // Index may already exist
    }

    try {
        $db->exec("CREATE INDEX idx_cards_collector ON cards (is_collector)");
        echo "✅ Index idx_cards_collector created.\n";
    } catch (\PDOException $e) {
        // Index may already exist
    }

    // 6. Ordered list of Season 1 cards (1 to 100)
    $season1CardIds = [
        // Set 1: Les Célébrités (1-10)
        'card_einstein', 'card_curie', 'card_napoleon', 'card_cleopatre', 'card_soleil',
        'card_da_vinci', 'card_shakespeare', 'card_gandhi', 'card_mozart', 'card_socrates',

        // Set 2: Les Monuments (11-20)
        'card_eiffel', 'card_muraille', 'card_pyramides', 'card_liberte', 'card_colisee',
        'card_taj_mahal', 'card_machu_picchu', 'card_petra', 'card_big_ben', 'card_christ_redempteur',

        // Set 3: Les Voitures (21-30)
        'card_f40', 'card_chiron', 'card_911', 'card_fifix', 'card_mustang',
        'card_beetle', 'card_supra', 'card_db5', 'card_miata', 'card_aventador',

        // Set 4: L'Espace et l'Astronomie (31-40)
        'card_apollo_11', 'card_mars', 'card_trou_noir', 'card_curiosity', 'card_voie_lactee',
        'card_supernova', 'card_iss', 'card_telescope_hubble', 'card_etoile_filante', 'card_lune',

        // Set 5: Mythologie et Légendes (41-50)
        'card_zeus', 'card_anubis', 'card_odin', 'card_kraken', 'card_phenix',
        'card_minotaure', 'card_satyre', 'card_excalibur', 'card_mjolnir', 'card_pegase',

        // Set 6: Animaux et Biodiversité (51-60)
        'card_guepard', 'card_orque', 'card_tardigrade', 'card_trex', 'card_dodo',
        'card_megalodon', 'card_tigre_blanc', 'card_chat_gouttiere', 'card_pigeon', 'card_panda',

        // Set 7: Gastronomie du Monde (61-70)
        'card_pizza', 'card_sushi', 'card_tacos', 'card_truffe', 'card_safran',
        'card_wagyu', 'card_caviar', 'card_croissant', 'card_chips', 'card_ramen',

        // Set 8: Cristaux et Minéraux (71-80)
        'card_quartz', 'card_amethyste', 'card_rubis_gem', 'card_diamant', 'card_meteorite',
        'card_emeraude_gem', 'card_obsidienne', 'card_jade', 'card_charbon', 'card_or_gem',

        // Set 9: Phénomènes Naturels (81-90)
        'card_orage', 'card_arc_en_ciel_phenomene', 'card_tornade', 'card_tsunami', 'card_volcan',
        'card_aurore', 'card_seisme', 'card_eclipse', 'card_geyser', 'card_avalanche',

        // Set 10: Les Grandes Inventions (91-100)
        'card_roue', 'card_imprimerie', 'card_ampoule', 'card_avion', 'card_ordinateur',
        'card_internet', 'card_ia', 'card_feu', 'card_boussole', 'card_telephone'
    ];

    echo "-> Numbering Season 1 cards from 1 to 100...\n";
    $stmtUpdate = $db->prepare("
        UPDATE cards 
        SET season_id = 1, card_number = ?, is_collector = 0 
        WHERE id = ?
    ");

    $updatedCount = 0;
    foreach ($season1CardIds as $index => $cardId) {
        $num = $index + 1;
        $stmtUpdate->execute([$num, $cardId]);
        if ($stmtUpdate->rowCount() > 0) {
            $updatedCount++;
        }
    }

    echo "✅ Successfully assigned card numbers 001/100 to 100/100 for Season 1 ($updatedCount cards updated).\n";
    echo "=== MIGRATION COMPLETED SUCCESSFULLY ===\n";

} catch (\PDOException $e) {
    echo "❌ Database error during migration: " . $e->getMessage() . "\n";
    exit(1);
}
