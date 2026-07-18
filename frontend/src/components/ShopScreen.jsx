import React, { useState, useEffect, useRef } from 'react';
import { api } from '../utils/api';
import { Coins, Sparkles, Check, CheckCircle2, Lock, Eye, EyeOff, Loader2, ArrowLeft, Trophy, CreditCard, X, ChevronLeft, ChevronRight, GraduationCap, Landmark, Car, Globe, Sword, Heart, Utensils, Gem, CloudLightning, Lightbulb } from 'lucide-react';
import { getUsernameStyle } from '../utils/progression';
import GameCard, { RARITY_CONFIG, getCardImageSrc as getImgSrc } from './GameCard';
import BoosterOffer from './shop/BoosterOffer';
import VanillaTilt from 'vanilla-tilt';

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

  const [activeTab, setActiveTab] = useState(mode === 'collection' ? 'album' : 'booster');
  const [loading, setLoading] = useState(!cachedData);
  const [error, setError] = useState('');

  const [coins, setCoins] = useState(() => cachedData ? cachedData.coins : 0);
  const [equipped, setEquipped] = useState(() => cachedData ? cachedData.equipped : { border: null, color: null, title: null });
  const [catalog, setCatalog] = useState(() => cachedData ? cachedData.catalog : { cosmetics: [], cards: [] });
  const [unlockedCards, setUnlockedCards] = useState(() => cachedData ? cachedData.unlocked_cards : {});
  const [unlockedCosmetics, setUnlockedCosmetics] = useState(() => cachedData ? cachedData.unlocked_cosmetics : []);
  const [setsStatus, setSetsStatus] = useState(() => cachedData ? cachedData.sets_status : DEFAULT_SETS_STATUS);

  const [buyingItemId, setBuyingItemId] = useState(null);
  const [equippingItem, setEquippingItem] = useState(null);
  const [openingBooster, setOpeningBooster] = useState(false);
  const [boosterPhase, setBoosterPhase] = useState('idle');
  const [drawnCards, setDrawnCards] = useState([]);
  const [flippedCards, setFlippedCards] = useState([false, false, false]);
  const [zoomedCard, setZoomedCard] = useState(null);

  const [viewMode, setViewMode] = useState('sets');
  const [filterOwned, setFilterOwned] = useState('all');
  const [filterRarity, setFilterRarity] = useState('all');
  const [sortBy, setSortBy] = useState('default');

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
        onRefreshProfile({ coins: res.new_coins });
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
    const targetValue = isCurrent ? null : value;

    try {
      const res = await api.post('/shop/equip', { item_type: type, item_value: targetValue });
      if (res.success) {
        setEquipped(prev => ({ ...prev, [type]: targetValue }));
        onRefreshProfile({});
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
      await new Promise(resolve => setTimeout(resolve, 1800));

      const res = await api.post('/shop/buy-booster');
      if (res.success) {
        setCoins(res.new_coins);
        setDrawnCards(res.drawn_cards);
        setBoosterPhase('revealing');
        await fetchCollectionDataSilent();
        onRefreshProfile({ coins: res.new_coins });
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

    if (filterOwned === 'owned') {
      list = list.filter(c => unlockedCards[c.id] && unlockedCards[c.id] > 0);
    } else if (filterOwned === 'missing') {
      list = list.filter(c => !unlockedCards[c.id] || unlockedCards[c.id] <= 0);
    }

    if (filterRarity !== 'all') {
      list = list.filter(c => c.rarity === filterRarity);
    }

    if (sortBy === 'name') {
      list.sort((a, b) => a.name.localeCompare(b.name));
    } else if (sortBy === 'rarity') {
      const rarityWeight = { legendary: 4, epic: 3, rare: 2, common: 1 };
      list.sort((a, b) => (rarityWeight[b.rarity] || 0) - (rarityWeight[a.rarity] || 0));
    }

    return list;
  };

  const handleCollectionRailWheel = (event) => {
    const rail = event.currentTarget;
    const delta = Math.abs(event.deltaX) > Math.abs(event.deltaY) ? event.deltaX : event.deltaY;
    if (!delta || rail.scrollWidth <= rail.clientWidth) return;

    event.preventDefault();
    event.stopPropagation();
    rail.scrollLeft += delta;
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

  const boosterAnimations = `
    @keyframes floatBooster {
      0%, 100% { transform: translateY(0px) rotate(0deg); }
      50% { transform: translateY(-15px) rotate(1.5deg); }
    }
    @keyframes intenseShakeBooster {
      0% { transform: translate(0, 0) rotate(0deg) scale(1); filter: brightness(1); }
      10% { transform: translate(-4px, 3px) rotate(-3deg) scale(1.02); filter: brightness(1.2); }
      20% { transform: translate(4px, -3px) rotate(3deg) scale(1.05); filter: drop-shadow(0 0 20px rgba(45,212,191,0.6)); }
      30% { transform: translate(-5px, 5px) rotate(-4deg) scale(1.08); filter: brightness(1.5) drop-shadow(0 0 40px rgba(45,212,191,0.8)); }
      40% { transform: translate(5px, -5px) rotate(4deg) scale(1.1); filter: brightness(1.8) drop-shadow(0 0 60px rgba(45,212,191,1)); }
      50% { transform: translate(-6px, 6px) rotate(-5deg) scale(1.15); filter: brightness(2) drop-shadow(0 0 80px rgba(45,212,191,1)); }
      60% { transform: translate(6px, -6px) rotate(5deg) scale(1.2); filter: brightness(2.5) drop-shadow(0 0 100px rgba(45,212,191,1)); }
      70% { transform: translate(-7px, 7px) rotate(-6deg) scale(1.25); filter: brightness(3) drop-shadow(0 0 120px rgba(45,212,191,1)); }
      80% { transform: translate(7px, -7px) rotate(6deg) scale(1.3); filter: brightness(4) drop-shadow(0 0 150px rgba(255,255,255,1)); }
      90% { transform: translate(0, 0) rotate(0deg) scale(1.35); filter: brightness(5) drop-shadow(0 0 200px rgba(255,255,255,1)); opacity: 1; }
      100% { transform: translate(0, 0) rotate(0deg) scale(1.5); filter: brightness(10) drop-shadow(0 0 300px rgba(255,255,255,1)); opacity: 0; }
    }
    @keyframes revealCardIn {
      0% { opacity: 0; transform: translateY(150px) scale(0.4) rotateY(-180deg); }
      100% { opacity: 1; transform: translateY(0) scale(1) rotateY(0deg); }
    }
    @keyframes foilSweep {
      0% { background-position: -100% -100%; }
      100% { background-position: 200% 200%; }
    }
    @keyframes cardBackPulse {
      0%, 100% { filter: drop-shadow(0 0 8px rgba(234,179,8,0.3)); }
      50% { filter: drop-shadow(0 0 20px rgba(234,179,8,0.7)); }
    }
  `;

  return (
      <>
        <style>{boosterAnimations}</style>
        <div className="container animate-fade-in shop-page" style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>

          <div className="shop-page__header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
            <div>
              <button className="btn-secondary" onClick={onBack} style={{ padding: '8px 16px', marginBottom: '8px', borderRadius: '12px' }}>
                <ArrowLeft size={16} /> Retour
              </button>
              <h1 style={{ fontSize: '1.8rem', fontWeight: 800, fontFamily: "'Plus Jakarta Sans', sans-serif", letterSpacing: '-0.04em', color: '#fff' }}>
                {mode === 'collection' ? 'Mon Album de Collection' : 'Boutique du QG'}
              </h1>
              <p className="shop-page__subtitle">
                {mode === 'collection' ? 'Chaque carte raconte un morceau de ta progression.' : 'Ouvre ton booster ou personnalise ton identité.'}
              </p>
            </div>
          </div>

          {mode === 'shop' && (
              <div className="tab-group shop-tabs" style={{ 
                display: 'inline-flex', 
                background: 'rgba(15,23,42,0.35)', 
                border: '1px solid rgba(255,255,255,0.06)',
                borderRadius: '14px', 
                padding: '4px',
                gap: '4px',
                width: 'fit-content'
              }}>
                <button
                    className={`tab-btn ${activeTab === 'cosmetics' ? 'active' : ''}`}
                    onClick={() => setActiveTab('cosmetics')}
                    style={{
                      background: activeTab === 'cosmetics' ? 'rgba(45,212,191,0.15)' : 'transparent',
                      color: activeTab === 'cosmetics' ? '#2dd4bf' : '#aab7ce',
                      border: 'none',
                      borderRadius: '10px',
                      padding: '8px 16px',
                      fontWeight: 800,
                      fontSize: '0.85rem',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                      cursor: 'pointer',
                      transition: 'all 0.2s ease',
                      fontFamily: "'Manrope', sans-serif"
                    }}
                >
                  <Sparkles size={16} /> Boutique de Cosmétiques
                </button>
                <button
                    className={`tab-btn ${activeTab === 'booster' ? 'active' : ''}`}
                    onClick={() => setActiveTab('booster')}
                    style={{
                      background: activeTab === 'booster' ? 'rgba(45,212,191,0.15)' : 'transparent',
                      color: activeTab === 'booster' ? '#2dd4bf' : '#aab7ce',
                      border: 'none',
                      borderRadius: '10px',
                      padding: '8px 16px',
                      fontWeight: 800,
                      fontSize: '0.85rem',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                      cursor: 'pointer',
                      transition: 'all 0.2s ease',
                      fontFamily: "'Manrope', sans-serif"
                    }}
                >
                  <Sparkles size={16} /> Booster de Cartes
                </button>
              </div>
          )}

          {activeTab === 'cosmetics' && (
              <div className="cosmetics-view" style={{ display: 'flex', flexDirection: 'column', gap: '32px' }}>

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
                                          Acheter — {item.price} <Coins size={14} />
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
                                          Acheter — {item.price} <Coins size={14} />
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
                                          Acheter — {item.price} <Coins size={14} />
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

          {activeTab === 'album' && (
              <div className="collection-view" style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>

                <div className="glass-card collection-toolbar" style={{
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

                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px', alignItems: 'center' }}>

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
                  const filteredCardIds = set.cardIds.filter(cid => {
                    const card = catalog.cards.find(c => c.id === cid);
                    if (!card) return false;

                    const isOwned = unlockedCards[cid] && unlockedCards[cid] > 0;
                    if (filterOwned === 'owned' && !isOwned) return false;
                    if (filterOwned === 'missing' && isOwned) return false;

                    if (filterRarity !== 'all' && card.rarity !== filterRarity) return false;

                    return true;
                  });

                  if (filteredCardIds.length === 0) return null;

                  const ownedInSet = set.cardIds.filter(cid => unlockedCards[cid] && unlockedCards[cid] > 0).length;
                  const progressRatio = ownedInSet / set.cardIds.length;

                  return (
                      <div key={set.id} className="glass-card collection-set" style={{ display: 'flex', flexDirection: 'column', gap: '20px', padding: '24px' }}>

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
                              <div className="collection-set__rail" onWheelCapture={handleCollectionRailWheel} style={{
                                display: 'grid',
                                gridTemplateColumns: 'repeat(5, 160px)',
                                gap: '30px 40px',
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
                                    return (
                                        <div
                                            key={cid}
                                            className="glass-card"
                                            style={{
                                              width: '160px',
                                              height: '236px',
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
                              gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))',
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

                <div className="glass-card" style={{ padding: '16px', display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <Trophy size={28} style={{ color: 'var(--accent)', flexShrink: 0 }} />
                  <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', margin: 0, lineHeight: 1.4 }}>
                    Collectionnez les cartes en ouvrant des <strong>Boosters (boîte mystère)</strong>. Compléter un ensemble débloque automatiquement les récompenses cosmétiques Légendaires (comme la couleur animée Arc-en-ciel). Vos cartes en plusieurs exemplaires sont stockées de côté et pourront être échangées plus tard avec d'autres joueurs !
                  </p>
                </div>

              </div>
          )}

          {activeTab === 'booster' && (
              <div className="booster-stage" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '48px', padding: '40px 0' }}>

                {boosterPhase === 'idle' && (
                    <>
                    <BoosterOffer coins={coins} opening={openingBooster} onBuy={handleBuyBooster} />
                    <div className="legacy-booster-offer" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '32px', maxWidth: '400px', textAlign: 'center' }}>
                      <div
                          style={{
                            width: '220px', height: '320px', borderRadius: '12px',
                            background: 'linear-gradient(145deg, #1e293b 0%, #0f172a 40%, #020617 100%)',
                            boxShadow: '0 0 0 3px #334155, 0 20px 40px rgba(0,0,0,0.6), inset 0 0 30px rgba(45,212,191,0.15)',
                            display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                            position: 'relative', overflow: 'hidden', cursor: coins >= 250 ? 'pointer' : 'not-allowed',
                            animation: 'floatBooster 4s ease-in-out infinite',
                            transition: 'transform 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275), filter 0.3s'
                          }}
                          onMouseEnter={(e) => {
                            if(coins >= 250) {
                              e.currentTarget.style.filter = 'brightness(1.2) drop-shadow(0 0 25px rgba(45,212,191,0.5))';
                              e.currentTarget.style.transform = 'scale(1.05) translateY(-5px)';
                            }
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.filter = 'none';
                            e.currentTarget.style.transform = 'scale(1) translateY(0)';
                          }}
                          onClick={coins >= 250 ? handleBuyBooster : null}
                      >
                        <div style={{ position: 'absolute', top: 0, width: '100%', height: '24px', background: 'repeating-linear-gradient(90deg, transparent, transparent 6px, rgba(255,255,255,0.08) 6px, rgba(255,255,255,0.08) 12px)' }} />
                        <div style={{ position: 'absolute', bottom: 0, width: '100%', height: '24px', background: 'repeating-linear-gradient(90deg, transparent, transparent 6px, rgba(255,255,255,0.08) 6px, rgba(255,255,255,0.08) 12px)' }} />

                        <div style={{
                          position: 'absolute', width: '200%', height: '80px', background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.15), rgba(45,212,191,0.3), rgba(255,255,255,0.15), transparent)',
                          transform: 'rotate(-35deg)', animation: 'foilSweep 4s ease-in-out infinite'
                        }} />

                        <Trophy size={64} style={{ color: '#ffb300', filter: 'drop-shadow(0 0 15px rgba(255,179,0,0.6))', zIndex: 1 }} />
                        <h3 style={{ fontSize: '1.8rem', fontWeight: 900, margin: '16px 0 4px', color: '#ffffff', textTransform: 'uppercase', letterSpacing: '3px', zIndex: 1, textShadow: '0 4px 10px rgba(0,0,0,0.8)' }}>Booster</h3>
                        <div style={{ background: '#000', padding: '4px 16px', borderRadius: '20px', border: '1px solid #334155', zIndex: 1, marginTop: '8px' }}>
                          <p style={{ fontSize: '0.9rem', color: '#cbd5e1', margin: 0, fontWeight: 800, letterSpacing: '1px' }}>3 CARTES</p>
                        </div>
                      </div>

                      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', width: '100%' }}>
                        <button
                            className="btn-primary"
                            disabled={coins < 250 || openingBooster}
                            onClick={handleBuyBooster}
                            style={{ padding: '16px 32px', fontSize: '1.1rem', display: 'flex', alignItems: 'center', gap: '10px', justifyContent: 'center', borderRadius: '12px', fontWeight: 800 }}
                        >
                          <CreditCard size={20} /> Acheter pour 250 <Coins size={18} />
                        </button>
                        {coins < 250 && (
                            <span style={{ fontSize: '0.85rem', color: '#ef4444', fontWeight: 700, padding: '8px', background: 'rgba(239,68,68,0.1)', borderRadius: '8px' }}>
                    Solde de pièces insuffisant. Jouez des parties pour gagner des pièces !
                  </span>
                        )}
                      </div>
                    </div>
                    </>
                )}

                {boosterPhase === 'shaking' && (
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '20px', padding: '40px 0' }}>
                      <div
                          style={{
                            width: '220px', height: '320px', borderRadius: '12px',
                            background: 'linear-gradient(145deg, #1e293b 0%, #0f172a 40%, #020617 100%)',
                            boxShadow: '0 0 0 3px #334155, 0 20px 40px rgba(0,0,0,0.6)',
                            display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                            position: 'relative', overflow: 'hidden',
                            animation: 'intenseShakeBooster 1.8s cubic-bezier(.36,.07,.19,.97) forwards'
                          }}
                      >
                        <div style={{ position: 'absolute', top: 0, width: '100%', height: '24px', background: 'repeating-linear-gradient(90deg, transparent, transparent 6px, rgba(255,255,255,0.08) 6px, rgba(255,255,255,0.08) 12px)' }} />
                        <div style={{ position: 'absolute', bottom: 0, width: '100%', height: '24px', background: 'repeating-linear-gradient(90deg, transparent, transparent 6px, rgba(255,255,255,0.08) 6px, rgba(255,255,255,0.08) 12px)' }} />

                        <div style={{
                          position: 'absolute', inset: 0, background: 'radial-gradient(circle, rgba(45,212,191,0.8) 0%, transparent 70%)',
                          mixBlendMode: 'overlay'
                        }} />

                        <Trophy size={64} style={{ color: '#fff', zIndex: 1 }} />
                      </div>
                    </div>
                )}

                {boosterPhase === 'revealing' && (
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '48px', width: '100%' }}>

                      <div style={{ display: 'flex', justifyContent: 'center', gap: '32px', flexWrap: 'wrap', perspective: '1200px' }}>
                        {drawnCards.map((item, index) => {
                          const isFlipped = flippedCards[index];

                          return (
                              <div
                                  key={index}
                                  className="card-container"
                                  onClick={() => flipCard(index)}
                                  style={{
                                    animation: `revealCardIn 0.8s cubic-bezier(0.175, 0.885, 0.32, 1.275) forwards`,
                                    animationDelay: `${index * 0.15}s`,
                                    opacity: 0,
                                    width: '320px', // Taille massive pour l'ouverture
                                    height: '470px'
                                  }}
                              >
                                <div className={`card-inner ${isFlipped ? 'flipped' : ''}`} style={{ width: '100%', height: '100%', position: 'relative', transition: 'transform 0.6s cubic-bezier(0.4, 0.2, 0.2, 1)', transformStyle: 'preserve-3d' }}>

                                  {/* DOS DE LA CARTE GÉANT */}
                                  <div className="card-face card-back" style={{
                                    background: 'linear-gradient(160deg, #0f172a 0%, #020617 100%)',
                                    border: '2px solid #334155',
                                    borderRadius: '16px',
                                    display: 'flex',
                                    flexDirection: 'column',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    boxShadow: 'inset 0 0 40px rgba(0,0,0,0.8), 0 10px 20px rgba(0,0,0,0.5)',
                                    backfaceVisibility: 'hidden',
                                    position: 'absolute',
                                    inset: 0,
                                    cursor: 'pointer'
                                  }}>
                                    <div style={{
                                      position: 'absolute', inset: '8px',
                                      border: '1px solid rgba(255,255,255,0.05)',
                                      borderRadius: '10px'
                                    }} />

                                    <div style={{
                                      width: '80px', height: '80px', borderRadius: '50%',
                                      background: 'rgba(255,255,255,0.03)',
                                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                                      border: '2px solid rgba(234,179,8,0.3)',
                                      animation: 'cardBackPulse 2s infinite ease-in-out'
                                    }}>
                                      <Trophy size={40} style={{ color: '#eab308' }} />
                                    </div>
                                    <span style={{ fontSize: '0.9rem', fontWeight: 800, color: '#94a3b8', marginTop: '24px', letterSpacing: '2px', textTransform: 'uppercase' }}>Cliquez</span>
                                  </div>

                                  {/* FACE DE LA CARTE PREMIUM */}
                                  <div
                                      className="card-face card-front"
                                      style={{
                                        padding: 0,
                                        border: 'none',
                                        background: 'transparent',
                                        boxShadow: 'none',
                                        backfaceVisibility: 'hidden',
                                        position: 'absolute',
                                        inset: 0,
                                        transform: 'rotateY(180deg)',
                                        overflow: 'visible'
                                      }}
                                  >
                                    <GameCard
                                        card={item.card}
                                        size="lg"
                                        width="100%"
                                        height="100%"
                                        showTilt={false}
                                        isFoil={true}
                                        badge={
                                          <div style={{ position: 'absolute', top: '-18px', right: '-18px', zIndex: 100 }}>
                                            {item.is_new ? (
                                                <div style={{
                                                  background: '#10b981', color: '#fff', padding: '8px 16px', borderRadius: '12px',
                                                  fontWeight: 900, fontSize: '1.2rem', boxShadow: '0 4px 15px rgba(16, 185, 129, 0.6)',
                                                  border: '2px solid #059669', transform: 'rotate(10deg)',
                                                }}>NOUVEAU !</div>
                                            ) : (
                                                <div style={{
                                                  background: '#334155', color: '#fff', padding: '6px 12px', borderRadius: '10px',
                                                  fontWeight: 800, fontSize: '1rem', boxShadow: '0 4px 10px rgba(0,0,0,0.6)',
                                                  border: '2px solid #475569', transform: 'rotate(10deg)'
                                                }}>Doublon x{item.quantity}</div>
                                            )}
                                          </div>
                                        }
                                    />

                                  </div>
                                </div>
                              </div>
                          );
                        })}
                      </div>

                      {drawnCards.some(item => item.unlocked_sets && item.unlocked_sets.length > 0) && (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', maxWidth: '500px', width: '100%' }}>
                            {drawnCards.flatMap(item => item.unlocked_sets || []).map((setUnlock, sidx) => (
                                <div
                                    key={sidx}
                                    className="glass-card animate-pulse"
                                    style={{
                                      padding: '20px',
                                      border: '2px solid #eab308',
                                      background: 'linear-gradient(135deg, rgba(234,179,8,0.15), rgba(0,0,0,0.6))',
                                      borderRadius: '16px',
                                      textAlign: 'center',
                                      display: 'flex',
                                      flexDirection: 'column',
                                      gap: '10px',
                                      boxShadow: '0 10px 30px rgba(234,179,8,0.2)'
                                    }}
                                >
                                  <Trophy size={40} style={{ color: '#eab308', alignSelf: 'center', filter: 'drop-shadow(0 0 10px rgba(234,179,8,0.5))' }} />
                                  <h4 style={{ margin: 0, fontSize: '1.2rem', fontWeight: 900, color: '#fff' }}>Set complété ! 🎉</h4>
                                  <p style={{ fontSize: '0.9rem', color: '#cbd5e1', margin: 0 }}>
                                    Vous avez collecté toutes les cartes du set <strong style={{ color: '#fff' }}>{setUnlock.set_name}</strong> et débloqué :
                                  </p>
                                  <div style={{ background: 'rgba(0,0,0,0.4)', padding: '8px 16px', borderRadius: '8px', display: 'inline-block', alignSelf: 'center', border: '1px solid rgba(234,179,8,0.3)' }}>
                                    <strong style={{ color: '#eab308', fontSize: '1rem', letterSpacing: '0.5px' }}>{setUnlock.reward_label}</strong>
                                  </div>
                                </div>
                            ))}
                          </div>
                      )}

                      {flippedCards.every(Boolean) && (
                          <div style={{ display: 'flex', gap: '16px', animation: 'fade-in 0.5s ease-out' }}>
                            <button className="btn-secondary" onClick={() => setBoosterPhase('idle')} style={{ padding: '12px 24px', fontSize: '1rem', fontWeight: 700 }}>
                              Terminer
                            </button>
                            <button
                                className="btn-primary"
                                disabled={coins < 250 || openingBooster}
                                onClick={handleBuyBooster}
                                style={{ padding: '12px 24px', display: 'flex', alignItems: 'center', gap: '8px', fontSize: '1rem', fontWeight: 700 }}
                            >
                              <Sparkles size={18} /> Ouvrir un autre (250 <Coins size={16} />)
                            </button>
                          </div>
                      )}

                      {!flippedCards.every(Boolean) && (
                          <div style={{ background: 'rgba(255,255,255,0.05)', padding: '12px 24px', borderRadius: '20px', border: '1px solid rgba(255,255,255,0.1)' }}>
                            <p style={{ color: '#e2e8f0', fontSize: '0.9rem', margin: 0, fontWeight: 600 }}>
                              Cliquez sur les cartes pour découvrir vos récompenses !
                            </p>
                          </div>
                      )}

                    </div>
                )}

              </div>
          )}

        </div>

        {zoomedCard && (
            <div
                style={{
                  position: 'fixed',
                  inset: 0,
                  backgroundColor: 'rgba(15, 23, 42, 0.85)',
                  backdropFilter: 'blur(20px)',
                  WebkitBackdropFilter: 'blur(20px)',
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

                <GameCard card={zoomedCard} size="lg" showTilt={true} isFoil={true} />

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
