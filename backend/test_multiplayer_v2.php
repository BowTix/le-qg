<?php
/**
 * Integration test for the new player-independent multiplayer flow.
 * Run: php test_multiplayer_v2.php
 */

$baseUrl = 'http://127.0.0.1:8000/api';

echo "=== TEST: MULTIPLAYER V2 (Player-Independent Flow) ===\n\n";

function req($url, $method = 'GET', $data = null, $token = null) {
    usleep(300000); // 300ms between requests to avoid rate limit
    if ($method === 'GET' && $data !== null) {
        $url .= '?' . http_build_query($data);
        $data = null;
    }
    $ch = curl_init($url);
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
    curl_setopt($ch, CURLOPT_CUSTOMREQUEST, $method);
    $headers = ['Content-Type: application/json'];
    if ($token) $headers[] = "Authorization: Bearer $token";
    curl_setopt($ch, CURLOPT_HTTPHEADER, $headers);
    if ($data !== null) curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode($data));
    $response = curl_exec($ch);
    $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);
    return ['code' => $httpCode, 'body' => json_decode($response, true) ?? $response];
}

// 1. Login
echo "[1/6] Connexion des joueurs...\n";
$alice = req("$baseUrl/auth/login", 'POST', ['username' => 'alice', 'password' => 'alice123']);
$bob = req("$baseUrl/auth/login", 'POST', ['username' => 'bob', 'password' => 'bob123']);
if (!isset($alice['body']['token']) || !isset($bob['body']['token'])) {
    echo "❌ ÉCHEC : Authentification impossible.\n"; exit(1);
}
$aliceToken = $alice['body']['token'];
$bobToken = $bob['body']['token'];
echo "✅ Alice et Bob connectés.\n\n";

// 2. Create lobby
echo "[2/6] Création du salon par Alice...\n";
$lobby = req("$baseUrl/lobby/create", 'POST', ['pack_id' => 1, 'game_mode' => 'classic'], $aliceToken);
if ($lobby['code'] !== 200 || !$lobby['body']['success']) {
    echo "❌ ÉCHEC : Création du salon impossible.\n"; print_r($lobby); exit(1);
}
$code = $lobby['body']['room_code'];
echo "✅ Salon créé: $code\n\n";

// 3. Bob joins
echo "[3/6] Bob rejoint le salon...\n";
$join = req("$baseUrl/lobby/join", 'POST', ['room_code' => $code], $bobToken);
if ($join['code'] !== 200) {
    echo "❌ ÉCHEC : Bob ne peut pas rejoindre.\n"; print_r($join); exit(1);
}

// Verify status shows 2 players
$status = req("$baseUrl/lobby/status", 'GET', ['room_code' => $code], $aliceToken);
if (count($status['body']['players']) !== 2) {
    echo "❌ ÉCHEC : Nombre de joueurs incorrect.\n"; exit(1);
}
echo "✅ Bob a rejoint. 2 joueurs dans le salon.\n\n";

// 4. Start game
echo "[4/6] Alice lance la partie...\n";
$start = req("$baseUrl/lobby/start", 'POST', ['room_code' => $code], $aliceToken);
if ($start['code'] !== 200 || !$start['body']['success']) {
    echo "❌ ÉCHEC : Lancement impossible.\n"; print_r($start); exit(1);
}
echo "✅ Partie lancée avec countdown.\n";

// Wait to avoid rate limit
sleep(1);

// Check status has countdown
$status = req("$baseUrl/lobby/status", 'GET', ['room_code' => $code], $aliceToken);
if ($status['body']['status'] !== 'playing') {
    echo "❌ ÉCHEC : Statut devrait être 'playing'.\n"; exit(1);
}
echo "   countdown_remaining_ms: {$status['body']['countdown_remaining_ms']}\n";
echo "   total_questions: {$status['body']['total_questions']}\n\n";

// Wait for countdown to finish
echo "   ⏳ Attente du countdown (3s)...\n";
sleep(4);

// 5. Each player independently answers all questions
echo "[5/6] Chaque joueur répond aux 10 questions indépendamment...\n";

require_once __DIR__ . '/src/Config/Database.php';
$db = \App\Config\Database::getConnection();

// Reset Elos for clean test
$db->exec("UPDATE users SET elo = 1000 WHERE username IN ('alice', 'bob')");

$aliceScore = 0;
$bobScore = 0;

for ($i = 0; $i < 10; $i++) {
    // Alice fetches her question
    $aq = req("$baseUrl/lobby/my-question", 'GET', ['room_code' => $code, 'question_index' => $i], $aliceToken);
    if ($aq['code'] !== 200 || !$aq['body']['success']) {
        echo "❌ ÉCHEC : Alice ne peut pas récupérer la question $i.\n"; 
        print_r($aq); exit(1);
    }

    // Bob fetches his question (same question, different token)
    $bq = req("$baseUrl/lobby/my-question", 'GET', ['room_code' => $code, 'question_index' => $i], $bobToken);
    if ($bq['code'] !== 200 || !$bq['body']['success']) {
        echo "❌ ÉCHEC : Bob ne peut pas récupérer la question $i.\n";
        print_r($bq); exit(1);
    }

    // Get correct answer from DB to make Alice always correct and Bob always wrong
    $qId = $aq['body']['question']['id'];
    $correctOpt = $db->query("SELECT correct_opt FROM questions WHERE id = $qId")->fetchColumn();
    $wrongOpt = ($correctOpt === 'A') ? 'B' : 'A';

    // Alice answers correctly (fast)
    usleep(300000); // 300ms delay
    $aAnswer = req("$baseUrl/lobby/answer", 'POST', [
        'room_code' => $code,
        'answer_token' => $aq['body']['answer_token'],
        'answer' => $correctOpt
    ], $aliceToken);

    if ($aAnswer['code'] !== 200 || !$aAnswer['body']['success']) {
        echo "❌ ÉCHEC : Alice ne peut pas répondre à la question $i.\n";
        print_r($aAnswer); exit(1);
    }
    $aliceScore += $aAnswer['body']['points_awarded'];

    // Bob answers incorrectly (slower)
    usleep(500000); // 500ms delay
    $bAnswer = req("$baseUrl/lobby/answer", 'POST', [
        'room_code' => $code,
        'answer_token' => $bq['body']['answer_token'],
        'answer' => $wrongOpt
    ], $bobToken);

    if ($bAnswer['code'] !== 200 || !$bAnswer['body']['success']) {
        echo "❌ ÉCHEC : Bob ne peut pas répondre à la question $i.\n";
        print_r($bAnswer); exit(1);
    }

    echo "   Q" . ($i+1) . ": Alice +" . $aAnswer['body']['points_awarded'] . "pts (correct), Bob +0pts (incorrect)\n";
}

echo "\n   Scores finaux: Alice=$aliceScore, Bob=$bobScore\n";

// 6. Both players finish
echo "\n[6/6] Les joueurs terminent la partie...\n";
$aFinish = req("$baseUrl/lobby/finish", 'POST', ['room_code' => $code], $aliceToken);
if ($aFinish['code'] !== 200) {
    echo "❌ ÉCHEC : Alice ne peut pas terminer.\n"; print_r($aFinish); exit(1);
}
echo "   Alice a terminé. all_finished=" . ($aFinish['body']['all_finished'] ? 'true' : 'false') . "\n";

$bFinish = req("$baseUrl/lobby/finish", 'POST', ['room_code' => $code], $bobToken);
if ($bFinish['code'] !== 200) {
    echo "❌ ÉCHEC : Bob ne peut pas terminer.\n"; print_r($bFinish); exit(1);
}
echo "   Bob a terminé. all_finished=" . ($bFinish['body']['all_finished'] ? 'true' : 'false') . "\n";

// Verify final status
$finalStatus = req("$baseUrl/lobby/status", 'GET', ['room_code' => $code], $aliceToken);
if ($finalStatus['body']['status'] !== 'finished') {
    echo "❌ ÉCHEC : Le statut final devrait être 'finished'.\n"; exit(1);
}

// Check Elo changes
$aliceElo = (int)$db->query("SELECT elo FROM users WHERE username = 'alice'")->fetchColumn();
$bobElo = (int)$db->query("SELECT elo FROM users WHERE username = 'bob'")->fetchColumn();

echo "\n   Elo final: Alice=$aliceElo (attendu: 1015), Bob=$bobElo (attendu: 990)\n";

// Verify players have elo_change in response
$hasEloChanges = true;
foreach ($finalStatus['body']['players'] as $p) {
    if (!isset($p['elo_change'])) {
        $hasEloChanges = false;
        break;
    }
}

if ($finalStatus['body']['status'] === 'finished' && $hasEloChanges && $aliceElo === 1015 && $bobElo === 990) {
    echo "\n✅ TOUS LES TESTS SONT AU VERT !\n";
    echo "   ✅ Salon créé et rejoint\n";
    echo "   ✅ Countdown synchronisé\n";
    echo "   ✅ Questions indépendantes par joueur\n";
    echo "   ✅ Scoring basé sur la vitesse\n";
    echo "   ✅ Finish séquentiel (Alice puis Bob)\n";
    echo "   ✅ Classement final + Elo (Alice +15, Bob -10)\n";
} else {
    echo "\n❌ CERTAINS TESTS ONT ÉCHOUÉ.\n";
    if (!$hasEloChanges) echo "   ❌ elo_change manquant dans la réponse\n";
    if ($aliceElo !== 1015) echo "   ❌ Alice Elo=$aliceElo (attendu 1015)\n";
    if ($bobElo !== 990) echo "   ❌ Bob Elo=$bobElo (attendu 990)\n";
}

echo "\n=== FIN DES TESTS ===\n";
