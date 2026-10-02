<?php
namespace App\Data;

use App\Config\Database;

class SudokuGenerator {
    /**
     * Standard base complete valid Sudoku board (9x9)
     */
    private static array $baseBoard = [
        [1, 2, 3, 4, 5, 6, 7, 8, 9],
        [4, 5, 6, 7, 8, 9, 1, 2, 3],
        [7, 8, 9, 1, 2, 3, 4, 5, 6],
        [2, 3, 4, 5, 6, 7, 8, 9, 1],
        [5, 6, 7, 8, 9, 1, 2, 3, 4],
        [8, 9, 1, 2, 3, 4, 5, 6, 7],
        [3, 4, 5, 6, 7, 8, 9, 1, 2],
        [6, 7, 8, 9, 1, 2, 3, 4, 5],
        [9, 1, 2, 3, 4, 5, 6, 7, 8]
    ];

    /**
     * Generate a complete, fully valid 9x9 Sudoku board deterministically based on seed
     */
    public static function generateCompleteBoard(int $seed): array {
        mt_srand($seed);

        $board = self::$baseBoard;

        // 1. Permute digits (1..9)
        $digits = range(1, 9);
        shuffle($digits);
        $digitMap = array_combine(range(1, 9), $digits);

        for ($r = 0; $r < 9; $r++) {
            for ($c = 0; $c < 9; $c++) {
                $board[$r][$c] = $digitMap[$board[$r][$c]];
            }
        }

        // 2. Permute rows within bands (0..2, 3..5, 6..8)
        for ($b = 0; $b < 3; $b++) {
            $indices = [0, 1, 2];
            shuffle($indices);
            $bandRows = array_slice($board, $b * 3, 3);
            for ($i = 0; $i < 3; $i++) {
                $board[$b * 3 + $i] = $bandRows[$indices[$i]];
            }
        }

        // 3. Permute columns within bands
        for ($b = 0; $b < 3; $b++) {
            $indices = [0, 1, 2];
            shuffle($indices);
            for ($r = 0; $r < 9; $r++) {
                $colVals = [$board[$r][$b * 3], $board[$r][$b * 3 + 1], $board[$r][$b * 3 + 2]];
                for ($i = 0; $i < 3; $i++) {
                    $board[$r][$b * 3 + $i] = $colVals[$indices[$i]];
                }
            }
        }

        // 4. Permute row bands
        $bandIndices = [0, 1, 2];
        shuffle($bandIndices);
        $newBoard = [];
        foreach ($bandIndices as $b) {
            for ($i = 0; $i < 3; $i++) {
                $newBoard[] = $board[$b * 3 + $i];
            }
        }
        $board = $newBoard;

        // 5. Permute column bands
        $colBandIndices = [0, 1, 2];
        shuffle($colBandIndices);
        for ($r = 0; $r < 9; $r++) {
            $newRow = [];
            foreach ($colBandIndices as $b) {
                for ($i = 0; $i < 3; $i++) {
                    $newRow[] = $board[$r][$b * 3 + $i];
                }
            }
            $board[$r] = $newRow;
        }

        // 6. Optional transpose
        if (mt_rand(0, 1) === 1) {
            $transposed = [];
            for ($r = 0; $r < 9; $r++) {
                $transposed[$r] = [];
                for ($c = 0; $c < 9; $c++) {
                    $transposed[$r][$c] = $board[$c][$r];
                }
            }
            $board = $transposed;
        }

        return $board;
    }

    /**
     * Check how many solutions a given Sudoku board has (stops when count > 1)
     */
    public static function countSolutions(array $board, int &$solutions = 0): int {
        // Find first empty cell (value 0)
        $emptyR = -1;
        $emptyC = -1;

        for ($r = 0; $r < 9; $r++) {
            for ($c = 0; $c < 9; $c++) {
                if ($board[$r][$c] === 0) {
                    $emptyR = $r;
                    $emptyC = $c;
                    break 2;
                }
            }
        }

        if ($emptyR === -1) {
            $solutions++;
            return $solutions;
        }

        // Try numbers 1 to 9
        for ($num = 1; $num <= 9; $num++) {
            if (self::isValidPlacement($board, $emptyR, $emptyC, $num)) {
                $board[$emptyR][$emptyC] = $num;
                self::countSolutions($board, $solutions);
                if ($solutions > 1) return $solutions;
                $board[$emptyR][$emptyC] = 0;
            }
        }

        return $solutions;
    }

    /**
     * Check if placing $num at ($row, $col) is valid
     */
    public static function isValidPlacement(array &$board, int $row, int $col, int $num): bool {
        for ($i = 0; $i < 9; $i++) {
            if ($board[$row][$i] === $num || $board[$i][$col] === $num) {
                return false;
            }
        }

        $boxR = intdiv($row, 3) * 3;
        $boxC = intdiv($col, 3) * 3;

        for ($r = 0; $r < 3; $r++) {
            for ($c = 0; $c < 3; $c++) {
                if ($board[$boxR + $r][$boxC + $c] === $num) {
                    return false;
                }
            }
        }

        return true;
    }

    /**
     * Generate daily puzzle and solution for a date YYYY-MM-DD
     */
    public static function generateDailyPuzzle(string $date, string $difficulty = 'moyen'): array {
        $seed = abs(crc32($date));
        $fullBoard = self::generateCompleteBoard($seed);
        $puzzleBoard = $fullBoard;

        // Determine target clues based on difficulty
        // 'facile' -> ~38 clues
        // 'moyen'  -> ~32 clues
        // 'difficile' -> ~28 clues
        $targetClues = match ($difficulty) {
            'facile' => 38,
            'difficile' => 28,
            default => 33
        };

        // Create list of cell positions
        $positions = [];
        for ($r = 0; $r < 9; $r++) {
            for ($c = 0; $c < 9; $c++) {
                // Symmetrical pairs
                if ($r * 9 + $c <= (8 - $r) * 9 + (8 - $c)) {
                    $positions[] = [$r, $c];
                }
            }
        }

        mt_srand($seed + 101);
        shuffle($positions);

        $currentClues = 81;
        foreach ($positions as [$r, $c]) {
            if ($currentClues <= $targetClues) break;

            $symR = 8 - $r;
            $symC = 8 - $c;

            $val1 = $puzzleBoard[$r][$c];
            $val2 = $puzzleBoard[$symR][$symC];

            if ($val1 === 0) continue;

            $puzzleBoard[$r][$c] = 0;
            $puzzleBoard[$symR][$symC] = 0;

            // Check uniqueness
            $testCount = 0;
            self::countSolutions($puzzleBoard, $testCount);

            if ($testCount === 1) {
                $currentClues -= ($r === $symR && $c === $symC) ? 1 : 2;
            } else {
                // Restore if not unique
                $puzzleBoard[$r][$c] = $val1;
                $puzzleBoard[$symR][$symC] = $val2;
            }
        }

        // Convert to 81-character strings
        $initialStr = '';
        $solutionStr = '';

        for ($r = 0; $r < 9; $r++) {
            for ($c = 0; $c < 9; $c++) {
                $initialStr .= (string)$puzzleBoard[$r][$c];
                $solutionStr .= (string)$fullBoard[$r][$c];
            }
        }

        $epoch = strtotime('2023-01-01');
        $gridNum = (int) floor((strtotime($date) - $epoch) / 86400);

        return [
            'id' => "sudoku_{$date}",
            'date' => $date,
            'grid_number' => $gridNum,
            'difficulty' => $difficulty,
            'given_clues' => $currentClues,
            'initial_grid' => $initialStr,
            'solution_grid' => $solutionStr
        ];
    }

    /**
     * Get grid for date (cached in DB or generated on the fly)
     */
    public static function getGridForDate(string $date, string $difficulty = 'moyen'): array {
        $db = Database::getConnection();

        // 1. Check DB cache
        $stmt = $db->prepare("SELECT play_date, initial_grid, solution_grid, difficulty FROM daily_sudoku_grids WHERE play_date = ?");
        $stmt->execute([$date]);
        $row = $stmt->fetch();

        $epoch = strtotime('2023-01-01');
        $gridNum = (int) floor((strtotime($date) - $epoch) / 86400);

        if ($row) {
            $givenClues = 0;
            for ($i = 0; $i < 81; $i++) {
                if ($row['initial_grid'][$i] !== '0') $givenClues++;
            }

            return [
                'id' => "sudoku_{$date}",
                'date' => $row['play_date'],
                'grid_number' => $gridNum,
                'difficulty' => $row['difficulty'] ?: $difficulty,
                'given_clues' => $givenClues,
                'initial_grid' => $row['initial_grid'],
                'solution_grid' => $row['solution_grid']
            ];
        }

        // 2. Generate on the fly
        $grid = self::generateDailyPuzzle($date, $difficulty);

        // 3. Save to DB cache
        $stmtInsert = $db->prepare("
            INSERT INTO daily_sudoku_grids (play_date, initial_grid, solution_grid, difficulty)
            VALUES (?, ?, ?, ?)
            ON DUPLICATE KEY UPDATE initial_grid = VALUES(initial_grid), solution_grid = VALUES(solution_grid)
        ");
        $stmtInsert->execute([$date, $grid['initial_grid'], $grid['solution_grid'], $grid['difficulty']]);

        return $grid;
    }

    /**
     * Returns client-safe version (hiding solution_grid)
     */
    public static function getClientGrid(array $grid): array {
        $client = $grid;
        unset($client['solution_grid']);
        return $client;
    }

    /**
     * Validates client grid against true solution
     */
    public static function validateSolution(string $solutionGrid, string $userGrid): array {
        $userGrid = trim($userGrid);
        if (strlen($userGrid) !== 81 || strlen($solutionGrid) !== 81) {
            return [
                'is_valid' => false,
                'is_complete' => false,
                'errors_count' => 81
            ];
        }

        $errors = 0;
        $filled = 0;

        for ($i = 0; $i < 81; $i++) {
            $u = $userGrid[$i];
            $s = $solutionGrid[$i];

            if ($u !== '0') {
                $filled++;
                if ($u !== $s) {
                    $errors++;
                }
            }
        }

        $isComplete = ($filled === 81);
        $isValid = ($isComplete && $errors === 0);

        return [
            'is_valid' => $isValid,
            'is_complete' => $isComplete,
            'filled_count' => $filled,
            'errors_count' => $errors
        ];
    }
}
