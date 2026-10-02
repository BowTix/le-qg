<?php
require_once __DIR__ . '/../src/Config/Database.php';

$db = \App\Config\Database::getConnection();

// 1. Ensure craft_stars exists in users
try {
    $db->exec("ALTER TABLE users ADD COLUMN craft_stars INT NOT NULL DEFAULT 0 AFTER coins");
    echo "Column craft_stars added.\n";
} catch (Exception $e) {
    echo "craft_stars column already exists or: " . $e->getMessage() . "\n";
}

// 2. Insert season 1 master cosmetics
$cosmetics = [
    [
        'id' => 'title_master_s1',
        'name' => 'Maître du QG — Saison 1',
        'item_type' => 'title',
        'item_value' => 'Maître du QG — Saison 1',
        'rarity' => 'legendary',
        'is_exclusive' => 1
    ],
    [
        'id' => 'border_holographic',
        'name' => 'Bordure Holographique',
        'item_type' => 'border',
        'item_value' => 'border-holographic',
        'rarity' => 'legendary',
        'is_exclusive' => 1
    ]
];

$stmt = $db->prepare("
    INSERT INTO cosmetics (id, name, item_type, item_value, rarity, is_exclusive) 
    VALUES (?, ?, ?, ?, ?, ?)
    ON DUPLICATE KEY UPDATE name = VALUES(name)
");

foreach ($cosmetics as $c) {
    $stmt->execute([$c['id'], $c['name'], $c['item_type'], $c['item_value'], $c['rarity'], $c['is_exclusive']]);
    echo "Cosmetic {$c['id']} ensured.\n";
}

// 3. Ensure secret card 101 exists
$secretCard = [
    'id' => 'card_secret_101',
    'name' => 'Le Grand Architecte',
    'rarity' => 'ultime',
    'card_set' => 'Hors-Série',
    'season_id' => 1,
    'card_number' => 101,
    'is_collector' => 1,
    'description' => 'Carte secrète prestige décernée aux maîtres ayant complété l\'intégralité des 100 cartes de la Saison 1.',
    'image_url' => '/assets/cards/secret_101.jpg'
];

$stmtCard = $db->prepare("
    INSERT INTO cards (id, name, rarity, card_set, season_id, card_number, is_collector, description, image_url)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON DUPLICATE KEY UPDATE name = VALUES(name)
");
$stmtCard->execute([
    $secretCard['id'],
    $secretCard['name'],
    $secretCard['rarity'],
    $secretCard['card_set'],
    $secretCard['season_id'],
    $secretCard['card_number'],
    $secretCard['is_collector'],
    $secretCard['description'],
    $secretCard['image_url']
]);
echo "Secret card 101 ensured.\n";

echo "Migration finished.\n";
