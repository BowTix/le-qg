<?php
namespace App\Controllers;

use App\Config\Database;
use App\Middleware\AuthMiddleware;
use App\Data\ConnectionsData;
use App\Utils\JWT;

class ConnectionsController {
    /**
     * GET /api/connections/grid?date=YYYY-MM-DD
     * Returns the daily Connections grid + player's saved state.
     */
    public function getGrid() {
        $user = AuthMiddleware::authenticate();
        $userId = (int) $user['user_id'];

        $today = date('Y-m-d');
        $date = trim($_GET['date'] ?? $today);

        if (!preg_match('/^\d{4}-\d{2}-\d{2}$/', $date)) {
            http_response_code(400);
            echo json_encode(["error" => "Format de date invalide (attendu: YYYY-MM-DD)."]);
            return;
        }

        if ($date > $today) {
            http_response_code(403);
            echo json_encode(["error" => "Cette grille n'est pas encore disponible."]);
            return;
        }

        $dailyData = ConnectionsData::getGridForDate($date);
        $categories = $dailyData['categories'];

        $db = Database::getConnection();
        $stmt = $db->prepare("
            SELECT solved_groups, mistakes_remaining, guesses_history, time_spent_seconds, status, coins_awarded, score_awarded, completed_at
            FROM user_connections_attempts
            WHERE user_id = ? AND play_date = ?
        ");
        $stmt->execute([$userId, $date]);
        $attempt = $stmt->fetch();

        $solvedLevels = $attempt ? json_decode($attempt['solved_groups'] ?? '[]', true) : [];
        if (!is_array($solvedLevels)) $solvedLevels = [];

        $guessesHistory = $attempt ? json_decode($attempt['guesses_history'] ?? '[]', true) : [];
        if (!is_array($guessesHistory)) $guessesHistory = [];

        $mistakesRemaining = $attempt ? (int)$attempt['mistakes_remaining'] : 4;
        $status = $attempt ? $attempt['status'] : 'in_progress';

        $clientGrid = ConnectionsData::getClientGrid($categories, $solvedLevels);

        $userState = [
            'play_date' => $date,
            'is_today' => ($date === $today),
            'status' => $status,
            'mistakes_remaining' => $mistakesRemaining,
            'solved_levels' => $solvedLevels,
            'guesses_history' => $guessesHistory,
            'time_spent_seconds' => $attempt ? (int)$attempt['time_spent_seconds'] : 0,
            'coins_awarded' => $attempt ? (int)$attempt['coins_awarded'] : 0,
            'score_awarded' => $attempt ? (int)$attempt['score_awarded'] : 0,
            'completed_at' => $attempt ? $attempt['completed_at'] : null
        ];

        // If completed or failed, reveal all categories
        $revealedAll = null;
        if ($status === 'completed' || $status === 'failed') {
            $revealedAll = $categories;
        }

        echo json_encode([
            'grid' => $clientGrid,
            'user_state' => $userState,
            'all_categories' => $revealedAll
        ]);
    }

    /**
     * POST /api/connections/guess
     * Submits a 4-word guess.
     */
    public function submitGuess(array $data) {
        $user = AuthMiddleware::authenticate();
        $userId = (int) $user['user_id'];

        $words = $data['words'] ?? [];
        if (!is_array($words) || count($words) !== 4) {
            http_response_code(400);
            echo json_encode(["error" => "Sélectionne exactement 4 mots."]);
            return;
        }

        $practiceToken = trim($data['practice_token'] ?? '');
        $timeSpent = max(0, (int)($data['time_spent'] ?? 0));

        // 1. PRACTICE MODE
        if (!empty($practiceToken)) {
            $payload = JWT::decode($practiceToken);
            if (!$payload || ($payload['game'] ?? '') !== 'connections' || empty($payload['categories'])) {
                http_response_code(400);
                echo json_encode(["error" => "Session d'entraînement invalide ou expirée."]);
                return;
            }

            $categories = $payload['categories'];
            $solvedLevels = $payload['solved_levels'] ?? [];
            $mistakesRemaining = (int)($payload['mistakes_remaining'] ?? 4);

            $eval = ConnectionsData::evaluateGuess($categories, $words, $solvedLevels);

            if ($eval['matched']) {
                $solvedLevels[] = $eval['category']['level'];
                $isCompleted = count($solvedLevels) === count($categories);

                $coinsAwarded = 0;
                $scoreAwarded = 0;
                $coins = 0;
                $globalScore = 0;

                if ($isCompleted) {
                    $coinsAwarded = 10;
                    $scoreAwarded = 8;
                    $db = Database::getConnection();
                    $db->prepare("UPDATE users SET coins = coins + ?, global_score = global_score + ? WHERE id = ?")
                       ->execute([$coinsAwarded, $scoreAwarded, $userId]);
                    QuestController::incrementProgress($userId, 'coins_earned', $coinsAwarded);
                    QuestController::incrementProgress($userId, 'xp_earned', $scoreAwarded);
                    QuestController::incrementProgress($userId, 'practice_grids', 1);
                    QuestController::incrementProgress($userId, 'all_logic_grids', 1);

                    $stmtUser = $db->prepare("SELECT coins, global_score FROM users WHERE id = ?");
                    $stmtUser->execute([$userId]);
                    $rowU = $stmtUser->fetch();
                    $coins = (int)($rowU['coins'] ?? 0);
                    $globalScore = (int)($rowU['global_score'] ?? 0);
                }

                // Update token
                $newToken = JWT::encode([
                    'game' => 'connections',
                    'mode' => 'practice',
                    'puzzle_id' => $payload['puzzle_id'] ?? null,
                    'categories' => $categories,
                    'solved_levels' => $solvedLevels,
                    'mistakes_remaining' => $mistakesRemaining
                ], 7200);

                echo json_encode([
                    'matched' => true,
                    'category' => $eval['category'],
                    'one_away' => false,
                    'mistakes_remaining' => $mistakesRemaining,
                    'solved_levels' => $solvedLevels,
                    'status' => $isCompleted ? 'completed' : 'in_progress',
                    'practice_token' => $newToken,
                    'coins_awarded' => $coinsAwarded,
                    'score_awarded' => $scoreAwarded,
                    'coins' => $coins,
                    'global_score' => $globalScore,
                    'all_categories' => $isCompleted ? $categories : null,
                    'message' => $isCompleted ? "Bravo ! Entraînement réussi (+10 Omnis, +8 XP) !" : "Bien vu !"
                ]);
            } else {
                $mistakesRemaining = max(0, $mistakesRemaining - 1);
                $isFailed = $mistakesRemaining === 0;

                $newToken = JWT::encode([
                    'game' => 'connections',
                    'mode' => 'practice',
                    'puzzle_id' => $payload['puzzle_id'] ?? null,
                    'categories' => $categories,
                    'solved_levels' => $solvedLevels,
                    'mistakes_remaining' => $mistakesRemaining
                ], 7200);

                echo json_encode([
                    'matched' => false,
                    'category' => null,
                    'one_away' => $eval['one_away'],
                    'mistakes_remaining' => $mistakesRemaining,
                    'solved_levels' => $solvedLevels,
                    'status' => $isFailed ? 'failed' : 'in_progress',
                    'practice_token' => $newToken,
                    'all_categories' => $isFailed ? $categories : null,
                    'message' => $eval['one_away'] ? "Tu y es presque (3 sur 4) !" : "Pas de lien trouvé."
                ]);
            }
            return;
        }

        // 2. DAILY MODE
        $today = date('Y-m-d');
        $date = trim($data['date'] ?? $today);

        if (!preg_match('/^\d{4}-\d{2}-\d{2}$/', $date) || $date > $today) {
            http_response_code(400);
            echo json_encode(["error" => "Date invalide."]);
            return;
        }

        $db = Database::getConnection();
        $stmt = $db->prepare("
            SELECT id, solved_groups, mistakes_remaining, guesses_history, status
            FROM user_connections_attempts
            WHERE user_id = ? AND play_date = ?
        ");
        $stmt->execute([$userId, $date]);
        $attempt = $stmt->fetch();

        if ($attempt && in_array($attempt['status'], ['completed', 'failed'], true)) {
            http_response_code(400);
            echo json_encode(["error" => "Cette partie est déjà terminée."]);
            return;
        }

        $dailyData = ConnectionsData::getGridForDate($date);
        $categories = $dailyData['categories'];

        $solvedLevels = $attempt ? json_decode($attempt['solved_groups'] ?? '[]', true) : [];
        if (!is_array($solvedLevels)) $solvedLevels = [];

        $guessesHistory = $attempt ? json_decode($attempt['guesses_history'] ?? '[]', true) : [];
        if (!is_array($guessesHistory)) $guessesHistory = [];

        $mistakesRemaining = $attempt ? (int)$attempt['mistakes_remaining'] : 4;

        // Record guess
        $guessesHistory[] = array_map('strtoupper', $words);

        $eval = ConnectionsData::evaluateGuess($categories, $words, $solvedLevels);

        $coinsAwarded = 0;
        $scoreAwarded = 0;
        $newStatus = 'in_progress';

        if ($eval['matched']) {
            $solvedLevels[] = $eval['category']['level'];
            if (count($solvedLevels) === count($categories)) {
                $newStatus = 'completed';
                $coinsAwarded = 60;
                $scoreAwarded = 25;

                $db->prepare("UPDATE users SET coins = coins + ?, global_score = global_score + ? WHERE id = ?")
                   ->execute([$coinsAwarded, $scoreAwarded, $userId]);
                QuestController::incrementProgress($userId, 'coins_earned', $coinsAwarded);
                QuestController::incrementProgress($userId, 'xp_earned', $scoreAwarded);
                QuestController::incrementProgress($userId, 'daily_logic_grid', 1);
                QuestController::incrementProgress($userId, 'all_logic_grids', 1);
            }
        } else {
            $mistakesRemaining = max(0, $mistakesRemaining - 1);
            if ($mistakesRemaining === 0) {
                $newStatus = 'failed';
            }
        }

        // Save to DB
        if ($attempt) {
            $stmtUpdate = $db->prepare("
                UPDATE user_connections_attempts
                SET solved_groups = ?, mistakes_remaining = ?, guesses_history = ?,
                    time_spent_seconds = ?, status = ?,
                    coins_awarded = coins_awarded + ?, score_awarded = score_awarded + ?,
                    completed_at = CASE WHEN ? IN ('completed', 'failed') THEN COALESCE(completed_at, NOW()) ELSE completed_at END
                WHERE id = ?
            ");
            $stmtUpdate->execute([
                json_encode($solvedLevels),
                $mistakesRemaining,
                json_encode($guessesHistory),
                $timeSpent,
                $newStatus,
                $coinsAwarded,
                $scoreAwarded,
                $newStatus,
                $attempt['id']
            ]);
        } else {
            $stmtInsert = $db->prepare("
                INSERT INTO user_connections_attempts (
                    user_id, play_date, solved_groups, mistakes_remaining,
                    guesses_history, time_spent_seconds, status,
                    coins_awarded, score_awarded, completed_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, CASE WHEN ? IN ('completed', 'failed') THEN NOW() ELSE NULL END)
            ");
            $stmtInsert->execute([
                $userId,
                $date,
                json_encode($solvedLevels),
                $mistakesRemaining,
                json_encode($guessesHistory),
                $timeSpent,
                $newStatus,
                $coinsAwarded,
                $scoreAwarded,
                $newStatus
            ]);
        }

        $stmtUser = $db->prepare("SELECT coins, global_score FROM users WHERE id = ?");
        $stmtUser->execute([$userId]);
        $rowU = $stmtUser->fetch();

        echo json_encode([
            'matched' => $eval['matched'],
            'category' => $eval['category'],
            'one_away' => $eval['one_away'],
            'mistakes_remaining' => $mistakesRemaining,
            'solved_levels' => $solvedLevels,
            'status' => $newStatus,
            'coins_awarded' => $coinsAwarded,
            'score_awarded' => $scoreAwarded,
            'coins' => (int)($rowU['coins'] ?? 0),
            'global_score' => (int)($rowU['global_score'] ?? 0),
            'all_categories' => in_array($newStatus, ['completed', 'failed'], true) ? $categories : null,
            'message' => $eval['matched']
                ? ($newStatus === 'completed' ? "Superbe ! Toutes les connexions trouvées (+60 Omnis, +25 XP) !" : "Bien vu !")
                : ($eval['one_away'] ? "Tu y es presque (3 sur 4) !" : "Pas de lien trouvé.")
        ]);
    }

    /**
     * POST /api/connections/save
     * Auto-saves elapsed time.
     */
    public function saveState(array $data) {
        $user = AuthMiddleware::authenticate();
        $userId = (int) $user['user_id'];

        $today = date('Y-m-d');
        $date = trim($data['date'] ?? $today);
        $timeSpent = max(0, (int)($data['time_spent'] ?? 0));

        if (!preg_match('/^\d{4}-\d{2}-\d{2}$/', $date) || $date > $today) {
            http_response_code(400);
            echo json_encode(["error" => "Date invalide."]);
            return;
        }

        $db = Database::getConnection();
        $stmtCheck = $db->prepare("SELECT id, status FROM user_connections_attempts WHERE user_id = ? AND play_date = ?");
        $stmtCheck->execute([$userId, $date]);
        $existing = $stmtCheck->fetch();

        if ($existing) {
            $db->prepare("UPDATE user_connections_attempts SET time_spent_seconds = ? WHERE id = ?")
               ->execute([$timeSpent, $existing['id']]);
        } else {
            $db->prepare("
                INSERT INTO user_connections_attempts (user_id, play_date, solved_groups, mistakes_remaining, guesses_history, time_spent_seconds, status)
                VALUES (?, ?, '[]', 4, '[]', ?, 'in_progress')
            ")->execute([$userId, $date, $timeSpent]);
        }

        echo json_encode(["success" => true]);
    }

    /**
     * GET /api/connections/practice
     * Generates a practice Connections grid.
     */
    public function getPracticeGrid() {
        $user = AuthMiddleware::authenticate();
        $random = ConnectionsData::getRandomPuzzle();

        $clientGrid = ConnectionsData::getClientGrid($random['categories'], []);

        $token = JWT::encode([
            'game' => 'connections',
            'mode' => 'practice',
            'puzzle_id' => $random['puzzle_id'],
            'categories' => $random['categories'],
            'solved_levels' => [],
            'mistakes_remaining' => 4
        ], 7200);

        echo json_encode([
            'grid' => $clientGrid,
            'practice_token' => $token,
            'is_practice' => true,
            'mistakes_remaining' => 4
        ]);
    }

    /**
     * GET /api/connections/calendar?month=YYYY-MM
     * Returns history of played Connections puzzles for a month.
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
            FROM user_connections_attempts
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
