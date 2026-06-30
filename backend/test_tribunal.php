<?php
/**
 * Self-contained integration test for the new "Le Tribunal" multiplayer game mode.
 * Run: php test_tribunal.php
 */

$port = 8099;
$baseUrl = "http://127.0.0.1:$port/api";

echo "=== STARTING LE TRIBUNAL INTEGRATION TEST ===\n";

// 1. Start a temporary PHP server
echo "-> Starting temporary PHP server on port $port...\n";
$serverCmd = "php -S 127.0.0.1:$port -t public";
$descriptorspec = [
    0 => ["pipe", "r"],
    1 => ["pipe", "w"],
    2 => ["pipe", "w"]
];
$serverProcess = proc_open($serverCmd, $descriptorspec, $pipes);

if (!is_resource($serverProcess)) {
    echo "❌ Failed to start PHP server.\n";
    exit(1);
}

// Give the server a moment to boot
usleep(500000);

function req($url, $method = 'GET', $data = null, $token = null) {
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

try {
    // 2. Register/Login Alice and Bob
    echo "-> Registering/Logging in test players...\n";
    req("$baseUrl/auth/register", 'POST', ['username' => 'alice', 'password' => 'alice123']);
    req("$baseUrl/auth/register", 'POST', ['username' => 'bob', 'password' => 'bob123']);

    $loginAlice = req("$baseUrl/auth/login", 'POST', ['username' => 'alice', 'password' => 'alice123']);
    $loginBob = req("$baseUrl/auth/login", 'POST', ['username' => 'bob', 'password' => 'bob123']);

    if (!isset($loginAlice['body']['token']) || !isset($loginBob['body']['token'])) {
        throw new Exception("Authentication failed. " . json_encode(['alice' => $loginAlice, 'bob' => $loginBob]));
    }

    $tokenAlice = $loginAlice['body']['token'];
    $tokenBob = $loginBob['body']['token'];
    $aliceId = intval($loginAlice['body']['user']['id'] ?? 0);
    $bobId = intval($loginBob['body']['user']['id'] ?? 0);

    echo "✅ Authenticated. Alice ID: $aliceId, Bob ID: $bobId\n";

    // 3. Create a Tribunal Lobby
    echo "-> Creating a Le Tribunal lobby...\n";
    $createRes = req("$baseUrl/lobby/create", 'POST', ['pack_id' => 5, 'game_mode' => 'tribunal'], $tokenAlice);
    if ($createRes['code'] !== 200 || !isset($createRes['body']['room_code'])) {
        throw new Exception("Lobby creation failed: " . json_encode($createRes));
    }
    $roomCode = $createRes['body']['room_code'];
    echo "✅ Lobby created with Room Code: $roomCode\n";

    // 4. Bob joins the lobby
    echo "-> Bob joining lobby...\n";
    $joinRes = req("$baseUrl/lobby/join", 'POST', ['room_code' => $roomCode], $tokenBob);
    if ($joinRes['code'] !== 200) {
        throw new Exception("Bob failed to join lobby: " . json_encode($joinRes));
    }
    echo "✅ Bob joined successfully.\n";

    // 5. Start the game (Alice host)
    echo "-> Starting game...\n";
    $startRes = req("$baseUrl/lobby/start", 'POST', ['room_code' => $roomCode], $tokenAlice);
    if ($startRes['code'] !== 200 || !$startRes['body']['success']) {
        throw new Exception("Game failed to start: " . json_encode($startRes));
    }
    echo "✅ Game start initiated.\n";

    // Wait for countdown
    echo "⏳ Waiting for countdown (4s)...\n";
    sleep(4);

    // 6. Loop and submit answers for all 5 rounds of writing
    for ($r = 0; $r < 5; $r++) {
        echo "-> [Round $r] Checking status (should be in writing phase)...\n";
        $statusRes = req("$baseUrl/lobby/status", 'GET', ['room_code' => $roomCode], $tokenAlice);
        if ($statusRes['code'] !== 200 || $statusRes['body']['status'] !== 'playing') {
            throw new Exception("Lobby is not in playing status: " . json_encode($statusRes));
        }
        $tribunal = $statusRes['body']['tribunal'] ?? null;
        if (!$tribunal || $tribunal['phase'] !== 'writing' || intval($tribunal['round']) !== $r) {
            throw new Exception("Lobby is not in writing phase for round $r: " . json_encode($statusRes));
        }
        echo "✅ Lobby in writing phase for round $r. Dilemma: \"{$tribunal['prompt_text']}\"\n";

        echo "-> Alice submits answer for round $r...\n";
        $subAlice = req("$baseUrl/lobby/tribunal/submit", 'POST', ['room_code' => $roomCode, 'answer' => "Alice's hilarious response $r"], $tokenAlice);
        if ($subAlice['code'] !== 200 || !$subAlice['body']['success']) {
            throw new Exception("Alice answer submission failed: " . json_encode($subAlice));
        }

        echo "-> Bob submits answer for round $r...\n";
        $subBob = req("$baseUrl/lobby/tribunal/submit", 'POST', ['room_code' => $roomCode, 'answer' => "Bob's witty response $r"], $tokenBob);
        if ($subBob['code'] !== 200 || !$subBob['body']['success']) {
            throw new Exception("Bob answer submission failed: " . json_encode($subBob));
        }
        echo "✅ Answers for round $r submitted.\n";

        // Trigger transition status check
        req("$baseUrl/lobby/status", 'GET', ['room_code' => $roomCode], $tokenAlice);
    }

    // 7. After 5 writing rounds, should transition to voting phase for round 0
    echo "-> Checking status, should trigger transition to voting for round 0...\n";
    $statusRes = req("$baseUrl/lobby/status", 'GET', ['room_code' => $roomCode], $tokenAlice);
    $tribunal = $statusRes['body']['tribunal'] ?? null;
    if (!$tribunal || $tribunal['phase'] !== 'voting' || intval($tribunal['round']) !== 0) {
        throw new Exception("Lobby did not transition to voting phase for round 0: " . json_encode($statusRes));
    }
    echo "✅ Lobby transitioned to voting phase for round 0. Submissions:\n";
    foreach ($tribunal['submissions'] as $sub) {
        echo "   - [ID: {$sub['id']}] \"{$sub['answer_text']}\" (is_mine: " . ($sub['is_mine'] ? 'yes' : 'no') . ")\n";
    }

    // Identify Bob's submission and Alice's submission IDs
    $aliceSubId = null;
    $bobSubId = null;
    foreach ($tribunal['submissions'] as $sub) {
        if ($sub['is_mine']) {
            $aliceSubId = $sub['id']; // Since Alice fetched status
        } else {
            $bobSubId = $sub['id'];
        }
    }

    // Bob fetches status to get the IDs for him
    $statusResBob = req("$baseUrl/lobby/status", 'GET', ['room_code' => $roomCode], $tokenBob);
    $bobSubmissions = $statusResBob['body']['tribunal']['submissions'];
    $aliceSubIdForBob = null;
    foreach ($bobSubmissions as $sub) {
        if (!$sub['is_mine']) {
            $aliceSubIdForBob = $sub['id'];
        }
    }

    // 8. Submit votes for round 0 (Alice votes for Bob's submission, Bob votes for Alice's submission)
    echo "-> Alice votes for Bob's answer...\n";
    $voteAlice = req("$baseUrl/lobby/tribunal/vote", 'POST', ['room_code' => $roomCode, 'submission_id' => $bobSubId], $tokenAlice);
    if ($voteAlice['code'] !== 200) {
        throw new Exception("Alice vote failed: " . json_encode($voteAlice));
    }

    echo "-> Bob votes for Alice's answer...\n";
    $voteBob = req("$baseUrl/lobby/tribunal/vote", 'POST', ['room_code' => $roomCode, 'submission_id' => $aliceSubIdForBob], $tokenBob);
    if ($voteBob['code'] !== 200) {
        throw new Exception("Bob vote failed: " . json_encode($voteBob));
    }
    echo "✅ Votes cast successfully.\n";

    // 9. Fetch status again, should trigger transition to results phase for round 0
    echo "-> Checking status to trigger transition to results for round 0...\n";
    $statusRes = req("$baseUrl/lobby/status", 'GET', ['room_code' => $roomCode], $tokenAlice);
    $tribunal = $statusRes['body']['tribunal'] ?? null;
    if (!$tribunal || $tribunal['phase'] !== 'results' || intval($tribunal['round']) !== 0) {
        throw new Exception("Lobby did not transition to results phase: " . json_encode($statusRes));
    }
    echo "✅ Lobby transitioned to results phase for round 0. Results:\n";
    foreach ($tribunal['submissions'] as $sub) {
        echo "   - Auteur: {$sub['author_username']}, Answer: \"{$sub['answer_text']}\", Votes: {$sub['vote_count']} (Voté par: " . implode(', ', $sub['votes']) . ")\n";
    }

    // Check that scores were added (+100 XP/points for each player because each got 1 vote)
    $players = $statusRes['body']['players'];
    foreach ($players as $p) {
        echo "   - Joueur: {$p['username']}, Score: {$p['score']} pts\n";
        if ($p['score'] !== 100) {
            throw new Exception("Incorrect score for {$p['username']}: expected 100, got {$p['score']}");
        }
    }
    echo "✅ Points and scores verified successfully.\n";

    echo "\n🎉 ALL INTEGRATION TESTS PASSED SUCCESSFULLY! 🎉\n";

} catch (Exception $e) {
    echo "\n❌ TEST FAILED: " . $e->getMessage() . "\n";
} finally {
    // 11. Shutdown the temporary PHP server
    echo "-> Stopping temporary PHP server...\n";
    proc_terminate($serverProcess);
    proc_close($serverProcess);
}
