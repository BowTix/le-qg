<?php
namespace App\Controllers;

use App\Config\Database;
use App\Middleware\AuthMiddleware;
use App\Data\QueensGenerator;

class QueensController {
    /**
     * GET /api/queens/grid?date=YYYY-MM-DD
     * Returns the daily Queens grid + player's saved state.
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

        $serverGrid = QueensGenerator::getGridForDate($date);
        $clientGrid = QueensGenerator::getClientGrid($serverGrid);

        // Fetch user attempt
        $db = Database::getConnection();
        $stmt = $db->prepare("
            SELECT grid_state, time_spent_seconds, status, coins_awarded, score_awarded, completed_at
            FROM user_queens_attempts
            WHERE user_id = ? AND play_date = ?
        ");
        $stmt->execute([$userId, $date]);
        $attempt = $stmt->fetch();

        $emptyGrid = str_repeat('.', 64);
        $userState = [
            'play_date' => $date,
            'is_today' => ($date === $today),
            'status' => $attempt ? $attempt['status'] : 'in_progress',
            'grid_state' => $attempt ? $attempt['grid_state'] : $emptyGrid,
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
     * POST /api/queens/save
     * Auto-saves grid state and elapsed time.
     */
    public function saveState(array $data) {
        $user = AuthMiddleware::authenticate();
        $userId = (int) $user['user_id'];

        $today = date('Y-m-d');
        $date = trim($data['date'] ?? $today);
        $gridState = trim($data['grid_state'] ?? '');
        $timeSpent = max(0, (int)($data['time_spent'] ?? 0));

        if (!preg_match('/^\d{4}-\d{2}-\d{2}$/', $date) || $date > $today) {
            http_response_code(400);
            echo json_encode(["error" => "Date invalide."]);
            return;
        }

        if (strlen($gridState) !== 64) {
            http_response_code(400);
            echo json_encode(["error" => "Format de grille invalide (attendu 64 caractères)."]);
            return;
        }

        $db = Database::getConnection();

        // Check existing attempt
        $stmtCheck = $db->prepare("SELECT id, status FROM user_queens_attempts WHERE user_id = ? AND play_date = ?");
        $stmtCheck->execute([$userId, $date]);
        $existing = $stmtCheck->fetch();

        if ($existing) {
            $newStatus = ($existing['status'] === 'completed') ? 'completed' : 'in_progress';
            $stmtUpdate = $db->prepare("
                UPDATE user_queens_attempts
                SET grid_state = ?, time_spent_seconds = ?, status = ?
                WHERE id = ?
            ");
            $stmtUpdate->execute([$gridState, $timeSpent, $newStatus, $existing['id']]);
        } else {
            $stmtInsert = $db->prepare("
                INSERT INTO user_queens_attempts (user_id, play_date, grid_state, time_spent_seconds, status)
                VALUES (?, ?, ?, ?, 'in_progress')
            ");
            $stmtInsert->execute([$userId, $date, $gridState, $timeSpent]);
        }

        echo json_encode(["success" => true]);
    }

    /**
     * GET /api/queens/practice
     * Generates an on-the-fly practice Queens grid with a signed token.
     */
    public function getPracticeGrid() {
        $user = AuthMiddleware::authenticate();
        $seed = 'practice_' . microtime(true) . '_' . mt_rand(1000, 9999);
        $serverGrid = QueensGenerator::generateDailyPuzzle($seed);
        $clientGrid = QueensGenerator::getClientGrid($serverGrid);

        $token = \App\Utils\JWT::encode([
            'game' => 'queens',
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
     * POST /api/queens/validate
     * Validates solution, awards XP and coins upon completion.
     */
    public function validateGrid(array $data) {
        $user = AuthMiddleware::authenticate();
        $userId = (int) $user['user_id'];

        $today = date('Y-m-d');
        $date = trim($data['date'] ?? $today);
        $gridState = trim($data['grid_state'] ?? '');
        $timeSpent = max(0, (int)($data['time_spent'] ?? 0));
        $practiceToken = trim($data['practice_token'] ?? '');

        // Practice mode validation
        if (!empty($practiceToken)) {
            $payload = \App\Utils\JWT::decode($practiceToken);
            if (!$payload || ($payload['game'] ?? '') !== 'queens' || empty($payload['server_grid'])) {
                http_response_code(400);
                echo json_encode(["error" => "Session d'entraînement invalide ou expirée."]);
                return;
            }

            $validation = QueensGenerator::validateSolution($payload['server_grid'], $gridState);
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
                    'message' => "Bravo ! Défi des Reines d'entraînement réussi (+10 pièces, +8 XP) !",
                    'coins_awarded' => $coinsToAward,
                    'score_awarded' => $scoreToAward,
                    'coins' => (int)($updatedUser['coins'] ?? 0),
                    'global_score' => (int)($updatedUser['global_score'] ?? 0)
                ]);
            } else {
                $msg = !empty($validation['errors'])
                    ? implode(' ', $validation['errors'])
                    : "La disposition des reines n'est pas correcte.";

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

        $serverGrid = QueensGenerator::getGridForDate($date);
        $validation = QueensGenerator::validateSolution($serverGrid, $gridState);

        $db = Database::getConnection();

        if ($validation['is_valid']) {
            // Check if already completed
            $stmtCheck = $db->prepare("SELECT id, status, coins_awarded, score_awarded FROM user_queens_attempts WHERE user_id = ? AND play_date = ?");
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

            // Save completed status
            if ($existing) {
                $stmtUpdate = $db->prepare("
                    UPDATE user_queens_attempts
                    SET grid_state = ?, time_spent_seconds = ?, status = 'completed',
                        coins_awarded = coins_awarded + ?, score_awarded = score_awarded + ?,
                        completed_at = COALESCE(completed_at, NOW())
                    WHERE id = ?
                ");
                $stmtUpdate->execute([$gridState, $timeSpent, $coinsToAward, $scoreToAward, $existing['id']]);
            } else {
                $stmtInsert = $db->prepare("
                    INSERT INTO user_queens_attempts (user_id, play_date, grid_state, time_spent_seconds, status, coins_awarded, score_awarded, completed_at)
                    VALUES (?, ?, ?, ?, 'completed', ?, ?, NOW())
                ");
                $stmtInsert->execute([$userId, $date, $gridState, $timeSpent, $coinsToAward, $scoreToAward]);
            }

            // Fetch updated user stats
            $stmtUser = $db->prepare("SELECT coins, global_score FROM users WHERE id = ?");
            $stmtUser->execute([$userId]);
            $updatedUser = $stmtUser->fetch();

            echo json_encode([
                'valid' => true,
                'message' => "Félicitations ! Défi des Reines brillamment réussi !",
                'coins_awarded' => $coinsToAward,
                'score_awarded' => $scoreToAward,
                'coins' => (int)($updatedUser['coins'] ?? 0),
                'global_score' => (int)($updatedUser['global_score'] ?? 0)
            ]);
        } else {
            $msg = !empty($validation['errors'])
                ? implode(' ', $validation['errors'])
                : "La disposition des reines n'est pas correcte.";

            echo json_encode([
                'valid' => false,
                'is_complete' => $validation['is_complete'],
                'queens_count' => $validation['queens_count'],
                'errors' => $validation['errors'],
                'message' => $msg
            ]);
        }
    }

    /**
     * GET /api/queens/calendar?month=YYYY-MM
     * Returns history of played Queens puzzles for a month.
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
            FROM user_queens_attempts
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
