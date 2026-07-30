import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import {
  ArrowLeftRight,
  ChevronDown,
  Coins,
  Download,
  LayoutDashboard,
  LayoutGrid,
  LogOut,
  Moon,
  RefreshCw,
  ShieldAlert,
  ShoppingBag,
  Sun,
  User,
  Wifi,
  WifiOff,
} from 'lucide-react';
import { PUBLIC_BASE } from '../../utils/api';
import NotificationsMenu from '../notifications/NotificationsMenu';
import usePwaControls from '../../pwa/usePwaControls';

const NAV_ITEMS = [
  { to: '/dashboard', label: 'Accueil', icon: LayoutDashboard },
  { to: '/collection', label: 'Collection', icon: LayoutGrid },
  { to: '/echanges', label: 'Échanges', icon: ArrowLeftRight },
  { to: '/boutique', label: 'Boutique', icon: ShoppingBag },
  { to: '/profil', label: 'Profil', icon: User },
];

const HEADER_NAV_ITEMS = NAV_ITEMS.filter(({ to }) => to !== '/profil');

function Brand({ onClick }) {
  return (
    <button className="app-brand" type="button" onClick={onClick} aria-label="Retour à l'accueil">
      <span className="app-brand__mark">QG</span>
      <span className="app-brand__name">Le QG</span>
    </button>
  );
}

function UserAvatar({ user }) {
  const value = user?.avatar_url;
  const className = `app-user__avatar ${user?.equipped_border || ''}`;

  if (value?.startsWith('/uploads/')) return <img src={`${PUBLIC_BASE}${value}`} alt="" className={className} />;
  if (value?.startsWith('http')) return <img src={value} alt="" className={className} />;

  return <span className={className}>{value || user?.username?.[0]?.toUpperCase() || 'U'}</span>;
}

function HeaderNav() {
  const location = useLocation();
  const navRef = useRef(null);
  const [indicator, setIndicator] = useState({ left: 0, width: 0, visible: false });

  useLayoutEffect(() => {
    const updateIndicator = () => {
      const activeLink = navRef.current?.querySelector('.app-nav__link.is-active');
      if (!activeLink) return;
      setIndicator({ left: activeLink.offsetLeft, width: activeLink.offsetWidth, visible: true });
    };

    updateIndicator();
    const resizeObserver = new ResizeObserver(updateIndicator);
    if (navRef.current) resizeObserver.observe(navRef.current);
    return () => resizeObserver.disconnect();
  }, [location.pathname]);

  return (
    <nav className="app-nav" aria-label="Navigation principale" ref={navRef}>
      <span
        className={`app-nav__indicator${indicator.visible ? ' is-visible' : ''}`}
        style={{ width: indicator.width, transform: `translateX(${indicator.left}px)` }}
        aria-hidden="true"
      />
      {HEADER_NAV_ITEMS.map(({ to, label, icon: Icon, match }) => (
        <NavLink
          key={to}
          to={to}
          className={({ isActive }) => {
            const active = isActive || (match && window.location.pathname.startsWith(match));
            return `app-nav__link${active ? ' is-active' : ''}`;
          }}
        >
          <Icon size={14} />
          <span>{label}</span>
        </NavLink>
      ))}
    </nav>
  );
}

function MobileNav() {
  return (
    <nav className="mobile-nav" aria-label="Navigation mobile">
      {NAV_ITEMS.map(({ to, label, icon: Icon, match }) => (
        <NavLink
          key={to}
          to={to}
          className={({ isActive }) => {
            const active = isActive || (match && window.location.pathname.startsWith(match));
            return `mobile-nav__link${active ? ' is-active' : ''}`;
          }}
        >
          <Icon size={18} />
          <span>{label}</span>
        </NavLink>
      ))}
    </nav>
  );
}

function NetworkPill({ isOnline }) {
  return (
    <span className={`network-pill${isOnline ? ' is-online' : ' is-offline'}`} role="status" aria-live="polite">
      {isOnline ? <Wifi size={15} /> : <WifiOff size={15} />}
      <span>{isOnline ? 'En ligne' : 'Hors ligne'}</span>
    </span>
  );
}

function UpdateNotice({ onUpdate }) {
  return (
    <div className="pwa-update" role="status">
      <RefreshCw size={18} />
      <span><strong>Le QG a ete mis a jour.</strong><small>Recharge pour utiliser la nouvelle version.</small></span>
      <button type="button" onClick={onUpdate}>Mettre a jour</button>
    </div>
  );
}

export function AuthHeader({ theme, onToggleTheme }) {
  const navigate = useNavigate();
  const pwa = usePwaControls();
  return (
    <header className="app-header app-header--auth">
      <Brand onClick={() => navigate('/')} />
      <div className="app-header__actions">
        <NetworkPill isOnline={pwa.isOnline} />
        {pwa.canInstall && (
          <button className="app-header__icon" onClick={pwa.install} type="button" aria-label="Installer Le QG">
            <Download size={18} />
          </button>
        )}
        <button className="app-header__icon" onClick={onToggleTheme} type="button" aria-label="Changer de theme">
          {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
        </button>
      </div>
      {pwa.updateAvailable && <UpdateNotice onUpdate={pwa.applyUpdate} />}
    </header>
  );
}

export default function AppShell({ user, theme, onToggleTheme, onLogout, children }) {
  const navigate = useNavigate();
  const pwa = usePwaControls();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return undefined;
    const close = () => setOpen(false);
    window.addEventListener('click', close);
    return () => window.removeEventListener('click', close);
  }, [open]);

  return (
    <div className="app-shell">
      <div className="ambient ambient--teal" />
      <div className="ambient ambient--fuchsia" />
      <div className="ambient ambient--amber" />

      <div className="app-shell__frame">
        <header className="app-header">
          <Brand onClick={() => navigate('/dashboard')} />
          <HeaderNav />

          <div className="app-header__actions">
            <NetworkPill isOnline={pwa.isOnline} />
            <div className="coin-pill" title="Votre solde">
              <Coins size={16} />
              <span>{(user?.coins || 0).toLocaleString('fr-FR')}</span>
            </div>
            <NotificationsMenu />
            <div className="app-user">
              <button
                className="app-user__trigger"
                type="button"
                onClick={(event) => { event.stopPropagation(); setOpen((value) => !value); }}
                aria-expanded={open}
              >
                <UserAvatar user={user} />
                <span className="app-user__name">{user?.username}</span>
                <ChevronDown size={14} />
              </button>

              {open && (
                <div className="app-user__menu" onClick={(event) => event.stopPropagation()}>
                  <div className="app-user__summary">
                    <strong>{user?.username}<small>#{user?.discriminator}</small></strong>
                    <span>{user?.role === 'admin' ? 'Administrateur' : 'Joueur'}</span>
                  </div>
                  {user?.role === 'admin' && (
                    <button type="button" onClick={() => { navigate('/admin'); setOpen(false); }}>
                      <ShieldAlert size={15} /> Espace Admin
                    </button>
                  )}
                  <button type="button" onClick={() => { navigate('/profil'); setOpen(false); }}>
                    <User size={15} /> Mon profil
                  </button>
                  {pwa.canInstall && (
                    <button type="button" onClick={pwa.install}>
                      <Download size={15} /> Installer l'application
                    </button>
                  )}
                  <button type="button" onClick={onToggleTheme}>
                    {theme === 'dark' ? <Sun size={15} /> : <Moon size={15} />}
                    {theme === 'dark' ? 'Mode clair' : 'Mode sombre'}
                  </button>
                  <span className="app-user__divider" />
                  <button type="button" onClick={onLogout}>
                    <LogOut size={15} /> Déconnexion
                  </button>
                </div>
              )}
            </div>
          </div>
        </header>

        <main className="app-content">{children}</main>
      </div>
      {pwa.updateAvailable && <UpdateNotice onUpdate={pwa.applyUpdate} />}
      <MobileNav />
    </div>
  );
}
