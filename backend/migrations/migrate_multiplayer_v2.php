<?php
/**
 * Migration: Add per-player progression columns for independent multiplayer flow.
 * Run: php migrate_multiplayer_v2.php
 */

require_once __DIR__ . '/../src/Config/Database.php';

$db = \App\Config\Database::getConnection();

echo "=== Migration Multiplayer V2 ===\n\n";

// 1. Add current_question_index to lobby_players (per-player progress)
try {
    $db->exec("ALTER TABLE lobby_players ADD COLUMN current_question_index INT DEFAULT 0");
    echo "✅ lobby_players.current_question_index ajouté.\n";
} catch (PDOException $e) {
    if (strpos($e->getMessage(), 'Duplicate column') !== false) {
        echo "⏭️  lobby_players.current_question_index existe déjà.\n";
    } else {
        echo "❌ Erreur: " . $e->getMessage() . "\n";
    }
}

// 2. Add finished_at to lobby_players (timestamp when player completed all questions)
try {
    $db->exec("ALTER TABLE lobby_players ADD COLUMN finished_at BIGINT NULL DEFAULT NULL");
    echo "✅ lobby_players.finished_at ajouté.\n";
} catch (PDOException $e) {
    if (strpos($e->getMessage(), 'Duplicate column') !== false) {
        echo "⏭️  lobby_players.finished_at existe déjà.\n";
    } else {
        echo "❌ Erreur: " . $e->getMessage() . "\n";
    }
}

// 3. Add game_started_at to lobbies (server timestamp for synchronized countdown)
try {
    $db->exec("ALTER TABLE lobbies ADD COLUMN game_started_at BIGINT NULL DEFAULT NULL");
    echo "✅ lobbies.game_started_at ajouté.\n";
} catch (PDOException $e) {
    if (strpos($e->getMessage(), 'Duplicate column') !== false) {
        echo "⏭️  lobbies.game_started_at existe déjà.\n";
    } else {
        echo "❌ Erreur: " . $e->getMessage() . "\n";
    }
}

echo "\n=== Migration terminée ===\n";
