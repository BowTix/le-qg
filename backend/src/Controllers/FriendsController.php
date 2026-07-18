<?php
namespace App\Controllers;

use App\Config\Database;
use App\Middleware\AuthMiddleware;
use PDO;

class FriendsController {
    /**
     * GET /api/friends
     * Get all friends and pending requests
     */
    public function getFriends() {
        $authUser = AuthMiddleware::authenticate();
        $userId = (int) $authUser['user_id'];
        $db = Database::getConnection();

        // 1. Get accepted friends
        // A friend relation is when user_id = $userId or friend_id = $userId and status = 'accepted'
        $stmtFriends = $db->prepare("
            SELECT f.id as friendship_id, u.id as friend_id, u.username, u.discriminator, u.global_score, u.coins, u.bio, u.avatar_url
            FROM friendships f
            JOIN users u ON (f.user_id = u.id OR f.friend_id = u.id)
            WHERE (f.user_id = ? OR f.friend_id = ?) AND f.status = 'accepted' AND u.id != ?
        ");
        $stmtFriends->execute([$userId, $userId, $userId]);
        $friends = $stmtFriends->fetchAll();

        // 2. Get incoming pending requests
        $stmtIncoming = $db->prepare("
            SELECT f.id as friendship_id, u.id as requester_id, u.username, u.discriminator, u.global_score, u.avatar_url
            FROM friendships f
            JOIN users u ON f.user_id = u.id
            WHERE f.friend_id = ? AND f.status = 'pending'
        ");
        $stmtIncoming->execute([$userId]);
        $incoming = $stmtIncoming->fetchAll();

        // 3. Get outgoing pending requests
        $stmtOutgoing = $db->prepare("
            SELECT f.id as friendship_id, u.id as receiver_id, u.username, u.discriminator, u.global_score, u.avatar_url
            FROM friendships f
            JOIN users u ON f.friend_id = u.id
            WHERE f.user_id = ? AND f.status = 'pending'
        ");
        $stmtOutgoing->execute([$userId]);
        $outgoing = $stmtOutgoing->fetchAll();

        echo json_encode([
            "success" => true,
            "friends" => $friends,
            "incoming" => $incoming,
            "outgoing" => $outgoing
        ]);
    }

    /**
     * POST /api/friends/request
     * Send a friend request by username
     */
    public function sendRequest(array $data) {
        $authUser = AuthMiddleware::authenticate();
        $userId = (int) $authUser['user_id'];
        $friendUsername = trim($data['friend_username'] ?? '');

        if (empty($friendUsername)) {
            http_response_code(400);
            echo json_encode(["error" => "Le pseudo du joueur est requis."]);
            return;
        }

        if (strcasecmp($friendUsername, $authUser['username']) === 0) {
            http_response_code(400);
            echo json_encode(["error" => "Vous ne pouvez pas vous ajouter vous-même."]);
            return;
        }

        $db = Database::getConnection();

        // Find recipient user (by tag username#discriminator or single unique username)
        $friend = null;
        if (strpos($friendUsername, '#') !== false) {
            $parts = explode('#', $friendUsername, 2);
            $uName = trim($parts[0]);
            $uDisc = trim($parts[1]);
            
            $stmt = $db->prepare("SELECT id FROM users WHERE username = ? AND discriminator = ?");
            $stmt->execute([$uName, $uDisc]);
            $friend = $stmt->fetch();
        } else {
            $stmt = $db->prepare("SELECT id FROM users WHERE username = ?");
            $stmt->execute([$friendUsername]);
            $results = $stmt->fetchAll();
            
            if (count($results) === 1) {
                $friend = $results[0];
            } elseif (count($results) > 1) {
                http_response_code(400);
                echo json_encode(["error" => "Plusieurs joueurs utilisent ce pseudo. Veuillez préciser le tag # (ex: {$friendUsername}#1234)."]);
                return;
            }
        }

        if (!$friend) {
            http_response_code(404);
            echo json_encode(["error" => "Joueur introuvable."]);
            return;
        }

        $friendId = (int) $friend['id'];

        // Check if a friendship or pending request already exists
        $stmtRelation = $db->prepare("
            SELECT id, status, user_id FROM friendships 
            WHERE (user_id = ? AND friend_id = ?) OR (user_id = ? AND friend_id = ?)
        ");
        $stmtRelation->execute([$userId, $friendId, $friendId, $userId]);
        $relation = $stmtRelation->fetch();

        if ($relation) {
            if ($relation['status'] === 'accepted') {
                http_response_code(400);
                echo json_encode(["error" => "Vous êtes déjà ami avec ce joueur."]);
            } else {
                if ((int)$relation['user_id'] === $userId) {
                    http_response_code(400);
                    echo json_encode(["error" => "Vous avez déjà envoyé une demande à ce joueur."]);
                } else {
                    // Recipient had sent a request to user, auto-accept it!
                    $stmtAccept = $db->prepare("UPDATE friendships SET status = 'accepted' WHERE id = ?");
                    $stmtAccept->execute([$relation['id']]);
                    echo json_encode(["success" => true, "message" => "Demande acceptée ! Vous êtes maintenant amis."]);
                }
            }
            return;
        }

        // Insert new request
        $stmtInsert = $db->prepare("INSERT INTO friendships (user_id, friend_id, status) VALUES (?, ?, 'pending')");
        $stmtInsert->execute([$userId, $friendId]);

        echo json_encode([
            "success" => true,
            "message" => "Demande d'ami envoyée à " . $friendUsername
        ]);
    }

    /**
     * POST /api/friends/respond
     * Respond to a friend request (accept or decline)
     */
    public function respondRequest(array $data) {
        $authUser = AuthMiddleware::authenticate();
        $userId = (int) $authUser['user_id'];
        $friendshipId = (int) ($data['friendship_id'] ?? 0);
        $action = trim($data['action'] ?? ''); // 'accept' or 'decline'

        if (!$friendshipId || !in_array($action, ['accept', 'decline'])) {
            http_response_code(400);
            echo json_encode(["error" => "Requête invalide."]);
            return;
        }

        $db = Database::getConnection();

        // Verify the friendship is pending and meant for the current user
        $stmt = $db->prepare("SELECT id, user_id, friend_id, status FROM friendships WHERE id = ?");
        $stmt->execute([$friendshipId]);
        $relation = $stmt->fetch();

        if (!$relation || $relation['status'] !== 'pending') {
            http_response_code(404);
            echo json_encode(["error" => "Demande introuvable ou déjà traitée."]);
            return;
        }

        if ((int)$relation['friend_id'] !== $userId) {
            http_response_code(403);
            echo json_encode(["error" => "Action non autorisée."]);
            return;
        }

        if ($action === 'accept') {
            $stmtUpdate = $db->prepare("UPDATE friendships SET status = 'accepted' WHERE id = ?");
            $stmtUpdate->execute([$friendshipId]);
            echo json_encode(["success" => true, "message" => "Demande d'ami acceptée."]);
        } else {
            $stmtDelete = $db->prepare("DELETE FROM friendships WHERE id = ?");
            $stmtDelete->execute([$friendshipId]);
            echo json_encode(["success" => true, "message" => "Demande d'ami refusée."]);
        }
    }

    /**
     * DELETE /api/friends/remove
     * Remove a friend or cancel a request
     */
    public function removeFriend(array $data) {
        $authUser = AuthMiddleware::authenticate();
        $userId = (int) $authUser['user_id'];
        $friendshipId = (int) ($data['friendship_id'] ?? 0);

        if (!$friendshipId) {
            http_response_code(400);
            echo json_encode(["error" => "Identifiant d'amitié requis."]);
            return;
        }

        $db = Database::getConnection();

        // Verify user is part of this friendship
        $stmt = $db->prepare("SELECT id, user_id, friend_id FROM friendships WHERE id = ?");
        $stmt->execute([$friendshipId]);
        $relation = $stmt->fetch();

        if (!$relation) {
            http_response_code(404);
            echo json_encode(["error" => "Relation introuvable."]);
            return;
        }

        if ((int)$relation['user_id'] !== $userId && (int)$relation['friend_id'] !== $userId) {
            http_response_code(403);
            echo json_encode(["error" => "Action non autorisée."]);
            return;
        }

        $stmtDelete = $db->prepare("DELETE FROM friendships WHERE id = ?");
        $stmtDelete->execute([$friendshipId]);

        echo json_encode([
            "success" => true,
            "message" => "Ami retiré ou demande annulée."
        ]);
    }

    /**
     * GET /api/friends/search
     * Search users by prefix query (prefix query or username#discriminator query)
     */
    public function searchUsers() {
        $authUser = AuthMiddleware::authenticate();
        $userId = (int) $authUser['user_id'];
        $query = trim($_GET['query'] ?? '');

        if (strlen($query) < 2) {
            echo json_encode(["success" => true, "users" => []]);
            return;
        }

        $db = Database::getConnection();
        
        $searchTerm = $query . '%';
        $stmt = $db->prepare("
            SELECT username, discriminator, avatar_url, global_score 
            FROM users 
            WHERE (username LIKE ? OR CONCAT(username, '#', discriminator) LIKE ?) 
              AND id != ? 
            ORDER BY username ASC 
            LIMIT 5
        ");
        $stmt->execute([$searchTerm, $searchTerm, $userId]);
        $results = $stmt->fetchAll();

        echo json_encode([
            "success" => true,
            "users" => $results
        ]);
    }
}
