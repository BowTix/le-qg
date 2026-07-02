<?php
/**
 * Automated Verification Suite for User Theme Creator & Admin Validation
 * Run this from the CLI: php test_validation.php
 */

$baseUrl = 'http://127.0.0.1:8000/api';

echo "=== STARTING THEME CREATOR & VALIDATION VERIFICATION SUITE ===\n\n";

// Helper to make curl requests
function makeRequest($url, $method = 'GET', $data = null, $token = null) {
    // Sleep 500ms to prevent hitting the API rate limits (5 req/sec)
    usleep(500000);
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

// 1. Authenticate players & admin
echo "[1/7] Connexion des différents profils d'utilisateurs...\n";
$alice = makeRequest("$baseUrl/auth/login", 'POST', ['username' => 'alice', 'password' => 'alice123']);
$bob = makeRequest("$baseUrl/auth/login", 'POST', ['username' => 'bob', 'password' => 'bob123']);
$admin = makeRequest("$baseUrl/auth/login", 'POST', ['username' => 'admin', 'password' => 'admin123']);

if (isset($alice['body']['token']) && isset($bob['body']['token']) && isset($admin['body']['token'])) {
    $aliceToken = $alice['body']['token'];
    $bobToken = $bob['body']['token'];
    $adminToken = $admin['body']['token'];
    echo "✅ SUCCÈS : Alice, Bob et l'Admin sont connectés.\n\n";
} else {
    echo "❌ ÉCHEC : Erreur lors de la connexion.\n";
    exit(1);
}

// 2. Alice creates a pack
echo "[2/7] Alice crée un thème personnalisé...\n";
$newPack = makeRequest("$baseUrl/quiz/packs", 'POST', [
    'name' => "Alice's Secret Theme",
    'description' => "Seul le créateur et l'admin doivent voir ça au début."
], $aliceToken);

$packId = 0;
if ($newPack['code'] === 200) {
    // Let's query packs for Alice to find the created pack ID
    $alicePacks = makeRequest("$baseUrl/quiz/packs", 'GET', null, $aliceToken);
    foreach ($alicePacks['body'] as $p) {
        if ($p['name'] === "Alice's Secret Theme") {
            $packId = (int) $p['id'];
            $isValidated = (int) $p['is_validated'];
            break;
        }
    }
    if ($packId > 0 && $isValidated === 0) {
        echo "✅ SUCCÈS : Thème créé par Alice avec l'ID $packId (is_validated = 0).\n\n";
    } else {
        echo "❌ ÉCHEC : Le thème n'a pas été retrouvé en attente de validation.\n\n";
        exit(1);
    }
} else {
    echo "❌ ÉCHEC : Erreur de création du thème par Alice. Code {$newPack['code']}.\n\n";
    exit(1);
}

// 3. Verify Bob cannot see Alice's pack
echo "[3/7] Vérification que Bob ne voit pas le thème d'Alice...\n";
$bobPacks = makeRequest("$baseUrl/quiz/packs", 'GET', null, $bobToken);
$foundInBob = false;
foreach ($bobPacks['body'] as $p) {
    if ((int)$p['id'] === $packId) {
        $foundInBob = true;
    }
}

if (!$foundInBob) {
    echo "✅ SUCCÈS : Le thème d'Alice est bien MASQUÉ pour Bob (Private).\n\n";
} else {
    echo "❌ ÉCHEC : Bob peut voir le thème d'Alice avant validation !\n\n";
}

// 4. Verify Bob cannot add questions to Alice's pack
echo "[4/7] Vérification de l'interdiction de modification pour Bob (Write Protection)...\n";
$maliciousQuestion = makeRequest("$baseUrl/quiz/questions", 'POST', [
    'pack_id' => $packId,
    'question_text' => "Question malveillante insérée par Bob",
    'opt_a' => "A", 'opt_b' => "B", 'opt_c' => "C", 'opt_d' => "D",
    'correct_opt' => "A"
], $bobToken);

if ($maliciousQuestion['code'] === 403) {
    echo "✅ SUCCÈS : Tentative de Bob rejetée avec le code 403 (Forbidden).\n\n";
} else {
    echo "❌ ÉCHEC : Bob a réussi à ajouter une question au pack d'Alice ! Code {$maliciousQuestion['code']}.\n\n";
}

// 5. Alice adds questions to her own pack
echo "[5/7] Alice ajoute une question dans son propre thème...\n";
$aliceQuestion = makeRequest("$baseUrl/quiz/questions", 'POST', [
    'pack_id' => $packId,
    'question_text' => "Quelle est la couleur préférée d'Alice ?",
    'opt_a' => "Bleu", 'opt_b' => "Rouge", 'opt_c' => "Vert", 'opt_d' => "Jaune",
    'correct_opt' => "A"
], $aliceToken);

if ($aliceQuestion['code'] === 200) {
    echo "✅ SUCCÈS : Question ajoutée avec succès par Alice.\n\n";
} else {
    echo "❌ ÉCHEC : Alice a été rejetée de son propre pack. Code {$aliceQuestion['code']}.\n\n";
}

// 6. Admin validates Alice's pack
echo "[6/7] L'Administrateur valide le thème d'Alice...\n";
$validateRes = makeRequest("$baseUrl/admin/packs/validate", 'POST', [
    'pack_id' => $packId
], $adminToken);

if ($validateRes['code'] === 200) {
    echo "✅ SUCCÈS : Thème approuvé par l'administrateur.\n\n";
} else {
    echo "❌ ÉCHEC : L'admin n'a pas pu valider le thème. Code {$validateRes['code']}.\n\n";
}

// 7. Verify Bob can now see Alice's pack
echo "[7/7] Vérification que Bob voit désormais le thème d'Alice...\n";
$bobPacksAfter = makeRequest("$baseUrl/quiz/packs", 'GET', null, $bobToken);
$foundInBobAfter = false;
foreach ($bobPacksAfter['body'] as $p) {
    if ((int)$p['id'] === $packId) {
        $foundInBobAfter = true;
    }
}

if ($foundInBobAfter) {
    echo "✅ SUCCÈS : Le thème d'Alice est désormais PUBLIC et visible par Bob.\n\n";
} else {
    echo "❌ ÉCHEC : Le thème validé n'apparaît toujours pas dans la liste de Bob.\n\n";
}

// Cleanup: Delete Alice's pack to restore database state
echo "-> Nettoyage de la base de données (Suppression du thème d'Alice)...\n";
makeRequest("$baseUrl/quiz/packs", 'DELETE', ['pack_id' => $packId], $aliceToken);

echo "=== FIN DES TESTS DE VALIDATION ===\n";
