import {
  Gamepad2,
  Grid3X3,
  Type,
  Crown,
  Boxes,
  Brain,
  Hash,
  HelpCircle,
} from 'lucide-react';

export const GAME_CATEGORIES = [
  { id: 'all', label: 'Tous' },
  { id: 'quiz', label: 'Quiz' },
  { id: 'words', label: 'Mots' },
  { id: 'logic', label: 'Logique' },
];

export const SOLO_GAMES = [
  {
    id: 'kculture',
    title: 'Culture & Pop',
    category: 'quiz',
    eyebrow: 'Quiz solo libre',
    description: 'Sans chrono · Illimité',
    icon: Gamepad2,
    accent: 'teal',
    status: 'available', // 'available' | 'coming_soon' | 'new'
    actionLabel: 'Jouer',
  },
  {
    id: 'mot_mystere',
    title: 'Mot Mystère',
    category: 'words',
    eyebrow: '6 essais pour deviner',
    description: 'Trouve le mot caché du jour',
    icon: Type,
    accent: 'lime',
    status: 'available',
    actionLabel: 'Jouer',
  },
  {
    id: 'sudoku',
    title: 'Sudoku',
    category: 'logic',
    eyebrow: 'Grille quotidienne & archives',
    description: 'Grilles classiques 9x9',
    icon: Grid3X3,
    accent: 'amber',
    status: 'available',
    actionLabel: 'Jouer',
  },
  {
    id: 'queens',
    title: 'Queens',
    category: 'logic',
    eyebrow: 'Grille quotidienne & archives',
    description: 'Une reine par zone et rangée',
    icon: Crown,
    accent: 'fuchsia',
    status: 'available',
    actionLabel: 'Jouer',
  },
  {
    id: 'shikaku',
    title: 'Shikaku',
    category: 'logic',
    eyebrow: 'Grille quotidienne & archives',
    description: 'Divise la grille en rectangles',
    icon: Boxes,
    accent: 'violet',
    status: 'available',
    actionLabel: 'Jouer',
  },
];

export function getSoloGamesByCategory(category = 'all') {
  if (category === 'all') return SOLO_GAMES;
  return SOLO_GAMES.filter((game) => game.category === category);
}
