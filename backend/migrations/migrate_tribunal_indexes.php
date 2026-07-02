<?php
/**
 * Database Migration: Add missing indexes on tribunal_submissions
 *
 * Problem: checkTribunalStateTransition() and status() run several
 * queries like:
 *   WHERE lobby_id = ? AND round_number = ?
 *   WHERE lobby_id = ? AND round_number = ? AND user_id = ?
 *   WHERE lobby_id = ? AND round_number = ? AND voted_for_user_id IS NOT NULL
 * on EVERY poll, for EVERY player, every 2 seconds.
 *
 * Without a composite index, MySQL does a full table scan on
 * tribunal_submissions for each of these queries. This gets worse
 * as more games are played and the table grows.
 */

require_once __DIR__ . '/../src/Config/Database.php';

use App\Config\Database;

echo "=== ADDING TRIBUNAL_SUBMISSIONS INDEXES ===\n";

try {
    $db = Database::getConnection();

    // Composite index covering (lobby_id, round_number) lookups,
    // and (lobby_id, round_number, user_id) lookups since user_id
    // is appended. Also speeds up the "has anyone voted" count.
    $db->exec("
        CREATE INDEX idx_tribunal_lobby_round
        ON tribunal_submissions (lobby_id, round_number, user_id)
    ");
    echo "✅ Created idx_tribunal_lobby_round (lobby_id, round_number, user_id)\n";
} catch (\PDOException $e) {
    echo "⚠️ Info/Warning: " . $e->getMessage() . "\n";
}

try {
    $db = Database::getConnection();

    // Speeds up: SELECT COUNT(*) WHERE lobby_id = ? AND round_number = ?
    // AND voted_for_user_id IS NOT NULL
    $db->exec("
        CREATE INDEX idx_tribunal_voted
        ON tribunal_submissions (lobby_id, round_number, voted_for_user_id)
    ");
    echo "✅ Created idx_tribunal_voted (lobby_id, round_number, voted_for_user_id)\n";
} catch (\PDOException $e) {
    echo "⚠️ Info/Warning: " . $e->getMessage() . "\n";
}

try {
    $db = Database::getConnection();

    // lobby_players is interrogated by lobby_id constantly too;
    // FK already gives an index on lobby_id alone, this is just
    // a safety net in case it's missing on older schemas.
    $db->exec("
        CREATE INDEX idx_lobby_players_lobby
        ON lobby_players (lobby_id)
    ");
    echo "✅ Ensured idx_lobby_players_lobby (lobby_id)\n";
} catch (\PDOException $e) {
    echo "⚠️ Info/Warning (likely already exists via FK): " . $e->getMessage() . "\n";
}

echo "=== MIGRATION COMPLETED ===\n";