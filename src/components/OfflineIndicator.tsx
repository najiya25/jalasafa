import { loadFacilityList } from '../lib/cache';
import { formatDate } from '../lib/labels';
import { useOnline } from '../lib/hooks';
import { useI18n } from '../lib/i18n';

/**
 * Always-visible connectivity state:
 *  • Online  → "live data"
 *  • Offline → "Offline mode" + when the cached copy was saved.
 */
export function OfflineIndicator() {
  const online = useOnline();
  const cached = loadFacilityList();
  const { t } = useI18n();

  if (online) {
    return (
      <span className="net-indicator" role="status">
        <span aria-hidden="true">●</span> {t('net.online')}
      </span>
    );
  }

  return (
    <span className="net-indicator offline" role="status">
      <span aria-hidden="true">◐</span> {t('net.offline')}
      {cached ? (
        <small>{t('net.cached', { when: formatDate(cached.savedAt) })}</small>
      ) : (
        <small>{t('net.noCache')}</small>
      )}
    </span>
  );
}
