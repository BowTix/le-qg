<?php
namespace App\Controllers;

use App\Config\Database;
use App\Middleware\AuthMiddleware;
use PDO;
use Exception;

class QuestController {

    /**
     * GET /api/quests
     * Get active quests for user (lazy generate if needed)
     */
    public function getQuests() {
        $user = AuthMiddleware::authenticate();
        $userId = (int) $user['user_id'];
        $db = Database::getConnection();

        $this->generateQuestsIfNeeded($db, $userId);

        // Ensure login_days quest has counted today if the user logged in today
        $today = date('Y-m-d');
        $stmtDate = $db->prepare("SELECT last_login_date FROM users WHERE id = ?");
        $stmtDate->execute([$userId]);
        $lastLoginDate = $stmtDate->fetchColumn();

        if ($lastLoginDate === $today) {
            $stmtSync = $db->prepare("
                UPDATE user_quests uq
                JOIN quests q ON uq.quest_id = q.id
                SET uq.progress = GREATEST(uq.progress, 1)
                WHERE uq.user_id = ?
                  AND q.target_type = 'login_days'
                  AND uq.expires_at > ?
                  AND uq.is_claimed = 0
            ");
            $stmtSync->execute([$userId, date('Y-m-d H:i:s')]);
        }

        // Fetch active quests
        $now = date('Y-m-d H:i:s');
        $stmt = $db->prepare("
            SELECT uq.id as user_quest_id, uq.progress, uq.is_claimed, uq.expires_at,
                   q.id as quest_id, q.type, q.pool, q.title, q.description, q.target_type, q.target_value, q.reward_coins, q.reward_xp
            FROM user_quests uq
            JOIN quests q ON uq.quest_id = q.id
            WHERE uq.user_id = ? AND uq.expires_at > ?
            ORDER BY q.type ASC, q.pool ASC, q.id ASC
        ");
        $stmt->execute([$userId, $now]);
        $quests = $stmt->fetchAll(PDO::FETCH_ASSOC);

        // Format times and statuses
        foreach ($quests as &$q) {
            $q['progress'] = (int) $q['progress'];
            $q['target_value'] = (int) $q['target_value'];
            $q['reward_coins'] = (int) $q['reward_coins'];
            $q['reward_xp'] = (int) $q['reward_xp'];
            $q['is_claimed'] = (int) $q['is_claimed'] === 1;
            $q['time_left_seconds'] = strtotime($q['expires_at']) - time();
        }

        echo json_encode([
            'success' => true,
            'quests' => $quests
        ]);
    }

    /**
     * POST /api/quests/claim
     * Claim rewards for a completed quest
     */
    public function claimQuest() {
        $user = AuthMiddleware::authenticate();
        $userId = (int) $user['user_id'];
        
        $data = json_decode(file_get_contents('php://input'), true);
        $userQuestId = intval($data['user_quest_id'] ?? 0);

        if ($userQuestId <= 0) {
            http_response_code(400);
            echo json_encode(['error' => 'user_quest_id requis.']);
            return;
        }

        $db = Database::getConnection();

        // Fetch the quest details
        $stmt = $db->prepare("
            SELECT uq.id, uq.progress, uq.is_claimed, uq.expires_at,
                   q.target_value, q.reward_coins, q.reward_xp
            FROM user_quests uq
            JOIN quests q ON uq.quest_id = q.id
            WHERE uq.id = ? AND uq.user_id = ?
        ");
        $stmt->execute([$userQuestId, $userId]);
        $userQuest = $stmt->fetch();

        if (!$userQuest) {
            http_response_code(404);
            echo json_encode(['error' => 'Quête introuvable ou non assignée.']);
            return;
        }

        if (strtotime($userQuest['expires_at']) <= time()) {
            http_response_code(400);
            echo json_encode(['error' => 'Cette quête a expiré.']);
            return;
        }

        if ((int) $userQuest['is_claimed'] === 1) {
            http_response_code(400);
            echo json_encode(['error' => 'Récompense déjà réclamée pour cette quête.']);
            return;
        }

        if ((int) $userQuest['progress'] < (int) $userQuest['target_value']) {
            http_response_code(400);
            echo json_encode(['error' => 'La quête n\'est pas encore complétée.']);
            return;
        }

        try {
            $db->beginTransaction();

            // Mark claimed
            $stmtClaim = $db->prepare("UPDATE user_quests SET is_claimed = 1 WHERE id = ?");
            $stmtClaim->execute([$userQuestId]);

            // Add coins & XP (global_score) to user
            $stmtUser = $db->prepare("
                UPDATE users 
                SET coins = coins + ?, global_score = global_score + ? 
                WHERE id = ?
            ");
            $stmtUser->execute([
                $userQuest['reward_coins'],
                $userQuest['reward_xp'],
                $userId
            ]);

            $db->commit();

            // Fire events for coins and XP earned
            self::incrementProgress($userId, 'coins_earned', (int) $userQuest['reward_coins']);
            self::incrementProgress($userId, 'xp_earned', (int) $userQuest['reward_xp']);

            // Get updated profile statistics
            $stmtProfile = $db->prepare("SELECT coins, global_score FROM users WHERE id = ?");
            $stmtProfile->execute([$userId]);
            $updatedStats = $stmtProfile->fetch();

            echo json_encode([
                'success' => true,
                'message' => 'Récompense réclamée avec succès !',
                'coins' => (int) $updatedStats['coins'],
                'global_score' => (int) $updatedStats['global_score']
            ]);

        } catch (Exception $e) {
            $db->rollBack();
            http_response_code(500);
            echo json_encode(['error' => 'Une erreur est survenue lors de la réclamation.']);
        }
    }

    /**
     * Static helper to increment quest progress for a specific target_type
     */
    public static function incrementProgress($userId, $targetType, $amount = 1) {
        if ($amount <= 0) return;
        
        try {
            $db = Database::getConnection();
            $now = date('Y-m-d H:i:s');

            // Find all active quests matching this user and target type
            $stmt = $db->prepare("
                UPDATE user_quests uq
                JOIN quests q ON uq.quest_id = q.id
                SET uq.progress = LEAST(q.target_value, uq.progress + ?)
                WHERE uq.user_id = ? 
                  AND q.target_type = ? 
                  AND uq.expires_at > ? 
                  AND uq.is_claimed = 0
            ");
            $stmt->execute([$amount, $userId, $targetType, $now]);
        } catch (Exception $e) {
            // Silently ignore tracking errors to avoid crashing major loops
            error_log("Failed to increment quest progress: " . $e->getMessage());
        }
    }

    /**
     * Internal generation logic (lazy run)
     * Assigns 3 daily quests (1 from Pool A, 1 from Pool B, 1 from Pool C)
     * and 3 weekly quests (1 from Pool 1, 1 from Pool 2, 1 from Pool 3).
     */
    private function generateQuestsIfNeeded($db, $userId) {
        $now = date('Y-m-d H:i:s');
        $stmt = $db->prepare("
            SELECT q.type, q.pool
            FROM user_quests uq
            JOIN quests q ON uq.quest_id = q.id
            WHERE uq.user_id = ? AND uq.expires_at > ?
        ");
        $stmt->execute([$userId, $now]);
        $rows = $stmt->fetchAll(PDO::FETCH_ASSOC);

        $activeDailyPools = [];
        $activeWeeklyPools = [];

        foreach ($rows as $row) {
            if ($row['type'] === 'daily') {
                $activeDailyPools[$row['pool']] = true;
            } elseif ($row['type'] === 'weekly') {
                $activeWeeklyPools[$row['pool']] = true;
            }
        }

        // Daily requires 1 from pool A, 1 from pool B, 1 from pool C
        $missingDailyPools = array_values(array_diff(['A', 'B', 'C'], array_keys($activeDailyPools)));
        if (!empty($missingDailyPools)) {
            $this->assignQuestsForPools($db, $userId, 'daily', $missingDailyPools);
        }

        // Weekly requires 1 from pool 1, 1 from pool 2, 1 from pool 3
        $missingWeeklyPools = array_values(array_diff(['1', '2', '3'], array_keys($activeWeeklyPools)));
        if (!empty($missingWeeklyPools)) {
            $this->assignQuestsForPools($db, $userId, 'weekly', $missingWeeklyPools);
        }
    }

    /**
     * Pick random quests from specified pools and assign them to user
     */
    private function assignQuestsForPools($db, $userId, $type, array $pools) {
        if ($type === 'daily') {
            $expiresAt = date('Y-m-d 23:59:59'); // end of today
        } else {
            // Weekly: end of current week Sunday 23:59:59
            $dayOfWeek = date('w'); // 0 (Sunday) to 6 (Saturday)
            if ($dayOfWeek == 0) {
                $expiresAt = date('Y-m-d 23:59:59');
            } else {
                $expiresAt = date('Y-m-d 23:59:59', strtotime('next Sunday'));
            }
        }

        $stmtInsert = $db->prepare("
            INSERT INTO user_quests (user_id, quest_id, expires_at) 
            VALUES (?, ?, ?)
            ON DUPLICATE KEY UPDATE expires_at = VALUES(expires_at), progress = 0, is_claimed = 0
        ");

        foreach ($pools as $pool) {
            $stmt = $db->prepare("SELECT id FROM quests WHERE type = ? AND pool = ? ORDER BY RAND() LIMIT 1");
            $stmt->execute([$type, $pool]);
            $qid = $stmt->fetchColumn();
            if ($qid) {
                $stmtInsert->execute([$userId, (int) $qid, $expiresAt]);
            }
        }
    }
}
