import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ApiError, NetworkError } from '../lib/api';
import { useAuth } from '../lib/auth';
import { useI18n } from '../lib/i18n';

/**
 * Prototype sign-in (login feature). Never blocks the finder: guests reach
 * every page without an account, and reports stay anonymous either way.
 */
export function SignInPage() {
  const { t } = useI18n();
  const { signIn, continueAsGuest } = useAuth();
  const navigate = useNavigate();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const onSubmit = async (e: FormEvent): Promise<void> => {
    e.preventDefault();
    // Client-side checks mirror the server rules with friendly wording.
    if (!email.trim()) {
      setError(t('auth.err.emailRequired'));
      return;
    }
    if (!password) {
      setError(t('auth.err.passwordRequired'));
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await signIn(email.trim(), password);
      navigate('/', { replace: true });
    } catch (err) {
      if (err instanceof NetworkError) setError(t('auth.err.offline'));
      else if (err instanceof ApiError && err.status === 401) setError(t('auth.err.invalidCredentials'));
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

        <h1 style={{ marginTop: 16, fontSize: 26 }}>{t('auth.signInTitle')}</h1>

        <form onSubmit={(e) => void onSubmit(e)} noValidate>
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
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
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
              {t('auth.signInAction')}
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
          {t('auth.noAccount')}{' '}
          <Link to="/signup">
            <b>{t('auth.signUpAction')}</b>
          </Link>
        </p>

        <div className="privacy-note">
          <b>{t('account.label')}</b> {t('auth.prototypeNote')}
        </div>
      </div>
    </div>
  );
}
