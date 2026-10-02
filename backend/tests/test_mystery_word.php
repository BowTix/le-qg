<?php
/**
 * Test Suite: Mot Mystere (Wordle) logic and endpoints
 * Run: php backend/tests/test_mystery_word.php
 */

require_once __DIR__ . '/../src/Config/Database.php';
require_once __DIR__ . '/../src/Utils/JWT.php';
require_once __DIR__ . '/../src/Data/MysteryWordsData.php';

use App\Config\Database;
use App\Utils\JWT;
use App\Data\MysteryWordsData;

$baseUrl = getenv('API_BASE_URL') ?: 'http://localhost:8080/api';

echo "=================================================\n";
echo "      TEST SUITE: MOT MYSTERE (WORDLE)           \n";
echo "=================================================\n\n";

// Helper for HTTP requests
function makeRequest($url, $method = 'GET', $data = null, $token = null) {
    $ch = curl_init($url);
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
    curl_setopt($ch, CURLOPT_CUSTOMREQUEST, $method);
    curl_setopt($ch, CURLOPT_TIMEOUT, 10);
    
    $headers = ['Content-Type: application/json'];
    if ($token) {
        $headers[] = "Authorization: Bearer $token";
    }
    curl_setopt($ch, CURLOPT_HTTPHEADER, $headers);
    
    if ($data !== null) {
        curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode($data));
    }
    
    $response = curl_exec($ch);
    $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    $err = curl_error($ch);
    curl_close($ch);
    
    if ($err) {
        return ['code' => 0, 'body' => ['error' => $err]];
    }
    
    return [
        'code' => $httpCode,
        'body' => json_decode($response, true) ?? $response
    ];
}

// ----------------------------------------------------
// TEST 1: Two-Pass Wordle Algorithm Verification
// ----------------------------------------------------
echo "[TEST 1] Vérification de l'algorithme des lettres en double...\n";

// Cas 1 : Target = POMME (1 seul P, 2 M), Guess = PUPIT (2 P)
// P #1 (pos 0) est exact (correct). P #2 (pos 2) doit être absent !
$eval1 = MysteryWordsData::evaluateGuess("PUPIT", "POMME");
$statuses1 = array_column($eval1, 'status');
assert($statuses1[0] === 'correct', "P #1 doit être correct");
assert($statuses1[2] === 'absent', "P #2 doit être absent car le seul P de POMME a été consommé");
echo "✅ Cas 1 (POMME vs PUPIT - P doublon non présent) validé avec succès.\n";

// Cas 2 : Target = ROBOT (2 O en pos 1 et 3), Guess = COTON (2 O en pos 1 et 3)
// O #1 (pos 1) -> correct, O #2 (pos 3) -> correct, T (pos 2) -> present (ROBOT a son T en pos 4)
$eval2 = MysteryWordsData::evaluateGuess("COTON", "ROBOT");
$statuses2 = array_column($eval2, 'status');
assert($statuses2[1] === 'correct', "O pos 1 à la bonne place");
assert($statuses2[3] === 'correct', "O pos 3 à la bonne place");
assert($statuses2[2] === 'present', "T est présent ailleurs (en pos 4)");
assert($statuses2[0] === 'absent', "C est absent");
assert($statuses2[4] === 'absent', "N est absent");
echo "✅ Cas 2 (ROBOT vs COTON - 2 O exacts + T présent) validé avec succès.\n";

// Cas 3 : Mot identique -> 5 x correct
$eval3 = MysteryWordsData::evaluateGuess("TABLE", "TABLE");
$statuses3 = array_column($eval3, 'status');
foreach ($statuses3 as $st) {
    assert($st === 'correct', "Toutes les lettres doivent être correctes");
}
echo "✅ Cas 3 (TABLE vs TABLE - victoire) validé avec succès.\n\n";

// ----------------------------------------------------
// TEST 2: Deterministic Daily Word Generation
// ----------------------------------------------------
echo "[TEST 2] Vérification du mot du jour déterministe...\n";
$todayWord1 = MysteryWordsData::getDailyWord('2026-09-22');
$todayWord2 = MysteryWordsData::getDailyWord('2026-09-22');
$tomorrowWord = MysteryWordsData::getDailyWord('2026-09-23');

assert($todayWord1 === $todayWord2, "Le mot du jour doit être identique pour la même date");
echo "-> Mot du 2026-09-22 : '$todayWord1'\n";
echo "-> Mot du 2026-09-23 : '$tomorrowWord'\n";
assert($todayWord1 !== $tomorrowWord, "Le mot doit changer d'un jour à l'autre");
echo "✅ Déterminisme et rotation quotidienne validés avec succès.\n\n";

// ----------------------------------------------------
// TEST 3: API Status Endpoint (Clean state)
// ----------------------------------------------------
echo "[TEST 3] Test de l'endpoint GET /api/mystery-word/status...\n";
$db = Database::getConnection();
$db->exec("INSERT INTO users (id, username, discriminator, email, password_hash, is_verified, coins) VALUES (999998, 'test_wordle_bot', '0001', 'test_wordle@test.local', 'hash', 1, 100) ON DUPLICATE KEY UPDATE is_verified = 1");
$user = ['id' => 999998, 'username' => 'test_wordle_bot'];
$token = JWT::encode(['user_id' => 999998, 'username' => 'test_wordle_bot', 'role' => 'user']);

// Reset existing attempt for today to test from scratch
$today = date('Y-m-d');
$db->prepare("DELETE FROM user_mystery_word_attempts WHERE user_id = ? AND game_date = ?")
   ->execute([999998, $today]);

$statusRes = makeRequest("$baseUrl/mystery-word/status", 'GET', null, $token);
if ($statusRes['code'] === 200 && isset($statusRes['body']['status'])) {
    $body = $statusRes['body'];
    assert($body['status'] === 'in_progress');
    assert($body['attempts_count'] === 0);
    assert($body['target_word'] === null, "Le mot secret ne doit JAMAIS être dévoilé en cours de partie");
    echo "✅ SUCCÈS : Statut vierge retourné sans fuite du mot secret.\n\n";
} else {
    echo "❌ ÉCHEC GET status : Code {$statusRes['code']}\n";
    print_r($statusRes['body']);
    exit(1);
}

// ----------------------------------------------------
// TEST 4: Guess Validation Errors & User Words
// ----------------------------------------------------
echo "[TEST 4] Test des validations de saisie (longueur, dictionnaire & mots demandés)...\n";
// Mot trop court
$shortRes = makeRequest("$baseUrl/mystery-word/guess", 'POST', ['guess' => 'CHAT'], $token);
assert($shortRes['code'] === 400, "Doit rejeter un mot de 4 lettres");

// Mot inexistant
$fakeRes = makeRequest("$baseUrl/mystery-word/guess", 'POST', ['guess' => 'ZZZZZ'], $token);
assert($fakeRes['code'] === 400, "Doit rejeter un mot inconnu");

// Vérifier que les mots mentionnés par l'utilisateur sont acceptés par la validation dictionnaire
assert(MysteryWordsData::isValidWord('CHOUX'), "CHOUX doit être un mot valide");
assert(MysteryWordsData::isValidWord('ABUSE'), "ABUSE doit être un mot valide");
assert(MysteryWordsData::isValidWord('BASES'), "BASES doit être un mot valide");
assert(MysteryWordsData::isValidWord('choux'), "choux en minuscules doit être valide");
assert(MysteryWordsData::isValidWord('abusé'), "abusé avec accents doit être valide");
echo "✅ Mots demandés (CHOUX, ABUSE, BASES, abusé) validés dans le dictionnaire étendu !\n\n";

// ----------------------------------------------------
// TEST 5: Guess Submission & Win Flow
// ----------------------------------------------------
echo "[TEST 5] Test de soumission d'essais jusqu'à la victoire...\n";
$actualTodayWord = MysteryWordsData::getDailyWord(date('Y-m-d'));
// 1er essai incorrect mais valide
$guess1 = ($actualTodayWord === 'TABLE') ? 'CHIEN' : 'TABLE';
$res1 = makeRequest("$baseUrl/mystery-word/guess", 'POST', ['guess' => $guess1], $token);
assert($res1['code'] === 200, "L'essai valide doit être accepté");
assert($res1['body']['status'] === 'in_progress');
assert($res1['body']['attempts_count'] === 1);
echo "-> Essai 1 ('$guess1') enregistré avec succès.\n";

// 2ème essai : le bon mot !
$res2 = makeRequest("$baseUrl/mystery-word/guess", 'POST', ['guess' => $actualTodayWord], $token);
assert($res2['code'] === 200, "Le bon mot doit être accepté");
assert($res2['body']['status'] === 'won', "Statut doit être 'won'");
assert($res2['body']['is_game_over'] === true);
assert($res2['body']['target_word'] === $actualTodayWord, "Le mot doit être dévoilé une fois gagné");
assert($res2['body']['coins_awarded'] > 0, "Des pièces doivent être attribuées");
assert($res2['body']['score_awarded'] > 0, "Du score doit être attribué");
echo "-> Victoire au coup 2 ('$todayWord1') : +{$res2['body']['coins_awarded']} coins, +{$res2['body']['score_awarded']} score.\n\n";

// ----------------------------------------------------
// TEST 6: Prevent Replay on Completed Day
// ----------------------------------------------------
echo "[TEST 6] Vérification du blocage anti-rejouer...\n";
$replayRes = makeRequest("$baseUrl/mystery-word/guess", 'POST', ['guess' => 'CHIEN'], $token);
assert($replayRes['code'] === 400, "Doit refuser un nouvel essai si la partie du jour est terminée");
echo "✅ SUCCÈS : Rejeu impossible une fois la partie du jour terminée.\n\n";

// Cleanup test user and attempts
$db->exec("DELETE FROM user_mystery_word_attempts WHERE user_id = 999998");
$db->exec("DELETE FROM users WHERE id = 999998");

echo "=================================================\n";
echo "        TOUS LES TESTS SONT AU VERT !            \n";
echo "=================================================\n";
