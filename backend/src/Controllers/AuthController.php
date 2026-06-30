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
        $email = trim($data['email'] ?? '');
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

        if (empty($email) || !filter_var($email, FILTER_VALIDATE_EMAIL)) {
            http_response_code(400);
            echo json_encode(["error" => "Format d'adresse email invalide."]);
            return;
        }

        if (strlen($password) < 6) {
            http_response_code(400);
            echo json_encode(["error" => "Le mot de passe doit contenir au moins 6 caractères."]);
            return;
        }

        $db = Database::getConnection();

        // Check if email already exists
        $stmtEmail = $db->prepare("SELECT id FROM users WHERE email = ?");
        $stmtEmail->execute([$email]);
        if ($stmtEmail->fetch()) {
            http_response_code(409);
            echo json_encode(["error" => "Cette adresse email est déjà utilisée."]);
            return;
        }

        // Generate unique discriminator (tag) for the chosen username
        $discriminator = '';
        $found = false;
        $maxAttempts = 100;
        $attempts = 0;
        
        while (!$found && $attempts < $maxAttempts) {
            $disc = sprintf("%04d", rand(1000, 9999));
            $check = $db->prepare("SELECT id FROM users WHERE username = ? AND discriminator = ?");
            $check->execute([$username, $disc]);
            if (!$check->fetch()) {
                $discriminator = $disc;
                $found = true;
            }
            $attempts++;
        }
        
        if (!$found) {
            http_response_code(409);
            echo json_encode(["error" => "Ce pseudo est trop populaire, veuillez en choisir un autre."]);
            return;
        }

        // Generate 6-digit code
        $code = strval(rand(100000, 999999));

        $seed = bin2hex(random_bytes(8));
        $avatarUrl = "https://api.dicebear.com/10.x/glyphs/svg?seed=" . $seed;

        // Hash password and insert user
        $passwordHash = password_hash($password, PASSWORD_DEFAULT);
        $stmtInsert = $db->prepare("INSERT INTO users (username, discriminator, email, password_hash, is_verified, verification_code, avatar_url) VALUES (?, ?, ?, ?, 0, ?, ?)");
        $stmtInsert->execute([$username, $discriminator, $email, $passwordHash, $code, $avatarUrl]);

        http_response_code(201);
        echo json_encode([
            "success" => true, 
            "message" => "Compte créé avec succès ! Veuillez vérifier votre boîte mail.",
            "verification_code" => $code // Sent back for client side mock simulation
        ]);
    }

    /**
     * POST /api/auth/login
     */
    public function login(array $data) {
        $loginInput = trim($data['username'] ?? ''); // username OR email
        $password = $data['password'] ?? '';

        if (empty($loginInput) || empty($password)) {
            http_response_code(400);
            echo json_encode(["error" => "Veuillez remplir tous les champs."]);
            return;
        }

        $db = Database::getConnection();

        // Find by username OR email
        $user = null;
        if (strpos($loginInput, '#') !== false) {
            $parts = explode('#', $loginInput, 2);
            $uName = trim($parts[0]);
            $uDisc = trim($parts[1]);
            
            $stmt = $db->prepare("SELECT id, username, discriminator, email, password_hash, role, global_score, elo, coins, is_verified, bio, avatar_url FROM users WHERE username = ? AND discriminator = ?");
            $stmt->execute([$uName, $uDisc]);
            $user = $stmt->fetch();
        } else {
            $stmt = $db->prepare("SELECT id, username, discriminator, email, password_hash, role, global_score, elo, coins, is_verified, bio, avatar_url FROM users WHERE email = ?");
            $stmt->execute([$loginInput]);
            $user = $stmt->fetch();
            
            if (!$user) {
                // Try searching by username (in case there's only one user with this username, or just fall back)
                $stmt = $db->prepare("SELECT id, username, discriminator, email, password_hash, role, global_score, elo, coins, is_verified, bio, avatar_url FROM users WHERE username = ?");
                $stmt->execute([$loginInput]);
                $results = $stmt->fetchAll();
                if (count($results) === 1) {
                    $user = $results[0];
                } elseif (count($results) > 1) {
                    http_response_code(400);
                    echo json_encode(["error" => "Plusieurs joueurs partagent ce pseudo. Veuillez saisir votre pseudo complet avec le #tag (ex: Mathis#1234) ou votre adresse email."]);
                    return;
                }
            }
        }

        if (!$user || !password_verify($password, $user['password_hash'])) {
            http_response_code(401);
            echo json_encode(["error" => "Identifiants ou mot de passe incorrects."]);
            return;
        }

        // Check if verified
        if (intval($user['is_verified']) === 0) {
            http_response_code(403);
            echo json_encode([
                "error" => "Votre compte n'est pas encore vérifié. Veuillez entrer le code de validation.",
                "needs_verification" => true,
                "username" => $user['username']
            ]);
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
                "discriminator" => $user['discriminator'],
                "email" => $user['email'],
                "role" => $user['role'],
                "global_score" => (int) $user['global_score'],
                "elo" => (int) $user['elo'],
                "coins" => (int) $user['coins'],
                "bio" => $user['bio'],
                "avatar_url" => $user['avatar_url']
            ]
        ]);
    }

    /**
     * POST /api/auth/verify
     */
    public function verify(array $data) {
        $username = trim($data['username'] ?? '');
        $code = trim($data['code'] ?? '');

        if (empty($username) || empty($code)) {
            http_response_code(400);
            echo json_encode(["error" => "Veuillez renseigner le pseudo et le code de validation."]);
            return;
        }

        $db = Database::getConnection();

        $stmt = $db->prepare("SELECT id, verification_code FROM users WHERE username = ?");
        $stmt->execute([$username]);
        $user = $stmt->fetch();

        if (!$user) {
            http_response_code(404);
            echo json_encode(["error" => "Utilisateur introuvable."]);
            return;
        }

        if ($user['verification_code'] !== $code) {
            http_response_code(400);
            echo json_encode(["error" => "Code de validation incorrect."]);
            return;
        }

        // Verify account
        $stmtUpdate = $db->prepare("UPDATE users SET is_verified = 1, verification_code = NULL WHERE id = ?");
        $stmtUpdate->execute([$user['id']]);

        echo json_encode([
            "success" => true,
            "message" => "Votre compte a été vérifié avec succès !"
        ]);
    }

    /**
     * POST /api/auth/resend
     */
    public function resend(array $data) {
        $username = trim($data['username'] ?? '');

        if (empty($username)) {
            http_response_code(400);
            echo json_encode(["error" => "Pseudo manquant."]);
            return;
        }

        $db = Database::getConnection();

        $stmt = $db->prepare("SELECT id, email, is_verified FROM users WHERE username = ?");
        $stmt->execute([$username]);
        $user = $stmt->fetch();

        if (!$user) {
            http_response_code(404);
            echo json_encode(["error" => "Utilisateur introuvable."]);
            return;
        }

        if (intval($user['is_verified']) === 1) {
            http_response_code(400);
            echo json_encode(["error" => "Ce compte est déjà vérifié."]);
            return;
        }

        $newCode = strval(rand(100000, 999999));
        $stmtUpdate = $db->prepare("UPDATE users SET verification_code = ? WHERE id = ?");
        $stmtUpdate->execute([$newCode, $user['id']]);

        echo json_encode([
            "success" => true,
            "message" => "Un nouveau code de validation a été généré.",
            "verification_code" => $newCode
        ]);
    }

    /**
     * PUT /api/auth/profile
     */
    public function updateProfile(array $data) {
        $authUser = \App\Middleware\AuthMiddleware::authenticate();
        $db = Database::getConnection();

        $userId = $authUser['user_id'];
        
        $stmtUser = $db->prepare("SELECT id, username, password_hash FROM users WHERE id = ?");
        $stmtUser->execute([$userId]);
        $user = $stmtUser->fetch();

        if (!$user) {
            http_response_code(404);
            echo json_encode(["error" => "Utilisateur introuvable."]);
            return;
        }

        $newUsername = trim($data['username'] ?? '');
        $newBio = trim($data['bio'] ?? '');
        $newAvatarUrl = trim($data['avatar_url'] ?? '');
        $currentPassword = $data['current_password'] ?? '';
        $newPassword = $data['new_password'] ?? '';

        // 1. Update username
        if (!empty($newUsername) && $newUsername !== $user['username']) {
            if (strlen($newUsername) < 3 || strlen($newUsername) > 20) {
                http_response_code(400);
                echo json_encode(["error" => "Le pseudo doit contenir entre 3 et 20 caractères."]);
                return;
            }
            if (!preg_match('/^[a-zA-Z0-9_\-]+$/', $newUsername)) {
                http_response_code(400);
                echo json_encode(["error" => "Le pseudo ne peut contenir que des lettres, chiffres, tirets et underscores."]);
                return;
            }
            
            $disc = $user['discriminator'];
            $stmtCheck = $db->prepare("SELECT id FROM users WHERE username = ? AND discriminator = ?");
            $stmtCheck->execute([$newUsername, $disc]);
            if ($stmtCheck->fetch()) {
                // Generate a new unique discriminator
                $found = false;
                $maxAttempts = 100;
                $attempts = 0;
                while (!$found && $attempts < $maxAttempts) {
                    $newDisc = sprintf("%04d", rand(1000, 9999));
                    $check = $db->prepare("SELECT id FROM users WHERE username = ? AND discriminator = ?");
                    $check->execute([$newUsername, $newDisc]);
                    if (!$check->fetch()) {
                        $disc = $newDisc;
                        $found = true;
                    }
                    $attempts++;
                }
                if (!$found) {
                    http_response_code(409);
                    echo json_encode(["error" => "Ce pseudo est trop populaire, veuillez en choisir un autre."]);
                    return;
                }
            }
            
            $stmtUpdateName = $db->prepare("UPDATE users SET username = ?, discriminator = ? WHERE id = ?");
            $stmtUpdateName->execute([$newUsername, $disc, $userId]);
        }

        // 2. Update bio & avatar_url
        $stmtUpdateMeta = $db->prepare("UPDATE users SET bio = ?, avatar_url = ? WHERE id = ?");
        $stmtUpdateMeta->execute([$newBio !== '' ? $newBio : null, $newAvatarUrl !== '' ? $newAvatarUrl : null, $userId]);

        // 3. Update password
        if (!empty($newPassword)) {
            if (empty($currentPassword)) {
                http_response_code(400);
                echo json_encode(["error" => "Le mot de passe actuel est requis pour le modifier."]);
                return;
            }
            if (!password_verify($currentPassword, $user['password_hash'])) {
                http_response_code(401);
                echo json_encode(["error" => "Le mot de passe actuel est incorrect."]);
                return;
            }
            if (strlen($newPassword) < 6) {
                http_response_code(400);
                echo json_encode(["error" => "Le nouveau mot de passe doit contenir au moins 6 caractères."]);
                return;
            }
            
            $newPasswordHash = password_hash($newPassword, PASSWORD_DEFAULT);
            $stmtUpdatePass = $db->prepare("UPDATE users SET password_hash = ? WHERE id = ?");
            $stmtUpdatePass->execute([$newPasswordHash, $userId]);
        }

        // Fetch fresh profile data
        $stmtFresh = $db->prepare("SELECT id, username, discriminator, email, role, global_score, elo, coins, bio, avatar_url FROM users WHERE id = ?");
        $stmtFresh->execute([$userId]);
        $freshUser = $stmtFresh->fetch();

        // Regenerate JWT token
        $payload = [
            'user_id' => (int) $freshUser['id'],
            'username' => $freshUser['username'],
            'role' => $freshUser['role']
        ];
        $token = JWT::encode($payload);

        echo json_encode([
            "success" => true,
            "message" => "Profil mis à jour avec succès !",
            "token" => $token,
            "user" => [
                "id" => (int) $freshUser['id'],
                "username" => $freshUser['username'],
                "discriminator" => $freshUser['discriminator'],
                "email" => $freshUser['email'],
                "role" => $freshUser['role'],
                "global_score" => (int) $freshUser['global_score'],
                "elo" => (int) $freshUser['elo'],
                "coins" => (int) $freshUser['coins'],
                "bio" => $freshUser['bio'],
                "avatar_url" => $freshUser['avatar_url']
            ]
        ]);
    }

    /**
     * GET /api/auth/profile
     */
    public function profile() {
        $authUser = \App\Middleware\AuthMiddleware::authenticate();
        $db = Database::getConnection();
        
        $stmt = $db->prepare("SELECT id, username, discriminator, email, role, global_score, elo, coins, bio, avatar_url FROM users WHERE id = ?");
        $stmt->execute([$authUser['user_id']]);
        $profile = $stmt->fetch();
        
        if (!$profile) {
            http_response_code(404);
            echo json_encode(["error" => "Utilisateur introuvable."]);
            return;
        }
        
        echo json_encode([
            "success" => true,
            "user" => [
                "id" => (int) $profile['id'],
                "username" => $profile['username'],
                "discriminator" => $profile['discriminator'],
                "email" => $profile['email'],
                "role" => $profile['role'],
                "global_score" => (int) $profile['global_score'],
                "elo" => (int) $profile['elo'],
                "coins" => (int) $profile['coins'],
                "bio" => $profile['bio'],
                "avatar_url" => $profile['avatar_url']
            ]
        ]);
    }

    /**
     * POST /api/auth/upload-avatar
     */
    public function uploadAvatar() {
        $authUser = \App\Middleware\AuthMiddleware::authenticate();
        $userId = $authUser['user_id'];

        if (!isset($_FILES['avatar']) || $_FILES['avatar']['error'] !== UPLOAD_ERR_OK) {
            http_response_code(400);
            echo json_encode(["error" => "Aucun fichier d'avatar reçu ou erreur lors de l'envoi."]);
            return;
        }

        $file = $_FILES['avatar'];
        $maxSize = 2 * 1024 * 1024; // 2MB max
        if ($file['size'] > $maxSize) {
            http_response_code(400);
            echo json_encode(["error" => "L'image ne doit pas dépasser 2 Mo."]);
            return;
        }

        // Validate MIME type
        $allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
        $finfo = finfo_open(FILEINFO_MIME_TYPE);
        $mimeType = finfo_file($finfo, $file['tmp_name']);
        finfo_close($finfo);

        if (!in_array($mimeType, $allowedTypes)) {
            http_response_code(400);
            echo json_encode(["error" => "Format d'image non supporté. (JPEG, PNG, GIF, WEBP uniquement)"]);
            return;
        }

        $extension = pathinfo($file['name'], PATHINFO_EXTENSION);
        if (empty($extension)) {
            $extMap = [
                'image/jpeg' => 'jpg',
                'image/png' => 'png',
                'image/gif' => 'gif',
                'image/webp' => 'webp'
            ];
            $extension = $extMap[$mimeType] ?? 'png';
        }

        // Target directory setup
        $uploadsDir = dirname(__DIR__, 2) . '/public/uploads';
        if (!is_dir($uploadsDir)) {
            mkdir($uploadsDir, 0755, true);
        }

        // Generate unique name
        $filename = 'avatar_' . $userId . '_' . time() . '.' . strtolower($extension);
        $destination = $uploadsDir . '/' . $filename;

        if (!move_uploaded_file($file['tmp_name'], $destination)) {
            http_response_code(500);
            echo json_encode(["error" => "Erreur lors de la sauvegarde du fichier."]);
            return;
        }

        $avatarUrl = '/uploads/' . $filename;
        
        // Update user in DB
        $db = Database::getConnection();
        $stmt = $db->prepare("UPDATE users SET avatar_url = ? WHERE id = ?");
        $stmt->execute([$avatarUrl, $userId]);

        echo json_encode([
            "success" => true,
            "message" => "Avatar téléversé avec succès !",
            "avatar_url" => $avatarUrl
        ]);
    }
}
