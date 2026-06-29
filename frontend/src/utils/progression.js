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
  if (level >= 15) return 'Élite des Quiz';
  if (level >= 10) return 'Connaisseur';
  if (level >= 5)  return 'Initié';
  return 'Novice';
};

/**
 * Returns Elo rank details (name, color, glow) based on ELO score
 */
export const getEloRank = (elo) => {
  const score = elo || 0;
  
  if (score < 100) {
    return {
      name: 'Plastique',
      color: '#a0a0a0',
      glow: 'none'
    };
  }
  if (score < 300) {
    let div = 'I';
    if (score >= 233) div = 'III';
    else if (score >= 166) div = 'II';
    return {
      name: `Bronze ${div}`,
      color: '#cd7f32',
      glow: 'none'
    };
  }
  if (score < 500) {
    let div = 'I';
    if (score >= 433) div = 'III';
    else if (score >= 366) div = 'II';
    return {
      name: `Argent ${div}`,
      color: '#c0c0c0',
      glow: 'none'
    };
  }
  if (score < 750) {
    let div = 'I';
    if (score >= 666) div = 'III';
    else if (score >= 583) div = 'II';
    return {
      name: `Or ${div}`,
      color: '#ffd700',
      glow: '0 0 8px rgba(255, 215, 0, 0.3)'
    };
  }
  if (score < 1000) {
    let div = 'I';
    if (score >= 916) div = 'III';
    else if (score >= 833) div = 'II';
    return {
      name: `Platine ${div}`,
      color: '#00ffcc',
      glow: '0 0 8px rgba(0, 255, 204, 0.4)'
    };
  }
  if (score < 1300) {
    let div = 'I';
    if (score >= 1200) div = 'III';
    else if (score >= 1100) div = 'II';
    return {
      name: `Diamant ${div}`,
      color: '#00bfff',
      glow: '0 0 10px rgba(0, 191, 255, 0.5)'
    };
  }
  if (score < 1600) {
    let div = 'I';
    if (score >= 1500) div = 'III';
    else if (score >= 1400) div = 'II';
    return {
      name: `Champion ${div}`,
      color: '#df00ff',
      glow: '0 0 12px rgba(223, 0, 255, 0.6)'
    };
  }
  if (score < 2000) {
    return {
      name: 'Grand Champion',
      color: '#ff007f',
      glow: '0 0 15px rgba(255, 0, 127, 0.7)'
    };
  }
  return {
    name: 'Légende',
    color: '#ffffff',
    glow: '0 0 15px rgba(255, 255, 255, 0.8), 0 0 25px var(--accent)'
  };
};
