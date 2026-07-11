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

        $gameMode = $data['game_mode'] ?? 'classic';
        if (!in_array($gameMode, ['classic', 'speed_blitz', 'sudden_death', 'guess_number', 'tribunal', 'imposteur'])) {
            $gameMode = 'classic';
        }

        if ($gameMode === 'tribunal') {
            $stmtTribunalPack = $db->query("SELECT id FROM packs WHERE name = 'Le Tribunal'");
            $tribunalPackId = (int) $stmtTribunalPack->fetchColumn();
            if ($tribunalPackId > 0) {
                $packId = $tribunalPackId;
            }
        } elseif ($gameMode === 'imposteur') {
            $stmtImposteurPack = $db->query("SELECT id FROM packs WHERE name = 'L\'Imposteur'");
            $imposteurPackId = (int) $stmtImposteurPack->fetchColumn();
            if ($imposteurPackId > 0) {
                $packId = $imposteurPackId;
            }
        }

        // Insert lobby
        $stmt = $db->prepare("INSERT INTO lobbies (room_code, host_id, pack_id, status, game_mode, tribunal_phase, tribunal_phase_ends_at, current_question_index) VALUES (?, ?, ?, 'waiting', ?, NULL, NULL, 0)");
        $stmt->execute([$roomCode, $user['user_id'], $packId, $gameMode]);
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
        \App\Utils\Pusher::finishResponse();
        $this->broadcastLobbyState($db, $lobby);
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
                   lp.elo_change, lp.reaction, lp.reaction_sent_at, lp.is_eliminated,
                   u.username, u.global_score, u.elo
            FROM lobby_players lp
            JOIN users u ON lp.user_id = u.id
            WHERE lp.lobby_id = ?
            ORDER BY lp.current_score DESC
        ");
        $stmtPlayers->execute([$lobby['id']]);
        $playersRaw = $stmtPlayers->fetchAll();
        $playerIds = array_column($playersRaw, 'user_id');

        $nowMs = round(microtime(true) * 1000);
        if ($lobby['game_mode'] === 'tribunal' && $lobby['status'] === 'playing') {
            $this->checkTribunalStateTransition($db, $lobby, $nowMs, $playerIds);
        }

        $response = $this->buildLobbyState($db, $lobby, $playersRaw, $user['user_id']);

        echo json_encode($response);
    }

    // ================================================================
    // BUILD LOBBY STATE (shared between HTTP /status and Pusher broadcast)
    // ================================================================
    // $currentUserId is used only to compute per-user fields like
    // "is_mine" / "my_submission" / "has_voted". When this is built for
    // a broadcast (sent to everyone on the channel, not a single user),
    // pass null and the frontend will derive those fields itself from
    // its own user_id, since it already knows who it is.
    private function buildLobbyState($db, $lobby, $playersRaw, $currentUserId)
    {
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
                'reaction' => $reaction,
                'is_eliminated' => intval($p['is_eliminated']) === 1
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
            'total_questions' => $totalQuestions,
            'pusher_key' => getenv('PUSHER_KEY') ?: ($_ENV['PUSHER_KEY'] ?? ($_SERVER['PUSHER_KEY'] ?? null)),
            'pusher_cluster' => getenv('PUSHER_CLUSTER') ?: ($_ENV['PUSHER_CLUSTER'] ?? ($_SERVER['PUSHER_CLUSTER'] ?? 'eu'))
        ];

        if ($lobby['game_mode'] === 'tribunal' && $lobby['status'] === 'playing') {
            $phase = $lobby['tribunal_phase'];
            $endsAt = intval($lobby['tribunal_phase_ends_at']);
            $phaseRemainingMs = max(0, $endsAt - $nowMs);
            $round = intval($lobby['current_question_index']);

            $questionIds = explode(',', $lobby['questions_list']);
            $currentQuestionId = intval($questionIds[$round]);

            $stmtQ = $db->prepare("SELECT question_text FROM questions WHERE id = ?");
            $stmtQ->execute([$currentQuestionId]);
            $promptText = $stmtQ->fetchColumn();

            $submissions = [];
            $mySubmission = null;
            $hasVoted = false;

            if ($phase === 'writing') {
                $stmtSubs = $db->prepare("SELECT user_id, answer_text FROM tribunal_submissions WHERE lobby_id = ? AND round_number = ?");
                $stmtSubs->execute([$lobby['id'], $round]);
                $subsRaw = $stmtSubs->fetchAll();

                $submittedUserIds = array_column($subsRaw, 'user_id');
                foreach ($response['players'] as &$p) {
                    $p['has_submitted'] = in_array($p['user_id'], $submittedUserIds);
                }

                $mySubmission = null;
                if ($currentUserId !== null) {
                    foreach ($subsRaw as $sub) {
                        if (intval($sub['user_id']) === $currentUserId) {
                            $mySubmission = $sub['answer_text'];
                            break;
                        }
                    }
                }

            } elseif ($phase === 'voting') {
                // Single query: pulls submissions AND each user's voted_for_user_id,
                // so we can derive "have I voted" in PHP without a second round-trip.
                $stmtSubs = $db->prepare("SELECT id, answer_text, user_id, voted_for_user_id FROM tribunal_submissions WHERE lobby_id = ? AND round_number = ?");
                $stmtSubs->execute([$lobby['id'], $round]);
                $subsRaw = $stmtSubs->fetchAll();

                $hasVoted = false;
                if ($currentUserId !== null) {
                    foreach ($subsRaw as $sub) {
                        if (intval($sub['user_id']) === $currentUserId && $sub['voted_for_user_id'] !== null) {
                            $hasVoted = true;
                            break;
                        }
                    }
                }

                foreach ($subsRaw as $sub) {
                    // IMPORTANT: never include user_id/author identity here.
                    // During voting, authorship must stay anonymous. When
                    // $currentUserId is null (broadcast payload, shared by
                    // everyone), we simply omit is_mine — each client adds
                    // it locally by comparing against the user_id it knows
                    // about itself (its own last-submitted answer text),
                    // which the frontend already tracks after submitting.
                    $entry = [
                        'id' => intval($sub['id']),
                        'answer_text' => $sub['answer_text']
                    ];
                    if ($currentUserId !== null) {
                        $entry['is_mine'] = (intval($sub['user_id']) === $currentUserId);
                    }
                    $submissions[] = $entry;
                }

                // Deterministic sort using a seed based on lobby ID and round number.
                // This ensures that the order is:
                // 1. Shuffled randomly (not ordered by join/submission sequence)
                // 2. IDENTICAL for all players (so they read the answers in the same order)
                // 3. STABLE across all status polls during the round
                $seed = intval($lobby['id']) * 1000 + intval($round);
                srand($seed);
                shuffle($submissions);
                srand(); // Reset rand seed to default

            } elseif ($phase === 'results') {
                $stmtSubs = $db->prepare("
                    SELECT ts.id, ts.answer_text, ts.user_id, ts.voted_for_user_id, u.username
                    FROM tribunal_submissions ts
                    JOIN users u ON ts.user_id = u.id
                    WHERE ts.lobby_id = ? AND ts.round_number = ?
                ");
                $stmtSubs->execute([$lobby['id'], $round]);
                $subsRaw = $stmtSubs->fetchAll();

                $votersForUser = [];
                foreach ($subsRaw as $s) {
                    $voterUsername = $s['username'];
                    $votedFor = $s['voted_for_user_id'];
                    if ($votedFor) {
                        $votersForUser[$votedFor][] = $voterUsername;
                    }
                }

                foreach ($subsRaw as $sub) {
                    $authorId = intval($sub['user_id']);
                    $votes = $votersForUser[$authorId] ?? [];
                    $submissions[] = [
                        'id' => intval($sub['id']),
                        'answer_text' => $sub['answer_text'],
                        'author_id' => $authorId,
                        'author_username' => $sub['username'],
                        'votes' => $votes,
                        'vote_count' => count($votes),
                        'is_mine' => ($currentUserId !== null && $authorId === $currentUserId)
                    ];
                }

                usort($submissions, function($a, $b) {
                    return $b['vote_count'] - $a['vote_count'];
                });
            }

            $response['tribunal'] = [
                'phase' => $phase,
                'phase_remaining_ms' => $phaseRemainingMs,
                'round' => $round,
                'prompt_text' => $promptText,
                'submissions' => $submissions,
                'my_submission' => $mySubmission,
                'has_voted' => $hasVoted
            ];
        }

        if ($lobby['game_mode'] === 'imposteur' && $lobby['status'] !== 'waiting') {
            $phase = $lobby['imposteur_phase'];
            $theme = $lobby['imposteur_theme'];
            $eliminatedUserId = $lobby['imposteur_eliminated_user_id'] ? intval($lobby['imposteur_eliminated_user_id']) : null;

            $myRole = null;
            $myWord = null;
            $myVote = null;

            if ($currentUserId !== null) {
                $stmtMyState = $db->prepare("SELECT imposteur_role, imposteur_word, imposteur_voted_for_user_id FROM lobby_players WHERE lobby_id = ? AND user_id = ?");
                $stmtMyState->execute([$lobby['id'], $currentUserId]);
                $myState = $stmtMyState->fetch();
                if ($myState) {
                    $myRole = $myState['imposteur_role'];
                    $myWord = $myState['imposteur_word'];
                    $myVote = $myState['imposteur_voted_for_user_id'] ? intval($myState['imposteur_voted_for_user_id']) : null;
                }
            }

            // Get votes info for active players
            $stmtVotes = $db->prepare("SELECT user_id, imposteur_voted_for_user_id FROM lobby_players WHERE lobby_id = ? AND is_eliminated = 0");
            $stmtVotes->execute([$lobby['id']]);
            $votesRaw = $stmtVotes->fetchAll();

            $votedUserIds = [];
            $voteCounts = []; // target_id => vote_count
            foreach ($votesRaw as $vr) {
                if ($vr['imposteur_voted_for_user_id'] !== null) {
                    $votedUserIds[] = intval($vr['user_id']);
                    $target = intval($vr['imposteur_voted_for_user_id']);
                    $voteCounts[$target] = ($voteCounts[$target] ?? 0) + 1;
                }
            }

            // Populate player list
            foreach ($response['players'] as &$p) {
                $pId = $p['user_id'];
                $p['has_voted'] = in_array($pId, $votedUserIds);
                
                $stmtPlayerState = $db->prepare("SELECT imposteur_role, imposteur_word, imposteur_voted_for_user_id FROM lobby_players WHERE lobby_id = ? AND user_id = ?");
                $stmtPlayerState->execute([$lobby['id'], $pId]);
                $pState = $stmtPlayerState->fetch();
                
                // Only reveal roles/words in results phase, or if player is eliminated, or to the player themselves
                if ($phase === 'results' || $lobby['status'] === 'finished' || $p['is_eliminated'] || $pId === $currentUserId) {
                    if ($pState) {
                        $p['imposteur_role'] = $pState['imposteur_role'];
                        $p['imposteur_word'] = $pState['imposteur_word'];
                    }
                }
                
                if ($phase === 'results') {
                    if ($pState) {
                        $p['imposteur_voted_for_user_id'] = $pState['imposteur_voted_for_user_id'] ? intval($pState['imposteur_voted_for_user_id']) : null;
                    }
                    $p['imposteur_votes_received'] = $voteCounts[$pId] ?? 0;
                }
            }

            $response['imposteur'] = [
                'phase' => $phase,
                'theme' => $theme,
                'my_role' => $myRole,
                'my_word' => $myWord,
                'my_vote' => $myVote,
                'eliminated_user_id' => $eliminatedUserId
            ];
        }

        return $response;
    }

    // ================================================================
    // BROADCAST: Build + push the full lobby/tribunal state over Pusher
    // ================================================================
    // Unlike broadcastLobbyUpdate() (a bare "something changed" ping that
    // forces every client to re-fetch /lobby/status), this pushes the
    // actual state in the event payload. Clients apply it directly and
    // skip the HTTP round-trip entirely — this is what makes actions
    // (submit/vote) feel instant to OTHER players in the room.
    private function broadcastLobbyState($db, $lobby)
    {
        // Callers reach this from several endpoints, and not all of them
        // SELECT with the host_username/pack_name JOIN that /status uses
        // (most just do `SELECT * FROM lobbies`). Re-fetch with the full
        // JOIN here so the broadcast never sends null for those fields —
        // this one extra query is worth the correctness guarantee, and
        // it's still far cheaper than a full client-side re-fetch + the
        // rest of /status's work for every player in the room.
        $stmtLobby = $db->prepare("
            SELECT l.*, u.username as host_username, p.name as pack_name
            FROM lobbies l
            JOIN users u ON l.host_id = u.id
            JOIN packs p ON l.pack_id = p.id
            WHERE l.id = ?
        ");
        $stmtLobby->execute([$lobby['id']]);
        $freshLobby = $stmtLobby->fetch();
        if ($freshLobby) {
            // Merge: keep any in-memory fields the caller just patched
            // locally (e.g. status='playing' right after an UPDATE) that
            // might not be reflected by this re-fetch under rare race
            // conditions, but prefer the fresh DB row otherwise.
            $lobby = array_merge($freshLobby, $lobby);
        }

        $stmtPlayers = $db->prepare("
            SELECT lp.user_id, lp.current_score, lp.current_question_index, lp.finished_at,
                   lp.elo_change, lp.reaction, lp.reaction_sent_at, lp.is_eliminated,
                   u.username, u.global_score, u.elo
            FROM lobby_players lp
            JOIN users u ON lp.user_id = u.id
            WHERE lp.lobby_id = ?
            ORDER BY lp.current_score DESC
        ");
        $stmtPlayers->execute([$lobby['id']]);
        $playersRaw = $stmtPlayers->fetchAll();

        // currentUserId = null: this payload is shared by everyone on the
        // channel, so it must not contain any single user's private fields
        // (is_mine, my_submission, has_voted are omitted/neutral — see
        // buildLobbyState for details).
        $state = $this->buildLobbyState($db, $lobby, $playersRaw, null);

        \App\Utils\Pusher::triggerAsync("lobby-" . $lobby['room_code'], "lobby_state", $state);
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

        if ($lobby['game_mode'] === 'imposteur') {
            // Count players in lobby
            $stmtCount = $db->prepare("SELECT COUNT(*) FROM lobby_players WHERE lobby_id = ?");
            $stmtCount->execute([$lobby['id']]);
            $playerCount = (int) $stmtCount->fetchColumn();
            if ($playerCount < 3) {
                http_response_code(400);
                echo json_encode(['error' => 'La partie d\'Imposteur nécessite au moins 3 joueurs.']);
                return;
            }

            // Get random word pair
            $stmtWord = $db->query("SELECT * FROM imposteur_words ORDER BY RAND() LIMIT 1");
            $wordPair = $stmtWord->fetch();
            if (!$wordPair) {
                $wordPair = ['word_innocent' => 'Lion', 'word_imposteur' => 'Tigre', 'theme' => 'Animaux'];
            }

            // Fetch players
            $stmtPlayers = $db->prepare("SELECT user_id FROM lobby_players WHERE lobby_id = ?");
            $stmtPlayers->execute([$lobby['id']]);
            $playersList = $stmtPlayers->fetchAll(\PDO::FETCH_COLUMN);

            // Select random Imposteur
            $imposteurUserId = $playersList[array_rand($playersList)];

            // Start game transaction
            $nowMs = round(microtime(true) * 1000);
            $db->prepare("
                UPDATE lobbies 
                SET status = 'playing',
                    questions_list = '',
                    game_started_at = ?,
                    current_question_index = 0,
                    current_question_id = NULL,
                    imposteur_word_innocent = ?,
                    imposteur_word_imposteur = ?,
                    imposteur_theme = ?,
                    imposteur_phase = 'debate',
                    imposteur_eliminated_user_id = NULL
                WHERE id = ?
            ")->execute([$nowMs, $wordPair['word_innocent'], $wordPair['word_imposteur'], $wordPair['theme'], $lobby['id']]);

            // Reset players
            $stmtPlayerUpdate = $db->prepare("
                UPDATE lobby_players 
                SET is_eliminated = 0,
                    imposteur_role = ?,
                    imposteur_word = ?,
                    imposteur_voted_for_user_id = NULL,
                    current_score = 0,
                    current_question_index = 0,
                    finished_at = NULL,
                    elo_change = 0
                WHERE lobby_id = ? AND user_id = ?
            ");
            foreach ($playersList as $pId) {
                $isImposteur = (intval($pId) === intval($imposteurUserId));
                $role = $isImposteur ? 'imposteur' : 'innocent';
                $word = $isImposteur ? $wordPair['word_imposteur'] : $wordPair['word_innocent'];
                $stmtPlayerUpdate->execute([$role, $word, $lobby['id'], $pId]);
            }

            // Broadcast the state update
            $lobby['status'] = 'playing';
            $lobby['imposteur_word_innocent'] = $wordPair['word_innocent'];
            $lobby['imposteur_word_imposteur'] = $wordPair['word_imposteur'];
            $lobby['imposteur_theme'] = $wordPair['theme'];
            $lobby['imposteur_phase'] = 'debate';
            $lobby['imposteur_eliminated_user_id'] = null;
            $this->broadcastLobbyState($db, $lobby);

            echo json_encode(['success' => true]);
            return;
        }

        // Select random questions from the pack (5 for tribunal, 10 otherwise)
        $limit = ($lobby['game_mode'] === 'tribunal') ? 5 : 10;
        $stmtQuestions = $db->prepare("SELECT id FROM questions WHERE pack_id = ? ORDER BY RAND() LIMIT " . $limit);
        $stmtQuestions->execute([$lobby['pack_id']]);
        $questionRows = $stmtQuestions->fetchAll();

        if (empty($questionRows)) {
            http_response_code(400);
            echo json_encode(['error' => 'Ce pack ne contient aucune question.']);
            return;
        }

        $questionIds = array_column($questionRows, 'id');
        $questionsList = implode(',', $questionIds);

        // Set game_started_at (no countdown for tribunal, 3s countdown otherwise)
        $nowMs = round(microtime(true) * 1000);
        $countdownDuration = ($lobby['game_mode'] === 'tribunal') ? 0 : 3000;
        $gameStartedAt = $nowMs + $countdownDuration;

        // Update lobby: status=playing, store questions, set start time
        $tribunalPhase = null;
        $tribunalEndsAt = null;
        if ($lobby['game_mode'] === 'tribunal') {
            $tribunalPhase = 'writing';
            $tribunalEndsAt = $gameStartedAt + 45000; // 45 seconds for writing phase
        }

        $stmtUpdate = $db->prepare("
            UPDATE lobbies
            SET status = 'playing',
                questions_list = ?,
                game_started_at = ?,
                current_question_index = 0,
                current_question_id = NULL,
                tribunal_phase = ?,
                tribunal_phase_ends_at = ?
            WHERE id = ?
        ");
        $stmtUpdate->execute([$questionsList, $gameStartedAt, $tribunalPhase, $tribunalEndsAt, $lobby['id']]);

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

        // $lobby in memory still reflects the pre-update row (status='waiting',
        // old tribunal_phase, etc). Patch it locally so the broadcast carries
        // the real, just-written state instead of stale data.
        $lobby['status'] = 'playing';
        $lobby['questions_list'] = $questionsList;
        $lobby['game_started_at'] = $gameStartedAt;
        $lobby['current_question_index'] = 0;
        $lobby['current_question_id'] = null;
        $lobby['tribunal_phase'] = $tribunalPhase;
        $lobby['tribunal_phase_ends_at'] = $tribunalEndsAt;

        echo json_encode([
            'success' => true,
            'message' => 'La partie commence !',
            'countdown_ms' => 3000
        ]);
        \App\Utils\Pusher::finishResponse();
        $this->broadcastLobbyState($db, $lobby);
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

        if (intval($player['is_eliminated']) === 1) {
            http_response_code(403);
            echo json_encode(['error' => 'Vous êtes éliminé de cette partie.']);
            return;
        }

        $playerIndex = intval($player['current_question_index']);

        // Calculate elapsed time (anti-cheat)
        $nowMs = round(microtime(true) * 1000);
        $sentAt = intval($payload['sent_at']);
        $elapsedMs = $nowMs - $sentAt;

        // Dynamic time limit based on mode
        $timeLimit = ($lobby['game_mode'] === 'speed_blitz') ? 5000 : 15000;

        // Auto timeout if response time exceeds limit (excluding TIMEOUT message itself)
        if ($answer !== 'TIMEOUT' && $elapsedMs > $timeLimit) {
            $answer = 'TIMEOUT';
        }

        // Anti-bot: reject if answered too fast
        if ($elapsedMs < 200) {
            http_response_code(403);
            echo json_encode(['error' => "Tricherie détectée (Anti-Bot). Réponse soumise trop rapidement ($elapsedMs ms)."]);
            return;
        }

        // Validate answer format (depending on game mode / question type)
        $questionId = intval($payload['question_id']);
        $stmtQ = $db->prepare("SELECT question_type, correct_value, correct_opt, opt_a, opt_b, opt_c, opt_d FROM questions WHERE id = ?");
        $stmtQ->execute([$questionId]);
        $question = $stmtQ->fetch();

        if (!$question) {
            http_response_code(500);
            echo json_encode(['error' => 'Question introuvable.']);
            return;
        }

        $questionType = $question['question_type'] ?? 'multiple_choice';
        $isCorrect = false;
        $pointsAwarded = 0;
        $correctOpt = null;
        $correctText = '';

        if ($questionType === 'guess_number') {
            $correctValue = intval($question['correct_value'] ?? 0);
            $correctText = "Valeur attendue : " . $correctValue;

            if ($answer !== 'TIMEOUT') {
                $userVal = intval($answer);
                $diff = abs($userVal - $correctValue);
                $tolerance1 = 0.01 * $correctValue;
                $tolerance10 = 0.10 * $correctValue;

                if ($diff <= $tolerance1) {
                    $isCorrect = true;
                    $pointsAwarded = 150;
                } elseif ($diff <= $tolerance10) {
                    $isCorrect = true;
                    $pointsAwarded = 50;
                } else {
                    $isCorrect = false;
                }
            }
        } elseif ($questionType === 'open') {
            $correctText = $question['opt_a'] ?? '';
            if ($answer !== 'TIMEOUT') {
                $isCorrect = (self::cleanText($answer) === self::cleanText($correctText));
                if ($isCorrect) {
                    $pointsAwarded = 100;
                }
            }
        } else {
            // Standard Multiple Choice
            if (!in_array($answer, ['A', 'B', 'C', 'D', 'TIMEOUT'])) {
                http_response_code(400);
                echo json_encode(['error' => 'Réponse invalide. Choisissez A, B, C ou D.']);
                return;
            }
            $correctOpt = $payload['correct_opt'] ?? $question['correct_opt'];
            $isCorrect = ($answer === $correctOpt);

            // Get correct answer text
            $optMap = ['A' => 'opt_a', 'B' => 'opt_b', 'C' => 'opt_c', 'D' => 'opt_d'];
            $correctText = $question[$optMap[$correctOpt]] ?? '';
        }

        // Calculate points based on speed (only for correct multiple choice answers)
        if ($isCorrect && $pointsAwarded === 0) {
            $effectiveElapsed = min($elapsedMs, $timeLimit);
            $timeLeftRatio = max(0, ($timeLimit - $effectiveElapsed)) / $timeLimit;
            $pointsAwarded = max(10, intval(round(100 * $timeLeftRatio)));
        }

        // Sudden death elimination
        $isEliminatedNow = false;
        $finishedAt = null;
        if (!$isCorrect && $lobby['game_mode'] === 'sudden_death') {
            $isEliminatedNow = true;
            $finishedAt = date('Y-m-d H:i:s'); // DB format for datetime finished_at is NULL or datetime string
        }

        // Update player: add score and advance question index
        $newIndex = $playerIndex + 1;
        $stmtUpdate = $db->prepare("UPDATE lobby_players SET current_score = current_score + ?, current_question_index = ?, is_eliminated = ?, finished_at = ? WHERE lobby_id = ? AND user_id = ?");
        $stmtUpdate->execute([$pointsAwarded, $newIndex, $isEliminatedNow ? 1 : 0, $finishedAt, $lobby['id'], $user['user_id']]);

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
        \App\Utils\Pusher::finishResponse();
        $this->broadcastLobbyState($db, $lobby);
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

        // Verify player has answered all questions (skip if eliminated)
        if (intval($player['is_eliminated']) === 0) {
            $questionIds = explode(',', $lobby['questions_list']);
            $totalQuestions = count($questionIds);
            if (intval($player['current_question_index']) < $totalQuestions) {
                http_response_code(400);
                echo json_encode(['error' => 'Vous n\'avez pas encore répondu à toutes les questions.']);
                return;
            }
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
            // calculateFinalRankings() receives $lobby by value, so our
            // local copy still says status='playing' even though the DB
            // row is now 'finished'. Patch it so the broadcast reflects
            // the real state.
            $lobby['status'] = 'finished';
        }

        echo json_encode([
            'success' => true,
            'all_finished' => $allFinished
        ]);
        \App\Utils\Pusher::finishResponse();
        $this->broadcastLobbyState($db, $lobby);
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

        $stmtLobby = $db->prepare("SELECT * FROM lobbies WHERE room_code = ?");
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
        \App\Utils\Pusher::finishResponse();
        $this->broadcastLobbyState($db, $lobby);
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
            $lobby['status'] = 'finished';
        } else {
            // Non-host: just remove from players
            $db->prepare("DELETE FROM lobby_players WHERE lobby_id = ? AND user_id = ?")->execute([$lobby['id'], $user['user_id']]);
        }

        echo json_encode(['success' => true]);
        \App\Utils\Pusher::finishResponse();
        $this->broadcastLobbyState($db, $lobby);
    }

    private static function cleanText($text) {
        $text = mb_strtolower(trim($text), 'UTF-8');
        $unwanted_array = array(
            'à'=>'a', 'á'=>'a', 'â'=>'a', 'ã'=>'a', 'ä'=>'a', 'å'=>'a', 'æ'=>'a', 'ç'=>'c',
            'è'=>'e', 'é'=>'e', 'ê'=>'e', 'ë'=>'e', 'ì'=>'i', 'í'=>'i', 'î'=>'i', 'ï'=>'i',
            'ò'=>'o', 'ó'=>'o', 'ô'=>'o', 'õ'=>'o', 'ö'=>'o', 'ø'=>'o',
            'ù'=>'u', 'ú'=>'u', 'û'=>'u', 'ü'=>'u', 'ý'=>'y', 'ÿ'=>'y',
            'œ'=>'oe', 'æ'=>'ae'
        );
        $text = strtr($text, $unwanted_array);
        return preg_replace('/[^a-z0-9]/', '', $text);
    }

    // ================================================================
    // TRIBUNAL: SUBMIT ANSWER
    // ================================================================
    public function submitTribunalAnswer(array $data)
    {
        $user = AuthMiddleware::authenticate();
        $roomCode = strtoupper(trim($data['room_code'] ?? ''));
        $answerText = trim($data['answer'] ?? '');

        if ($answerText === '') {
            http_response_code(400);
            echo json_encode(['error' => 'La réponse ne peut pas être vide.']);
            return;
        }

        $db = Database::getConnection();

        $stmtLobby = $db->prepare("SELECT * FROM lobbies WHERE room_code = ?");
        $stmtLobby->execute([$roomCode]);
        $lobby = $stmtLobby->fetch();

        if (!$lobby || $lobby['status'] !== 'playing' || $lobby['game_mode'] !== 'tribunal') {
            http_response_code(400);
            echo json_encode(['error' => 'Salon invalide ou partie non en cours.']);
            return;
        }

        if ($lobby['tribunal_phase'] !== 'writing') {
            http_response_code(400);
            echo json_encode(['error' => 'La phase de saisie est terminée.']);
            return;
        }

        $round = intval($lobby['current_question_index']);

        // Check if user has already submitted for this round
        $stmtCheck = $db->prepare("SELECT id FROM tribunal_submissions WHERE lobby_id = ? AND round_number = ? AND user_id = ?");
        $stmtCheck->execute([$lobby['id'], $round, $user['user_id']]);
        if ($stmtCheck->fetch()) {
            http_response_code(400);
            echo json_encode(['error' => 'Vous avez déjà soumis votre réponse pour cette manche.']);
            return;
        }

        // Insert submission
        $stmtInsert = $db->prepare("INSERT INTO tribunal_submissions (lobby_id, round_number, user_id, answer_text) VALUES (?, ?, ?, ?)");
        $stmtInsert->execute([$lobby['id'], $round, $user['user_id'], $answerText]);

        // Fetch players and trigger transition check
        $stmtPlayers = $db->prepare("SELECT user_id FROM lobby_players WHERE lobby_id = ?");
        $stmtPlayers->execute([$lobby['id']]);
        $playerIds = $stmtPlayers->fetchAll(\PDO::FETCH_COLUMN);

        $nowMs = round(microtime(true) * 1000);
        $this->checkTribunalStateTransition($db, $lobby, $nowMs, $playerIds);

        echo json_encode(['success' => true]);
        \App\Utils\Pusher::finishResponse();
        $this->broadcastLobbyState($db, $lobby);
    }

    // ================================================================
    // TRIBUNAL: SUBMIT VOTE
    // ================================================================
    public function submitTribunalVote(array $data)
    {
        $user = AuthMiddleware::authenticate();
        $roomCode = strtoupper(trim($data['room_code'] ?? ''));
        $submissionId = intval($data['submission_id'] ?? 0);

        if ($submissionId <= 0) {
            http_response_code(400);
            echo json_encode(['error' => 'ID de soumission invalide.']);
            return;
        }

        $db = Database::getConnection();

        $stmtLobby = $db->prepare("SELECT * FROM lobbies WHERE room_code = ?");
        $stmtLobby->execute([$roomCode]);
        $lobby = $stmtLobby->fetch();

        if (!$lobby || $lobby['status'] !== 'playing' || $lobby['game_mode'] !== 'tribunal') {
            http_response_code(400);
            echo json_encode(['error' => 'Salon invalide ou partie non en cours.']);
            return;
        }

        if ($lobby['tribunal_phase'] !== 'voting') {
            http_response_code(400);
            echo json_encode(['error' => 'La phase de vote n\'est pas active.']);
            return;
        }

        $round = intval($lobby['current_question_index']);

        // Fetch submission to vote for
        $stmtSub = $db->prepare("SELECT * FROM tribunal_submissions WHERE id = ? AND lobby_id = ? AND round_number = ?");
        $stmtSub->execute([$submissionId, $lobby['id'], $round]);
        $targetSub = $stmtSub->fetch();

        if (!$targetSub) {
            http_response_code(404);
            echo json_encode(['error' => 'Réponse introuvable dans cette manche.']);
            return;
        }

        // Prevent self-voting
        if (intval($targetSub['user_id']) === $user['user_id']) {
            http_response_code(400);
            echo json_encode(['error' => 'Vous ne pouvez pas voter pour votre propre réponse !']);
            return;
        }

        // Update current player's submission row to set voted_for_user_id
        $stmtUpdate = $db->prepare("
            UPDATE tribunal_submissions
            SET voted_for_user_id = ?
            WHERE lobby_id = ? AND round_number = ? AND user_id = ?
        ");
        $stmtUpdate->execute([$targetSub['user_id'], $lobby['id'], $round, $user['user_id']]);

        // Fetch players and trigger transition check
        $stmtPlayers = $db->prepare("SELECT user_id FROM lobby_players WHERE lobby_id = ?");
        $stmtPlayers->execute([$lobby['id']]);
        $playerIds = $stmtPlayers->fetchAll(\PDO::FETCH_COLUMN);

        $nowMs = round(microtime(true) * 1000);
        $this->checkTribunalStateTransition($db, $lobby, $nowMs, $playerIds);

        echo json_encode(['success' => true]);
        \App\Utils\Pusher::finishResponse();
        $this->broadcastLobbyState($db, $lobby);
    }

    // ================================================================
    // TRIBUNAL: STATE MACHINE CHECK & TRANSITION (self-driving)
    // ================================================================
    private function checkTribunalStateTransition($db, &$lobby, $nowMs, $playerIds)
    {
        $phase = $lobby['tribunal_phase'];
        $endsAt = intval($lobby['tribunal_phase_ends_at']);
        $round = intval($lobby['current_question_index']);
        $playerCount = count($playerIds);

        if ($phase === 'writing') {
            // Count submissions
            $stmtS = $db->prepare("SELECT COUNT(*) FROM tribunal_submissions WHERE lobby_id = ? AND round_number = ?");
            $stmtS->execute([$lobby['id'], $round]);
            $submittedCount = intval($stmtS->fetchColumn());

            $timeExpired = ($nowMs >= $endsAt);
            $allSubmitted = ($submittedCount >= $playerCount);

            if ($allSubmitted || $timeExpired) {
                $questionIds = explode(',', $lobby['questions_list']);
                $nextRound = $round + 1;
                $hasMoreWriting = ($nextRound < count($questionIds));

                if ($hasMoreWriting) {
                    // Progress to the next writing round
                    $newEndsAt = $nowMs + 45000; // 45s for next question
                    $stmtUp = $db->prepare("
                        UPDATE lobbies
                        SET current_question_index = ?,
                            tribunal_phase = 'writing',
                            tribunal_phase_ends_at = ?
                        WHERE id = ? AND tribunal_phase = 'writing' AND current_question_index = ?
                    ");
                    $stmtUp->execute([$nextRound, $newEndsAt, $lobby['id'], $round]);
                } else {
                    // All 5 questions answered -> transition to voting phase starting at round 0
                    $newEndsAt = $nowMs + 30000; // 30s to vote for Q1
                    $stmtUp = $db->prepare("
                        UPDATE lobbies
                        SET current_question_index = 0,
                            tribunal_phase = 'voting',
                            tribunal_phase_ends_at = ?
                        WHERE id = ? AND tribunal_phase = 'writing' AND current_question_index = ?
                    ");
                    $stmtUp->execute([$newEndsAt, $lobby['id'], $round]);
                }

                if ($stmtUp->rowCount() === 0) {
                    $stmtReload = $db->prepare("SELECT tribunal_phase, tribunal_phase_ends_at, current_question_index, status FROM lobbies WHERE id = ?");
                    $stmtReload->execute([$lobby['id']]);
                    $reloaded = $stmtReload->fetch();
                    if ($reloaded) {
                        $lobby['tribunal_phase'] = $reloaded['tribunal_phase'];
                        $lobby['tribunal_phase_ends_at'] = $reloaded['tribunal_phase_ends_at'];
                        $lobby['current_question_index'] = $reloaded['current_question_index'];
                        $lobby['status'] = $reloaded['status'];
                    }
                    return;
                }

                // Autocomplete missing answers for the completed round
                $stmtMissing = $db->prepare("
                    SELECT lp.user_id
                    FROM lobby_players lp
                    LEFT JOIN tribunal_submissions ts ON lp.user_id = ts.user_id AND ts.lobby_id = ? AND ts.round_number = ?
                    WHERE lp.lobby_id = ? AND ts.id IS NULL
                ");
                $stmtMissing->execute([$lobby['id'], $round, $lobby['id']]);
                $missingPlayers = $stmtMissing->fetchAll();

                $defaultAnswers = [
                    "J'ai oublié d'écrire quelque chose...",
                    "Pas d'inspiration !",
                    "Mon chat a mangé mon clavier.",
                    "Je réfléchis encore...",
                    "Erreur 404 : Cerveau introuvable."
                ];

                foreach ($missingPlayers as $mp) {
                    $randAns = $defaultAnswers[array_rand($defaultAnswers)];
                    $stmtIns = $db->prepare("INSERT INTO tribunal_submissions (lobby_id, round_number, user_id, answer_text) VALUES (?, ?, ?, ?)");
                    $stmtIns->execute([$lobby['id'], $round, $mp['user_id'], $randAns]);
                }

                if ($hasMoreWriting) {
                    $lobby['current_question_index'] = $nextRound;
                    $lobby['tribunal_phase'] = 'writing';
                    $lobby['tribunal_phase_ends_at'] = $newEndsAt;

                    // Update player index so players screen syncs
                    $stmtPIdx = $db->prepare("UPDATE lobby_players SET current_question_index = ? WHERE lobby_id = ?");
                    $stmtPIdx->execute([$nextRound, $lobby['id']]);
                } else {
                    $lobby['current_question_index'] = 0;
                    $lobby['tribunal_phase'] = 'voting';
                    $lobby['tribunal_phase_ends_at'] = $newEndsAt;

                    // Reset player index to 0
                    $stmtPIdx = $db->prepare("UPDATE lobby_players SET current_question_index = 0 WHERE lobby_id = ?");
                    $stmtPIdx->execute([$lobby['id']]);
                }

                $this->broadcastLobbyState($db, $lobby);
            }
        } elseif ($phase === 'voting') {
            // Count votes (votes are set when voted_for_user_id is not null)
            $stmtV = $db->prepare("SELECT COUNT(*) FROM tribunal_submissions WHERE lobby_id = ? AND round_number = ? AND voted_for_user_id IS NOT NULL");
            $stmtV->execute([$lobby['id'], $round]);
            $votedCount = intval($stmtV->fetchColumn());

            $timeExpired = ($nowMs >= $endsAt);
            $allVoted = ($votedCount >= $playerCount);

            if ($allVoted || $timeExpired) {
                // Atomic transition update to prevent duplicate calculation of scores
                $newEndsAt = $nowMs + 15000; // 15 seconds of results display
                $stmtUp = $db->prepare("UPDATE lobbies SET tribunal_phase = 'results', tribunal_phase_ends_at = ? WHERE id = ? AND tribunal_phase = 'voting'");
                $stmtUp->execute([$newEndsAt, $lobby['id']]);

                if ($stmtUp->rowCount() === 0) {
                    $stmtReload = $db->prepare("SELECT tribunal_phase, tribunal_phase_ends_at, current_question_index, status FROM lobbies WHERE id = ?");
                    $stmtReload->execute([$lobby['id']]);
                    $reloaded = $stmtReload->fetch();
                    if ($reloaded) {
                        $lobby['tribunal_phase'] = $reloaded['tribunal_phase'];
                        $lobby['tribunal_phase_ends_at'] = $reloaded['tribunal_phase_ends_at'];
                        $lobby['current_question_index'] = $reloaded['current_question_index'];
                        $lobby['status'] = $reloaded['status'];
                    }
                    return;
                }

                // Calculate round scores
                $this->calculateTribunalRoundScores($db, $lobby, $round);

                $lobby['tribunal_phase'] = 'results';
                $lobby['tribunal_phase_ends_at'] = $newEndsAt;

                $this->broadcastLobbyState($db, $lobby);
            }
        } elseif ($phase === 'results') {
            $timeExpired = ($nowMs >= $endsAt);
            if ($timeExpired) {
                $questionIds = explode(',', $lobby['questions_list']);
                $nextRound = $round + 1;

                if ($nextRound < count($questionIds)) {
                    // Start next round's voting phase (atomic check to avoid multiple round increments)
                    $newEndsAt = $nowMs + 30000; // 30s to vote
                    $stmtUp = $db->prepare("
                        UPDATE lobbies
                        SET current_question_index = ?,
                            tribunal_phase = 'voting',
                            tribunal_phase_ends_at = ?
                        WHERE id = ? AND tribunal_phase = 'results' AND current_question_index = ?
                    ");
                    $stmtUp->execute([$nextRound, $newEndsAt, $lobby['id'], $round]);

                    if ($stmtUp->rowCount() === 0) {
                        $stmtReload = $db->prepare("SELECT tribunal_phase, tribunal_phase_ends_at, current_question_index, status FROM lobbies WHERE id = ?");
                        $stmtReload->execute([$lobby['id']]);
                        $reloaded = $stmtReload->fetch();
                        if ($reloaded) {
                            $lobby['tribunal_phase'] = $reloaded['tribunal_phase'];
                            $lobby['tribunal_phase_ends_at'] = $reloaded['tribunal_phase_ends_at'];
                            $lobby['current_question_index'] = $reloaded['current_question_index'];
                            $lobby['status'] = $reloaded['status'];
                        }
                        return;
                    }

                    $lobby['current_question_index'] = $nextRound;
                    $lobby['tribunal_phase'] = 'voting';
                    $lobby['tribunal_phase_ends_at'] = $newEndsAt;

                    // Update player index so players screen syncs
                    $stmtPIdx = $db->prepare("UPDATE lobby_players SET current_question_index = ? WHERE lobby_id = ?");
                    $stmtPIdx->execute([$nextRound, $lobby['id']]);

                    $this->broadcastLobbyState($db, $lobby);
                } else {
                    // Finish game (atomic check to prevent duplicate finish calculations)
                    $stmtUp = $db->prepare("UPDATE lobbies SET status = 'finished' WHERE id = ? AND status = 'playing'");
                    $stmtUp->execute([$lobby['id']]);
                    if ($stmtUp->rowCount() > 0) {
                        $lobby['status'] = 'finished';
                        $this->calculateFinalRankings($db, $lobby);
                        $this->broadcastLobbyState($db, $lobby);
                    } else {
                        $stmtReload = $db->prepare("SELECT status FROM lobbies WHERE id = ?");
                        $stmtReload->execute([$lobby['id']]);
                        $reloaded = $stmtReload->fetch();
                        if ($reloaded) {
                            $lobby['status'] = $reloaded['status'];
                        }
                    }
                }
            }
        }
    }

    private function calculateTribunalRoundScores($db, $lobby, $round)
    {
        // Fetch all submissions for the round
        $stmt = $db->prepare("SELECT * FROM tribunal_submissions WHERE lobby_id = ? AND round_number = ?");
        $stmt->execute([$lobby['id'], $round]);
        $submissions = $stmt->fetchAll();

        // Map of votes received by each user
        $votesReceived = [];
        foreach ($submissions as $sub) {
            $votedFor = $sub['voted_for_user_id'];
            if ($votedFor !== null) {
                $votedFor = (int) $votedFor;
                if (!isset($votesReceived[$votedFor])) {
                    $votesReceived[$votedFor] = 0;
                }
                $votesReceived[$votedFor]++;
            }
        }

        // Award points: +100 XP and +50 coins per vote received
        foreach ($submissions as $sub) {
            $authorId = (int) $sub['user_id'];
            $votes = $votesReceived[$authorId] ?? 0;
            $points = $votes * 100;

            if ($points > 0) {
                // Update lobby player score
                $stmtUp = $db->prepare("UPDATE lobby_players SET current_score = current_score + ? WHERE lobby_id = ? AND user_id = ?");
                $stmtUp->execute([$points, $lobby['id'], $authorId]);

                // Award XP and coins (50% of XP)
                $coins = intval($points / 2);
                $stmtXP = $db->prepare("UPDATE users SET global_score = global_score + ?, coins = coins + ? WHERE id = ?");
                $stmtXP->execute([$points, $coins, $authorId]);
            }
        }
    }

    public function submitImposteurVote(array $data)
    {
        $user = AuthMiddleware::authenticate();
        $roomCode = strtoupper(trim($data['room_code'] ?? ''));
        $targetUserId = intval($data['voted_for_user_id'] ?? 0);

        if ($targetUserId <= 0) {
            http_response_code(400);
            echo json_encode(['error' => 'ID du joueur requis.']);
            return;
        }

        $db = Database::getConnection();

        $stmtLobby = $db->prepare("SELECT * FROM lobbies WHERE room_code = ?");
        $stmtLobby->execute([$roomCode]);
        $lobby = $stmtLobby->fetch();

        if (!$lobby || $lobby['game_mode'] !== 'imposteur' || $lobby['status'] !== 'playing') {
            http_response_code(400);
            echo json_encode(['error' => 'Action invalide.']);
            return;
        }

        if ($lobby['imposteur_phase'] !== 'voting') {
            http_response_code(400);
            echo json_encode(['error' => 'La phase de vote n\'est pas active.']);
            return;
        }

        // Check if player is alive in the lobby
        $stmtPlayer = $db->prepare("SELECT * FROM lobby_players WHERE lobby_id = ? AND user_id = ?");
        $stmtPlayer->execute([$lobby['id'], $user['user_id']]);
        $player = $stmtPlayer->fetch();

        if (!$player || intval($player['is_eliminated']) === 1) {
            http_response_code(400);
            echo json_encode(['error' => 'Vous ne pouvez pas voter car vous avez été éliminé.']);
            return;
        }

        // Check if target is in the lobby and alive
        $stmtTarget = $db->prepare("SELECT * FROM lobby_players WHERE lobby_id = ? AND user_id = ?");
        $stmtTarget->execute([$lobby['id'], $targetUserId]);
        $target = $stmtTarget->fetch();

        if (!$target || intval($target['is_eliminated']) === 1) {
            http_response_code(400);
            echo json_encode(['error' => 'La cible du vote n\'est pas éligible ou a été éliminée.']);
            return;
        }

        // Update vote
        $db->prepare("UPDATE lobby_players SET imposteur_voted_for_user_id = ? WHERE lobby_id = ? AND user_id = ?")
           ->execute([$targetUserId, $lobby['id'], $user['user_id']]);

        // Check if all alive players have voted
        $stmtTotalAlive = $db->prepare("SELECT COUNT(*) FROM lobby_players WHERE lobby_id = ? AND is_eliminated = 0");
        $stmtTotalAlive->execute([$lobby['id']]);
        $totalAlive = (int) $stmtTotalAlive->fetchColumn();

        $stmtVotedAlive = $db->prepare("SELECT COUNT(*) FROM lobby_players WHERE lobby_id = ? AND is_eliminated = 0 AND imposteur_voted_for_user_id IS NOT NULL");
        $stmtVotedAlive->execute([$lobby['id']]);
        $totalVoted = (int) $stmtVotedAlive->fetchColumn();

        if ($totalVoted >= $totalAlive) {
            // Process the votes!
            $stmtAllVotes = $db->prepare("SELECT user_id, imposteur_voted_for_user_id FROM lobby_players WHERE lobby_id = ? AND is_eliminated = 0");
            $stmtAllVotes->execute([$lobby['id']]);
            $votesList = $stmtAllVotes->fetchAll();

            $counts = [];
            foreach ($votesList as $v) {
                $targetId = intval($v['imposteur_voted_for_user_id']);
                $counts[$targetId] = ($counts[$targetId] ?? 0) + 1;
            }

            // Find the player with the most votes
            arsort($counts);
            $keys = array_keys($counts);
            $maxVotes = $counts[$keys[0]];

            // Find if there is a tie
            $candidates = [];
            foreach ($counts as $uid => $vc) {
                if ($vc === $maxVotes) {
                    $candidates[] = $uid;
                }
            }

            // Resolve tie randomly
            $eliminatedUserId = $candidates[array_rand($candidates)];

            // Eliminate player
            $db->prepare("UPDATE lobby_players SET is_eliminated = 1 WHERE lobby_id = ? AND user_id = ?")
               ->execute([$lobby['id'], $eliminatedUserId]);

            // Save details in lobby
            $db->prepare("UPDATE lobbies SET imposteur_phase = 'results', imposteur_eliminated_user_id = ? WHERE id = ?")
               ->execute([$eliminatedUserId, $lobby['id']]);

            $lobby['imposteur_phase'] = 'results';
            $lobby['imposteur_eliminated_user_id'] = $eliminatedUserId;

            // Fetch details of eliminated player to check role
            $stmtElim = $db->prepare("SELECT imposteur_role, username FROM lobby_players lp JOIN users u ON lp.user_id = u.id WHERE lp.lobby_id = ? AND lp.user_id = ?");
            $stmtElim->execute([$lobby['id'], $eliminatedUserId]);
            $elimPlayer = $stmtElim->fetch();
            
            // Check win conditions
            $stmtRemainingPlayers = $db->prepare("SELECT user_id, imposteur_role FROM lobby_players WHERE lobby_id = ? AND is_eliminated = 0");
            $stmtRemainingPlayers->execute([$lobby['id']]);
            $remaining = $stmtRemainingPlayers->fetchAll();
            
            $imposteurCount = 0;
            $innocentCount = 0;
            foreach ($remaining as $r) {
                if ($r['imposteur_role'] === 'imposteur') {
                    $imposteurCount++;
                } else {
                    $innocentCount++;
                }
            }

            if ($imposteurCount === 0) {
                // Imposteur is eliminated! Innocents win!
                $lobby['status'] = 'finished';
                $this->calculateImposteurFinalRankings($db, $lobby, 'innocent');
            } elseif (count($remaining) <= 2) {
                // Only 2 players left and Imposteur is still alive! Imposteur wins!
                $lobby['status'] = 'finished';
                $this->calculateImposteurFinalRankings($db, $lobby, 'imposteur');
            }
        }

        $this->broadcastLobbyState($db, $lobby);
        echo json_encode(['success' => true]);
    }

    public function startImposteurVoting(array $data)
    {
        $user = AuthMiddleware::authenticate();
        $roomCode = strtoupper(trim($data['room_code'] ?? ''));

        $db = Database::getConnection();

        $stmtLobby = $db->prepare("SELECT * FROM lobbies WHERE room_code = ?");
        $stmtLobby->execute([$roomCode]);
        $lobby = $stmtLobby->fetch();

        if (!$lobby || $lobby['game_mode'] !== 'imposteur' || $lobby['status'] !== 'playing') {
            http_response_code(400);
            echo json_encode(['error' => 'Action invalide.']);
            return;
        }

        if (intval($lobby['host_id']) !== $user['user_id']) {
            http_response_code(403);
            echo json_encode(['error' => 'Seul l\'hôte peut lancer la phase de vote.']);
            return;
        }

        if ($lobby['imposteur_phase'] !== 'debate') {
            http_response_code(400);
            echo json_encode(['error' => 'Action impossible dans cette phase.']);
            return;
        }

        // Reset votes and change phase to voting
        $db->prepare("UPDATE lobby_players SET imposteur_voted_for_user_id = NULL WHERE lobby_id = ?")
           ->execute([$lobby['id']]);

        $db->prepare("UPDATE lobbies SET imposteur_phase = 'voting' WHERE id = ?")
           ->execute([$lobby['id']]);

        $lobby['imposteur_phase'] = 'voting';
        $this->broadcastLobbyState($db, $lobby);

        echo json_encode(['success' => true]);
    }

    public function startImposteurNextRound(array $data)
    {
        $user = AuthMiddleware::authenticate();
        $roomCode = strtoupper(trim($data['room_code'] ?? ''));

        $db = Database::getConnection();

        $stmtLobby = $db->prepare("SELECT * FROM lobbies WHERE room_code = ?");
        $stmtLobby->execute([$roomCode]);
        $lobby = $stmtLobby->fetch();

        if (!$lobby || $lobby['game_mode'] !== 'imposteur' || $lobby['status'] !== 'playing') {
            http_response_code(400);
            echo json_encode(['error' => 'Action invalide.']);
            return;
        }

        if (intval($lobby['host_id']) !== $user['user_id']) {
            http_response_code(403);
            echo json_encode(['error' => 'Seul l\'hôte peut passer à la manche suivante.']);
            return;
        }

        if ($lobby['imposteur_phase'] !== 'results') {
            http_response_code(400);
            echo json_encode(['error' => 'Action impossible dans cette phase.']);
            return;
        }

        // Reset votes, set eliminated to NULL in lobbies and change phase to debate
        $db->prepare("UPDATE lobby_players SET imposteur_voted_for_user_id = NULL WHERE lobby_id = ?")
           ->execute([$lobby['id']]);

        $db->prepare("UPDATE lobbies SET imposteur_phase = 'debate', imposteur_eliminated_user_id = NULL WHERE id = ?")
           ->execute([$lobby['id']]);

        $lobby['imposteur_phase'] = 'debate';
        $lobby['imposteur_eliminated_user_id'] = null;
        $this->broadcastLobbyState($db, $lobby);

        echo json_encode(['success' => true]);
    }

    private function calculateImposteurFinalRankings($db, $lobby, $winnerRole)
    {
        // Finish lobby status
        $db->prepare("UPDATE lobbies SET status = 'finished', current_question_id = NULL WHERE id = ?")
           ->execute([$lobby['id']]);

        // Get host/winner details
        $stmtHost = $db->prepare("SELECT username FROM users WHERE id = ?");
        $stmtHost->execute([$lobby['host_id']]);
        $hostUsername = $stmtHost->fetchColumn();

        // Get players ELOs and names
        $stmtPlayers = $db->prepare("
            SELECT lp.*, u.username, u.elo
            FROM lobby_players lp
            JOIN users u ON lp.user_id = u.id
            WHERE lp.lobby_id = ?
        ");
        $stmtPlayers->execute([$lobby['id']]);
        $players = $stmtPlayers->fetchAll();

        // Find the winner to log in matches
        $winnerLogName = ($winnerRole === 'innocent') ? 'Les Innocents' : 'L\'Imposteur';
        foreach ($players as $p) {
            if ($p['imposteur_role'] === $winnerRole) {
                $winnerLogName = $p['username'];
                break;
            }
        }

        // Get pack name
        $stmtPack = $db->prepare("SELECT name FROM packs WHERE id = ?");
        $stmtPack->execute([$lobby['pack_id']]);
        $packName = $stmtPack->fetchColumn() ?: "L'Imposteur";

        // Log match
        $stmtMatch = $db->prepare("INSERT INTO matches (room_code, game_mode, pack_name, winner_username) VALUES (?, ?, ?, ?)");
        $stmtMatch->execute([
            $lobby['room_code'],
            $lobby['game_mode'],
            $packName,
            $winnerLogName
        ]);

        // Compute Elo changes and coins
        foreach ($players as $p) {
            $role = $p['imposteur_role'];
            $isWinner = ($role === $winnerRole);
            
            $eloChange = $isWinner ? 15 : -10;
            $coinBonus = $isWinner ? 100 : 10;
            
            // Set current_score to 100 for winners, 0 for losers to display properly
            $score = $isWinner ? 100 : 0;

            // Update database values
            $db->prepare("UPDATE users SET elo = GREATEST(0, elo + ?), coins = coins + ? WHERE id = ?")
               ->execute([$eloChange, $coinBonus, $p['user_id']]);

            $db->prepare("UPDATE lobby_players SET elo_change = ?, current_score = ? WHERE lobby_id = ? AND user_id = ?")
               ->execute([$eloChange, $score, $lobby['id'], $p['user_id']]);
        }
    }
}