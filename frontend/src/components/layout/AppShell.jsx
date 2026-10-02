import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import {
  ArrowLeftRight,
  ChevronDown,
  Download,
  LayoutDashboard,
  LayoutGrid,
  LogOut,
  RefreshCw,
  ShieldAlert,
  ShoppingBag,
  Trophy,
  User,
  Wifi,
  WifiOff,
} from 'lucide-react';
import { PUBLIC_BASE } from '../../utils/api';
import { useNotifications, ProfileNotifications } from '../notifications/NotificationsMenu';
import usePwaControls from '../../pwa/usePwaControls';

const NAV_ITEMS = [
  { to: '/dashboard', label: 'Accueil', icon: LayoutDashboard },
  { to: '/performance', label: 'Performance', icon: Trophy, match: '/classement' },
  { to: '/collection', label: 'Collection', icon: LayoutGrid },
  { to: '/echanges', label: 'Échanges', icon: ArrowLeftRight },
  { to: '/boutique', label: 'Boutique', icon: ShoppingBag },
  { to: '/profil', label: 'Profil', icon: User },
];

const HEADER_NAV_ITEMS = NAV_ITEMS.filter(({ to }) => to !== '/profil');

function Brand({ onClick }) {
  return (
    <button className="app-brand" type="button" onClick={onClick} aria-label="Retour à l'accueil">
      <span className="app-brand__mark">O</span>
      <span className="app-brand__name">Omnia</span>
    </button>
  );
}

function UserAvatar({ user }) {
  const value = user?.avatar_url;
  const hasBorder = !!user?.equipped_border;
  const className = `app-user__avatar ${user?.equipped_border || ''}`.trim();
  const avatarStyle = { borderRadius: '50%', border: hasBorder ? undefined : 'none', boxShadow: hasBorder ? undefined : 'none' };

  if (value?.startsWith('/uploads/')) return <img src={`${PUBLIC_BASE}${value}`} alt="" className={className} style={avatarStyle} />;
  if (value?.startsWith('http')) return <img src={value} alt="" className={className} style={avatarStyle} />;

  return <span className={className} style={avatarStyle}>{value || user?.username?.[0]?.toUpperCase() || 'U'}</span>;
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
      <span><strong>Omnia a été mis à jour.</strong><small>Recharge pour utiliser la nouvelle version.</small></span>
      <button type="button" onClick={onUpdate}>Mettre à jour</button>
    </div>
  );
}

export function AuthHeader() {
  const navigate = useNavigate();
  const pwa = usePwaControls();
  return (
    <header className="app-header app-header--auth">
      <Brand onClick={() => navigate('/')} />
      <div className="app-header__actions">
        <NetworkPill isOnline={pwa.isOnline} />
        {pwa.canInstall && (
          <button className="app-header__icon" onClick={pwa.install} type="button" aria-label="Installer Omnia">
            <Download size={18} />
          </button>
        )}
      </div>
      {pwa.updateAvailable && <UpdateNotice onUpdate={pwa.applyUpdate} />}
    </header>
  );
}

export default function AppShell({ user, onLogout, children }) {
  const navigate = useNavigate();
  const pwa = usePwaControls();
  const notifications = useNotifications();
  const [open, setOpen] = useState(false);
  const count = notifications.count;
  const hasNotifications = count > 0;

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
            <div className="app-user">
              <button
                className="app-user__trigger"
                type="button"
                onClick={(event) => { event.stopPropagation(); setOpen((value) => !value); }}
                aria-expanded={open}
              >
                <div style={{ position: 'relative', display: 'inline-flex' }}>
                  <UserAvatar user={user} />
                  {hasNotifications && (
                    <span className="app-user__notification-dot" title={`${count} nouvelle(s) notification(s)`} />
                  )}
                </div>
                <span
                  className={`app-user__name ${user?.equipped_color === 'rainbow' ? 'text-rainbow' : (user?.equipped_color === 'cyberpunk' ? 'text-cyberpunk' : '')}`}
                  style={user?.equipped_color && !['rainbow', 'cyberpunk'].includes(user.equipped_color) ? { color: user.equipped_color } : undefined}
                >
                  {user?.username}
                </span>
                <ChevronDown size={14} />
              </button>

              {open && (
                <div className="app-user__menu" onClick={(event) => event.stopPropagation()}>
                  <div className="app-user__summary">
                    <strong
                      className={user?.equipped_color === 'rainbow' ? 'text-rainbow' : (user?.equipped_color === 'cyberpunk' ? 'text-cyberpunk' : '')}
                      style={user?.equipped_color && !['rainbow', 'cyberpunk'].includes(user.equipped_color) ? { color: user.equipped_color } : undefined}
                    >
                      {user?.username}<small>#{user?.discriminator}</small>
                    </strong>
                    <span>{user?.equipped_title || (user?.role === 'admin' ? 'Administrateur' : 'Joueur')}</span>
                  </div>

                  <ProfileNotifications notifications={notifications} onClose={() => setOpen(false)} />

                  <span className="app-user__divider" />

                  {user?.role === 'admin' && (
                    <button type="button" onClick={() => { navigate('/admin'); setOpen(false); }}>
                      <ShieldAlert size={15} /> Espace Admin
                    </button>
                  )}
                  <button type="button" onClick={() => { navigate('/profil'); setOpen(false); }}>
                    <User size={15} /> Mon profil
                  </button>
                  <button type="button" onClick={() => { navigate('/echanges'); setOpen(false); }}>
                    <ArrowLeftRight size={15} /> Mes échanges
                  </button>
                  {pwa.canInstall && (
                    <button type="button" onClick={pwa.install}>
                      <Download size={15} /> Installer l'application
                    </button>
                  )}
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
