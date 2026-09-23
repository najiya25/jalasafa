import { formatDate } from '../lib/labels';
import { useI18n } from '../lib/i18n';

/** Mandatory data-freshness explanation (spec I). */
export function FreshnessNote({ iso }: { iso: string }) {
  const { t } = useI18n();
  const days = Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000);
  const old = days > 7;
  return (
    <div className={`freshness-panel${old ? ' stale' : ''}`}>
      <span aria-hidden="true">🕒</span>
      <span className="big">{t('fresh.lastUpdated', { date: formatDate(iso) })}</span>
      <p>
        {t('fresh.explain')}
        {old ? t('fresh.staleSuffix', { days }) : ''}.
      </p>
    </div>
  );
}
