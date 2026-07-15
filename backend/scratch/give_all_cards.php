<?php
/**
 * Command-line utility to grant all catalog cards to a specific user.
 * Usage: php backend/scratch/give_all_cards.php <username>
 */

require_once __DIR__ . '/../src/Config/Database.php';
use App\Config\Database;

if ($argc < 2) {
    echo "❌ Error: Please specify a username.\n";
    echo "Usage: php backend/scratch/give_all_cards.php <username>\n";
    exit(1);
}

$username = $argv[1];

try {
    $db = Database::getConnection();
    
    // 1. Find user by username
    $stmtUser = $db->prepare("SELECT id FROM users WHERE username = ?");
    $stmtUser->execute([$username]);
    $user = $stmtUser->fetch();
    
    if (!$user) {
        echo "❌ Error: User '$username' not found.\n";
        exit(1);
    }
    
    $userId = $user['id'];
    
    // 2. Insert all cards for this user
    echo "-> Granting all catalog cards to user '$username' (ID: $userId)...\n";
    $stmtInsert = $db->prepare("
        INSERT INTO user_cards (user_id, card_id, quantity)
        SELECT ?, id, 1 FROM cards
        ON DUPLICATE KEY UPDATE quantity = GREATEST(quantity, 1)
    ");
    $stmtInsert->execute([$userId]);
    
    echo "✅ Success! All cards have been added/updated for '$username'.\n";
    
} catch (\Exception $e) {
    echo "❌ Error: " . $e->getMessage() . "\n";
    exit(1);
}
