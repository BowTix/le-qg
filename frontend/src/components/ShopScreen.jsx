import React, { useState, useEffect, useRef } from 'react';
import { api } from '../utils/api';
import { Coins, Sparkles, Check, CheckCircle2, Lock, Eye, EyeOff, Loader2, ArrowLeft, Trophy, CreditCard, X, ChevronLeft, ChevronRight, GraduationCap, Landmark, Car, Globe, Sword, Heart, Utensils, Gem, CloudLightning, Lightbulb } from 'lucide-react';
import { getUsernameStyle } from '../utils/progression';
import GameCard, { RARITY_CONFIG, getCardImageSrc as getImgSrc } from './GameCard';
import VanillaTilt from 'vanilla-tilt';

// Dynamically import all images in src/assets/cards/ using Vite's glob import
const cardImages = import.meta.glob('../assets/cards/*.{png,jpg,jpeg,webp,svg}', { eager: true, import: 'default' });

const DEFAULT_SETS_STATUS = {
  celebrities: false,
  monuments: false,
  cars: false,
  space: false,
  mythology: false,
  biodiversity: false,
  gastronomy: false,
  minerals: false,
  weather: false,
  inventions: false
};

const getCardImageSrc = (cardId) => {
  if (!cardId) return null;
  const cleanId = cardId.replace('card_', '');
  const extensions = ['jpg', 'png', 'jpeg', 'webp', 'svg'];
  for (const ext of extensions) {
    const path = `../assets/cards/${cleanId}.${ext}`;
    if (cardImages[path]) {
      return cardImages[path];
    }
  }
  return null;
};

export default function ShopScreen({ user, onRefreshProfile, onBack, mode = 'shop' }) {
  const [cachedData] = useState(() => {
    try {
      const cached = localStorage.getItem('cache_shop_data');
      return cached ? JSON.parse(cached) : null;
    } catch {
      return null;
    }
  });

  const [activeTab, setActiveTab] = useState(mode === 'collection' ? 'album' : 'cosmetics');
  const [loading, setLoading] = useState(!cachedData);
  const [error, setError] = useState('');
  
  // Data from backend
  const [coins, setCoins] = useState(() => cachedData ? cachedData.coins : 0);
  const [equipped, setEquipped] = useState(() => cachedData ? cachedData.equipped : { border: null, color: null, title: null });
  const [catalog, setCatalog] = useState(() => cachedData ? cachedData.catalog : { cosmetics: [], cards: [] });
  const [unlockedCards, setUnlockedCards] = useState(() => cachedData ? cachedData.unlocked_cards : {});
  const [unlockedCosmetics, setUnlockedCosmetics] = useState(() => cachedData ? cachedData.unlocked_cosmetics : []);
  const [setsStatus, setSetsStatus] = useState(() => cachedData ? cachedData.sets_status : DEFAULT_SETS_STATUS);

  // Purchase/Action states
  const [buyingItemId, setBuyingItemId] = useState(null);
  const [equippingItem, setEquippingItem] = useState(null);
  const [openingBooster, setOpeningBooster] = useState(false);
  const [boosterPhase, setBoosterPhase] = useState('idle'); // 'idle' | 'shaking' | 'revealing'
  const [drawnCards, setDrawnCards] = useState([]); // array of { card, is_new, quantity, unlocked_sets }
  const [flippedCards, setFlippedCards] = useState([false, false, false]);
  const [zoomedCard, setZoomedCard] = useState(null);

  // (3D/foil logic now lives inside ZoomedCardModal component)

  // Filtering & Sorting states
  const [viewMode, setViewMode] = useState('sets'); // 'sets' | 'global'
  const [filterOwned, setFilterOwned] = useState('all'); // 'all' | 'owned' | 'missing'
  const [filterRarity, setFilterRarity] = useState('all'); // 'all' | 'common' | 'rare' | 'legendary'
  const [sortBy, setSortBy] = useState('default'); // 'default' | 'rarity' | 'name'

  // Get all owned cards in order to navigate inside zoom modal
  const ownedCardsList = catalog.cards.filter(c => unlockedCards[c.id] && unlockedCards[c.id] > 0);
  const currentZoomIndex = zoomedCard ? ownedCardsList.findIndex(c => c.id === zoomedCard.id) : -1;

  const handlePrevZoomCard = (e) => {
    if (e) e.stopPropagation();
    if (ownedCardsList.length <= 1 || currentZoomIndex === -1) return;
    const newIdx = (currentZoomIndex - 1 + ownedCardsList.length) % ownedCardsList.length;
    setZoomedCard(ownedCardsList[newIdx]);
  };

  const handleNextZoomCard = (e) => {
    if (e) e.stopPropagation();
    if (ownedCardsList.length <= 1 || currentZoomIndex === -1) return;
    const newIdx = (currentZoomIndex + 1) % ownedCardsList.length;
    setZoomedCard(ownedCardsList[newIdx]);
  };

  const _handleCardMouseMove_REMOVED = (e) => {
    const percentX = (0 / 1) * 100;
    const percentY = (y / rect.height) * 100;
    setShinePos({ x: percentX, y: percentY });
  };

  useEffect(() => {
    if (!zoomedCard) return;
    const handleKeyDown = (e) => {
      if (e.key === 'ArrowLeft') {
        handlePrevZoomCard();
      } else if (e.key === 'ArrowRight') {
        handleNextZoomCard();
      } else if (e.key === 'Escape') {
        setZoomedCard(null);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [zoomedCard, currentZoomIndex]);

  useEffect(() => {
    fetchCollectionData();
  }, []);

  const fetchCollectionData = async () => {
    if (!localStorage.getItem('cache_shop_data')) {
      setLoading(true);
    }
    try {
      const res = await api.get('/shop/collection');
      if (res.success) {
        setCoins(res.coins);
        setEquipped(res.equipped);
        setCatalog(res.catalog);
        setUnlockedCards(res.unlocked_cards || {});
        setUnlockedCosmetics(res.unlocked_cosmetics || []);
        setSetsStatus(res.sets_status || DEFAULT_SETS_STATUS);
        localStorage.setItem('cache_shop_data', JSON.stringify(res));
      } else {
        setError(res.error || 'Erreur lors de la récupération des données.');
      }
    } catch (err) {
      console.error(err);
      setError('Impossible de se connecter au serveur.');
    } finally {
      setLoading(false);
    }
  };

  const handleBuyCosmetic = async (item) => {
    if (buyingItemId) return;
    setBuyingItemId(item.id);
    try {
      const res = await api.post('/shop/buy-cosmetic', { item_id: item.id });
      if (res.success) {
        setCoins(res.new_coins);
        setUnlockedCosmetics(prev => [...prev, { type: item.type, value: item.value }]);
        onRefreshProfile(); // Sync profile stats in main app header
      } else {
        alert(res.error || 'Échec de l\'achat.');
      }
    } catch (err) {
      console.error(err);
      alert('Erreur lors de l\'achat.');
    } finally {
      setBuyingItemId(null);
    }
  };

  const handleEquipItem = async (type, value) => {
    const actionKey = `${type}_${value}`;
    if (equippingItem) return;
    setEquippingItem(actionKey);

    const isCurrent = equipped[type] === value;
    const targetValue = isCurrent ? null : value; // Toggle off if already equipped

    try {
      const res = await api.post('/shop/equip', { item_type: type, item_value: targetValue });
      if (res.success) {
        setEquipped(prev => ({ ...prev, [type]: targetValue }));
        onRefreshProfile();
      } else {
        alert(res.error || 'Impossible d\'équiper cet article.');
      }
    } catch (err) {
      console.error(err);
      alert('Erreur lors de l\'équipement.');
    } finally {
      setEquippingItem(null);
    }
  };

  const handleBuyBooster = async () => {
    if (openingBooster) return;
    setOpeningBooster(true);
    setBoosterPhase('shaking');
    setFlippedCards([false, false, false]);
    setDrawnCards([]);

    try {
      // Small artificial delay for visual shake effect
      await new Promise(resolve => setTimeout(resolve, 800));

      const res = await api.post('/shop/buy-booster');
      if (res.success) {
        setCoins(res.new_coins);
        setDrawnCards(res.drawn_cards);
        setBoosterPhase('revealing');
        // Refresh collection data silently in the background
        await fetchCollectionDataSilent();
        onRefreshProfile();
      } else {
        alert(res.error || 'Erreur lors de l\'ouverture du booster.');
        setBoosterPhase('idle');
      }
    } catch (err) {
      console.error(err);
      alert('Impossible d\'ouvrir le booster.');
      setBoosterPhase('idle');
    } finally {
      setOpeningBooster(false);
    }
  };

  const fetchCollectionDataSilent = async () => {
    try {
      const res = await api.get('/shop/collection');
      if (res.success) {
        setEquipped(res.equipped);
        setUnlockedCards(res.unlocked_cards || {});
        setUnlockedCosmetics(res.unlocked_cosmetics || []);
        setSetsStatus(res.sets_status || DEFAULT_SETS_STATUS);
        localStorage.setItem('cache_shop_data', JSON.stringify(res));
      }
    } catch (err) {
      console.error(err);
    }
  };

  const flipCard = (index) => {
    setFlippedCards(prev => {
      const copy = [...prev];
      copy[index] = true;
      return copy;
    });
  };

  const isCosmeticOwned = (type, value) => {
    return unlockedCosmetics.some(c => c.type === type && c.value === value);
  };

  // Groups cards by sets dynamically using catalog definitions
  const SETS_METADATA = {
    'Les Célébrités': { key: 'celebrities', title: 'Les Célébrités', reward: 'Titre : Le Génie Historique', icon: GraduationCap },
    'Les Monuments': { key: 'monuments', title: 'Les Monuments', reward: 'Bordure d\'avatar : Cosmique', icon: Landmark },
    'Les Voitures': { key: 'cars', title: 'Les Voitures', reward: 'Pseudo : Arc-en-ciel (Animé)', icon: Car },
    'L\'Espace et l\'Astronomie': { key: 'space', title: 'L\'Espace et l\'Astronomie', reward: 'Bordure d\'avatar : Nébuleuse', icon: Globe },
    'Mythologie et Légendes': { key: 'mythology', title: 'Mythologie et Légendes', reward: 'Titre : Le Demi-Dieu', icon: Sword },
    'Animaux et Biodiversité': { key: 'biodiversity', title: 'Animaux et Biodiversité', reward: 'Titre : Le Prédateur Alpha', icon: Heart },
    'Gastronomie du Monde': { key: 'gastronomy', title: 'Gastronomie du Monde', reward: 'Titre : Le Chef Étoilé', icon: Utensils },
    'Cristaux et Minéraux': { key: 'minerals', title: 'Cristaux et Minéraux', reward: 'Bordure d\'avatar : Cristal', icon: Gem },
    'Phénomènes Naturels': { key: 'weather', title: 'Phénomènes Naturels', reward: 'Bordure d\'avatar : Tempête', icon: CloudLightning },
    'Les Grandes Inventions': { key: 'inventions', title: 'Les Grandes Inventions', reward: 'Pseudo : Néon Cyberpunk', icon: Lightbulb }
  };

  const cardSets = Object.entries(SETS_METADATA).map(([dbSetName, meta]) => {
    const cardIds = catalog.cards
      .filter(c => c.set === dbSetName)
      .map(c => c.id);

    return {
      id: meta.key,
      title: meta.title,
      cardIds: cardIds,
      reward: meta.reward,
      icon: meta.icon,
      isUnlocked: !!setsStatus[meta.key]
    };
  }).filter(set => set.cardIds.length > 0);

  const getFilteredGlobalCards = () => {
    let list = [...catalog.cards];

    // Filter by ownership
    if (filterOwned === 'owned') {
      list = list.filter(c => unlockedCards[c.id] && unlockedCards[c.id] > 0);
    } else if (filterOwned === 'missing') {
      list = list.filter(c => !unlockedCards[c.id] || unlockedCards[c.id] <= 0);
    }

    // Filter by rarity
    if (filterRarity !== 'all') {
      list = list.filter(c => c.rarity === filterRarity);
    }

    // Sort
    if (sortBy === 'name') {
      list.sort((a, b) => a.name.localeCompare(b.name));
    } else if (sortBy === 'rarity') {
      const rarityWeight = { legendary: 4, epic: 3, rare: 2, common: 1 };
      list.sort((a, b) => (rarityWeight[b.rarity] || 0) - (rarityWeight[a.rarity] || 0));
    }

    return list;
  };

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center p-8">
        <Loader2 size={32} className="animate-spin" style={{ color: 'var(--accent)' }} />
        <span style={{ marginLeft: '12px', color: 'var(--text-secondary)' }}>
          {mode === 'collection' ? "Chargement de l'Album de Collection..." : "Chargement de la Boutique..."}
        </span>
      </div>
    );
  }

  return (
    <>
      <div className="container animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      
      {/* Header section */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <button className="btn-secondary" onClick={onBack} style={{ padding: '8px 12px', marginBottom: '8px' }}>
            <ArrowLeft size={16} /> Retour
          </button>
          <h1 style={{ fontSize: '1.8rem', fontWeight: 800 }}>
            {mode === 'collection' ? 'Mon Album de Collection' : 'Boutique du QG'}
          </h1>
        </div>

        {/* Coins indicator */}
        <div className="glass-card" style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 16px', borderRadius: '12px' }}>
          <Coins size={22} style={{ color: '#ffb300' }} />
          <div>
            <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Mon solde</div>
            <div style={{ fontSize: '1.15rem', fontWeight: 800, color: 'var(--text-primary)' }}>{coins} 🪙</div>
          </div>
        </div>
      </div>

      {/* Tabs - Only displayed in shop mode */}
      {mode === 'shop' && (
        <div className="tab-container" style={{ display: 'flex', gap: '8px', borderBottom: '1px solid var(--border-color)', paddingBottom: '1px' }}>
          <button
            className={`tab-btn ${activeTab === 'cosmetics' ? 'active' : ''}`}
            onClick={() => setActiveTab('cosmetics')}
          >
            <Sparkles size={16} /> Boutique de Cosmétiques
          </button>
          <button
            className={`tab-btn ${activeTab === 'booster' ? 'active' : ''}`}
            onClick={() => setActiveTab('booster')}
          >
            <Sparkles size={16} /> Booster de Cartes
          </button>
        </div>
      )}

      {/* Tab Contents */}

      {/* 1. COSMETICS SHOP TAB */}
      {activeTab === 'cosmetics' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '32px' }}>
          
          {/* Colors section */}
          <div>
            <h3 style={{ fontSize: '1rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '8px', marginBottom: '16px' }}>
              🎨 Couleurs de Pseudo
            </h3>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: '16px' }}>
              {catalog.cosmetics.filter(c => c.type === 'color').map(item => {
                const owned = isCosmeticOwned(item.type, item.value);
                const current = equipped[item.type] === item.value;

                return (
                  <div key={item.id} className="glass-card" style={{ display: 'flex', flexDirection: 'column', gap: '16px', position: 'relative' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                      <span className={`badge-${item.rarity}`} style={{ fontSize: '0.65rem', textTransform: 'uppercase', padding: '2px 6px', borderRadius: '4px' }}>
                        {item.rarity}
                      </span>
                      {owned && <span style={{ fontSize: '0.75rem', color: 'var(--success)', fontWeight: 600 }}>Possédé</span>}
                    </div>

                    <div style={{ textAlign: 'center', padding: '10px 0' }}>
                      <span
                        className={item.value === 'rainbow' ? 'text-rainbow' : (item.value === 'cyberpunk' ? 'text-cyberpunk' : '')}
                        style={{
                          fontSize: '1.2rem',
                          fontWeight: 800,
                          color: !['rainbow', 'cyberpunk'].includes(item.value) ? item.value : 'inherit'
                        }}
                      >
                        {item.name}
                      </span>
                    </div>

                    <div style={{ display: 'flex', gap: '8px', marginTop: 'auto' }}>
                      {owned ? (
                        <button
                          className={`w-full ${current ? 'btn-secondary' : 'btn-primary'}`}
                          style={{ padding: '8px', fontSize: '0.85rem' }}
                          onClick={() => handleEquipItem(item.type, item.value)}
                        >
                          {current ? 'Déséquiper' : 'Équiper'}
                        </button>
                      ) : (
                        <button
                          className="btn-primary w-full"
                          disabled={item.exclusive || coins < item.price || buyingItemId === item.id}
                          onClick={() => handleBuyCosmetic(item)}
                          style={{ padding: '8px', fontSize: '0.85rem', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '6px' }}
                        >
                          {buyingItemId === item.id ? (
                            <Loader2 size={14} className="animate-spin" />
                          ) : item.exclusive ? (
                            <>
                              <Lock size={14} /> Exclusif Card Set
                            </>
                          ) : (
                            <>
                              Acheter — {item.price} 🪙
                            </>
                          )}
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Borders section */}
          <div>
            <h3 style={{ fontSize: '1rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '8px', marginBottom: '16px' }}>
              🖼️ Bordures d'Avatar
            </h3>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: '16px' }}>
              {catalog.cosmetics.filter(c => c.type === 'border').map(item => {
                const owned = isCosmeticOwned(item.type, item.value);
                const current = equipped[item.type] === item.value;

                return (
                  <div key={item.id} className="glass-card" style={{ display: 'flex', flexDirection: 'column', gap: '16px', position: 'relative' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                      <span className={`badge-${item.rarity}`} style={{ fontSize: '0.65rem', textTransform: 'uppercase', padding: '2px 6px', borderRadius: '4px' }}>
                        {item.rarity}
                      </span>
                      {owned && <span style={{ fontSize: '0.75rem', color: 'var(--success)', fontWeight: 600 }}>Possédé</span>}
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '10px' }}>
                      <div className={item.value} style={{
                        width: '56px', height: '56px', borderRadius: '50%',
                        backgroundColor: 'var(--bg-input)', display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: '1.2rem'
                      }}>
                        👤
                      </div>
                      <span style={{ fontWeight: 700, fontSize: '0.95rem' }}>{item.name}</span>
                    </div>

                    <div style={{ display: 'flex', gap: '8px', marginTop: 'auto' }}>
                      {owned ? (
                        <button
                          className={`w-full ${current ? 'btn-secondary' : 'btn-primary'}`}
                          style={{ padding: '8px', fontSize: '0.85rem' }}
                          onClick={() => handleEquipItem(item.type, item.value)}
                        >
                          {current ? 'Déséquiper' : 'Équiper'}
                        </button>
                      ) : (
                        <button
                          className="btn-primary w-full"
                          disabled={item.exclusive || coins < item.price || buyingItemId === item.id}
                          onClick={() => handleBuyCosmetic(item)}
                          style={{ padding: '8px', fontSize: '0.85rem', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '6px' }}
                        >
                          {buyingItemId === item.id ? (
                            <Loader2 size={14} className="animate-spin" />
                          ) : item.exclusive ? (
                            <>
                              <Lock size={14} /> Exclusif Card Set
                            </>
                          ) : (
                            <>
                              Acheter — {item.price} 🪙
                            </>
                          )}
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Titles section */}
          <div>
            <h3 style={{ fontSize: '1rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '8px', marginBottom: '16px' }}>
              🎖️ Titres Honorifiques
            </h3>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: '16px' }}>
              {catalog.cosmetics.filter(c => c.type === 'title').map(item => {
                const owned = isCosmeticOwned(item.type, item.value);
                const current = equipped[item.type] === item.value;

                return (
                  <div key={item.id} className="glass-card" style={{ display: 'flex', flexDirection: 'column', gap: '16px', position: 'relative' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                      <span className={`badge-${item.rarity}`} style={{ fontSize: '0.65rem', textTransform: 'uppercase', padding: '2px 6px', borderRadius: '4px' }}>
                        {item.rarity}
                      </span>
                      {owned && <span style={{ fontSize: '0.75rem', color: 'var(--success)', fontWeight: 600 }}>Possédé</span>}
                    </div>

                    <div style={{ textAlign: 'center', padding: '10px 0' }}>
                      <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Titre équipé</span>
                      <div style={{ fontSize: '1.05rem', fontWeight: 700, fontStyle: 'italic', color: 'var(--text-primary)', marginTop: '4px' }}>
                        "{item.value}"
                      </div>
                    </div>

                    <div style={{ display: 'flex', gap: '8px', marginTop: 'auto' }}>
                      {owned ? (
                        <button
                          className={`w-full ${current ? 'btn-secondary' : 'btn-primary'}`}
                          style={{ padding: '8px', fontSize: '0.85rem' }}
                          onClick={() => handleEquipItem(item.type, item.value)}
                        >
                          {current ? 'Déséquiper' : 'Équiper'}
                        </button>
                      ) : (
                        <button
                          className="btn-primary w-full"
                          disabled={item.exclusive || coins < item.price || buyingItemId === item.id}
                          onClick={() => handleBuyCosmetic(item)}
                          style={{ padding: '8px', fontSize: '0.85rem', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '6px' }}
                        >
                          {buyingItemId === item.id ? (
                            <Loader2 size={14} className="animate-spin" />
                          ) : item.exclusive ? (
                            <>
                              <Lock size={14} /> Exclusif Card Set
                            </>
                          ) : (
                            <>
                              Acheter — {item.price} 🪙
                            </>
                          )}
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

        </div>
      )}

      {/* 2. CARD ALBUM TAB */}
      {activeTab === 'album' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          
          {/* Filtering and View Toggles Bar */}
          <div className="glass-card" style={{ 
            padding: '16px 20px', 
            display: 'flex', 
            justifyContent: 'space-between', 
            alignItems: 'center', 
            flexWrap: 'wrap', 
            gap: '16px',
            background: 'rgba(255,255,255,0.03)',
            borderRadius: '16px',
            border: '1px solid rgba(255,255,255,0.08)'
          }}>
            
            {/* View Mode Switcher */}
            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
              <button 
                onClick={() => setViewMode('sets')}
                className={viewMode === 'sets' ? 'btn-primary' : 'btn-secondary'}
                style={{ padding: '6px 12px', fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '6px', borderRadius: '8px' }}
              >
                <Trophy size={14} /> Vue par Sets
              </button>
              <button 
                onClick={() => setViewMode('global')}
                className={viewMode === 'global' ? 'btn-primary' : 'btn-secondary'}
                style={{ padding: '6px 12px', fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '6px', borderRadius: '8px' }}
              >
                <Eye size={14} /> Galerie Globale
              </button>
            </div>

            {/* Filters Controls */}
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px', alignItems: 'center' }}>
              
              {/* Ownership filter */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 700 }}>Possession</span>
                <select 
                  value={filterOwned} 
                  onChange={(e) => setFilterOwned(e.target.value)}
                  style={{
                    backgroundColor: 'var(--bg-input)',
                    border: '1px solid var(--border-color)',
                    color: 'var(--text-primary)',
                    borderRadius: '8px',
                    padding: '6px 10px',
                    fontSize: '0.85rem',
                    outline: 'none',
                    cursor: 'pointer'
                  }}
                >
                  <option value="all">Toutes</option>
                  <option value="owned">Possédées</option>
                  <option value="missing">Manquantes</option>
                </select>
              </div>

              {/* Rarity filter */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 700 }}>Rareté</span>
                <select 
                  value={filterRarity} 
                  onChange={(e) => setFilterRarity(e.target.value)}
                  style={{
                    backgroundColor: 'var(--bg-input)',
                    border: '1px solid var(--border-color)',
                    color: 'var(--text-primary)',
                    borderRadius: '8px',
                    padding: '6px 10px',
                    fontSize: '0.85rem',
                    outline: 'none',
                    cursor: 'pointer'
                  }}
                >
                  <option value="all">Toutes raretés</option>
                  <option value="common">Commune</option>
                  <option value="rare">Rare</option>
                  <option value="legendary">Légendaire</option>
                </select>
              </div>

              {/* Sort by selector */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 700 }}>Trier par</span>
                <select 
                  value={sortBy} 
                  onChange={(e) => setSortBy(e.target.value)}
                  style={{
                    backgroundColor: 'var(--bg-input)',
                    border: '1px solid var(--border-color)',
                    color: 'var(--text-primary)',
                    borderRadius: '8px',
                    padding: '6px 10px',
                    fontSize: '0.85rem',
                    outline: 'none',
                    cursor: 'pointer'
                  }}
                >
                  <option value="default">Par défaut</option>
                  <option value="rarity">Rareté (Desc)</option>
                  <option value="name">Nom (A-Z)</option>
                </select>
              </div>

            </div>

          </div>

          {viewMode === 'sets' && cardSets.map(set => {
            // Filter cardIds in this set according to current filter state
            const filteredCardIds = set.cardIds.filter(cid => {
              const card = catalog.cards.find(c => c.id === cid);
              if (!card) return false;
              
              // Filter by ownership
              const isOwned = unlockedCards[cid] && unlockedCards[cid] > 0;
              if (filterOwned === 'owned' && !isOwned) return false;
              if (filterOwned === 'missing' && isOwned) return false;

              // Filter by rarity
              if (filterRarity !== 'all' && card.rarity !== filterRarity) return false;

              return true;
            });

            if (filteredCardIds.length === 0) return null;

            // Count cards in this set owned
            const ownedInSet = set.cardIds.filter(cid => unlockedCards[cid] && unlockedCards[cid] > 0).length;
            const progressRatio = ownedInSet / set.cardIds.length;

            return (
              <div key={set.id} className="glass-card" style={{ display: 'flex', flexDirection: 'column', gap: '20px', padding: '24px' }}>
                
                {/* Set Header */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
                  {(() => {
                    const IconComponent = set.icon || Trophy;
                    return (
                      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <div style={{
                          backgroundColor: 'rgba(255, 255, 255, 0.04)',
                          padding: '8px',
                          borderRadius: '8px',
                          color: 'var(--accent)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center'
                        }}>
                          <IconComponent size={20} />
                        </div>
                        <div>
                          <h2 style={{ fontSize: '1.25rem', fontWeight: 800, margin: 0 }}>{set.title}</h2>
                          <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                            Progression : {ownedInSet} / {set.cardIds.length} cartes collectées
                          </span>
                        </div>
                      </div>
                    );
                  })()}

                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '4px' }}>
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Récompense exclusive</span>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      {set.isUnlocked ? (
                        <CheckCircle2 size={18} style={{ color: 'var(--success)' }} />
                      ) : (
                        <Lock size={16} style={{ color: 'var(--text-muted)' }} />
                      )}
                      <span style={{
                        fontSize: '0.85rem',
                        fontWeight: 700,
                        color: set.isUnlocked ? 'var(--success)' : 'var(--text-secondary)'
                      }}>
                        {set.reward}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Progress bar */}
                <div style={{ width: '100%', height: '6px', backgroundColor: 'var(--border-color)', borderRadius: '3px', overflow: 'hidden' }}>
                  <div style={{
                    width: `${progressRatio * 100}%`,
                    height: '100%',
                    backgroundColor: progressRatio === 1 ? 'var(--success)' : 'var(--accent)',
                    transition: 'width 0.4s ease'
                  }} />
                </div>

                {(() => {
                  const sortedCardIds = [...filteredCardIds].sort((aId, bId) => {
                    const a = catalog.cards.find(c => c.id === aId);
                    const b = catalog.cards.find(c => c.id === bId);
                    if (!a || !b) return 0;

                    if (sortBy === 'name') {
                      return a.name.localeCompare(b.name);
                    } else if (sortBy === 'rarity') {
                      const rarityWeight = { legendary: 4, epic: 3, rare: 2, common: 1 };
                      return (rarityWeight[b.rarity] || 0) - (rarityWeight[a.rarity] || 0);
                    }
                    return 0;
                  });

                  return (
                    <div style={{
                      display: 'grid',
                      gridTemplateColumns: 'repeat(5, 140px)',
                      gap: '24px 16px',
                      justifyContent: 'center',
                      justifyItems: 'center',
                      width: '100%'
                    }}>
                      {sortedCardIds.map(cid => {
                        const card = catalog.cards.find(c => c.id === cid);
                    const qty = unlockedCards[cid] || 0;
                    const owned = qty > 0;

                    if (!card) return null;

                    if (!owned) {
                      // Mystery card back design
                      return (
                        <div
                          key={cid}
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
                            cursor: 'default'
                          }}
                        >
                          {/* Inner gold frame border */}
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

                    // Unlocked card face design (using reusable GameCard)
                    return (
                      <GameCard
                        key={cid}
                        card={card}
                        quantity={qty}
                        isFoil={true}
                        onClick={() => setZoomedCard(card)}
                      />
                      );
                    })}
                  </div>
                );
              })()}

              </div>
            );
          })}

          {viewMode === 'global' && (
            <div className="glass-card" style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
                <h2 style={{ fontSize: '1.25rem', fontWeight: 800 }}>Toutes les cartes</h2>
                <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                  {(() => {
                    const totalOwned = catalog.cards.filter(c => unlockedCards[c.id] && unlockedCards[c.id] > 0).length;
                    return `Total possédées : ${totalOwned} / ${catalog.cards.length} (${Math.round((totalOwned / catalog.cards.length) * 100)}%)`;
                  })()}
                </span>
              </div>

              {(() => {
                const globalCards = getFilteredGlobalCards();
                if (globalCards.length === 0) {
                  return (
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '60px 20px', color: 'var(--text-muted)', gap: '10px' }}>
                      <EyeOff size={32} style={{ opacity: 0.6 }} />
                      <span>Aucune carte ne correspond aux critères de recherche.</span>
                    </div>
                  );
                }

                return (
                  <div style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))',
                    gap: '24px 16px',
                    justifyItems: 'center'
                  }}>
                    {globalCards.map(card => {
                      const cid = card.id;
                      const qty = unlockedCards[cid] || 0;
                      const owned = qty > 0;

                      return (
                        <GameCard
                          key={cid}
                          card={card}
                          quantity={qty}
                          isLocked={!owned}
                          isFoil={owned}
                          onClick={owned ? () => setZoomedCard(card) : undefined}
                        />
                      );
                    })}
                  </div>
                );
              })()}
            </div>
          )}

          {/* Simple collection explanation */}
          <div className="glass-card" style={{ padding: '16px', display: 'flex', alignItems: 'center', gap: '12px' }}>
            <Trophy size={28} style={{ color: 'var(--accent)', flexShrink: 0 }} />
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', margin: 0, lineHeight: 1.4 }}>
              Collectionnez les cartes en ouvrant des <strong>Boosters (boîte mystère)</strong>. Compléter un ensemble débloque automatiquement les récompenses cosmétiques Légendaires (comme la couleur animée Arc-en-ciel). Vos cartes en plusieurs exemplaires sont stockées de côté et pourront être échangées plus tard avec d'autres joueurs !
            </p>
          </div>

        </div>
      )}

      {/* 3. BOOSTER OPENING TAB */}
      {activeTab === 'booster' && (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '32px', padding: '20px 0' }}>
          
          {boosterPhase === 'idle' && (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '20px', maxWidth: '400px', textAlign: 'center' }}>
              {/* Booster representation */}
              <div className="glass-card" style={{
                width: '180px', height: '260px', borderRadius: '16px',
                border: '3px solid var(--accent)', display: 'flex', flexDirection: 'column',
                alignItems: 'center', justifyContent: 'center', gap: '16px',
                background: 'linear-gradient(135deg, rgba(45,212,191,0.2) 0%, rgba(18,59,57,0.4) 100%)',
                boxShadow: '0 10px 25px rgba(45,212,191,0.15)', cursor: 'pointer'
              }} onClick={coins >= 250 ? handleBuyBooster : null}>
                <Sparkles size={48} style={{ color: 'var(--accent)', animation: 'pulse 2s infinite' }} />
                <div>
                  <h3 style={{ fontSize: '1.2rem', fontWeight: 800, margin: 0 }}>Pack Booster</h3>
                  <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', margin: '4px 0 0 0' }}>Contient 3 cartes</p>
                </div>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <button
                  className="btn-primary"
                  disabled={coins < 250 || openingBooster}
                  onClick={handleBuyBooster}
                  style={{ padding: '14px 28px', fontSize: '1rem', display: 'flex', alignItems: 'center', gap: '8px', justifyContent: 'center' }}
                >
                  <CreditCard size={18} /> Acheter pour 250 🪙
                </button>
                {coins < 250 && (
                  <span style={{ fontSize: '0.8rem', color: 'var(--error)', fontWeight: 600 }}>
                    Solde de pièces insuffisant. Jouez des parties pour gagner des pièces !
                  </span>
                )}
              </div>
            </div>
          )}

          {boosterPhase === 'shaking' && (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '20px', padding: '40px 0' }}>
              <div className="booster-shake" style={{
                width: '180px', height: '260px', borderRadius: '16px',
                border: '3px solid var(--accent)', display: 'flex', flexDirection: 'column',
                alignItems: 'center', justifyContent: 'center', gap: '16px',
                background: 'linear-gradient(135deg, rgba(45,212,191,0.2) 0%, rgba(18,59,57,0.4) 100%)',
                boxShadow: '0 15px 35px rgba(45,212,191,0.3)'
              }}>
                <Sparkles size={48} style={{ color: 'var(--accent)' }} />
                <h3 style={{ fontSize: '1.2rem', fontWeight: 800, margin: 0 }}>Ouverture...</h3>
              </div>
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', animation: 'pulse 1s infinite' }}>Tirage des cartes en cours...</p>
            </div>
          )}

          {boosterPhase === 'revealing' && (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '40px', width: '100%' }}>
              
              <div style={{ display: 'flex', justifyContent: 'center', gap: '20px', flexWrap: 'wrap' }}>
                {drawnCards.map((item, index) => {
                  const isFlipped = flippedCards[index];

                  return (
                    <div
                      key={index}
                      className="card-container"
                      onClick={() => flipCard(index)}
                    >
                      <div className={`card-inner ${isFlipped ? 'flipped' : ''}`}>
                        {/* Card Back (Face cachée) */}
                        <div className="card-face card-back">
                          <Sparkles size={32} style={{ color: 'var(--accent)', marginBottom: '8px' }} />
                          <span style={{ fontSize: '0.8rem', fontWeight: 700 }}>Révéler</span>
                        </div>

                        {/* Card Front (Face révélée) */}
                        <div 
                          className="card-face card-front"
                          style={{
                            padding: 0,
                            border: 'none',
                            background: 'transparent',
                            boxShadow: 'none'
                          }}
                        >
                          <GameCard
                            card={item.card}
                            quantity={item.quantity}
                            isNew={item.is_new}
                            style={{
                              width: '100%',
                              height: '100%',
                              border: 'none',
                              boxShadow: 'none'
                            }}
                          />
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Set reward unlocked notifications */}
              {drawnCards.some(item => item.unlocked_sets && item.unlocked_sets.length > 0) && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', maxWidth: '500px', width: '100%' }}>
                  {drawnCards.flatMap(item => item.unlocked_sets || []).map((setUnlock, sidx) => (
                    <div
                      key={sidx}
                      className="glass-card animate-pulse"
                      style={{
                        padding: '16px',
                        border: '2px solid #eab308',
                        background: 'linear-gradient(135deg, rgba(234,179,8,0.1), rgba(234,179,8,0.02))',
                        borderRadius: '12px',
                        textAlign: 'center',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '6px'
                      }}
                    >
                      <Trophy size={32} style={{ color: '#eab308', alignSelf: 'center' }} />
                      <h4 style={{ margin: 0, fontSize: '1rem', fontWeight: 800 }}>Set complété ! 🎉</h4>
                      <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', margin: 0 }}>
                        Vous avez collecté toutes les cartes du set <strong>{setUnlock.set_name}</strong> et débloqué :
                      </p>
                      <strong style={{ color: '#eab308', fontSize: '0.9rem' }}>{setUnlock.reward_label}</strong>
                    </div>
                  ))}
                </div>
              )}

              {/* Back / Again Action buttons */}
              {flippedCards.every(Boolean) && (
                <div style={{ display: 'flex', gap: '12px' }}>
                  <button className="btn-secondary" onClick={() => setBoosterPhase('idle')} style={{ padding: '10px 20px' }}>
                    Terminer
                  </button>
                  <button
                    className="btn-primary"
                    disabled={coins < 250 || openingBooster}
                    onClick={handleBuyBooster}
                    style={{ padding: '10px 20px', display: 'flex', alignItems: 'center', gap: '6px' }}
                  >
                    Ouvrir un autre booster (250 🪙)
                  </button>
                </div>
              )}

              {!flippedCards.every(Boolean) && (
                <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
                  Cliquez sur les cartes face cachée pour les retourner et découvrir vos récompenses !
                </p>
              )}

            </div>
          )}

        </div>
      )}

    </div>

    {/* ZOOM MODAL POPUP */}
    {zoomedCard && (
      <div 
        style={{
          position: 'fixed',
          inset: 0,
          backgroundColor: 'rgba(0,0,0,0.85)',
          backdropFilter: 'blur(8px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 99999,
          padding: '20px'
        }}
        onClick={() => setZoomedCard(null)}
      >
        <div 
          style={{
            position: 'relative',
            display: 'flex',
            alignItems: 'center',
            gap: '20px'
          }}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Close button */}
          <button
            onClick={() => setZoomedCard(null)}
            style={{
              position: 'absolute',
              top: '-45px',
              right: '0',
              backgroundColor: 'rgba(255,255,255,0.1)',
              border: 'none',
              width: '32px',
              height: '32px',
              borderRadius: '50%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              color: '#ffffff',
              zIndex: 20
            }}
          >
            <X size={18} />
          </button>

          {/* Left Navigation Arrow */}
          {ownedCardsList.length > 1 && (
            <button
              onClick={handlePrevZoomCard}
              style={{
                backgroundColor: 'rgba(255,255,255,0.1)',
                border: 'none',
                width: '44px',
                height: '44px',
                borderRadius: '50%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                color: '#ffffff',
                transition: 'background-color 0.2s',
                zIndex: 10
              }}
              onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.2)'}
              onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.1)'}
            >
              <ChevronLeft size={24} />
            </button>
          )}

          {/* Enlarged Card face — premium 3D tilt + foil */}
          <ZoomedCardFace card={zoomedCard} />

          {/* Right Navigation Arrow */}
          {ownedCardsList.length > 1 && (
            <button
              onClick={handleNextZoomCard}
              style={{
                backgroundColor: 'rgba(255,255,255,0.1)',
                border: 'none',
                width: '44px',
                height: '44px',
                borderRadius: '50%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                color: '#ffffff',
                transition: 'background-color 0.2s',
                zIndex: 10
              }}
              onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.2)'}
              onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.1)'}
            >
              <ChevronRight size={24} />
            </button>
          )}
        </div>
      </div>
    )}
  </>
);
}

// ==========================================
// ZOOMED CARD FACE — 3D tilt + holographic foil
// Displayed inside the modal when a card is clicked
// ==========================================
// ==========================================
// ZOOMED CARD FACE — 3D tilt + holographic foil
// Displayed inside the modal when a card is clicked
// ==========================================
function ZoomedCardFace({ card }) {
  const tiltRef = useRef(null);
  const foilRef = useRef(null);

  const rarity = card.rarity || 'common';
  const cfg = RARITY_CONFIG[rarity] || RARITY_CONFIG.common;
  const imgSrc = getImgSrc(card.id);
  const borderColor = cfg.border;

  const getBgGradient = () => {
    switch(rarity) {
      case 'legendary': return 'linear-gradient(160deg, #2a1f00 0%, #0a0800 100%)';
      case 'epic': return 'linear-gradient(160deg, #1c0b2b 0%, #08030d 100%)';
      case 'rare': return 'linear-gradient(160deg, #0b182b 0%, #03080d 100%)';
      default: return 'linear-gradient(160deg, #1f2229 0%, #0a0b0e 100%)';
    }
  };

  const getRarityLabel = () => {
    switch(rarity) {
      case 'legendary': return 'Légendaire';
      case 'epic': return 'Épique';
      case 'rare': return 'Rare';
      default: return 'Commune';
    }
  };

  useEffect(() => {
    const el = tiltRef.current;
    if (!el) return;

    VanillaTilt.init(el, {
      max: 15,
      speed: 400,
      glare: false,
      scale: 1.05,
      perspective: 1200,
      transition: true,
    });

    const handleMouseMove = (e) => {
      if (!foilRef.current) return;
      const rect = el.getBoundingClientRect();
      const x = (e.clientX - rect.left) / rect.width;
      const y = (e.clientY - rect.top) / rect.height;

      const bgX = 100 - (x * 100);
      const bgY = 100 - (y * 100);

      foilRef.current.style.backgroundPosition = `${bgX}% ${bgY}%`;
      foilRef.current.style.opacity = rarity === 'legendary' ? '0.3' : '0.8';
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

    el.addEventListener('mousemove', handleMouseMove);
    el.addEventListener('mouseleave', handleMouseLeave);
    el.addEventListener('mouseenter', handleMouseEnter);

    return () => {
      if (el._vTilt) el._vTilt.destroy();
      el.removeEventListener('mousemove', handleMouseMove);
      el.removeEventListener('mouseleave', handleMouseLeave);
      el.removeEventListener('mouseenter', handleMouseEnter);
    };
  }, [card.id, rarity]);

  const outerBoxShadow = rarity === 'legendary'
      ? `0 0 0 1px #000, 0 0 0 3px ${borderColor}, 0 0 30px rgba(234,179,8,0.5), 0 25px 50px rgba(0,0,0,0.8)`
      : rarity === 'epic'
          ? `0 0 0 1px #000, 0 0 0 3px ${borderColor}, 0 0 25px rgba(168,85,247,0.5), 0 25px 50px rgba(0,0,0,0.8)`
          : rarity === 'rare'
              ? `0 0 0 1px #000, 0 0 0 3px ${borderColor}, 0 0 20px rgba(59,130,246,0.5), 0 25px 50px rgba(0,0,0,0.8)`
              : `0 0 0 1px #000, 0 0 0 3px ${borderColor}, 0 25px 50px rgba(0,0,0,0.8)`;

  return (
      <div
          ref={tiltRef}
          data-tilt
          style={{
            cursor: 'url("data:image/svg+xml,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' width=\'16\' height=\'16\' viewBox=\'0 0 16 16\'%3E%3Ccircle cx=\'8\' cy=\'8\' r=\'2.5\' fill=\'white\' opacity=\'0.9\'/%3E%3C/svg%3E") 8 8, auto',
            width: '380px',
            height: '560px',
            display: 'flex',
            flexDirection: 'column',
            borderRadius: '16px',
            background: getBgGradient(),
            position: 'relative',
            padding: '16px',
            boxShadow: outerBoxShadow,
            overflow: 'hidden',
            transformStyle: 'preserve-3d',
            willChange: 'transform',
          }}
      >
        <div style={{
          position: 'absolute', inset: 0,
          backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)' opacity='0.05'/%3E%3C/svg%3E")`,
          pointerEvents: 'none', zIndex: 0, mixBlendMode: 'overlay',
        }} />

        <div style={{
          position: 'absolute', inset: '4px',
          border: `1px solid rgba(255,255,255,0.15)`,
          borderRadius: '12px', pointerEvents: 'none', zIndex: 1,
          boxShadow: `inset 0 0 20px rgba(0,0,0,0.5)`,
        }} />

        <div
            ref={foilRef}
            style={{
              position: 'absolute', inset: 0,
              pointerEvents: 'none', zIndex: 10, opacity: 0,
              mixBlendMode: rarity === 'legendary' ? 'color-dodge' : 'overlay',
              backgroundImage: rarity === 'legendary'
                  ? 'linear-gradient(115deg, transparent 20%, rgba(255,215,0,0.5) 36%, rgba(255,105,180,0.4) 43%, rgba(0,255,255,0.5) 50%, rgba(138,43,226,0.4) 57%, rgba(255,215,0,0.5) 64%, transparent 80%)'
                  : 'linear-gradient(115deg, transparent 30%, rgba(255,255,255,0.4) 45%, rgba(255,255,255,0.8) 50%, rgba(255,255,255,0.4) 55%, transparent 70%)',
              backgroundSize: '250% 250%',
            }}
        />

        {/* EN-TÊTE REVISITÉ : Titre + Badge de rareté fixe */}
        <div style={{
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          padding: '10px 14px', zIndex: 3, position: 'relative',
          background: 'linear-gradient(180deg, rgba(255,255,255,0.1) 0%, rgba(0,0,0,0.3) 100%)',
          border: '1px solid rgba(255,255,255,0.1)',
          borderRadius: '8px',
          boxShadow: '0 4px 10px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.2)',
          marginBottom: '14px',
          gap: '12px'
        }}>
          <div style={{
            fontSize: '1.25rem',
            fontWeight: 900,
            color: '#ffffff',
            textShadow: `0 2px 4px rgba(0,0,0,0.8), 0 0 10px ${cfg.glow}`,
            letterSpacing: '0.5px',
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis'
          }}>
            {card.name}
          </div>

          {/* Badge d'étoiles stylisées (Largeur fixe de 4 étoiles) */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '2px',
            minWidth: '70px', // Maintient une largeur fixe pour éviter tout décalage
            justifyContent: 'flex-end',
            flexShrink: 0
          }}>
            {[1, 2, 3, 4].map(num => {
              const activeStars = rarity === 'legendary' ? 4 : rarity === 'epic' ? 3 : rarity === 'rare' ? 2 : 1;
              const isActive = num <= activeStars;

              return (
                  <svg
                      key={num}
                      viewBox="0 0 24 24"
                      width="16"
                      height="16"
                      fill={isActive ? borderColor : "rgba(255,255,255,0.08)"}
                      stroke={isActive ? "rgba(255,255,255,0.6)" : "rgba(255,255,255,0.05)"}
                      strokeWidth="1.5"
                      style={{
                        filter: isActive ? `drop-shadow(0 0 4px ${cfg.glow})` : 'none',
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
          width: '100%',
          aspectRatio: '4 / 3',
          borderRadius: '8px',
          position: 'relative',
          zIndex: 2,
          backgroundColor: '#000',
          flexShrink: 0,
          border: `3px solid ${borderColor}`,
          boxShadow: '0 8px 20px rgba(0,0,0,0.6)',
          overflow: 'hidden'
        }}>
          {imgSrc ? (
              <img src={imgSrc} alt={card.name} style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
          ) : (
              <div style={{
                position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
                color: '#475569', fontSize: '0.85rem', backgroundColor: '#0c111a',
              }}><span>Image manquante</span></div>
          )}
        </div>

        <div style={{
          zIndex: 4, position: 'relative',
          marginTop: '-14px',
          alignSelf: 'center',
          background: '#0c111a',
          border: `2px solid ${borderColor}`,
          borderRadius: '20px',
          padding: '4px 16px',
          boxShadow: '0 4px 10px rgba(0,0,0,0.7)',
          display: 'flex', alignItems: 'center', justifyContent: 'center'
        }}>
        <span style={{
          fontSize: '0.75rem',
          color: '#e2e8f0',
          fontWeight: 800,
          textTransform: 'uppercase',
          letterSpacing: '1px'
        }}>
          {card.set || card.card_set}
        </span>
        </div>

        <div style={{
          flex: 1,
          marginTop: '8px',
          borderRadius: '8px',
          padding: '16px',
          display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center',
          zIndex: 2, position: 'relative',
          background: 'rgba(0,0,0,0.5)',
          border: '1px solid rgba(255,255,255,0.08)',
          boxShadow: 'inset 0 4px 15px rgba(0,0,0,0.4)',
        }}>
          <div style={{
            position: 'absolute',
            inset: 0,
            overflow: 'hidden',
            opacity: 0.03,
            pointerEvents: 'none',
            zIndex: 0,
            userSelect: 'none',
            padding: '4px'
          }}>
          <span style={{
            display: 'block',
            fontSize: '0.55rem',
            fontWeight: 800,
            color: '#ffffff',
            textTransform: 'uppercase',
            letterSpacing: '1px',
            lineHeight: '1.4',
            wordBreak: 'break-all',
            textAlign: 'justify'
          }}>
            {`${card.name.replace(/\s+/g, '')}\u00A0`.repeat(300)}
          </span>
          </div>

          <p style={{
            fontSize: '1.1rem', color: '#cbd5e1', lineHeight: '1.6', margin: 0,
            textAlign: 'center', position: 'relative', zIndex: 1,
            textShadow: '0 2px 4px rgba(0,0,0,0.8)',
            fontWeight: 500
          }}>
            {card.description}
          </p>
        </div>
      </div>
  );
}
