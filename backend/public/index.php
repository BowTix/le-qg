<?php
/**
 * PHP Backend Entrypoint & Router
 */

// 1. Set CORS Headers
header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS");
header("Access-Control-Allow-Headers: Content-Type, Authorization, X-Requested-With");
header("Content-Type: application/json");

// Handle preflight OPTIONS requests
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit();
}

// 2. Custom PSR-4 Autoloader
spl_autoload_register(function ($class) {
    $prefix = 'App\\';
    $base_dir = dirname(__DIR__) . '/src/';
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

// 3. Enable Rate Limiter
\App\Middleware\RateLimiter::checkLimit();

// 4. Resolve Request Path (Subdirectory Friendly)
$requestUri = parse_url($_SERVER['REQUEST_URI'] ?? '', PHP_URL_PATH);
$scriptName = $_SERVER['SCRIPT_NAME'] ?? '';
$scriptDir = dirname($scriptName);

if ($scriptDir === '\\' || $scriptDir === '/') {
    $scriptDir = '';
}

$path = substr($requestUri, strlen($scriptDir));
$path = '/' . trim($path, '/');
$method = $_SERVER['REQUEST_METHOD'];

// Helper to read JSON request body
function getRequestBody() {
    $input = file_get_contents('php://input');
    return json_decode($input, true) ?? [];
}

try {
    // 5. Routing Table
    switch ($path) {
        // --- Authentication ---
        case '/api/auth/register':
            if ($method === 'POST') {
                (new \App\Controllers\AuthController())->register(getRequestBody());
            } else {
                http_response_code(405);
                echo json_encode(["error" => "Method not allowed"]);
            }
            break;

        case '/api/auth/login':
            if ($method === 'POST') {
                (new \App\Controllers\AuthController())->login(getRequestBody());
            } else {
                http_response_code(405);
                echo json_encode(["error" => "Method not allowed"]);
            }
            break;

        case '/api/auth/profile':
            if ($method === 'GET') {
                (new \App\Controllers\AuthController())->profile();
            } else {
                http_response_code(405);
                echo json_encode(["error" => "Method not allowed"]);
            }
            break;

        // --- Solo Quiz ---
        case '/api/quiz/packs':
            if ($method === 'GET') {
                (new \App\Controllers\QuizController())->getPacks();
            } elseif ($method === 'POST') {
                (new \App\Controllers\QuizController())->createPack(getRequestBody());
            } elseif ($method === 'DELETE') {
                (new \App\Controllers\QuizController())->deletePack(getRequestBody());
            } else {
                http_response_code(405);
                echo json_encode(["error" => "Method not allowed"]);
            }
            break;

        case '/api/quiz/questions':
            if ($method === 'GET') {
                (new \App\Controllers\QuizController())->getQuestions($_GET);
            } elseif ($method === 'POST') {
                (new \App\Controllers\QuizController())->createQuestion(getRequestBody());
            } elseif ($method === 'PUT') {
                (new \App\Controllers\QuizController())->updateQuestion(getRequestBody());
            } elseif ($method === 'DELETE') {
                (new \App\Controllers\QuizController())->deleteQuestion(getRequestBody());
            } else {
                http_response_code(405);
                echo json_encode(["error" => "Method not allowed"]);
            }
            break;

        case '/api/quiz/question':
            if ($method === 'GET') {
                (new \App\Controllers\QuizController())->getQuestion($_GET);
            } else {
                http_response_code(405);
                echo json_encode(["error" => "Method not allowed"]);
            }
            break;

        case '/api/quiz/answer':
            if ($method === 'POST') {
                (new \App\Controllers\QuizController())->submitAnswer(getRequestBody());
            } else {
                http_response_code(405);
                echo json_encode(["error" => "Method not allowed"]);
            }
            break;

        case '/api/quiz/leaderboard':
            if ($method === 'GET') {
                (new \App\Controllers\QuizController())->getLeaderboard();
            } else {
                http_response_code(405);
                echo json_encode(["error" => "Method not allowed"]);
            }
            break;

        // --- Multiplayer Lobby ---
        case '/api/lobby/create':
            if ($method === 'POST') {
                (new \App\Controllers\LobbyController())->create();
            } else {
                http_response_code(405);
                echo json_encode(["error" => "Method not allowed"]);
            }
            break;

        case '/api/lobby/join':
            if ($method === 'POST') {
                (new \App\Controllers\LobbyController())->join();
            } else {
                http_response_code(405);
                echo json_encode(["error" => "Method not allowed"]);
            }
            break;

        case '/api/lobby/status':
            if ($method === 'GET') {
                (new \App\Controllers\LobbyController())->status($_GET);
            } else {
                http_response_code(405);
                echo json_encode(["error" => "Method not allowed"]);
            }
            break;

        case '/api/lobby/start':
            if ($method === 'POST') {
                (new \App\Controllers\LobbyController())->startGame();
            } else {
                http_response_code(405);
                echo json_encode(["error" => "Method not allowed"]);
            }
            break;

        case '/api/lobby/my-question':
            if ($method === 'GET') {
                (new \App\Controllers\LobbyController())->getMyQuestion($_GET);
            } else {
                http_response_code(405);
                echo json_encode(["error" => "Method not allowed"]);
            }
            break;

        case '/api/lobby/answer':
            if ($method === 'POST') {
                (new \App\Controllers\LobbyController())->submitAnswer();
            } else {
                http_response_code(405);
                echo json_encode(["error" => "Method not allowed"]);
            }
            break;

        case '/api/lobby/finish':
            if ($method === 'POST') {
                (new \App\Controllers\LobbyController())->finishGame();
            } else {
                http_response_code(405);
                echo json_encode(["error" => "Method not allowed"]);
            }
            break;

        case '/api/lobby/leave':
            if ($method === 'POST') {
                (new \App\Controllers\LobbyController())->leave();
            } else {
                http_response_code(405);
                echo json_encode(["error" => "Method not allowed"]);
            }
            break;

        case '/api/lobby/reaction':
            if ($method === 'POST') {
                (new \App\Controllers\LobbyController())->submitReaction();
            } else {
                http_response_code(405);
                echo json_encode(["error" => "Method not allowed"]);
            }
            break;

        // --- Admin Question Management (CRUD) ---
        case '/api/admin/questions':
            if ($method === 'GET') {
                (new \App\Controllers\QuizController())->getAdminQuestions();
            } elseif ($method === 'POST') {
                (new \App\Controllers\QuizController())->createAdminQuestion(getRequestBody());
            } elseif ($method === 'PUT') {
                (new \App\Controllers\QuizController())->updateAdminQuestion(getRequestBody());
            } elseif ($method === 'DELETE') {
                (new \App\Controllers\QuizController())->deleteAdminQuestion(getRequestBody());
            } else {
                http_response_code(405);
                echo json_encode(["error" => "Method not allowed"]);
            }
            break;

        // --- Admin Pack Management (CRUD) ---
        case '/api/admin/packs/validate':
            if ($method === 'POST') {
                (new \App\Controllers\QuizController())->validatePack(getRequestBody());
            } else {
                http_response_code(405);
                echo json_encode(["error" => "Method not allowed"]);
            }
            break;

        case '/api/admin/packs':
            if ($method === 'GET') {
                (new \App\Controllers\QuizController())->getAdminPacks();
            } elseif ($method === 'POST') {
                (new \App\Controllers\QuizController())->createAdminPack(getRequestBody());
            } elseif ($method === 'DELETE') {
                (new \App\Controllers\QuizController())->deleteAdminPack(getRequestBody());
            } else {
                http_response_code(405);
                echo json_encode(["error" => "Method not allowed"]);
            }
            break;

        // --- 404 Route Not Found ---
        default:
            http_response_code(404);
            echo json_encode(["error" => "Endpoint not found: " . $path]);
            break;
    }
} catch (\Exception $e) {
    http_response_code(500);
    echo json_encode(["error" => "Internal server error: " . $e->getMessage()]);
}
