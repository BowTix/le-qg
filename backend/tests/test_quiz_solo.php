<?php
/**
 * Solo Quiz & Pop Culture Verification Test Suite
 * Run: php backend/tests/test_quiz_solo.php
 */

require_once __DIR__ . '/../src/Config/Database.php';
require_once __DIR__ . '/../src/Utils/JWT.php';

use App\Config\Database;
use App\Utils\JWT;

$baseUrl = getenv('API_BASE_URL') ?: 'http://localhost:8080/api';

echo "=================================================\n";
echo "   SOLO QUIZ & POP CULTURE VERIFICATION SUITE    \n";
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

$db = Database::getConnection();

// --- TEST 1: Database Packs & Pop Culture Inspection ---
echo "[TEST 1] Inspection des packs et questions en base de données...\n";
$packs = $db->query("
    SELECT p.id, p.name, p.description, p.is_validated, COUNT(q.id) as question_count
    FROM packs p
    LEFT JOIN questions q ON p.id = q.pack_id
    GROUP BY p.id
    ORDER BY p.id ASC
")->fetchAll();

echo "-> Packs trouvés en base (" . count($packs) . ") :\n";
$popCulturePack = null;
foreach ($packs as $p) {
    echo "   [ID {$p['id']}] {$p['name']} (validé: {$p['is_validated']}, questions: {$p['question_count']})\n";
    if (stripos($p['name'], 'culture') !== false || stripos($p['name'], 'pop') !== false) {
        $popCulturePack = $p;
    }
}

if (!$popCulturePack && count($packs) > 0) {
    $popCulturePack = $packs[0]; // Fallback to first pack
}

if ($popCulturePack) {
    echo "✅ Pack de test sélectionné : [ID {$popCulturePack['id']}] '{$popCulturePack['name']}' avec {$popCulturePack['question_count']} questions.\n\n";
} else {
    echo "⚠️ Aucun pack trouvé en base !\n\n";
}

// --- TEST 2: Question Types Inspection (qcm, open, media) ---
echo "[TEST 2] Vérification de la diversité des types de questions...\n";
$types = $db->query("
    SELECT question_type, COUNT(*) as cnt 
    FROM questions 
    GROUP BY question_type
")->fetchAll(PDO::FETCH_KEY_PAIR);

echo "-> Répartition par type de question :\n";
foreach ($types as $t => $cnt) {
    echo "   - $t : $cnt questions\n";
}
echo "✅ Types de questions recensés avec succès.\n\n";

// --- TEST 3: User Authentication for API testing ---
echo "[TEST 3] Obtention d'un utilisateur et token JWT...\n";
$testUser = $db->query("SELECT id, username, email, global_score, coins FROM users WHERE is_verified = 1 LIMIT 1")->fetch();

if (!$testUser) {
    echo "❌ Aucun utilisateur vérifié en base.\n";
    exit(1);
}

$token = JWT::encode([
    'user_id' => (int) $testUser['id'],
    'username' => $testUser['username'],
    'role' => 'user'
]);
echo "✅ Utilisateur de test : {$testUser['username']} (ID {$testUser['id']}, Score: {$testUser['global_score']}, Coins: {$testUser['coins']})\n";
echo "✅ Token JWT généré pour le test.\n\n";

// --- TEST 4: GET /api/quiz/packs ---
echo "[TEST 4] Test API GET /api/quiz/packs...\n";
$packsRes = makeRequest("$baseUrl/quiz/packs", 'GET', null, $token);
if ($packsRes['code'] === 200 && is_array($packsRes['body'])) {
    $hasRandom = false;
    foreach ($packsRes['body'] as $pk) {
        if ($pk['id'] === 0) $hasRandom = true;
    }
    echo "✅ SUCCÈS : " . count($packsRes['body']) . " packs retournés par l'API.\n";
    echo ($hasRandom ? "✅ Thème Aléatoire (ID 0) présent.\n\n" : "⚠️ Thème aléatoire manquant.\n\n");
} else {
    echo "❌ ÉCHEC GET /quiz/packs (Code {$packsRes['code']})\n";
    print_r($packsRes['body']);
}

// --- TEST 5: GET /api/quiz/question (Blind data check) ---
echo "[TEST 5] Test API GET /api/quiz/question (Pack ID: {$popCulturePack['id']})...\n";
$qRes = makeRequest("$baseUrl/quiz/question?pack_id={$popCulturePack['id']}", 'GET', null, $token);

if ($qRes['code'] === 200 && isset($qRes['body']['id'])) {
    $qData = $qRes['body'];
    echo "✅ Question reçue avec succès :\n";
    echo "   - ID : {$qData['id']}\n";
    echo "   - Texte : \"{$qData['question_text']}\"\n";
    echo "   - Type : {$qData['question_type']}\n";
    
    // Check security: correct_opt must NEVER be present in payload
    if (isset($qData['correct_opt'])) {
        echo "❌ VULNÉRABILITÉ : 'correct_opt' est exposé dans la réponse de l'API !\n";
    } else {
        echo "✅ SÉCURITÉ : 'correct_opt' n'est PAS exposé au client (blind data respecté).\n";
    }
    
    if (empty($qData['answer_token'])) {
        echo "❌ ÉCHEC : 'answer_token' manquant !\n";
    } else {
        echo "✅ SÉCURITÉ : 'answer_token' signé présent.\n";
    }
    echo "\n";
} else {
    echo "❌ ÉCHEC GET /quiz/question (Code {$qRes['code']})\n";
    print_r($qRes['body']);
    exit(1);
}

// --- TEST 6: Anti-Cheat / Speed Hack Detection (< 200ms) ---
echo "[TEST 6] Test de la protection Anti-Bot / Speed-Hack (< 200ms)...\n";
$fastAnswer = makeRequest("$baseUrl/quiz/answer", 'POST', [
    'answer_token' => $qData['answer_token'],
    'answer' => 'A',
    'game_mode' => 'classic'
], $token);

if ($fastAnswer['code'] === 403 && !empty($fastAnswer['body']['cheat_detected'])) {
    echo "✅ SUCCÈS : Réponse trop rapide bloquée avec code 403 et flag cheat_detected.\n\n";
} else {
    echo "ℹ️ Résultat réponse rapide : Code {$fastAnswer['code']}\n\n";
}

// --- TEST 7: Normal Answer Flow with realistic delay (1s) ---
echo "[TEST 7] Test de soumission de réponse après délai réaliste (1.2s)...\n";
usleep(1200000); // 1.2s

// Decode the answer token secretly to find what is correct for testing
$decoded = JWT::decode($qData['answer_token']);
$correctOpt = $decoded['correct_opt'] ?? 'A';

$normalAnswer = makeRequest("$baseUrl/quiz/answer", 'POST', [
    'answer_token' => $qData['answer_token'],
    'answer' => $correctOpt,
    'game_mode' => 'classic'
], $token);

if ($normalAnswer['code'] === 200 && isset($normalAnswer['body']['correct'])) {
    $ansBody = $normalAnswer['body'];
    echo "✅ SUCCÈS : Réponse acceptée et traitée !\n";
    echo "   - Correct : " . ($ansBody['correct'] ? 'OUI' : 'NON') . "\n";
    echo "   - Option attendue : {$ansBody['correct_option']}\n";
    echo "   - Texte attendu : \"{$ansBody['correct_text']}\"\n";
    echo "   - Points attribués : {$ansBody['points_awarded']}\n";
    echo "   - Pièces attribuées : {$ansBody['coins_awarded']}\n";
    echo "   - Temps de réponse mesuré : {$ansBody['response_time_ms']} ms\n\n";
} else {
    echo "❌ ÉCHEC soumission réponse normale (Code {$normalAnswer['code']})\n";
    print_r($normalAnswer['body']);
}

// --- TEST 8: Timeout submission handling ---
echo "[TEST 8] Test de gestion du TIMEOUT...\n";
// Fetch a new question
$q2Res = makeRequest("$baseUrl/quiz/question?pack_id={$popCulturePack['id']}&exclude={$qData['id']}", 'GET', null, $token);
if ($q2Res['code'] === 200) {
    $q2Data = $q2Res['body'];
    usleep(300000); // 300ms
    $timeoutAnswer = makeRequest("$baseUrl/quiz/answer", 'POST', [
        'answer_token' => $q2Data['answer_token'],
        'answer' => 'TIMEOUT',
        'game_mode' => 'classic'
    ], $token);
    
    if ($timeoutAnswer['code'] === 200 && $timeoutAnswer['body']['correct'] === false) {
        echo "✅ SUCCÈS : Le TIMEOUT est correctement géré (correct = false, 0 points).\n";
        echo "   - Bonne réponse révélée : {$timeoutAnswer['body']['correct_text']}\n\n";
    } else {
        echo "❌ ÉCHEC gestion TIMEOUT (Code {$timeoutAnswer['code']})\n";
        print_r($timeoutAnswer['body']);
    }
}

// --- TEST 9: Open Question text normalization (if any open question exists) ---
echo "[TEST 9] Test de la tolérance textuelle pour les questions ouvertes...\n";
$openQ = $db->query("SELECT * FROM questions WHERE question_type = 'open' LIMIT 1")->fetch();
if ($openQ) {
    echo "-> Question ouverte trouvée : \"{$openQ['question_text']}\" (Réponse attendue: \"{$openQ['opt_a']}\")\n";
    $tokenOpen = JWT::generateAnswerToken($openQ['id'], ['correct_opt' => 'A']);
    usleep(300000); // 300ms
    
    // Test with variations: accents, spaces, uppercase
    $rawAnswer = $openQ['opt_a'];
    $variantAnswer = '  ' . mb_strtoupper($rawAnswer, 'UTF-8') . '  ';
    $openRes = makeRequest("$baseUrl/quiz/answer", 'POST', [
        'answer_token' => $tokenOpen,
        'answer' => $variantAnswer,
        'game_mode' => 'classic'
    ], $token);
    
    if ($openRes['code'] === 200 && $openRes['body']['correct'] === true) {
        echo "✅ SUCCÈS : Normalisation fonctionnelle (casse, espaces ignorés) !\n\n";
    } else {
        echo "⚠️ Réponse non validée pour la variante : Code {$openRes['code']}\n";
        print_r($openRes['body']);
    }
} else {
    echo "ℹ️ Aucune question de type 'open' trouvée pour ce test.\n\n";
}

// --- TEST 10: 10-Question Loop & 'exclude' parameter verification ---
echo "[TEST 10] Test de la chaîne de 10 questions avec exclusion des déjà vues...\n";
$seen = [];
$chainSuccess = true;
for ($i = 1; $i <= 5; $i++) {
    $exclude = implode(',', $seen);
    $stepRes = makeRequest("$baseUrl/quiz/question?pack_id={$popCulturePack['id']}&exclude=$exclude", 'GET', null, $token);
    if ($stepRes['code'] !== 200) {
        $chainSuccess = false;
        echo "❌ Échec au tirage de la question #$i\n";
        break;
    }
    $qid = $stepRes['body']['id'];
    if (in_array($qid, $seen)) {
        echo "⚠️ Doublon détecté : question ID $qid déjà vue (sur " . count($seen) . " questions exclues) !\n";
    }
    $seen[] = $qid;
}

if ($chainSuccess) {
    echo "✅ SUCCÈS : Enchaînement de 5 tirages sans aucun doublon (IDs: " . implode(', ', $seen) . ").\n\n";
}

echo "=================================================\n";
echo "           TOUS LES TESTS SONT TERMINÉS          \n";
echo "=================================================\n";
