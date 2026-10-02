<?php
namespace App\Data;

use App\Config\Database;

class ConnectionsData {
    /**
     * Color definitions for the 4 difficulty levels:
     * Level 1: Jaune (Simple / Évident)
     * Level 2: Vert (Thématique moyenne)
     * Level 3: Bleu (Vocabulaire / Spécifique)
     * Level 4: Violet (Pièges, expressions, jeux de mots)
     */
    public static function getLevelMeta(int $level): array {
        switch ($level) {
            case 1:
                return ['label' => 'Facile', 'color' => '#f59e0b', 'bg' => 'rgba(245, 158, 11, 0.18)', 'border' => '#f59e0b'];
            case 2:
                return ['label' => 'Moyen', 'color' => '#10b981', 'bg' => 'rgba(16, 185, 129, 0.18)', 'border' => '#10b981'];
            case 3:
                return ['label' => 'Difficile', 'color' => '#3b82f6', 'bg' => 'rgba(59, 130, 246, 0.18)', 'border' => '#3b82f6'];
            case 4:
            default:
                return ['label' => 'Expert', 'color' => '#a855f7', 'bg' => 'rgba(168, 85, 247, 0.18)', 'border' => '#a855f7'];
        }
    }

    /**
     * Curated catalog of high-quality French Connections puzzles.
     */
    public static function getPuzzles(): array {
        return [
            [
                'id' => 1,
                'categories' => [
                    [
                        'level' => 1,
                        'theme' => 'Agrumes',
                        'words' => ['CITRON', 'ORANGE', 'PAMPLEMOUSSE', 'CLÉMENTINE']
                    ],
                    [
                        'level' => 2,
                        'theme' => 'Choses qui ont des touches',
                        'words' => ['PIANO', 'CLAVIER', 'TÉLÉCOMMANDE', 'DIGICODE']
                    ],
                    [
                        'level' => 3,
                        'theme' => 'Pièces du jeu d’échecs',
                        'words' => ['TOUR', 'FOU', 'CAVALIER', 'PION']
                    ],
                    [
                        'level' => 4,
                        'theme' => 'Mots commençant par un métal précieux',
                        'words' => ['ORACLE', 'ARGENTINE', 'PLATINE', 'CUIVRER']
                    ]
                ]
            ],
            [
                'id' => 2,
                'categories' => [
                    [
                        'level' => 1,
                        'theme' => 'Animaux de la ferme',
                        'words' => ['MOUTON', 'VACHE', 'COCHON', 'CHÈVRE']
                    ],
                    [
                        'level' => 2,
                        'theme' => 'Figures géométriques',
                        'words' => ['CARRÉ', 'CERCLE', 'TRIANGLE', 'LOSANGE']
                    ],
                    [
                        'level' => 3,
                        'theme' => 'Monnaies mondiales',
                        'words' => ['EURO', 'DOLLAR', 'YEN', 'LIVRE']
                    ],
                    [
                        'level' => 4,
                        'theme' => 'Mots pouvant suivre « Clé »',
                        'words' => ['ANGLAISE', 'MOLETTE', 'MINUTE', 'SOL']
                    ]
                ]
            ],
            [
                'id' => 3,
                'categories' => [
                    [
                        'level' => 1,
                        'theme' => 'Capitales d’Europe',
                        'words' => ['PARIS', 'ROME', 'MADRID', 'BERLIN']
                    ],
                    [
                        'level' => 2,
                        'theme' => 'Coupes de cheveux',
                        'words' => ['CARRÉ', 'DÉGRADÉ', 'FRANGE', 'QUEUE-DE-CHEVAL']
                    ],
                    [
                        'level' => 3,
                        'theme' => 'Parties d’un arbre',
                        'words' => ['BRANCHE', 'TRONC', 'RACINE', 'ÉCORCE']
                    ],
                    [
                        'level' => 4,
                        'theme' => '_____ de terre',
                        'words' => ['POMME', 'VER', 'TREMBLEMENT', 'PIED']
                    ]
                ]
            ],
            [
                'id' => 4,
                'categories' => [
                    [
                        'level' => 1,
                        'theme' => 'Instruments de musique à vent',
                        'words' => ['FLÛTE', 'TROMPETTE', 'SAXOPHONE', 'CLARINETTE']
                    ],
                    [
                        'level' => 2,
                        'theme' => 'Marques de voitures françaises',
                        'words' => ['RENAULT', 'PEUGEOT', 'CITROËN', 'ALPINE']
                    ],
                    [
                        'level' => 3,
                        'theme' => 'Types de fromages français',
                        'words' => ['BRIE', 'COMTÉ', 'ROQUEFORT', 'REBLOCHON']
                    ],
                    [
                        'level' => 4,
                        'theme' => 'Mots qui sonnent comme des lettres',
                        'words' => ['EAU', 'NŒUD', 'QUEUE', 'GÉ']
                    ]
                ]
            ],
            [
                'id' => 5,
                'categories' => [
                    [
                        'level' => 1,
                        'theme' => 'Ustensiles de cuisine',
                        'words' => ['POÊLE', 'CASSEROLE', 'PASSOIRE', 'LOUCHE']
                    ],
                    [
                        'level' => 2,
                        'theme' => 'Termes liés à la météo',
                        'words' => ['PLUIE', 'ORAGE', 'BROUILLARD', 'GRÊLE']
                    ],
                    [
                        'level' => 3,
                        'theme' => 'Choses que l’on bat',
                        'words' => ['RECORD', 'CARTES', 'ŒUFS', 'TAMBOUR']
                    ],
                    [
                        'level' => 4,
                        'theme' => 'Ce qui a des ailes sans voler',
                        'words' => ['MOULIN', 'BÂTIMENT', 'VOITURE', 'NEZ']
                    ]
                ]
            ],
            [
                'id' => 6,
                'categories' => [
                    [
                        'level' => 1,
                        'theme' => 'Sports collectifs',
                        'words' => ['FOOTBALL', 'BASKET', 'RUGBY', 'VOLLEY']
                    ],
                    [
                        'level' => 2,
                        'theme' => 'Vêtements d’hiver',
                        'words' => ['BONNET', 'ÉCHARPE', 'MANTEAU', 'GANTS']
                    ],
                    [
                        'level' => 3,
                        'theme' => 'Synonymes de « Rapide »',
                        'words' => ['VIF', 'ÉCLAIR', 'PROMPT', 'FUSANT']
                    ],
                    [
                        'level' => 4,
                        'theme' => 'Personnages de contes',
                        'words' => ['OGRE', 'FÉE', 'LUTIN', 'NAIN']
                    ]
                ]
            ],
            [
                'id' => 7,
                'categories' => [
                    [
                        'level' => 1,
                        'theme' => 'Éléments d’une maison',
                        'words' => ['TOIT', 'PORTE', 'FENÊTRE', 'MUR']
                    ],
                    [
                        'level' => 2,
                        'theme' => 'Plats italiens',
                        'words' => ['PIZZA', 'LASAGNE', 'RISOTTO', 'GNOCCHI']
                    ],
                    [
                        'level' => 3,
                        'theme' => 'Choses qui ont des aiguilles',
                        'words' => ['HORLOGE', 'SAPIN', 'BOUSSOLE', 'TRICOT']
                    ],
                    [
                        'level' => 4,
                        'theme' => 'Expressions avec le mot « Coup »',
                        'words' => ['FOUDRE', 'MAIN', 'ŒIL', 'POUCE']
                    ]
                ]
            ],
            [
                'id' => 8,
                'categories' => [
                    [
                        'level' => 1,
                        'theme' => 'Fleurs communes',
                        'words' => ['ROSE', 'TULIPE', 'MARGUERITE', 'LILAS']
                    ],
                    [
                        'level' => 2,
                        'theme' => 'Moyens de transport urbain',
                        'words' => ['MÉTRO', 'BUS', 'TRAMWAY', 'VÉLO']
                    ],
                    [
                        'level' => 3,
                        'theme' => 'Choses qui se plient',
                        'words' => ['CARTE', 'PARAPLUIE', 'GENOU', 'SERVIETTE']
                    ],
                    [
                        'level' => 4,
                        'theme' => 'Mots qui contiennent un chiffre caché',
                        'words' => ['DOUCHÉ', 'TROISIÈME', 'SEPTIQUE', 'NEUVAINE']
                    ]
                ]
            ],
            [
                'id' => 9,
                'categories' => [
                    [
                        'level' => 1,
                        'theme' => 'Boissons chaudes',
                        'words' => ['CAFÉ', 'THÉ', 'CHOCOLAT', 'TISANE']
                    ],
                    [
                        'level' => 2,
                        'theme' => 'Signes du zodiaque',
                        'words' => ['BÉLIER', 'LION', 'GÉMEAUX', 'SCORPION']
                    ],
                    [
                        'level' => 3,
                        'theme' => 'Types de navires',
                        'words' => ['FRÉGATE', 'CORVETTE', 'PAQUEBOT', 'SOUS-MARIN']
                    ],
                    [
                        'level' => 4,
                        'theme' => 'Mots qui riment avec « Chat »',
                        'words' => ['SOLDAT', 'CLIMAT', 'RÉSULTAT', 'AVOCAT']
                    ]
                ]
            ],
            [
                'id' => 10,
                'categories' => [
                    [
                        'level' => 1,
                        'theme' => 'Membres du corps humain',
                        'words' => ['BRAS', 'JAMBE', 'TÊTE', 'PIED']
                    ],
                    [
                        'level' => 2,
                        'theme' => 'Objets de bureau',
                        'words' => ['AGRAFEUSE', 'STYLO', 'SURLIGNEUR', 'TROMBONE']
                    ],
                    [
                        'level' => 3,
                        'theme' => 'Choses que l’on peut souffler',
                        'words' => ['BOUGIE', 'VERRE', 'BALLON', 'RÉPONSE']
                    ],
                    [
                        'level' => 4,
                        'theme' => 'Mots homographes (ont 2 sens très différents)',
                        'words' => ['AVOCAT', 'ÉCLAIR', 'MOULE', 'VOL']
                    ]
                ]
            ],
            [
                'id' => 11,
                'categories' => [
                    [
                        'level' => 1,
                        'theme' => 'Planètes du système solaire',
                        'words' => ['MARS', 'VÉNUS', 'JUPITER', 'SATURNE']
                    ],
                    [
                        'level' => 2,
                        'theme' => 'Outils de bricolage',
                        'words' => ['MARTEAU', 'SCIE', 'TOURNEVIS', 'PINCE']
                    ],
                    [
                        'level' => 3,
                        'theme' => 'Choses qui ont un bouchon',
                        'words' => ['BOUTEILLE', 'ÉVIER', 'AUTOROUTE', 'STYLOS']
                    ],
                    [
                        'level' => 4,
                        'theme' => '_____ de fer',
                        'words' => ['CHEMIN', 'DAME', 'HOMME', 'RIDEAU']
                    ]
                ]
            ],
            [
                'id' => 12,
                'categories' => [
                    [
                        'level' => 1,
                        'theme' => 'Couleurs de l’arc-en-ciel',
                        'words' => ['ROUGE', 'JAUNE', 'VERT', 'VIOLET']
                    ],
                    [
                        'level' => 2,
                        'theme' => 'Rongeurs',
                        'words' => ['SOURIS', 'HAMSTER', 'ÉCUREUIL', 'CASTOR']
                    ],
                    [
                        'level' => 3,
                        'theme' => 'Choses que l’on tire',
                        'words' => ['FICELLE', 'RIDEAU', 'CHASSE', 'PORTRAIT']
                    ],
                    [
                        'level' => 4,
                        'theme' => 'Mots se terminant par un son « O » sans lettre O',
                        'words' => ['EAU', 'CHAPEAU', 'BEAU', 'OISEAU']
                    ]
                ]
            ],
            [
                'id' => 13,
                'categories' => [
                    [
                        'level' => 1,
                        'theme' => 'Arbres feuillus',
                        'words' => ['CHÊNE', 'BOULEAU', 'HÊTRE', 'PLATANE']
                    ],
                    [
                        'level' => 2,
                        'theme' => 'Grands fleuves du monde',
                        'words' => ['AMAZONE', 'NIL', 'DANUBE', 'MISSISSIPPI']
                    ],
                    [
                        'level' => 3,
                        'theme' => 'Choses qui ont des dents sans mordre',
                        'words' => ['PEIGNE', 'SCIE', 'ENGRENAGE', 'FOURCHETTE']
                    ],
                    [
                        'level' => 4,
                        'theme' => 'Titres de films avec un chiffre',
                        'words' => ['SEVEN', 'PARRAIN', 'GLADIATEUR', 'TAXI']
                    ]
                ]
            ],
            [
                'id' => 14,
                'categories' => [
                    [
                        'level' => 1,
                        'theme' => 'Pâtisseries françaises',
                        'words' => ['ÉCLAIR', 'MILLE-FEUILLE', 'CROISSANT', 'MACARON']
                    ],
                    [
                        'level' => 2,
                        'theme' => 'Jeux de société classiques',
                        'words' => ['MONOPOLY', 'SCRABBLE', 'CLUEDO', 'DAMES']
                    ],
                    [
                        'level' => 3,
                        'theme' => 'Mots liés au cinéma',
                        'words' => ['CADRE', 'PLAN', 'CLAP', 'RUSH']
                    ],
                    [
                        'level' => 4,
                        'theme' => '_____ d’or',
                        'words' => ['BALLON', 'PALME', 'SILENCE', 'ÂGE']
                    ]
                ]
            ],
            [
                'id' => 15,
                'categories' => [
                    [
                        'level' => 1,
                        'theme' => 'Oiseaux volants',
                        'words' => ['AIGLE', 'HIRONDELLE', 'COLOMBE', 'MOINEAU']
                    ],
                    [
                        'level' => 2,
                        'theme' => 'Épices de cuisine',
                        'words' => ['CUMIN', 'SAFRAN', 'CANNELLE', 'CURCUMA']
                    ],
                    [
                        'level' => 3,
                        'theme' => 'Choses qui ont une queue',
                        'words' => ['COMÈTE', 'PIANO', 'CERF-VOLANT', 'BILLARD']
                    ],
                    [
                        'level' => 4,
                        'theme' => 'Mots associés à la souris',
                        'words' => ['FROMAGE', 'ORDINATEUR', 'TAPETTE', 'AGNEAU']
                    ]
                ]
            ]
        ];
    }

    /**
     * Gets or creates the daily grid for a given date.
     */
    public static function getGridForDate(string $date): array {
        $db = Database::getConnection();

        $stmt = $db->prepare("SELECT categories FROM daily_connections_grids WHERE play_date = ?");
        $stmt->execute([$date]);
        $row = $stmt->fetch();

        if ($row && !empty($row['categories'])) {
            $categories = json_decode($row['categories'], true);
            if (is_array($categories) && count($categories) === 4) {
                return ['play_date' => $date, 'categories' => $categories];
            }
        }

        // Deterministic selection based on date CRC32
        $puzzles = self::getPuzzles();
        $index = abs(crc32($date)) % count($puzzles);
        $selectedPuzzle = $puzzles[$index];

        // Ensure level meta is populated
        $categories = [];
        foreach ($selectedPuzzle['categories'] as $cat) {
            $level = (int)$cat['level'];
            $meta = self::getLevelMeta($level);
            $categories[] = [
                'level' => $level,
                'theme' => $cat['theme'],
                'color' => $meta['color'],
                'bg' => $meta['bg'],
                'border' => $meta['border'],
                'words' => array_map('strtoupper', $cat['words'])
            ];
        }

        // Save to DB
        $stmtInsert = $db->prepare("
            INSERT INTO daily_connections_grids (play_date, categories)
            VALUES (?, ?)
            ON DUPLICATE KEY UPDATE categories = VALUES(categories)
        ");
        $stmtInsert->execute([$date, json_encode($categories, JSON_UNESCAPED_UNICODE)]);

        return ['play_date' => $date, 'categories' => $categories];
    }

    /**
     * Gets a random puzzle for Practice mode.
     */
    public static function getRandomPuzzle(?int $excludeId = null): array {
        $puzzles = self::getPuzzles();
        if ($excludeId !== null && count($puzzles) > 1) {
            $puzzles = array_values(array_filter($puzzles, fn($p) => $p['id'] !== $excludeId));
        }

        $chosen = $puzzles[array_rand($puzzles)];
        $categories = [];
        foreach ($chosen['categories'] as $cat) {
            $level = (int)$cat['level'];
            $meta = self::getLevelMeta($level);
            $categories[] = [
                'level' => $level,
                'theme' => $cat['theme'],
                'color' => $meta['color'],
                'bg' => $meta['bg'],
                'border' => $meta['border'],
                'words' => array_map('strtoupper', $cat['words'])
            ];
        }

        return [
            'puzzle_id' => $chosen['id'],
            'categories' => $categories
        ];
    }

    /**
     * Extracts client-safe data:
     * - All 16 words (or remaining words) shuffled
     * - Already solved categories with their theme and colors
     */
    public static function getClientGrid(array $categories, array $solvedLevels = []): array {
        $solvedCategories = [];
        $solvedWords = [];

        foreach ($categories as $cat) {
            if (in_array((int)$cat['level'], $solvedLevels, true)) {
                $solvedCategories[] = [
                    'level' => (int)$cat['level'],
                    'theme' => $cat['theme'],
                    'color' => $cat['color'],
                    'bg' => $cat['bg'] ?? '',
                    'words' => $cat['words']
                ];
                foreach ($cat['words'] as $w) {
                    $solvedWords[] = strtoupper($w);
                }
            }
        }

        $allWords = [];
        foreach ($categories as $cat) {
            foreach ($cat['words'] as $w) {
                $upper = strtoupper($w);
                if (!in_array($upper, $solvedWords, true)) {
                    $allWords[] = $upper;
                }
            }
        }

        // Shuffle remaining words
        shuffle($allWords);

        return [
            'words' => $allWords,
            'solved_categories' => $solvedCategories,
            'total_categories' => count($categories),
            'solved_count' => count($solvedCategories)
        ];
    }

    /**
     * Evaluates a 4-word guess against the puzzle categories.
     */
    public static function evaluateGuess(array $categories, array $guessedWords, array $alreadySolvedLevels = []): array {
        $cleanGuess = array_map('strtoupper', array_map('trim', $guessedWords));
        sort($cleanGuess);

        $oneAway = false;

        foreach ($categories as $cat) {
            $level = (int)$cat['level'];
            if (in_array($level, $alreadySolvedLevels, true)) {
                continue; // Already solved
            }

            $catWords = array_map('strtoupper', $cat['words']);
            sort($catWords);

            // Exact match
            if ($catWords === $cleanGuess) {
                return [
                    'matched' => true,
                    'category' => [
                        'level' => $level,
                        'theme' => $cat['theme'],
                        'color' => $cat['color'],
                        'bg' => $cat['bg'] ?? '',
                        'words' => $cat['words']
                    ],
                    'one_away' => false
                ];
            }

            // Check 3 out of 4 match
            $intersection = array_intersect($cleanGuess, $catWords);
            if (count($intersection) === 3) {
                $oneAway = true;
            }
        }

        return [
            'matched' => false,
            'category' => null,
            'one_away' => $oneAway
        ];
    }
}
