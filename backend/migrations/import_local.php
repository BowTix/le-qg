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

$jsonFile = __DIR__ . '/open_questions.json';

if (!file_exists($jsonFile)) {
    echo "Erreur : Le fichier open_questions.json est introuvable dans " . __DIR__ . "\n";
    exit(1);
}

$json = file_get_contents($jsonFile);
$data = json_decode($json, true);

if (!is_array($data)) {
    echo "Erreur : Le fichier JSON est invalide.\n";
    exit(1);
}

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

$stmtGetPack = $pdo->prepare("SELECT id FROM packs WHERE name = ?");
$stmtInsertPack = $pdo->prepare("INSERT INTO packs (name, description, is_validated) VALUES (?, ?, 1)");
$stmtCheckQuestion = $pdo->prepare("SELECT COUNT(*) FROM questions WHERE question_text = ?");
$stmtInsertQuestion = $pdo->prepare("
    INSERT INTO questions (pack_id, question_text, opt_a, opt_b, opt_c, opt_d, correct_opt, question_type)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
");

foreach ($data as $item) {
    $themeName = isset($item['themeName']) ? trim($item['themeName']) : 'Questions Ouvertes';
    $questionText = isset($item['question_text']) ? trim($item['question_text']) : '';
    $optA = isset($item['opt_a']) ? trim($item['opt_a']) : '';
    $questionType = isset($item['question_type']) ? trim($item['question_type']) : 'open';

    if (empty($questionText) || empty($optA)) {
        continue;
    }

    $stmtCheckQuestion->execute([$questionText]);
    if ($stmtCheckQuestion->fetchColumn() > 0) {
        $questionsIgnored++;
        continue;
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

    try {
        $stmtInsertQuestion->execute([
            $packId,
            $questionText,
            $optA,
            '',
            '',
            '',
            'A',
            $questionType
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