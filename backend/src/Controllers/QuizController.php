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
        $stmt = $db->prepare("SELECT id, question_text, opt_a, opt_b, opt_c, opt_d, correct_opt, question_type FROM questions$excludeClause ORDER BY RAND() LIMIT 1");
        $stmt->execute($params);
        $question = $stmt->fetch();

        // Fallback if all questions are excluded
        if (!$question) {
            if (!empty($excludeIds)) {
                $placeholders = implode(',', array_fill(0, count($excludeIds), '?'));
                $stmtFallback = $db->prepare("SELECT id, question_text, opt_a, opt_b, opt_c, opt_d, correct_opt, question_type FROM questions WHERE id NOT IN ($placeholders) ORDER BY RAND() LIMIT 1");
                $stmtFallback->execute($excludeIds);
                $question = $stmtFallback->fetch();
            }
            
            if (!$question) {
                $question = $db->query("SELECT id, question_text, opt_a, opt_b, opt_c, opt_d, correct_opt, question_type FROM questions ORDER BY RAND() LIMIT 1")->fetch();
            }
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
            "options" => $shuffledOptions,
            "answer_token" => $answerToken
        ]);
    }

    /**
     * POST /api/quiz/answer
     * Authenticated & Secure
     */
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

        // Match duration to standard timer (e.g. 20s)
        $isTimeoutAnswer = (strtoupper(trim($data['answer'] ?? '')) === 'TIMEOUT');
        if (!$isTimeoutAnswer && $duration > 20000) {
            http_response_code(403);
            echo json_encode(["error" => "Temps écoulé (Max 20s)."]);
            return;
        }

        $db = Database::getConnection();

        // Fetch question info and user score in a single query to reduce database roundtrip latency
        $stmt = $db->prepare("
            SELECT q.question_type, q.correct_opt, q.opt_a, q.opt_b, q.opt_c, q.opt_d, u.global_score, u.coins 
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

        $questionType = $row['question_type'] ?? 'multiple_choice';
        $isCorrect = false;
        $correctText = '';
        $correctOpt = null;

        if ($questionType === 'open') {
            $correctText = $row['opt_a'] ?? '';
            if (strtoupper($userAnswer) === 'TIMEOUT') {
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

        $pointsAwarded = 0;
        $coinsAwarded = 0;
        $newGlobalScore = (int) ($row['global_score'] ?? 0);
        $newCoins = (int) ($row['coins'] ?? 0);
        
        if ($isCorrect) {
            // Award base 10 points + speed bonus in training
            $timeRatio = max(0, (20000 - $duration) / 20000);
            $pointsAwarded = 10 + (int) ($timeRatio * 10);
            $coinsAwarded = (int) ($pointsAwarded / 2);

            $newGlobalScore += $pointsAwarded;
            $newCoins += $coinsAwarded;

            // Update user global score and coins
            $stmtUpdate = $db->prepare("UPDATE users SET global_score = ?, coins = ? WHERE id = ?");
            $stmtUpdate->execute([$newGlobalScore, $newCoins, $user['user_id']]);
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
        $questionType = trim($data['question_type'] ?? 'multiple_choice');
        $optA = trim($data['opt_a'] ?? '');
        $optB = trim($data['opt_b'] ?? '');
        $optC = trim($data['opt_c'] ?? '');
        $optD = trim($data['opt_d'] ?? '');
        $correctOpt = strtoupper(trim($data['correct_opt'] ?? ''));

        if ($questionType === 'open') {
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
                echo json_encode(["error" => "Tous les champs sont requis."]);
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
            INSERT INTO questions (pack_id, question_text, opt_a, opt_b, opt_c, opt_d, correct_opt, question_type) 
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        ");
        $stmt->execute([$packId, $questionText, $optA, $optB, $optC, $optD, $correctOpt, $questionType]);

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
        $questionType = trim($data['question_type'] ?? 'multiple_choice');
        $optA = trim($data['opt_a'] ?? '');
        $optB = trim($data['opt_b'] ?? '');
        $optC = trim($data['opt_c'] ?? '');
        $optD = trim($data['opt_d'] ?? '');
        $correctOpt = strtoupper(trim($data['correct_opt'] ?? ''));

        if ($questionType === 'open') {
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
            SET question_text = ?, opt_a = ?, opt_b = ?, opt_c = ?, opt_d = ?, correct_opt = ?, question_type = ? 
            WHERE id = ?
        ");
        $stmt->execute([$questionText, $optA, $optB, $optC, $optD, $correctOpt, $questionType, $id]);

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

        if ($packId <= 0) {
            http_response_code(400);
            echo json_encode(["error" => "pack_id requis."]);
            return;
        }

        $db = Database::getConnection();
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
        $questionType = trim($data['question_type'] ?? 'multiple_choice');
        $optA = trim($data['opt_a'] ?? '');
        $optB = trim($data['opt_b'] ?? '');
        $optC = trim($data['opt_c'] ?? '');
        $optD = trim($data['opt_d'] ?? '');
        $correctOpt = strtoupper(trim($data['correct_opt'] ?? ''));

        if ($questionType === 'open') {
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
            INSERT INTO questions (pack_id, question_text, opt_a, opt_b, opt_c, opt_d, correct_opt, question_type) 
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        ");
        $stmt->execute([$packId, $questionText, $optA, $optB, $optC, $optD, $correctOpt, $questionType]);

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
        $questionType = trim($data['question_type'] ?? 'multiple_choice');
        $optA = trim($data['opt_a'] ?? '');
        $optB = trim($data['opt_b'] ?? '');
        $optC = trim($data['opt_c'] ?? '');
        $optD = trim($data['opt_d'] ?? '');
        $correctOpt = strtoupper(trim($data['correct_opt'] ?? ''));

        if ($questionType === 'open') {
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
            SET question_text = ?, opt_a = ?, opt_b = ?, opt_c = ?, opt_d = ?, correct_opt = ?, question_type = ? 
            WHERE id = ?
        ");
        $stmt->execute([$questionText, $optA, $optB, $optC, $optD, $correctOpt, $questionType, $id]);

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

        // 1. Top 10 users sorted by Elo
        $stmtUsers = $db->query("
            SELECT id, username, global_score, elo 
            FROM users 
            ORDER BY elo DESC 
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
}
