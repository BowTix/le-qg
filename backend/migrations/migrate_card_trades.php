<?php
require_once __DIR__ . '/../src/Config/Database.php';
use App\Config\Database;
echo "=== CARD TRADES MIGRATION ===\n";
$db=Database::getConnection();
$db->exec("CREATE TABLE IF NOT EXISTS card_trades (
 id INT AUTO_INCREMENT PRIMARY KEY,
 proposer_id INT NOT NULL,
 recipient_id INT NOT NULL,
 offered_card_id VARCHAR(50) NOT NULL,
 requested_card_id VARCHAR(50) NOT NULL,
 coin_fee INT NOT NULL DEFAULT 0,
 fee_payer ENUM('proposer','recipient') NOT NULL,
 status ENUM('pending','accepted','declined','cancelled') NOT NULL DEFAULT 'pending',
 created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
 responded_at TIMESTAMP NULL DEFAULT NULL,
 CONSTRAINT fk_trade_proposer FOREIGN KEY(proposer_id) REFERENCES users(id) ON DELETE CASCADE,
 CONSTRAINT fk_trade_recipient FOREIGN KEY(recipient_id) REFERENCES users(id) ON DELETE CASCADE,
 CONSTRAINT fk_trade_offered FOREIGN KEY(offered_card_id) REFERENCES cards(id) ON DELETE CASCADE,
 CONSTRAINT fk_trade_requested FOREIGN KEY(requested_card_id) REFERENCES cards(id) ON DELETE CASCADE,
 INDEX idx_trade_recipient_status(recipient_id,status,created_at),
 INDEX idx_trade_proposer_status(proposer_id,status,created_at),
 INDEX idx_trade_reservation(proposer_id,offered_card_id,status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci");
echo "card_trades checked/created.\n";
