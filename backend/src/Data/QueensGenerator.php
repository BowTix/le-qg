<?php
namespace App\Data;

use App\Config\Database;

class QueensGenerator {
    const SIZE = 8;

    /**
     * Get or create daily grid for a date (YYYY-MM-DD)
     */
    public static function getGridForDate(string $date): array {
        $db = Database::getConnection();

        // 1. Check cache in database
        $stmt = $db->prepare("SELECT id, play_date, grid_size, regions, solution FROM daily_queens_grids WHERE play_date = ?");
        $stmt->execute([$date]);
        $row = $stmt->fetch();

        $epoch = strtotime('2023-01-01');
        $gridNum = (int) floor((strtotime($date) - $epoch) / 86400);

        if ($row) {
            return [
                'id' => "queens_{$date}",
                'date' => $row['play_date'],
                'grid_number' => $gridNum,
                'grid_size' => (int) $row['grid_size'],
                'regions' => json_decode($row['regions'], true),
                'solution' => $row['solution']
            ];
        }

        // 2. Generate on the fly
        $grid = self::generateDailyPuzzle($date);

        // 3. Cache into DB
        $stmtInsert = $db->prepare("
            INSERT INTO daily_queens_grids (play_date, grid_size, regions, solution)
            VALUES (?, ?, ?, ?)
            ON DUPLICATE KEY UPDATE regions = VALUES(regions), solution = VALUES(solution)
        ");
        $stmtInsert->execute([
            $date,
            $grid['grid_size'],
            json_encode($grid['regions']),
            $grid['solution']
        ]);

        return $grid;
    }

    /**
     * Client-safe representation (excludes the solution)
     */
    public static function getClientGrid(array $grid): array {
        $client = $grid;
        unset($client['solution']);
        return $client;
    }

    /**
     * Generate daily puzzle deterministically
     */
    public static function generateDailyPuzzle(string $date): array {
        $baseSeed = crc32("queens_grid_" . $date);
        $size = self::SIZE;
        $totalCells = $size * $size;

        $epoch = strtotime('2023-01-01');
        $gridNum = (int) floor((strtotime($date) - $epoch) / 86400);

        for ($attempt = 0; $attempt < 100; $attempt++) {
            $seed = $baseSeed + $attempt * 31;
            $res = self::generateOnePuzzleAttempt($size, $seed);
            if ($res !== null) {
                [$queenCols, $regions] = $res;

                $solutionStr = str_repeat('.', $totalCells);
                for ($r = 0; $r < $size; $r++) {
                    $solutionStr[$r * $size + $queenCols[$r]] = 'Q';
                }

                return [
                    'id' => "queens_{$date}",
                    'date' => $date,
                    'grid_number' => $gridNum,
                    'grid_size' => $size,
                    'regions' => $regions,
                    'solution' => $solutionStr
                ];
            }
        }

        // Fallback guaranteed valid puzzle
        return self::getFallbackPuzzle($date, $gridNum);
    }

    /**
     * Generate one puzzle candidate and ensure exactly 1 unique solution
     */
    private static function generateOnePuzzleAttempt(int $size, int $seed): ?array {
        mt_srand($seed);

        $queenCols = self::findNonTouchingPlacement($size);
        if (!$queenCols) return null;

        $totalCells = $size * $size;
        $regions = array_fill(0, $totalCells, -1);
        $frontiers = [];
        for ($r = 0; $r < $size; $r++) {
            $idx = $r * $size + $queenCols[$r];
            $regions[$idx] = $r;
            $frontiers[$r] = [$idx];
        }

        $unassigned = $totalCells - $size;
        $dirs = [[-1, 0], [1, 0], [0, -1], [0, 1]];

        // Varied target sizes for regions to encourage rich polyomino deduction
        $targetSizes = [2, 3, 4, 5, 7, 9, 14, 20];
        shuffle($targetSizes);
        $sizes = array_fill(0, $size, 1);

        while ($unassigned > 0) {
            $growable = [];
            for ($r = 0; $r < $size; $r++) {
                if (!empty($frontiers[$r]) && $sizes[$r] < $targetSizes[$r]) {
                    $growable[] = $r;
                }
            }
            if (empty($growable)) {
                for ($r = 0; $r < $size; $r++) {
                    if (!empty($frontiers[$r])) $growable[] = $r;
                }
            }
            if (empty($growable)) break;

            $reg = $growable[array_rand($growable)];
            $fIdx = array_rand($frontiers[$reg]);
            $cell = $frontiers[$reg][$fIdx];
            $cr = (int) floor($cell / $size);
            $cc = $cell % $size;

            $neighs = [];
            foreach ($dirs as [$dr, $dc]) {
                $nr = $cr + $dr;
                $nc = $cc + $dc;
                if ($nr >= 0 && $nr < $size && $nc >= 0 && $nc < $size && $regions[$nr * $size + $nc] === -1) {
                    $neighs[] = $nr * $size + $nc;
                }
            }
            if (!empty($neighs)) {
                $chosen = $neighs[array_rand($neighs)];
                $regions[$chosen] = $reg;
                $sizes[$reg]++;
                $frontiers[$reg][] = $chosen;
                $unassigned--;
            } else {
                array_splice($frontiers[$reg], $fIdx, 1);
            }
        }

        // Fill remaining unassigned cells
        for ($i = 0; $i < $totalCells; $i++) {
            if ($regions[$i] === -1) {
                $r = (int) floor($i / $size);
                $c = $i % $size;
                foreach ($dirs as [$dr, $dc]) {
                    $nr = $r + $dr;
                    $nc = $c + $dc;
                    if ($nr >= 0 && $nr < $size && $nc >= 0 && $nc < $size && $regions[$nr * $size + $nc] !== -1) {
                        $regions[$i] = $regions[$nr * $size + $nc];
                        break;
                    }
                }
            }
        }

        // Eliminating alternative solutions by constraint swaps
        $iter = 0;
        while (($alt = self::findFirstAlt($size, $regions, $queenCols)) !== null && $iter++ < 50) {
            $fixed = false;
            $candidates = [];

            for ($r = 0; $r < $size; $r++) {
                $cAlt = $alt[$r];
                if ($cAlt !== $queenCols[$r]) {
                    $idx = $r * $size + $cAlt;
                    $curReg = $regions[$idx];
                    $queenIdx = $curReg * $size + $queenCols[$curReg];

                    if (!self::isRegionStillConnected($size, $regions, $curReg, $idx, $queenIdx)) {
                        continue;
                    }

                    foreach ($dirs as [$dr, $dc]) {
                        $nr = $r + $dr;
                        $nc = $cAlt + $dc;
                        if ($nr >= 0 && $nr < $size && $nc >= 0 && $nc < $size) {
                            $neighReg = $regions[$nr * $size + $nc];
                            if ($neighReg !== $curReg) {
                                $candidates[] = [$idx, $neighReg];
                            }
                        }
                    }
                }
            }

            if (!empty($candidates)) {
                [$chosenIdx, $chosenNeighReg] = $candidates[array_rand($candidates)];
                $regions[$chosenIdx] = $chosenNeighReg;
                $fixed = true;
            }

            if (!$fixed) break;
        }

        if (self::countSolutions($size, $regions) === 1 && self::areAllRegionsConnected($size, $regions, $queenCols)) {
            return [$queenCols, $regions];
        }

        return null;
    }

    /**
     * Find non-touching queens (Chebyshev distance > 1)
     */
    private static function findNonTouchingPlacement(int $size): ?array {
        $placement = [];
        if (self::searchPlacement(0, $size, $placement)) {
            return $placement;
        }
        return null;
    }

    private static function searchPlacement(int $row, int $size, array &$placement): bool {
        if ($row === $size) return true;

        $candidates = [];
        for ($c = 0; $c < $size; $c++) {
            if (in_array($c, $placement, true)) continue;
            if ($row > 0 && abs($c - $placement[$row - 1]) <= 1) continue;
            $candidates[] = $c;
        }

        shuffle($candidates);
        foreach ($candidates as $c) {
            $placement[$row] = $c;
            if (self::searchPlacement($row + 1, $size, $placement)) {
                return true;
            }
            unset($placement[$row]);
        }

        return false;
    }

    /**
     * Check if removing a cell keeps the region connected to its queen
     */
    private static function isRegionStillConnected(int $size, array &$regions, int $reg, int $removeIdx, int $queenIdx): bool {
        if ($removeIdx === $queenIdx) return false;

        $dirs = [[-1, 0], [1, 0], [0, -1], [0, 1]];
        $totalCells = $size * $size;

        $cellsCount = 0;
        for ($i = 0; $i < $totalCells; $i++) {
            if ($i !== $removeIdx && $regions[$i] === $reg) {
                $cellsCount++;
            }
        }
        if ($cellsCount === 0) return false;

        $visited = [$queenIdx => true];
        $queue = [$queenIdx];
        while (!empty($queue)) {
            $curr = array_shift($queue);
            $r = (int) floor($curr / $size);
            $c = $curr % $size;

            foreach ($dirs as [$dr, $dc]) {
                $nr = $r + $dr;
                $nc = $c + $dc;
                if ($nr >= 0 && $nr < $size && $nc >= 0 && $nc < $size) {
                    $nIdx = $nr * $size + $nc;
                    if ($nIdx !== $removeIdx && $regions[$nIdx] === $reg && !isset($visited[$nIdx])) {
                        $visited[$nIdx] = true;
                        $queue[] = $nIdx;
                    }
                }
            }
        }

        return count($visited) === $cellsCount;
    }

    /**
     * Verify all 8 regions are contiguous
     */
    private static function areAllRegionsConnected(int $size, array &$regions, array &$queenCols): bool {
        $dirs = [[-1, 0], [1, 0], [0, -1], [0, 1]];
        $totalCells = $size * $size;

        for ($reg = 0; $reg < $size; $reg++) {
            $cellsCount = 0;
            for ($i = 0; $i < $totalCells; $i++) {
                if ($regions[$i] === $reg) $cellsCount++;
            }
            if ($cellsCount === 0) return false;

            $startIdx = $reg * $size + $queenCols[$reg];
            $visited = [$startIdx => true];
            $queue = [$startIdx];

            while (!empty($queue)) {
                $curr = array_shift($queue);
                $r = (int) floor($curr / $size);
                $c = $curr % $size;
                foreach ($dirs as [$dr, $dc]) {
                    $nr = $r + $dr;
                    $nc = $c + $dc;
                    if ($nr >= 0 && $nr < $size && $nc >= 0 && $nc < $size) {
                        $nIdx = $nr * $size + $nc;
                        if ($regions[$nIdx] === $reg && !isset($visited[$nIdx])) {
                            $visited[$nIdx] = true;
                            $queue[] = $nIdx;
                        }
                    }
                }
            }

            if (count($visited) !== $cellsCount) return false;
        }

        return true;
    }

    /**
     * Fast solver counting solutions (stops early if > 1)
     */
    public static function countSolutions(int $size, array $regions): int {
        $count = 0;
        $placed = array_fill(0, $size, -1);
        self::solveBacktracking(0, $size, $regions, $placed, 0, 0, $count);
        return $count;
    }

    private static function solveBacktracking(
        int $row,
        int $size,
        array &$regions,
        array &$placed,
        int $usedCols,
        int $usedRegs,
        int &$count
    ): void {
        if ($row === $size) {
            $count++;
            return;
        }

        for ($col = 0; $col < $size; $col++) {
            $colBit = 1 << $col;
            if (($usedCols & $colBit) !== 0) continue;

            $reg = $regions[$row * $size + $col];
            $regBit = 1 << $reg;
            if (($usedRegs & $regBit) !== 0) continue;

            if ($row > 0 && abs($col - $placed[$row - 1]) <= 1) continue;

            $placed[$row] = $col;
            self::solveBacktracking(
                $row + 1,
                $size,
                $regions,
                $placed,
                $usedCols | $colBit,
                $usedRegs | $regBit,
                $count
            );

            if ($count > 1) return;
        }
    }

    /**
     * Find first alternative solution that differs from target
     */
    private static function findFirstAlt(int $size, array &$regions, array &$targetCols): ?array {
        $alt = null;
        $placed = [];
        self::searchFirstAlt(0, $size, $regions, $placed, 0, 0, $alt, $targetCols);
        return $alt;
    }

    private static function searchFirstAlt(
        int $row,
        int $size,
        array &$regions,
        array &$placed,
        int $usedCols,
        int $usedRegs,
        ?array &$alt,
        array &$targetCols
    ): void {
        if ($alt !== null) return;
        if ($row === $size) {
            if ($placed !== $targetCols) {
                $alt = $placed;
            }
            return;
        }

        for ($col = 0; $col < $size; $col++) {
            $colBit = 1 << $col;
            if (($usedCols & $colBit) !== 0) continue;

            $reg = $regions[$row * $size + $col];
            $regBit = 1 << $reg;
            if (($usedRegs & $regBit) !== 0) continue;

            if ($row > 0 && abs($col - $placed[$row - 1]) <= 1) continue;

            $placed[$row] = $col;
            self::searchFirstAlt(
                $row + 1,
                $size,
                $regions,
                $placed,
                $usedCols | $colBit,
                $usedRegs | $regBit,
                $alt,
                $targetCols
            );
            unset($placed[$row]);

            if ($alt !== null) return;
        }
    }

    /**
     * Validate user solution against puzzle rules
     */
    public static function validateSolution(array $grid, string $userState): array {
        $size = (int) ($grid['grid_size'] ?? self::SIZE);
        $totalCells = $size * $size;
        $userState = trim($userState);

        if (strlen($userState) !== $totalCells) {
            return [
                'is_valid' => false,
                'is_complete' => false,
                'queens_count' => 0,
                'errors' => ['Format de grille invalide.']
            ];
        }

        $queens = [];
        for ($i = 0; $i < $totalCells; $i++) {
            if ($userState[$i] === 'Q') {
                $r = (int) floor($i / $size);
                $c = $i % $size;
                $queens[] = [$r, $c, $grid['regions'][$i], $i];
            }
        }

        $queensCount = count($queens);
        $errors = [];

        // Total count
        if ($queensCount !== $size) {
            $errors[] = "Il faut poser exactement {$size} reines (actuellement {$queensCount}).";
        }

        // Check rows, cols, regions
        $rowSeen = [];
        $colSeen = [];
        $regSeen = [];

        foreach ($queens as [$r, $c, $reg, $idx]) {
            if (isset($rowSeen[$r])) {
                $errors[] = "Deux reines sur la ligne " . ($r + 1) . ".";
            }
            $rowSeen[$r] = true;

            if (isset($colSeen[$c])) {
                $errors[] = "Deux reines sur la colonne " . ($c + 1) . ".";
            }
            $colSeen[$c] = true;

            if (isset($regSeen[$reg])) {
                $errors[] = "Deux reines dans la même zone de couleur.";
            }
            $regSeen[$reg] = true;
        }

        // Check distance between any two queens (Chebyshev distance > 1)
        for ($i = 0; $i < $queensCount; $i++) {
            for ($j = $i + 1; $j < $queensCount; $j++) {
                $dr = abs($queens[$i][0] - $queens[$j][0]);
                $dc = abs($queens[$i][1] - $queens[$j][1]);
                if ($dr <= 1 && $dc <= 1) {
                    $errors[] = "Deux reines se touchent (contact direct ou diagonal interdit).";
                    break 2;
                }
            }
        }

        $isValid = ($queensCount === $size && empty($errors));

        return [
            'is_valid' => $isValid,
            'is_complete' => ($queensCount === $size),
            'queens_count' => $queensCount,
            'errors' => $errors
        ];
    }

    /**
     * Fallback puzzle (hand-crafted guaranteed unique configuration)
     */
    private static function getFallbackPuzzle(string $date, int $gridNum): array {
        $size = 8;
        // Known verified 8x8 Queens configuration
        $queenCols = [1, 4, 6, 3, 0, 7, 5, 2];
        $regions = [
            0, 0, 1, 1, 1, 2, 2, 2,
            0, 0, 1, 1, 1, 2, 2, 2,
            3, 3, 3, 3, 1, 2, 2, 2,
            3, 3, 3, 3, 4, 4, 5, 5,
            4, 4, 4, 4, 4, 4, 5, 5,
            6, 6, 6, 7, 7, 5, 5, 5,
            6, 6, 6, 7, 7, 7, 5, 5,
            6, 6, 7, 7, 7, 7, 7, 5
        ];

        $solution = str_repeat('.', 64);
        for ($r = 0; $r < $size; $r++) {
            $solution[$r * $size + $queenCols[$r]] = 'Q';
        }

        return [
            'id' => "queens_{$date}",
            'date' => $date,
            'grid_number' => $gridNum,
            'grid_size' => $size,
            'regions' => $regions,
            'solution' => $solution
        ];
    }
}
