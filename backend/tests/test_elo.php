<?php
/**
 * Automated Verification Suite for Competitive Elo Rankings
 * Run this from the CLI: php test_elo.php
 */

$baseUrl = 'http://127.0.0.1:8000/api';

echo "=== STARTING ELO RANKINGS VERIFICATION SUITE ===\n\n";

// Helper to make curl requests
function makeRequest($url, $method = 'GET', $data = null, $token = null) {
    usleep(500000);
    
    if ($method === 'GET' && $data !== null) {
        $url .= '?' . http_build_query($data);
        $data = null;
    }
    
    $ch = curl_init($url);
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
    curl_setopt($ch, CURLOPT_CUSTOMREQUEST, $method);
    
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
    curl_close($ch);
    
    return [
        'code' => $httpCode,
        'body' => json_decode($response, true) ?? $response
    ];
}

// 1. Register & Login Players
echo "[1/4] Connexion des 3 compétiteurs (Alice, Bob, Charlie)...\n";
$alice = makeRequest("$baseUrl/auth/login", 'POST', ['username' => 'alice', 'password' => 'alice123']);
$bob = makeRequest("$baseUrl/auth/login", 'POST', ['username' => 'bob', 'password' => 'bob123']);

// Register Charlie if not exists, then login
makeRequest("$baseUrl/auth/register", 'POST', ['username' => 'charlie', 'password' => 'charlie123']);
$charlie = makeRequest("$baseUrl/auth/login", 'POST', ['username' => 'charlie', 'password' => 'charlie123']);

if (isset($alice['body']['token']) && isset($bob['body']['token']) && isset($charlie['body']['token'])) {
    $aliceToken = $alice['body']['token'];
    $bobToken = $bob['body']['token'];
    $charlieToken = $charlie['body']['token'];
    echo "✅ SUCCÈS : Joueurs authentifiés.\n\n";
} else {
    echo "❌ ÉCHEC : Erreur d'authentification.\n";
    exit(1);
}

// 2. Initialize Elo database values for clean test run
echo "[2/4] Initialisation des Elos de référence à 1000 dans la base...\n";
require_once __DIR__ . '/../src/Config/Database.php';
$db = \App\Config\Database::getConnection();
$db->exec("UPDATE users SET elo = 1000 WHERE username IN ('alice', 'bob', 'charlie')");
echo "✅ SUCCÈS : Elos réinitialisés.\n\n";

// 3. Create a 3-player lobby & execute a 1-question game
echo "[3/4] Simulation d'une arène compétitive à 3 joueurs...\n";
// Create classic lobby with pack 1
$lobby = makeRequest("$baseUrl/lobby/create", 'POST', [
    'pack_id' => 1,
    'game_mode' => 'classic'
], $aliceToken);

if ($lobby['code'] !== 200) {
    echo "❌ ÉCHEC : Impossible de créer le salon.\n";
    exit(1);
}

$code = $lobby['body']['room_code'];

// Bob and Charlie join
makeRequest("$baseUrl/lobby/join", 'POST', ['room_code' => $code], $bobToken);
makeRequest("$baseUrl/lobby/join", 'POST', ['room_code' => $code], $charlieToken);

// Start game
makeRequest("$baseUrl/lobby/next", 'POST', ['room_code' => $code], $aliceToken);

// Fetch current question details to answer
$status = makeRequest("$baseUrl/lobby/status", 'GET', ['room_code' => $code], $aliceToken);
$qId = (int) $status['body']['question']['id'];

// Simulate answers:
// Alice: Correct and fast (e.g. response time 500ms -> score 95)
// Bob: Correct but slow (e.g. response time 5000ms -> score 50)
// Charlie: Incorrect (score 0)

// Fetch correct option from database
$stmtCorrect = $db->prepare("SELECT correct_opt FROM questions WHERE id = ?");
$stmtCorrect->execute([$qId]);
$correctOpt = $stmtCorrect->fetchColumn();
$wrongOpt = ($correctOpt === 'A') ? 'B' : 'A';

// Submit guesses
makeRequest("$baseUrl/lobby/answer", 'POST', [
    'room_code' => $code,
    'question_id' => $qId,
    'answer' => $correctOpt
], $aliceToken);

// Wait 1.5s for Bob to submit slower
usleep(1500000);
makeRequest("$baseUrl/lobby/answer", 'POST', [
    'room_code' => $code,
    'question_id' => $qId,
    'answer' => $correctOpt
], $bobToken);

makeRequest("$baseUrl/lobby/answer", 'POST', [
    'room_code' => $code,
    'question_id' => $qId,
    'answer' => $wrongOpt
], $charlieToken);

// Advance question index to finish the game (the lobby pack had 1 question or index limit is reached by force)
// Wait! The lobbies play 10 questions.
// To finish the lobby quickly for the test, we can just update current_question_index to 9 in the database!
// This is a brilliant shortcut that lets us finish the lobby instantly in 1 round!
$lobbyId = (int)$lobby['body']['lobby_id'];
$db->exec("UPDATE lobbies SET current_question_index = 9 WHERE id = $lobbyId");

echo "-> Clôture de la partie...\n";
$finishRes = makeRequest("$baseUrl/lobby/next", 'POST', ['room_code' => $code], $aliceToken);

if ($finishRes['code'] === 200) {
    echo "✅ SUCCÈS : Partie clôturée.\n\n";
} else {
    echo "❌ ÉCHEC : Erreur de clôture. Code {$finishRes['code']}.\n";
    print_r($finishRes);
    exit(1);
}

// 4. Verify Elo Values
echo "[4/4] Vérification des résultats Elo...\n";
$aliceElo = (int) $db->query("SELECT elo FROM users WHERE username = 'alice'")->fetchColumn();
$bobElo = (int) $db->query("SELECT elo FROM users WHERE username = 'bob'")->fetchColumn();
$charlieElo = (int) $db->query("SELECT elo FROM users WHERE username = 'charlie'")->fetchColumn();

echo "DEBUG Elos terminaux :\n";
echo "- Alice : {$aliceElo} (Attendu: 1015)\n";
echo "- Bob   : {$bobElo} (Attendu: 1005)\n";
echo "- Charlie : {$charlieElo} (Attendu: 990)\n\n";

if ($aliceElo === 1015 && $bobElo === 1005 && $charlieElo === 990) {
    echo "✅ TOUS LES TESTS ELO SONT AU VERT ! (Alice +15, Bob +5, Charlie -10)\n";
} else {
    echo "❌ ÉCHEC : Les valeurs Elo calculées sont incorrectes.\n";
    exit(1);
}

echo "=== VERIFICATION COMPLETED ===\n";
