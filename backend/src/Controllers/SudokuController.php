<?php
namespace App\Controllers;

use App\Config\Database;
use App\Middleware\AuthMiddleware;
use App\Data\SudokuGenerator;

class SudokuController {
    /**
     * GET /api/sudoku/grid?date=YYYY-MM-DD
     * Returns the daily Sudoku grid + player's saved state.
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

        $serverGrid = SudokuGenerator::getGridForDate($date);
        $clientGrid = SudokuGenerator::getClientGrid($serverGrid);

        // Fetch user attempt
        $db = Database::getConnection();
        $stmt = $db->prepare("
            SELECT grid_state, notes_state, time_spent_seconds, status, coins_awarded, score_awarded, completed_at
            FROM user_sudoku_attempts
            WHERE user_id = ? AND play_date = ?
        ");
        $stmt->execute([$userId, $date]);
        $attempt = $stmt->fetch();

        $userState = [
            'play_date' => $date,
            'is_today' => ($date === $today),
            'status' => $attempt ? $attempt['status'] : 'in_progress',
            'grid_state' => $attempt ? $attempt['grid_state'] : $clientGrid['initial_grid'],
            'notes_state' => $attempt ? (json_decode($attempt['notes_state'], true) ?: new \stdClass()) : new \stdClass(),
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
     * POST /api/sudoku/save
     * Auto-saves grid state, notes and elapsed time.
     */
    public function saveState(array $data) {
        $user = AuthMiddleware::authenticate();
        $userId = (int) $user['user_id'];

        $today = date('Y-m-d');
        $date = trim($data['date'] ?? $today);
        $gridState = trim($data['grid_state'] ?? '');
        $notesState = $data['notes_state'] ?? [];
        $timeSpent = max(0, (int)($data['time_spent'] ?? 0));

        if (!preg_match('/^\d{4}-\d{2}-\d{2}$/', $date) || $date > $today) {
            http_response_code(400);
            echo json_encode(["error" => "Date invalide."]);
            return;
        }

        if (strlen($gridState) !== 81) {
            http_response_code(400);
            echo json_encode(["error" => "Format de grille invalide (attendu 81 caractères)."]);
            return;
        }

        $db = Database::getConnection();

        // Check existing attempt
        $stmtCheck = $db->prepare("SELECT id, status FROM user_sudoku_attempts WHERE user_id = ? AND play_date = ?");
        $stmtCheck->execute([$userId, $date]);
        $existing = $stmtCheck->fetch();

        $jsonNotes = json_encode($notesState);

        if ($existing) {
            $newStatus = ($existing['status'] === 'completed') ? 'completed' : 'in_progress';
            $stmtUpdate = $db->prepare("
                UPDATE user_sudoku_attempts
                SET grid_state = ?, notes_state = ?, time_spent_seconds = ?, status = ?
                WHERE id = ?
            ");
            $stmtUpdate->execute([$gridState, $jsonNotes, $timeSpent, $newStatus, $existing['id']]);
        } else {
            $stmtInsert = $db->prepare("
                INSERT INTO user_sudoku_attempts (user_id, play_date, grid_state, notes_state, time_spent_seconds, status)
                VALUES (?, ?, ?, ?, ?, 'in_progress')
            ");
            $stmtInsert->execute([$userId, $date, $gridState, $jsonNotes, $timeSpent]);
        }

        echo json_encode(["success" => true]);
    }

    /**
     * GET /api/sudoku/practice
     * Generates an on-the-fly practice Sudoku grid with a signed token.
     */
    public function getPracticeGrid() {
        $user = AuthMiddleware::authenticate();
        $seed = 'practice_' . microtime(true) . '_' . mt_rand(1000, 9999);
        $serverGrid = SudokuGenerator::generateDailyPuzzle($seed, 'moyen');
        $clientGrid = SudokuGenerator::getClientGrid($serverGrid);

        $token = \App\Utils\JWT::encode([
            'game' => 'sudoku',
            'mode' => 'practice',
            'solution' => $serverGrid['solution_grid'],
            'initial' => $serverGrid['initial_grid']
        ], 7200);

        echo json_encode([
            'grid' => $clientGrid,
            'practice_token' => $token,
            'is_practice' => true
        ]);
    }

    /**
     * POST /api/sudoku/validate
     * Validates solution, awards rewards upon completion.
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
            if (!$payload || ($payload['game'] ?? '') !== 'sudoku') {
                http_response_code(400);
                echo json_encode(["error" => "Session d'entraînement invalide ou expirée."]);
                return;
            }

            $validation = SudokuGenerator::validateSolution($payload['solution'], $gridState);
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
                    'message' => "Bravo ! Grille d'entraînement réussie (+10 pièces, +8 XP) !",
                    'coins_awarded' => $coinsToAward,
                    'score_awarded' => $scoreToAward,
                    'coins' => (int)($updatedUser['coins'] ?? 0),
                    'global_score' => (int)($updatedUser['global_score'] ?? 0)
                ]);
            } else {
                $msg = !$validation['is_complete']
                    ? "Il reste encore des cases vides à remplir."
                    : "La grille contient {$validation['errors_count']} chiffre(s) incorrect(s).";

                echo json_encode([
                    'valid' => false,
                    'is_complete' => $validation['is_complete'],
                    'errors_count' => $validation['errors_count'],
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

        $serverGrid = SudokuGenerator::getGridForDate($date);
        $validation = SudokuGenerator::validateSolution($serverGrid['solution_grid'], $gridState);

        $db = Database::getConnection();

        if ($validation['is_valid']) {
            // Check if already completed
            $stmtCheck = $db->prepare("SELECT id, status, coins_awarded, score_awarded FROM user_sudoku_attempts WHERE user_id = ? AND play_date = ?");
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
                    UPDATE user_sudoku_attempts
                    SET grid_state = ?, time_spent_seconds = ?, status = 'completed',
                        coins_awarded = coins_awarded + ?, score_awarded = score_awarded + ?,
                        completed_at = COALESCE(completed_at, NOW())
                    WHERE id = ?
                ");
                $stmtUpdate->execute([$gridState, $timeSpent, $coinsToAward, $scoreToAward, $existing['id']]);
            } else {
                $stmtInsert = $db->prepare("
                    INSERT INTO user_sudoku_attempts (user_id, play_date, grid_state, time_spent_seconds, status, coins_awarded, score_awarded, completed_at)
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
                'message' => "Félicitations ! Grille Sudoku réussie sans aucune erreur !",
                'coins_awarded' => $coinsToAward,
                'score_awarded' => $scoreToAward,
                'coins' => (int)($updatedUser['coins'] ?? 0),
                'global_score' => (int)($updatedUser['global_score'] ?? 0)
            ]);
        } else {
            // Still in progress or contains errors
            $msg = !$validation['is_complete']
                ? "Il reste encore des cases vides à remplir."
                : "La grille contient {$validation['errors_count']} chiffre(s) incorrect(s).";

            echo json_encode([
                'valid' => false,
                'is_complete' => $validation['is_complete'],
                'filled_count' => $validation['filled_count'],
                'errors_count' => $validation['errors_count'],
                'message' => $msg
            ]);
        }
    }

    /**
     * GET /api/sudoku/calendar?month=YYYY-MM
     * Returns history of played Sudoku puzzles for a month.
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
            FROM user_sudoku_attempts
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
