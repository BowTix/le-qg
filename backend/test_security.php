<?php
/**
 * Automated Security & Anti-Cheat Verification Suite
 * Run this from the CLI: php test_security.php
 */

$baseUrl = 'http://127.0.0.1:8000/api';

echo "=== STARTING SECURITY VERIFICATION SUITE ===\n\n";

// Helper to make curl requests
function makeRequest($url, $method = 'GET', $data = null, $token = null) {
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

// 1. Test Unauthenticated Access
echo "[1/4] Test de l'accès non authentifié aux questions...\n";
$res = makeRequest("$baseUrl/quiz/question?pack_id=1");
if ($res['code'] === 401) {
    echo "✅ SUCCÈS : L'accès non authentifié a été rejeté (Code 401).\n\n";
} else {
    echo "❌ ÉCHEC : Attendu 401, obtenu {$res['code']}.\n\n";
}

// 2. Perform Login to obtain JWT
echo "[2/4] Authentification avec l'utilisateur 'alice'...\n";
$loginRes = makeRequest("$baseUrl/auth/login", 'POST', [
    'username' => 'alice',
    'password' => 'alice123'
]);

if ($loginRes['code'] === 200 && isset($loginRes['body']['token'])) {
    $token = $loginRes['body']['token'];
    echo "✅ SUCCÈS : Token JWT récupéré avec succès.\n\n";
} else {
    echo "❌ ÉCHEC : Impossible de s'authentifier. Code {$loginRes['code']}.\n";
    print_r($loginRes['body']);
    exit(1);
}

// 3. Test Time Validation (Anti-Cheat)
echo "[3/4] Test de la protection anti-triche temporelle (Anti-Bot)...\n";
echo "-> Récupération d'une question en cours...\n";
$questionRes = makeRequest("$baseUrl/quiz/question?pack_id=1", 'GET', null, $token);

if ($questionRes['code'] === 200 && isset($questionRes['body']['answer_token'])) {
    $answerToken = $questionRes['body']['answer_token'];
    $questionId = $questionRes['body']['id'];
    echo "-> Question récupérée. Token de réponse reçu.\n";
    
    // Test 3a: Instant Submission (< 200ms)
    echo "-> Soumission INSTANTANÉE (< 50ms) d'une réponse pour simuler un script de triche...\n";
    $cheatRes = makeRequest("$baseUrl/quiz/answer", 'POST', [
        'answer_token' => $answerToken,
        'answer' => 'C'
    ], $token);
    
    if ($cheatRes['code'] === 403 && isset($cheatRes['body']['cheat_detected'])) {
        echo "✅ SUCCÈS : Tentative instantanée rejetée par le serveur ! (Code 403, Tricherie détectée).\n";
        echo "   Message serveur : \"" . $cheatRes['body']['error'] . "\"\n";
    } else {
        echo "❌ ÉCHEC : La réponse instantanée n'a pas été bloquée. Code {$cheatRes['code']}.\n";
        print_r($cheatRes['body']);
    }
    
    // Test 3b: Valid Submission (Wait 500ms)
    echo "\n-> Attente de 500ms (délai humain valide)...\n";
    usleep(500000); // 500ms
    
    echo "-> Soumission d'une réponse valide après attente...\n";
    $validRes = makeRequest("$baseUrl/quiz/answer", 'POST', [
        'answer_token' => $answerToken,
        'answer' => 'C'
    ], $token);
    
    if ($validRes['code'] === 200) {
        echo "✅ SUCCÈS : Réponse acceptée et validée par le serveur ! (Code 200).\n";
        echo "   Résultat : " . ($validRes['body']['correct'] ? "Correct" : "Incorrect") . " | Points attribués : " . $validRes['body']['points_awarded'] . "\n\n";
    } else {
        echo "❌ ÉCHEC : La réponse valide a été rejetée. Code {$validRes['code']}.\n";
        print_r($validRes['body']);
    }
} else {
    echo "❌ ÉCHEC : Impossible de récupérer une question. Code {$questionRes['code']}.\n";
    print_r($questionRes['body']);
}

// 4. Test Rate Limiter
echo "[4/4] Test du Rate Limiter (Max 5 requêtes/seconde)...\n";
echo "-> Envoi rapide de 7 requêtes consécutives...\n";
$rateLimitBlocked = false;
$successCount = 0;
$blockedCount = 0;

for ($i = 0; $i < 7; $i++) {
    $r = makeRequest("$baseUrl/quiz/packs", 'GET', null, $token);
    if ($r['code'] === 429) {
        $rateLimitBlocked = true;
        $blockedCount++;
    } elseif ($r['code'] === 200) {
        $successCount++;
    }
}

if ($rateLimitBlocked) {
    echo "✅ SUCCÈS : Rate limiter activé ! Reçu $blockedCount rejets de type 429 (Too Many Requests).\n";
    echo "   ($successCount requêtes autorisées, $blockedCount requêtes bloquées).\n";
} else {
    echo "❌ ÉCHEC : Aucune requête n'a été bloquée par le Rate Limiter sur les 7 envois.\n";
}

echo "\n=== FIN DES TESTS DE SÉCURITÉ ===\n";
