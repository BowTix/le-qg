<?php
/**
 * Test Suite: Automatic Daily Quiz Generation
 */

require_once __DIR__ . '/../src/Config/Database.php';
require_once __DIR__ . '/../src/Controllers/QuizController.php';

use App\Config\Database;
use App\Controllers\QuizController;

echo "=================================================\n";
echo "      TEST SUITE: AUTO DAILY QUIZ GENERATION     \n";
echo "=================================================\n\n";

$db = Database::getConnection();
$controller = new QuizController();

$testDate = '2029-01-01'; // Future date for clean isolated test

// Clean up any test artifact
$db->prepare("DELETE FROM daily_quizzes WHERE date = ?")->execute([$testDate]);

// [TEST 1] First generation for $testDate
echo "[TEST 1] Génération automatique d'un quiz pour une date vierge ($testDate)...\n";
$quiz = $controller->ensureDailyQuiz($db, $testDate);

if (!$quiz || empty($quiz['q1_id']) || empty($quiz['q2_id']) || empty($quiz['q3_id'])) {
    echo "❌ ÉCHEC : Le quiz n'a pas été généré correctement.\n";
    exit(1);
}

echo "✅ Quiz généré avec succès : Q1={$quiz['q1_id']}, Q2={$quiz['q2_id']}, Q3={$quiz['q3_id']}\n";

// [TEST 2] Verify that the 3 questions come from 3 distinct packs
echo "\n[TEST 2] Vérification de la diversité thématique (3 packs distincts)...\n";
$stmtPacks = $db->prepare("
    SELECT q.id, q.pack_id, p.name 
    FROM questions q 
    JOIN packs p ON p.id = q.pack_id 
    WHERE q.id IN (?, ?, ?)
");
$stmtPacks->execute([$quiz['q1_id'], $quiz['q2_id'], $quiz['q3_id']]);
$rows = $stmtPacks->fetchAll(PDO::FETCH_ASSOC);

$packIds = array_map(fn($r) => $r['pack_id'], $rows);
$packNames = array_map(fn($r) => $r['name'], $rows);

echo "-> Thèmes sélectionnés : " . implode(' | ', $packNames) . "\n";

if (count(array_unique($packIds)) !== 3) {
    echo "❌ ÉCHEC : Les 3 questions ne proviennent pas de 3 packs différents.\n";
    exit(1);
}
echo "✅ SUCCÈS : 3 thèmes validés différents garantis.\n";

// [TEST 3] Persistence / Idempotency check
echo "\n[TEST 3] Vérification de la persistance (deuxième appel pour la même date)...\n";
$quiz2 = $controller->ensureDailyQuiz($db, $testDate);

if ($quiz2['q1_id'] !== $quiz['q1_id'] || $quiz2['q2_id'] !== $quiz['q2_id'] || $quiz2['q3_id'] !== $quiz['q3_id']) {
    echo "❌ ÉCHEC : Le deuxième appel a modifié le quiz du jour !\n";
    exit(1);
}
echo "✅ SUCCÈS : Le quiz est strictement identique et persistant.\n";

// [TEST 4] Test for the following day ($testDate + 1)
echo "\n[TEST 4] Génération pour le lendemain (2029-01-02)...\n";
$testDateTomorrow = '2029-01-02';
$db->prepare("DELETE FROM daily_quizzes WHERE date = ?")->execute([$testDateTomorrow]);
$quizTomorrow = $controller->ensureDailyQuiz($db, $testDateTomorrow);

echo "-> Lendemain : Q1={$quizTomorrow['q1_id']}, Q2={$quizTomorrow['q2_id']}, Q3={$quizTomorrow['q3_id']}\n";
$overlap = array_intersect(
    [$quiz['q1_id'], $quiz['q2_id'], $quiz['q3_id']],
    [$quizTomorrow['q1_id'], $quizTomorrow['q2_id'], $quizTomorrow['q3_id']]
);

if (!empty($overlap)) {
    echo "❌ ÉCHEC : Répétition immédiate d'une question le lendemain !\n";
    exit(1);
}
echo "✅ SUCCÈS : Zéro chevauchement de question entre les deux jours.\n";

// Clean up test dates
$db->prepare("DELETE FROM daily_quizzes WHERE date IN (?, ?)")->execute([$testDate, $testDateTomorrow]);

// [TEST 5] Live today check
echo "\n[TEST 5] Génération pour la date courante (" . date('Y-m-d') . ")...\n";
$todayQuiz = $controller->ensureDailyQuiz($db, date('Y-m-d'));
if (!$todayQuiz) {
    echo "❌ ÉCHEC : Impossible de générer le quiz d'aujourd'hui.\n";
    exit(1);
}
echo "✅ SUCCÈS : Quiz du jour disponible immédiatement pour tous les joueurs !\n";
echo "   Questions du jour : Q1={$todayQuiz['q1_id']}, Q2={$todayQuiz['q2_id']}, Q3={$todayQuiz['q3_id']}\n";

echo "\n=================================================\n";
echo "        TOUS LES TESTS SONT AU VERT !            \n";
echo "=================================================\n";
