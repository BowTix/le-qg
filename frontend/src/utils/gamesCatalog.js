import {
  Gamepad2,
  Grid3X3,
  Type,
  Crown,
  Boxes,
  Brain,
  Hash,
  HelpCircle,
  Link2,
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
    eyebrow: 'Culture sans pression',
    description: 'Défie ta culture sans chrono',
    icon: Gamepad2,
    accent: 'teal',
    status: 'available', // 'available' | 'coming_soon' | 'new'
    actionLabel: 'Jouer',
  },
  {
    id: 'mot_mystere',
    title: 'Mot Mystère',
    category: 'words',
    eyebrow: 'Le mot secret du jour',
    description: '6 essais pour viser juste',
    icon: Type,
    accent: 'lime',
    status: 'available',
    actionLabel: 'Jouer',
  },
  {
    id: 'liens',
    title: 'Les Liens',
    category: 'words',
    eyebrow: 'Trouve les 4 connexions',
    description: '16 mots, 4 groupes cachés',
    icon: Link2,
    accent: 'cyan',
    status: 'available',
    actionLabel: 'Jouer',
  },
  {
    id: 'sudoku',
    title: 'Sudoku',
    category: 'logic',
    eyebrow: 'Le grand classique mental',
    description: 'De 1 à 9 sans aucun doublon',
    icon: Grid3X3,
    accent: 'amber',
    status: 'available',
    actionLabel: 'Jouer',
  },
  {
    id: 'queens',
    title: 'Queens',
    category: 'logic',
    eyebrow: 'Bataille de couronnes',
    description: 'Une reine par zone et sans contact',
    icon: Crown,
    accent: 'fuchsia',
    status: 'available',
    actionLabel: 'Jouer',
  },
  {
    id: 'shikaku',
    title: 'Shikaku',
    category: 'logic',
    eyebrow: 'L’art du puzzle nippon',
    description: 'Découpe la grille au rectangle près',
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
