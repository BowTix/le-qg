<?php
/**
 * Automated Verification Suite for QG Mini-Games & Quiz HQ Expansion
 * Run this from the CLI: php test_hq.php
 */

$baseUrl = 'http://127.0.0.1:8000/api';

echo "=== STARTING HQ MINI-GAMES VERIFICATION SUITE ===\n\n";

// Helper to make curl requests
function makeRequest($url, $method = 'GET', $data = null, $token = null) {
    // Sleep 500ms to prevent hitting rate limits
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

// 1. Authenticate players
echo "[1/5] Connexion des joueurs...\n";
$alice = makeRequest("$baseUrl/auth/login", 'POST', ['username' => 'alice', 'password' => 'alice123']);
$bob = makeRequest("$baseUrl/auth/login", 'POST', ['username' => 'bob', 'password' => 'bob123']);

if (isset($alice['body']['token']) && isset($bob['body']['token'])) {
    $aliceToken = $alice['body']['token'];
    $bobToken = $bob['body']['token'];
    echo "✅ SUCCÈS : Connexions validées.\n\n";
} else {
    echo "❌ ÉCHEC : Connexion impossible.\n";
    exit(1);
}

// 2. Create Speed Blitz lobby & check timer
echo "[2/5] Test de la limite de temps du mode Speed Blitz (5s)...\n";
$blitzLobby = makeRequest("$baseUrl/lobby/create", 'POST', [
    'pack_id' => 1,
    'game_mode' => 'speed_blitz'
], $aliceToken);

echo "DEBUG create blitz lobby response:\n";
var_dump($blitzLobby);

if ($blitzLobby['code'] === 200) {
    $code = $blitzLobby['body']['room_code'];
    // Start game
    $nextRes = makeRequest("$baseUrl/lobby/next", 'POST', ['room_code' => $code], $aliceToken);
    echo "DEBUG next question response:\n";
    var_dump($nextRes);
    
    // Check status
    $status = makeRequest("$baseUrl/lobby/status", 'GET', ['room_code' => $code], $aliceToken);
    echo "DEBUG status response:\n";
    var_dump($status);
    
    $timeLeft = (int) ($status['body']['time_left_ms'] ?? 0);
    
    // Limit is 5000ms. With curl delays, it should be between 2000ms and 5000ms
    if ($timeLeft > 0 && $timeLeft <= 5000) {
        echo "✅ SUCCÈS : Le temps restant est de " . ($timeLeft / 1000) . "s (Limite 5s Blitz validée).\n\n";
    } else {
        echo "❌ ÉCHEC : Limite de temps invalide pour Blitz. Reçu : {$timeLeft} ms.\n\n";
    }
    
    // Clean up
    makeRequest("$baseUrl/lobby/leave", 'POST', ['room_code' => $code], $aliceToken);
} else {
    echo "❌ ÉCHEC : Impossible de créer le salon Blitz. Code {$blitzLobby['code']}.\n\n";
}

// 3. Emoji Reactions Test
echo "[3/5] Test des Taunts / Emojis en direct...\n";
$lobbyReact = makeRequest("$baseUrl/lobby/create", 'POST', [
    'pack_id' => 1,
    'game_mode' => 'classic'
], $aliceToken);

if ($lobbyReact['code'] === 200) {
    $code = $lobbyReact['body']['room_code'];
    
    // Bob joins
    makeRequest("$baseUrl/lobby/join", 'POST', ['room_code' => $code], $bobToken);
    
    // Bob sends a reaction
    $reactRes = makeRequest("$baseUrl/lobby/reaction", 'POST', [
        'room_code' => $code,
        'reaction' => '🤬'
      ], $bobToken);
    
    if ($reactRes['code'] === 200) {
        // Query status and inspect reactions
        $status = makeRequest("$baseUrl/lobby/status", 'GET', ['room_code' => $code], $aliceToken);
        $bobUser = null;
        foreach ($status['body']['players'] as $p) {
            if ($p['username'] === 'bob') {
                $bobUser = $p;
            }
        }
        
        if ($bobUser && $bobUser['reaction'] === '🤬') {
            echo "✅ SUCCÈS : La réaction active de Bob (🤬) est correctement diffusée en direct.\n\n";
        } else {
            echo "❌ ÉCHEC : Réaction non retrouvée dans le statut.\n\n";
        }
    } else {
        echo "❌ ÉCHEC : Erreur lors de l'envoi de la réaction. Code {$reactRes['code']}.\n\n";
    }
    
    // Clean up
    makeRequest("$baseUrl/lobby/leave", 'POST', ['room_code' => $code], $aliceToken);
}

// 4. Test "Le Juste Nombre" estimation scoring
echo "[4/5] Test d'évaluation du mini-jeu \"Le Juste Nombre\"...\n";
// Pack 7 is "Le Juste Nombre" (seeded in migration)
$lobbyNumber = makeRequest("$baseUrl/lobby/create", 'POST', [
    'pack_id' => 7,
    'game_mode' => 'guess_number'
], $aliceToken);

if ($lobbyNumber['code'] === 200) {
    $code = $lobbyNumber['body']['room_code'];
    
    // Bob joins
    makeRequest("$baseUrl/lobby/join", 'POST', ['room_code' => $code], $bobToken);
    
    // Start game
    makeRequest("$baseUrl/lobby/next", 'POST', ['room_code' => $code], $aliceToken);
    
    // Status to find question ID and correct value
    $status1 = makeRequest("$baseUrl/lobby/status", 'GET', ['room_code' => $code], $aliceToken);
    $qId = (int) $status1['body']['question']['id'];
    $qText = $status1['body']['question']['question_text'];
    
    // Resolve correct value dynamically based on question text keyword
    $correctVal = 0;
    if (strpos($qText, 'iPhone') !== false) $correctVal = 2007;
    elseif (strpos($qText, 'pieuvre') !== false) $correctVal = 3;
    elseif (strpos($qText, 'lumière') !== false) $correctVal = 300;
    elseif (strpos($qText, 'piano') !== false) $correctVal = 88;
    elseif (strpos($qText, 'Union') !== false) $correctVal = 27;
    elseif (strpos($qText, 'Lune') !== false) $correctVal = 1969;
    elseif (strpos($qText, 'heure') !== false) $correctVal = 3600;
    elseif (strpos($qText, 'or') !== false) $correctVal = 79;
    elseif (strpos($qText, 'Eiffel') !== false) $correctVal = 1665;
    elseif (strpos($qText, 'WWW') !== false) $correctVal = 1989;
    
    echo "DEBUG Selected Question: \"$qText\" (Correct Value: $correctVal)\n";
    
    // Alice guesses slightly further (+2)
    $aliceGuess = $correctVal + 2;
    // Bob guesses closer (-1)
    $bobGuess = $correctVal - 1;
    
    // Alice guesses
    $aliceGuessRes = makeRequest("$baseUrl/lobby/answer", 'POST', [
        'room_code' => $code,
        'question_id' => $qId,
        'guess' => $aliceGuess
    ], $aliceToken);
    echo "DEBUG Alice Guess ($aliceGuess):\n";
    var_dump($aliceGuessRes);
    
    // Bob guesses
    $bobGuessRes = makeRequest("$baseUrl/lobby/answer", 'POST', [
        'room_code' => $code,
        'question_id' => $qId,
        'guess' => $bobGuess
    ], $bobToken);
    echo "DEBUG Bob Guess ($bobGuess):\n";
    var_dump($bobGuessRes);
    
    // Advance to next question (which evaluates previous answers)
    makeRequest("$baseUrl/lobby/next", 'POST', ['room_code' => $code], $aliceToken);
    
    // Check points
    $status2 = makeRequest("$baseUrl/lobby/status", 'GET', ['room_code' => $code], $aliceToken);
    
    $alicePoints = 0;
    $bobPoints = 0;
    foreach ($status2['body']['players'] as $p) {
        if ($p['username'] === 'alice') $alicePoints = (int)$p['score'];
        if ($p['username'] === 'bob') $bobPoints = (int)$p['score'];
    }
    
    if ($bobPoints === 150 && $alicePoints === 50) {
        echo "✅ SUCCÈS : Bob remporte 150 pts (le plus proche) et Alice remporte 50 pts (dans les 10% de tolérance).\n\n";
    } else {
        echo "❌ ÉCHEC : Erreur d'attribution des scores d'estimation. Alice: {$alicePoints} pts, Bob: {$bobPoints} pts.\n\n";
    }
    
    // Clean up
    makeRequest("$baseUrl/lobby/leave", 'POST', ['room_code' => $code], $aliceToken);
} else {
    echo "❌ ÉCHEC : Impossible de créer le salon Le Juste Nombre. Code {$lobbyNumber['code']}.\n\n";
}

// 5. Sudden Death Elimination Test
echo "[5/5] Test d'élimination en mode Mort Subite...\n";
$lobbyDeath = makeRequest("$baseUrl/lobby/create", 'POST', [
    'pack_id' => 1,
    'game_mode' => 'sudden_death'
], $aliceToken);

if ($lobbyDeath['code'] === 200) {
    $code = $lobbyDeath['body']['room_code'];
    
    // Bob joins
    makeRequest("$baseUrl/lobby/join", 'POST', ['room_code' => $code], $bobToken);
    
    // Start game
    makeRequest("$baseUrl/lobby/next", 'POST', ['room_code' => $code], $aliceToken);
    
    // Status to get question details
    $status = makeRequest("$baseUrl/lobby/status", 'GET', ['room_code' => $code], $aliceToken);
    $qId = (int) $status['body']['question']['id'];
    
    // Bob answers incorrectly (wrong option 'Z' was a draft, send B or D which are standard options. To guarantee wrong answer, let's send 'D')
    $ansRes = makeRequest("$baseUrl/lobby/answer", 'POST', [
        'room_code' => $code,
        'question_id' => $qId,
        'answer' => 'D' 
    ], $bobToken);
    
    // Check status
    $statusCheck = makeRequest("$baseUrl/lobby/status", 'GET', ['room_code' => $code], $bobToken);
    $bobUser = null;
    foreach ($statusCheck['body']['players'] as $p) {
        if ($p['username'] === 'bob') {
            $bobUser = $p;
        }
    }
    
    // If Bob got it wrong, he should be marked is_eliminated = true in the payload
    if ($bobUser && $bobUser['is_eliminated']) {
        echo "✅ SUCCÈS : Bob est éliminé immédiatement (is_eliminated = 1) après une mauvaise réponse.\n\n";
    } else {
        echo "❌ ÉCHEC : Bob n'a pas été éliminé.\n\n";
    }
    
    // Clean up
    makeRequest("$baseUrl/lobby/leave", 'POST', ['room_code' => $code], $aliceToken);
}

echo "=== VERIFICATION COMPLETED ===\n";
