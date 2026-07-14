<?php
namespace App\Controllers;

use App\Config\Database;
use App\Middleware\AuthMiddleware;
use App\Utils\JWT;

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
        
        // Admins bypass validation, users default to 0
        $isValidated = ($user['role'] === 'admin') ? 1 : 0;

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

        // Check if questions exist
        if ($packId === 0) {
            $stmtCount = $db->query("SELECT COUNT(*) FROM questions");
        } else {
            $stmtCount = $db->prepare("SELECT COUNT(*) FROM questions WHERE pack_id = ?");
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

        $excludeClause = "";
        $params = [];
        if ($packId > 0) {
            $params[] = $packId;
            $excludeClause = " WHERE pack_id = ?";
        }
        
        if (!empty($excludeIds)) {
            $placeholders = implode(',', array_fill(0, count($excludeIds), '?'));
            if ($packId > 0) {
                $excludeClause .= " AND id NOT IN ($placeholders)";
            } else {
                $excludeClause .= " WHERE id NOT IN ($placeholders)";
            }
            $params = array_merge($params, $excludeIds);
        }

        // Fetch a random question (excluding already answered ones)
        $stmt = $db->prepare("SELECT id, question_text, opt_a, opt_b, opt_c, opt_d, correct_opt, question_type, media_url FROM questions$excludeClause ORDER BY RAND() LIMIT 1");
        $stmt->execute($params);
        $question = $stmt->fetch();

        // Fallback if all questions are excluded
        if (!$question) {
            if (!empty($excludeIds)) {
                $placeholders = implode(',', array_fill(0, count($excludeIds), '?'));
                $stmtFallback = $db->prepare("SELECT id, question_text, opt_a, opt_b, opt_c, opt_d, correct_opt, question_type, media_url FROM questions WHERE id NOT IN ($placeholders) ORDER BY RAND() LIMIT 1");
                $stmtFallback->execute($excludeIds);
                $question = $stmtFallback->fetch();
            }
            
            if (!$question) {
                $question = $db->query("SELECT id, question_text, opt_a, opt_b, opt_c, opt_d, correct_opt, question_type, media_url FROM questions ORDER BY RAND() LIMIT 1")->fetch();
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

        $gameMode = $data['game_mode'] ?? 'classic';
        if (!in_array($gameMode, ['classic', 'speed_blitz', 'sudden_death', 'guess_number'])) {
            $gameMode = 'classic';
        }

        // Match duration to dynamic timer (5s for Blitz, 20s otherwise)
        $timeLimitMs = ($gameMode === 'speed_blitz') ? 5000 : 20000;
        $isTimeoutAnswer = (strtoupper(trim($data['answer'] ?? '')) === 'TIMEOUT');
        if (!$isTimeoutAnswer && $duration > $timeLimitMs) {
            http_response_code(403);
            echo json_encode(["error" => "Temps écoulé (Max " . ($timeLimitMs / 1000) . "s)."]);
            return;
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
            if ($isTimeoutAnswer) {
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
            // Award base 10 points + speed bonus in training
            $timeRatio = max(0, ($timeLimitMs - $duration) / $timeLimitMs);
            $pointsAwarded = 10 + (int) ($timeRatio * 10);
            $coinsAwarded = (int) ($pointsAwarded / 2);

            $newGlobalScore += $pointsAwarded;
            $newCoins += $coinsAwarded;

            // Update user global score and coins
            $stmtUpdate = $db->prepare("UPDATE users SET global_score = ?, coins = ? WHERE id = ?");
            $stmtUpdate->execute([$newGlobalScore, $newCoins, $user['user_id']]);

            // Quests tracking
            \App\Controllers\QuestController::incrementProgress((int) $user['user_id'], 'solo_questions');
            \App\Controllers\QuestController::incrementProgress((int) $user['user_id'], 'coins_earned', $coinsAwarded);
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
     * Authenticated - Add a question (must be creator of the pack or admin)
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

        $stmt = $db->prepare("
            INSERT INTO questions (pack_id, question_text, opt_a, opt_b, opt_c, opt_d, correct_opt, question_type, media_url) 
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        ");
        $stmt->execute([$packId, $questionText, $optA, $optB, $optC, $optD, $correctOpt, $questionType, empty($mediaUrl) ? null : $mediaUrl]);

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
        AuthMiddleware::authenticate();
        $db = Database::getConnection();

        // 1. Top 10 users sorted by collection value
        $stmtUsers = $db->query("
            SELECT 
                u.id, 
                u.username, 
                u.global_score,
                COALESCE(SUM(
                    CASE 
                        WHEN c.rarity = 'legendary' THEN 1000
                        WHEN c.rarity = 'epic' THEN 300
                        WHEN c.rarity = 'rare' THEN 100
                        ELSE 30 
                    END
                ), 0) as collection_value
            FROM users u
            LEFT JOIN user_cards uc ON u.id = uc.user_id AND uc.quantity > 0
            LEFT JOIN cards c ON uc.card_id = c.id
            GROUP BY u.id, u.username, u.global_score
            ORDER BY collection_value DESC, u.global_score DESC
            LIMIT 10
        ");
        $topPlayers = $stmtUsers->fetchAll();

        // 2. Recent 10 matches
        $stmtMatches = $db->query("
            SELECT * 
            FROM matches 
            ORDER BY id DESC 
            LIMIT 10
        ");
        $recentMatches = $stmtMatches->fetchAll();

        echo json_encode([
            "top_players" => $topPlayers,
            "recent_matches" => $recentMatches
        ]);
    }

    // =========================================================================
    // DAILY QUIZ FEATURES
    // =========================================================================

    public function getDailyStatus() {
        $user = AuthMiddleware::authenticate();
        $db = Database::getConnection();
        $today = date('Y-m-d');

        // Check if daily quiz exists for today
        $stmtQuiz = $db->prepare("SELECT * FROM daily_quizzes WHERE date = ?");
        $stmtQuiz->execute([$today]);
        $quiz = $stmtQuiz->fetch();

        if (!$quiz) {
            echo json_encode([
                "success" => true,
                "scheduled" => false
            ]);
            return;
        }

        // Check user's attempt for today
        $stmtAttempt = $db->prepare("SELECT * FROM daily_quiz_attempts WHERE user_id = ? AND date = ?");
        $stmtAttempt->execute([$user['user_id'], $today]);
        $attempt = $stmtAttempt->fetch();

        if ($attempt) {
            // Get stats for today
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
                "scheduled" => true,
                "completed" => true,
                "attempt" => [
                    "q1_correct" => (int)$attempt['q1_correct'] === 1,
                    "q2_correct" => (int)$attempt['q2_correct'] === 1,
                    "q3_correct" => (int)$attempt['q3_correct'] === 1,
                    "score" => (int)$attempt['score']
                ],
                "stats" => [
                    "total" => (int)$stats['total_attempts'],
                    "q1_pct" => round($stats['q1_pct']),
                    "q2_pct" => round($stats['q2_pct']),
                    "q3_pct" => round($stats['q3_pct'])
                ]
            ]);
        } else {
            echo json_encode([
                "success" => true,
                "scheduled" => true,
                "completed" => false
            ]);
        }
    }

    public function getDailyQuestions() {
        $user = AuthMiddleware::authenticate();
        $db = Database::getConnection();
        $today = date('Y-m-d');

        // Check if daily quiz exists for today
        $stmtQuiz = $db->prepare("SELECT * FROM daily_quizzes WHERE date = ?");
        $stmtQuiz->execute([$today]);
        $quiz = $stmtQuiz->fetch();

        if (!$quiz) {
            http_response_code(404);
            echo json_encode(["error" => "Aucun quiz n'est planifié pour aujourd'hui."]);
            return;
        }

        // Check if already completed
        $stmtAttempt = $db->prepare("SELECT id FROM daily_quiz_attempts WHERE user_id = ? AND date = ?");
        $stmtAttempt->execute([$user['user_id'], $today]);
        if ($stmtAttempt->fetch()) {
            http_response_code(403);
            echo json_encode(["error" => "Vous avez déjà joué le quiz du jour."]);
            return;
        }

        // Fetch the 3 questions
        $questionIds = [$quiz['q1_id'], $quiz['q2_id'], $quiz['q3_id']];
        $questions = [];

        foreach ($questionIds as $idx => $qId) {
            $stmtQ = $db->prepare("SELECT id, question_text, opt_a, opt_b, opt_c, opt_d, correct_opt, question_type, correct_value FROM questions WHERE id = ?");
            $stmtQ->execute([$qId]);
            $question = $stmtQ->fetch();

            if (!$question) {
                http_response_code(500);
                echo json_encode(["error" => "Une question du quiz est introuvable."]);
                return;
            }

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

        // Check if daily quiz exists for today
        $stmtQuiz = $db->prepare("SELECT * FROM daily_quizzes WHERE date = ?");
        $stmtQuiz->execute([$today]);
        $quiz = $stmtQuiz->fetch();

        if (!$quiz) {
            http_response_code(404);
            echo json_encode(["error" => "Aucun quiz n'est planifié pour aujourd'hui."]);
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
            $stmtQ = $db->prepare("SELECT question_type, correct_value, correct_opt, opt_a, opt_b, opt_c, opt_d FROM questions WHERE id = ?");
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

        }

        // Award points: +30 global score (XP) and +15 coins per correct answer
        $pointsEarned = $totalCorrect * 30;
        $coinsEarned = $totalCorrect * 15;

        // Update user
        if ($pointsEarned > 0) {
            $stmtUpdateUser = $db->prepare("UPDATE users SET global_score = global_score + ?, coins = coins + ? WHERE id = ?");
            $stmtUpdateUser->execute([$pointsEarned, $coinsEarned, $user['user_id']]);
        }

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
                "total" => (int)$stats['total_attempts'],
                "q1_pct" => round($stats['q1_pct']),
                "q2_pct" => round($stats['q2_pct']),
                "q3_pct" => round($stats['q3_pct'])
            ],
            "points_earned" => $pointsEarned,
            "coins_earned" => $coinsEarned
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
