<?php
namespace App\Controllers;

use App\Config\Database;
use App\Middleware\AuthMiddleware;

class QuestionProposalController {
    public function index() {
        AuthMiddleware::requireAdmin();
        $db = Database::getConnection();
        $stmt = $db->query("
            SELECT qp.*, p.name AS pack_name, u.username AS contributor_username,
                   u.discriminator AS contributor_discriminator
            FROM question_proposals qp
            JOIN packs p ON p.id = qp.pack_id
            LEFT JOIN users u ON u.id = qp.contributor_id
            WHERE qp.status = 'pending'
            ORDER BY qp.created_at ASC, qp.id ASC
        ");

        echo json_encode([
            'success' => true,
            'proposals' => $stmt->fetchAll()
        ]);
    }

    public function moderate(array $data) {
        $admin = AuthMiddleware::requireAdmin();
        $proposalId = (int) ($data['id'] ?? 0);
        $action = trim($data['action'] ?? '');

        if ($proposalId <= 0 || !in_array($action, ['approve', 'reject'], true)) {
            http_response_code(400);
            echo json_encode(['error' => 'Proposition ou action invalide.']);
            return;
        }

        $db = Database::getConnection();
        $db->beginTransaction();

        try {
            $stmt = $db->prepare("SELECT * FROM question_proposals WHERE id = ? FOR UPDATE");
            $stmt->execute([$proposalId]);
            $proposal = $stmt->fetch();

            if (!$proposal || $proposal['status'] !== 'pending') {
                throw new \DomainException('Cette proposition a deja ete traitee.');
            }

            if ($action === 'approve') {
                $insert = $db->prepare("
                    INSERT INTO questions
                        (pack_id, question_text, opt_a, opt_b, opt_c, opt_d, correct_opt, question_type, media_url)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
                ");
                $insert->execute([
                    $proposal['pack_id'], $proposal['question_text'], $proposal['opt_a'],
                    $proposal['opt_b'], $proposal['opt_c'], $proposal['opt_d'],
                    $proposal['correct_opt'], $proposal['question_type'], $proposal['media_url']
                ]);
            }

            $update = $db->prepare("
                UPDATE question_proposals
                SET status = ?, reviewed_by = ?, reviewed_at = NOW()
                WHERE id = ?
            ");
            $update->execute([
                $action === 'approve' ? 'approved' : 'rejected',
                $admin['user_id'],
                $proposalId
            ]);

            $db->commit();
            echo json_encode([
                'success' => true,
                'message' => $action === 'approve'
                    ? 'Question validee et publiee.'
                    : 'Proposition refusee.'
            ]);
        } catch (\DomainException $error) {
            $db->rollBack();
            http_response_code(409);
            echo json_encode(['error' => $error->getMessage()]);
        } catch (\Throwable $error) {
            $db->rollBack();
            throw $error;
        }
    }
}
