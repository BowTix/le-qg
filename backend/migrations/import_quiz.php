<?php

spl_autoload_register(function ($class) {
    $prefix = 'App\\';
    $base_dir = __DIR__ . '/../src/';
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
            if (preg_match('/^"([^"]*)"$/', $val, $m) || preg_match("/^'([^']*)'$/", $val, $m)) {
                $val = $m[1];
            }
            putenv("$key=$val");
            $_ENV[$key] = $val;
            $_SERVER[$key] = $val;
        }
    }
}

$limit = isset($argv[1]) ? (int)$argv[1] : 50;
if ($limit <= 0) {
    $limit = 50;
}

echo "Début de l'importation de $limit questions depuis l'API Joris Moreschi v2...\n";

$url = "https://quizzapi.jomoreschi.fr/api/v2/quiz?limit=" . $limit;
$ch = curl_init();
curl_setopt($ch, CURLOPT_URL, $url);
curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
curl_setopt($ch, CURLOPT_FOLLOWLOCATION, true);
curl_setopt($ch, CURLOPT_HTTPHEADER, [
    "Accept: application/json",
    "Content-Type: application/json"
]);

$response = curl_exec($ch);
$httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
curl_close($ch);

if ($httpCode !== 200) {
    echo "Erreur HTTP $httpCode\n";
    echo "Réponse : $response\n";
    exit(1);
}

$data = json_decode($response, true);

if (!isset($data['quizzes']) || !is_array($data['quizzes'])) {
    echo "Format invalide reçu de l'API. Voici la structure exacte reçue :\n";
    print_r($data);
    exit(1);
}

$questionsCount = count($data['quizzes']);
echo "Reçu $questionsCount questions.\n";

try {
    $pdo = \App\Config\Database::getConnection();
} catch (\Exception $e) {
    echo "Erreur DB : " . $e->getMessage() . "\n";
    exit(1);
}

$packsCreated = 0;
$questionsImported = 0;
$questionsIgnored = 0;
$packsCache = [];

$categoriesMap = [
    'musique' => 'Musique',
    'culture_generale' => 'Culture générale',
    'art_litterature' => 'Arts et littérature',
    'tv_cinema' => 'TV et cinéma',
    'actu_politique' => 'Actualités et politique',
    'sport' => 'Sport',
    'jeux_videos' => 'Jeux vidéos',
    'histoire' => 'Histoire',
    'geographie' => 'Géographie',
    'science' => 'Science',
    'gastronomie' => 'Gastronomie'
];

$stmtGetPack = $pdo->prepare("SELECT id FROM packs WHERE name = ?");
$stmtInsertPack = $pdo->prepare("INSERT INTO packs (name, description, is_validated) VALUES (?, ?, 1)");

// Nouvelle requête pour vérifier l'existence
$stmtCheckQuestion = $pdo->prepare("SELECT COUNT(*) FROM questions WHERE question_text = ?");

$stmtInsertQuestion = $pdo->prepare("
    INSERT INTO questions (pack_id, question_text, opt_a, opt_b, opt_c, opt_d, correct_opt)
    VALUES (?, ?, ?, ?, ?, ?, ?)
");

foreach ($data['quizzes'] as $item) {
    $categorySlug = isset($item['category']) ? trim($item['category']) : 'culture_generale';
    $themeName = isset($categoriesMap[$categorySlug]) ? $categoriesMap[$categorySlug] : $categorySlug;

    $questionText = isset($item['question']) ? trim($item['question']) : '';
    $correctAnswer = isset($item['answer']) ? trim($item['answer']) : '';
    $badAnswers = isset($item['badAnswers']) ? $item['badAnswers'] : [];

    if (empty($questionText) || empty($correctAnswer) || count($badAnswers) < 3) {
        continue;
    }

    // --- LE VIDEUR : On vérifie si la question existe déjà ---
    $stmtCheckQuestion->execute([$questionText]);
    if ($stmtCheckQuestion->fetchColumn() > 0) {
        $questionsIgnored++;
        continue; // On passe à la question suivante sans faire d'insertion
    }

    if (!isset($packsCache[$themeName])) {
        $stmtGetPack->execute([$themeName]);
        $packId = $stmtGetPack->fetchColumn();

        if (!$packId) {
            $stmtInsertPack->execute([$themeName, "Questions de la catégorie " . $themeName]);
            $packId = $pdo->lastInsertId();
            $packsCreated++;
            echo "Pack créé : '$themeName'\n";
        }
        $packsCache[$themeName] = $packId;
    }
    $packId = $packsCache[$themeName];

    $allOptions = $badAnswers;
    $allOptions[] = $correctAnswer;
    shuffle($allOptions);

    $opt_a = trim($allOptions[0]);
    $opt_b = trim($allOptions[1]);
    $opt_c = trim($allOptions[2]);
    $opt_d = trim($allOptions[3]);

    $correct_opt = 'A';
    if ($opt_a === $correctAnswer) {
        $correct_opt = 'A';
    } elseif ($opt_b === $correctAnswer) {
        $correct_opt = 'B';
    } elseif ($opt_c === $correctAnswer) {
        $correct_opt = 'C';
    } elseif ($opt_d === $correctAnswer) {
        $correct_opt = 'D';
    }

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
        echo "Échec de l'insertion pour : '$questionText'\n";
    }
}

echo "\nTerminé !\n";
echo "- Nouveaux packs : $packsCreated\n";
echo "- Nouvelles questions importées : $questionsImported\n";
echo "- Doublons ignorés : $questionsIgnored\n";