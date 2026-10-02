import React, { useRef, useEffect } from 'react';
import { Lock } from 'lucide-react';
import VanillaTilt from 'vanilla-tilt';

const cardImages = import.meta.glob('../assets/cards/*.{jpg,png,jpeg,webp,svg}', { eager: true });

export const getCardImageSrc = (cardId) => {
  if (!cardId) return null;
  const cleanId = cardId.replace('card_', '');
  const extensions = ['jpg', 'png', 'jpeg', 'webp', 'svg'];
  for (const ext of extensions) {
    const path = `../assets/cards/${cleanId}.${ext}`;
    if (cardImages[path]) {
      const mod = cardImages[path];
      return mod.default || mod;
    }
  }
  return null;
};

export const getRarityLabel = (rarity) => {
  switch (rarity) {
    case 'ultime':
    case 'ultimate': return 'Ultime';
    case 'legendary': return 'Légendaire';
    case 'epic': return 'Épique';
    case 'rare': return 'Rare';
    default: return 'Commune';
  }
};

export const SEASON_1_CARD_NUMBERS = {
  card_einstein: 1, card_curie: 2, card_napoleon: 3, card_cleopatre: 4, card_soleil: 5,
  card_da_vinci: 6, card_shakespeare: 7, card_gandhi: 8, card_mozart: 9, card_socrates: 10,
  card_eiffel: 11, card_muraille: 12, card_pyramides: 13, card_liberte: 14, card_colisee: 15,
  card_taj_mahal: 16, card_machu_picchu: 17, card_petra: 18, card_big_ben: 19, card_christ_redempteur: 20,
  card_f40: 21, card_chiron: 22, card_911: 23, card_fifix: 24, card_mustang: 25,
  card_beetle: 26, card_supra: 27, card_db5: 28, card_miata: 29, card_aventador: 30,
  card_apollo_11: 31, card_mars: 32, card_trou_noir: 33, card_curiosity: 34, card_voie_lactee: 35,
  card_supernova: 36, card_iss: 37, card_telescope_hubble: 38, card_etoile_filante: 39, card_lune: 40,
  card_zeus: 41, card_anubis: 42, card_odin: 43, card_kraken: 44, card_phenix: 45,
  card_minotaure: 46, card_satyre: 47, card_excalibur: 48, card_mjolnir: 49, card_pegase: 50,
  card_guepard: 51, card_orque: 52, card_tardigrade: 53, card_trex: 54, card_dodo: 55,
  card_megalodon: 56, card_tigre_blanc: 57, card_chat_gouttiere: 58, card_pigeon: 59, card_panda: 60,
  card_pizza: 61, card_sushi: 62, card_tacos: 63, card_truffe: 64, card_safran: 65,
  card_wagyu: 66, card_caviar: 67, card_croissant: 68, card_chips: 69, card_ramen: 70,
  card_quartz: 71, card_amethyste: 72, card_rubis_gem: 73, card_diamant: 74, card_meteorite: 75,
  card_emeraude_gem: 76, card_obsidienne: 77, card_jade: 78, card_charbon: 79, card_or_gem: 80,
  card_orage: 81, card_arc_en_ciel_phenomene: 82, card_tornade: 83, card_tsunami: 84, card_volcan: 85,
  card_aurore: 86, card_seisme: 87, card_eclipse: 88, card_geyser: 89, card_avalanche: 90,
  card_roue: 91, card_imprimerie: 92, card_ampoule: 93, card_avion: 94, card_ordinateur: 95,
  card_internet: 96, card_ia: 97, card_feu: 98, card_boussole: 99, card_telephone: 100,
  card_secret_101: 101
};

// Rarity visual config (shared with ShopScreen for the modal)
export const RARITY_CONFIG = {
  ultime: {
    border: '#ef4444',
    glow: 'rgba(239, 68, 68, 0.65)',
    glowSoft: 'rgba(239, 68, 68, 0.22)',
    badgeBg: 'linear-gradient(135deg, #f87171, #b91c1c)',
    badgeColor: '#fff',
    badgeShadow: '0 1px 8px rgba(239, 68, 68, 0.7)',
    label: 'ULT',
    stars: 5,
  },
  ultimate: {
    border: '#ef4444',
    glow: 'rgba(239, 68, 68, 0.65)',
    glowSoft: 'rgba(239, 68, 68, 0.22)',
    badgeBg: 'linear-gradient(135deg, #f87171, #b91c1c)',
    badgeColor: '#fff',
    badgeShadow: '0 1px 8px rgba(239, 68, 68, 0.7)',
    label: 'ULT',
    stars: 5,
  },
  legendary: {
    border: '#eab308',
    glow: 'rgba(234,179,8,0.55)',
    glowSoft: 'rgba(234,179,8,0.18)',
    badgeBg: 'linear-gradient(135deg, #fbbf24, #ca8a04)',
    badgeColor: '#fff',
    badgeShadow: '0 1px 6px rgba(234,179,8,0.6)',
    label: 'LEG',
    stars: 4,
  },
  epic: {
    border: '#a855f7',
    glow: 'rgba(168,85,247,0.5)',
    glowSoft: 'rgba(168,85,247,0.15)',
    badgeBg: 'linear-gradient(135deg, #c084fc, #7c3aed)',
    badgeColor: '#fff',
    badgeShadow: '0 1px 6px rgba(168,85,247,0.6)',
    label: 'ÉPQ',
    stars: 3,
  },
  rare: {
    border: '#3b82f6',
    glow: 'rgba(59,130,246,0.45)',
    glowSoft: 'rgba(59,130,246,0.12)',
    badgeBg: 'linear-gradient(135deg, #60a5fa, #1d4ed8)',
    badgeColor: '#fff',
    badgeShadow: '0 1px 6px rgba(59,130,246,0.5)',
    label: 'RARE',
    stars: 2,
  },
  common: {
    border: '#64748b',
    glow: 'rgba(100,116,139,0.25)',
    glowSoft: 'rgba(100,116,139,0.08)',
    badgeBg: 'linear-gradient(135deg, #94a3b8, #475569)',
    badgeColor: '#fff',
    badgeShadow: '0 1px 4px rgba(100,116,139,0.4)',
    label: 'COM',
    stars: 1,
  },
};

// Rarity Gem Badge — reusable for small card and modal
export function RarityGem({ rarity, config, size = 'sm' }) {
  const isLg = size === 'lg';
  const gemW = isLg ? 44 : 22;
  const gemH = isLg ? 44 : 22;
  const labelSize = isLg ? '0.65rem' : '0.38rem';
  const starSize = isLg ? '0.75rem' : '0.42rem';
  const starGap = isLg ? '3px' : '1px';
  const shineW = isLg ? '14px' : '7px';
  const shineH = isLg ? '8px' : '4px';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: isLg ? '4px' : '2px' }}>
      <div style={{
        width: `${gemW}px`,
        height: `${gemH}px`,
        background: config.badgeBg,
        boxShadow: config.badgeShadow,
        clipPath: 'polygon(50% 0%, 100% 38%, 82% 100%, 18% 100%, 0% 38%)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        position: 'relative',
        flexShrink: 0,
      }}>
        <div style={{
          position: 'absolute',
          top: isLg ? '6px' : '3px',
          left: isLg ? '10px' : '5px',
          width: shineW,
          height: shineH,
          background: 'rgba(255,255,255,0.45)',
          borderRadius: '50%',
          transform: 'rotate(-20deg)',
        }} />
        <span style={{
          fontSize: labelSize,
          fontWeight: 900,
          color: config.badgeColor,
          letterSpacing: isLg ? '0.5px' : '0px',
          lineHeight: 1,
          userSelect: 'none',
          position: 'relative',
          zIndex: 1,
          marginTop: isLg ? '10px' : '5px',
        }}>
          {config.label}
        </span>
      </div>
      {config.stars > 0 && (
        <div style={{ display: 'flex', gap: starGap }}>
          {Array.from({ length: config.stars }).map((_, i) => (
            <span key={i} style={{
              fontSize: starSize,
              color: config.badgeColor,
              filter: `drop-shadow(0 0 2px ${config.border})`,
              lineHeight: 1,
            }}>★</span>
          ))}
        </div>
      )}
    </div>
  );
}

// ==========================================
// UNIFIED GAME CARD
// ==========================================
export default function GameCard({
  card,
  quantity = 1,
  isLocked = false,
  isFoil = false,
  isNew = false,
  onClick,
  style = {},
  size = 'sm', // 'sm' | 'lg'
  showTilt = false,
  badge = null,
  width,
  height
}) {
  if (!card) return null;

  const tiltRef = useRef(null);
  const foilRef = useRef(null);

  const id = card.id || card.card_id;
  const name = card.name;
  const rarity = card.rarity || 'common';
  const set = card.set || card.card_set;
  const description = card.description;

  const cfg = RARITY_CONFIG[rarity] || RARITY_CONFIG.common;
  const qty = parseInt(quantity, 10);
  const imgSrc = getCardImageSrc(id);
  const borderColor = cfg.border;
  const seasonId = card.season_id ?? 1;
  const cardNumber = card.card_number
    || (id && SEASON_1_CARD_NUMBERS[id])
    || (typeof id === 'string' && id.match(/\d+/) ? parseInt(id.match(/\d+/)[0], 10) : null);
  const isCollector = !!card.is_collector || cardNumber === 101;

  // === LOCKED CARD ===
  if (isLocked) {
    const cardWidth = size === 'lg' ? (width || '380px') : '160px';
    const cardHeight = size === 'lg' ? (height || '560px') : '236px';
    const lockSize = size === 'lg' ? 48 : 20;
    const qSize = size === 'lg' ? '4rem' : '1.8rem';
    const textFontSize = size === 'lg' ? '1rem' : '0.6rem';
    return (
      <div style={{
        width: cardWidth,
        height: cardHeight,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        borderRadius: size === 'lg' ? '16px' : '12px',
        border: '2px dashed rgba(100,116,139,0.4)',
        background: 'linear-gradient(135deg, rgba(20,26,37,0.85) 0%, rgba(10,14,22,0.9) 100%)',
        position: 'relative',
        cursor: 'default',
        boxSizing: 'border-box',
        ...style
      }}>
        <div style={{
          position: 'absolute', inset: size === 'lg' ? '5px' : '3px',
          border: '1px solid rgba(255,255,255,0.04)',
          borderRadius: size === 'lg' ? '12px' : '10px', pointerEvents: 'none',
        }} />
        <Lock size={lockSize} style={{ color: '#475569', marginBottom: '8px', opacity: 0.5 }} />
        <span style={{ fontSize: qSize, fontWeight: 900, color: '#1e293b', opacity: 0.6 }}>?</span>
        <span style={{ fontSize: textFontSize, color: '#475569', marginTop: '6px', textTransform: 'uppercase', letterSpacing: '1px', fontWeight: 600 }}>Bloquée</span>
      </div>
    );
  }

  // === HOOKS & TILT FOR LARGE SIZES ===
  useEffect(() => {
    const el = tiltRef.current;
    if (!el || size !== 'lg') return;

    if (showTilt) {
      try {
        VanillaTilt.init(el, {
          max: 15,
          speed: 400,
          glare: false,
          scale: 1.05,
          perspective: 1200,
          transition: true,
        });
      } catch (e) {
        console.warn('VanillaTilt init error:', e);
      }
    }

    const updateFoilPosition = (x, y) => {
      if (!foilRef.current) return;
      const bgX = 100 - (x * 100);
      const bgY = 100 - (y * 100);
      foilRef.current.style.backgroundPosition = `${bgX}% ${bgY}%`;
      foilRef.current.style.opacity = (rarity === 'ultime' || rarity === 'ultimate') ? '0.45' : rarity === 'legendary' ? '0.3' : '0.8';
    };

    const handleMouseMove = (e) => {
      const rect = el.getBoundingClientRect();
      const x = (e.clientX - rect.left) / rect.width;
      const y = (e.clientY - rect.top) / rect.height;
      updateFoilPosition(x, y);
    };

    const handleMouseLeave = () => {
      if (foilRef.current) {
        foilRef.current.style.opacity = '0';
        foilRef.current.style.transition = 'opacity 0.4s ease-out';
      }
    };

    const handleMouseEnter = () => {
      if (foilRef.current) {
        foilRef.current.style.transition = 'none';
      }
    };

    // Mobile touch interaction with finger
    let isTouching = false;

    const applyTouchTilt = (clientX, clientY, animate = false) => {
      const rect = el.getBoundingClientRect();
      const rawX = (clientX - rect.left) / rect.width;
      const rawY = (clientY - rect.top) / rect.height;
      const x = Math.max(0, Math.min(1, rawX));
      const y = Math.max(0, Math.min(1, rawY));

      const maxTilt = 18;
      const rotateX = ((0.5 - y) * (maxTilt * 2)).toFixed(2);
      const rotateY = ((x - 0.5) * (maxTilt * 2)).toFixed(2);

      el.style.transition = animate ? 'transform 0.4s cubic-bezier(0.03, 0.98, 0.52, 0.99)' : 'none';
      el.style.transform = `perspective(1200px) rotateX(${rotateX}deg) rotateY(${rotateY}deg) scale3d(1.05, 1.05, 1.05)`;

      if (foilRef.current) {
        foilRef.current.style.transition = animate ? 'opacity 0.4s ease-out' : 'none';
      }
      updateFoilPosition(x, y);
    };

    const resetTouchTilt = () => {
      el.style.transition = 'transform 0.5s cubic-bezier(0.03, 0.98, 0.52, 0.99)';
      el.style.transform = 'perspective(1200px) rotateX(0deg) rotateY(0deg) scale3d(1, 1, 1)';

      if (foilRef.current) {
        foilRef.current.style.transition = 'opacity 0.5s ease-out';
        foilRef.current.style.opacity = '0';
      }
    };

    const handleTouchStart = (e) => {
      if (!showTilt || e.touches.length !== 1) return;
      isTouching = true;
      const touch = e.touches[0];
      applyTouchTilt(touch.clientX, touch.clientY, false);
    };

    const handleTouchMove = (e) => {
      if (!isTouching || e.touches.length !== 1) return;
      if (e.cancelable) e.preventDefault();
      const touch = e.touches[0];
      applyTouchTilt(touch.clientX, touch.clientY, false);
    };

    const handleTouchEnd = () => {
      if (!isTouching) return;
      isTouching = false;
      resetTouchTilt();
    };

    el.addEventListener('mousemove', handleMouseMove);
    el.addEventListener('mouseleave', handleMouseLeave);
    el.addEventListener('mouseenter', handleMouseEnter);

    el.addEventListener('touchstart', handleTouchStart, { passive: false });
    el.addEventListener('touchmove', handleTouchMove, { passive: false });
    el.addEventListener('touchend', handleTouchEnd);
    el.addEventListener('touchcancel', handleTouchEnd);

    return () => {
      if (showTilt) {
        try {
          const tiltInstance = el.vanillaTilt || el._vTilt;
          if (tiltInstance && typeof tiltInstance.destroy === 'function') {
            tiltInstance.destroy();
          }
        } catch (e) {
          // Ignore unmount destroy errors
        }
      }
      el.removeEventListener('mousemove', handleMouseMove);
      el.removeEventListener('mouseleave', handleMouseLeave);
      el.removeEventListener('mouseenter', handleMouseEnter);

      el.removeEventListener('touchstart', handleTouchStart);
      el.removeEventListener('touchmove', handleTouchMove);
      el.removeEventListener('touchend', handleTouchEnd);
      el.removeEventListener('touchcancel', handleTouchEnd);
    };
  }, [id, rarity, showTilt, size]);

  // Dimension computations
  const isLg = size === 'lg';
  const cardWidth = isLg ? (width || '380px') : '160px';
  const cardHeight = isLg ? (height || '560px') : '236px';
  const borderRadius = isLg ? '16px' : '8px';
  const outerBorder = isLg ? `3px solid ${borderColor}` : 'none';
  const padding = isLg ? '16px' : '8px 7px 7px 7px';
  const insetVal = isLg ? '4px' : '3px';
  const frameBorder = isLg ? '1px solid rgba(255,255,255,0.15)' : '1px solid rgba(255,255,255,0.12)';
  const frameRadius = isLg ? '12px' : '6px';
  const frameShadow = isLg ? 'inset 0 0 20px rgba(0,0,0,0.5)' : 'inset 0 0 10px rgba(0,0,0,0.5)';
  
  // Header values
  const headerPadding = isLg ? '10px 14px' : '3px 5px';
  const headerBorder = isLg ? '1px solid rgba(255,255,255,0.1)' : '1px solid rgba(255,255,255,0.08)';
  const headerRadius = isLg ? '8px' : '4px';
  const headerShadow = isLg ? '0 4px 10px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.2)' : '0 2px 4px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.2)';
  const headerMargin = isLg ? '14px' : '6px';
  const nameFontSize = isLg ? '1.1rem' : '0.4rem';
  const textGlow = isLg ? `0 2px 4px rgba(0,0,0,0.8), 0 0 10px ${cfg.glow}` : `0 1px 2px rgba(0,0,0,0.8), 0 0 4px ${cfg.glow}`;
  const nameMaxWidth = isLg ? '240px' : '100px';
  const starWidthHeight = isLg ? '16' : '8';
  const starMinWidth = isLg ? '70px' : '35px';

  // Image Frame values
  const imgBorder = isLg ? `3px solid ${borderColor}` : `1.6px solid ${borderColor}`;
  const imgShadow = isLg ? '0 8px 20px rgba(0,0,0,0.6)' : '0 3px 8px rgba(0,0,0,0.6)';
  const imgMargin = isLg ? '14px' : '5px';
  const imgRadius = isLg ? '8px' : '4px';

  // Set Badge values
  const setMargin = isLg ? '-31px' : '-14px';
  const setBorder = isLg ? `2px solid ${borderColor}` : `1.5px solid ${borderColor}`;
  const setRadius = isLg ? '20px' : '12px';
  const setPadding = isLg ? '4px 16px' : '2px 8px';
  const setShadow = isLg ? '0 4px 10px rgba(0,0,0,0.7)' : '0 2px 5px rgba(0,0,0,0.7)';
  const setFontSize = isLg ? '0.75rem' : '0.35rem';
  const setLetterSpacing = isLg ? '1px' : '0.5px';

  // Description box values
  const descMargin = isLg ? '8px' : '4px';
  const descRadius = isLg ? '8px' : '4px';
  const descPadding = isLg ? '16px' : '4px 6px';
  const descShadow = isLg ? 'inset 0 4px 15px rgba(0,0,0,0.4)' : 'inset 0 2px 6px rgba(0,0,0,0.4)';
  const bgTextFontSize = isLg ? '0.55rem' : '0.3rem';
  const bgTextPadding = isLg ? '4px' : '2px';
  const bgTextRepeat = isLg ? 300 : 100;
  const descFontSize = isLg ? '1.1rem' : '0.45rem';

  const getBgGradient = () => {
    switch(rarity) {
      case 'ultime':
      case 'ultimate': return 'linear-gradient(160deg, #3b0a0a 0%, #1a0303 100%)';
      case 'legendary': return 'linear-gradient(160deg, #2a1f00 0%, #0a0800 100%)';
      case 'epic': return 'linear-gradient(160deg, #1c0b2b 0%, #08030d 100%)';
      case 'rare': return 'linear-gradient(160deg, #0b182b 0%, #03080d 100%)';
      default: return 'linear-gradient(160deg, #1f2229 0%, #0a0b0e 100%)';
    }
  };

  const activeStars = (rarity === 'ultime' || rarity === 'ultimate') ? 5 : rarity === 'legendary' ? 4 : rarity === 'epic' ? 3 : rarity === 'rare' ? 2 : 1;
  const boxShadow = isLg 
    ? ((rarity === 'ultime' || rarity === 'ultimate')
      ? `0 0 0 1px #000, 0 0 0 3px ${borderColor}, 0 0 35px rgba(239,68,68,0.65), 0 25px 50px rgba(0,0,0,0.85)`
      : rarity === 'legendary'
        ? `0 0 0 1px #000, 0 0 0 3px ${borderColor}, 0 0 30px rgba(234,179,8,0.5), 0 25px 50px rgba(0,0,0,0.8)`
        : rarity === 'epic'
            ? `0 0 0 1px #000, 0 0 0 3px ${borderColor}, 0 0 25px rgba(168,85,247,0.5), 0 25px 50px rgba(0,0,0,0.8)`
            : rarity === 'rare'
                ? `0 0 0 1px #000, 0 0 0 3px ${borderColor}, 0 0 20px rgba(59,130,246,0.5), 0 25px 50px rgba(0,0,0,0.8)`
                : `0 0 0 1px #000, 0 0 0 3px ${borderColor}, 0 25px 50px rgba(0,0,0,0.8)`)
    : undefined;

  return (
    <div
      ref={tiltRef}
      onClick={onClick}
      className={`card-glow-${rarity} ${(isFoil && !isLg) ? 'foil-card' : ''}`}
      {...(isLg && showTilt ? { 'data-tilt': true } : {})}
      style={{
        cursor: isLg && showTilt ? 'url("data:image/svg+xml,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' width=\'16\' height=\'16\' viewBox=\'0 0 16 16\'%3E%3Ccircle cx=\'8\' cy=\'8\' r=\'2.5\' fill=\'white\' opacity=\'0.9\'/%3E%3C/svg%3E") 8 8, auto' : (onClick ? 'pointer' : 'default'),
        width: cardWidth,
        height: cardHeight,
        display: 'flex',
        flexDirection: 'column',
        borderRadius,
        border: outerBorder,
        position: 'relative',
        padding,
        boxShadow,
        transformStyle: 'preserve-3d',
        willChange: isLg && showTilt ? 'transform' : 'auto',
        touchAction: (isLg && showTilt) ? 'none' : 'auto',
        userSelect: (isLg && showTilt) ? 'none' : 'auto',
        WebkitUserSelect: (isLg && showTilt) ? 'none' : 'auto',
        WebkitTouchCallout: (isLg && showTilt) ? 'none' : 'default',
        ...style
      }}
    >
      {/* Background grain texture */}
      <div style={{
        position: 'absolute', inset: 0,
        borderRadius,
        backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)' opacity='0.05'/%3E%3C/svg%3E")`,
        pointerEvents: 'none', zIndex: 0, mixBlendMode: 'overlay',
      }} />

      {/* Frame double border overlay */}
      <div style={{
        position: 'absolute', inset: insetVal,
        border: frameBorder,
        borderRadius: frameRadius, pointerEvents: 'none', zIndex: 1,
        boxShadow: frameShadow,
      }} />

      {/* Foil holographic overlay (JS-driven, only for large size) */}
      {isLg && (
        <div
          ref={foilRef}
          style={{
            position: 'absolute', inset: 0,
            pointerEvents: 'none', zIndex: 10, opacity: 0,
            mixBlendMode: (rarity === 'ultime' || rarity === 'ultimate' || rarity === 'legendary') ? 'color-dodge' : 'overlay',
            backgroundImage: (rarity === 'ultime' || rarity === 'ultimate')
                ? 'linear-gradient(115deg, transparent 20%, rgba(239,68,68,0.6) 36%, rgba(251,146,60,0.5) 43%, rgba(255,255,255,0.7) 50%, rgba(220,38,38,0.6) 57%, rgba(239,68,68,0.5) 64%, transparent 80%)'
                : rarity === 'legendary'
                    ? 'linear-gradient(115deg, transparent 20%, rgba(255,215,0,0.5) 36%, rgba(255,105,180,0.4) 43%, rgba(0,255,255,0.5) 50%, rgba(138,43,226,0.4) 57%, rgba(255,215,0,0.5) 64%, transparent 80%)'
                    : 'linear-gradient(115deg, transparent 30%, rgba(255,255,255,0.4) 45%, rgba(255,255,255,0.8) 50%, rgba(255,255,255,0.4) 55%, transparent 70%)',
            backgroundSize: '250% 250%',
            borderRadius,
          }}
        />
      )}

      {/* Quantity / NEW Badge (Only for small size) */}
      {!isLg && (
        <>
          {isNew ? (
            <div style={{
              position: 'absolute', top: '-6px', left: '-6px', zIndex: 12,
              backgroundColor: '#16a34a', color: '#fff', fontSize: '0.45rem', fontWeight: 900,
              padding: '2px 5px', borderRadius: '4px', boxShadow: '0 2px 6px rgba(22,163,74,0.5)',
              textTransform: 'uppercase', letterSpacing: '0.5px',
            }}>NEW</div>
          ) : qty > 1 ? (
            <div style={{
              position: 'absolute', top: '-6px', left: '-6px', zIndex: 12,
              minWidth: '16px', height: '16px', borderRadius: '50%',
              backgroundColor: 'var(--accent)', color: '#000',
              fontSize: '0.55rem', fontWeight: 900,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              boxShadow: '0 2px 5px rgba(0,0,0,0.5)',
            }}>{qty}</div>
          ) : null}
        </>
      )}

      {/* Background fill */}
      <div style={{
        position: 'absolute', inset: 0,
        background: getBgGradient(),
        borderRadius,
        zIndex: 0
      }} />

      {/* HEADER Banner */}
      <div style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        padding: headerPadding, zIndex: 3, position: 'relative',
        background: 'linear-gradient(180deg, rgba(255,255,255,0.1) 0%, rgba(0,0,0,0.3) 100%)',
        border: headerBorder,
        borderRadius: headerRadius,
        boxShadow: headerShadow,
        marginBottom: headerMargin,
        gap: '4px'
      }}>
        <span style={{
          fontSize: nameFontSize, fontWeight: 900,
          maxWidth: nameMaxWidth, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
          color: '#ffffff', textShadow: textGlow,
          letterSpacing: '0.2px',
        }}>{name}</span>

        {/* Stars rating row */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '1px',
          minWidth: starMinWidth,
          justifyContent: 'flex-end',
          flexShrink: 0
        }}>
          {[1, 2, 3, 4].map(num => {
            const isActive = num <= activeStars;
            return (
              <svg
                key={num}
                viewBox="0 0 24 24"
                width={starWidthHeight}
                height={starWidthHeight}
                fill={isActive ? borderColor : "rgba(255,255,255,0.08)"}
                stroke={isActive ? "rgba(255,255,255,0.6)" : "rgba(255,255,255,0.05)"}
                strokeWidth="1.5"
                style={{
                  filter: isActive ? `drop-shadow(0 0 2px ${cfg.glow})` : 'none',
                  transform: isActive ? 'scale(1.1)' : 'scale(0.9)',
                }}
              >
                <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
              </svg>
            );
          })}
        </div>
      </div>

      {/* Image Frame */}
      <div style={{
        width: '100%', aspectRatio: '4 / 3', borderRadius: imgRadius, overflow: 'hidden',
        position: 'relative', border: imgBorder,
        boxShadow: imgShadow,
        marginBottom: imgMargin, zIndex: 2, backgroundColor: '#000', flexShrink: 0,
      }}>
        {imgSrc ? (
          <img src={imgSrc} alt={name} style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
        ) : (
          <div style={{
            position: 'absolute', inset: 0, display: 'flex',
            alignItems: 'center', justifyContent: 'center',
            color: '#475569', fontSize: isLg ? '0.85rem' : '0.5rem', backgroundColor: '#0c111a',
          }}><span>Image manquante</span></div>
        )}
      </div>

      {/* Set Badge overlapping image and description */}
      <div style={{
        zIndex: 4, position: 'relative',
        marginTop: setMargin,
        alignSelf: 'center',
        background: '#0c111a',
        border: setBorder,
        borderRadius: setRadius,
        padding: setPadding,
        boxShadow: setShadow,
        display: 'flex', alignItems: 'center', justifyContent: 'center'
      }}>
        <span style={{
          fontSize: setFontSize,
          color: '#e2e8f0',
          fontWeight: 800,
          textTransform: 'uppercase',
          letterSpacing: setLetterSpacing
        }}>
          {set}
        </span>
      </div>

      {/* Description box — blurred card as bg & giant background letter monogram overlay */}
      <div style={{
        flex: 1, minHeight: 0, marginTop: descMargin, borderRadius: descRadius, padding: descPadding,
        display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center',
        zIndex: 2, position: 'relative', overflow: 'hidden',
        border: '1px solid rgba(255,255,255,0.08)',
        background: 'rgba(0,0,0,0.5)',
        boxShadow: descShadow,
      }}>
        {/* Repeating Card name backdrop text */}
        <div style={{
          position: 'absolute',
          inset: 0,
          overflow: 'hidden',
          opacity: 0.04,
          pointerEvents: 'none',
          zIndex: 0,
          userSelect: 'none',
          padding: bgTextPadding
        }}>
          <span style={{
            display: 'block',
            fontSize: bgTextFontSize,
            fontWeight: 800,
            color: '#ffffff',
            textTransform: 'uppercase',
            letterSpacing: '1px',
            lineHeight: '1.4',
            wordBreak: 'break-all',
            textAlign: 'justify'
          }}>
            {`${name.replace(/\s+/g, '')}\u00A0`.repeat(bgTextRepeat)}
          </span>
        </div>

        <p style={{
          fontSize: descFontSize, color: '#cbd5e1', lineHeight: '1.5', margin: 0,
          overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: isLg ? 5 : 3,
          WebkitBoxOrient: 'vertical', textAlign: 'center',
          position: 'relative', zIndex: 1, textShadow: '0 1px 2px rgba(0,0,0,0.8)',
          fontWeight: 500
        }}>{description}</p>
      </div>

      {/* Card number & season footer */}
      {cardNumber && (
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          padding: isLg ? '6px 8px 0' : '3px 4px 0',
          zIndex: 4,
          fontSize: isLg ? '0.78rem' : '0.58rem',
          fontFamily: 'monospace',
          color: isCollector ? '#fbbf24' : '#94a3b8',
          fontWeight: 800,
          letterSpacing: '0.5px',
          borderTop: '1px solid rgba(255, 255, 255, 0.08)',
          marginTop: isLg ? '6px' : '3px',
          flexShrink: 0
        }}>
          <span>{isCollector ? '★ COLLECTOR' : `S${seasonId}`}</span>
          <span>#{String(cardNumber).padStart(3, '0')}/100</span>
        </div>
      )}

      {/* Injected custom badge (e.g. for booster reveal) */}
      {badge && badge}
    </div>
  );
}
