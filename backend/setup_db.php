<?php
/**
 * Database Setup & Seeding Script
 * Run this from the CLI: php setup_db.php
 */

$host = '127.0.0.1';
$user = 'root';
$pass = ''; // Default Laragon password is empty

try {
    // 1. Connect to MySQL Server
    $pdo = new PDO("mysql:host=$host", $user, $pass);
    $pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
    echo "Connected to MySQL server successfully.\n";

    // 2. Create Database
    $pdo->exec("CREATE DATABASE IF NOT EXISTS quiz_db CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci");
    echo "Database 'quiz_db' checked/created.\n";

    // 3. Connect to the specific Database
    $pdo->exec("USE quiz_db");

    // 4. Create Tables
    // Users Table
    $pdo->exec("CREATE TABLE IF NOT EXISTS users (
        id INT AUTO_INCREMENT PRIMARY KEY,
        username VARCHAR(50) NOT NULL UNIQUE,
        password_hash VARCHAR(255) NOT NULL,
        role VARCHAR(20) NOT NULL DEFAULT 'user',
        global_score INT NOT NULL DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
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

    // Rate Limits Table
    $pdo->exec("CREATE TABLE IF NOT EXISTS rate_limits (
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
        $pdo->prepare("INSERT INTO users (username, password_hash, role) VALUES ('admin', ?, 'admin')")
            ->execute([$admin_pass]);
        echo "Admin user created (username: admin, password: admin123).\n";
    }

    // Seed a couple of default users for testing
    $stmt = $pdo->prepare("SELECT id FROM users WHERE username = 'alice'");
    $stmt->execute();
    if (!$stmt->fetch()) {
        $alice_pass = password_hash('alice123', PASSWORD_DEFAULT);
        $pdo->prepare("INSERT INTO users (username, password_hash, role) VALUES ('alice', ?, 'user')")
            ->execute([$alice_pass]);
        echo "User 'alice' created (password: alice123).\n";
    }

    $stmt = $pdo->prepare("SELECT id FROM users WHERE username = 'bob'");
    $stmt->execute();
    if (!$stmt->fetch()) {
        $bob_pass = password_hash('bob123', PASSWORD_DEFAULT);
        $pdo->prepare("INSERT INTO users (username, password_hash, role) VALUES ('bob', ?, 'user')")
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
