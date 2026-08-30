<?php
header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS");
header("Access-Control-Allow-Headers: Content-Type, Authorization, X-Requested-With");
header("Content-Type: application/json");

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit();
}

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

\App\Middleware\RateLimiter::checkLimit();

$requestUri = parse_url($_SERVER['REQUEST_URI'] ?? '', PHP_URL_PATH);
$scriptName = $_SERVER['SCRIPT_NAME'] ?? '';
$scriptDir = dirname($scriptName);

if ($scriptDir === '\\' || $scriptDir === '/') {
    $scriptDir = '';
}

$path = substr($requestUri, strlen($scriptDir));
$path = '/' . trim($path, '/');
$method = $_SERVER['REQUEST_METHOD'];

function getRequestBody() {
    $input = file_get_contents('php://input');
    return json_decode($input, true) ?? [];
}

try {
    switch ($path) {
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

        case '/api/auth/google':
            if ($method === 'POST') {
                (new \App\Controllers\AuthController())->googleAuth(getRequestBody());
            } else {
                http_response_code(405);
                echo json_encode(["error" => "Method not allowed"]);
            }
            break;

        case '/api/auth/profile':
            if ($method === 'GET') {
                (new \App\Controllers\AuthController())->profile();
            } elseif ($method === 'PUT') {
                (new \App\Controllers\AuthController())->updateProfile(getRequestBody());
            } else {
                http_response_code(405);
                echo json_encode(["error" => "Method not allowed"]);
            }
            break;

        case '/api/auth/upload-avatar':
            if ($method === 'POST') {
                (new \App\Controllers\AuthController())->uploadAvatar();
            } else {
                http_response_code(405);
                echo json_encode(["error" => "Method not allowed"]);
            }
            break;

        case '/api/auth/verify':
            if ($method === 'POST') {
                (new \App\Controllers\AuthController())->verify(getRequestBody());
            } else {
                http_response_code(405);
                echo json_encode(["error" => "Method not allowed"]);
            }
            break;

        case '/api/auth/resend':
            if ($method === 'POST') {
                (new \App\Controllers\AuthController())->resend(getRequestBody());
            } else {
                http_response_code(405);
                echo json_encode(["error" => "Method not allowed"]);
            }
            break;

        case '/api/friends':
            if ($method === 'GET') {
                (new \App\Controllers\FriendsController())->getFriends();
            } else {
                http_response_code(405);
                echo json_encode(["error" => "Method not allowed"]);
            }
            break;

        case '/api/users/profile':
            if ($method === 'GET') {
                (new \App\Controllers\UserController())->publicProfile();
            } else {
                http_response_code(405);
                echo json_encode(["error" => "Method not allowed"]);
            }
            break;

        case '/api/friends/search':
            if ($method === 'GET') {
                (new \App\Controllers\FriendsController())->searchUsers();
            } else {
                http_response_code(405);
                echo json_encode(["error" => "Method not allowed"]);
            }
            break;

        case '/api/friends/request':
            if ($method === 'POST') {
                (new \App\Controllers\FriendsController())->sendRequest(getRequestBody());
            } else {
                http_response_code(405);
                echo json_encode(["error" => "Method not allowed"]);
            }
            break;

        case '/api/friends/respond':
            if ($method === 'POST') {
                (new \App\Controllers\FriendsController())->respondRequest(getRequestBody());
            } else {
                http_response_code(405);
                echo json_encode(["error" => "Method not allowed"]);
            }
            break;

        case '/api/friends/remove':
            if ($method === 'DELETE') {
                (new \App\Controllers\FriendsController())->removeFriend(getRequestBody());
            } else {
                http_response_code(405);
                echo json_encode(["error" => "Method not allowed"]);
            }
            break;

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

        case '/api/quests':
            if ($method === 'GET') {
                (new \App\Controllers\QuestController())->getQuests();
            } else {
                http_response_code(405);
                echo json_encode(["error" => "Method not allowed"]);
            }
            break;

        case '/api/quests/claim':
            if ($method === 'POST') {
                (new \App\Controllers\QuestController())->claimQuest();
            } else {
                http_response_code(405);
                echo json_encode(["error" => "Method not allowed"]);
            }
            break;

        case '/api/quiz/daily/status':
            if ($method === 'GET') {
                (new \App\Controllers\QuizController())->getDailyStatus();
            } else {
                http_response_code(405);
                echo json_encode(["error" => "Method not allowed"]);
            }
            break;

        case '/api/quiz/daily/questions':
            if ($method === 'GET') {
                (new \App\Controllers\QuizController())->getDailyQuestions();
            } else {
                http_response_code(405);
                echo json_encode(["error" => "Method not allowed"]);
            }
            break;

        case '/api/quiz/daily/submit':
            if ($method === 'POST') {
                (new \App\Controllers\QuizController())->submitDailyAnswer(getRequestBody());
            } else {
                http_response_code(405);
                echo json_encode(["error" => "Method not allowed"]);
            }
            break;

        case '/api/admin/daily-quizzes':
            if ($method === 'GET') {
                (new \App\Controllers\QuizController())->getDailyQuizzes();
            } elseif ($method === 'POST') {
                (new \App\Controllers\QuizController())->scheduleDailyQuiz(getRequestBody());
            } elseif ($method === 'DELETE') {
                (new \App\Controllers\QuizController())->deleteDailyQuiz(getRequestBody());
            } else {
                http_response_code(405);
                echo json_encode(["error" => "Method not allowed"]);
            }
            break;

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

        case '/api/lobby/chrono-bomb/answer':
            if ($method === 'POST') {
                (new \App\Controllers\ChronoBombController())->submit(getRequestBody());
            } else {
                http_response_code(405);
                echo json_encode(['error' => 'Method not allowed']);
            }
            break;

        case '/api/lobby/tribunal/submit':
            if ($method === 'POST') {
                (new \App\Controllers\LobbyController())->submitTribunalAnswer(getRequestBody());
            } else {
                http_response_code(405);
                echo json_encode(["error" => "Method not allowed"]);
            }
            break;

        case '/api/lobby/tribunal/vote':
            if ($method === 'POST') {
                (new \App\Controllers\LobbyController())->submitTribunalVote(getRequestBody());
            } else {
                http_response_code(405);
                echo json_encode(["error" => "Method not allowed"]);
            }
            break;

        case '/api/lobby/imposteur/vote':
            if ($method === 'POST') {
                (new \App\Controllers\LobbyController())->submitImposteurVote(getRequestBody());
            } else {
                http_response_code(405);
                echo json_encode(["error" => "Method not allowed"]);
            }
            break;

        case '/api/lobby/imposteur/start-voting':
            if ($method === 'POST') {
                (new \App\Controllers\LobbyController())->startImposteurVoting(getRequestBody());
            } else {
                http_response_code(405);
                echo json_encode(["error" => "Method not allowed"]);
            }
            break;

        case '/api/lobby/imposteur/next-round':
            if ($method === 'POST') {
                (new \App\Controllers\LobbyController())->startImposteurNextRound(getRequestBody());
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

        case '/api/admin/question-proposals':
            if ($method === 'GET') {
                (new \App\Controllers\QuestionProposalController())->index();
            } elseif ($method === 'POST') {
                (new \App\Controllers\QuestionProposalController())->moderate(getRequestBody());
            } else {
                http_response_code(405);
                echo json_encode(["error" => "Method not allowed"]);
            }
            break;

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

        case '/api/trades':
            if ($method === 'GET') {
                (new \App\Controllers\TradeController())->index();
            } else {
                http_response_code(405);
                echo json_encode(["error" => "Method not allowed"]);
            }
            break;

        case '/api/trades/context':
            if ($method === 'GET') {
                (new \App\Controllers\TradeController())->context();
            } else {
                http_response_code(405);
                echo json_encode(["error" => "Method not allowed"]);
            }
            break;

        case '/api/trades/friends-for-card':
            if ($method === 'GET') {
                (new \App\Controllers\TradeController())->friendsForCard();
            } else {
                http_response_code(405);
                echo json_encode(["error" => "Method not allowed"]);
            }
            break;

        case '/api/trades/propose':
            if ($method === 'POST') {
                (new \App\Controllers\TradeController())->propose(getRequestBody());
            } else {
                http_response_code(405);
                echo json_encode(["error" => "Method not allowed"]);
            }
            break;

        case '/api/trades/respond':
            if ($method === 'POST') {
                (new \App\Controllers\TradeController())->respond(getRequestBody());
            } else {
                http_response_code(405);
                echo json_encode(["error" => "Method not allowed"]);
            }
            break;

        case '/api/trades/cancel':
            if ($method === 'POST') {
                (new \App\Controllers\TradeController())->cancel(getRequestBody());
            } else {
                http_response_code(405);
                echo json_encode(["error" => "Method not allowed"]);
            }
            break;

        case '/api/shop/summary':
            if ($method === 'GET') {
                (new \App\Controllers\ShopController())->getCollectionSummary();
            } else {
                http_response_code(405);
                echo json_encode(["error" => "Method not allowed"]);
            }
            break;

        case '/api/shop/collection':
            if ($method === 'GET') {
                (new \App\Controllers\ShopController())->getCollection();
            } else {
                http_response_code(405);
                echo json_encode(["error" => "Method not allowed"]);
            }
            break;

        case '/api/shop/buy-cosmetic':
            if ($method === 'POST') {
                (new \App\Controllers\ShopController())->buyCosmetic();
            } else {
                http_response_code(405);
                echo json_encode(["error" => "Method not allowed"]);
            }
            break;

        case '/api/shop/buy-booster':
            if ($method === 'POST') {
                (new \App\Controllers\ShopController())->buyBooster();
            } else {
                http_response_code(405);
                echo json_encode(["error" => "Method not allowed"]);
            }
            break;

        case '/api/shop/equip':
            if ($method === 'POST') {
                (new \App\Controllers\ShopController())->equipItem();
            } else {
                http_response_code(405);
                echo json_encode(["error" => "Method not allowed"]);
            }
            break;

        default:
            http_response_code(404);
            echo json_encode(["error" => "Endpoint not found: " . $path]);
            break;
    }
} catch (\Exception $e) {
    http_response_code(500);
    echo json_encode(["error" => "Internal server error: " . $e->getMessage()]);
}
