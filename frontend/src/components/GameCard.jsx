import React from 'react';
import { Lock } from 'lucide-react';

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

export const RARITY_CONFIG = {
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

export default function GameCard({
                                   card,
                                   quantity = 1,
                                   isLocked = false,
                                   isFoil = false,
                                   isNew = false,
                                   onClick,
                                   style = {}
                                 }) {
  if (!card) return null;

  const id = card.id || card.card_id;
  const name = card.name;
  const rarity = card.rarity || 'common';
  const set = card.set || card.card_set;
  const description = card.description;

  const cfg = RARITY_CONFIG[rarity] || RARITY_CONFIG.common;
  const qty = parseInt(quantity, 10);
  const imgSrc = getCardImageSrc(id);

  if (isLocked) {
    return (
        <div style={{
          width: '140px',
          height: '215px',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          borderRadius: '12px',
          border: '2px dashed rgba(100,116,139,0.4)',
          background: 'linear-gradient(135deg, rgba(20,26,37,0.85) 0%, rgba(10,14,22,0.9) 100%)',
          position: 'relative',
          cursor: 'default',
          ...style
        }}>
          <div style={{
            position: 'absolute', inset: '4px',
            border: '1px solid rgba(255,255,255,0.04)',
            borderRadius: '8px', pointerEvents: 'none',
          }} />
          <Lock size={18} style={{ color: '#475569', marginBottom: '8px', opacity: 0.5 }} />
          <span style={{ fontSize: '1.6rem', fontWeight: 900, color: '#1e293b', opacity: 0.6 }}>?</span>
          <span style={{ fontSize: '0.55rem', color: '#475569', marginTop: '6px', textTransform: 'uppercase', letterSpacing: '1px' }}>Bloquée</span>
        </div>
    );
  }

  const borderColor = cfg.border;
  const boxShadow = `0 0 0 1px #000, 0 0 0 2px ${borderColor}, 0 0 10px ${cfg.glow}, 0 0 22px ${cfg.glowSoft}, 0 4px 14px rgba(0,0,0,0.4)`;

  const getBgGradient = () => {
    switch(rarity) {
      case 'legendary': return 'linear-gradient(160deg, #2a1f00 0%, #0a0800 100%)';
      case 'epic': return 'linear-gradient(160deg, #1c0b2b 0%, #08030d 100%)';
      case 'rare': return 'linear-gradient(160deg, #0b182b 0%, #03080d 100%)';
      default: return 'linear-gradient(160deg, #1f2229 0%, #0a0b0e 100%)';
    }
  };

  const activeStars = rarity === 'legendary' ? 4 : rarity === 'epic' ? 3 : rarity === 'rare' ? 2 : 1;

  return (
      <div
          onClick={onClick}
          className={`card-glow-${rarity} ${isFoil ? 'foil-card' : ''}`}
          style={{
            width: '140px',
            height: '215px',
            display: 'flex',
            flexDirection: 'column',
            borderRadius: '12px',
            background: getBgGradient(),
            position: 'relative',
            padding: '6px',
            boxShadow,
            cursor: onClick ? 'pointer' : 'default',
            overflow: 'hidden',
            ...style
          }}
      >
        <div style={{
          position: 'absolute', inset: 0,
          backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)' opacity='0.05'/%3E%3C/svg%3E")`,
          pointerEvents: 'none', zIndex: 0, mixBlendMode: 'overlay',
        }} />

        <div style={{
          position: 'absolute', inset: '2px',
          border: `1px solid rgba(255,255,255,0.15)`,
          borderRadius: '10px', pointerEvents: 'none', zIndex: 1,
          boxShadow: `inset 0 0 8px rgba(0,0,0,0.5)`,
        }} />

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

        <div style={{
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          padding: '3px 5px', zIndex: 3, position: 'relative',
          background: 'linear-gradient(180deg, rgba(255,255,255,0.1) 0%, rgba(0,0,0,0.3) 100%)',
          border: '1px solid rgba(255,255,255,0.1)',
          borderRadius: '4px',
          boxShadow: '0 2px 4px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.2)',
          marginBottom: '6px',
          gap: '4px'
        }}>
        <span style={{
          fontSize: '0.55rem', fontWeight: 900,
          maxWidth: '75px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
          color: '#ffffff', textShadow: `0 1px 2px rgba(0,0,0,0.8), 0 0 4px ${cfg.glow}`,
          letterSpacing: '0.2px',
        }}>{name}</span>

          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '1px',
            minWidth: '35px',
            justifyContent: 'flex-end',
            flexShrink: 0
          }}>
            {[1, 2, 3, 4].map(num => {
              const isActive = num <= activeStars;
              return (
                  <svg
                      key={num}
                      viewBox="0 0 24 24"
                      width="8"
                      height="8"
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

        <div style={{
          width: '100%', aspectRatio: '4 / 3', borderRadius: '4px', overflow: 'hidden',
          position: 'relative', border: `1.5px solid ${borderColor}`,
          boxShadow: `0 4px 10px rgba(0,0,0,0.6)`,
          marginBottom: '6px', zIndex: 2, backgroundColor: '#000', flexShrink: 0,
        }}>
          {imgSrc ? (
              <img src={imgSrc} alt={name} style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
          ) : (
              <div style={{
                position: 'absolute', inset: 0, display: 'flex',
                alignItems: 'center', justifyContent: 'center',
                color: '#475569', fontSize: '0.5rem', backgroundColor: '#0c111a',
              }}><span>Image manquante</span></div>
          )}
        </div>

        <div style={{
          zIndex: 4, position: 'relative',
          marginTop: '-11px',
          alignSelf: 'center',
          background: '#0c111a',
          border: `1.5px solid ${borderColor}`,
          borderRadius: '10px',
          padding: '2px 8px',
          boxShadow: '0 2px 5px rgba(0,0,0,0.7)',
          display: 'flex', alignItems: 'center', justifyContent: 'center'
        }}>
        <span style={{
          fontSize: '0.45rem',
          color: '#e2e8f0',
          fontWeight: 800,
          textTransform: 'uppercase',
          letterSpacing: '0.5px'
        }}>
          {set}
        </span>
        </div>

        <div style={{
          flex: 1, marginTop: '4px', borderRadius: '4px', padding: '4px 6px',
          display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center',
          zIndex: 2, position: 'relative', overflow: 'hidden',
          border: '1px solid rgba(255,255,255,0.08)',
          background: 'rgba(0,0,0,0.5)',
          boxShadow: 'inset 0 2px 6px rgba(0,0,0,0.4)',
        }}>


          <div style={{
            position: 'absolute',
            inset: 0,
            overflow: 'hidden',
            opacity: 0.03,
            pointerEvents: 'none',
            zIndex: 0,
            userSelect: 'none',
            padding: '2px'
          }}>
            <span style={{
              display: 'block',
              fontSize: '0.3rem',
              fontWeight: 800,
              color: '#ffffff',
              textTransform: 'uppercase',
              letterSpacing: '0.5px',
              lineHeight: '1.3',
              wordBreak: 'break-all',
              textAlign: 'justify'
            }}>
              {`${name.replace(/\s+/g, '')}\u00A0`.repeat(100)}
            </span>
          </div>

          <p style={{
            fontSize: '0.5rem', color: '#cbd5e1', lineHeight: '1.3', margin: 0,
            overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 3,
            WebkitBoxOrient: 'vertical', textAlign: 'center',
            position: 'relative', zIndex: 1, textShadow: '0 1px 2px rgba(0,0,0,0.8)',
            fontWeight: 500
          }}>{description}</p>
        </div>
      </div>
  );
}