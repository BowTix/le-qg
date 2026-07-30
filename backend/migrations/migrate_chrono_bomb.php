<?php
/**
 * Migration: Chrono-Bomb multiplayer mode.
 * Run: php backend/migrations/migrate_chrono_bomb.php
 */

require_once __DIR__ . '/../src/Config/Database.php';

use App\Config\Database;

$db = Database::getConnection();

echo "=== Migration Chrono-Bomb ===\n";

// Keep this extensible: older installations may still use a game-mode ENUM.
$db->exec("ALTER TABLE lobbies MODIFY COLUMN game_mode VARCHAR(50) NOT NULL DEFAULT 'kculture'");

$columns = [
    "ALTER TABLE lobbies ADD COLUMN chrono_prompt_id INT DEFAULT NULL",
    "ALTER TABLE lobbies ADD COLUMN chrono_current_player_id INT DEFAULT NULL",
    "ALTER TABLE lobbies ADD COLUMN chrono_explodes_at BIGINT DEFAULT NULL",
    "ALTER TABLE lobbies ADD COLUMN chrono_phase VARCHAR(20) DEFAULT NULL",
    "ALTER TABLE lobbies ADD COLUMN chrono_phase_ends_at BIGINT DEFAULT NULL",
    "ALTER TABLE lobbies ADD COLUMN chrono_round INT NOT NULL DEFAULT 0",
    "ALTER TABLE lobbies ADD COLUMN chrono_last_exploded_user_id INT DEFAULT NULL",
    "ALTER TABLE lobby_players ADD COLUMN chrono_lives TINYINT NOT NULL DEFAULT 3",
    "ALTER TABLE lobby_players ADD COLUMN chrono_turn_order INT DEFAULT NULL",
];

foreach ($columns as $sql) {
    try {
        $db->exec($sql);
        echo "+ " . $sql . "\n";
    } catch (PDOException $e) {
        if (stripos($e->getMessage(), 'Duplicate column') === false) {
            throw $e;
        }
    }
}

$db->exec("
    CREATE TABLE IF NOT EXISTS chrono_bomb_prompts (
        id INT AUTO_INCREMENT PRIMARY KEY,
        prompt_text VARCHAR(255) NOT NULL,
        answers_json JSON NOT NULL,
        is_active TINYINT(1) NOT NULL DEFAULT 1,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
");

$db->exec("
    CREATE TABLE IF NOT EXISTS chrono_bomb_answers (
        id INT AUTO_INCREMENT PRIMARY KEY,
        lobby_id INT NOT NULL,
        round_number INT NOT NULL,
        prompt_id INT NOT NULL,
        user_id INT NOT NULL,
        normalized_answer VARCHAR(180) NOT NULL,
        display_answer VARCHAR(180) NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE KEY uniq_chrono_answer (lobby_id, round_number, normalized_answer),
        KEY idx_chrono_lobby_round (lobby_id, round_number),
        FOREIGN KEY (lobby_id) REFERENCES lobbies(id) ON DELETE CASCADE,
        FOREIGN KEY (prompt_id) REFERENCES chrono_bomb_prompts(id) ON DELETE CASCADE,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
");

$count = intval($db->query("SELECT COUNT(*) FROM chrono_bomb_prompts")->fetchColumn());
if ($count === 0) {
    $prompts = [
        ['Une marque de voiture allemande', [
            ['value' => 'BMW', 'aliases' => ['bmw']],
            ['value' => 'Audi', 'aliases' => []],
            ['value' => 'Mercedes-Benz', 'aliases' => ['mercedes']],
            ['value' => 'Volkswagen', 'aliases' => ['vw']],
            ['value' => 'Porsche', 'aliases' => []],
            ['value' => 'Opel', 'aliases' => []],
        ]],
        ['Un film avec Brad Pitt', [
            ['value' => 'Fight Club', 'aliases' => []],
            ['value' => 'Seven', 'aliases' => ['se7en']],
            ['value' => 'Troie', 'aliases' => ['troy']],
            ['value' => 'Ocean Eleven', 'aliases' => ["ocean's eleven", 'oceans eleven']],
            ['value' => 'Inglourious Basterds', 'aliases' => []],
            ['value' => 'World War Z', 'aliases' => []],
            ['value' => 'Bullet Train', 'aliases' => []],
            ['value' => 'Once Upon a Time in Hollywood', 'aliases' => []],
        ]],
        ['Un pays qui commence par la lettre B', [
            ['value' => 'Bahamas', 'aliases' => ['les bahamas']],
            ['value' => 'Bahreïn', 'aliases' => ['bahrein']],
            ['value' => 'Bangladesh', 'aliases' => []],
            ['value' => 'Barbade', 'aliases' => ['la barbade']],
            ['value' => 'Belgique', 'aliases' => ['la belgique']],
            ['value' => 'Belize', 'aliases' => []],
            ['value' => 'Bénin', 'aliases' => ['benin']],
            ['value' => 'Bhoutan', 'aliases' => []],
            ['value' => 'Biélorussie', 'aliases' => ['bielorussie', 'belarus']],
            ['value' => 'Bolivie', 'aliases' => []],
            ['value' => 'Bosnie-Herzégovine', 'aliases' => ['bosnie']],
            ['value' => 'Botswana', 'aliases' => []],
            ['value' => 'Brésil', 'aliases' => ['bresil']],
            ['value' => 'Brunei', 'aliases' => []],
            ['value' => 'Bulgarie', 'aliases' => []],
            ['value' => 'Burkina Faso', 'aliases' => []],
            ['value' => 'Burundi', 'aliases' => []],
        ]],
        ['Un réseau social', [
            ['value' => 'Instagram', 'aliases' => ['insta']],
            ['value' => 'TikTok', 'aliases' => []],
            ['value' => 'Facebook', 'aliases' => []],
            ['value' => 'X', 'aliases' => ['twitter']],
            ['value' => 'Snapchat', 'aliases' => ['snap']],
            ['value' => 'Reddit', 'aliases' => []],
            ['value' => 'LinkedIn', 'aliases' => []],
            ['value' => 'Pinterest', 'aliases' => []],
            ['value' => 'Threads', 'aliases' => []],
            ['value' => 'Bluesky', 'aliases' => []],
        ]],
        ['Un sport avec un ballon', [
            ['value' => 'Football', 'aliases' => ['foot', 'soccer']],
            ['value' => 'Basket-ball', 'aliases' => ['basket', 'basketball']],
            ['value' => 'Handball', 'aliases' => ['hand']],
            ['value' => 'Rugby', 'aliases' => []],
            ['value' => 'Volley-ball', 'aliases' => ['volley', 'volleyball']],
            ['value' => 'Water-polo', 'aliases' => ['water polo']],
            ['value' => 'Baseball', 'aliases' => []],
            ['value' => 'Tennis', 'aliases' => []],
        ]],
        ['Une capitale européenne', [
            ['value' => 'Paris', 'aliases' => []],
            ['value' => 'Londres', 'aliases' => ['london']],
            ['value' => 'Madrid', 'aliases' => []],
            ['value' => 'Rome', 'aliases' => ['roma']],
            ['value' => 'Berlin', 'aliases' => []],
            ['value' => 'Lisbonne', 'aliases' => ['lisboa']],
            ['value' => 'Bruxelles', 'aliases' => ['brussels']],
            ['value' => 'Amsterdam', 'aliases' => []],
            ['value' => 'Vienne', 'aliases' => ['vienna']],
            ['value' => 'Prague', 'aliases' => ['praha']],
            ['value' => 'Varsovie', 'aliases' => ['warsaw']],
            ['value' => 'Athènes', 'aliases' => ['athenes', 'athens']],
        ]],
    ];

    $insert = $db->prepare("INSERT INTO chrono_bomb_prompts (prompt_text, answers_json) VALUES (?, ?)");
    foreach ($prompts as [$prompt, $answers]) {
        $insert->execute([$prompt, json_encode($answers, JSON_UNESCAPED_UNICODE)]);
    }
    echo "Prompts de départ ajoutés.\n";
}

echo "=== Migration terminée ===\n";
