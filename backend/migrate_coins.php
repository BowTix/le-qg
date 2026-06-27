<?php
/**
 * Migration: Add 'coins' column to users table for virtual shop currency.
 * Run: php migrate_coins.php
 */

require_once __DIR__ . '/src/Config/Database.php';

$db = \App\Config\Database::getConnection();

echo "=== Migration Virtual Coins ===\n\n";

try {
    $db->exec("ALTER TABLE users ADD COLUMN coins INT NOT NULL DEFAULT 0");
    echo "✅ users.coins ajouté avec succès.\n";
} catch (PDOException $e) {
    if (strpos($e->getMessage(), 'Duplicate column') !== false) {
        echo "⏭️  users.coins existe déjà.\n";
    } else {
        echo "❌ Erreur: " . $e->getMessage() . "\n";
    }
}

echo "\n=== Migration terminée ===\n";
