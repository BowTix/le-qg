<?php
namespace App\Controllers;

use App\Config\Database;
use App\Middleware\AuthMiddleware;
use PDO;
use Exception;

class ShopController {

    /**
     * GET /api/shop/summary
     * Lightweight dashboard payload: one database round-trip.
     */
    public function getCollectionSummary() {
        $authUser = AuthMiddleware::authenticate();
        $userId = (int) $authUser['user_id'];
        $db = Database::getConnection();

        $stmt = $db->prepare("
            SELECT u.coins, u.craft_stars,
                   (SELECT COUNT(*) FROM cards) AS total_cards,
                   (SELECT COUNT(*) FROM user_cards uc WHERE uc.user_id = ? AND uc.quantity > 0) AS unlocked_cards
            FROM users u
            WHERE u.id = ?
        ");
        $stmt->execute([$userId, $userId]);
        $summary = $stmt->fetch(PDO::FETCH_ASSOC);

        echo json_encode([
            'success' => true,
            'coins' => (int) ($summary['coins'] ?? 0),
            'craft_stars' => (int) ($summary['craft_stars'] ?? 0),
            'total_cards' => (int) ($summary['total_cards'] ?? 0),
            'unlocked_cards' => (int) ($summary['unlocked_cards'] ?? 0),
        ]);
    }

    /**
     * GET /api/shop/collection
     */
    public function getCollection() {
        $authUser = AuthMiddleware::authenticate();
        $userId = (int) $authUser['user_id'];
        $db = Database::getConnection();

        // 1. Get user profile, coins and craft stars
        $stmtUser = $db->prepare("SELECT coins, craft_stars, equipped_border, equipped_color, equipped_title FROM users WHERE id = ?");
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
                'season_id' => (int) ($item['season_id'] ?? 1),
                'card_number' => (int) ($item['card_number'] ?? 1),
                'is_collector' => (bool) ($item['is_collector'] ?? false),
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
            'craft_stars' => (int) ($userData['craft_stars'] ?? 0),
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

        // Load all cards eligible for standard boosters from database
        $stmtCards = $db->query("SELECT * FROM cards WHERE is_collector = 0 AND rarity != 'ultime'");
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
                'season_id' => (int) ($card['season_id'] ?? 1),
                'card_number' => (int) ($card['card_number'] ?? 1),
                'is_collector' => (bool) ($card['is_collector'] ?? false),
                'description' => $card['description'],
                'image_url' => $card['image_url'] ?? ("/assets/cards/" . str_replace('card_', '', $card['id']) . ".jpg")
            ];

            if ($card['rarity'] === 'common') {
                $commonCards[] = $cardFormatted;
            } elseif ($card['rarity'] === 'rare') {
                $rareCards[] = $cardFormatted;
            } elseif ($card['rarity'] === 'epic') {
                $epicCards[] = $cardFormatted;
            } elseif ($card['rarity'] === 'legendary') {
                $legendaryCards[] = $cardFormatted;
            }
        }

        // Draw 3 cards based on weighted probability per slot:
        // Slots 1 & 2 (Standard): Common 75%, Rare 20%, Epic 4%, Legendary 1%
        // Slot 3 (Guaranteed Rare+): Rare 70%, Epic 22%, Legendary 8% (0% Common)
        $drawnCards = [];

        // Helper function to pick card by rarity
        $pickCard = function(string $rarity) use (&$commonCards, &$rareCards, &$epicCards, &$legendaryCards) {
            $pool = match ($rarity) {
                'legendary' => $legendaryCards,
                'epic' => $epicCards,
                'rare' => $rareCards,
                default => $commonCards,
            };
            if (!empty($pool)) return $pool[array_rand($pool)];
            $all = array_merge($commonCards, $rareCards, $epicCards, $legendaryCards);
            return $all[array_rand($all)];
        };

        // Slots 1 & 2
        for ($i = 0; $i < 2; $i++) {
            $rand = mt_rand(1, 100);
            if ($rand <= 75) {
                $drawnCards[] = $pickCard('common');
            } elseif ($rand <= 95) {
                $drawnCards[] = $pickCard('rare');
            } elseif ($rand <= 99) {
                $drawnCards[] = $pickCard('epic');
            } else {
                $drawnCards[] = $pickCard('legendary');
            }
        }

        // Slot 3 (Rare+ Garanti)
        $rand3 = mt_rand(1, 100);
        if ($rand3 <= 70) {
            $drawnCards[] = $pickCard('rare');
        } elseif ($rand3 <= 92) {
            $drawnCards[] = $pickCard('epic');
        } else {
            $drawnCards[] = $pickCard('legendary');
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
            \App\Controllers\QuestController::incrementProgress($userId, 'cards_obtained', count($cardsResult));
            $duplicatesDrawn = 0;
            foreach ($cardsResult as $res) {
                if ($res['is_new']) {
                    \App\Controllers\QuestController::incrementProgress($userId, 'cards_unlocked');
                } else {
                    $duplicatesDrawn++;
                }
            }
            if ($duplicatesDrawn > 0) {
                \App\Controllers\QuestController::incrementProgress($userId, 'recycle_duplicates', $duplicatesDrawn);
            }

            $stmtFreshStars = $db->prepare("SELECT craft_stars FROM users WHERE id = ?");
            $stmtFreshStars->execute([$userId]);
            $craftStars = (int) $stmtFreshStars->fetchColumn();

            echo json_encode([
                'success' => true,
                'drawn_cards' => $cardsResult,
                'new_coins' => $coins - $boosterCost,
                'craft_stars' => $craftStars
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
            WHERE uc.user_id = ? AND c.card_set = ? AND uc.quantity > 0
        ");
        $stmtCountOwned->execute([$userId, $cardSet]);
        $ownedInSet = intval($stmtCountOwned->fetchColumn());

        if ($ownedInSet === $totalInSet && $totalInSet > 0) {
            // Check if cosmetic already claimed
            $stmtCheckClaimed = $db->prepare("SELECT id FROM user_cosmetics WHERE user_id = ? AND item_type = ? AND item_value = ?");
            $stmtCheckClaimed->execute([$userId, $reward['reward_type'], $reward['reward_value']]);
            $alreadyClaimed = (bool) $stmtCheckClaimed->fetch();

            if (!$alreadyClaimed) {
                // Unlock reward in database
                $stmtReward = $db->prepare("
                    INSERT INTO user_cosmetics (user_id, item_type, item_value) 
                    VALUES (?, ?, ?)
                    ON DUPLICATE KEY UPDATE item_value = item_value
                ");
                $stmtReward->execute([$userId, $reward['reward_type'], $reward['reward_value']]);

                // Bonus de Complétion de Série (Section 8) : +250 coins et +120 XP
                $stmtBonus = $db->prepare("UPDATE users SET coins = coins + 250, global_score = global_score + 120 WHERE id = ?");
                $stmtBonus->execute([$userId]);
            }

            // Check for 100/100 Ultimate Season Completion
            $stmtSeasonCount = $db->prepare("
                SELECT COUNT(DISTINCT uc.card_id)
                FROM user_cards uc
                JOIN cards c ON uc.card_id = c.id
                WHERE uc.user_id = ? AND c.season_id = 1 AND c.card_number <= 100 AND uc.quantity > 0
            ");
            $stmtSeasonCount->execute([$userId]);
            $seasonOwned = intval($stmtSeasonCount->fetchColumn());

            if ($seasonOwned >= 100) {
                $stmtCheckMaster = $db->prepare("SELECT id FROM user_cosmetics WHERE user_id = ? AND item_type = 'title' AND item_value = 'Maître d\'Omnia — Saison 1'");
                $stmtCheckMaster->execute([$userId]);
                if (!$stmtCheckMaster->fetch()) {
                    $stmtMasterTitle = $db->prepare("INSERT IGNORE INTO user_cosmetics (user_id, item_type, item_value) VALUES (?, 'title', 'Maître d\'Omnia — Saison 1')");
                    $stmtMasterTitle->execute([$userId]);

                    $stmtMasterBorder = $db->prepare("INSERT IGNORE INTO user_cosmetics (user_id, item_type, item_value) VALUES (?, 'border', 'border-holographic')");
                    $stmtMasterBorder->execute([$userId]);

                    $stmtSecretCard = $db->prepare("INSERT INTO user_cards (user_id, card_id, quantity) VALUES (?, 'card_secret_101', 1) ON DUPLICATE KEY UPDATE quantity = quantity + 1");
                    $stmtSecretCard->execute([$userId]);
                }
            }

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
                'reward_label' => $reward['reward_label'] . ($alreadyClaimed ? '' : ' (+250 🪙, +120 XP)')
            ];
        }

        return null;
    }

    /**
     * POST /api/cards/recycle
     * Recycles duplicates (quantity > 1) into Crafting Stars
     * Body: { card_id?: string, count?: int, all?: boolean }
     */
    public function recycleCards(array $data) {
        $authUser = AuthMiddleware::authenticate();
        $userId = (int) $authUser['user_id'];
        $db = Database::getConnection();

        $all = !empty($data['all']);
        $targetCardId = trim($data['card_id'] ?? '');
        $requestedCount = max(1, intval($data['count'] ?? 1));

        $starsMap = [
            'common' => 1,
            'rare' => 3,
            'epic' => 8,
            'legendary' => 20,
            'ultime' => 50,
            'ultimate' => 50
        ];

        try {
            $db->beginTransaction();

            $totalRecycled = 0;
            $totalStars = 0;

            if ($all) {
                $stmt = $db->prepare("
                    SELECT uc.card_id, uc.quantity, c.rarity 
                    FROM user_cards uc
                    JOIN cards c ON uc.card_id = c.id
                    WHERE uc.user_id = ? AND uc.quantity > 1
                ");
                $stmt->execute([$userId]);
                $duplicates = $stmt->fetchAll(PDO::FETCH_ASSOC);

                if (empty($duplicates)) {
                    $db->rollBack();
                    http_response_code(400);
                    echo json_encode(['error' => 'Aucun doublon disponible à recycler.']);
                    return;
                }

                $stmtUpdate = $db->prepare("UPDATE user_cards SET quantity = 1 WHERE user_id = ? AND card_id = ?");

                foreach ($duplicates as $dup) {
                    $excess = intval($dup['quantity']) - 1;
                    if ($excess > 0) {
                        $rarity = $dup['rarity'] ?? 'common';
                        $perCard = $starsMap[$rarity] ?? 1;
                        $totalRecycled += $excess;
                        $totalStars += ($excess * $perCard);
                        $stmtUpdate->execute([$userId, $dup['card_id']]);
                    }
                }
            } else {
                if (empty($targetCardId)) {
                    $db->rollBack();
                    http_response_code(400);
                    echo json_encode(['error' => 'Identifiant de carte manquant.']);
                    return;
                }

                $stmt = $db->prepare("
                    SELECT uc.quantity, c.rarity
                    FROM user_cards uc
                    JOIN cards c ON uc.card_id = c.id
                    WHERE uc.user_id = ? AND uc.card_id = ?
                ");
                $stmt->execute([$userId, $targetCardId]);
                $cardRow = $stmt->fetch(PDO::FETCH_ASSOC);

                if (!$cardRow || intval($cardRow['quantity']) <= 1) {
                    $db->rollBack();
                    http_response_code(400);
                    echo json_encode(['error' => 'Vous ne possédez aucun doublon pour cette carte.']);
                    return;
                }

                $availableExcess = intval($cardRow['quantity']) - 1;
                $countToRecycle = min($requestedCount, $availableExcess);
                $rarity = $cardRow['rarity'] ?? 'common';
                $perCard = $starsMap[$rarity] ?? 1;

                $totalRecycled = $countToRecycle;
                $totalStars = $countToRecycle * $perCard;

                $stmtUpdate = $db->prepare("UPDATE user_cards SET quantity = quantity - ? WHERE user_id = ? AND card_id = ?");
                $stmtUpdate->execute([$countToRecycle, $userId, $targetCardId]);
            }

            // Award Crafting Stars to user
            $stmtAward = $db->prepare("UPDATE users SET craft_stars = craft_stars + ? WHERE id = ?");
            $stmtAward->execute([$totalStars, $userId]);

            $db->commit();

            // Increment quest progress for recycling duplicates
            \App\Controllers\QuestController::incrementProgress($userId, 'recycle_duplicates', $totalRecycled);

            // Fetch fresh craft_stars and updated user_cards
            $stmtFreshStars = $db->prepare("SELECT craft_stars FROM users WHERE id = ?");
            $stmtFreshStars->execute([$userId]);
            $newCraftStars = (int) $stmtFreshStars->fetchColumn();

            $stmtCards = $db->prepare("SELECT card_id, quantity FROM user_cards WHERE user_id = ? AND quantity > 0");
            $stmtCards->execute([$userId]);
            $unlockedCards = [];
            foreach ($stmtCards->fetchAll(PDO::FETCH_ASSOC) as $row) {
                $unlockedCards[$row['card_id']] = (int) $row['quantity'];
            }

            echo json_encode([
                'success' => true,
                'message' => "{$totalRecycled} doublon(s) recyclé(s) pour +{$totalStars} ⭐ !",
                'recycled_count' => $totalRecycled,
                'stars_awarded' => $totalStars,
                'stars_gained' => $totalStars,
                'craft_stars' => $newCraftStars,
                'unlocked_cards' => $unlockedCards
            ]);
        } catch (Exception $e) {
            $db->rollBack();
            http_response_code(500);
            echo json_encode(['error' => 'Erreur lors du recyclage : ' . $e->getMessage()]);
        }
    }

    /**
     * POST /api/cards/craft
     * Crafts a specific card with Crafting Stars
     * Body: { card_id: string }
     */
    public function craftCard(array $data) {
        $authUser = AuthMiddleware::authenticate();
        $userId = (int) $authUser['user_id'];
        $db = Database::getConnection();

        $cardId = trim($data['card_id'] ?? '');
        $rarity = trim($data['rarity'] ?? '');

        // Crafting costs by rarity (Section 7)
        $craftCosts = [
            'common' => 15,
            'rare' => 35,
            'epic' => 80,
            'legendary' => 180
        ];

        if (!empty($rarity)) {
            if (!isset($craftCosts[$rarity])) {
                http_response_code(400);
                echo json_encode(['error' => 'Rareté invalide.']);
                return;
            }

            // Find all undiscovered cards of this rarity for the user (non-collector base season)
            $stmtMissing = $db->prepare("
                SELECT * FROM cards c 
                WHERE c.rarity = ? 
                  AND c.is_collector = 0
                  AND c.id NOT IN (
                      SELECT card_id FROM user_cards WHERE user_id = ? AND quantity > 0
                  )
            ");
            $stmtMissing->execute([$rarity, $userId]);
            $missingCards = $stmtMissing->fetchAll(PDO::FETCH_ASSOC);

            if (empty($missingCards)) {
                http_response_code(400);
                echo json_encode(['error' => "Toutes les cartes de cette rareté sont déjà débloquées !"]);
                return;
            }

            $card = $missingCards[array_rand($missingCards)];
            $cardId = $card['id'];
        } elseif (!empty($cardId)) {
            // Fetch card details by ID
            $stmtCard = $db->prepare("SELECT * FROM cards WHERE id = ?");
            $stmtCard->execute([$cardId]);
            $card = $stmtCard->fetch(PDO::FETCH_ASSOC);

            if (!$card) {
                http_response_code(404);
                echo json_encode(['error' => 'Carte introuvable dans le catalogue.']);
                return;
            }
            $rarity = $card['rarity'] ?? 'common';
        } else {
            http_response_code(400);
            echo json_encode(['error' => 'Rareté ou identifiant de carte manquant.']);
            return;
        }

        $cost = $craftCosts[$rarity] ?? 15;

        // Check user stars
        $stmtUser = $db->prepare("SELECT craft_stars FROM users WHERE id = ?");
        $stmtUser->execute([$userId]);
        $currentStars = intval($stmtUser->fetchColumn());

        if ($currentStars < $cost) {
            http_response_code(400);
            echo json_encode(['error' => "Étoiles insuffisantes. Il vous faut {$cost} étoiles pour fabriquer cette carte ({$currentStars} disponibles)."]);
            return;
        }

        try {
            $db->beginTransaction();

            // Deduct stars
            $stmtDeduct = $db->prepare("UPDATE users SET craft_stars = craft_stars - ? WHERE id = ?");
            $stmtDeduct->execute([$cost, $userId]);

            // Check if user already owns it
            $stmtCheck = $db->prepare("SELECT quantity FROM user_cards WHERE user_id = ? AND card_id = ?");
            $stmtCheck->execute([$userId, $cardId]);
            $existing = $stmtCheck->fetch(PDO::FETCH_ASSOC);
            $isNew = !$existing || intval($existing['quantity']) === 0;

            // Insert or increment quantity
            $stmtAdd = $db->prepare("
                INSERT INTO user_cards (user_id, card_id, quantity) 
                VALUES (?, ?, 1) 
                ON DUPLICATE KEY UPDATE quantity = quantity + 1
            ");
            $stmtAdd->execute([$userId, $cardId]);

            // Check completed sets
            $unlockedSets = [];
            if ($isNew) {
                $setInfo = $this->checkForCompletedSets($db, $userId, $cardId);
                if ($setInfo) {
                    $unlockedSets[] = $setInfo;
                }
            }

            $db->commit();

            // Trigger quests
            \App\Controllers\QuestController::incrementProgress($userId, 'craft_card', 1);
            \App\Controllers\QuestController::incrementProgress($userId, 'cards_obtained', 1);
            if ($isNew) {
                \App\Controllers\QuestController::incrementProgress($userId, 'cards_unlocked', 1);
            }

            // Fresh data
            $stmtFreshStars = $db->prepare("SELECT craft_stars FROM users WHERE id = ?");
            $stmtFreshStars->execute([$userId]);
            $newCraftStars = (int) $stmtFreshStars->fetchColumn();

            $stmtCards = $db->prepare("SELECT card_id, quantity FROM user_cards WHERE user_id = ? AND quantity > 0");
            $stmtCards->execute([$userId]);
            $unlockedCards = [];
            foreach ($stmtCards->fetchAll(PDO::FETCH_ASSOC) as $row) {
                $unlockedCards[$row['card_id']] = (int) $row['quantity'];
            }

            $cardFormatted = [
                'id' => $card['id'],
                'name' => $card['name'],
                'rarity' => $card['rarity'],
                'set' => $card['card_set'],
                'season_id' => (int) ($card['season_id'] ?? 1),
                'card_number' => (int) ($card['card_number'] ?? 1),
                'is_collector' => (bool) ($card['is_collector'] ?? false),
                'description' => $card['description'],
                'image_url' => $card['image_url'] ?? ("/assets/cards/" . str_replace('card_', '', $card['id']) . ".jpg")
            ];

            echo json_encode([
                'success' => true,
                'message' => "Carte \"{$card['name']}\" fabriquée avec succès !",
                'card' => $cardFormatted,
                'craft_stars' => $newCraftStars,
                'is_new' => $isNew,
                'unlocked_cards' => $unlockedCards,
                'unlocked_sets' => $unlockedSets
            ]);
        } catch (Exception $e) {
            $db->rollBack();
            http_response_code(500);
            echo json_encode(['error' => 'Erreur lors de la fabrication de la carte : ' . $e->getMessage()]);
        }
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
