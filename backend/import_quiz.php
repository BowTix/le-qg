<?php
/**
 * CLI Script to Import Questions from quiz-api.fr
 * Run: php backend/import_quiz.php [limit]
 */

// Register autoloader
spl_autoload_register(function ($class) {
    $prefix = 'App\\';
    $base_dir = __DIR__ . '/src/';
    $len = strlen($prefix);
    
    if (strncmp($prefix, $class, $len) !== 0) {
        return;
    }
    
    $relative_class = substr($class, $len);
    $file = $base_dir . str_replace('\\', '/', $relative_class) . '.php';
    
    if (file_exists($file)) {
        require $file;
    }
});

// Load environment variables
$envFile = __DIR__ . '/.env';
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

$token = getenv('QUIZ_API_TOKEN');

if (empty($token)) {
    echo "Erreur : La variable QUIZ_API_TOKEN n'est pas définie dans votre fichier .env ou dans votre environnement.\n";
    echo "Veuillez ajouter 'QUIZ_API_TOKEN=votre_token_ici' dans backend/.env\n";
    exit(1);
}

// Get limit from CLI argument (default to 20)
$limit = isset($argv[1]) ? (int)$argv[1] : 20;
if ($limit <= 0) {
    $limit = 20;
}

echo "Début de l'importation de $limit questions depuis quiz-api.fr...\n";

// Call API
$url = "https://api.quiz-api.fr/questions?limit=" . $limit;
$ch = curl_init();
curl_setopt($ch, CURLOPT_URL, $url);
curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
curl_setopt($ch, CURLOPT_HTTPHEADER, [
    "Authorization: Bearer $token",
    "Content-Type: application/json"
]);

$response = curl_exec($ch);
$httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
curl_close($ch);

if ($httpCode !== 200) {
    echo "Erreur de connexion à l'API (HTTP $httpCode).\n";
    echo "Réponse de l'API : $response\n";
    exit(1);
}

$data = json_decode($response, true);
if (!isset($data['data']) || !is_array($data['data'])) {
    echo "Format de réponse invalide ou aucune question trouvée.\n";
    exit(1);
}

$questionsCount = count($data['data']);
echo "Reçu $questionsCount questions.\n";

try {
    $pdo = \App\Config\Database::getConnection();
} catch (\Exception $e) {
    echo "Erreur de connexion à la base de données : " . $e->getMessage() . "\n";
    exit(1);
}

$packsCreated = 0;
$questionsImported = 0;

// Cache for packs to avoid database hits
$packsCache = [];

// Prepare SQL statements
$stmtGetPack = $pdo->prepare("SELECT id FROM packs WHERE name = ?");
$stmtInsertPack = $pdo->prepare("INSERT INTO packs (name, description, is_validated) VALUES (?, ?, 1)");
$stmtInsertQuestion = $pdo->prepare("
    INSERT INTO questions (pack_id, question_text, opt_a, opt_b, opt_c, opt_d, correct_opt) 
    VALUES (?, ?, ?, ?, ?, ?, ?)
");

foreach ($data['data'] as $item) {
    $themeName = isset($item['theme']['title']) ? trim($item['theme']['title']) : 'Importé de Quiz API';
    $questionText = isset($item['title']['fr']) ? trim($item['title']['fr']) : '';
    
    if (empty($questionText)) {
        continue;
    }
    
    // 1. Get or create Pack
    if (!isset($packsCache[$themeName])) {
        $stmtGetPack->execute([$themeName]);
        $packId = $stmtGetPack->fetchColumn();
        
        if (!$packId) {
            $description = "Questions importées sur le thème : " . $themeName;
            $stmtInsertPack->execute([$themeName, $description]);
            $packId = $pdo->lastInsertId();
            $packsCreated++;
            echo "Créé le pack : '$themeName'\n";
        }
        $packsCache[$themeName] = $packId;
    }
    $packId = $packsCache[$themeName];
    
    // 2. Format options and correct answer
    $answers = isset($item['answers']) ? $item['answers'] : [];
    
    $opt_a = isset($answers[0]['title']['fr']) ? trim($answers[0]['title']['fr']) : '';
    $opt_b = isset($answers[1]['title']['fr']) ? trim($answers[1]['title']['fr']) : '';
    $opt_c = isset($answers[2]['title']['fr']) ? trim($answers[2]['title']['fr']) : '';
    $opt_d = isset($answers[3]['title']['fr']) ? trim($answers[3]['title']['fr']) : '';
    
    // Determine which option is correct
    $correct_opt = 'A'; // default
    if (isset($answers[0]['isValid']) && $answers[0]['isValid']) {
        $correct_opt = 'A';
    } elseif (isset($answers[1]['isValid']) && $answers[1]['isValid']) {
        $correct_opt = 'B';
    } elseif (isset($answers[2]['isValid']) && $answers[2]['isValid']) {
        $correct_opt = 'C';
    } elseif (isset($answers[3]['isValid']) && $answers[3]['isValid']) {
        $correct_opt = 'D';
    }
    
    // 3. Insert question
    try {
        $stmtInsertQuestion->execute([
            $packId,
            $questionText,
            $opt_a,
            $opt_b,
            $opt_c,
            $opt_d,
            $correct_opt
        ]);
        $questionsImported++;
    } catch (\PDOException $e) {
        echo "Avertissement : Échec de l'insertion de la question '$questionText' : " . $e->getMessage() . "\n";
    }
}

echo "\nImportation terminée avec succès !\n";
echo "- Nouveaux packs créés : $packsCreated\n";
echo "- Questions importées : $questionsImported\n";
