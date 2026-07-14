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

export const getRarityLabel = (rarity) => {
  switch (rarity) {
    case 'legendary': return 'Légendaire';
    case 'epic': return 'Épique';
    case 'rare': return 'Rare';
    default: return 'Commune';
  }
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

  const isLegendary = rarity === 'legendary';
  const isEpic = rarity === 'epic';
  const isRare = rarity === 'rare';
  const qty = parseInt(quantity, 10);

  if (isLocked) {
    return (
      <div
        className="glass-card"
        style={{
          width: '140px',
          height: '215px',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          borderRadius: '12px',
          border: '2px dashed var(--border-color)',
          background: 'linear-gradient(135deg, rgba(30, 41, 59, 0.7) 0%, rgba(15, 23, 42, 0.8) 100%)',
          position: 'relative',
          padding: '12px',
          boxShadow: 'inset 0 0 15px rgba(0,0,0,0.4)',
          cursor: 'default',
          ...style
        }}
      >
        <div style={{
          position: 'absolute',
          inset: '6px',
          border: '1px solid rgba(255,255,255,0.06)',
          borderRadius: '8px',
          pointerEvents: 'none'
        }} />
        <Lock size={20} style={{ color: 'var(--text-muted)', marginBottom: '8px', opacity: 0.6 }} />
        <span style={{ fontSize: '1.8rem', fontWeight: 900, color: 'var(--text-muted)', opacity: 0.3 }}>?</span>
        <span style={{ fontSize: '0.6rem', color: 'var(--text-muted)', marginTop: '8px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Bloquée</span>
      </div>
    );
  }

  const wrapperClass = `glass-card card-glow-${rarity} ${isFoil ? 'foil-card' : ''}`;

  return (
    <div
      className={wrapperClass}
      onClick={onClick}
      style={{
        width: '140px',
        height: '215px',
        display: 'flex',
        flexDirection: 'column',
        borderRadius: '12px',
        border: isLegendary 
          ? '2px solid #eab308' 
          : (isEpic 
            ? '2px solid #a855f7' 
            : (isRare 
              ? '2px solid #3b82f6' 
              : '2px solid #64748b')),
        background: 'linear-gradient(180deg, var(--bg-card) 0%, var(--bg-input) 100%)',
        position: 'relative',
        padding: '8px',
        boxShadow: isLegendary 
          ? '0 0 15px rgba(234,179,8,0.25)' 
          : (isEpic 
            ? '0 0 12px rgba(168,85,247,0.2)' 
            : (isRare 
              ? '0 0 10px rgba(59,130,246,0.15)' 
              : '0 4px 12px rgba(0,0,0,0.15)')),
        transition: 'transform 0.2s ease, box-shadow 0.2s ease',
        cursor: onClick ? 'pointer' : 'default',
        ...style
      }}
    >
      {/* Quantity / NEW Badge */}
      {isNew ? (
        <div style={{
          position: 'absolute',
          top: '-8px',
          left: '-8px',
          backgroundColor: 'var(--success)',
          color: '#ffffff',
          fontSize: '0.55rem',
          fontWeight: 900,
          padding: '2px 6px',
          borderRadius: '6px',
          boxShadow: '0 2px 5px rgba(0,0,0,0.4)',
          zIndex: 10
        }}>
          NEW
        </div>
      ) : qty > 1 ? (
        <div style={{
          position: 'absolute',
          top: '-8px',
          left: '-8px',
          minWidth: '20px',
          height: '20px',
          borderRadius: '50%',
          backgroundColor: 'var(--accent)',
          color: '#000000',
          fontSize: '0.7rem',
          fontWeight: 900,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          boxShadow: '0 2px 5px rgba(0,0,0,0.4)',
          zIndex: 10
        }}>
          {qty}
        </div>
      ) : null}

      {/* Header: Name and Rarity symbol */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px', width: '100%', zIndex: 2 }}>
        <span style={{ fontSize: '0.7rem', fontWeight: 850, maxWidth: '85px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', color: 'var(--text-primary)' }}>
          {name}
        </span>
        <span 
          className={`badge-${rarity}`} 
          style={{ 
            fontSize: '0.45rem', 
            padding: '1px 3px', 
            borderRadius: '3px', 
            textTransform: 'uppercase',
            fontWeight: 800
          }}
        >
          {rarity === 'legendary' ? 'LEG' : (rarity === 'epic' ? 'ÉPIQUE' : (rarity === 'rare' ? 'RARE' : 'COM'))}
        </span>
      </div>

      {/* Image Frame (800x600 ratio) */}
      <div style={{ 
        width: '100%', 
        aspectRatio: '4 / 3', 
        borderRadius: '6px', 
        overflow: 'hidden', 
        position: 'relative',
        border: '1px solid rgba(255,255,255,0.08)',
        boxShadow: 'inset 0 2px 4px rgba(0,0,0,0.3)',
        backgroundColor: '#000000',
        marginBottom: '6px',
        zIndex: 2
      }}>
        {(() => {
          const imgSrc = getCardImageSrc(id);
          return imgSrc ? (
            <img
              src={imgSrc}
              alt={name}
              style={{ width: '100%', height: '100%', objectFit: 'cover' }}
            />
          ) : (
            <div
              style={{
                position: 'absolute',
                inset: 0,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                textAlign: 'center',
                padding: '4px',
                color: 'var(--text-muted)',
                fontSize: '0.55rem',
                backgroundColor: 'var(--bg-input)'
              }}
            >
              <span>Image manquante</span>
            </div>
          );
        })()}
      </div>

      {/* Description Text Box */}
      <div style={{ 
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.2)',
        borderRadius: '6px',
        padding: '4px 6px',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        zIndex: 2
      }}>
        <p style={{ 
          fontSize: '0.55rem', 
          color: 'var(--text-secondary)', 
          lineHeight: '1.25',
          margin: 0,
          overflow: 'hidden',
          display: '-webkit-box',
          WebkitLineClamp: 3,
          WebkitBoxOrient: 'vertical',
          textAlign: 'center'
        }}>
          {description}
        </p>
      </div>

      {/* Small footer card index or set name */}
      <div style={{ display: 'flex', justifyContent: 'center', marginTop: '4px', zIndex: 2 }}>
        <span style={{ fontSize: '0.45rem', color: 'var(--text-muted)', fontStyle: 'italic' }}>
          {set}
        </span>
      </div>
    </div>
  );
}
