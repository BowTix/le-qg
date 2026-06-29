<?php
require_once __DIR__ . '/src/Config/Database.php';

try {
    $db = \App\Config\Database::getConnection();
    echo "Connected to the database.\n";

    // 1. Check if discriminator column already exists
    $columns = $db->query("SHOW COLUMNS FROM users LIKE 'discriminator'")->fetch();
    if (!$columns) {
        echo "Adding column 'discriminator'...\n";
        // Create as nullable first, so we can populate it
        $db->exec("ALTER TABLE users ADD COLUMN discriminator VARCHAR(4) DEFAULT NULL");
    }

    // 2. Populate empty discriminators for existing users
    $stmt = $db->query("SELECT id, username FROM users WHERE discriminator IS NULL");
    $users = $stmt->fetchAll();

    if (count($users) > 0) {
        echo "Assigning unique discriminators to " . count($users) . " existing users...\n";
        $updateStmt = $db->prepare("UPDATE users SET discriminator = ? WHERE id = ?");
        
        foreach ($users as $u) {
            $assigned = false;
            while (!$assigned) {
                $disc = sprintf("%04d", rand(1000, 9999));
                // Check if combination username + discriminator already exists in DB
                $check = $db->prepare("SELECT id FROM users WHERE username = ? AND discriminator = ?");
                $check->execute([$u['username'], $disc]);
                if (!$check->fetch()) {
                    $updateStmt->execute([$disc, $u['id']]);
                    $assigned = true;
                    echo "-> User '{$u['username']}' assigned #{$disc}\n";
                }
            }
        }
    }

    // 3. Make discriminator NOT NULL
    $db->exec("ALTER TABLE users MODIFY COLUMN discriminator VARCHAR(4) NOT NULL");
    echo "Discriminator column set to NOT NULL.\n";

    // 4. Drop single UNIQUE index on username if it exists
    try {
        $db->exec("ALTER TABLE users DROP INDEX username");
        echo "Dropped index 'username' successfully.\n";
    } catch (PDOException $e) {
        echo "Index 'username' did not exist or already dropped: " . $e->getMessage() . "\n";
    }

    // 5. Add unique index on (username, discriminator) if not exists
    try {
        $db->exec("ALTER TABLE users ADD UNIQUE KEY uq_username_discriminator (username, discriminator)");
        echo "Created unique index on (username, discriminator) successfully.\n";
    } catch (PDOException $e) {
        echo "Unique key uq_username_discriminator might already exist: " . $e->getMessage() . "\n";
    }

    echo "Migration completed successfully!\n";

} catch (Exception $e) {
    echo "Migration failed: " . $e->getMessage() . "\n";
}
