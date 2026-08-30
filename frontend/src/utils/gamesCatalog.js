import {
  Gamepad2,
  Grid3X3,
  LayoutGrid,
  Crown,
  Boxes,
  PenTool,
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
    icon: Grid3X3,
    accent: 'lime',
    status: 'coming_soon',
    actionLabel: 'Bientôt',
  },
  {
    id: 'mots_fleches',
    title: 'Mots Fléchés',
    category: 'words',
    eyebrow: 'Grilles thématiques',
    description: 'Définitions & lettres croisées',
    icon: PenTool,
    accent: 'blue',
    status: 'coming_soon',
    actionLabel: 'Bientôt',
  },
  {
    id: 'sudoku',
    title: 'Sudoku',
    category: 'logic',
    eyebrow: '3 niveaux de difficulté',
    description: 'Grilles classiques 9x9',
    icon: LayoutGrid,
    accent: 'amber',
    status: 'coming_soon',
    actionLabel: 'Bientôt',
  },
  {
    id: 'queens',
    title: 'Queens',
    category: 'logic',
    eyebrow: 'Casse-tête royal',
    description: 'Une reine par zone et rangée',
    icon: Crown,
    accent: 'fuchsia',
    status: 'coming_soon',
    actionLabel: 'Bientôt',
  },
  {
    id: 'shikaku',
    title: 'Shikaku',
    category: 'logic',
    eyebrow: 'Découpage géométrique',
    description: 'Divise la grille en rectangles',
    icon: Boxes,
    accent: 'violet',
    status: 'coming_soon',
    actionLabel: 'Bientôt',
  },
];

export function getSoloGamesByCategory(category = 'all') {
  if (category === 'all') return SOLO_GAMES;
  return SOLO_GAMES.filter((game) => game.category === category);
}
