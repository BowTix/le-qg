<?php
namespace App\Controllers;

use App\Config\Database;
use App\Middleware\AuthMiddleware;

class LobbyController {
    /**
     * POST /api/lobby/create
     */
    public function create(array $data) {
        $user = AuthMiddleware::authenticate();
        $packId = (int) ($data['pack_id'] ?? 0);

        if ($packId <= 0) {
            http_response_code(400);
            echo json_encode(["error" => "pack_id requis."]);
            return;
        }

        $db = Database::getConnection();

        // Check if pack exists and is validated (unless admin)
        $stmtPack = $db->prepare("SELECT id, is_validated FROM packs WHERE id = ?");
        $stmtPack->execute([$packId]);
        $pack = $stmtPack->fetch();
        if (!$pack) {
            http_response_code(404);
            echo json_encode(["error" => "Pack introuvable."]);
            return;
        }

        if ((int)$pack['is_validated'] !== 1 && $user['role'] !== 'admin') {
            http_response_code(403);
            echo json_encode(["error" => "Interdit. Impossible de lancer une partie multijoueur sur un thème non validé."]);
            return;
        }

        // Generate unique room code (5 uppercase alphanumeric characters)
        $roomCode = '';
        $exists = true;
        while ($exists) {
            $roomCode = substr(str_shuffle('ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'), 0, 5);
            $stmtCheck = $db->prepare("SELECT id FROM lobbies WHERE room_code = ?");
            $stmtCheck->execute([$roomCode]);
            if (!$stmtCheck->fetch()) {
                $exists = false;
            }
        }

        // Insert Lobby
        $stmtInsert = $db->prepare("
            INSERT INTO lobbies (room_code, host_id, pack_id, status) 
            VALUES (?, ?, ?, 'waiting')
        ");
        $stmtInsert->execute([$roomCode, $user['user_id'], $packId]);
        $lobbyId = $db->lastInsertId();

        // Add host as player
        $stmtPlayer = $db->prepare("
            INSERT INTO lobby_players (lobby_id, user_id, current_score) 
            VALUES (?, ?, 0)
        ");
        $stmtPlayer->execute([$lobbyId, $user['user_id']]);

        echo json_encode([
            "success" => true,
            "room_code" => $roomCode,
            "lobby_id" => (int) $lobbyId
        ]);
    }

    /**
     * POST /api/lobby/join
     */
    public function join(array $data) {
        $user = AuthMiddleware::authenticate();
        $roomCode = strtoupper(trim($data['room_code'] ?? ''));

        if (empty($roomCode)) {
            http_response_code(400);
            echo json_encode(["error" => "Code de salon requis."]);
            return;
        }

        $db = Database::getConnection();

        // Find lobby
        $stmtLobby = $db->prepare("SELECT id, status FROM lobbies WHERE room_code = ?");
        $stmtLobby->execute([$roomCode]);
        $lobby = $stmtLobby->fetch();

        if (!$lobby) {
            http_response_code(404);
            echo json_encode(["error" => "Salon introuvable."]);
            return;
        }

        if ($lobby['status'] !== 'waiting') {
            http_response_code(400);
            echo json_encode(["error" => "La partie a déjà commencé ou est terminée."]);
            return;
        }

        $lobbyId = (int) $lobby['id'];

        // Add user to players list if not already in it
        $stmtCheck = $db->prepare("SELECT user_id FROM lobby_players WHERE lobby_id = ? AND user_id = ?");
        $stmtCheck->execute([$lobbyId, $user['user_id']]);
        
        if (!$stmtCheck->fetch()) {
            $stmtInsert = $db->prepare("
                INSERT INTO lobby_players (lobby_id, user_id, current_score) 
                VALUES (?, ?, 0)
            ");
            $stmtInsert->execute([$lobbyId, $user['user_id']]);
        }

        echo json_encode([
            "success" => true,
            "room_code" => $roomCode,
            "lobby_id" => $lobbyId
        ]);
    }

    /**
     * GET /api/lobby/status
     * Polling sync endpoint
     */
    public function status(array $queryParams) {
        $user = AuthMiddleware::authenticate();
        $roomCode = strtoupper(trim($queryParams['room_code'] ?? ''));

        if (empty($roomCode)) {
            http_response_code(400);
            echo json_encode(["error" => "room_code requis."]);
            return;
        }

        $db = Database::getConnection();

        // 1. Fetch Lobby and Host info
        $stmtLobby = $db->prepare("
            SELECT l.*, u.username as host_username, p.name as pack_name 
            FROM lobbies l
            JOIN users u ON l.host_id = u.id
            JOIN packs p ON l.pack_id = p.id
            WHERE l.room_code = ?
        ");
        $stmtLobby->execute([$roomCode]);
        $lobby = $stmtLobby->fetch();

        if (!$lobby) {
            http_response_code(404);
            echo json_encode(["error" => "Salon introuvable."]);
            return;
        }

        $lobbyId = (int) $lobby['id'];

        // 2. Fetch Players list and their current scores
        $stmtPlayers = $db->prepare("
            SELECT lp.user_id, u.username, lp.current_score, lp.last_answered_question_id 
            FROM lobby_players lp 
            JOIN users u ON lp.user_id = u.id 
            WHERE lp.lobby_id = ?
            ORDER BY lp.current_score DESC
        ");
        $stmtPlayers->execute([$lobbyId]);
        $rawPlayers = $stmtPlayers->fetchAll();

        $players = [];
        $hasUserAnswered = false;
        $currentQuestionId = $lobby['current_question_id'] ? (int) $lobby['current_question_id'] : null;

        foreach ($rawPlayers as $p) {
            $hasAnsweredCurrent = ($currentQuestionId !== null && (int)$p['last_answered_question_id'] === $currentQuestionId);
            if ((int) $p['user_id'] === $user['user_id']) {
                $hasUserAnswered = $hasAnsweredCurrent;
            }
            $players[] = [
                "user_id" => (int) $p['user_id'],
                "username" => htmlspecialchars($p['username']),
                "score" => (int) $p['current_score'],
                "has_answered" => $hasAnsweredCurrent
            ];
        }

        $response = [
            "id" => $lobbyId,
            "room_code" => $lobby['room_code'],
            "status" => $lobby['status'],
            "host_id" => (int) $lobby['host_id'],
            "host_username" => htmlspecialchars($lobby['host_username']),
            "pack_name" => htmlspecialchars($lobby['pack_name']),
            "current_question_index" => (int) $lobby['current_question_index'],
            "players" => $players,
            "user_has_answered" => $hasUserAnswered
        ];

        // 3. Populate Active Question Details if 'playing'
        if ($lobby['status'] === 'playing' && $currentQuestionId !== null) {
            $stmtQ = $db->prepare("SELECT id, question_text, opt_a, opt_b, opt_c, opt_d, correct_opt FROM questions WHERE id = ?");
            $stmtQ->execute([$currentQuestionId]);
            $question = $stmtQ->fetch();

            if ($question) {
                $now = (int) (microtime(true) * 1000);
                $startedAt = (int) $lobby['question_started_at'];
                $elapsed = $now - $startedAt;
                $timeLeft = max(0, 15000 - $elapsed); // 15 seconds round

                $response['question'] = [
                    "id" => (int) $question['id'],
                    "question_text" => htmlspecialchars($question['question_text']),
                    "options" => [
                        "A" => htmlspecialchars($question['opt_a']),
                        "B" => htmlspecialchars($question['opt_b']),
                        "C" => htmlspecialchars($question['opt_c']),
                        "D" => htmlspecialchars($question['opt_d'])
                    ]
                ];
                $response['time_left_ms'] = $timeLeft;
                $response['round_active'] = ($timeLeft > 0);

                // Count how many players have answered
                $answeredCount = 0;
                foreach ($players as $p) {
                    if ($p['has_answered']) {
                        $answeredCount++;
                    }
                }
                
                // If all players have answered, the round is also visually finished
                $allAnswered = ($answeredCount > 0 && $answeredCount === count($players));
                if ($allAnswered) {
                    $response['round_active'] = false;
                }

                // SECURE PAYLOAD: Expose the correct answer ONLY when the round is finished/inactive
                if ($timeLeft <= 0 || $allAnswered || $response['status'] === 'finished') {
                    $correctKey = strtolower('opt_' . $question['correct_opt']);
                    $response['round_over'] = true;
                    $response['correct_option'] = $question['correct_opt'];
                    $response['correct_text'] = htmlspecialchars($question[$correctKey] ?? '');
                } else {
                    $response['round_over'] = false;
                }
            }
        }

        echo json_encode($response);
    }

    /**
     * POST /api/lobby/answer
     */
    public function submitAnswer(array $data) {
        $user = AuthMiddleware::authenticate();
        $roomCode = strtoupper(trim($data['room_code'] ?? ''));
        $questionId = (int) ($data['question_id'] ?? 0);
        $answer = strtoupper(trim($data['answer'] ?? ''));

        if (empty($roomCode) || $questionId <= 0 || !in_array($answer, ['A', 'B', 'C', 'D'])) {
            http_response_code(400);
            echo json_encode(["error" => "Données d'évaluation de réponse invalides."]);
            return;
        }

        $db = Database::getConnection();

        // 1. Fetch lobby & check if playing
        $stmtLobby = $db->prepare("SELECT id, status, current_question_id, question_started_at FROM lobbies WHERE room_code = ?");
        $stmtLobby->execute([$roomCode]);
        $lobby = $stmtLobby->fetch();

        if (!$lobby || $lobby['status'] !== 'playing') {
            http_response_code(400);
            echo json_encode(["error" => "Le salon n'est pas en cours de jeu."]);
            return;
        }

        if ((int)$lobby['current_question_id'] !== $questionId) {
            http_response_code(400);
            echo json_encode(["error" => "La question envoyée ne correspond pas à la question active."]);
            return;
        }

        $lobbyId = (int) $lobby['id'];

        // 2. Verify player is in the lobby
        $stmtPlayer = $db->prepare("SELECT current_score, last_answered_question_id FROM lobby_players WHERE lobby_id = ? AND user_id = ?");
        $stmtPlayer->execute([$lobbyId, $user['user_id']]);
        $player = $stmtPlayer->fetch();

        if (!$player) {
            http_response_code(403);
            echo json_encode(["error" => "Vous ne faites pas partie de ce salon."]);
            return;
        }

        // 3. Verify user hasn't already answered
        if ($player['last_answered_question_id'] !== null && (int)$player['last_answered_question_id'] === $questionId) {
            http_response_code(400);
            echo json_encode(["error" => "Vous avez déjà répondu à cette question."]);
            return;
        }

        // 4. Time verification (Server Authority)
        $now = (int) (microtime(true) * 1000);
        $startedAt = (int) $lobby['question_started_at'];
        $elapsed = $now - $startedAt;

        if ($elapsed < 200) {
            http_response_code(403);
            echo json_encode(["error" => "Tricherie détectée (Anti-Bot). Réponse trop rapide."]);
            return;
        }

        // Enforce 15-second limit
        if ($elapsed > 15000) {
            http_response_code(403);
            echo json_encode(["error" => "Temps écoulé pour cette question."]);
            return;
        }

        // 5. Evaluate answer
        $stmtQ = $db->prepare("SELECT correct_opt FROM questions WHERE id = ?");
        $stmtQ->execute([$questionId]);
        $correctOpt = $stmtQ->fetchColumn();

        $isCorrect = ($answer === $correctOpt);
        $pointsAwarded = 0;

        if ($isCorrect) {
            // Speed points: base 100 + speed bonus up to 100
            $timeLeftRatio = (15000 - $elapsed) / 15000;
            $pointsAwarded = 100 + (int) ($timeLeftRatio * 100);

            // Update user lobby score
            $stmtScore = $db->prepare("
                UPDATE lobby_players 
                SET current_score = current_score + ?, last_answered_question_id = ? 
                WHERE lobby_id = ? AND user_id = ?
            ");
            $stmtScore->execute([$pointsAwarded, $questionId, $lobbyId, $user['user_id']]);
        } else {
            // Mark as answered without adding points
            $stmtScore = $db->prepare("
                UPDATE lobby_players 
                SET last_answered_question_id = ? 
                WHERE lobby_id = ? AND user_id = ?
            ");
            $stmtScore->execute([$questionId, $lobbyId, $user['user_id']]);
        }

        echo json_encode([
            "success" => true,
            "correct" => $isCorrect,
            "points_awarded" => $pointsAwarded,
            "response_time_ms" => $elapsed
        ]);
    }

    /**
     * POST /api/lobby/next
     * Host only: starts the game or advances to the next question
     */
    public function nextQuestion(array $data) {
        $user = AuthMiddleware::authenticate();
        $roomCode = strtoupper(trim($data['room_code'] ?? ''));

        if (empty($roomCode)) {
            http_response_code(400);
            echo json_encode(["error" => "room_code requis."]);
            return;
        }

        $db = Database::getConnection();

        // Fetch lobby
        $stmtLobby = $db->prepare("SELECT * FROM lobbies WHERE room_code = ?");
        $stmtLobby->execute([$roomCode]);
        $lobby = $stmtLobby->fetch();

        if (!$lobby) {
            http_response_code(404);
            echo json_encode(["error" => "Salon introuvable."]);
            return;
        }

        // Host validation
        if ((int)$lobby['host_id'] !== $user['user_id']) {
            http_response_code(403);
            echo json_encode(["error" => "Seul l'hôte peut avancer la partie."]);
            return;
        }

        $lobbyId = (int) $lobby['id'];

        if ($lobby['status'] === 'waiting') {
            // START GAME: Get 10 random questions from the pack
            $stmtQ = $db->prepare("SELECT id FROM questions WHERE pack_id = ? ORDER BY RAND() LIMIT 10");
            $stmtQ->execute([$lobby['pack_id']]);
            $questionIds = $stmtQ->fetchAll(\PDO::FETCH_COLUMN);

            if (count($questionIds) === 0) {
                http_response_code(400);
                echo json_encode(["error" => "Ce pack ne contient pas de questions."]);
                return;
            }

            $questionsList = implode(',', $questionIds);
            $firstQuestionId = (int) $questionIds[0];
            $now = (int) (microtime(true) * 1000);

            // Update lobby status to playing, set list and start time
            $stmtUpdate = $db->prepare("
                UPDATE lobbies 
                SET status = 'playing', 
                    current_question_index = 0, 
                    current_question_id = ?, 
                    questions_list = ?, 
                    question_started_at = ? 
                WHERE id = ?
            ");
            $stmtUpdate->execute([$firstQuestionId, $questionsList, $now, $lobbyId]);

            // Reset all players scores to 0 and answers to null
            $stmtPlayers = $db->prepare("
                UPDATE lobby_players 
                SET current_score = 0, last_answered_question_id = NULL 
                WHERE lobby_id = ?
            ");
            $stmtPlayers->execute([$lobbyId]);

            echo json_encode(["success" => true, "message" => "La partie commence !"]);
            return;
        }

        if ($lobby['status'] === 'playing') {
            // ADVANCE QUESTION
            $questionIds = explode(',', $lobby['questions_list']);
            $nextIndex = (int) $lobby['current_question_index'] + 1;

            if ($nextIndex >= count($questionIds)) {
                // Game finished!
                $stmtUpdate = $db->prepare("UPDATE lobbies SET status = 'finished', current_question_id = NULL WHERE id = ?");
                $stmtUpdate->execute([$lobbyId]);

                // Permanent rewards: Add lobby score to global user score for all players
                $stmtFetchPlayers = $db->prepare("SELECT user_id, current_score FROM lobby_players WHERE lobby_id = ?");
                $stmtFetchPlayers->execute([$lobbyId]);
                $players = $stmtFetchPlayers->fetchAll();

                $stmtAddGlobalScore = $db->prepare("UPDATE users SET global_score = global_score + ? WHERE id = ?");
                foreach ($players as $p) {
                    $stmtAddGlobalScore->execute([(int)$p['current_score'], (int)$p['user_id']]);
                }

                echo json_encode(["success" => true, "status" => "finished", "message" => "Partie terminée ! Scores enregistrés."]);
            } else {
                // Advance to next question
                $nextQuestionId = (int) $questionIds[$nextIndex];
                $now = (int) (microtime(true) * 1000);

                $stmtUpdate = $db->prepare("
                    UPDATE lobbies 
                    SET current_question_index = ?, 
                        current_question_id = ?, 
                        question_started_at = ? 
                    WHERE id = ?
                ");
                $stmtUpdate->execute([$nextIndex, $nextQuestionId, $now, $lobbyId]);

                echo json_encode(["success" => true, "status" => "playing", "message" => "Question suivante lancée."]);
            }
        }
    }

    /**
     * POST /api/lobby/leave
     */
    public function leave(array $data) {
        $user = AuthMiddleware::authenticate();
        $roomCode = strtoupper(trim($data['room_code'] ?? ''));

        if (empty($roomCode)) {
            http_response_code(400);
            echo json_encode(["error" => "room_code requis."]);
            return;
        }

        $db = Database::getConnection();

        // Fetch lobby
        $stmtLobby = $db->prepare("SELECT id, host_id FROM lobbies WHERE room_code = ?");
        $stmtLobby->execute([$roomCode]);
        $lobby = $stmtLobby->fetch();

        if (!$lobby) {
            http_response_code(404);
            echo json_encode(["error" => "Salon introuvable."]);
            return;
        }

        $lobbyId = (int) $lobby['id'];

        if ((int)$lobby['host_id'] === $user['user_id']) {
            // Host leaves: terminate lobby!
            $stmtUpdate = $db->prepare("UPDATE lobbies SET status = 'finished' WHERE id = ?");
            $stmtUpdate->execute([$lobbyId]);
            echo json_encode(["success" => true, "message" => "Salon fermé par l'hôte."]);
        } else {
            // Normal player leaves: remove from player list
            $stmtRemove = $db->prepare("DELETE FROM lobby_players WHERE lobby_id = ? AND user_id = ?");
            $stmtRemove->execute([$lobbyId, $user['user_id']]);
            echo json_encode(["success" => true, "message" => "Vous avez quitté le salon."]);
        }
    }
}
