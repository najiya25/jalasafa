import { Link } from 'react-router-dom';
import type { Facility } from '../../shared/types';
import { distanceText } from '../lib/geo';
import {
  availabilityLabel,
  badgeTone,
  conditionLabel,
  facilityTypeLabel,
  formatDate,
  openStatusLabel,
} from '../lib/labels';
import { useI18n, type TKey } from '../lib/i18n';
import { Badge } from './Badge';

const ACCESS_CHIPS: { key: keyof Facility['accessibility']; labelKey: TKey; glyph: string }[] = [
  { key: 'wheelchairAccessible', labelKey: 'chip.wheelchair', glyph: '♿' },
  { key: 'accessibleEntrance', labelKey: 'chip.entrance', glyph: '🚪' },
  { key: 'accessibleToilet', labelKey: 'chip.toilet', glyph: '🚻' },
  { key: 'handrails', labelKey: 'chip.handrails', glyph: '🪜' },
  { key: 'babyChanging', labelKey: 'chip.baby', glyph: '👶' },
  { key: 'brailleSignage', labelKey: 'chip.braille', glyph: '⠿' },
  { key: 'lighting', labelKey: 'chip.lighting', glyph: '💡' },
];

/** A facility card as required by spec A: name/type, distance, condition,
 *  availability, accessibility, last updated, local body, open/closed.
 *  `distanceFrom="route"` shows "X from route" on the Along-My-Route page. */
export function FacilityCard({
  facility,
  distanceKm,
  distanceFrom,
}: {
  facility: Facility;
  distanceKm: number | null;
  distanceFrom?: 'route';
}) {
  const { t } = useI18n();
  const type = facilityTypeLabel(facility.type);
  const condition = conditionLabel(facility.condition);
  const availability = availabilityLabel(facility.availability);
  const open = openStatusLabel(facility.openStatus);
  const tags = ACCESS_CHIPS.filter((a) => facility.accessibility[a.key]);
  const stale = Date.now() - new Date(facility.lastUpdated).getTime() > 7 * 86_400_000;

  const distanceText2 =
    distanceFrom === 'route' && distanceKm != null
      ? t('card.fromRoute', { d: distanceText(distanceKm) })
      : distanceKm != null
        ? `⌖ ${distanceText(distanceKm)}`
        : t('card.distanceNone');

  return (
    <article className="card facility-card" aria-label={facility.name}>
      <div className="card-top-row">
        <span className={`pill ${facility.type}`}>
          <span aria-hidden="true">{type.glyph}</span> {type.text}
        </span>
        <span className="distance">{distanceText2}</span>
      </div>

      <h3>{facility.name}</h3>
      <p className="locality">
        {facility.locality} · {facility.address}
      </p>

      <div className="badge-row">
        <Badge tone={badgeTone('condition', facility.condition)} glyph={condition.glyph}>
          {condition.text}
        </Badge>
        <Badge tone={badgeTone('availability', facility.availability)} glyph={availability.glyph}>
          {availability.text}
        </Badge>
        <Badge tone={facility.openStatus === 'open' ? 'ok' : facility.openStatus === 'closed' ? 'bad' : 'muted'} glyph={open.glyph}>
          {open.text}
          {facility.hours ? ` · ${facility.hours}` : ''}
        </Badge>
      </div>

      <div className="access-tags">
        {tags.length > 0 ? (
          tags.map((a) => (
            <span className="access-tag" key={a.key}>
              <span aria-hidden="true">{a.glyph}</span> {t(a.labelKey)}
            </span>
          ))
        ) : (
          <span className="access-tag none">{t('card.noAccess')}</span>
        )}
      </div>

      <dl className="kv">
        <dt>{t('card.localBody')}</dt>
        <dd>{facility.localBodyName}</dd>
      </dl>

      <p className={`freshness${stale ? ' stale' : ''}`}>
        <span aria-hidden="true">🕒</span>
        <b>{t('fresh.lastUpdated', { date: formatDate(facility.lastUpdated) })}</b>
        {stale ? <span>{t('card.stale')}</span> : null}
      </p>

      <div className="card-actions">
        <Link className="btn small" to={`/facility/${facility.id}`}>
          {t('card.viewDetails')}
        </Link>
        <a
          className="btn small secondary"
          href={`https://www.google.com/maps/dir/?api=1&destination=${facility.lat},${facility.lng}`}
          target="_blank"
          rel="noopener noreferrer"
        >
          <span aria-hidden="true">➤</span> {t('card.directions')}
        </a>
      </div>
    </article>
  );
}
