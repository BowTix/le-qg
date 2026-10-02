<?php
namespace App\Controllers;

use App\Config\Database;
use App\Middleware\AuthMiddleware;
use App\Data\ShikakuGenerator;

class ShikakuController {
    /**
     * GET /api/shikaku/grid?date=YYYY-MM-DD
     * Returns the daily Shikaku grid + player's saved state.
     */
    public function getGrid() {
        $user = AuthMiddleware::authenticate();
        $userId = (int) $user['user_id'];

        $today = date('Y-m-d');
        $date = trim($_GET['date'] ?? $today);

        // Validate date format YYYY-MM-DD
        if (!preg_match('/^\d{4}-\d{2}-\d{2}$/', $date)) {
            http_response_code(400);
            echo json_encode(["error" => "Format de date invalide (attendu: YYYY-MM-DD)."]);
            return;
        }

        // Prevent playing future dates
        if ($date > $today) {
            http_response_code(403);
            echo json_encode(["error" => "Cette grille n'est pas encore disponible."]);
            return;
        }

        $serverGrid = ShikakuGenerator::getGridForDate($date);
        $clientGrid = ShikakuGenerator::getClientGrid($serverGrid);

        // Fetch user attempt
        $db = Database::getConnection();
        $stmt = $db->prepare("
            SELECT rectangles_state, time_spent_seconds, status, coins_awarded, score_awarded, completed_at
            FROM user_shikaku_attempts
            WHERE user_id = ? AND play_date = ?
        ");
        $stmt->execute([$userId, $date]);
        $attempt = $stmt->fetch();

        $userState = [
            'play_date' => $date,
            'is_today' => ($date === $today),
            'status' => $attempt ? $attempt['status'] : 'in_progress',
            'rectangles_state' => $attempt ? (json_decode($attempt['rectangles_state'], true) ?: []) : [],
            'time_spent_seconds' => $attempt ? (int)$attempt['time_spent_seconds'] : 0,
            'coins_awarded' => $attempt ? (int)$attempt['coins_awarded'] : 0,
            'score_awarded' => $attempt ? (int)$attempt['score_awarded'] : 0,
            'completed_at' => $attempt ? $attempt['completed_at'] : null
        ];

        echo json_encode([
            'grid' => $clientGrid,
            'user_state' => $userState
        ]);
    }

    /**
     * POST /api/shikaku/save
     * Auto-saves rectangles state and elapsed time.
     */
    public function saveState(array $data) {
        $user = AuthMiddleware::authenticate();
        $userId = (int) $user['user_id'];

        $today = date('Y-m-d');
        $date = trim($data['date'] ?? $today);
        $rectanglesState = $data['rectangles_state'] ?? [];
        $timeSpent = max(0, (int)($data['time_spent'] ?? 0));

        if (!preg_match('/^\d{4}-\d{2}-\d{2}$/', $date) || $date > $today) {
            http_response_code(400);
            echo json_encode(["error" => "Date invalide."]);
            return;
        }

        if (!is_array($rectanglesState)) {
            http_response_code(400);
            echo json_encode(["error" => "Format de rectangles invalide."]);
            return;
        }

        $db = Database::getConnection();
        $jsonRects = json_encode($rectanglesState);

        // Check existing attempt
        $stmtCheck = $db->prepare("SELECT id, status FROM user_shikaku_attempts WHERE user_id = ? AND play_date = ?");
        $stmtCheck->execute([$userId, $date]);
        $existing = $stmtCheck->fetch();

        if ($existing) {
            $newStatus = ($existing['status'] === 'completed') ? 'completed' : 'in_progress';
            $stmtUpdate = $db->prepare("
                UPDATE user_shikaku_attempts
                SET rectangles_state = ?, time_spent_seconds = ?, status = ?
                WHERE id = ?
            ");
            $stmtUpdate->execute([$jsonRects, $timeSpent, $newStatus, $existing['id']]);
        } else {
            $stmtInsert = $db->prepare("
                INSERT INTO user_shikaku_attempts (user_id, play_date, rectangles_state, time_spent_seconds, status)
                VALUES (?, ?, ?, ?, 'in_progress')
            ");
            $stmtInsert->execute([$userId, $date, $jsonRects, $timeSpent]);
        }

        echo json_encode(["success" => true]);
    }

    /**
     * GET /api/shikaku/practice
     * Generates an on-the-fly practice Shikaku grid with a signed token.
     */
    public function getPracticeGrid() {
        $user = AuthMiddleware::authenticate();
        $seed = 'practice_' . microtime(true) . '_' . mt_rand(1000, 9999);
        $serverGrid = ShikakuGenerator::generateDailyPuzzle($seed);
        $clientGrid = ShikakuGenerator::getClientGrid($serverGrid);

        $token = \App\Utils\JWT::encode([
            'game' => 'shikaku',
            'mode' => 'practice',
            'server_grid' => $serverGrid
        ], 7200);

        echo json_encode([
            'grid' => $clientGrid,
            'practice_token' => $token,
            'is_practice' => true
        ]);
    }

    /**
     * POST /api/shikaku/validate
     * Validates solution, awards XP and coins upon completion.
     */
    public function validateGrid(array $data) {
        $user = AuthMiddleware::authenticate();
        $userId = (int) $user['user_id'];

        $today = date('Y-m-d');
        $date = trim($data['date'] ?? $today);
        $rectanglesState = $data['rectangles_state'] ?? [];
        $timeSpent = max(0, (int)($data['time_spent'] ?? 0));
        $practiceToken = trim($data['practice_token'] ?? '');

        if (!is_array($rectanglesState)) {
            http_response_code(400);
            echo json_encode(["error" => "Format de rectangles invalide."]);
            return;
        }

        // Practice mode validation
        if (!empty($practiceToken)) {
            $payload = \App\Utils\JWT::decode($practiceToken);
            if (!$payload || ($payload['game'] ?? '') !== 'shikaku' || empty($payload['server_grid'])) {
                http_response_code(400);
                echo json_encode(["error" => "Session d'entraînement invalide ou expirée."]);
                return;
            }

            $validation = ShikakuGenerator::validateSolution($payload['server_grid'], $rectanglesState);
            if ($validation['is_valid']) {
                $coinsToAward = 10;
                $scoreToAward = 8;

                $db = Database::getConnection();
                $db->prepare("UPDATE users SET coins = coins + ?, global_score = global_score + ? WHERE id = ?")
                   ->execute([$coinsToAward, $scoreToAward, $userId]);
                \App\Controllers\QuestController::incrementProgress($userId, 'coins_earned', $coinsToAward);
                \App\Controllers\QuestController::incrementProgress($userId, 'xp_earned', $scoreToAward);
                \App\Controllers\QuestController::incrementProgress($userId, 'practice_grids', 1);
                \App\Controllers\QuestController::incrementProgress($userId, 'all_logic_grids', 1);

                $stmtUser = $db->prepare("SELECT coins, global_score FROM users WHERE id = ?");
                $stmtUser->execute([$userId]);
                $updatedUser = $stmtUser->fetch();

                echo json_encode([
                    'valid' => true,
                    'is_practice' => true,
                    'message' => "Bravo ! Découpage Shikaku d'entraînement réussi (+10 Omnis, +8 XP) !",
                    'coins_awarded' => $coinsToAward,
                    'score_awarded' => $scoreToAward,
                    'coins' => (int)($updatedUser['coins'] ?? 0),
                    'global_score' => (int)($updatedUser['global_score'] ?? 0)
                ]);
            } else {
                $msg = !empty($validation['errors'])
                    ? implode(' ', $validation['errors'])
                    : "Le découpage n'est pas correct.";

                echo json_encode([
                    'valid' => false,
                    'errors' => $validation['errors'],
                    'message' => $msg
                ]);
            }
            return;
        }

        if (!preg_match('/^\d{4}-\d{2}-\d{2}$/', $date) || $date > $today) {
            http_response_code(400);
            echo json_encode(["error" => "Date invalide."]);
            return;
        }

        $serverGrid = ShikakuGenerator::getGridForDate($date);
        $validation = ShikakuGenerator::validateSolution($serverGrid, $rectanglesState);

        $db = Database::getConnection();

        if ($validation['is_valid']) {
            // Check if already completed
            $stmtCheck = $db->prepare("SELECT id, status, coins_awarded, score_awarded FROM user_shikaku_attempts WHERE user_id = ? AND play_date = ?");
            $stmtCheck->execute([$userId, $date]);
            $existing = $stmtCheck->fetch();

            $coinsToAward = 0;
            $scoreToAward = 0;

            if (!$existing || $existing['status'] !== 'completed') {
                // Section 4.1: Grille du Jour (60 coins / 25 XP)
                $coinsToAward = 60;
                $scoreToAward = 25;

                // Credit user coins and global_score
                $stmtCredit = $db->prepare("UPDATE users SET coins = coins + ?, global_score = global_score + ? WHERE id = ?");
                $stmtCredit->execute([$coinsToAward, $scoreToAward, $userId]);
                \App\Controllers\QuestController::incrementProgress($userId, 'coins_earned', $coinsToAward);
                \App\Controllers\QuestController::incrementProgress($userId, 'xp_earned', $scoreToAward);
                \App\Controllers\QuestController::incrementProgress($userId, 'daily_logic_grid', 1);
                \App\Controllers\QuestController::incrementProgress($userId, 'all_logic_grids', 1);
            }

            $jsonRects = json_encode($rectanglesState);

            // Save completed status
            if ($existing) {
                $stmtUpdate = $db->prepare("
                    UPDATE user_shikaku_attempts
                    SET rectangles_state = ?, time_spent_seconds = ?, status = 'completed',
                        coins_awarded = coins_awarded + ?, score_awarded = score_awarded + ?,
                        completed_at = COALESCE(completed_at, NOW())
                    WHERE id = ?
                ");
                $stmtUpdate->execute([$jsonRects, $timeSpent, $coinsToAward, $scoreToAward, $existing['id']]);
            } else {
                $stmtInsert = $db->prepare("
                    INSERT INTO user_shikaku_attempts (user_id, play_date, rectangles_state, time_spent_seconds, status, coins_awarded, score_awarded, completed_at)
                    VALUES (?, ?, ?, ?, 'completed', ?, ?, NOW())
                ");
                $stmtInsert->execute([$userId, $date, $jsonRects, $timeSpent, $coinsToAward, $scoreToAward]);
            }

            // Fetch updated user stats
            $stmtUser = $db->prepare("SELECT coins, global_score FROM users WHERE id = ?");
            $stmtUser->execute([$userId]);
            $updatedUser = $stmtUser->fetch();

            echo json_encode([
                'valid' => true,
                'message' => "Félicitations ! Découpage Shikaku parfaitement réussi !",
                'coins_awarded' => $coinsToAward,
                'score_awarded' => $scoreToAward,
                'coins' => (int)($updatedUser['coins'] ?? 0),
                'global_score' => (int)($updatedUser['global_score'] ?? 0)
            ]);
        } else {
            $msg = !empty($validation['errors'])
                ? implode(' ', $validation['errors'])
                : "Le découpage n'est pas correct.";

            echo json_encode([
                'valid' => false,
                'is_complete' => $validation['is_complete'],
                'covered_cells' => $validation['covered_cells'],
                'total_cells' => $validation['total_cells'],
                'rectangles_count' => $validation['rectangles_count'],
                'errors' => $validation['errors'],
                'message' => $msg
            ]);
        }
    }

    /**
     * GET /api/shikaku/calendar?month=YYYY-MM
     * Returns history of played Shikaku puzzles for a month.
     */
    public function getCalendar() {
        $user = AuthMiddleware::authenticate();
        $userId = (int) $user['user_id'];

        $month = trim($_GET['month'] ?? date('Y-m'));
        if (!preg_match('/^\d{4}-\d{2}$/', $month)) {
            $month = date('Y-m');
        }

        $db = Database::getConnection();
        $stmt = $db->prepare("
            SELECT play_date, status, time_spent_seconds, completed_at
            FROM user_shikaku_attempts
            WHERE user_id = ? AND play_date LIKE ?
            ORDER BY play_date DESC
        ");
        $stmt->execute([$userId, $month . '-%']);
        $rows = $stmt->fetchAll();

        $history = [];
        foreach ($rows as $r) {
            $history[$r['play_date']] = [
                'status' => $r['status'],
                'time_spent_seconds' => (int)$r['time_spent_seconds'],
                'completed_at' => $r['completed_at']
            ];
        }

        echo json_encode([
            'month' => $month,
            'history' => $history
        ]);
    }
}
