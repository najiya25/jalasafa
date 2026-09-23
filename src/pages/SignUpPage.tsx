import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ApiError, NetworkError } from '../lib/api';
import { useAuth } from '../lib/auth';
import { useI18n } from '../lib/i18n';

/**
 * Prototype sign-up (login feature). Passwords are validated here exactly as
 * the server does (≥ 8 chars) and are only ever sent for scrypt hashing —
 * never stored or returned in plain text.
 */
export function SignUpPage() {
  const { t } = useI18n();
  const { signUp, continueAsGuest } = useAuth();
  const navigate = useNavigate();

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

  const onSubmit = async (e: FormEvent): Promise<void> => {
    e.preventDefault();
    // Friendly, translated validation — mirrors the server rules.
    if (!name.trim()) {
      setError(t('auth.err.nameRequired'));
      return;
    }
    if (!email.trim()) {
      setError(t('auth.err.emailRequired'));
      return;
    }
    if (!EMAIL_RE.test(email.trim())) {
      setError(t('auth.err.emailInvalid'));
      return;
    }
    if (password.length < 8) {
      setError(t('auth.err.passwordShort'));
      return;
    }
    if (password !== confirm) {
      setError(t('auth.err.mismatch'));
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await signUp(name.trim(), email.trim(), password);
      navigate('/', { replace: true });
    } catch (err) {
      if (err instanceof NetworkError) setError(t('auth.err.offline'));
      else if (err instanceof ApiError && err.status === 409) setError(t('auth.err.emailTaken'));
      else if (err instanceof ApiError) setError(err.message);
      else setError(t('auth.err.generic'));
      setBusy(false);
    }
  };

  return (
    <div className="container" style={{ paddingTop: 24 }}>
      <div className="card form-card auth-card">
        <Link to="/" className="btn ghost small">
          {t('auth.backHome')}
        </Link>

        <h1 style={{ marginTop: 16, fontSize: 26 }}>{t('auth.signUpTitle')}</h1>

        <form onSubmit={(e) => void onSubmit(e)} noValidate>
          <div className="field">
            <label htmlFor="name">{t('auth.nameLabel')}</label>
            <input
              id="name"
              type="text"
              autoComplete="name"
              maxLength={60}
              placeholder={t('auth.namePlaceholder')}
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
          </div>
          <div className="field">
            <label htmlFor="email">{t('auth.emailLabel')}</label>
            <input
              id="email"
              type="email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>
          <div className="field">
            <label htmlFor="password">{t('auth.passwordLabel')}</label>
            <input
              id="password"
              type="password"
              autoComplete="new-password"
              minLength={8}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              aria-describedby="password-hint"
              required
            />
            <p id="password-hint" className="hint">
              {t('auth.passwordHint')}
            </p>
          </div>
          <div className="field">
            <label htmlFor="confirm">{t('auth.confirmLabel')}</label>
            <input
              id="confirm"
              type="password"
              autoComplete="new-password"
              minLength={8}
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              required
            />
          </div>

          {error && (
            <div className="notice error" role="alert">
              {error}
            </div>
          )}

          <div className="form-actions">
            <button type="submit" disabled={busy}>
              {t('auth.signUpAction')}
            </button>
            <button
              type="button"
              className="btn secondary"
              onClick={() => {
                continueAsGuest();
                navigate('/');
              }}
            >
              {t('auth.guestAction')}
            </button>
          </div>
        </form>

        <p style={{ marginTop: 16 }}>
          {t('auth.haveAccount')}{' '}
          <Link to="/signin">
            <b>{t('auth.signInAction')}</b>
          </Link>
        </p>

        <div className="privacy-note">
          <b>{t('account.label')}</b> {t('auth.prototypeNote')}
        </div>
      </div>
    </div>
  );
}
