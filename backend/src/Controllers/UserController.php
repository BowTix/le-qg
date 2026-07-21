<?php
namespace App\Controllers;

use App\Config\Database;
use App\Middleware\AuthMiddleware;
use PDO;

class UserController {
    /**
     * GET /api/users/profile?id={userId}
     * Authenticated public profile. Private account fields are deliberately omitted.
     */
    public function publicProfile() {
        $authUser = AuthMiddleware::authenticate();
        $viewerId = (int) $authUser['user_id'];
        $userId = (int) ($_GET['id'] ?? 0);

        if ($userId <= 0) {
            http_response_code(400);
            echo json_encode(['error' => 'Identifiant utilisateur invalide.']);
            return;
        }

        $db = Database::getConnection();
        $stmtUser = $db->prepare("
            SELECT id, username, discriminator, role, global_score, bio, avatar_url,
                   equipped_border, equipped_color, equipped_title
            FROM users
            WHERE id = ?
        ");
        $stmtUser->execute([$userId]);
        $profile = $stmtUser->fetch(PDO::FETCH_ASSOC);

        if (!$profile) {
            http_response_code(404);
            echo json_encode(['error' => 'Utilisateur introuvable.']);
            return;
        }

        $stmtCards = $db->prepare("
            SELECT c.id, c.name, c.rarity, c.card_set, c.description, c.image_url,
                   uc.quantity, uc.unlocked_at
            FROM user_cards uc
            JOIN cards c ON c.id = uc.card_id
            WHERE uc.user_id = ? AND uc.quantity > 0
            ORDER BY c.card_set ASC,
                     FIELD(c.rarity, 'legendary', 'epic', 'rare', 'common') ASC,
                     c.name ASC
        ");
        $stmtCards->execute([$userId]);
        $cardsRaw = $stmtCards->fetchAll(PDO::FETCH_ASSOC);

        $cards = [];
        $totalCopies = 0;
        $collectionValue = 0;
        foreach ($cardsRaw as $card) {
            $quantity = (int) $card['quantity'];
            $rarityValue = match ($card['rarity']) {
                'legendary' => 1000,
                'epic' => 300,
                'rare' => 100,
                default => 30,
            };
            $totalCopies += $quantity;
            $collectionValue += $rarityValue;
            $cards[] = [
                'id' => $card['id'],
                'name' => $card['name'],
                'rarity' => $card['rarity'],
                'set' => $card['card_set'],
                'description' => $card['description'],
                'image_url' => $card['image_url'],
                'quantity' => $quantity,
                'unlocked_at' => $card['unlocked_at']
            ];
        }

        $stmtCatalogCount = $db->query("SELECT COUNT(*) FROM cards");
        $catalogCount = (int) $stmtCatalogCount->fetchColumn();

        $stmtFriend = $db->prepare("SELECT 1 FROM friendships WHERE status = 'accepted' AND ((user_id = ? AND friend_id = ?) OR (user_id = ? AND friend_id = ?)) LIMIT 1");
        $stmtFriend->execute([$viewerId, $userId, $userId, $viewerId]);
        $isFriend = (bool) $stmtFriend->fetchColumn();

        echo json_encode([
            'success' => true,
            'user' => [
                'id' => (int) $profile['id'],
                'is_friend' => $isFriend,
                'username' => $profile['username'],
                'discriminator' => $profile['discriminator'],
                'role' => $profile['role'],
                'global_score' => (int) $profile['global_score'],
                'bio' => $profile['bio'],
                'avatar_url' => $profile['avatar_url'],
                'equipped_border' => $profile['equipped_border'],
                'equipped_color' => $profile['equipped_color'],
                'equipped_title' => $profile['equipped_title']
            ],
            'collection' => [
                'cards' => $cards,
                'unique_cards' => count($cards),
                'total_cards' => $catalogCount,
                'total_copies' => $totalCopies,
                'value' => $collectionValue
            ]
        ]);
    }
}
