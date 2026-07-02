<?php
/**
 * Database Migration: Elo Column Addition
 */

require_once __DIR__ . '/../src/Config/Database.php';

use App\Config\Database;

echo "=== STARTING ELO MIGRATION ===\n";

try {
    $db = Database::getConnection();

    // Add elo column to users table
    echo "-> Adding 'elo' column to users table...\n";
    $db->exec("
        ALTER TABLE users 
        ADD COLUMN elo INT NOT NULL DEFAULT 1000
    ");
    echo "✅ Success adding elo column!\n";
} catch (\PDOException $e) {
    echo "⚠️ Info/Warning (Column might already exist): " . $e->getMessage() . "\n";
}

try {
    $db = Database::getConnection();

    // Add elo_change column to lobby_players table
    echo "-> Adding 'elo_change' column to lobby_players table...\n";
    $db->exec("
        ALTER TABLE lobby_players 
        ADD COLUMN elo_change INT NOT NULL DEFAULT 0
    ");
    echo "✅ Success adding elo_change column!\n";
} catch (\PDOException $e) {
    echo "⚠️ Info/Warning (Column might already exist): " . $e->getMessage() . "\n";
}

echo "=== ELO MIGRATION COMPLETED ===\n";
