<?php
/**
 * Database Setup & Seeding Script
 * Run this from the CLI: php setup_db.php
 */

// Load environment variables if .env exists
function loadEnv() {
    $envFile = __DIR__ . '/../.env';
    if (file_exists($envFile)) {
        $lines = file($envFile, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES);
        foreach ($lines as $line) {
            $line = trim($line);
            if (empty($line) || strpos($line, '#') === 0) {
                continue;
            }
            $parts = explode('=', $line, 2);
            if (count($parts) === 2) {
                $key = trim($parts[0]);
                $val = trim($parts[1]);
                if (preg_match('/^"([^"]*)"$/', $val, $matches) || preg_match("/^'([^']*)'$/", $val, $matches)) {
                    $val = $matches[1];
                }
                putenv("$key=$val");
                $_ENV[$key] = $val;
                $_SERVER[$key] = $val;
            }
        }
    }
}

loadEnv();

$host = getenv('DB_HOST') ?: '127.0.0.1';
$port = getenv('DB_PORT') ?: '3306';
$dbName = getenv('DB_NAME') ?: 'quiz_db';
$user = getenv('DB_USER') ?: 'root';
$pass = getenv('DB_PASS') !== false ? getenv('DB_PASS') : '';
$sslCa = getenv('DB_SSL_CA') ?: null;

$options = [
    PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
    PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
    PDO::ATTR_EMULATE_PREPARES => false,
];
if ($sslCa && file_exists(__DIR__ . '/../' . $sslCa)) {
    $options[PDO::MYSQL_ATTR_SSL_CA] = __DIR__ . '/../' . $sslCa;
}

try {
    // 1. Try to connect to MySQL server without database first to create it
    echo "Connecting to MySQL server...\n";
    $pdo = new PDO("mysql:host=$host;port=$port;charset=utf8mb4", $user, $pass, $options);
    
    // 2. Try to create database (will warning-fail on restricted users/platforms like Aiven)
    try {
        $pdo->exec("CREATE DATABASE IF NOT EXISTS `$dbName` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci");
        echo "Database '$dbName' checked/created.\n";
    } catch (PDOException $e) {
        echo "Warning: Could not create database (might be due to restricted cloud permissions on Aiven): " . $e->getMessage() . "\n";
    }
    
    // 3. Connect/switch to the specific database
    $pdo->exec("USE `$dbName`");
    echo "Using database '$dbName'.\n";
} catch (PDOException $e) {
    // 4. Fallback to connecting directly to the database (required for some managed hosts)
    echo "Could not connect without database name. Retrying connection directly to '$dbName'...\n";
    try {
        $pdo = new PDO("mysql:host=$host;port=$port;dbname=$dbName;charset=utf8mb4", $user, $pass, $options);
        echo "Connected directly to database '$dbName' successfully.\n";
    } catch (PDOException $ex) {
        echo "Database setup error: " . $ex->getMessage() . "\n";
        exit(1);
    }
}

try {
    // 4. Create Tables
    // Users Table
    $pdo->exec("CREATE TABLE IF NOT EXISTS users (
        id INT AUTO_INCREMENT PRIMARY KEY,
        username VARCHAR(50) NOT NULL,
        discriminator VARCHAR(4) NOT NULL,
        email VARCHAR(100) DEFAULT NULL UNIQUE,
        password_hash VARCHAR(255) NOT NULL,
        role VARCHAR(20) NOT NULL DEFAULT 'user',
        global_score INT NOT NULL DEFAULT 0,
        coins INT NOT NULL DEFAULT 0,
        is_verified TINYINT(1) NOT NULL DEFAULT 0,
        verification_code VARCHAR(6) DEFAULT NULL,
        bio TEXT DEFAULT NULL,
        avatar_url VARCHAR(255) DEFAULT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE KEY uq_username_discriminator (username, discriminator)
    ) ENGINE=InnoDB");
    echo "Table 'users' checked/created.\n";

    // Packs Table
    $pdo->exec("CREATE TABLE IF NOT EXISTS packs (
        id INT AUTO_INCREMENT PRIMARY KEY,
        name VARCHAR(100) NOT NULL,
        description TEXT,
        creator_id INT DEFAULT NULL,
        is_validated TINYINT(1) NOT NULL DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (creator_id) REFERENCES users(id) ON DELETE SET NULL
    ) ENGINE=InnoDB");
    echo "Table 'packs' checked/created.\n";

    // Questions Table
    $pdo->exec("CREATE TABLE IF NOT EXISTS questions (
        id INT AUTO_INCREMENT PRIMARY KEY,
        pack_id INT NOT NULL,
        question_text TEXT NOT NULL,
        opt_a VARCHAR(255) NOT NULL,
        opt_b VARCHAR(255) NOT NULL,
        opt_c VARCHAR(255) NOT NULL,
        opt_d VARCHAR(255) NOT NULL,
        correct_opt CHAR(1) NOT NULL,
        question_type ENUM('multiple_choice', 'guess_number', 'open') NOT NULL DEFAULT 'multiple_choice',
        correct_value INT DEFAULT NULL,
        FOREIGN KEY (pack_id) REFERENCES packs(id) ON DELETE CASCADE
    ) ENGINE=InnoDB");
    echo "Table 'questions' checked/created.\n";

    // Lobbies Table
    $pdo->exec("CREATE TABLE IF NOT EXISTS lobbies (
        id INT AUTO_INCREMENT PRIMARY KEY,
        room_code VARCHAR(10) NOT NULL UNIQUE,
        host_id INT NOT NULL,
        status ENUM('waiting', 'playing', 'finished') NOT NULL DEFAULT 'waiting',
        current_question_index INT NOT NULL DEFAULT 0,
        current_question_id INT DEFAULT NULL,
        question_started_at BIGINT UNSIGNED DEFAULT NULL,
        pack_id INT DEFAULT NULL,
        questions_list TEXT DEFAULT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (host_id) REFERENCES users(id) ON DELETE CASCADE,
        FOREIGN KEY (current_question_id) REFERENCES questions(id) ON DELETE SET NULL,
        FOREIGN KEY (pack_id) REFERENCES packs(id) ON DELETE SET NULL
    ) ENGINE=InnoDB");
    echo "Table 'lobbies' checked/created.\n";

    // Lobby Players Table
    $pdo->exec("CREATE TABLE IF NOT EXISTS lobby_players (
        lobby_id INT NOT NULL,
        user_id INT NOT NULL,
        current_score INT NOT NULL DEFAULT 0,
        last_answered_question_id INT DEFAULT NULL,
        PRIMARY KEY (lobby_id, user_id),
        FOREIGN KEY (lobby_id) REFERENCES lobbies(id) ON DELETE CASCADE,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    ) ENGINE=InnoDB");
    echo "Table 'lobby_players' checked/created.\n";

    // Friendships Table
    $pdo->exec("CREATE TABLE IF NOT EXISTS friendships (
        id INT AUTO_INCREMENT PRIMARY KEY,
        user_id INT NOT NULL,
        friend_id INT NOT NULL,
        status ENUM('pending', 'accepted') NOT NULL DEFAULT 'pending',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        FOREIGN KEY (friend_id) REFERENCES users(id) ON DELETE CASCADE,
        UNIQUE KEY unique_friendship (user_id, friend_id)
    ) ENGINE=InnoDB");
    echo "Table 'friendships' checked/created.\n";

    // Rate Limits Table
    $pdo->exec("CREATE TABLE IF NOT EXISTS rate_limits (
        id INT AUTO_INCREMENT PRIMARY KEY,
        ip VARCHAR(45) NOT NULL,
        endpoint VARCHAR(255) NOT NULL,
        timestamp INT UNSIGNED NOT NULL,
        KEY ip_time (ip, timestamp)
    ) ENGINE=InnoDB");
    echo "Table 'rate_limits' checked/created.\n";

    // 5. Seed Data
    // Seed Admin User if not exists
    $stmt = $pdo->prepare("SELECT id FROM users WHERE username = 'admin'");
    $stmt->execute();
    if (!$stmt->fetch()) {
        $admin_pass = password_hash('admin123', PASSWORD_DEFAULT);
        $pdo->prepare("INSERT INTO users (username, discriminator, password_hash, role, is_verified) VALUES ('admin', '0001', ?, 'admin', 1)")
            ->execute([$admin_pass]);
        echo "Admin user created (username: admin, password: admin123).\n";
    }

    // Seed a couple of default users for testing
    $stmt = $pdo->prepare("SELECT id FROM users WHERE username = 'alice'");
    $stmt->execute();
    if (!$stmt->fetch()) {
        $alice_pass = password_hash('alice123', PASSWORD_DEFAULT);
        $pdo->prepare("INSERT INTO users (username, discriminator, password_hash, role, is_verified) VALUES ('alice', '0002', ?, 'user', 1)")
            ->execute([$alice_pass]);
        echo "User 'alice' created (password: alice123).\n";
    }

    $stmt = $pdo->prepare("SELECT id FROM users WHERE username = 'bob'");
    $stmt->execute();
    if (!$stmt->fetch()) {
        $bob_pass = password_hash('bob123', PASSWORD_DEFAULT);
        $pdo->prepare("INSERT INTO users (username, discriminator, password_hash, role, is_verified) VALUES ('bob', '0003', ?, 'user', 1)")
            ->execute([$bob_pass]);
        echo "User 'bob' created (password: bob123).\n";
    }

    // Seed Packs if none exist
    $stmt = $pdo->query("SELECT COUNT(*) FROM packs");
    $pack_count = $stmt->fetchColumn();
    if ($pack_count == 0) {
        // Pack 1: Geek & Programmation
        $pdo->prepare("INSERT INTO packs (id, name, description, is_validated) VALUES (1, 'Geek & Programmation', 'Testez vos connaissances en code, jeux vidéo et tech.', 1)")
            ->execute();
        
        $questions1 = [
            [
                "Quel protocole est utilise pour transferer des pages web de maniere securisee ?",
                "HTTP", "FTP", "HTTPS", "SSH", "C"
            ],
            [
                "Qui est le principal createur du noyau Linux ?",
                "Bill Gates", "Linus Torvalds", "Steve Jobs", "Richard Stallman", "B"
            ],
            [
                "Que signifie l'acronyme HTML ?",
                "Hyper Text Markup Language", "High Tech Multi Language", "Hyper Transfer Mail Language", "Home Tool Markup Language", "A"
            ],
            [
                "En JavaScript, quelle methode convertit un objet JSON en chaine de caracteres ?",
                "JSON.parse()", "JSON.stringify()", "JSON.toString()", "JSON.serialize()", "B"
            ],
            [
                "Quel est le port par defaut pour un serveur MySQL ?",
                "80", "443", "3306", "8080", "C"
            ],
            [
                "Quel langage de programmation a ete cree par Brendan Eich en 10 jours en 1995 ?",
                "Python", "Java", "C++", "JavaScript", "D"
            ],
            [
                "Quelle structure de donnees fonctionne sur le principe LIFO (Last In, First Out) ?",
                "La Pile (Stack)", "La File (Queue)", "L'Arbre binaire", "Le Tableau", "A"
            ],
            [
                "Comment s'appelle l'IA d'assistance au code developpee par GitHub ?",
                "ChatGPT", "Copilot", "Claude", "Gemini", "B"
            ],
            [
                "Quel mot cle est utilise en Python pour declarer une fonction ?",
                "function", "def", "func", "define", "B"
            ],
            [
                "En CSS, quelle propriete permet de modifier l'espace interieur d'un element ?",
                "margin", "border", "padding", "spacing", "C"
            ]
        ];

        $stmt_q = $pdo->prepare("INSERT INTO questions (pack_id, question_text, opt_a, opt_b, opt_c, opt_d, correct_opt) VALUES (?, ?, ?, ?, ?, ?, ?)");
        foreach ($questions1 as $q) {
            $stmt_q->execute(array_merge([1], $q));
        }

        // Pack 2: Culture Générale
        $pdo->prepare("INSERT INTO packs (id, name, description, is_validated) VALUES (2, 'Culture Générale', 'Questions diverses de géographie, histoire et sciences.', 1)")
            ->execute();

        $questions2 = [
            [
                "Quelle est la capitale de l'Australie ?",
                "Sydney", "Melbourne", "Canberra", "Brisbane", "C"
            ],
            [
                "Quel fleuve traverse l'Égypte ?",
                "L'Amazone", "Le Nil", "Le Mississippi", "Le Danube", "B"
            ],
            [
                "En quelle année s'est effondré le mur de Berlin ?",
                "1985", "1989", "1991", "1993", "B"
            ],
            [
                "Quel gaz est le plus abondant dans l'atmosphère terrestre ?",
                "L'Oxygène", "L'Azote", "Le Dioxyde de carbone", "L'Hydrogène", "B"
            ],
            [
                "Qui a peint la Joconde ?",
                "Vincent van Gogh", "Claude Monet", "Leonardo da Vinci", "Pablo Picasso", "C"
            ],
            [
                "Quel est l'océan le plus vaste du monde ?",
                "L'Océan Atlantique", "L'Océan Pacifique", "L'Océan Indien", "L'Océan Arctique", "B"
            ],
            [
                "Quel pays a remporté la Coupe du Monde de football en 2018 ?",
                "Le Brésil", "L'Allemagne", "L'Argentine", "La France", "D"
            ],
            [
                "Combien de planètes compte notre système solaire ?",
                "7", "8", "9", "10", "B"
            ],
            [
                "Qui a écrit l'œuvre 'Les Misérables' ?",
                "Émile Zola", "Albert Camus", "Victor Hugo", "Gustave Flaubert", "C"
            ],
            [
                "Quel est l'element chimique represente par le symbole Au ?",
                "L'Argent", "L'Or", "Le Cuivre", "Le Fer", "B"
            ]
        ];

        foreach ($questions2 as $q) {
            $stmt_q->execute(array_merge([2], $q));
        }

        echo "Default question packs and questions seeded successfully.\n";
    }

    echo "Database setup completed successfully.\n";
} catch (PDOException $e) {
    echo "Database setup error: " . $e->getMessage() . "\n";
    exit(1);
}
