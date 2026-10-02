<?php
namespace App\Data;

use App\Config\Database;

class ShikakuGenerator {
    const WIDTH = 12;
    const HEIGHT = 12;

    /**
     * Get or create daily grid for a date (YYYY-MM-DD)
     */
    public static function getGridForDate(string $date): array {
        $db = Database::getConnection();

        // 1. Check cache in database
        $stmt = $db->prepare("SELECT id, play_date, grid_width, grid_height, clues, solution FROM daily_shikaku_grids WHERE play_date = ?");
        $stmt->execute([$date]);
        $row = $stmt->fetch();

        $epoch = strtotime('2023-01-01');
        $gridNum = (int) floor((strtotime($date) - $epoch) / 86400);

        if ($row && (int)$row['grid_width'] === self::WIDTH && (int)$row['grid_height'] === self::HEIGHT) {
            return [
                'id' => "shikaku_{$date}",
                'date' => $row['play_date'],
                'grid_number' => $gridNum,
                'grid_width' => (int) $row['grid_width'],
                'grid_height' => (int) $row['grid_height'],
                'clues' => json_decode($row['clues'], true),
                'solution' => json_decode($row['solution'], true)
            ];
        }

        // 2. Generate on the fly
        $grid = self::generateDailyPuzzle($date);

        // 3. Cache into DB
        $stmtInsert = $db->prepare("
            INSERT INTO daily_shikaku_grids (play_date, grid_width, grid_height, clues, solution)
            VALUES (?, ?, ?, ?, ?)
            ON DUPLICATE KEY UPDATE grid_width = VALUES(grid_width), grid_height = VALUES(grid_height), clues = VALUES(clues), solution = VALUES(solution)
        ");
        $stmtInsert->execute([
            $date,
            $grid['grid_width'],
            $grid['grid_height'],
            json_encode($grid['clues']),
            json_encode($grid['solution'])
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
     * Generate daily puzzle deterministically (12x12 with large, varied rectangles and eccentric clues)
     */
    public static function generateDailyPuzzle(string $date): array {
        $baseSeed = crc32("shikaku_grid_12x12_" . $date);
        $w = self::WIDTH;
        $h = self::HEIGHT;

        $epoch = strtotime('2023-01-01');
        $gridNum = (int) floor((strtotime($date) - $epoch) / 86400);

        for ($attempt = 0; $attempt < 150; $attempt++) {
            $seed = $baseSeed + $attempt * 59;
            mt_srand($seed);

            $rects = self::partitionBoard($w, $h);
            $clues = self::generateClues($rects);

            $solutionsCount = self::solveShikaku($w, $h, $clues);
            if ($solutionsCount === 1) {
                $solutionList = [];
                foreach ($rects as [$r, $c, $rw, $rh]) {
                    $solutionList[] = [
                        'r' => $r,
                        'c' => $c,
                        'w' => $rw,
                        'h' => $rh,
                        'val' => $rw * $rh
                    ];
                }

                return [
                    'id' => "shikaku_{$date}",
                    'date' => $date,
                    'grid_number' => $gridNum,
                    'grid_width' => $w,
                    'grid_height' => $h,
                    'clues' => $clues,
                    'solution' => $solutionList
                ];
            }
        }

        return self::getFallbackPuzzle($date, $gridNum);
    }

    /**
     * Recursive partitioning with rich composite areas (6, 8, 9, 10, 12, 14, 15, 16, 18, 20, 24)
     */
    private static function partitionBoard(int $w, int $h): array {
        $rects = [[0, 0, $w, $h]];
        $maxArea = 20;
        $minArea = 4;

        $changed = true;
        while ($changed) {
            $changed = false;
            for ($i = 0; $i < count($rects); $i++) {
                [$r, $c, $rw, $rh] = $rects[$i];
                $area = $rw * $rh;

                $shouldSplit = ($area > $maxArea) || ($area >= 15 && mt_rand(0, 10) < 8) || ($area >= 12 && mt_rand(0, 10) < 4);
                if ($shouldSplit) {
                    $canH = ($rh >= 4);
                    $canV = ($rw >= 4);

                    if (!$canH && !$canV) {
                        $canH = ($rh >= 2);
                        $canV = ($rw >= 2);
                    }

                    if ($rw > $rh * 1.4) $dir = 'v';
                    elseif ($rh > $rw * 1.4) $dir = 'h';
                    else $dir = mt_rand(0, 1) ? 'h' : 'v';

                    if ($dir === 'h' && $canH) {
                        $validSplits = [];
                        for ($s = 2; $s <= $rh - 2; $s++) {
                            $a1 = $rw * $s;
                            $a2 = $rw * ($rh - $s);
                            if ($a1 >= $minArea && $a2 >= $minArea) {
                                $validSplits[] = $s;
                            }
                        }
                        if (empty($validSplits) && $rh >= 2) {
                            for ($s = 1; $s <= $rh - 1; $s++) {
                                if ($rw * $s >= 2 && $rw * ($rh - $s) >= 2) $validSplits[] = $s;
                            }
                        }

                        if (!empty($validSplits)) {
                            $splitH = $validSplits[array_rand($validSplits)];
                            array_splice($rects, $i, 1, [
                                [$r, $c, $rw, $splitH],
                                [$r + $splitH, $c, $rw, $rh - $splitH]
                            ]);
                            $changed = true;
                            break;
                        }
                    } elseif ($dir === 'v' && $canV) {
                        $validSplits = [];
                        for ($s = 2; $s <= $rw - 2; $s++) {
                            $a1 = $rh * $s;
                            $a2 = $rh * ($rw - $s);
                            if ($a1 >= $minArea && $a2 >= $minArea) {
                                $validSplits[] = $s;
                            }
                        }
                        if (empty($validSplits) && $rw >= 2) {
                            for ($s = 1; $s <= $rw - 1; $s++) {
                                if ($rh * $s >= 2 && $rh * ($rw - $s) >= 2) $validSplits[] = $s;
                            }
                        }

                        if (!empty($validSplits)) {
                            $splitW = $validSplits[array_rand($validSplits)];
                            array_splice($rects, $i, 1, [
                                [$r, $c, $splitW, $rh],
                                [$r, $c + $splitW, $rw - $splitW, $rh]
                            ]);
                            $changed = true;
                            break;
                        }
                    }
                }
            }
        }

        return $rects;
    }

    /**
     * Place clues eccentric on edges/corners to create genuine deduction tension
     */
    private static function generateClues(array $rects): array {
        $clues = [];
        foreach ($rects as [$r, $c, $rw, $rh]) {
            $area = $rw * $rh;

            $edgeCells = [];
            for ($dr = 0; $dr < $rh; $dr++) {
                for ($dc = 0; $dc < $rw; $dc++) {
                    if ($dr === 0 || $dr === $rh - 1 || $dc === 0 || $dc === $rw - 1) {
                        $edgeCells[] = [$r + $dr, $c + $dc];
                    }
                }
            }

            if (mt_rand(0, 10) < 8 && !empty($edgeCells)) {
                [$cr, $cc] = $edgeCells[array_rand($edgeCells)];
            } else {
                $cr = $r + mt_rand(0, $rh - 1);
                $cc = $c + mt_rand(0, $rw - 1);
            }

            $clues[] = ['r' => $cr, 'c' => $cc, 'val' => $area];
        }
        return $clues;
    }

    /**
     * Backtracking solver with MRV heuristic counting solutions
     */
    public static function solveShikaku(int $w, int $h, array $clues): int {
        $totalCells = $w * $h;
        $clueGrid = array_fill(0, $totalCells, null);

        foreach ($clues as $idx => $clue) {
            $clueGrid[$clue['r'] * $w + $clue['c']] = $idx;
        }

        $candidatesPerClue = [];
        foreach ($clues as $idx => $clue) {
            $area = $clue['val'];
            $cr = $clue['r'];
            $cc = $clue['c'];
            $cands = [];

            for ($rw = 1; $rw <= $w; $rw++) {
                if ($area % $rw !== 0) continue;
                $rh = $area / $rw;
                if ($rh > $h) continue;

                $minR = max(0, $cr - $rh + 1);
                $maxR = min($h - $rh, $cr);
                $minC = max(0, $cc - $rw + 1);
                $maxC = min($w - $rw, $cc);

                for ($r = $minR; $r <= $maxR; $r++) {
                    for ($c = $minC; $c <= $maxC; $c++) {
                        $valid = true;
                        for ($dr = 0; $dr < $rh; $dr++) {
                            for ($dc = 0; $dc < $rw; $dc++) {
                                $cellClue = $clueGrid[($r + $dr) * $w + ($c + $dc)];
                                if ($cellClue !== null && $cellClue !== $idx) {
                                    $valid = false;
                                    break 2;
                                }
                            }
                        }
                        if ($valid) {
                            $cands[] = [$r, $c, $rw, $rh];
                        }
                    }
                }
            }
            $candidatesPerClue[$idx] = $cands;
        }

        $solutionsCount = 0;
        $boardOccupied = array_fill(0, $totalCells, false);
        $unsolvedClues = array_keys($clues);

        self::searchShikaku($w, $h, $candidatesPerClue, $boardOccupied, $unsolvedClues, $solutionsCount);
        return $solutionsCount;
    }

    private static function searchShikaku(
        int $w,
        int $h,
        array &$candidatesPerClue,
        array &$boardOccupied,
        array $unsolvedClues,
        int &$solutionsCount
    ): void {
        if (empty($unsolvedClues)) {
            $solutionsCount++;
            return;
        }

        $bestClue = null;
        $bestCands = null;
        $minCandsCount = 999999;

        foreach ($unsolvedClues as $clueIdx) {
            $validCands = [];
            foreach ($candidatesPerClue[$clueIdx] as $rect) {
                [$r, $c, $rw, $rh] = $rect;
                $collides = false;
                for ($dr = 0; $dr < $rh; $dr++) {
                    for ($dc = 0; $dc < $rw; $dc++) {
                        if ($boardOccupied[($r + $dr) * $w + ($c + $dc)]) {
                            $collides = true;
                            break 2;
                        }
                    }
                }
                if (!$collides) {
                    $validCands[] = $rect;
                }
            }

            if (count($validCands) < $minCandsCount) {
                $minCandsCount = count($validCands);
                $bestClue = $clueIdx;
                $bestCands = $validCands;
                if ($minCandsCount === 0) return;
            }
        }

        $remaining = array_values(array_diff($unsolvedClues, [$bestClue]));

        foreach ($bestCands as $rect) {
            [$r, $c, $rw, $rh] = $rect;
            for ($dr = 0; $dr < $rh; $dr++) {
                for ($dc = 0; $dc < $rw; $dc++) {
                    $boardOccupied[($r + $dr) * $w + ($c + $dc)] = true;
                }
            }

            self::searchShikaku($w, $h, $candidatesPerClue, $boardOccupied, $remaining, $solutionsCount);

            for ($dr = 0; $dr < $rh; $dr++) {
                for ($dc = 0; $dc < $rw; $dc++) {
                    $boardOccupied[($r + $dr) * $w + ($c + $dc)] = false;
                }
            }

            if ($solutionsCount > 1) return;
        }
    }

    /**
     * Validate user solution (array of rectangles drawn by player)
     */
    public static function validateSolution(array $grid, array $userRects): array {
        $w = (int) ($grid['grid_width'] ?? self::WIDTH);
        $h = (int) ($grid['grid_height'] ?? self::HEIGHT);
        $totalCells = $w * $h;
        $clues = $grid['clues'];

        $boardCovered = array_fill(0, $totalCells, 0);
        $errors = [];

        $clueGrid = array_fill(0, $totalCells, null);
        foreach ($clues as $idx => $clue) {
            $clueGrid[$clue['r'] * $w + $clue['c']] = $clue['val'];
        }

        $coveredCount = 0;
        $coveredClues = [];

        foreach ($userRects as $idx => $rect) {
            $r = (int) ($rect['r'] ?? 0);
            $c = (int) ($rect['c'] ?? 0);
            $rw = (int) ($rect['w'] ?? 0);
            $rh = (int) ($rect['h'] ?? 0);

            if ($r < 0 || $c < 0 || $rw <= 0 || $rh <= 0 || ($r + $rh) > $h || ($c + $rw) > $w) {
                $errors[] = "Un rectangle dépasse des limites de la grille.";
                continue;
            }

            $area = $rw * $rh;

            $cluesInside = [];
            for ($dr = 0; $dr < $rh; $dr++) {
                for ($dc = 0; $dc < $rw; $dc++) {
                    $cr = $r + $dr;
                    $cc = $c + $dc;
                    $cellIdx = $cr * $w + $cc;
                    $boardCovered[$cellIdx]++;

                    if ($clueGrid[$cellIdx] !== null) {
                        $cluesInside[] = ['r' => $cr, 'c' => $cc, 'val' => $clueGrid[$cellIdx]];
                    }
                }
            }

            if (count($cluesInside) === 0) {
                $errors[] = "Le rectangle ($rw×$rh) en ($r,$c) ne contient aucun chiffre.";
            } elseif (count($cluesInside) > 1) {
                $errors[] = "Le rectangle ($rw×$rh) en ($r,$c) contient plusieurs chiffres.";
            } else {
                $clueVal = $cluesInside[0]['val'];
                if ($area !== $clueVal) {
                    $errors[] = "Le rectangle ($rw×$rh = $area cases) ne correspond pas à son chiffre ($clueVal).";
                } else {
                    $key = $cluesInside[0]['r'] . '_' . $cluesInside[0]['c'];
                    $coveredClues[$key] = true;
                }
            }
        }

        $overlaps = 0;
        $uncovered = 0;
        for ($i = 0; $i < $totalCells; $i++) {
            if ($boardCovered[$i] === 0) $uncovered++;
            elseif ($boardCovered[$i] > 1) $overlaps++;
            else $coveredCount++;
        }

        if ($overlaps > 0) {
            $errors[] = "Certains rectangles se chevauchent ($overlaps cases en superposition).";
        }
        if ($uncovered > 0) {
            $errors[] = "Il reste $uncovered case(s) non couverte(s).";
        }

        if (count($coveredClues) < count($clues)) {
            $missing = count($clues) - count($coveredClues);
            $errors[] = "$missing chiffre(s) ne sont pas encore encadrés correctement.";
        }

        $isValid = empty($errors) && ($uncovered === 0) && ($overlaps === 0);

        return [
            'is_valid' => $isValid,
            'is_complete' => ($uncovered === 0 && $overlaps === 0),
            'covered_cells' => $coveredCount,
            'total_cells' => $totalCells,
            'rectangles_count' => count($userRects),
            'errors' => $errors
        ];
    }

    /**
     * Fallback hand-crafted 12x12 puzzle
     */
    private static function getFallbackPuzzle(string $date, int $gridNum): array {
        $w = 12;
        $h = 12;

        $solution = [
            ['r' => 0, 'c' => 0, 'w' => 4, 'h' => 2, 'val' => 8],
            ['r' => 0, 'c' => 4, 'w' => 5, 'h' => 2, 'val' => 10],
            ['r' => 0, 'c' => 9, 'w' => 3, 'h' => 3, 'val' => 9],
            ['r' => 2, 'c' => 0, 'w' => 4, 'h' => 3, 'val' => 12],
            ['r' => 2, 'c' => 4, 'w' => 5, 'h' => 2, 'val' => 10],
            ['r' => 3, 'c' => 9, 'w' => 3, 'h' => 3, 'val' => 9],
            ['r' => 4, 'c' => 4, 'w' => 5, 'h' => 2, 'val' => 10],
            ['r' => 5, 'c' => 0, 'w' => 4, 'h' => 3, 'val' => 12],
            ['r' => 6, 'c' => 4, 'w' => 3, 'h' => 3, 'val' => 9],
            ['r' => 6, 'c' => 7, 'w' => 5, 'h' => 2, 'val' => 10],
            ['r' => 8, 'c' => 0, 'w' => 4, 'h' => 4, 'val' => 16],
            ['r' => 8, 'c' => 7, 'w' => 5, 'h' => 2, 'val' => 10],
            ['r' => 9, 'c' => 4, 'w' => 3, 'h' => 3, 'val' => 9],
            ['r' => 10, 'c' => 7, 'w' => 5, 'h' => 2, 'val' => 10]
        ];

        $clues = [];
        foreach ($solution as $rect) {
            $clues[] = [
                'r' => $rect['r'],
                'c' => $rect['c'],
                'val' => $rect['val']
            ];
        }

        return [
            'id' => "shikaku_{$date}",
            'date' => $date,
            'grid_number' => $gridNum,
            'grid_width' => $w,
            'grid_height' => $h,
            'clues' => $clues,
            'solution' => $solution
        ];
    }
}
