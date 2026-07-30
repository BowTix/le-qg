<?php
namespace App\Controllers;

use App\Config\Database;
use App\Middleware\AuthMiddleware;
use App\Utils\Pusher;

class ChronoBombController
{
    private const STARTING_LIVES = 3;
    private const MIN_FUSE_MS = 12000;
    private const MAX_FUSE_MS = 25000;
    private const EXPLOSION_PAUSE_MS = 2400;

    public function start($db, array &$lobby): void
    {
        $stmtPlayers = $db->prepare("SELECT user_id FROM lobby_players WHERE lobby_id = ? ORDER BY RAND()");
        $stmtPlayers->execute([$lobby['id']]);
        $playerIds = array_map('intval', $stmtPlayers->fetchAll(\PDO::FETCH_COLUMN));

        if (count($playerIds) < 2) {
            http_response_code(400);
            echo json_encode(['error' => 'Chrono-Bomb nécessite au moins 2 joueurs.']);
            return;
        }

        $prompt = $this->pickPrompt($db);
        if (!$prompt) {
            http_response_code(400);
            echo json_encode(['error' => 'Aucune contrainte Chrono-Bomb disponible. Lancez la migration du mode.']);
            return;
        }

        $nowMs = $this->nowMs();
        $gameStartedAt = $nowMs + 3000;
        $explodesAt = $gameStartedAt + random_int(self::MIN_FUSE_MS, self::MAX_FUSE_MS);

        $db->beginTransaction();
        try {
            $db->prepare("
                UPDATE lobbies
                SET status = 'playing',
                    game_started_at = ?,
                    current_question_index = 0,
                    chrono_prompt_id = ?,
                    chrono_current_player_id = ?,
                    chrono_explodes_at = ?,
                    chrono_phase = 'active',
                    chrono_phase_ends_at = NULL,
                    chrono_round = 1,
                    chrono_last_exploded_user_id = NULL
                WHERE id = ?
            ")->execute([$gameStartedAt, $prompt['id'], $playerIds[0], $explodesAt, $lobby['id']]);

            $orderCases = [];
            $resetParams = [self::STARTING_LIVES];
            foreach ($playerIds as $order => $playerId) {
                $orderCases[] = 'WHEN ? THEN ?';
                $resetParams[] = $playerId;
                $resetParams[] = $order;
            }
            $resetParams[] = $lobby['id'];
            $db->prepare("
                UPDATE lobby_players
                SET current_score = 0,
                    is_eliminated = 0,
                    finished_at = NULL,
                    chrono_lives = ?,
                    chrono_turn_order = CASE user_id " . implode(' ', $orderCases) . " END
                WHERE lobby_id = ?
            ")->execute($resetParams);
            $db->commit();
        } catch (\Throwable $e) {
            if ($db->inTransaction()) {
                $db->rollBack();
            }
            throw $e;
        }

        $lobby['status'] = 'playing';
        $lobby['game_started_at'] = $gameStartedAt;
        $lobby['chrono_prompt_id'] = $prompt['id'];
        $lobby['chrono_current_player_id'] = $playerIds[0];
        $lobby['chrono_explodes_at'] = $explodesAt;
        $lobby['chrono_phase'] = 'active';
        $lobby['chrono_phase_ends_at'] = null;
        $lobby['chrono_round'] = 1;
        $lobby['chrono_last_exploded_user_id'] = null;

        echo json_encode(['success' => true, 'message' => 'La bombe est amorcée !', 'countdown_ms' => 3000]);
        Pusher::finishResponse();
        $this->notifyRoom($lobby['room_code']);
    }

    public function submit(array $data): void
    {
        $user = AuthMiddleware::authenticate();
        $roomCode = strtoupper(trim($data['room_code'] ?? ''));
        $rawAnswer = trim($data['answer'] ?? '');

        if ($rawAnswer === '' || mb_strlen($rawAnswer) > 180) {
            http_response_code(400);
            echo json_encode(['error' => 'Réponse invalide.']);
            return;
        }

        $db = Database::getConnection();
        $db->beginTransaction();

        try {
            $stmtLobby = $db->prepare("
                SELECT l.*, lp.user_id AS submitting_player_id,
                       lp.is_eliminated AS submitting_player_eliminated
                FROM lobbies l
                LEFT JOIN lobby_players lp
                  ON lp.lobby_id = l.id AND lp.user_id = ?
                WHERE l.room_code = ?
                FOR UPDATE
            ");
            $stmtLobby->execute([$user['user_id'], $roomCode]);
            $lobby = $stmtLobby->fetch();

            if (!$lobby || $lobby['game_mode'] !== 'chrono_bomb' || $lobby['status'] !== 'playing') {
                throw new \RuntimeException('Partie Chrono-Bomb introuvable.');
            }
            if ($lobby['chrono_phase'] !== 'active') {
                throw new \RuntimeException('La bombe vient d’exploser.');
            }

            if ($this->nowMs() >= intval($lobby['chrono_explodes_at'])) {
                $db->rollBack();
                $this->checkTransition($db, $lobby);
                http_response_code(409);
                echo json_encode(['error' => 'Trop tard : la bombe a explosé !']);
                Pusher::finishResponse();
                $this->notifyRoom($roomCode);
                return;
            }

            if (intval($lobby['chrono_current_player_id']) !== intval($user['user_id'])) {
                throw new \RuntimeException('Ce n’est pas votre tour.');
            }

            if (
                $lobby['submitting_player_id'] === null
                || (int) $lobby['submitting_player_eliminated'] === 1
            ) {
                throw new \RuntimeException('Vous ne pouvez plus répondre dans cette partie.');
            }

            $stmtPrompt = $db->prepare("SELECT * FROM chrono_bomb_prompts WHERE id = ?");
            $stmtPrompt->execute([$lobby['chrono_prompt_id']]);
            $prompt = $stmtPrompt->fetch();
            $canonicalAnswer = $this->findCanonicalAnswer($rawAnswer, $prompt['answers_json'] ?? '[]');

            if ($canonicalAnswer === null) {
                throw new \DomainException('Réponse non reconnue pour cette contrainte.');
            }

            $normalized = $this->normalize($canonicalAnswer);
            $stmtInsert = $db->prepare("
                INSERT INTO chrono_bomb_answers
                    (lobby_id, round_number, prompt_id, user_id, normalized_answer, display_answer)
                VALUES (?, ?, ?, ?, ?, ?)
            ");
            try {
                $stmtInsert->execute([
                    $lobby['id'],
                    intval($lobby['chrono_round']),
                    intval($lobby['chrono_prompt_id']),
                    intval($user['user_id']),
                    $normalized,
                    $canonicalAnswer,
                ]);
            } catch (\PDOException $e) {
                if ($e->getCode() === '23000') {
                    throw new \DomainException('Cette réponse a déjà été donnée.');
                }
                throw $e;
            }

            $nextPlayerId = $this->nextAlivePlayerId($db, intval($lobby['id']), intval($user['user_id']));
            $db->prepare("
                UPDATE lobbies l
                JOIN lobby_players lp
                  ON lp.lobby_id = l.id AND lp.user_id = ?
                SET l.chrono_current_player_id = ?,
                    lp.current_score = lp.current_score + 1
                WHERE l.id = ?
            ")->execute([$user['user_id'], $nextPlayerId, $lobby['id']]);
            $db->commit();

            $pass = [
                'success' => true,
                'accepted_answer' => $canonicalAnswer,
                'next_player_id' => $nextPlayerId,
                'user_id' => intval($user['user_id']),
                'round' => intval($lobby['chrono_round']),
            ];
            echo json_encode($pass);
            Pusher::finishResponse();
            $this->notifyPass($roomCode, $pass);
        } catch (\DomainException $e) {
            if ($db->inTransaction()) {
                $db->rollBack();
            }
            http_response_code(422);
            echo json_encode(['error' => $e->getMessage()]);
        } catch (\RuntimeException $e) {
            if ($db->inTransaction()) {
                $db->rollBack();
            }
            http_response_code(409);
            echo json_encode(['error' => $e->getMessage()]);
        } catch (\Throwable $e) {
            if ($db->inTransaction()) {
                $db->rollBack();
            }
            throw $e;
        }
    }

    public function checkTransition($db, array &$lobby): bool
    {
        if ($lobby['status'] !== 'playing' || $lobby['game_mode'] !== 'chrono_bomb') {
            return false;
        }

        $nowMs = $this->nowMs();
        $db->beginTransaction();
        try {
            $stmtLock = $db->prepare("SELECT * FROM lobbies WHERE id = ? FOR UPDATE");
            $stmtLock->execute([$lobby['id']]);
            $locked = $stmtLock->fetch();
            if (!$locked || $locked['status'] !== 'playing') {
                $db->commit();
                return false;
            }

            if ($locked['chrono_phase'] === 'active' && $nowMs >= intval($locked['chrono_explodes_at'])) {
                $victimId = intval($locked['chrono_current_player_id']);
                $db->prepare("
                    UPDATE lobby_players
                    SET is_eliminated = IF(chrono_lives <= 1, 1, is_eliminated),
                        chrono_lives = GREATEST(0, chrono_lives - 1)
                    WHERE lobby_id = ? AND user_id = ?
                ")->execute([$locked['id'], $victimId]);

                $stmtAlive = $db->prepare("SELECT user_id FROM lobby_players WHERE lobby_id = ? AND is_eliminated = 0 ORDER BY chrono_turn_order");
                $stmtAlive->execute([$locked['id']]);
                $alive = array_map('intval', $stmtAlive->fetchAll(\PDO::FETCH_COLUMN));

                if (count($alive) <= 1) {
                    $winnerId = $alive[0] ?? null;
                    if ($winnerId) {
                        $db->prepare("UPDATE lobby_players SET current_score = current_score + 100, finished_at = ? WHERE lobby_id = ? AND user_id = ?")
                            ->execute([$nowMs, $locked['id'], $winnerId]);
                    }
                    $db->prepare("
                        UPDATE lobbies
                        SET status = 'finished',
                            chrono_phase = 'exploded',
                            chrono_phase_ends_at = ?,
                            chrono_last_exploded_user_id = ?
                        WHERE id = ?
                    ")->execute([$nowMs, $victimId, $locked['id']]);
                } else {
                    $db->prepare("
                        UPDATE lobbies
                        SET chrono_phase = 'exploded',
                            chrono_phase_ends_at = ?,
                            chrono_last_exploded_user_id = ?
                        WHERE id = ?
                    ")->execute([$nowMs + self::EXPLOSION_PAUSE_MS, $victimId, $locked['id']]);
                }
            } elseif (
                $locked['chrono_phase'] === 'exploded'
                && $nowMs >= intval($locked['chrono_phase_ends_at'])
            ) {
                $prompt = $this->pickPrompt($db, intval($locked['chrono_prompt_id']));
                $nextPlayerId = $this->nextAlivePlayerId(
                    $db,
                    intval($locked['id']),
                    intval($locked['chrono_last_exploded_user_id'])
                );
                $db->prepare("
                    UPDATE lobbies
                    SET chrono_prompt_id = ?,
                        chrono_current_player_id = ?,
                        chrono_explodes_at = ?,
                        chrono_phase = 'active',
                        chrono_phase_ends_at = NULL,
                        chrono_round = chrono_round + 1
                    WHERE id = ?
                ")->execute([
                    $prompt['id'],
                    $nextPlayerId,
                    $nowMs + random_int(self::MIN_FUSE_MS, self::MAX_FUSE_MS),
                    $locked['id'],
                ]);
            } else {
                $db->commit();
                return false;
            }

            $db->commit();
            $stmtReload = $db->prepare("SELECT * FROM lobbies WHERE id = ?");
            $stmtReload->execute([$lobby['id']]);
            $lobby = $stmtReload->fetch();
            $this->notifyRoom($lobby['room_code']);
            return true;
        } catch (\Throwable $e) {
            if ($db->inTransaction()) {
                $db->rollBack();
            }
            throw $e;
        }
    }

    public function decorateState($db, array $lobby, array &$response): void
    {
        $promptText = $lobby['chrono_prompt_text'] ?? null;

        $stmtAnswers = $db->prepare("
            SELECT cba.display_answer, cba.user_id, u.username
            FROM chrono_bomb_answers cba
            JOIN users u ON u.id = cba.user_id
            WHERE cba.lobby_id = ? AND cba.round_number = ?
            ORDER BY cba.id DESC
            LIMIT 12
        ");
        $stmtAnswers->execute([$lobby['id'], intval($lobby['chrono_round'])]);
        $usedAnswers = array_reverse($stmtAnswers->fetchAll());

        $nowMs = $this->nowMs();
        $remainingMs = $lobby['chrono_phase'] === 'active'
            ? max(0, intval($lobby['chrono_explodes_at']) - $nowMs)
            : max(0, intval($lobby['chrono_phase_ends_at']) - $nowMs);

        $response['chrono_bomb'] = [
            'phase' => $lobby['chrono_phase'],
            'round' => intval($lobby['chrono_round']),
            'prompt_text' => $promptText,
            'current_player_id' => $lobby['chrono_current_player_id'] ? intval($lobby['chrono_current_player_id']) : null,
            'last_exploded_user_id' => $lobby['chrono_last_exploded_user_id'] ? intval($lobby['chrono_last_exploded_user_id']) : null,
            'remaining_ms' => $remainingMs,
            'used_answers' => array_map(fn($answer) => [
                'answer' => $answer['display_answer'],
                'user_id' => intval($answer['user_id']),
                'username' => $answer['username'],
            ], $usedAnswers),
        ];
    }

    private function pickPrompt($db, ?int $excludedId = null): ?array
    {
        if ($excludedId) {
            $stmt = $db->prepare("SELECT * FROM chrono_bomb_prompts WHERE is_active = 1 AND id != ? ORDER BY RAND() LIMIT 1");
            $stmt->execute([$excludedId]);
            $prompt = $stmt->fetch();
            if ($prompt) {
                return $prompt;
            }
        }
        $prompt = $db->query("SELECT * FROM chrono_bomb_prompts WHERE is_active = 1 ORDER BY RAND() LIMIT 1")->fetch();
        return $prompt ?: null;
    }

    private function nextAlivePlayerId($db, int $lobbyId, int $currentPlayerId): int
    {
        $stmt = $db->prepare("
            SELECT user_id
            FROM lobby_players
            WHERE lobby_id = ? AND is_eliminated = 0
            ORDER BY chrono_turn_order
        ");
        $stmt->execute([$lobbyId]);
        $alive = array_map('intval', $stmt->fetchAll(\PDO::FETCH_COLUMN));
        if (!$alive) {
            throw new \RuntimeException('Aucun joueur encore en vie.');
        }
        $position = array_search($currentPlayerId, $alive, true);
        return $position === false ? $alive[0] : $alive[($position + 1) % count($alive)];
    }

    private function findCanonicalAnswer(string $rawAnswer, string $answersJson): ?string
    {
        $needle = $this->normalize($rawAnswer);
        $answers = json_decode($answersJson, true) ?: [];
        foreach ($answers as $answer) {
            $canonical = trim($answer['value'] ?? '');
            $possibilities = array_merge([$canonical], $answer['aliases'] ?? []);
            foreach ($possibilities as $possibility) {
                if ($needle === $this->normalize((string) $possibility)) {
                    return $canonical;
                }
            }
        }
        return null;
    }

    private function normalize(string $value): string
    {
        $value = mb_strtolower(trim($value), 'UTF-8');
        $ascii = iconv('UTF-8', 'ASCII//TRANSLIT//IGNORE', $value);
        if ($ascii !== false) {
            $value = $ascii;
        }
        $value = preg_replace('/[^a-z0-9]+/i', ' ', $value);
        return trim(preg_replace('/\s+/', ' ', $value));
    }

    private function notifyPass(string $roomCode, array $pass): void
    {
        Pusher::triggerAsync("lobby-" . $roomCode, 'chrono_bomb_passed', $pass);
    }

    private function notifyRoom(string $roomCode): void
    {
        Pusher::triggerAsync("lobby-" . $roomCode, 'lobby_refresh', ['reason' => 'chrono_bomb']);
    }

    private function nowMs(): int
    {
        return intval(round(microtime(true) * 1000));
    }
}
