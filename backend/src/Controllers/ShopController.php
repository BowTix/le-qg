<?php
namespace App\Controllers;

use App\Config\Database;
use App\Middleware\AuthMiddleware;
use PDO;
use Exception;

class ShopController {

    /**
     * GET /api/shop/collection
     */
    public function getCollection() {
        $authUser = AuthMiddleware::authenticate();
        $userId = (int) $authUser['user_id'];
        $db = Database::getConnection();

        // 1. Get user profile and coins
        $stmtUser = $db->prepare("SELECT coins, equipped_border, equipped_color, equipped_title FROM users WHERE id = ?");
        $stmtUser->execute([$userId]);
        $userData = $stmtUser->fetch();

        // 2. Get cosmetics catalog from database
        $stmtCosCatalog = $db->query("SELECT * FROM cosmetics");
        $cosmeticsRaw = $stmtCosCatalog->fetchAll(PDO::FETCH_ASSOC);
        $cosmeticsCatalog = [];
        foreach ($cosmeticsRaw as $item) {
            $cosmeticsCatalog[] = [
                'id' => $item['id'],
                'type' => $item['item_type'],
                'value' => $item['item_value'],
                'name' => $item['name'],
                'price' => $item['price'] !== null ? (int) $item['price'] : null,
                'rarity' => $item['rarity'],
                'exclusive' => (bool) $item['is_exclusive']
            ];
        }

        // 3. Get cards catalog from database
        $stmtCardsCatalog = $db->query("SELECT * FROM cards");
        $cardsRaw = $stmtCardsCatalog->fetchAll(PDO::FETCH_ASSOC);
        $cardsCatalog = [];
        foreach ($cardsRaw as $item) {
            $cardsCatalog[] = [
                'id' => $item['id'],
                'name' => $item['name'],
                'rarity' => $item['rarity'],
                'set' => $item['card_set'],
                'description' => $item['description'],
                'image_url' => $item['image_url'] ?? ("/assets/cards/" . str_replace('card_', '', $item['id']) . ".jpg")
            ];
        }

        // 4. Get unlocked cards with unlock date for current user
        $stmtCards = $db->prepare("SELECT card_id, quantity, unlocked_at FROM user_cards WHERE user_id = ? ORDER BY unlocked_at DESC");
        $stmtCards->execute([$userId]);
        $unlockedCardsData = $stmtCards->fetchAll(PDO::FETCH_ASSOC);

        $unlockedCards = [];
        $lastUnlocked = [];
        foreach ($unlockedCardsData as $row) {
            $unlockedCards[$row['card_id']] = (int) $row['quantity'];
            $lastUnlocked[] = [
                'card_id' => $row['card_id'],
                'unlocked_at' => $row['unlocked_at']
            ];
        }

        // 5. Get unlocked cosmetics for current user
        $stmtCosmetics = $db->prepare("SELECT item_type, item_value FROM user_cosmetics WHERE user_id = ?");
        $stmtCosmetics->execute([$userId]);
        $unlockedCosRaw = $stmtCosmetics->fetchAll();
        $unlockedCosmetics = [];
        foreach ($unlockedCosRaw as $row) {
            $unlockedCosmetics[] = [
                'type' => $row['item_type'],
                'value' => $row['item_value']
            ];
        }

        // 6. Check completed sets status dynamically
        $setKeysMapping = [
            'Les Célébrités' => 'celebrities',
            'Les Monuments' => 'monuments',
            'Les Voitures' => 'cars',
            'L\'Espace et l\'Astronomie' => 'space',
            'Mythologie et Légendes' => 'mythology',
            'Animaux et Biodiversité' => 'biodiversity',
            'Gastronomie du Monde' => 'gastronomy',
            'Cristaux et Minéraux' => 'minerals',
            'Phénomènes Naturels' => 'weather',
            'Les Grandes Inventions' => 'inventions'
        ];

        $setsStatus = [];
        foreach ($setKeysMapping as $dbName => $key) {
            $setsStatus[$key] = false;
        }

        $stmtSetsProgress = $db->prepare("
            SELECT c.card_set, 
                   COUNT(DISTINCT c.id) as total_cards,
                   COUNT(DISTINCT CASE WHEN uc.quantity > 0 THEN uc.card_id END) as owned_cards
            FROM cards c
            LEFT JOIN user_cards uc ON c.id = uc.card_id AND uc.user_id = ?
            GROUP BY c.card_set
        ");
        $stmtSetsProgress->execute([$userId]);
        $setsProgress = $stmtSetsProgress->fetchAll(PDO::FETCH_ASSOC);

        foreach ($setsProgress as $progress) {
            $dbName = $progress['card_set'];
            if (isset($setKeysMapping[$dbName])) {
                $key = $setKeysMapping[$dbName];
                $total = intval($progress['total_cards']);
                $owned = intval($progress['owned_cards']);
                $setsStatus[$key] = ($total > 0 && $owned === $total);
            }
        }

        echo json_encode([
            'success' => true,
            'coins' => (int) ($userData['coins'] ?? 0),
            'equipped' => [
                'border' => $userData['equipped_border'],
                'color' => $userData['equipped_color'],
                'title' => $userData['equipped_title']
            ],
            'catalog' => [
                'cosmetics' => $cosmeticsCatalog,
                'cards' => $cardsCatalog
            ],
            'unlocked_cards' => $unlockedCards,
            'last_unlocked' => $lastUnlocked,
            'unlocked_cosmetics' => $unlockedCosmetics,
            'sets_status' => $setsStatus
        ]);
    }

    /**
     * POST /api/shop/buy-cosmetic
     */
    public function buyCosmetic() {
        $authUser = AuthMiddleware::authenticate();
        $userId = (int) $authUser['user_id'];
        $db = Database::getConnection();

        $input = json_decode(file_get_contents('php://input'), true);
        $itemId = $input['item_id'] ?? '';

        // Find item in DB
        $stmt = $db->prepare("SELECT * FROM cosmetics WHERE id = ?");
        $stmt->execute([$itemId]);
        $targetItem = $stmt->fetch(PDO::FETCH_ASSOC);

        if (!$targetItem) {
            http_response_code(404);
            echo json_encode(['error' => 'Article introuvable.']);
            return;
        }

        if ((bool) $targetItem['is_exclusive']) {
            http_response_code(400);
            echo json_encode(['error' => 'Cet article est exclusif et ne peut pas être acheté directement. Completez le set de cartes associé pour le débloquer !']);
            return;
        }

        // Check if already unlocked
        $stmtCheck = $db->prepare("SELECT id FROM user_cosmetics WHERE user_id = ? AND item_type = ? AND item_value = ?");
        $stmtCheck->execute([$userId, $targetItem['item_type'], $targetItem['item_value']]);
        if ($stmtCheck->fetch()) {
            http_response_code(400);
            echo json_encode(['error' => 'Vous possédez déjà cet article.']);
            return;
        }

        // Get user coins
        $stmtCoins = $db->prepare("SELECT coins FROM users WHERE id = ?");
        $stmtCoins->execute([$userId]);
        $coins = intval($stmtCoins->fetchColumn());

        $price = intval($targetItem['price']);
        if ($coins < $price) {
            http_response_code(400);
            echo json_encode(['error' => 'Pièces insuffisantes. Il vous faut ' . $price . ' pièces.']);
            return;
        }

        try {
            $db->beginTransaction();

            // Deduct coins
            $stmtDeduct = $db->prepare("UPDATE users SET coins = coins - ? WHERE id = ?");
            $stmtDeduct->execute([$price, $userId]);

            // Add cosmetic unlock
            $stmtUnlock = $db->prepare("INSERT INTO user_cosmetics (user_id, item_type, item_value) VALUES (?, ?, ?)");
            $stmtUnlock->execute([$userId, $targetItem['item_type'], $targetItem['item_value']]);

            $db->commit();

            echo json_encode([
                'success' => true,
                'message' => 'Article débloqué avec succès !',
                'new_coins' => $coins - $price
            ]);
        } catch (Exception $e) {
            $db->rollBack();
            http_response_code(500);
            echo json_encode(['error' => 'Erreur de transaction : ' . $e->getMessage()]);
        }
    }

    /**
     * POST /api/shop/buy-booster
     */
    public function buyBooster() {
        $authUser = AuthMiddleware::authenticate();
        $userId = (int) $authUser['user_id'];
        $db = Database::getConnection();

        $boosterCost = 250;

        // Get user coins
        $stmtCoins = $db->prepare("SELECT coins FROM users WHERE id = ?");
        $stmtCoins->execute([$userId]);
        $coins = intval($stmtCoins->fetchColumn());

        if ($coins < $boosterCost) {
            http_response_code(400);
            echo json_encode(['error' => 'Pièces insuffisantes. Le booster coûte ' . $boosterCost . ' pièces.']);
            return;
        }

        // Load all cards from database
        $stmtCards = $db->query("SELECT * FROM cards");
        $allCards = $stmtCards->fetchAll(PDO::FETCH_ASSOC);

        if (empty($allCards)) {
            http_response_code(500);
            echo json_encode(['error' => 'Le catalogue de cartes est vide en base de données.']);
            return;
        }

        // Separate cards by rarity
        $commonCards = [];
        $rareCards = [];
        $epicCards = [];
        $legendaryCards = [];

        foreach ($allCards as $card) {
            // Remap keys to match expected output structure
            $cardFormatted = [
                'id' => $card['id'],
                'name' => $card['name'],
                'rarity' => $card['rarity'],
                'set' => $card['card_set'],
                'description' => $card['description'],
                'image_url' => $card['image_url'] ?? ("/assets/cards/" . str_replace('card_', '', $card['id']) . ".jpg")
            ];

            if ($card['rarity'] === 'common') {
                $commonCards[] = $cardFormatted;
            } elseif ($card['rarity'] === 'rare') {
                $rareCards[] = $cardFormatted;
            } elseif ($card['rarity'] === 'epic') {
                $epicCards[] = $cardFormatted;
            } else {
                $legendaryCards[] = $cardFormatted;
            }
        }

        // Draw 3 cards based on weighted probability
        // Common: 65%, Rare: 25%, Epic: 8%, Legendary: 2%
        $drawnCards = [];
        for ($i = 0; $i < 3; $i++) {
            $rand = rand(1, 100);
            if ($rand <= 65 && !empty($commonCards)) {
                $drawnCards[] = $commonCards[array_rand($commonCards)];
            } elseif ($rand <= 90 && !empty($rareCards)) {
                $drawnCards[] = $rareCards[array_rand($rareCards)];
            } elseif ($rand <= 98 && !empty($epicCards)) {
                $drawnCards[] = $epicCards[array_rand($epicCards)];
            } elseif (!empty($legendaryCards)) {
                $drawnCards[] = $legendaryCards[array_rand($legendaryCards)];
            } else {
                // Fallback to absolute random if target rarity pool was empty
                $allPool = array_merge($commonCards, $rareCards, $epicCards, $legendaryCards);
                $drawnCards[] = $allPool[array_rand($allPool)];
            }
        }

        try {
            $db->beginTransaction();

            // Deduct coins
            $stmtDeduct = $db->prepare("UPDATE users SET coins = coins - ? WHERE id = ?");
            $stmtDeduct->execute([$boosterCost, $userId]);

            $cardsResult = [];
            foreach ($drawnCards as $card) {
                // Check if user already owns this card
                $stmtCheckCard = $db->prepare("SELECT quantity FROM user_cards WHERE user_id = ? AND card_id = ?");
                $stmtCheckCard->execute([$userId, $card['id']]);
                $existing = $stmtCheckCard->fetch();
                $isNew = !$existing;

                // Insert or increment quantity
                $stmtAddCard = $db->prepare("
                    INSERT INTO user_cards (user_id, card_id, quantity) 
                    VALUES (?, ?, 1) 
                    ON DUPLICATE KEY UPDATE quantity = quantity + 1
                ");
                $stmtAddCard->execute([$userId, $card['id']]);

                // Check for set completions
                $unlockedSets = [];
                if ($isNew) {
                    $setInfo = $this->checkForCompletedSets($db, $userId, $card['id']);
                    if ($setInfo) {
                        $unlockedSets[] = $setInfo;
                    }
                }

                $cardsResult[] = [
                    'card' => $card,
                    'is_new' => $isNew,
                    'quantity' => $isNew ? 1 : intval($existing['quantity']) + 1,
                    'unlocked_sets' => $unlockedSets
                ];
            }

            $db->commit();

            // Track quests progress after transaction success
            \App\Controllers\QuestController::incrementProgress($userId, 'open_chests');
            foreach ($cardsResult as $res) {
                if ($res['is_new']) {
                    \App\Controllers\QuestController::incrementProgress($userId, 'cards_unlocked');
                }
            }

            echo json_encode([
                'success' => true,
                'drawn_cards' => $cardsResult,
                'new_coins' => $coins - $boosterCost
            ]);
        } catch (Exception $e) {
            $db->rollBack();
            http_response_code(500);
            echo json_encode(['error' => 'Erreur lors de la transaction du booster : ' . $e->getMessage()]);
        }
    }

    private function checkForCompletedSets($db, $userId, $cardId) {
        // Query card set dynamically
        $stmtCard = $db->prepare("SELECT card_set FROM cards WHERE id = ?");
        $stmtCard->execute([$cardId]);
        $cardSet = $stmtCard->fetchColumn();

        if (!$cardSet) return null;

        // Set completions mapped to rewards
        $setsRewards = [
            'Les Célébrités' => [
                'reward_type' => 'title',
                'reward_value' => 'Le Génie Historique',
                'reward_label' => 'Titre : Le Génie Historique'
            ],
            'Les Monuments' => [
                'reward_type' => 'border',
                'reward_value' => 'border-cosmic',
                'reward_label' => 'Bordure d\'avatar : Cosmique'
            ],
            'Les Voitures' => [
                'reward_type' => 'color',
                'reward_value' => 'rainbow',
                'reward_label' => 'Pseudo : Arc-en-ciel'
            ],
            'L\'Espace et l\'Astronomie' => [
                'reward_type' => 'border',
                'reward_value' => 'border-nebula',
                'reward_label' => 'Bordure d\'avatar : Nébuleuse'
            ],
            'Mythologie et Légendes' => [
                'reward_type' => 'title',
                'reward_value' => 'Le Demi-Dieu',
                'reward_label' => 'Titre : Le Demi-Dieu'
            ],
            'Animaux et Biodiversité' => [
                'reward_type' => 'title',
                'reward_value' => 'Le Prédateur Alpha',
                'reward_label' => 'Titre : Le Prédateur Alpha'
            ],
            'Gastronomie du Monde' => [
                'reward_type' => 'title',
                'reward_value' => 'Le Chef Étoilé',
                'reward_label' => 'Titre : Le Chef Étoilé'
            ],
            'Cristaux et Minéraux' => [
                'reward_type' => 'border',
                'reward_value' => 'border-crystal',
                'reward_label' => 'Bordure d\'avatar : Cristal'
            ],
            'Phénomènes Naturels' => [
                'reward_type' => 'border',
                'reward_value' => 'border-storm',
                'reward_label' => 'Bordure d\'avatar : Tempête'
            ],
            'Les Grandes Inventions' => [
                'reward_type' => 'color',
                'reward_value' => 'cyberpunk',
                'reward_label' => 'Pseudo : Néon Cyberpunk'
            ]
        ];

        if (!isset($setsRewards[$cardSet])) return null;
        $reward = $setsRewards[$cardSet];

        // 1. Count how many cards are total in this set in DB
        $stmtCountAll = $db->prepare("SELECT COUNT(*) FROM cards WHERE card_set = ?");
        $stmtCountAll->execute([$cardSet]);
        $totalInSet = intval($stmtCountAll->fetchColumn());

        // 2. Count how many unique cards of this set the user owns in DB
        $stmtCountOwned = $db->prepare("
            SELECT COUNT(DISTINCT uc.card_id) 
            FROM user_cards uc
            JOIN cards c ON uc.card_id = c.id
            WHERE uc.user_id = ? AND c.card_set = ?
        ");
        $stmtCountOwned->execute([$userId, $cardSet]);
        $ownedInSet = intval($stmtCountOwned->fetchColumn());

        if ($ownedInSet === $totalInSet && $totalInSet > 0) {
            // Unlock reward in database
            $stmtReward = $db->prepare("
                INSERT INTO user_cosmetics (user_id, item_type, item_value) 
                VALUES (?, ?, ?)
                ON DUPLICATE KEY UPDATE item_value = item_value
            ");
            $stmtReward->execute([$userId, $reward['reward_type'], $reward['reward_value']]);

            // Determine temporary frontend setId representation
            $setsIdMap = [
                'Les Célébrités' => 'celebrities',
                'Les Monuments' => 'monuments',
                'Les Voitures' => 'cars',
                'L\'Espace et l\'Astronomie' => 'space',
                'Mythologie et Légendes' => 'mythology',
                'Animaux et Biodiversité' => 'biodiversity',
                'Gastronomie du Monde' => 'gastronomy',
                'Cristaux et Minéraux' => 'minerals',
                'Phénomènes Naturels' => 'weather',
                'Les Grandes Inventions' => 'inventions'
            ];
            $setId = $setsIdMap[$cardSet] ?? 'celebrities';

            return [
                'set_id' => $setId,
                'set_name' => $cardSet,
                'reward_label' => $reward['reward_label']
            ];
        }

        return null;
    }

    /**
     * POST /api/shop/equip
     */
    public function equipItem() {
        $authUser = AuthMiddleware::authenticate();
        $userId = (int) $authUser['user_id'];
        $db = Database::getConnection();

        $input = json_decode(file_get_contents('php://input'), true);
        $itemType = $input['item_type'] ?? '';
        $itemValue = $input['item_value'] ?? null; // null to unequip

        if (!in_array($itemType, ['border', 'color', 'title'])) {
            http_response_code(400);
            echo json_encode(['error' => 'Type de cosmétique invalide.']);
            return;
        }

        // If equipping, check ownership
        if ($itemValue !== null) {
            // Validate if item exists in cosmetics DB catalog
            $stmtValid = $db->prepare("SELECT id FROM cosmetics WHERE item_type = ? AND item_value = ?");
            $stmtValid->execute([$itemType, $itemValue]);
            if (!$stmtValid->fetch()) {
                http_response_code(400);
                echo json_encode(['error' => 'Valeur cosmétique invalide.']);
                return;
            }

            // Verify player owns this item in user_cosmetics
            $stmtCheck = $db->prepare("SELECT id FROM user_cosmetics WHERE user_id = ? AND item_type = ? AND item_value = ?");
            $stmtCheck->execute([$userId, $itemType, $itemValue]);
            if (!$stmtCheck->fetch()) {
                http_response_code(403);
                echo json_encode(['error' => 'Vous ne possédez pas cet article.']);
                return;
            }
        }

        // Equip the item
        $columnName = "equipped_" . $itemType;
        $stmtUpdate = $db->prepare("UPDATE users SET `$columnName` = ? WHERE id = ?");
        $stmtUpdate->execute([$itemValue, $userId]);

        echo json_encode([
            'success' => true,
            'message' => $itemValue === null ? 'Cosmétique retiré !' : 'Cosmétique équipé !'
        ]);
    }
}
