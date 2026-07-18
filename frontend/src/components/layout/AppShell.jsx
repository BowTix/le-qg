import React, { useEffect, useState } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import {
  ChevronDown,
  CircleHelp,
  Coins,
  LayoutDashboard,
  LayoutGrid,
  LogOut,
  Moon,
  ShieldAlert,
  ShoppingBag,
  Sun,
  User,
} from 'lucide-react';
import { PUBLIC_BASE } from '../../utils/api';

const NAV_ITEMS = [
  { to: '/dashboard', label: 'Accueil', icon: LayoutDashboard },
  { to: '/collection', label: 'Collection', icon: LayoutGrid },
  { to: '/boutique', label: 'Boutique', icon: ShoppingBag },
  { to: '/profil', label: 'Profil', icon: User },
];

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
  return (
    <nav className="app-nav" aria-label="Navigation principale">
      {NAV_ITEMS.map(({ to, label, icon: Icon, match }) => (
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

export function AuthHeader({ theme, onToggleTheme }) {
  const navigate = useNavigate();
  return (
    <header className="app-header app-header--auth">
      <Brand onClick={() => navigate('/')} />
      <button className="app-header__icon" onClick={onToggleTheme} type="button" aria-label="Changer de thème">
        {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
      </button>
    </header>
  );
}

export default function AppShell({ user, theme, onToggleTheme, onLogout, children }) {
  const navigate = useNavigate();
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
            <div className="coin-pill" title="Votre solde">
              <Coins size={16} />
              <span>{(user?.coins || 0).toLocaleString('fr-FR')}</span>
            </div>
            <button className="app-header__icon header-help" type="button" aria-label="Aide">
              <CircleHelp size={18} />
            </button>
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
      <MobileNav />
    </div>
  );
}
