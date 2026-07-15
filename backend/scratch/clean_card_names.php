<?php
/**
 * Command-line utility to clean prefixes from card names (e.g. "L'Aurore Boréale" -> "Aurore Boréale").
 * Usage: php backend/scratch/clean_card_names.php [--execute]
 */

require_once __DIR__ . '/../src/Config/Database.php';
use App\Config\Database;

$execute = in_array('--execute', $argv);

function cleanName($name) {
    $patterns = [
        '/^le\s+/i',
        '/^la\s+/i',
        '/^les\s+/i',
        '/^l[\'’]/i',
        '/^un\s+/i',
        '/^une\s+/i',
        '/^des\s+/i'
    ];
    
    $cleaned = preg_replace($patterns, '', $name);
    
    if ($cleaned !== $name) {
        if (function_exists('mb_substr')) {
            $firstChar = mb_substr($cleaned, 0, 1, 'UTF-8');
            $remaining = mb_substr($cleaned, 1, null, 'UTF-8');
            $cleaned = mb_strtoupper($firstChar, 'UTF-8') . $remaining;
        } else {
            $cleaned = ucfirst($cleaned);
        }
    }
    
    return trim($cleaned);
}

try {
    $db = Database::getConnection();
    
    // Fetch all cards
    $stmt = $db->query("SELECT id, name FROM cards ORDER BY id ASC");
    $cards = $stmt->fetchAll();
    
    $changesCount = 0;
    
    echo "========================================================\n";
    echo "🧹 CARD NAMES CLEANING SCRIPT " . ($execute ? "[EXECUTION MODE]" : "[SIMULATION MODE]") . "\n";
    echo "========================================================\n\n";
    
    if (!$execute) {
        echo "ℹ️  Run with '--execute' parameter to apply changes to database:\n";
        echo "   php backend/scratch/clean_card_names.php --execute\n\n";
    }
    
    $updateStmt = $db->prepare("UPDATE cards SET name = ? WHERE id = ?");
    
    foreach ($cards as $card) {
        $oldName = $card['name'];
        $newName = cleanName($oldName);
        
        if ($oldName !== $newName) {
            $changesCount++;
            echo "👉 ID {$card['id']}: \"{$oldName}\" ➡️  \"{$newName}\"\n";
            
            if ($execute) {
                $updateStmt->execute([$newName, $card['id']]);
            }
        }
    }
    
    echo "\n--------------------------------------------------------\n";
    if ($changesCount > 0) {
        if ($execute) {
            echo "✅ Successfully cleaned {$changesCount} card names in the database!\n";
        } else {
            echo "🔍 Found {$changesCount} card names to clean (Dry run complete).\n";
        }
    } else {
        echo "✨ No card names require cleaning.\n";
    }
    echo "========================================================\n";
    
} catch (\Exception $e) {
    echo "❌ Error: " . $e->getMessage() . "\n";
    exit(1);
}
