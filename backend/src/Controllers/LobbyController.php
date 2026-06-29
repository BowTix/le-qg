<?php
namespace App\Controllers;

use App\Config\Database;
use App\Middleware\AuthMiddleware;
use App\Utils\JWT;

class LobbyController
{
    // ================================================================
    // CREATE LOBBY
    // ================================================================
    public function create()
    {
        $user = AuthMiddleware::authenticate();
        $data = json_decode(file_get_contents('php://input'), true);

        $packId = intval($data['pack_id'] ?? 0);
        if ($packId <= 0) {
            http_response_code(400);
            echo json_encode(['error' => 'pack_id requis.']);
            return;
        }

        $db = Database::getConnection();

        // Verify pack exists and is validated
        $stmtPack = $db->prepare("SELECT id, name, is_validated FROM packs WHERE id = ?");
        $stmtPack->execute([$packId]);
        $pack = $stmtPack->fetch();

        if (!$pack) {
            http_response_code(404);
            echo json_encode(['error' => 'Pack introuvable.']);
            return;
        }

        if (!$pack['is_validated'] && $user['role'] !== 'admin') {
            http_response_code(403);
            echo json_encode(['error' => 'Ce pack n\'est pas encore validé.']);
            return;
        }

        // Generate unique 5-char room code
        $chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
        do {
            $roomCode = '';
            for ($i = 0; $i < 5; $i++) {
                $roomCode .= $chars[random_int(0, strlen($chars) - 1)];
            }
            $checkStmt = $db->prepare("SELECT id FROM lobbies WHERE room_code = ? AND status != 'finished'");
            $checkStmt->execute([$roomCode]);
        } while ($checkStmt->fetch());

        // Insert lobby (always classic mode)
        $stmt = $db->prepare("INSERT INTO lobbies (room_code, host_id, pack_id, status, game_mode, current_question_index) VALUES (?, ?, ?, 'waiting', 'classic', 0)");
        $stmt->execute([$roomCode, $user['user_id'], $packId]);
        $lobbyId = $db->lastInsertId();

        // Insert host as player
        $stmt = $db->prepare("INSERT INTO lobby_players (lobby_id, user_id, current_score, is_eliminated, current_question_index, finished_at) VALUES (?, ?, 0, 0, 0, NULL)");
        $stmt->execute([$lobbyId, $user['user_id']]);

        echo json_encode(['success' => true, 'room_code' => $roomCode, 'lobby_id' => intval($lobbyId)]);
    }

    // ================================================================
    // JOIN LOBBY
    // ================================================================
    public function join()
    {
        $user = AuthMiddleware::authenticate();
        $data = json_decode(file_get_contents('php://input'), true);

        $roomCode = strtoupper(trim($data['room_code'] ?? ''));
        if (strlen($roomCode) !== 5) {
            http_response_code(400);
            echo json_encode(['error' => 'Code de salon invalide (5 caractères requis).']);
            return;
        }

        $db = Database::getConnection();

        $stmtLobby = $db->prepare("SELECT * FROM lobbies WHERE room_code = ?");
        $stmtLobby->execute([$roomCode]);
        $lobby = $stmtLobby->fetch();

        if (!$lobby) {
            http_response_code(404);
            echo json_encode(['error' => 'Salon introuvable.']);
            return;
        }

        if ($lobby['status'] !== 'waiting') {
            http_response_code(400);
            echo json_encode(['error' => 'Impossible de rejoindre : la partie est déjà en cours ou terminée.']);
            return;
        }

        // Check if player already exists
        $stmtCheck = $db->prepare("SELECT user_id FROM lobby_players WHERE lobby_id = ? AND user_id = ?");
        $stmtCheck->execute([$lobby['id'], $user['user_id']]);

        if (!$stmtCheck->fetch()) {
            // New player — insert
            $stmtInsert = $db->prepare("INSERT INTO lobby_players (lobby_id, user_id, current_score, is_eliminated, current_question_index, finished_at) VALUES (?, ?, 0, 0, 0, NULL)");
            $stmtInsert->execute([$lobby['id'], $user['user_id']]);
        } else {
            // Existing player — reset state
            $stmtReset = $db->prepare("UPDATE lobby_players SET current_score = 0, is_eliminated = 0, current_question_index = 0, finished_at = NULL, last_guess = NULL, reaction = NULL, reaction_sent_at = NULL WHERE lobby_id = ? AND user_id = ?");
            $stmtReset->execute([$lobby['id'], $user['user_id']]);
        }

        echo json_encode(['success' => true, 'room_code' => $roomCode, 'lobby_id' => intval($lobby['id'])]);
    }

    // ================================================================
    // STATUS (polling endpoint)
    // ================================================================
    public function status($queryParams)
    {
        $user = AuthMiddleware::authenticate();
        $roomCode = strtoupper(trim($queryParams['room_code'] ?? ''));

        $db = Database::getConnection();

        // Fetch lobby with host username and pack name
        $stmt = $db->prepare("
            SELECT l.*, u.username as host_username, p.name as pack_name
            FROM lobbies l
            JOIN users u ON l.host_id = u.id
            JOIN packs p ON l.pack_id = p.id
            WHERE l.room_code = ?
        ");
        $stmt->execute([$roomCode]);
        $lobby = $stmt->fetch();

        if (!$lobby) {
            http_response_code(404);
            echo json_encode(['error' => 'Salon introuvable.']);
            return;
        }

        // Fetch all players sorted by score
        $stmtPlayers = $db->prepare("
            SELECT lp.user_id, lp.current_score, lp.current_question_index, lp.finished_at,
                   lp.elo_change, lp.reaction, lp.reaction_sent_at,
                   u.username, u.global_score, u.elo
            FROM lobby_players lp
            JOIN users u ON lp.user_id = u.id
            WHERE lp.lobby_id = ?
            ORDER BY lp.current_score DESC
        ");
        $stmtPlayers->execute([$lobby['id']]);
        $playersRaw = $stmtPlayers->fetchAll();

        $nowMs = round(microtime(true) * 1000);

        // Build players array
        $players = [];
        foreach ($playersRaw as $p) {
            // Reactions with 3-second TTL
            $reaction = null;
            if ($p['reaction'] && $p['reaction_sent_at'] && ($nowMs - intval($p['reaction_sent_at'])) < 3000) {
                $reaction = $p['reaction'];
            }

            $playerData = [
                'user_id' => intval($p['user_id']),
                'username' => $p['username'],
                'score' => intval($p['current_score']),
                'current_question_index' => intval($p['current_question_index']),
                'finished' => $p['finished_at'] !== null,
                'global_score' => intval($p['global_score']),
                'elo' => intval($p['elo']),
                'reaction' => $reaction
            ];

            // Only expose Elo and Coin changes when game is finished
            if ($lobby['status'] === 'finished') {
                $elo = intval($p['elo_change']);
                $playerData['elo_change'] = $elo;
                if ($elo === 15) {
                    $playerData['coin_bonus'] = 100;
                } else if ($elo === 5) {
                    $playerData['coin_bonus'] = 50;
                } else if ($elo === -10) {
                    $playerData['coin_bonus'] = 10;
                } else {
                    $playerData['coin_bonus'] = 25;
                }
            }

            $players[] = $playerData;
        }

        // Calculate countdown remaining
        $countdownRemainingMs = 0;
        if ($lobby['status'] === 'playing' && $lobby['game_started_at']) {
            $countdownRemainingMs = max(0, intval($lobby['game_started_at']) - $nowMs);
        }

        $totalQuestions = 10;
        if ($lobby['questions_list']) {
            $totalQuestions = count(explode(',', $lobby['questions_list']));
        }

        $response = [
            'id' => intval($lobby['id']),
            'room_code' => $lobby['room_code'],
            'status' => $lobby['status'],
            'game_mode' => $lobby['game_mode'],
            'host_id' => intval($lobby['host_id']),
            'host_username' => $lobby['host_username'],
            'pack_name' => $lobby['pack_name'],
            'players' => $players,
            'countdown_remaining_ms' => intval($countdownRemainingMs),
            'total_questions' => $totalQuestions
        ];

        echo json_encode($response);
    }

    // ================================================================
    // START GAME (host only — replaces old nextQuestion for the start)
    // ================================================================
    public function startGame()
    {
        $user = AuthMiddleware::authenticate();
        $data = json_decode(file_get_contents('php://input'), true);

        $roomCode = strtoupper(trim($data['room_code'] ?? ''));

        $db = Database::getConnection();

        $stmtLobby = $db->prepare("SELECT * FROM lobbies WHERE room_code = ?");
        $stmtLobby->execute([$roomCode]);
        $lobby = $stmtLobby->fetch();

        if (!$lobby) {
            http_response_code(404);
            echo json_encode(['error' => 'Salon introuvable.']);
            return;
        }

        if ($lobby['status'] !== 'waiting') {
            http_response_code(400);
            echo json_encode(['error' => 'La partie a déjà été lancée.']);
            return;
        }

        // Host-only check
        if (intval($lobby['host_id']) !== $user['user_id']) {
            http_response_code(403);
            echo json_encode(['error' => 'Seul l\'hôte peut lancer la partie.']);
            return;
        }

        // Select 10 random questions from the pack
        $stmtQuestions = $db->prepare("SELECT id FROM questions WHERE pack_id = ? ORDER BY RAND() LIMIT 10");
        $stmtQuestions->execute([$lobby['pack_id']]);
        $questionRows = $stmtQuestions->fetchAll();

        if (empty($questionRows)) {
            http_response_code(400);
            echo json_encode(['error' => 'Ce pack ne contient aucune question.']);
            return;
        }

        $questionIds = array_column($questionRows, 'id');
        $questionsList = implode(',', $questionIds);

        // Set game_started_at = now + 3 seconds (countdown)
        $nowMs = round(microtime(true) * 1000);
        $gameStartedAt = $nowMs + 3000; // 3-second countdown

        // Update lobby: status=playing, store questions, set start time
        $stmtUpdate = $db->prepare("
            UPDATE lobbies
            SET status = 'playing',
                questions_list = ?,
                game_started_at = ?,
                current_question_index = 0,
                current_question_id = NULL
            WHERE id = ?
        ");
        $stmtUpdate->execute([$questionsList, $gameStartedAt, $lobby['id']]);

        // Reset all players
        $stmtReset = $db->prepare("
            UPDATE lobby_players
            SET current_score = 0,
                current_question_index = 0,
                finished_at = NULL,
                is_eliminated = 0,
                last_answered_question_id = NULL,
                last_guess = NULL,
                reaction = NULL,
                reaction_sent_at = NULL,
                elo_change = 0
            WHERE lobby_id = ?
        ");
        $stmtReset->execute([$lobby['id']]);

        echo json_encode([
            'success' => true,
            'message' => 'La partie commence !',
            'countdown_ms' => 3000
        ]);
    }

    // ================================================================
    // GET MY QUESTION (per-player question fetch)
    // ================================================================
    public function getMyQuestion($queryParams)
    {
        $user = AuthMiddleware::authenticate();
        $roomCode = strtoupper(trim($queryParams['room_code'] ?? ''));
        $requestedIndex = intval($queryParams['question_index'] ?? -1);

        $db = Database::getConnection();

        // Fetch lobby
        $stmtLobby = $db->prepare("SELECT * FROM lobbies WHERE room_code = ?");
        $stmtLobby->execute([$roomCode]);
        $lobby = $stmtLobby->fetch();

        if (!$lobby) {
            http_response_code(404);
            echo json_encode(['error' => 'Salon introuvable.']);
            return;
        }

        if ($lobby['status'] !== 'playing') {
            http_response_code(400);
            echo json_encode(['error' => 'La partie n\'est pas en cours.']);
            return;
        }

        // Check countdown has elapsed (with 1000ms grace period to tolerate client-server clock drift/lag)
        $nowMs = round(microtime(true) * 1000);
        if ($lobby['game_started_at'] && ($nowMs + 1000) < intval($lobby['game_started_at'])) {
            http_response_code(400);
            echo json_encode(['error' => 'Le compte à rebours n\'est pas terminé.']);
            return;
        }

        // Fetch player
        $stmtPlayer = $db->prepare("SELECT * FROM lobby_players WHERE lobby_id = ? AND user_id = ?");
        $stmtPlayer->execute([$lobby['id'], $user['user_id']]);
        $player = $stmtPlayer->fetch();

        if (!$player) {
            http_response_code(403);
            echo json_encode(['error' => 'Vous n\'êtes pas dans ce salon.']);
            return;
        }

        // Verify requested index matches player's current progress
        $playerIndex = intval($player['current_question_index']);
        if ($requestedIndex !== $playerIndex) {
            http_response_code(400);
            echo json_encode(['error' => "Index de question invalide. Votre index actuel est $playerIndex."]);
            return;
        }

        // Get question IDs list
        $questionIds = explode(',', $lobby['questions_list']);
        if ($requestedIndex >= count($questionIds)) {
            http_response_code(400);
            echo json_encode(['error' => 'Toutes les questions ont été répondues.']);
            return;
        }

        $questionId = intval($questionIds[$requestedIndex]);

        // Fetch question details
        $stmtQ = $db->prepare("SELECT id, question_text, question_type, correct_opt, opt_a, opt_b, opt_c, opt_d FROM questions WHERE id = ?");
        $stmtQ->execute([$questionId]);
        $question = $stmtQ->fetch();

        if (!$question) {
            http_response_code(500);
            echo json_encode(['error' => 'Question introuvable dans la base.']);
            return;
        }

        $questionType = $question['question_type'] ?? 'multiple_choice';
        $shuffledOptions = null;
        $correctOpt = 'A'; // default fallback for token

        if ($questionType === 'open') {
            $shuffledOptions = null;
        } else {
            $shuffledValues = [$question['opt_a'], $question['opt_b'], $question['opt_c'], $question['opt_d']];
            shuffle($shuffledValues);
            
            $shuffledOptions = [
                'A' => $shuffledValues[0],
                'B' => $shuffledValues[1],
                'C' => $shuffledValues[2],
                'D' => $shuffledValues[3]
            ];
            
            $optMap = ['A' => 'opt_a', 'B' => 'opt_b', 'C' => 'opt_c', 'D' => 'opt_d'];
            $correctAnswerText = $question[$optMap[$question['correct_opt']]] ?? '';
            
            foreach ($shuffledOptions as $key => $val) {
                if ($val === $correctAnswerText) {
                    $correctOpt = $key;
                    break;
                }
            }
        }

        // Generate signed answer token (expires in 30 seconds)
        $answerToken = JWT::encode([
            'question_id' => $questionId,
            'sent_at' => $nowMs,
            'lobby_id' => intval($lobby['id']),
            'question_index' => $requestedIndex,
            'user_id' => $user['user_id'],
            'correct_opt' => $correctOpt
        ], 30);

        echo json_encode([
            'success' => true,
            'question' => [
                'id' => intval($question['id']),
                'question_text' => $question['question_text'],
                'question_type' => $questionType,
                'options' => $shuffledOptions
            ],
            'question_index' => $requestedIndex,
            'total_questions' => count($questionIds),
            'answer_token' => $answerToken
        ]);
    }

    // ================================================================
    // SUBMIT ANSWER (per-player, token-based)
    // ================================================================
    public function submitAnswer()
    {
        $user = AuthMiddleware::authenticate();
        $data = json_decode(file_get_contents('php://input'), true);

        $roomCode = strtoupper(trim($data['room_code'] ?? ''));
        $answerToken = $data['answer_token'] ?? '';
        $answer = strtoupper(trim($data['answer'] ?? ''));

        // Decode and verify the answer token
        $payload = JWT::decode($answerToken);
        if (!$payload) {
            http_response_code(400);
            echo json_encode(['error' => 'Token de réponse invalide ou expiré.']);
            return;
        }

        // Verify token belongs to this user
        if (intval($payload['user_id'] ?? 0) !== $user['user_id']) {
            http_response_code(403);
            echo json_encode(['error' => 'Token invalide pour cet utilisateur.']);
            return;
        }

        $db = Database::getConnection();

        // Fetch lobby
        $stmtLobby = $db->prepare("SELECT * FROM lobbies WHERE room_code = ?");
        $stmtLobby->execute([$roomCode]);
        $lobby = $stmtLobby->fetch();

        if (!$lobby || $lobby['status'] !== 'playing') {
            http_response_code(400);
            echo json_encode(['error' => 'Salon invalide ou partie non en cours.']);
            return;
        }

        // Verify lobby ID matches token
        if (intval($payload['lobby_id'] ?? 0) !== intval($lobby['id'])) {
            http_response_code(400);
            echo json_encode(['error' => 'Token de salon invalide.']);
            return;
        }

        // Fetch player
        $stmtPlayer = $db->prepare("SELECT * FROM lobby_players WHERE lobby_id = ? AND user_id = ?");
        $stmtPlayer->execute([$lobby['id'], $user['user_id']]);
        $player = $stmtPlayer->fetch();

        if (!$player) {
            http_response_code(403);
            echo json_encode(['error' => 'Vous n\'êtes pas dans ce salon.']);
            return;
        }

        // Verify question index matches (prevent double-answer or skipping)
        $tokenIndex = intval($payload['question_index'] ?? -1);
        $playerIndex = intval($player['current_question_index']);
        if ($tokenIndex !== $playerIndex) {
            http_response_code(400);
            echo json_encode(['error' => 'Vous avez déjà répondu à cette question.']);
            return;
        }

        // Calculate elapsed time (anti-cheat)
        $nowMs = round(microtime(true) * 1000);
        $sentAt = intval($payload['sent_at']);
        $elapsedMs = $nowMs - $sentAt;

        // Anti-bot: reject if answered too fast
        if ($elapsedMs < 200) {
            http_response_code(403);
            echo json_encode(['error' => "Tricherie détectée (Anti-Bot). Réponse soumise trop rapidement ($elapsedMs ms)."]);
            return;
        }

        // Validate answer format (allow TIMEOUT for auto-submit on countdown end)
        if (!in_array($answer, ['A', 'B', 'C', 'D', 'TIMEOUT'])) {
            http_response_code(400);
            echo json_encode(['error' => 'Réponse invalide. Choisissez A, B, C ou D.']);
            return;
        }

        // Fetch correct answer from DB
        $questionId = intval($payload['question_id']);
        $stmtQ = $db->prepare("SELECT correct_opt, opt_a, opt_b, opt_c, opt_d FROM questions WHERE id = ?");
        $stmtQ->execute([$questionId]);
        $question = $stmtQ->fetch();

        if (!$question) {
            http_response_code(500);
            echo json_encode(['error' => 'Question introuvable.']);
            return;
        }

        $correctOpt = $payload['correct_opt'] ?? $question['correct_opt'];
        $isCorrect = ($answer === $correctOpt);

        // Calculate points based on speed (only for correct answers)
        $pointsAwarded = 0;
        $timeLimit = 15000; // 15 seconds
        if ($isCorrect) {
            $effectiveElapsed = min($elapsedMs, $timeLimit);
            $timeLeftRatio = max(0, ($timeLimit - $effectiveElapsed)) / $timeLimit;
            $pointsAwarded = max(10, intval(round(100 * $timeLeftRatio)));
        }

        // Update player: add score and advance question index
        $newIndex = $playerIndex + 1;
        $stmtUpdate = $db->prepare("UPDATE lobby_players SET current_score = current_score + ?, current_question_index = ? WHERE lobby_id = ? AND user_id = ?");
        $stmtUpdate->execute([$pointsAwarded, $newIndex, $lobby['id'], $user['user_id']]);

        // Update global_score (XP) and coins (50% of XP) for correct answers
        $coinsAwarded = 0;
        if ($pointsAwarded > 0) {
            $coinsAwarded = (int) ($pointsAwarded / 2);
            $stmtXP = $db->prepare("UPDATE users SET global_score = global_score + ?, coins = coins + ? WHERE id = ?");
            $stmtXP->execute([$pointsAwarded, $coinsAwarded, $user['user_id']]);
        }

        // Get correct answer text
        $optMap = ['A' => 'opt_a', 'B' => 'opt_b', 'C' => 'opt_c', 'D' => 'opt_d'];
        $correctText = $question[$optMap[$correctOpt]] ?? '';

        echo json_encode([
            'success' => true,
            'correct' => $isCorrect,
            'correct_option' => $correctOpt,
            'correct_text' => $correctText,
            'points_awarded' => $pointsAwarded,
            'coins_awarded' => $coinsAwarded,
            'next_index' => $newIndex,
            'response_time_ms' => intval($elapsedMs)
        ]);
    }

    // ================================================================
    // FINISH GAME (player declares they answered all questions)
    // ================================================================
    public function finishGame()
    {
        $user = AuthMiddleware::authenticate();
        $data = json_decode(file_get_contents('php://input'), true);

        $roomCode = strtoupper(trim($data['room_code'] ?? ''));

        $db = Database::getConnection();

        // Fetch lobby with pack name
        $stmtLobby = $db->prepare("
            SELECT l.*, p.name as pack_name
            FROM lobbies l
            JOIN packs p ON l.pack_id = p.id
            WHERE l.room_code = ?
        ");
        $stmtLobby->execute([$roomCode]);
        $lobby = $stmtLobby->fetch();

        if (!$lobby || $lobby['status'] !== 'playing') {
            http_response_code(400);
            echo json_encode(['error' => 'Salon invalide ou partie non en cours.']);
            return;
        }

        // Fetch player
        $stmtPlayer = $db->prepare("SELECT * FROM lobby_players WHERE lobby_id = ? AND user_id = ?");
        $stmtPlayer->execute([$lobby['id'], $user['user_id']]);
        $player = $stmtPlayer->fetch();

        if (!$player) {
            http_response_code(403);
            echo json_encode(['error' => 'Vous n\'êtes pas dans ce salon.']);
            return;
        }

        // Verify player has answered all questions
        $questionIds = explode(',', $lobby['questions_list']);
        $totalQuestions = count($questionIds);
        if (intval($player['current_question_index']) < $totalQuestions) {
            http_response_code(400);
            echo json_encode(['error' => 'Vous n\'avez pas encore répondu à toutes les questions.']);
            return;
        }

        // Mark player as finished (idempotent)
        if (!$player['finished_at']) {
            $nowMs = round(microtime(true) * 1000);
            $stmtFinish = $db->prepare("UPDATE lobby_players SET finished_at = ? WHERE lobby_id = ? AND user_id = ?");
            $stmtFinish->execute([$nowMs, $lobby['id'], $user['user_id']]);
        }

        // Check if ALL players have finished
        $stmtCheck = $db->prepare("
            SELECT COUNT(*) as total,
                   SUM(CASE WHEN finished_at IS NOT NULL THEN 1 ELSE 0 END) as finished_count
            FROM lobby_players
            WHERE lobby_id = ?
        ");
        $stmtCheck->execute([$lobby['id']]);
        $counts = $stmtCheck->fetch();

        $allFinished = (intval($counts['finished_count']) >= intval($counts['total']));

        if ($allFinished) {
            $this->calculateFinalRankings($db, $lobby);
        }

        echo json_encode([
            'success' => true,
            'all_finished' => $allFinished
        ]);
    }

    // ================================================================
    // CALCULATE FINAL RANKINGS & ELO (private helper)
    // ================================================================
    private function calculateFinalRankings($db, $lobby)
    {
        // Set lobby status to finished
        $db->prepare("UPDATE lobbies SET status = 'finished', current_question_id = NULL WHERE id = ?")
           ->execute([$lobby['id']]);

        // Get all players sorted by score DESC
        $stmtPlayers = $db->prepare("
            SELECT lp.*, u.username, u.elo
            FROM lobby_players lp
            JOIN users u ON lp.user_id = u.id
            WHERE lp.lobby_id = ?
            ORDER BY lp.current_score DESC
        ");
        $stmtPlayers->execute([$lobby['id']]);
        $players = $stmtPlayers->fetchAll();

        if (empty($players)) return;

        // Find winner (highest score)
        $winner = $players[0];

        // Log match to matches table
        $stmtMatch = $db->prepare("INSERT INTO matches (room_code, game_mode, pack_name, winner_username) VALUES (?, ?, ?, ?)");
        $stmtMatch->execute([
            $lobby['room_code'],
            $lobby['game_mode'],
            $lobby['pack_name'],
            $winner['username']
        ]);

        // Calculate tie-safe Elo changes and award coins bonuses
        $scores = array_map(function ($p) { return intval($p['current_score']); }, $players);
        $distinctScores = array_values(array_unique($scores));
        rsort($distinctScores); // highest first

        $maxScore = $distinctScores[0];
        $minScore = end($distinctScores);
        $secondScore = count($distinctScores) >= 2 ? $distinctScores[1] : null;

        foreach ($players as $p) {
            $score = intval($p['current_score']);
            $eloChange = 0;
            $coinBonus = 0;

            if ($score === $maxScore) {
                $eloChange = 15; // Winner(s)
                $coinBonus = 100;
            } elseif ($score === $minScore && $minScore !== $maxScore) {
                $eloChange = -10; // Last place
                $coinBonus = 10;
            } elseif (count($players) >= 3 && $secondScore !== null && $score === $secondScore) {
                $eloChange = 5; // Second place
                $coinBonus = 50;
            } else {
                $coinBonus = 25; // 3rd place / others
            }

            // Update user Elo and coins (floor at 0 Elo)
            $db->prepare("UPDATE users SET elo = GREATEST(0, elo + ?), coins = coins + ? WHERE id = ?")
               ->execute([$eloChange, $coinBonus, $p['user_id']]);

            // Record Elo change for display
            $db->prepare("UPDATE lobby_players SET elo_change = ? WHERE lobby_id = ? AND user_id = ?")
               ->execute([$eloChange, $lobby['id'], $p['user_id']]);
        }
    }

    // ================================================================
    // SUBMIT REACTION (emoji taunts — unchanged)
    // ================================================================
    public function submitReaction()
    {
        $user = AuthMiddleware::authenticate();
        $data = json_decode(file_get_contents('php://input'), true);

        $allowedEmojis = ['🤡', '🚀', '🧠', '🤬', '👑', '💀'];
        $reaction = $data['reaction'] ?? '';

        if (!in_array($reaction, $allowedEmojis)) {
            http_response_code(400);
            echo json_encode(['error' => 'Réaction invalide.']);
            return;
        }

        $roomCode = strtoupper(trim($data['room_code'] ?? ''));
        $db = Database::getConnection();

        $stmtLobby = $db->prepare("SELECT id FROM lobbies WHERE room_code = ?");
        $stmtLobby->execute([$roomCode]);
        $lobby = $stmtLobby->fetch();

        if (!$lobby) {
            http_response_code(404);
            echo json_encode(['error' => 'Salon introuvable.']);
            return;
        }

        $nowMs = round(microtime(true) * 1000);
        $stmtReaction = $db->prepare("UPDATE lobby_players SET reaction = ?, reaction_sent_at = ? WHERE lobby_id = ? AND user_id = ?");
        $stmtReaction->execute([$reaction, $nowMs, $lobby['id'], $user['user_id']]);

        echo json_encode(['success' => true]);
    }

    // ================================================================
    // LEAVE LOBBY
    // ================================================================
    public function leave()
    {
        $user = AuthMiddleware::authenticate();
        $data = json_decode(file_get_contents('php://input'), true);

        $roomCode = strtoupper(trim($data['room_code'] ?? ''));
        $db = Database::getConnection();

        $stmtLobby = $db->prepare("SELECT * FROM lobbies WHERE room_code = ?");
        $stmtLobby->execute([$roomCode]);
        $lobby = $stmtLobby->fetch();

        if (!$lobby) {
            http_response_code(404);
            echo json_encode(['error' => 'Salon introuvable.']);
            return;
        }

        // If the host leaves, close the lobby
        if (intval($lobby['host_id']) === $user['user_id']) {
            $db->prepare("UPDATE lobbies SET status = 'finished' WHERE id = ?")->execute([$lobby['id']]);
        } else {
            // Non-host: just remove from players
            $db->prepare("DELETE FROM lobby_players WHERE lobby_id = ? AND user_id = ?")->execute([$lobby['id'], $user['user_id']]);
        }

        echo json_encode(['success' => true]);
    }
}
