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

        if ($packId <= 0) {
            http_response_code(400);
            echo json_encode(["error" => "pack_id manquant ou invalide."]);
            return;
        }

        $db = Database::getConnection();

        // Check if pack exists and has questions
        $stmtCount = $db->prepare("SELECT COUNT(*) FROM questions WHERE pack_id = ?");
        $stmtCount->execute([$packId]);
        $count = $stmtCount->fetchColumn();

        if ($count == 0) {
            http_response_code(404);
            echo json_encode(["error" => "Aucune question trouvée dans ce pack."]);
            return;
        }

        // Fetch a random question from the pack
        $stmt = $db->prepare("SELECT id, question_text, opt_a, opt_b, opt_c, opt_d FROM questions WHERE pack_id = ? ORDER BY RAND() LIMIT 1");
        $stmt->execute([$packId]);
        $question = $stmt->fetch();

        // Create signed token containing question_id & sent_at
        $answerToken = JWT::generateAnswerToken($question['id']);

        // Return clean payload (BLIND DATA - NO correct_opt)
        echo json_encode([
            "id" => (int) $question['id'],
            "question_text" => htmlspecialchars($question['question_text']),
            "options" => [
                "A" => htmlspecialchars($question['opt_a']),
                "B" => htmlspecialchars($question['opt_b']),
                "C" => htmlspecialchars($question['opt_c']),
                "D" => htmlspecialchars($question['opt_d'])
            ],
            "answer_token" => $answerToken
        ]);
    }

    /**
     * POST /api/quiz/answer
     * Authenticated & Secure
     */
    public function submitAnswer(array $data) {
        $user = AuthMiddleware::authenticate();
        
        $answerToken = $data['answer_token'] ?? '';
        $answer = strtoupper(trim($data['answer'] ?? ''));

        if (empty($answerToken) || !in_array($answer, ['A', 'B', 'C', 'D'])) {
            http_response_code(400);
            echo json_encode(["error" => "Données de réponse invalides."]);
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
        if ($duration > 20000) {
            http_response_code(403);
            echo json_encode(["error" => "Temps écoulé (Max 20s)."]);
            return;
        }

        $db = Database::getConnection();

        // Fetch correct option
        $stmt = $db->prepare("SELECT correct_opt, opt_a, opt_b, opt_c, opt_d FROM questions WHERE id = ?");
        $stmt->execute([$questionId]);
        $question = $stmt->fetch();

        if (!$question) {
            http_response_code(404);
            echo json_encode(["error" => "Question introuvable."]);
            return;
        }

        $isCorrect = ($answer === $question['correct_opt']);
        $pointsAwarded = 0;
        
        if ($isCorrect) {
            // Award base 10 points + speed bonus in training
            $timeRatio = max(0, (20000 - $duration) / 20000);
            $pointsAwarded = 10 + (int) ($timeRatio * 10);

            // Update user global score
            $stmtUpdate = $db->prepare("UPDATE users SET global_score = global_score + ? WHERE id = ?");
            $stmtUpdate->execute([$pointsAwarded, $user['user_id']]);
        }

        // Fetch updated global score
        $stmtScore = $db->prepare("SELECT global_score FROM users WHERE id = ?");
        $stmtScore->execute([$user['user_id']]);
        $newGlobalScore = (int) $stmtScore->fetchColumn();

        // Map correct_opt key to actual text value
        $correctKey = strtolower('opt_' . $question['correct_opt']);
        $correctText = $question[$correctKey] ?? '';

        echo json_encode([
            "correct" => $isCorrect,
            "correct_option" => $question['correct_opt'],
            "correct_text" => htmlspecialchars($correctText),
            "points_awarded" => $pointsAwarded,
            "global_score" => $newGlobalScore,
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
        $optA = trim($data['opt_a'] ?? '');
        $optB = trim($data['opt_b'] ?? '');
        $optC = trim($data['opt_c'] ?? '');
        $optD = trim($data['opt_d'] ?? '');
        $correctOpt = strtoupper(trim($data['correct_opt'] ?? ''));

        if ($packId <= 0 || empty($questionText) || empty($optA) || empty($optB) || empty($optC) || empty($optD) || !in_array($correctOpt, ['A', 'B', 'C', 'D'])) {
            http_response_code(400);
            echo json_encode(["error" => "Tous les champs sont requis."]);
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

        $stmt = $db->prepare("
            INSERT INTO questions (pack_id, question_text, opt_a, opt_b, opt_c, opt_d, correct_opt) 
            VALUES (?, ?, ?, ?, ?, ?, ?)
        ");
        $stmt->execute([$packId, $questionText, $optA, $optB, $optC, $optD, $correctOpt]);

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
        $optA = trim($data['opt_a'] ?? '');
        $optB = trim($data['opt_b'] ?? '');
        $optC = trim($data['opt_c'] ?? '');
        $optD = trim($data['opt_d'] ?? '');
        $correctOpt = strtoupper(trim($data['correct_opt'] ?? ''));

        if ($id <= 0 || empty($questionText) || empty($optA) || empty($optB) || empty($optC) || empty($optD) || !in_array($correctOpt, ['A', 'B', 'C', 'D'])) {
            http_response_code(400);
            echo json_encode(["error" => "Champs invalides."]);
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
            echo json_encode(["error" => "Interdit. Vous n'êtes pas autorisé à modifier cette question."]);
            return;
        }

        $stmt = $db->prepare("
            UPDATE questions 
            SET question_text = ?, opt_a = ?, opt_b = ?, opt_c = ?, opt_d = ?, correct_opt = ? 
            WHERE id = ?
        ");
        $stmt->execute([$questionText, $optA, $optB, $optC, $optD, $correctOpt, $id]);

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
        $optA = trim($data['opt_a'] ?? '');
        $optB = trim($data['opt_b'] ?? '');
        $optC = trim($data['opt_c'] ?? '');
        $optD = trim($data['opt_d'] ?? '');
        $correctOpt = strtoupper(trim($data['correct_opt'] ?? ''));

        if ($packId <= 0 || empty($questionText) || empty($optA) || empty($optB) || empty($optC) || empty($optD) || !in_array($correctOpt, ['A', 'B', 'C', 'D'])) {
            http_response_code(400);
            echo json_encode(["error" => "Tous les champs sont requis."]);
            return;
        }

        $db = Database::getConnection();
        $stmt = $db->prepare("
            INSERT INTO questions (pack_id, question_text, opt_a, opt_b, opt_c, opt_d, correct_opt) 
            VALUES (?, ?, ?, ?, ?, ?, ?)
        ");
        $stmt->execute([$packId, $questionText, $optA, $optB, $optC, $optD, $correctOpt]);

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
        $optA = trim($data['opt_a'] ?? '');
        $optB = trim($data['opt_b'] ?? '');
        $optC = trim($data['opt_c'] ?? '');
        $optD = trim($data['opt_d'] ?? '');
        $correctOpt = strtoupper(trim($data['correct_opt'] ?? ''));

        if ($id <= 0 || empty($questionText) || empty($optA) || empty($optB) || empty($optC) || empty($optD) || !in_array($correctOpt, ['A', 'B', 'C', 'D'])) {
            http_response_code(400);
            echo json_encode(["error" => "Champs invalides."]);
            return;
        }

        $db = Database::getConnection();
        $stmt = $db->prepare("
            UPDATE questions 
            SET question_text = ?, opt_a = ?, opt_b = ?, opt_c = ?, opt_d = ?, correct_opt = ? 
            WHERE id = ?
        ");
        $stmt->execute([$questionText, $optA, $optB, $optC, $optD, $correctOpt, $id]);

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
}
