import { useEffect, useState } from 'react';
import { Link, NavLink, useLocation } from 'react-router-dom';
import { OfflineIndicator } from './OfflineIndicator';
import { useHighContrast } from '../lib/hooks';
import { useAuth } from '../lib/auth';
import { LANGUAGES, useI18n, type Lang } from '../lib/i18n';

/**
 * Navbar: brand · links (Home / Find Facilities / Along My Route / Report /
 * Ticket Desk) · language switcher · account indicator · high contrast ·
 * connectivity. Collapses behind a keyboard-accessible hamburger below 768px;
 * the offline indicator stays visible either way.
 */
export function Header() {
  const [contrast, toggleContrast] = useHighContrast();
  const { lang, setLang, t } = useI18n();
  const { status, user, continueAsGuest, signOut } = useAuth();
  const [open, setOpen] = useState(false);
  const location = useLocation();

  // Close the mobile menu whenever we navigate (or jump to #find).
  useEffect(() => {
    setOpen(false);
  }, [location.pathname, location.hash]);

  // Escape closes the open menu (keyboard accessibility).
  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') setOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);

  return (
    <header className="header">
      <div className={`header-inner${open ? ' open' : ''}`}>
        <button
          type="button"
          className="nav-toggle"
          aria-expanded={open}
          aria-controls="site-menu"
          aria-label={open ? t('menu.close') : t('menu.open')}
          onClick={() => setOpen((v) => !v)}
        >
          <span aria-hidden="true">☰</span>
        </button>

        <Link className="brand" to="/">
          <span className="brand-mark" aria-hidden="true">
            💧
          </span>
          <span>
            <b>JalSafa</b>
            <small>{t('brand.tagline')}</small>
          </span>
        </Link>

        <div id="site-menu" className="site-menu">
          <nav aria-label={t('nav.aria')}>
            <NavLink to="/" end>
              <span aria-hidden="true">🏠</span>
              &nbsp;{t('nav.home')}
            </NavLink>
            <Link to="/#find">
              <span aria-hidden="true">🗺️</span>
              &nbsp;{t('nav.find')}
            </Link>
            <NavLink to="/route">
              <span aria-hidden="true">🧭</span>
              &nbsp;{t('nav.route')}
            </NavLink>
            <NavLink to="/report">
              <span aria-hidden="true">📣</span>
              &nbsp;{t('nav.report')}
            </NavLink>
            <NavLink to="/admin">
              <span aria-hidden="true">📋</span>
              &nbsp;{t('nav.admin')}
            </NavLink>
          </nav>

          <div className="header-tools">
            <label className="lang-switch" htmlFor="lang" title={t('lang.label')}>
              <span aria-hidden="true">🌐</span>
              <span className="sr-only">{t('lang.label')}</span>
              <select
                id="lang"
                aria-label={t('lang.label')}
                value={lang}
                onChange={(e) => setLang(e.target.value as Lang)}
              >
                {LANGUAGES.map((l) => (
                  <option key={l.code} value={l.code}>
                    {l.name}
                  </option>
                ))}
              </select>
            </label>

            {status === 'user' && user ? (
              <>
                <span className="account-chip" title={t('auth.signedInAs', { name: user.name })}>
                  <span aria-hidden="true">👤</span> {user.name}
                </span>
                <button type="button" className="account-signout" onClick={signOut}>
                  {t('account.signOut')}
                </button>
              </>
            ) : (
              <Link
                className="account-chip"
                to="/signin"
                title={status === 'guest' ? t('account.guestHint') : t('account.signUp')}
                onClick={() => {
                  if (status === 'unknown') continueAsGuest();
                }}
              >
                <span aria-hidden="true">👤</span>{' '}
                {status === 'guest' ? t('account.guest') : t('account.label')}
              </Link>
            )}

            <button
              type="button"
              className="contrast-btn"
              aria-pressed={contrast}
              onClick={toggleContrast}
              title="Toggle high contrast"
            >
              {t('contrast.toggle')}
            </button>
          </div>
        </div>

        <div className="header-actions">
          <OfflineIndicator />
        </div>
      </div>
    </header>
  );
}
