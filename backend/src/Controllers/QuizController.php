<?php
namespace App\Controllers;

use App\Config\Database;
use App\Middleware\AuthMiddleware;
use App\Utils\JWT;
use PDO;

class QuizController {
    /**
     * GET /api/quiz/packs
     * Authenticated
     * Returns validated packs OR packs created by the requesting user
     */
    public function getPacks() {
        $user = AuthMiddleware::authenticate();
        $db = Database::getConnection();

        $stmt = $db->prepare("
            SELECT p.id, p.name, p.description, p.creator_id, p.is_validated, COUNT(q.id) as question_count
            FROM packs p
            LEFT JOIN questions q ON p.id = q.pack_id
            WHERE p.is_validated = 1 OR p.creator_id = ?
            GROUP BY p.id
            ORDER BY p.id DESC
        ");
        $stmt->execute([$user['user_id']]);
        $packs = $stmt->fetchAll();

        // Get total question count in database
        $totalQuestions = (int)$db->query("SELECT COUNT(*) FROM questions")->fetchColumn();
        if ($totalQuestions > 0) {
            $packs[] = [
                "id" => 0,
                "name" => "🎲 Thème Aléatoire",
                "description" => "Un mélange de 10 questions choisies au hasard parmi tous les thèmes.",
                "creator_id" => null,
                "is_validated" => 1,
                "question_count" => min($totalQuestions, 10)
            ];
        }

        echo json_encode($packs);
    }

    /**
     * POST /api/quiz/packs
     * Authenticated - Create a custom user pack (pending validation)
     */
    public function createPack(array $data) {
        $user = AuthMiddleware::authenticate();
        $name = trim($data['name'] ?? '');
        $description = trim($data['description'] ?? '');

        if (empty($name)) {
            http_response_code(400);
            echo json_encode(["error" => "Le nom du thème est requis."]);
            return;
        }

        $db = Database::getConnection();

        // The public creator flow always creates a proposal. Publication is an explicit admin action.
        $isValidated = 0;

        $stmt = $db->prepare("INSERT INTO packs (name, description, creator_id, is_validated) VALUES (?, ?, ?, ?)");
        $stmt->execute([$name, $description, $user['user_id'], $isValidated]);

        echo json_encode(["success" => true, "message" => "Thème créé ! En attente de validation par un admin."]);
    }

    /**
     * DELETE /api/quiz/packs
     * Authenticated - Delete a custom pack (must be creator or admin)
     */
    public function deletePack(array $data) {
        $user = AuthMiddleware::authenticate();
        $packId = (int) ($data['pack_id'] ?? 0);

        if ($packId <= 0) {
            http_response_code(400);
            echo json_encode(["error" => "pack_id manquant ou invalide."]);
            return;
        }

        $db = Database::getConnection();

        $stmtCheck = $db->prepare("SELECT creator_id FROM packs WHERE id = ?");
        $stmtCheck->execute([$packId]);
        $pack = $stmtCheck->fetch();

        if (!$pack) {
            http_response_code(404);
            echo json_encode(["error" => "Thème introuvable."]);
            return;
        }

        if ((int)$pack['creator_id'] !== $user['user_id'] && $user['role'] !== 'admin') {
            http_response_code(403);
            echo json_encode(["error" => "Interdit. Vous n'êtes pas le créateur de ce thème."]);
            return;
        }

        $stmtDelete = $db->prepare("DELETE FROM packs WHERE id = ?");
        $stmtDelete->execute([$packId]);

        echo json_encode(["success" => true, "message" => "Thème supprimé."]);
    }

    /**
     * GET /api/quiz/question
     * Authenticated
     */
    public function getQuestion(array $queryParams) {
        AuthMiddleware::authenticate();
        $packId = (int) ($queryParams['pack_id'] ?? 0);

        if ($packId < 0) {
            http_response_code(400);
            echo json_encode(["error" => "pack_id invalide."]);
            return;
        }

        $db = Database::getConnection();

        // Check if questions exist (exclusively QCM questions with 4 choices)
        if ($packId === 0) {
            $stmtCount = $db->query("SELECT COUNT(*) FROM questions WHERE question_type = 'qcm'");
        } else {
            $stmtCount = $db->prepare("SELECT COUNT(*) FROM questions WHERE pack_id = ? AND question_type = 'qcm'");
            $stmtCount->execute([$packId]);
        }
        $count = $stmtCount->fetchColumn();

        if ($count == 0) {
            http_response_code(404);
            echo json_encode(["error" => "Aucune question trouvée."]);
            return;
        }

        // Parse optional exclude query parameter
        $excludeIds = [];
        if (!empty($queryParams['exclude'])) {
            $excludeIds = array_filter(array_map('intval', explode(',', $queryParams['exclude'])));
        }

        $conditions = ["question_type = 'qcm'"];
        $params = [];
        if ($packId > 0) {
            $conditions[] = "pack_id = ?";
            $params[] = $packId;
        }

        if (!empty($excludeIds)) {
            $placeholders = implode(',', array_fill(0, count($excludeIds), '?'));
            $conditions[] = "id NOT IN ($placeholders)";
            $params = array_merge($params, $excludeIds);
        }

        $whereClause = " WHERE " . implode(' AND ', $conditions);

        // Fetch a random question (excluding already answered ones)
        $stmt = $db->prepare("SELECT id, question_text, opt_a, opt_b, opt_c, opt_d, correct_opt, question_type, media_url FROM questions$whereClause ORDER BY RAND() LIMIT 1");
        $stmt->execute($params);
        $question = $stmt->fetch();

        // Fallback if all questions are excluded
        if (!$question) {
            if (!empty($excludeIds)) {
                $placeholders = implode(',', array_fill(0, count($excludeIds), '?'));
                $stmtFallback = $db->prepare("SELECT id, question_text, opt_a, opt_b, opt_c, opt_d, correct_opt, question_type, media_url FROM questions WHERE question_type = 'qcm' AND id NOT IN ($placeholders) ORDER BY RAND() LIMIT 1");
                $stmtFallback->execute($excludeIds);
                $question = $stmtFallback->fetch();
            }

            if (!$question) {
                $question = $db->query("SELECT id, question_text, opt_a, opt_b, opt_c, opt_d, correct_opt, question_type, media_url FROM questions WHERE question_type = 'qcm' ORDER BY RAND() LIMIT 1")->fetch();
            }
        }

        $questionType = $question['question_type'] ?? 'qcm';
        $shuffledOptions = null;
        $correctOpt = 'A'; // default fallback for token

        // If it's open, or if it's media and opt_b is empty (open question with media illustration)
        if ($questionType === 'open' || ($questionType === 'media' && empty(trim($question['opt_b'] ?? '')))) {
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

            $correctKey = strtolower('opt_' . $question['correct_opt']);
            $correctAnswerText = $question[$correctKey] ?? '';

            foreach ($shuffledOptions as $key => $val) {
                if ($val === $correctAnswerText) {
                    $correctOpt = $key;
                    break;
                }
            }
        }

        // Create signed token containing question_id, sent_at & correct_opt
        $answerToken = JWT::generateAnswerToken($question['id'], ['correct_opt' => $correctOpt]);

        // Return clean payload (BLIND DATA - NO correct_opt)
        echo json_encode([
            "id" => (int) $question['id'],
            "question_text" => $question['question_text'],
            "question_type" => $questionType,
            "media_url" => $question['media_url'],
            "options" => $shuffledOptions,
            "answer_token" => $answerToken
        ]);
    }

    /**
     * POST /api/quiz/answer
     * Authenticated & Secure
     */
    private static function isGuessCorrect($userVal, $correctValue) {
        return $userVal === $correctValue;
    }

    private static function normalizeText($text) {
        $text = mb_strtolower(trim($text), 'UTF-8');

        if (class_exists('Transliterator')) {
            $transliterator = \Transliterator::create('Any-Latin; Latin-ASCII');
            if ($transliterator) {
                $text = $transliterator->transliterate($text);
            }
        } else {
            $unwanted_array = array(
                'à'=>'a', 'á'=>'a', 'â'=>'a', 'ã'=>'a', 'ä'=>'a', 'å'=>'a', 'æ'=>'a', 'ç'=>'c',
                'è'=>'e', 'é'=>'e', 'ê'=>'e', 'ë'=>'e', 'ì'=>'i', 'í'=>'i', 'î'=>'i', 'ï'=>'i',
                'ð'=>'o', 'ñ'=>'n', 'ò'=>'o', 'ó'=>'o', 'ô'=>'o', 'õ'=>'o', 'ö'=>'o', 'ø'=>'o',
                'ù'=>'u', 'ú'=>'u', 'û'=>'u', 'ü'=>'u', 'ý'=>'y', 'þ'=>'b', 'ÿ'=>'y',
                'œ'=>'oe', 'æ'=>'ae'
            );
            $text = strtr($text, $unwanted_array);
        }

        $text = preg_replace('/[^a-z0-9]/', '', $text);
        return $text;
    }

    /**
     * POST /api/quiz/answer
     * Authenticated & Secure
     */
    public function submitAnswer(array $data) {
        $user = AuthMiddleware::authenticate();

        $answerToken = $data['answer_token'] ?? '';
        $userAnswer = trim($data['answer'] ?? '');

        if (empty($answerToken)) {
            http_response_code(400);
            echo json_encode(["error" => "Token de réponse manquant."]);
            return;
        }

        // Decode and verify answer token
        $decoded = JWT::decode($answerToken);
        if (!$decoded || !isset($decoded['question_id']) || !isset($decoded['sent_at'])) {
            http_response_code(403);
            echo json_encode(["error" => "Session de question invalide ou expirée."]);
            return;
        }

        $questionId = (int) $decoded['question_id'];
        $sentAt = (int) $decoded['sent_at'];
        $now = (int) (microtime(true) * 1000); // Current time in ms
        $duration = $now - $sentAt;

        // Validation Temporelle (Anti-Bot / Speed Hack)
        if ($duration < 200) {
            http_response_code(403);
            echo json_encode([
                "error" => "Tricherie détectée (Anti-Bot). Réponse soumise trop rapidement ($duration ms).",
                "cheat_detected" => true
            ]);
            return;
        }

        $gameMode = $data['game_mode'] ?? 'kculture';
        if (!in_array($gameMode, ['classic', 'speed_blitz', 'sudden_death', 'guess_number', 'kculture'])) {
            $gameMode = 'kculture';
        }

        // Match duration to dynamic timer (5s for Blitz only, Culture & Pop has no timer)
        if ($gameMode === 'speed_blitz') {
            $timeLimitMs = 5000;
            $isTimeoutAnswer = (strtoupper(trim($data['answer'] ?? '')) === 'TIMEOUT');
            if (!$isTimeoutAnswer && $duration > $timeLimitMs) {
                http_response_code(403);
                echo json_encode(["error" => "Temps écoulé (Max 5s)."]);
                return;
            }
        }

        $db = Database::getConnection();

        // Fetch question info and user score in a single query to reduce database roundtrip latency
        $stmt = $db->prepare("
            SELECT q.question_type, q.correct_value, q.correct_opt, q.opt_a, q.opt_b, q.opt_c, q.opt_d, u.global_score, u.coins
            FROM questions q, users u
            WHERE q.id = ? AND u.id = ?
        ");
        $stmt->execute([$questionId, $user['user_id']]);
        $row = $stmt->fetch();

        if (!$row) {
            http_response_code(404);
            echo json_encode(["error" => "Question ou utilisateur introuvable."]);
            return;
        }

        $questionType = $row['question_type'] ?? 'qcm';
        $isCorrect = false;
        $correctText = '';
        $correctOpt = null;
        $pointsAwarded = 0;

        $isOpenType = ($questionType === 'open') || ($questionType === 'media' && empty(trim($row['opt_b'] ?? '')));

        if ($isOpenType) {
            $correctText = $row['opt_a'] ?? '';
            $isPass = in_array(strtoupper(trim($userAnswer)), ['PASSER', 'TIMEOUT', 'SKIP']);
            if ($isTimeoutAnswer || $isPass) {
                $isCorrect = false;
            } else {
                if (empty($userAnswer)) {
                    http_response_code(400);
                    echo json_encode(["error" => "Réponse vide."]);
                    return;
                }
                $isCorrect = (self::normalizeText($userAnswer) === self::normalizeText($correctText));
            }
        } else {
            $userAnswer = strtoupper($userAnswer);
            if ($userAnswer === 'TIMEOUT') {
                $isCorrect = false;
                $correctOpt = $decoded['correct_opt'] ?? $row['correct_opt'];
                $correctKey = strtolower('opt_' . $row['correct_opt']);
                $correctText = $row[$correctKey] ?? '';
            } else {
                if (!in_array($userAnswer, ['A', 'B', 'C', 'D'])) {
                    http_response_code(400);
                    echo json_encode(["error" => "Option de réponse invalide."]);
                    return;
                }
                $correctOpt = $decoded['correct_opt'] ?? $row['correct_opt'];
                $isCorrect = ($userAnswer === $correctOpt);
                $correctKey = strtolower('opt_' . $row['correct_opt']);
                $correctText = $row[$correctKey] ?? '';
            }
        }

        $coinsAwarded = 0;
        $newGlobalScore = (int) ($row['global_score'] ?? 0);
        $newCoins = (int) ($row['coins'] ?? 0);

        if ($isCorrect) {
            // Culture Pop (Solo libre): 1 coin / bonne réponse, 1 XP / bonne réponse
            $pointsAwarded = 1;
            $coinsAwarded = 1;

            $newGlobalScore += $pointsAwarded;
            $newCoins += $coinsAwarded;

            // Update user global score and coins
            $stmtUpdate = $db->prepare("UPDATE users SET global_score = ?, coins = ? WHERE id = ?");
            $stmtUpdate->execute([$newGlobalScore, $newCoins, $user['user_id']]);

            // Quests tracking
            \App\Controllers\QuestController::incrementProgress((int) $user['user_id'], 'solo_questions');
            \App\Controllers\QuestController::incrementProgress((int) $user['user_id'], 'coins_earned', $coinsAwarded);
            \App\Controllers\QuestController::incrementProgress((int) $user['user_id'], 'xp_earned', $pointsAwarded);
        }

        echo json_encode([
            "correct" => $isCorrect,
            "correct_option" => $correctOpt,
            "correct_text" => $correctText,
            "points_awarded" => $pointsAwarded,
            "coins_awarded" => $coinsAwarded,
            "global_score" => $newGlobalScore,
            "coins" => $newCoins,
            "response_time_ms" => $duration
        ]);
    }

    // ==========================================
    // USER THEME CREATOR ACTIONS (CRUD Questions)
    // ==========================================

    /**
     * GET /api/quiz/questions
     * Authenticated - Get questions in a pack (must be creator, admin, or pack must be validated)
     */
    public function getQuestions(array $params) {
        $user = AuthMiddleware::authenticate();
        $packId = (int) ($params['pack_id'] ?? 0);

        if ($packId <= 0) {
            http_response_code(400);
            echo json_encode(["error" => "pack_id requis."]);
            return;
        }

        $db = Database::getConnection();

        $stmtCheck = $db->prepare("SELECT creator_id, is_validated FROM packs WHERE id = ?");
        $stmtCheck->execute([$packId]);
        $pack = $stmtCheck->fetch();

        if (!$pack) {
            http_response_code(404);
            echo json_encode(["error" => "Thème introuvable."]);
            return;
        }

        if ((int)$pack['is_validated'] !== 1 && (int)$pack['creator_id'] !== $user['user_id'] && $user['role'] !== 'admin') {
            http_response_code(403);
            echo json_encode(["error" => "Interdit. Ce thème n'est pas encore validé."]);
            return;
        }

        $stmt = $db->prepare("SELECT * FROM questions WHERE pack_id = ? ORDER BY id DESC");
        $stmt->execute([$packId]);
        $questions = $stmt->fetchAll();

        echo json_encode($questions);
    }

    /**
     * POST /api/quiz/questions
     * Authenticated - Add a question to a public pack, or to one of your pending packs
     */
    public function createQuestion(array $data) {
        $user = AuthMiddleware::authenticate();

        $packId = (int) ($data['pack_id'] ?? 0);
        $questionText = trim($data['question_text'] ?? '');
        $questionType = trim($data['question_type'] ?? 'qcm');
        $optA = trim($data['opt_a'] ?? '');
        $optB = trim($data['opt_b'] ?? '');
        $optC = trim($data['opt_c'] ?? '');
        $optD = trim($data['opt_d'] ?? '');
        $correctOpt = strtoupper(trim($data['correct_opt'] ?? ''));
        $mediaUrl = trim($data['media_url'] ?? '');

        if ($questionType === 'multiple_choice') {
            $questionType = 'qcm';
        }

        $isOpenType = ($questionType === 'open') || ($questionType === 'media' && empty($optB));

        if ($isOpenType) {
            if ($packId <= 0 || empty($questionText) || empty($optA)) {
                http_response_code(400);
                echo json_encode(["error" => "La question et la réponse attendue sont requises."]);
                return;
            }
            $optB = '';
            $optC = '';
            $optD = '';
            $correctOpt = 'A';
        } else {
            if ($packId <= 0 || empty($questionText) || empty($optA) || empty($optB) || empty($optC) || empty($optD) || !in_array($correctOpt, ['A', 'B', 'C', 'D'])) {
                http_response_code(400);
                echo json_encode(["error" => "Tous les choix d'options et l'option correcte sont requis."]);
                return;
            }
        }

        $db = Database::getConnection();

        $stmtCheck = $db->prepare("SELECT creator_id, is_validated FROM packs WHERE id = ?");
        $stmtCheck->execute([$packId]);
        $pack = $stmtCheck->fetch();

        if (!$pack) {
            http_response_code(404);
            echo json_encode(["error" => "Thème introuvable."]);
            return;
        }

        $canContribute = (int)$pack['is_validated'] === 1
            || (int)$pack['creator_id'] === (int)$user['user_id']
            || $user['role'] === 'admin';

        if (!$canContribute) {
            http_response_code(403);
            echo json_encode(["error" => "Interdit. Vous n'êtes pas le créateur de ce thème."]);
            return;
        }

        if ($user['role'] !== 'admin' && (int)$pack['is_validated'] === 1) {
            $stmt = $db->prepare("
                INSERT INTO question_proposals
                    (pack_id, contributor_id, question_text, opt_a, opt_b, opt_c, opt_d, correct_opt, question_type, media_url)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ");
            $stmt->execute([$packId, $user['user_id'], $questionText, $optA, $optB, $optC, $optD, $correctOpt, $questionType, empty($mediaUrl) ? null : $mediaUrl]);
            echo json_encode(["success" => true, "pending" => true, "message" => "Question envoyee pour validation."]);
            return;
        }

        $stmt = $db->prepare("
            INSERT INTO questions (pack_id, question_text, opt_a, opt_b, opt_c, opt_d, correct_opt, question_type, media_url)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        ");
        $stmt->execute([$packId, $questionText, $optA, $optB, $optC, $optD, $correctOpt, $questionType, empty($mediaUrl) ? null : $mediaUrl]);

        \App\Controllers\QuestController::incrementProgress((int) $user['user_id'], 'questions_submitted', 1);

        echo json_encode(["success" => true, "message" => "Question ajoutée avec succès !"]);
    }

    /**
     * PUT /api/quiz/questions
     * Authenticated - Edit a question (must be creator of the pack or admin)
     */
    public function updateQuestion(array $data) {
        $user = AuthMiddleware::authenticate();

        $id = (int) ($data['id'] ?? 0);
        $questionText = trim($data['question_text'] ?? '');
        $questionType = trim($data['question_type'] ?? 'qcm');
        $optA = trim($data['opt_a'] ?? '');
        $optB = trim($data['opt_b'] ?? '');
        $optC = trim($data['opt_c'] ?? '');
        $optD = trim($data['opt_d'] ?? '');
        $correctOpt = strtoupper(trim($data['correct_opt'] ?? ''));
        $mediaUrl = trim($data['media_url'] ?? '');

        if ($questionType === 'multiple_choice') {
            $questionType = 'qcm';
        }

        $isOpenType = ($questionType === 'open') || ($questionType === 'media' && empty($optB));

        if ($isOpenType) {
            if ($id <= 0 || empty($questionText) || empty($optA)) {
                http_response_code(400);
                echo json_encode(["error" => "Champs invalides."]);
                return;
            }
            $optB = '';
            $optC = '';
            $optD = '';
            $correctOpt = 'A';
        } else {
            if ($id <= 0 || empty($questionText) || empty($optA) || empty($optB) || empty($optC) || empty($optD) || !in_array($correctOpt, ['A', 'B', 'C', 'D'])) {
                http_response_code(400);
                echo json_encode(["error" => "Champs invalides."]);
                return;
            }
        }

        $db = Database::getConnection();

        $stmtCheck = $db->prepare("SELECT p.creator_id FROM questions q JOIN packs p ON q.pack_id = p.id WHERE q.id = ?");
        $stmtCheck->execute([$id]);
        $pack = $stmtCheck->fetch();

        if (!$pack) {
            http_response_code(404);
            echo json_encode(["error" => "Question introuvable."]);
            return;
        }

        if ((int)$pack['creator_id'] !== $user['user_id'] && $user['role'] !== 'admin') {
            http_response_code(403);
            echo json_encode(["error" => "Interdit. Vous n'êtes pas autorisé à modifier cette question."]);
            return;
        }

        $stmt = $db->prepare("
            UPDATE questions
            SET question_text = ?, opt_a = ?, opt_b = ?, opt_c = ?, opt_d = ?, correct_opt = ?, question_type = ?, media_url = ?
            WHERE id = ?
        ");
        $stmt->execute([$questionText, $optA, $optB, $optC, $optD, $correctOpt, $questionType, empty($mediaUrl) ? null : $mediaUrl, $id]);

        echo json_encode(["success" => true, "message" => "Question modifiée avec succès !"]);
    }

    /**
     * DELETE /api/quiz/questions
     * Authenticated - Delete a question (must be creator of the pack or admin)
     */
    public function deleteQuestion(array $data) {
        $user = AuthMiddleware::authenticate();
        $id = (int) ($data['id'] ?? 0);

        if ($id <= 0) {
            http_response_code(400);
            echo json_encode(["error" => "ID de question invalide."]);
            return;
        }

        $db = Database::getConnection();

        $stmtCheck = $db->prepare("SELECT p.creator_id FROM questions q JOIN packs p ON q.pack_id = p.id WHERE q.id = ?");
        $stmtCheck->execute([$id]);
        $pack = $stmtCheck->fetch();

        if (!$pack) {
            http_response_code(404);
            echo json_encode(["error" => "Question introuvable."]);
            return;
        }

        if ((int)$pack['creator_id'] !== $user['user_id'] && $user['role'] !== 'admin') {
            http_response_code(403);
            echo json_encode(["error" => "Interdit. Vous n'êtes pas autorisé à supprimer cette question."]);
            return;
        }

        $stmt = $db->prepare("DELETE FROM questions WHERE id = ?");
        $stmt->execute([$id]);

        echo json_encode(["success" => true, "message" => "Question supprimée."]);
    }

    // ==========================================
    // ADMIN ACTIONS (CRUD & Validation)
    // ==========================================

    /**
     * POST /api/admin/packs/validate
     * Admin only - Approve pending pack
     */
    public function validatePack(array $data) {
        AuthMiddleware::requireAdmin();
        $packId = (int) ($data['pack_id'] ?? 0);

        if ($packId <= 0) {
            http_response_code(400);
            echo json_encode(["error" => "pack_id manquant ou invalide."]);
            return;
        }

        $db = Database::getConnection();

        $stmt = $db->prepare("UPDATE packs SET is_validated = 1 WHERE id = ?");
        $stmt->execute([$packId]);

        echo json_encode(["success" => true, "message" => "Thème validé et rendu public !"]);
    }

    /**
     * GET /api/admin/questions
     * Admin only
     */
    public function getAdminQuestions() {
        AuthMiddleware::requireAdmin();
        $packId = (int) ($_GET['pack_id'] ?? 0);
        $db = Database::getConnection();

        if ($packId <= 0) {
            $stmt = $db->query("
                SELECT q.id, q.question_text, q.question_type, p.name as pack_name
                FROM questions q
                JOIN packs p ON q.pack_id = p.id
                ORDER BY p.name ASC, q.id ASC
            ");
            $questions = $stmt->fetchAll();
            echo json_encode([
                "success" => true,
                "questions" => $questions
            ]);
            return;
        }

        $stmt = $db->prepare("SELECT * FROM questions WHERE pack_id = ? ORDER BY id DESC");
        $stmt->execute([$packId]);
        $questions = $stmt->fetchAll();

        echo json_encode($questions);
    }

    /**
     * POST /api/admin/questions
     * Admin only
     */
    public function createAdminQuestion(array $data) {
        AuthMiddleware::requireAdmin();

        $packId = (int) ($data['pack_id'] ?? 0);
        $questionText = trim($data['question_text'] ?? '');
        $questionType = trim($data['question_type'] ?? 'qcm');
        $optA = trim($data['opt_a'] ?? '');
        $optB = trim($data['opt_b'] ?? '');
        $optC = trim($data['opt_c'] ?? '');
        $optD = trim($data['opt_d'] ?? '');
        $correctOpt = strtoupper(trim($data['correct_opt'] ?? ''));
        $mediaUrl = trim($data['media_url'] ?? '');

        if ($questionType === 'multiple_choice') {
            $questionType = 'qcm';
        }

        $isOpenType = ($questionType === 'open') || ($questionType === 'media' && empty($optB));

        if ($isOpenType) {
            if ($packId <= 0 || empty($questionText) || empty($optA)) {
                http_response_code(400);
                echo json_encode(["error" => "Tous les champs sont requis."]);
                return;
            }
            $optB = '';
            $optC = '';
            $optD = '';
            $correctOpt = 'A';
        } else {
            if ($packId <= 0 || empty($questionText) || empty($optA) || empty($optB) || empty($optC) || empty($optD) || !in_array($correctOpt, ['A', 'B', 'C', 'D'])) {
                http_response_code(400);
                echo json_encode(["error" => "Tous les champs sont requis."]);
                return;
            }
        }

        $db = Database::getConnection();
        $stmt = $db->prepare("
            INSERT INTO questions (pack_id, question_text, opt_a, opt_b, opt_c, opt_d, correct_opt, question_type, media_url)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        ");
        $stmt->execute([$packId, $questionText, $optA, $optB, $optC, $optD, $correctOpt, $questionType, empty($mediaUrl) ? null : $mediaUrl]);

        echo json_encode(["success" => true, "message" => "Question ajoutée avec succès !"]);
    }

    /**
     * PUT /api/admin/questions
     * Admin only
     */
    public function updateAdminQuestion(array $data) {
        AuthMiddleware::requireAdmin();

        $id = (int) ($data['id'] ?? 0);
        $questionText = trim($data['question_text'] ?? '');
        $questionType = trim($data['question_type'] ?? 'qcm');
        $optA = trim($data['opt_a'] ?? '');
        $optB = trim($data['opt_b'] ?? '');
        $optC = trim($data['opt_c'] ?? '');
        $optD = trim($data['opt_d'] ?? '');
        $correctOpt = strtoupper(trim($data['correct_opt'] ?? ''));
        $mediaUrl = trim($data['media_url'] ?? '');

        if ($questionType === 'multiple_choice') {
            $questionType = 'qcm';
        }

        $isOpenType = ($questionType === 'open') || ($questionType === 'media' && empty($optB));

        if ($isOpenType) {
            if ($id <= 0 || empty($questionText) || empty($optA)) {
                http_response_code(400);
                echo json_encode(["error" => "Champs invalides."]);
                return;
            }
            $optB = '';
            $optC = '';
            $optD = '';
            $correctOpt = 'A';
        } else {
            if ($id <= 0 || empty($questionText) || empty($optA) || empty($optB) || empty($optC) || empty($optD) || !in_array($correctOpt, ['A', 'B', 'C', 'D'])) {
                http_response_code(400);
                echo json_encode(["error" => "Champs invalides."]);
                return;
            }
        }

        $db = Database::getConnection();
        $stmt = $db->prepare("
            UPDATE questions
            SET question_text = ?, opt_a = ?, opt_b = ?, opt_c = ?, opt_d = ?, correct_opt = ?, question_type = ?, media_url = ?
            WHERE id = ?
        ");
        $stmt->execute([$questionText, $optA, $optB, $optC, $optD, $correctOpt, $questionType, empty($mediaUrl) ? null : $mediaUrl, $id]);

        echo json_encode(["success" => true, "message" => "Question modifiée avec succès !"]);
    }

    /**
     * DELETE /api/admin/questions
     * Admin only
     */
    public function deleteAdminQuestion(array $data) {
        AuthMiddleware::requireAdmin();
        $id = (int) ($data['id'] ?? 0);

        if ($id <= 0) {
            http_response_code(400);
            echo json_encode(["error" => "ID de question invalide."]);
            return;
        }

        $db = Database::getConnection();
        $stmt = $db->prepare("DELETE FROM questions WHERE id = ?");
        $stmt->execute([$id]);

        echo json_encode(["success" => true, "message" => "Question supprimée."]);
    }

    /**
     * GET /api/admin/packs
     * Admin only
     * Lists all packs, joining creators and sorting pending (is_validated = 0) first
     */
    public function getAdminPacks() {
        AuthMiddleware::requireAdmin();
        $db = Database::getConnection();

        $stmt = $db->query("
            SELECT p.*, u.username as creator_username, COUNT(q.id) as question_count
            FROM packs p
            LEFT JOIN users u ON p.creator_id = u.id
            LEFT JOIN questions q ON p.id = q.pack_id
            GROUP BY p.id
            ORDER BY p.is_validated ASC, p.id DESC
        ");
        $packs = $stmt->fetchAll();

        echo json_encode($packs);
    }

    /**
     * POST /api/admin/packs
     * Admin only
     */
    public function createAdminPack(array $data) {
        AuthMiddleware::requireAdmin();

        $name = trim($data['name'] ?? '');
        $description = trim($data['description'] ?? '');

        if (empty($name)) {
            http_response_code(400);
            echo json_encode(["error" => "Le nom du pack est requis."]);
            return;
        }

        $db = Database::getConnection();
        $stmt = $db->prepare("INSERT INTO packs (name, description, is_validated) VALUES (?, ?, 1)");
        $stmt->execute([$name, $description]);

        echo json_encode(["success" => true, "message" => "Pack créé avec succès !"]);
    }

    /**
     * DELETE /api/admin/packs
     * Admin only
     */
    public function deleteAdminPack(array $data) {
        AuthMiddleware::requireAdmin();
        $packId = (int) ($data['pack_id'] ?? 0);

        if ($packId <= 0) {
            http_response_code(400);
            echo json_encode(["error" => "ID du pack invalide."]);
            return;
        }

        $db = Database::getConnection();
        $stmt = $db->prepare("DELETE FROM packs WHERE id = ?");
        $stmt->execute([$packId]);

        echo json_encode(["success" => true, "message" => "Pack supprimé avec succès."]);
    }

    /**
     * GET /api/quiz/leaderboard
     * Authenticated
     */
    public function getLeaderboard() {
        $authUser = AuthMiddleware::authenticate();
        $db = Database::getConnection();
        $userId = (int) ($authUser['user_id'] ?? $authUser['id'] ?? 0);

        // 1. Top players sorted by collection value
        $stmtUsers = $db->query("
            SELECT
                u.id,
                u.username,
                u.discriminator,
                u.global_score,
                u.avatar_url,
                u.equipped_border,
                u.equipped_title,
                u.equipped_color,
                COUNT(DISTINCT uc.card_id) as cards_count,
                COALESCE(SUM(
                    CASE
                        WHEN c.id IS NULL THEN 0
                        WHEN c.rarity = 'legendary' THEN 1000
                        WHEN c.rarity = 'epic' THEN 300
                        WHEN c.rarity = 'rare' THEN 100
                        ELSE 30
                    END
                ), 0) as collection_value
            FROM users u
            LEFT JOIN user_cards uc ON u.id = uc.user_id AND uc.quantity > 0
            LEFT JOIN cards c ON uc.card_id = c.id
            GROUP BY u.id, u.username, u.discriminator, u.global_score, u.avatar_url, u.equipped_border, u.equipped_title, u.equipped_color
            ORDER BY collection_value DESC, u.global_score DESC
            LIMIT 30
        ");
        $topPlayers = $stmtUsers->fetchAll(\PDO::FETCH_ASSOC);

        // 2. Top players sorted by global score (quiz)
        $stmtScore = $db->query("
            SELECT
                u.id,
                u.username,
                u.discriminator,
                u.global_score,
                u.avatar_url,
                u.equipped_border,
                u.equipped_title,
                u.equipped_color
            FROM users u
            ORDER BY u.global_score DESC, u.id ASC
            LIMIT 30
        ");
        $topScore = $stmtScore->fetchAll(\PDO::FETCH_ASSOC);

        // 3. Top players by daily games / logic puzzles solved
        $stmtLogic = $db->query("
            SELECT
                u.id,
                u.username,
                u.discriminator,
                u.global_score,
                u.avatar_url,
                u.equipped_border,
                u.equipped_title,
                u.equipped_color,
                (
                    COALESCE((SELECT COUNT(*) FROM daily_quiz_attempts dqa WHERE dqa.user_id = u.id), 0) +
                    COALESCE((SELECT COUNT(*) FROM user_queens_attempts uqa WHERE uqa.user_id = u.id AND uqa.status = 'completed'), 0) +
                    COALESCE((SELECT COUNT(*) FROM user_sudoku_attempts usa WHERE usa.user_id = u.id AND usa.status = 'completed'), 0) +
                    COALESCE((SELECT COUNT(*) FROM user_shikaku_attempts ush WHERE ush.user_id = u.id AND ush.status = 'completed'), 0) +
                    COALESCE((SELECT COUNT(*) FROM user_mystery_word_attempts umw WHERE umw.user_id = u.id AND umw.status = 'won'), 0) +
                    COALESCE((SELECT COUNT(*) FROM user_connections_attempts uca WHERE uca.user_id = u.id AND uca.status = 'completed'), 0)
                ) as puzzles_solved
            FROM users u
            GROUP BY u.id, u.username, u.discriminator, u.global_score, u.avatar_url, u.equipped_border, u.equipped_title, u.equipped_color
            HAVING puzzles_solved > 0
            ORDER BY puzzles_solved DESC, u.global_score DESC
            LIMIT 30
        ");
        $topLogic = $stmtLogic ? $stmtLogic->fetchAll(\PDO::FETCH_ASSOC) : [];

        // 4. Current user stats & rank calculation
        $userStats = [
            'collection_rank' => null,
            'score_rank' => null,
            'collection_value' => 0,
            'cards_count' => 0,
            'daily_quiz_count' => 0,
            'queens_count' => 0,
            'sudoku_count' => 0,
            'shikaku_count' => 0,
            'mystery_word_count' => 0,
            'connections_count' => 0,
            'total_puzzles_solved' => 0,
            'multi_wins' => 0
        ];

        if ($userId) {
            // Find collection rank
            try {
                $stmtColRank = $db->prepare("
                    SELECT COUNT(*) + 1 as user_rank
                    FROM (
                        SELECT u.id,
                               COALESCE(SUM(
                                   CASE
                                       WHEN c.id IS NULL THEN 0
                                       WHEN c.rarity = 'legendary' THEN 1000
                                       WHEN c.rarity = 'epic' THEN 300
                                       WHEN c.rarity = 'rare' THEN 100
                                       ELSE 30
                                   END
                               ), 0) as cv
                        FROM users u
                        LEFT JOIN user_cards uc ON u.id = uc.user_id AND uc.quantity > 0
                        LEFT JOIN cards c ON uc.card_id = c.id
                        GROUP BY u.id
                    ) as ranks
                    WHERE cv > (
                        SELECT COALESCE(SUM(
                                   CASE
                                       WHEN c2.id IS NULL THEN 0
                                       WHEN c2.rarity = 'legendary' THEN 1000
                                       WHEN c2.rarity = 'epic' THEN 300
                                       WHEN c2.rarity = 'rare' THEN 100
                                       ELSE 30
                                   END
                               ), 0)
                        FROM user_cards uc2
                        LEFT JOIN cards c2 ON uc2.card_id = c2.id
                        WHERE uc2.user_id = ? AND uc2.quantity > 0
                    )
                ");
                $stmtColRank->execute([$userId]);
                $userStats['collection_rank'] = (int)($stmtColRank->fetchColumn() ?: 1);
            } catch (\Exception $e) {
                $userStats['collection_rank'] = 1;
            }

            // Find score rank
            try {
                $stmtScrRank = $db->prepare("SELECT COUNT(*) + 1 FROM users WHERE global_score > (SELECT global_score FROM users WHERE id = ?)");
                $stmtScrRank->execute([$userId]);
                $userStats['score_rank'] = (int)($stmtScrRank->fetchColumn() ?: 1);
            } catch (\Exception $e) {
                $userStats['score_rank'] = 1;
            }

            // Detailed counts for current user
            try {
                $stmtColVal = $db->prepare("
                    SELECT COUNT(DISTINCT uc.card_id) as cards_count,
                           COALESCE(SUM(
                               CASE
                                   WHEN c.id IS NULL THEN 0
                                   WHEN c.rarity = 'legendary' THEN 1000
                                   WHEN c.rarity = 'epic' THEN 300
                                   WHEN c.rarity = 'rare' THEN 100
                                   ELSE 30
                               END
                           ), 0) as collection_value
                    FROM user_cards uc
                    LEFT JOIN cards c ON uc.card_id = c.id
                    WHERE uc.user_id = ? AND uc.quantity > 0
                ");
                $stmtColVal->execute([$userId]);
                $colData = $stmtColVal->fetch(\PDO::FETCH_ASSOC);
                if ($colData) {
                    $userStats['cards_count'] = (int)$colData['cards_count'];
                    $userStats['collection_value'] = (int)$colData['collection_value'];
                }
            } catch (\Exception $e) {}

            // Games counts
            try {
                $stmtDq = $db->prepare("SELECT COUNT(*) FROM daily_quiz_attempts WHERE user_id = ?");
                $stmtDq->execute([$userId]);
                $userStats['daily_quiz_count'] = (int)$stmtDq->fetchColumn();
            } catch (\Exception $e) {}

            try {
                $stmtQ = $db->prepare("SELECT COUNT(*) FROM user_queens_attempts WHERE user_id = ? AND status = 'completed'");
                $stmtQ->execute([$userId]);
                $userStats['queens_count'] = (int)$stmtQ->fetchColumn();
            } catch (\Exception $e) {}

            try {
                $stmtS = $db->prepare("SELECT COUNT(*) FROM user_sudoku_attempts WHERE user_id = ? AND status = 'completed'");
                $stmtS->execute([$userId]);
                $userStats['sudoku_count'] = (int)$stmtS->fetchColumn();
            } catch (\Exception $e) {}

            try {
                $stmtSh = $db->prepare("SELECT COUNT(*) FROM user_shikaku_attempts WHERE user_id = ? AND status = 'completed'");
                $stmtSh->execute([$userId]);
                $userStats['shikaku_count'] = (int)$stmtSh->fetchColumn();
            } catch (\Exception $e) {}

            try {
                $stmtMw = $db->prepare("SELECT COUNT(*) FROM user_mystery_word_attempts WHERE user_id = ? AND status = 'won'");
                $stmtMw->execute([$userId]);
                $userStats['mystery_word_count'] = (int)$stmtMw->fetchColumn();
            } catch (\Exception $e) {}

            try {
                $stmtConn = $db->prepare("SELECT COUNT(*) FROM user_connections_attempts WHERE user_id = ? AND status = 'completed'");
                $stmtConn->execute([$userId]);
                $userStats['connections_count'] = (int)$stmtConn->fetchColumn();
            } catch (\Exception $e) {}

            $userStats['total_puzzles_solved'] = $userStats['daily_quiz_count'] + $userStats['queens_count'] + $userStats['sudoku_count'] + $userStats['shikaku_count'] + $userStats['mystery_word_count'] + $userStats['connections_count'];

            // Multi wins
            try {
                $stmtMwWins = $db->prepare("SELECT COUNT(*) FROM matches WHERE winner_username = (SELECT username FROM users WHERE id = ?)");
                $stmtMwWins->execute([$userId]);
                $userStats['multi_wins'] = (int)$stmtMwWins->fetchColumn();
            } catch (\Exception $e) {}
        }

        // 5. User Personal History (combining recent game sessions across all modes)
        $userHistory = [];
        if ($userId) {
            try {
                $stmtH1 = $db->prepare("SELECT 'daily_quiz' as type, 'Quiz du Jour' as game_title, date as played_date, score, 0 as time_spent, 1 as success, created_at FROM daily_quiz_attempts WHERE user_id = ? ORDER BY date DESC LIMIT 15");
                $stmtH1->execute([$userId]);
                $userHistory = array_merge($userHistory, $stmtH1->fetchAll(\PDO::FETCH_ASSOC));
            } catch (\Exception $e) {}

            try {
                $stmtH2 = $db->prepare("SELECT 'queens' as type, 'Queens' as game_title, play_date as played_date, score_awarded as score, time_spent_seconds as time_spent, (status = 'completed') as success, COALESCE(completed_at, created_at) as created_at FROM user_queens_attempts WHERE user_id = ? ORDER BY play_date DESC LIMIT 15");
                $stmtH2->execute([$userId]);
                $userHistory = array_merge($userHistory, $stmtH2->fetchAll(\PDO::FETCH_ASSOC));
            } catch (\Exception $e) {}

            try {
                $stmtH3 = $db->prepare("SELECT 'sudoku' as type, 'Sudoku' as game_title, play_date as played_date, score_awarded as score, time_spent_seconds as time_spent, (status = 'completed') as success, COALESCE(completed_at, created_at) as created_at FROM user_sudoku_attempts WHERE user_id = ? ORDER BY play_date DESC LIMIT 15");
                $stmtH3->execute([$userId]);
                $userHistory = array_merge($userHistory, $stmtH3->fetchAll(\PDO::FETCH_ASSOC));
            } catch (\Exception $e) {}

            try {
                $stmtH4 = $db->prepare("SELECT 'shikaku' as type, 'Shikaku' as game_title, play_date as played_date, score_awarded as score, time_spent_seconds as time_spent, (status = 'completed') as success, COALESCE(completed_at, created_at) as created_at FROM user_shikaku_attempts WHERE user_id = ? ORDER BY play_date DESC LIMIT 15");
                $stmtH4->execute([$userId]);
                $userHistory = array_merge($userHistory, $stmtH4->fetchAll(\PDO::FETCH_ASSOC));
            } catch (\Exception $e) {}

            try {
                $stmtH5 = $db->prepare("SELECT 'mystery_word' as type, 'Mot Mystère' as game_title, game_date as played_date, score_awarded as score, 0 as time_spent, (status = 'won') as success, created_at FROM user_mystery_word_attempts WHERE user_id = ? ORDER BY game_date DESC LIMIT 15");
                $stmtH5->execute([$userId]);
                $userHistory = array_merge($userHistory, $stmtH5->fetchAll(\PDO::FETCH_ASSOC));
            } catch (\Exception $e) {}

            try {
                $stmtH6 = $db->prepare("SELECT 'connections' as type, 'Les Liens' as game_title, play_date as played_date, score_awarded as score, time_spent_seconds as time_spent, (status = 'completed') as success, COALESCE(completed_at, created_at) as created_at FROM user_connections_attempts WHERE user_id = ? ORDER BY play_date DESC LIMIT 15");
                $stmtH6->execute([$userId]);
                $userHistory = array_merge($userHistory, $stmtH6->fetchAll(\PDO::FETCH_ASSOC));
            } catch (\Exception $e) {}

            usort($userHistory, function($a, $b) {
                $tA = strtotime($a['created_at'] ?? $a['played_date'] ?? 'now');
                $tB = strtotime($b['created_at'] ?? $b['played_date'] ?? 'now');
                return $tB - $tA;
            });
            $userHistory = array_slice($userHistory, 0, 40);
        }

        // 6. Recent 25 Arena Matches
        $stmtMatches = $db->query("
            SELECT *
            FROM matches
            ORDER BY id DESC
            LIMIT 25
        ");
        $recentMatches = $stmtMatches ? $stmtMatches->fetchAll(\PDO::FETCH_ASSOC) : [];

        echo json_encode([
            "success" => true,
            "top_players" => $topPlayers,
            "top_score" => $topScore,
            "top_logic" => $topLogic,
            "user_stats" => $userStats,
            "user_history" => $userHistory,
            "recent_matches" => $recentMatches
        ]);
    }

    // =========================================================================
    // DAILY QUIZ FEATURES
    // =========================================================================

    /**
     * Ensures a daily quiz exists for the given date.
     * If not already scheduled manually, automatically generates a balanced 3-question quiz:
     * - From 3 distinct validated themes/packs
     * - Avoiding questions used in the last 60 days
     * - Persisted to `daily_quizzes` table so all players get the exact same questions and shared stats
     */
    public function ensureDailyQuiz(\PDO $db, ?string $today = null): ?array {
        $today = $today ?: date('Y-m-d');

        // 1. Check if already exists (manually planned or previously auto-generated)
        $stmt = $db->prepare("SELECT * FROM daily_quizzes WHERE date = ?");
        $stmt->execute([$today]);
        $existing = $stmt->fetch(PDO::FETCH_ASSOC);
        if ($existing) {
            return $existing;
        }

        // 2. Collect recently used question IDs (last 60 days) to avoid repetition
        $recentStmt = $db->prepare("
            SELECT q1_id, q2_id, q3_id 
            FROM daily_quizzes 
            WHERE date >= DATE_SUB(?, INTERVAL 60 DAY)
        ");
        $recentStmt->execute([$today]);
        $excludedIds = [];
        while ($row = $recentStmt->fetch(PDO::FETCH_ASSOC)) {
            if (!empty($row['q1_id'])) $excludedIds[] = (int)$row['q1_id'];
            if (!empty($row['q2_id'])) $excludedIds[] = (int)$row['q2_id'];
            if (!empty($row['q3_id'])) $excludedIds[] = (int)$row['q3_id'];
        }
        $excludedIds = array_unique($excludedIds);

        // 3. Find available validated packs with questions
        $packsStmt = $db->query("
            SELECT p.id 
            FROM packs p
            JOIN questions q ON q.pack_id = p.id
            WHERE p.is_validated = 1
            GROUP BY p.id
            HAVING COUNT(q.id) >= 3
            ORDER BY p.id ASC
        ");
        $availablePackIds = $packsStmt->fetchAll(PDO::FETCH_COLUMN);

        if (count($availablePackIds) < 3) {
            $availablePackIds = $db->query("
                SELECT DISTINCT p.id 
                FROM packs p
                JOIN questions q ON q.pack_id = p.id
                WHERE p.is_validated = 1
            ")->fetchAll(PDO::FETCH_COLUMN);
        }

        if (empty($availablePackIds)) {
            return null;
        }

        // Deterministic date seed for pack & question selection
        $seed = abs(crc32($today . '_daily_qg_quiz_salt'));
        mt_srand($seed);

        // Fisher-Yates shuffle using seeded mt_rand
        $shuffledPacks = $availablePackIds;
        for ($i = count($shuffledPacks) - 1; $i > 0; $i--) {
            $j = mt_rand(0, $i);
            $tmp = $shuffledPacks[$i];
            $shuffledPacks[$i] = $shuffledPacks[$j];
            $shuffledPacks[$j] = $tmp;
        }

        $selectedPacks = array_slice($shuffledPacks, 0, 3);
        $chosenQuestionIds = [];

        foreach ($selectedPacks as $packId) {
            $qStmt = $db->prepare("SELECT id FROM questions WHERE pack_id = ? ORDER BY id ASC");
            $qStmt->execute([$packId]);
            $packQuestions = $qStmt->fetchAll(PDO::FETCH_COLUMN);

            if (empty($packQuestions)) continue;

            $candidates = array_values(array_diff($packQuestions, $excludedIds));
            if (empty($candidates)) {
                $candidates = $packQuestions;
            }

            $idx = mt_rand(0, count($candidates) - 1);
            $chosenId = (int)$candidates[$idx];

            if (!in_array($chosenId, $chosenQuestionIds, true)) {
                $chosenQuestionIds[] = $chosenId;
                $excludedIds[] = $chosenId;
            }
        }

        // Fill up to 3 if needed
        if (count($chosenQuestionIds) < 3) {
            $allValidQ = $db->query("
                SELECT q.id 
                FROM questions q 
                JOIN packs p ON p.id = q.pack_id 
                WHERE p.is_validated = 1 
                ORDER BY q.id ASC
            ")->fetchAll(PDO::FETCH_COLUMN);

            $remaining = array_values(array_diff($allValidQ, $chosenQuestionIds));
            while (count($chosenQuestionIds) < 3 && !empty($remaining)) {
                $idx = mt_rand(0, count($remaining) - 1);
                $chosenQuestionIds[] = (int)$remaining[$idx];
                array_splice($remaining, $idx, 1);
            }
        }

        if (count($chosenQuestionIds) < 3) {
            return null;
        }

        // Atomically insert into daily_quizzes
        $insertStmt = $db->prepare("
            INSERT INTO daily_quizzes (date, q1_id, q2_id, q3_id)
            VALUES (?, ?, ?, ?)
            ON DUPLICATE KEY UPDATE date = date
        ");
        $insertStmt->execute([$today, $chosenQuestionIds[0], $chosenQuestionIds[1], $chosenQuestionIds[2]]);

        // Return the quiz row
        $fetchStmt = $db->prepare("SELECT * FROM daily_quizzes WHERE date = ?");
        $fetchStmt->execute([$today]);
        return $fetchStmt->fetch(PDO::FETCH_ASSOC);
    }

    public function getDailyStatus() {
        $user = AuthMiddleware::authenticate();
        $db = Database::getConnection();
        $today = date('Y-m-d');

        $quiz = $this->ensureDailyQuiz($db, $today);
        if (!$quiz) {
            echo json_encode(['success' => true, 'scheduled' => false]);
            return;
        }

        $stmt = $db->prepare("
            SELECT dq.date AS quiz_date,
                   dqa.id AS attempt_id, dqa.q1_correct, dqa.q2_correct,
                   dqa.q3_correct, dqa.score,
                   stats.total_attempts, stats.q1_pct, stats.q2_pct, stats.q3_pct
            FROM daily_quizzes dq
            LEFT JOIN daily_quiz_attempts dqa
              ON dqa.date = dq.date AND dqa.user_id = ?
            LEFT JOIN (
                SELECT date, COUNT(*) AS total_attempts,
                       COALESCE(AVG(q1_correct) * 100, 0) AS q1_pct,
                       COALESCE(AVG(q2_correct) * 100, 0) AS q2_pct,
                       COALESCE(AVG(q3_correct) * 100, 0) AS q3_pct
                FROM daily_quiz_attempts
                WHERE date = ?
                GROUP BY date
            ) stats ON stats.date = dq.date
            WHERE dq.date = ?
        ");
        $stmt->execute([$user['user_id'], $today, $today]);
        $status = $stmt->fetch(PDO::FETCH_ASSOC);

        if (!$status) {
            echo json_encode(['success' => true, 'scheduled' => false]);
            return;
        }
        if (!$status['attempt_id']) {
            echo json_encode(['success' => true, 'scheduled' => true, 'completed' => false]);
            return;
        }

        echo json_encode([
            'success' => true,
            'scheduled' => true,
            'completed' => true,
            'attempt' => [
                'q1_correct' => (int) $status['q1_correct'] === 1,
                'q2_correct' => (int) $status['q2_correct'] === 1,
                'q3_correct' => (int) $status['q3_correct'] === 1,
                'score' => (int) $status['score'],
            ],
            'stats' => [
                'total' => (int) ($status['total_attempts'] ?? 0),
                'q1_pct' => round((float) ($status['q1_pct'] ?? 0)),
                'q2_pct' => round((float) ($status['q2_pct'] ?? 0)),
                'q3_pct' => round((float) ($status['q3_pct'] ?? 0)),
            ],
        ]);
    }

    public function getDailyQuestions() {
        $user = AuthMiddleware::authenticate();
        $db = Database::getConnection();
        $today = date('Y-m-d');

        $quiz = $this->ensureDailyQuiz($db, $today);
        if (!$quiz) {
            http_response_code(500);
            echo json_encode(["error" => "Impossible de générer le quiz du jour."]);
            return;
        }

        $stmtQuiz = $db->prepare("
            SELECT dq.*, dqa.id AS attempt_id
            FROM daily_quizzes dq
            LEFT JOIN daily_quiz_attempts dqa
              ON dqa.date = dq.date AND dqa.user_id = ?
            WHERE dq.date = ?
        ");
        $stmtQuiz->execute([$user['user_id'], $today]);
        $quizData = $stmtQuiz->fetch();

        if ($quizData && $quizData['attempt_id']) {
            $questionIds = [$quiz['q1_id'], $quiz['q2_id'], $quiz['q3_id']];
            $stmtQ = $db->prepare("SELECT id, question_text, question_type, correct_value, correct_opt, opt_a, opt_b, opt_c, opt_d FROM questions WHERE id IN (?, ?, ?) ORDER BY FIELD(id, ?, ?, ?)");
            $stmtQ->execute(array_merge($questionIds, $questionIds));
            $qRows = $stmtQ->fetchAll(PDO::FETCH_ASSOC);

            $stmtAtt = $db->prepare("SELECT * FROM daily_quiz_attempts WHERE id = ?");
            $stmtAtt->execute([$quizData['attempt_id']]);
            $attemptRow = $stmtAtt->fetch(PDO::FETCH_ASSOC);

            $stmtStats = $db->prepare("
                SELECT COUNT(*) as total_attempts,
                       COALESCE(AVG(q1_correct) * 100, 0) as q1_pct,
                       COALESCE(AVG(q2_correct) * 100, 0) as q2_pct,
                       COALESCE(AVG(q3_correct) * 100, 0) as q3_pct
                FROM daily_quiz_attempts WHERE date = ?
            ");
            $stmtStats->execute([$today]);
            $stats = $stmtStats->fetch(PDO::FETCH_ASSOC);

            $qCorrects = [
                (int)($attemptRow['q1_correct'] ?? 0) === 1,
                (int)($attemptRow['q2_correct'] ?? 0) === 1,
                (int)($attemptRow['q3_correct'] ?? 0) === 1,
            ];

            $answersDetails = [];
            foreach ($qRows as $i => $q) {
                $qType = $q['question_type'] ?? 'multiple_choice';
                $cText = '';
                if ($qType === 'guess_number') {
                    $cText = (string)$q['correct_value'];
                } elseif ($qType === 'open') {
                    $cText = $q['opt_a'];
                } else {
                    $cKey = strtolower('opt_' . $q['correct_opt']);
                    $cText = $q[$cKey] ?? '';
                }

                $answersDetails[] = [
                    'question_id' => (int)$q['id'],
                    'question_text' => $q['question_text'],
                    'correct' => $qCorrects[$i] ?? false,
                    'correct_answer' => $cText,
                ];
            }

            echo json_encode([
                "success" => true,
                "already_completed" => true,
                "attempt" => [
                    "q1_correct" => $qCorrects[0],
                    "q2_correct" => $qCorrects[1],
                    "q3_correct" => $qCorrects[2],
                    "score" => (int)($attemptRow['score'] ?? 0),
                ],
                "stats" => [
                    "total" => (int)($stats['total_attempts'] ?? 0),
                    "q1_pct" => round($stats['q1_pct'] ?? 0),
                    "q2_pct" => round($stats['q2_pct'] ?? 0),
                    "q3_pct" => round($stats['q3_pct'] ?? 0),
                ],
                "points_earned" => (int)($attemptRow['score'] ?? 0),
                "coins_earned" => count(array_filter($qCorrects)) === 3 ? 90 : (count(array_filter($qCorrects)) === 2 ? 45 : 0),
                "answers_details" => $answersDetails,
            ]);
            return;
        }

        // Fetch the 3 questions
        $questionIds = [$quiz['q1_id'], $quiz['q2_id'], $quiz['q3_id']];
        $questions = [];
        $placeholders = implode(',', array_fill(0, count($questionIds), '?'));
        $stmtQ = $db->prepare("
            SELECT id, question_text, opt_a, opt_b, opt_c, opt_d,
                   correct_opt, question_type, correct_value
            FROM questions
            WHERE id IN ($placeholders)
            ORDER BY FIELD(id, $placeholders)
        ");
        $stmtQ->execute(array_merge($questionIds, $questionIds));
        $questionRows = $stmtQ->fetchAll(PDO::FETCH_ASSOC);
        if (count($questionRows) !== count($questionIds)) {
            http_response_code(500);
            echo json_encode(["error" => "Une question du quiz est introuvable."]);
            return;
        }

        foreach ($questionRows as $question) {

            $questionType = $question['question_type'] ?? 'multiple_choice';
            $shuffledOptions = null;
            $correctOpt = 'A';

            if ($questionType === 'open') {
                $shuffledOptions = null;
            } elseif ($questionType === 'guess_number') {
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

                $correctKey = strtolower('opt_' . $question['correct_opt']);
                $correctAnswerText = $question[$correctKey] ?? '';

                foreach ($shuffledOptions as $key => $val) {
                    if ($val === $correctAnswerText) {
                        $correctOpt = $key;
                        break;
                    }
                }
            }

            // Generate signed answer token
            $extraPayload = [];
            if ($questionType === 'guess_number') {
                $extraPayload['correct_value'] = intval($question['correct_value']);
            } else {
                $extraPayload['correct_opt'] = $correctOpt;
            }
            $answerToken = JWT::generateAnswerToken($question['id'], $extraPayload);

            $questions[] = [
                "id" => (int) $question['id'],
                "question_text" => $question['question_text'],
                "question_type" => $questionType,
                "options" => $shuffledOptions,
                "answer_token" => $answerToken
            ];
        }

        echo json_encode([
            "success" => true,
            "questions" => $questions
        ]);
    }

    public function submitDailyAnswer(array $data) {
        $user = AuthMiddleware::authenticate();
        $db = Database::getConnection();
        $today = date('Y-m-d');

        // Check or auto-generate daily quiz for today
        $quiz = $this->ensureDailyQuiz($db, $today);

        if (!$quiz) {
            http_response_code(500);
            echo json_encode(["error" => "Le quiz du jour est indisponible."]);
            return;
        }

        // Check if already completed
        $stmtAttempt = $db->prepare("SELECT id FROM daily_quiz_attempts WHERE user_id = ? AND date = ?");
        $stmtAttempt->execute([$user['user_id'], $today]);
        if ($stmtAttempt->fetch()) {
            http_response_code(403);
            echo json_encode(["error" => "Vous avez déjà soumis votre tentative."]);
            return;
        }

        $submittedAnswers = $data['answers'] ?? [];
        if (count($submittedAnswers) !== 3) {
            http_response_code(400);
            echo json_encode(["error" => "Vous devez soumettre exactement 3 réponses."]);
            return;
        }

        $results = [];
        $totalCorrect = 0;
        $q1_correct = 0;
        $q2_correct = 0;
        $q3_correct = 0;

        foreach ($submittedAnswers as $idx => $ansData) {
            $answerToken = $ansData['answer_token'] ?? '';
            $userAnswer = trim($ansData['answer'] ?? '');

            $decoded = JWT::decode($answerToken);
            if (!$decoded || !isset($decoded['question_id']) || !isset($decoded['sent_at'])) {
                http_response_code(403);
                echo json_encode(["error" => "Session de question quotidienne invalide ou expirée."]);
                return;
            }

            $questionId = (int) $decoded['question_id'];
            $sentAt = (int) $decoded['sent_at'];
            $now = (int) (microtime(true) * 1000);
            $duration = $now - $sentAt;

            // Anti-cheat time check (max 20s)
            $isTimeout = (strtoupper($userAnswer) === 'TIMEOUT');
            if (!$isTimeout && $duration > 20000) {
                $userAnswer = 'TIMEOUT';
                $isTimeout = true;
            }

            // Fetch question type
            $stmtQ = $db->prepare("SELECT id, question_text, question_type, correct_value, correct_opt, opt_a, opt_b, opt_c, opt_d FROM questions WHERE id = ?");
            $stmtQ->execute([$questionId]);
            $question = $stmtQ->fetch();

            if (!$question) {
                http_response_code(500);
                echo json_encode(["error" => "Question introuvable en base."]);
                return;
            }

            $questionType = $question['question_type'] ?? 'multiple_choice';
            $isCorrect = false;
            $correctText = '';

            if ($questionType === 'guess_number') {
                $correctValue = intval($question['correct_value'] ?? 0);
                $correctText = "Valeur attendue : " . $correctValue;
                if (!$isTimeout) {
                    $userVal = intval($userAnswer);
                    if (self::isGuessCorrect($userVal, $correctValue)) {
                        $isCorrect = true;
                    }
                }
            } elseif ($questionType === 'open') {
                $correctText = $question['opt_a'] ?? '';
                if (!$isTimeout) {
                    $isCorrect = (self::normalizeText($userAnswer) === self::normalizeText($correctText));
                }
            } else {
                $correctOpt = $decoded['correct_opt'] ?? $question['correct_opt'];
                $correctKey = strtolower('opt_' . $question['correct_opt']);
                $correctText = $question[$correctKey] ?? '';
                if (!$isTimeout) {
                    $isCorrect = (strtoupper($userAnswer) === $correctOpt);
                }
            }

            if ($isCorrect) {
                $totalCorrect++;
                if ($idx === 0) $q1_correct = 1;
                if ($idx === 1) $q2_correct = 1;
                if ($idx === 2) $q3_correct = 1;
            }

            // User answer display string
            $userAnswerDisplay = $userAnswer;
            if ($questionType === 'multiple_choice' || $questionType === 'qcm') {
                $chosenKey = strtolower('opt_' . strtoupper($userAnswer));
                if (!empty($question[$chosenKey])) {
                    $userAnswerDisplay = $question[$chosenKey];
                }
            }

            $results[] = [
                'question_id' => $questionId,
                'question_text' => $question['question_text'],
                'correct' => $isCorrect,
                'user_answer' => $isTimeout ? 'Temps écoulé' : $userAnswerDisplay,
                'correct_answer' => $correctText,
            ];

        }

        // Section 4.1: Quiz du Jour: 90 coins (sans-faute 3/3), 45 coins (1 erreur 2/3), 40 XP
        if ($totalCorrect === 3) {
            $coinsEarned = 90;
            $pointsEarned = 40;
        } elseif ($totalCorrect === 2) {
            $coinsEarned = 45;
            $pointsEarned = 40;
        } elseif ($totalCorrect === 1) {
            $coinsEarned = 0;
            $pointsEarned = 15;
        } else {
            $coinsEarned = 0;
            $pointsEarned = 0;
        }

        // Update user
        if ($pointsEarned > 0) {
            $stmtUpdateUser = $db->prepare("UPDATE users SET global_score = global_score + ?, coins = coins + ? WHERE id = ?");
            $stmtUpdateUser->execute([$pointsEarned, $coinsEarned, $user['user_id']]);
        }

        // Fetch updated user totals for state synchronization
        $stmtUser = $db->prepare("SELECT global_score, coins FROM users WHERE id = ?");
        $stmtUser->execute([$user['user_id']]);
        $updatedUser = $stmtUser->fetch();

        // Insert attempt
        $stmtInsertAttempt = $db->prepare("
            INSERT INTO daily_quiz_attempts (user_id, date, q1_correct, q2_correct, q3_correct, score)
            VALUES (?, ?, ?, ?, ?, ?)
        ");
        $stmtInsertAttempt->execute([
            $user['user_id'],
            $today,
            $q1_correct,
            $q2_correct,
            $q3_correct,
            $pointsEarned
        ]);

        // Quest tracking for daily quiz
        if ($coinsEarned > 0) {
            \App\Controllers\QuestController::incrementProgress((int) $user['user_id'], 'coins_earned', $coinsEarned);
        }
        if ($pointsEarned > 0) {
            \App\Controllers\QuestController::incrementProgress((int) $user['user_id'], 'xp_earned', $pointsEarned);
        }
        \App\Controllers\QuestController::incrementProgress((int) $user['user_id'], 'daily_rituals', 1);

        $correctCount = ($q1_correct === 1 ? 1 : 0) + ($q2_correct === 1 ? 1 : 0) + ($q3_correct === 1 ? 1 : 0);
        if ($correctCount === 3) {
            \App\Controllers\QuestController::incrementProgress((int) $user['user_id'], 'perfect_quiz', 1);
        }

        // Get updated stats
        $stmtStats = $db->prepare("
            SELECT
                COUNT(*) as total_attempts,
                COALESCE(AVG(q1_correct) * 100, 0) as q1_pct,
                COALESCE(AVG(q2_correct) * 100, 0) as q2_pct,
                COALESCE(AVG(q3_correct) * 100, 0) as q3_pct
            FROM daily_quiz_attempts
            WHERE date = ?
        ");
        $stmtStats->execute([$today]);
        $stats = $stmtStats->fetch();

        echo json_encode([
            "success" => true,
            "attempt" => [
                "q1_correct" => $q1_correct === 1,
                "q2_correct" => $q2_correct === 1,
                "q3_correct" => $q3_correct === 1,
                "score" => $pointsEarned
            ],
            "stats" => [
                "total" => (int)($stats['total_attempts'] ?? 0),
                "q1_pct" => round($stats['q1_pct'] ?? 0),
                "q2_pct" => round($stats['q2_pct'] ?? 0),
                "q3_pct" => round($stats['q3_pct'] ?? 0)
            ],
            "points_earned" => $pointsEarned,
            "coins_earned" => $coinsEarned,
            "user_stats" => [
                "global_score" => (int)($updatedUser['global_score'] ?? 0),
                "coins" => (int)($updatedUser['coins'] ?? 0)
            ],
            "answers_details" => $results
        ]);
    }

    // =========================================================================
    // ADMIN DAILY QUIZ SCHEDULING
    // =========================================================================

    public function getDailyQuizzes() {
        $user = AuthMiddleware::authenticate();
        if ($user['role'] !== 'admin') {
            http_response_code(403);
            echo json_encode(["error" => "Réservé aux administrateurs."]);
            return;
        }

        $db = Database::getConnection();
        $stmt = $db->query("
            SELECT dq.date,
                   dq.q1_id, dq.q2_id, dq.q3_id,
                   q1.question_text as q1_text, q1.question_type as q1_type,
                   q2.question_text as q2_text, q2.question_type as q2_type,
                   q3.question_text as q3_text, q3.question_type as q3_type
            FROM daily_quizzes dq
            JOIN questions q1 ON dq.q1_id = q1.id
            JOIN questions q2 ON dq.q2_id = q2.id
            JOIN questions q3 ON dq.q3_id = q3.id
            ORDER BY dq.date DESC
        ");
        $quizzes = $stmt->fetchAll();

        echo json_encode([
            "success" => true,
            "quizzes" => $quizzes
        ]);
    }

    public function scheduleDailyQuiz(array $data) {
        $user = AuthMiddleware::authenticate();
        if ($user['role'] !== 'admin') {
            http_response_code(403);
            echo json_encode(["error" => "Réservé aux administrateurs."]);
            return;
        }

        $date = $data['date'] ?? '';
        $q1_id = (int) ($data['q1_id'] ?? 0);
        $q2_id = (int) ($data['q2_id'] ?? 0);
        $q3_id = (int) ($data['q3_id'] ?? 0);

        if (empty($date) || !$q1_id || !$q2_id || !$q3_id) {
            http_response_code(400);
            echo json_encode(["error" => "Données manquantes (date, q1_id, q2_id, q3_id requis)."]);
            return;
        }

        $db = Database::getConnection();

        // Insert or Update scheduling
        $stmt = $db->prepare("
            INSERT INTO daily_quizzes (date, q1_id, q2_id, q3_id)
            VALUES (?, ?, ?, ?)
            ON DUPLICATE KEY UPDATE q1_id = VALUES(q1_id), q2_id = VALUES(q2_id), q3_id = VALUES(q3_id)
        ");
        $stmt->execute([$date, $q1_id, $q2_id, $q3_id]);

        echo json_encode([
            "success" => true,
            "message" => "Quiz du jour planifié avec succès pour le " . $date
        ]);
    }

    public function deleteDailyQuiz(array $data) {
        $user = AuthMiddleware::authenticate();
        if ($user['role'] !== 'admin') {
            http_response_code(403);
            echo json_encode(["error" => "Réservé aux administrateurs."]);
            return;
        }

        $date = $data['date'] ?? '';
        if (empty($date)) {
            http_response_code(400);
            echo json_encode(["error" => "Date manquante."]);
            return;
        }

        $db = Database::getConnection();
        $stmt = $db->prepare("DELETE FROM daily_quizzes WHERE date = ?");
        $stmt->execute([$date]);

        echo json_encode([
            "success" => true,
            "message" => "Planification supprimée."
        ]);
    }
}
