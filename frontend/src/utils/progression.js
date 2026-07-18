/** Progression and leveling utility helpers. */

/** Calculates the user level from total XP using a quadratic curve. */
export const getLevel = (xp) => Math.floor(Math.sqrt((xp || 0) / 200)) + 1;

/** Returns detailed progress for the current level. */
export const getLevelProgressDetails = (xp) => {
  const currentLevel = getLevel(xp);
  const currentLevelMinXp = 200 * Math.pow(currentLevel - 1, 2);
  const nextLevelMinXp = 200 * Math.pow(currentLevel, 2);

  return {
    currentLevelXp: Math.max(0, (xp || 0) - currentLevelMinXp),
    xpNeededForNextLevel: nextLevelMinXp - currentLevelMinXp
  };
};

/** Keeps username styling centralized for future cosmetic upgrades. */
export const getUsernameStyle = () => ({ fontWeight: '700' });

/** Returns the label associated with a user level. */
export const getLevelBadge = (level) => {
  if (level >= 15) return 'Elite des Quiz';
  if (level >= 10) return 'Connaisseur';
  if (level >= 5) return 'Initié';
  return 'Novice';
};
