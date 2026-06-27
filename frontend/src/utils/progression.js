/**
 * Progression & Leveling Utility Helpers
 */

/**
 * Calculates user Level based on total XP (global_score) using a quadratic curve:
 * XP = 200 * (Level - 1)^2
 * Level = floor(sqrt(XP / 200)) + 1
 */
export const getLevel = (xp) => {
  return Math.floor(Math.sqrt((xp || 0) / 200)) + 1;
};

/**
 * Calculates details about the current level progression
 * Returns: {
 *   currentLevelXp: XP accumulated in the current level,
 *   xpNeededForNextLevel: Total XP required to level up from current level to next level
 * }
 */
export const getLevelProgressDetails = (xp) => {
  const currentLevel = getLevel(xp);
  
  // Total XP required for current level boundary
  const currentLevelMinXp = 200 * Math.pow(currentLevel - 1, 2);
  
  // Total XP required for next level boundary
  const nextLevelMinXp = 200 * Math.pow(currentLevel, 2);
  
  const xpInCurrentLevel = (xp || 0) - currentLevelMinXp;
  const xpNeededForNext = nextLevelMinXp - currentLevelMinXp;
  
  return {
    currentLevelXp: Math.max(0, xpInCurrentLevel),
    xpNeededForNextLevel: xpNeededForNext
  };
};

/**
 * Returns dynamic username styling object based on XP
 * - Lvl 1-4: Standard white
 * - Lvl 5-9: Neon yellow
 * - Lvl 10-14: Neon pink/magenta
 * - Lvl 15+: Neon cyan/blue
 */
export const getUsernameStyle = (xp) => {
  const lvl = getLevel(xp);
  if (lvl >= 15) {
    return {
      color: '#00e5ff',
      textShadow: '0 0 8px rgba(0, 229, 255, 0.6), 0 0 16px rgba(0, 229, 255, 0.2)',
      fontWeight: '700'
    };
  }
  if (lvl >= 10) {
    return {
      color: '#ff007f',
      textShadow: '0 0 8px rgba(255, 0, 127, 0.6), 0 0 16px rgba(255, 0, 127, 0.2)',
      fontWeight: '700'
    };
  }
  if (lvl >= 5) {
    return {
      color: '#fff700',
      textShadow: '0 0 8px rgba(255, 247, 0, 0.5)',
      fontWeight: '700'
    };
  }
  return {
    color: '#ffffff',
    fontWeight: '600'
  };
};

/**
 * Returns user level badge/label name based on level
 */
export const getLevelBadge = (level) => {
  if (level >= 15) return '🥇 Élite des Quiz';
  if (level >= 10) return '🥈 Connaisseur';
  if (level >= 5)  return '🥉 Initié';
  return 'Novice';
};
