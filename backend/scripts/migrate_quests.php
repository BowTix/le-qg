<?php
require_once __DIR__ . '/../src/Config/Database.php';

$db = App\Config\Database::getConnection();

echo "1. Checking/adding 'pool' column in quests table...\n";
$cols = $db->query("SHOW COLUMNS FROM quests LIKE 'pool'")->fetchAll();
if (empty($cols)) {
    $db->exec("ALTER TABLE quests ADD COLUMN pool VARCHAR(10) NULL AFTER type");
    echo "Added 'pool' column.\n";
} else {
    echo "'pool' column already exists.\n";
}

echo "2. Seeding quests according to Section 5 specification...\n";

// Disable foreign key checks temporarily to re-seed quests
$db->exec("SET FOREIGN_KEY_CHECKS = 0");
$db->exec("TRUNCATE TABLE quests");
$db->exec("TRUNCATE TABLE user_quests");
$db->exec("SET FOREIGN_KEY_CHECKS = 1");

$quests = [
    // Pool A — Routine & Collection (Daily)
    [
        'type' => 'daily',
        'pool' => 'A',
        'title' => 'Client Mystère',
        'description' => 'Ouvrir 1 booster dans la boutique',
        'target_type' => 'open_chests',
        'target_value' => 1,
        'reward_coins' => 60,
        'reward_xp' => 20
    ],
    [
        'type' => 'daily',
        'pool' => 'A',
        'title' => 'Recycleur du Jour',
        'description' => 'Obtenir ou recycler au moins 2 doublons',
        'target_type' => 'recycle_duplicates',
        'target_value' => 2,
        'reward_coins' => 60,
        'reward_xp' => 20
    ],
    [
        'type' => 'daily',
        'pool' => 'A',
        'title' => 'Chasseur de Pièces',
        'description' => 'Gagner un total de 180 coins sur la journée',
        'target_type' => 'coins_earned',
        'target_value' => 180,
        'reward_coins' => 70,
        'reward_xp' => 25
    ],
    [
        'type' => 'daily',
        'pool' => 'A',
        'title' => "Plein d'Expérience",
        'description' => 'Engranger au moins 80 XP',
        'target_type' => 'xp_earned',
        'target_value' => 80,
        'reward_coins' => 60,
        'reward_xp' => 20
    ],

    // Pool B — Solo & Casse-Tête (Daily)
    [
        'type' => 'daily',
        'pool' => 'B',
        'title' => 'Rituel Quotidien',
        'description' => 'Compléter le Quiz du Jour ET le Mot Mystère',
        'target_type' => 'daily_rituals',
        'target_value' => 2,
        'reward_coins' => 75,
        'reward_xp' => 30
    ],
    [
        'type' => 'daily',
        'pool' => 'B',
        'title' => 'Esprit Logique',
        'description' => 'Résoudre 1 grille du jour (Sudoku, Queens ou Shikaku)',
        'target_type' => 'daily_logic_grid',
        'target_value' => 1,
        'reward_coins' => 65,
        'reward_xp' => 25
    ],
    [
        'type' => 'daily',
        'pool' => 'B',
        'title' => 'Culture Express',
        'description' => 'Répondre correctement à 15 questions en Culture Pop',
        'target_type' => 'solo_questions',
        'target_value' => 15,
        'reward_coins' => 70,
        'reward_xp' => 25
    ],
    [
        'type' => 'daily',
        'pool' => 'B',
        'title' => 'Maître des Mots',
        'description' => 'Trouver le Mot Mystère en 4 essais ou moins',
        'target_type' => 'mystery_word_fast',
        'target_value' => 1,
        'reward_coins' => 75,
        'reward_xp' => 30
    ],
    [
        'type' => 'daily',
        'pool' => 'B',
        'title' => 'Sans-Faute',
        'description' => 'Réaliser un 3/3 parfait sur le Quiz du Jour',
        'target_type' => 'perfect_quiz',
        'target_value' => 1,
        'reward_coins' => 75,
        'reward_xp' => 30
    ],

    // Pool C — Multijoueur & Défi Libre (Daily)
    [
        'type' => 'daily',
        'pool' => 'C',
        'title' => 'Baptême du Feu',
        'description' => "Participer à 2 parties dans l'Arène (Chrono-Bomb ou Quiz Flash)",
        'target_type' => 'arena_games',
        'target_value' => 2,
        'reward_coins' => 70,
        'reward_xp' => 25
    ],
    [
        'type' => 'daily',
        'pool' => 'C',
        'title' => 'Duel au Sommet',
        'description' => 'Remporter 1 duel en Quiz Flash 1v1',
        'target_type' => 'quiz_flash_wins',
        'target_value' => 1,
        'reward_coins' => 75,
        'reward_xp' => 30
    ],
    [
        'type' => 'daily',
        'pool' => 'C',
        'title' => 'Sang-Froid',
        'description' => 'Survivre à au moins 4 tours dans une manche de Chrono-Bomb',
        'target_type' => 'chrono_bomb_survive',
        'target_value' => 1,
        'reward_coins' => 65,
        'reward_xp' => 25
    ],
    [
        'type' => 'daily',
        'pool' => 'C',
        'title' => 'Entraînement Intensif',
        'description' => "Terminer 2 grilles d'entraînement au choix",
        'target_type' => 'practice_grids',
        'target_value' => 2,
        'reward_coins' => 65,
        'reward_xp' => 25
    ],

    // Pool 1 — Volume & Économie (Weekly)
    [
        'type' => 'weekly',
        'pool' => '1',
        'title' => 'Grisbi Hebdomadaire',
        'description' => 'Amasser un total cumulé de 2 000 coins',
        'target_type' => 'coins_earned',
        'target_value' => 2000,
        'reward_coins' => 380,
        'reward_xp' => 250
    ],
    [
        'type' => 'weekly',
        'pool' => '1',
        'title' => 'Fidélité au Poste',
        'description' => 'Se connecter et jouer lors de 5 jours distincts',
        'target_type' => 'login_days',
        'target_value' => 5,
        'reward_coins' => 360,
        'reward_xp' => 220
    ],
    [
        'type' => 'weekly',
        'pool' => '1',
        'title' => "Frénésie d'Ouverture",
        'description' => 'Ouvrir 10 boosters au cours de la semaine',
        'target_type' => 'open_chests',
        'target_value' => 10,
        'reward_coins' => 400,
        'reward_xp' => 260
    ],

    // Pool 2 — Performance Solo & Réflexion (Weekly)
    [
        'type' => 'weekly',
        'pool' => '2',
        'title' => 'Marathonien du Savoir',
        'description' => 'Répondre correctement à 100 questions en mode Solo',
        'target_type' => 'solo_questions',
        'target_value' => 100,
        'reward_coins' => 370,
        'reward_xp' => 240
    ],
    [
        'type' => 'weekly',
        'pool' => '2',
        'title' => 'Grand Maître de la Semaine',
        'description' => 'Compléter 5 Quiz du Jour et 5 Mots Mystères',
        'target_type' => 'daily_rituals',
        'target_value' => 10,
        'reward_coins' => 400,
        'reward_xp' => 270
    ],
    [
        'type' => 'weekly',
        'pool' => '2',
        'title' => 'Architecte des Grilles',
        'description' => 'Venir à bout de 8 grilles de réflexion (tous modes confondus)',
        'target_type' => 'all_logic_grids',
        'target_value' => 8,
        'reward_coins' => 350,
        'reward_xp' => 230
    ],

    // Pool 3 — Arène & Collection Avancée (Weekly)
    [
        'type' => 'weekly',
        'pool' => '3',
        'title' => "Terreur de l'Arène",
        'description' => 'Remporter 6 victoires en multijoueur (Quiz Flash ou Chrono-Bomb)',
        'target_type' => 'arena_wins',
        'target_value' => 6,
        'reward_coins' => 400,
        'reward_xp' => 280
    ],
    [
        'type' => 'weekly',
        'pool' => '3',
        'title' => 'Artisan Émérite',
        'description' => "Fabriquer au moins 1 carte manquante dans l'Atelier d'Étoiles",
        'target_type' => 'craft_card',
        'target_value' => 1,
        'reward_coins' => 350,
        'reward_xp' => 240
    ],
    [
        'type' => 'weekly',
        'pool' => '3',
        'title' => 'Grand Tirage',
        'description' => 'Obtenir 25 cartes au total (nouvelles ou doublons)',
        'target_type' => 'cards_obtained',
        'target_value' => 25,
        'reward_coins' => 360,
        'reward_xp' => 250
    ],
    [
        'type' => 'weekly',
        'pool' => '3',
        'title' => 'Contributeur du QG',
        'description' => 'Proposer 3 questions validées pour la communauté',
        'target_type' => 'questions_submitted',
        'target_value' => 3,
        'reward_coins' => 380,
        'reward_xp' => 250
    ]
];

$stmt = $db->prepare("
    INSERT INTO quests (type, pool, title, description, target_type, target_value, reward_coins, reward_xp)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
");

foreach ($quests as $q) {
    $stmt->execute([
        $q['type'],
        $q['pool'],
        $q['title'],
        $q['description'],
        $q['target_type'],
        $q['target_value'],
        $q['reward_coins'],
        $q['reward_xp']
    ]);
}

echo "Successfully seeded " . count($quests) . " quests!\n";
