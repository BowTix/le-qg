<?php
namespace App\Controllers;

use App\Config\Database;
use App\Middleware\AuthMiddleware;
use App\Data\MysteryWordsData;

class MysteryWordController {
    /**
     * GET /api/mystery-word/status
     * Returns today's game progress for the authenticated user.
     */
    public function getStatus() {
        $user = AuthMiddleware::authenticate();
        $db = Database::getConnection();

        $today = date('Y-m-d');
        $targetWord = MysteryWordsData::getDailyWord($today);

        $stmt = $db->prepare("
            SELECT guesses, status, attempts_count, score_awarded, coins_awarded
            FROM user_mystery_word_attempts
            WHERE user_id = ? AND game_date = ?
        ");
        $stmt->execute([$user['user_id'], $today]);
        $attempt = $stmt->fetch();

        if (!$attempt) {
            echo json_encode([
                "date" => $today,
                "played" => false,
                "status" => "in_progress",
                "attempts_count" => 0,
                "max_attempts" => 6,
                "word_length" => 5,
                "guesses" => [],
                "target_word" => null
            ]);
            return;
        }

        $isGameOver = in_array($attempt['status'], ['won', 'lost'], true);
        $guesses = json_decode($attempt['guesses'], true) ?: [];

        echo json_encode([
            "date" => $today,
            "played" => $isGameOver,
            "status" => $attempt['status'],
            "attempts_count" => (int) $attempt['attempts_count'],
            "max_attempts" => 6,
            "word_length" => 5,
            "guesses" => $guesses,
            "target_word" => $isGameOver ? $targetWord : null,
            "score_awarded" => (int) $attempt['score_awarded'],
            "coins_awarded" => (int) $attempt['coins_awarded']
        ]);
    }

    /**
     * POST /api/mystery-word/guess
     * Submits a 5-letter guess.
     */
    public function submitGuess(array $data) {
        $user = AuthMiddleware::authenticate();
        $userId = (int) $user['user_id'];
        $rawGuess = trim($data['guess'] ?? '');
        $guess = MysteryWordsData::normalizeWord($rawGuess);

        // Validation format
        if (strlen($guess) !== 5 || !preg_match('/^[A-Z]{5}$/', $guess)) {
            http_response_code(400);
            echo json_encode(["error" => "Le mot doit comporter exactement 5 lettres (sans chiffres ni caractères spéciaux)."]);
            return;
        }

        // Validation dictionnaire
        if (!MysteryWordsData::isValidWord($guess)) {
            http_response_code(400);
            echo json_encode(["error" => "Ce mot n'est pas dans le dictionnaire."]);
            return;
        }

        $today = date('Y-m-d');
        $targetWord = MysteryWordsData::getDailyWord($today);

        $db = Database::getConnection();

        // Récupérer la tentative en cours du joueur
        $stmt = $db->prepare("
            SELECT id, guesses, status, attempts_count
            FROM user_mystery_word_attempts
            WHERE user_id = ? AND game_date = ?
        ");
        $stmt->execute([$userId, $today]);
        $attempt = $stmt->fetch();

        if ($attempt && in_array($attempt['status'], ['won', 'lost'], true)) {
            http_response_code(400);
            echo json_encode(["error" => "Votre défi Mot Mystère du jour est déjà terminé !"]);
            return;
        }

        $guesses = $attempt ? (json_decode($attempt['guesses'], true) ?: []) : [];

        if (count($guesses) >= 6) {
            http_response_code(400);
            echo json_encode(["error" => "Vous avez atteint la limite de 6 essais pour aujourd'hui."]);
            return;
        }

        // Évaluer le mot selon l'algorithme officiel Wordle 2-pass
        $evaluation = MysteryWordsData::evaluateGuess($guess, $targetWord);

        $guesses[] = [
            "word" => $guess,
            "evaluation" => $evaluation
        ];

        $attemptNumber = count($guesses);
        $isWin = ($guess === $targetWord);
        $isLoss = (!$isWin && $attemptNumber >= 6);

        $status = 'in_progress';
        $scoreAwarded = 0;
        $coinsAwarded = 0;

        if ($isWin) {
            $status = 'won';
            // Section 4.1: Mot Mystère: 70 coins, 30 XP
            $coinsAwarded = 70;
            $scoreAwarded = 30;
        } elseif ($isLoss) {
            $status = 'lost';
            $coinsAwarded = 5; // Récompense de participation
            $scoreAwarded = 5;
        }

        // Sauvegarde en base
        $jsonGuesses = json_encode($guesses);

        if ($attempt) {
            $stmtUpdate = $db->prepare("
                UPDATE user_mystery_word_attempts
                SET guesses = ?, status = ?, attempts_count = ?, score_awarded = ?, coins_awarded = ?
                WHERE id = ?
            ");
            $stmtUpdate->execute([$jsonGuesses, $status, $attemptNumber, $scoreAwarded, $coinsAwarded, $attempt['id']]);
        } else {
            $stmtInsert = $db->prepare("
                INSERT INTO user_mystery_word_attempts (user_id, game_date, guesses, status, attempts_count, score_awarded, coins_awarded)
                VALUES (?, ?, ?, ?, ?, ?, ?)
            ");
            $stmtInsert->execute([$userId, $today, $jsonGuesses, $status, $attemptNumber, $scoreAwarded, $coinsAwarded]);
        }

        // Attribution des récompenses au joueur
        if ($scoreAwarded > 0 || $coinsAwarded > 0) {
            $stmtUserUpdate = $db->prepare("
                UPDATE users
                SET global_score = global_score + ?, coins = coins + ?
                WHERE id = ?
            ");
            $stmtUserUpdate->execute([$scoreAwarded, $coinsAwarded, $userId]);

            // Quêtes
            if (class_exists('\App\Controllers\QuestController')) {
                if ($coinsAwarded > 0) {
                    \App\Controllers\QuestController::incrementProgress($userId, 'coins_earned', $coinsAwarded);
                }
                if ($scoreAwarded > 0) {
                    \App\Controllers\QuestController::incrementProgress($userId, 'xp_earned', $scoreAwarded);
                }
                \App\Controllers\QuestController::incrementProgress($userId, 'daily_rituals', 1);

                if ($isWin) {
                    \App\Controllers\QuestController::incrementProgress($userId, 'solo_games_won', 1);
                    if (count($guesses) <= 4) {
                        \App\Controllers\QuestController::incrementProgress($userId, 'mystery_word_fast', 1);
                    }
                }
            }
        }

        // Récupérer le score et les coins à jour de l'utilisateur
        $stmtUser = $db->prepare("SELECT global_score, coins FROM users WHERE id = ?");
        $stmtUser->execute([$userId]);
        $updatedUser = $stmtUser->fetch();

        echo json_encode([
            "success" => true,
            "guess" => $guess,
            "evaluation" => $evaluation,
            "status" => $status,
            "attempts_count" => $attemptNumber,
            "max_attempts" => 6,
            "is_game_over" => ($isWin || $isLoss),
            "target_word" => ($isWin || $isLoss) ? $targetWord : null,
            "score_awarded" => $scoreAwarded,
            "coins_awarded" => $coinsAwarded,
            "global_score" => (int) ($updatedUser['global_score'] ?? 0),
            "coins" => (int) ($updatedUser['coins'] ?? 0)
        ]);
    }
}
