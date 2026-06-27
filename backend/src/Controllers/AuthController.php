<?php
namespace App\Controllers;

use App\Config\Database;
use App\Utils\JWT;

class AuthController {
    /**
     * POST /api/auth/register
     */
    public function register(array $data) {
        $username = trim($data['username'] ?? '');
        $password = $data['password'] ?? '';

        // Validation
        if (strlen($username) < 3 || strlen($username) > 20) {
            http_response_code(400);
            echo json_encode(["error" => "Le pseudo doit contenir entre 3 et 20 caractères."]);
            return;
        }

        if (!preg_match('/^[a-zA-Z0-9_\-]+$/', $username)) {
            http_response_code(400);
            echo json_encode(["error" => "Le pseudo ne peut contenir que des lettres, chiffres, tirets et underscores."]);
            return;
        }

        if (strlen($password) < 6) {
            http_response_code(400);
            echo json_encode(["error" => "Le mot de passe doit contenir au moins 6 caractères."]);
            return;
        }

        $db = Database::getConnection();

        // Check if username already exists
        $stmt = $db->prepare("SELECT id FROM users WHERE username = ?");
        $stmt->execute([$username]);
        if ($stmt->fetch()) {
            http_response_code(409);
            echo json_encode(["error" => "Ce pseudo est déjà utilisé."]);
            return;
        }

        // Hash password and insert user
        $passwordHash = password_hash($password, PASSWORD_DEFAULT);
        $stmtInsert = $db->prepare("INSERT INTO users (username, password_hash) VALUES (?, ?)");
        $stmtInsert->execute([$username, $passwordHash]);

        http_response_code(201);
        echo json_encode(["success" => true, "message" => "Compte créé avec succès !"]);
    }

    /**
     * POST /api/auth/login
     */
    public function login(array $data) {
        $username = trim($data['username'] ?? '');
        $password = $data['password'] ?? '';

        if (empty($username) || empty($password)) {
            http_response_code(400);
            echo json_encode(["error" => "Veuillez remplir tous les champs."]);
            return;
        }

        $db = Database::getConnection();

        $stmt = $db->prepare("SELECT id, username, password_hash, role, global_score FROM users WHERE username = ?");
        $stmt->execute([$username]);
        $user = $stmt->fetch();

        if (!$user || !password_verify($password, $user['password_hash'])) {
            http_response_code(401);
            echo json_encode(["error" => "Pseudo ou mot de passe incorrect."]);
            return;
        }

        // Generate JWT
        $payload = [
            'user_id' => (int) $user['id'],
            'username' => $user['username'],
            'role' => $user['role']
        ];
        $token = JWT::encode($payload);

        echo json_encode([
            "success" => true,
            "token" => $token,
            "user" => [
                "id" => (int) $user['id'],
                "username" => $user['username'],
                "role" => $user['role'],
                "global_score" => (int) $user['global_score']
            ]
        ]);
    }
}
