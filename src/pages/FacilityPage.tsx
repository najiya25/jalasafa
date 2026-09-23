import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import type { Accessibility, Facility } from '../../shared/types';
import { api, NetworkError } from '../lib/api';
import { loadFacilityDetail, saveFacilityDetail } from '../lib/cache';
import { distanceText, haversineKm } from '../lib/geo';
import { useGeolocation, useOnline } from '../lib/hooks';
import {
  availabilityLabel,
  badgeTone,
  conditionLabel,
  facilityTypeLabel,
  formatDate,
  openStatusLabel,
} from '../lib/labels';
import { useI18n, type TKey } from '../lib/i18n';
import { Badge } from '../components/Badge';
import { FreshnessNote } from '../components/FreshnessNote';

const ACCESS_ROWS: { key: keyof Accessibility; labelKey: TKey; glyph: string }[] = [
  { key: 'wheelchairAccessible', labelKey: 'arow.wheelchair', glyph: '♿' },
  { key: 'accessibleEntrance', labelKey: 'arow.entrance', glyph: '🚪' },
  { key: 'accessibleToilet', labelKey: 'arow.toilet', glyph: '🚻' },
  { key: 'handrails', labelKey: 'arow.handrails', glyph: '🪜' },
  { key: 'babyChanging', labelKey: 'arow.baby', glyph: '👶' },
  { key: 'brailleSignage', labelKey: 'arow.braille', glyph: '⠿' },
  { key: 'lighting', labelKey: 'arow.lighting', glyph: '💡' },
];

type LoadState = 'loading' | 'live' | 'cache' | 'missing';

export function FacilityPage() {
  const { id = '' } = useParams();
  const { t } = useI18n();
  const [facility, setFacility] = useState<Facility | null>(null);
  const [state, setState] = useState<LoadState>('loading');
  const { coords } = useGeolocation();
  const online = useOnline();

  useEffect(() => {
    let cancelled = false;
    setState('loading');
    api
      .facility(id)
      .then((f) => {
        if (cancelled) return;
        setFacility(f);
        saveFacilityDetail(f);
        setState('live');
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        const cached = loadFacilityDetail(id);
        if (cached) {
          setFacility(cached);
          setState('cache');
        } else {
          setFacility(null);
          setState(err instanceof NetworkError ? 'cache' : 'missing');
        }
      });
    return () => {
      cancelled = true;
    };
  }, [id]);

  if (state === 'loading') {
    return (
      <div className="container" style={{ paddingTop: 24 }}>
        <div className="card empty-state">{t('detail.loading')}</div>
      </div>
    );
  }

  if (!facility) {
    return (
      <div className="container" style={{ paddingTop: 24 }}>
        <div className="card empty-state">
          <p>{state === 'cache' ? t('detail.notCached') : t('detail.notFound')}</p>
          <Link className="btn" to="/">
            {t('detail.backToMap')}
          </Link>
        </div>
      </div>
    );
  }

  const type = facilityTypeLabel(facility.type);
  const condition = conditionLabel(facility.condition);
  const availability = availabilityLabel(facility.availability);
  const open = openStatusLabel(facility.openStatus);
  const distanceKm = coords ? haversineKm(coords, facility) : null;

  return (
    <div className="container" style={{ paddingTop: 20 }}>
      <Link to="/" className="btn ghost small">
        {t('detail.back')}
      </Link>

      <div className="card" style={{ marginTop: 14 }}>
        <div className="detail-head">
          <div style={{ flex: 1, minWidth: 260 }}>
            <span className={`pill ${facility.type}`}>
              <span aria-hidden="true">{type.glyph}</span> {type.text}
            </span>
            <h1>{facility.name}</h1>
            <p style={{ margin: 0, color: 'var(--ink-soft)' }}>
              {facility.address}, {facility.locality}
            </p>
          </div>
        </div>

        <div className="badge-row" style={{ marginTop: 14 }}>
          <Badge tone={badgeTone('condition', facility.condition)} glyph={condition.glyph}>
            {t('detail.conditionPrefix')} {condition.text}
          </Badge>
          <Badge tone={badgeTone('availability', facility.availability)} glyph={availability.glyph}>
            {availability.text}
          </Badge>
          <Badge tone={facility.openStatus === 'open' ? 'ok' : facility.openStatus === 'closed' ? 'bad' : 'muted'} glyph={open.glyph}>
            {open.text}
            {facility.hours ? ` · ${facility.hours}` : ''}
          </Badge>
          <Badge tone="info" glyph="🏛️">
            {facility.localBodyName}
          </Badge>
        </div>

        {state === 'cache' && (
          <div className="notice warn" role="status">
            <b>{t('detail.cacheTitle')}</b> {t('detail.cacheBody')}
          </div>
        )}

        <div className="detail-grid">
          <div className="card" style={{ boxShadow: 'none' }}>
            <h3 style={{ marginTop: 0, fontSize: 17 }}>{t('detail.distance')}</h3>
            <p style={{ margin: 0 }}>
              {distanceKm != null ? (
                <b>{t('detail.away', { d: distanceText(distanceKm) })}</b>
              ) : (
                <>{t('detail.enableLocation')}</>
              )}
            </p>
          </div>
          <div className="card" style={{ boxShadow: 'none' }}>
            <h3 style={{ marginTop: 0, fontSize: 17 }}>🏛️ {t('detail.responsibleBody')}</h3>
            <p style={{ margin: 0 }}>
              <b>{facility.localBodyName}</b>
              <br />
              {t('detail.routedHere')}
            </p>
          </div>
          <div className="card" style={{ boxShadow: 'none' }}>
            <h3 style={{ marginTop: 0, fontSize: 17 }}>🕒 {t('detail.openingStatus')}</h3>
            <p style={{ margin: 0 }}>
              <b>{open.text}</b>
              <br />
              {facility.hours ?? t('detail.hoursMissing')}
            </p>
          </div>
        </div>

        <h2 style={{ fontSize: 20, marginTop: 22 }}>{t('detail.accessHeading')}</h2>
        <table className="access-table">
          <caption className="sr-only">{t('detail.accessCaption', { name: facility.name })}</caption>
          <tbody>
            {ACCESS_ROWS.map((row) => {
              const isToiletRow = row.key === 'accessibleToilet';
              const notApplicable = facility.type === 'water' && isToiletRow;
              const yes = facility.accessibility[row.key];
              return (
                <tr key={row.key}>
                  <th scope="row">
                    <span aria-hidden="true">{row.glyph}</span> {t(row.labelKey)}
                  </th>
                  <td>
                    {notApplicable ? (
                      <span className="badge muted">
                        <span className="glyph" aria-hidden="true">
                          ➖
                        </span>
                        {t('detail.notApplicable')}
                      </span>
                    ) : yes ? (
                      <span className="badge ok">
                        <span className="glyph" aria-hidden="true">
                          ✔
                        </span>
                        {t('detail.yes')}
                      </span>
                    ) : (
                      <span className="badge muted">
                        <span className="glyph" aria-hidden="true">
                          ✘
                        </span>
                        {t('detail.notRecorded')}
                      </span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>

        <FreshnessNote iso={facility.lastUpdated} />

        <div className="card-actions" style={{ marginTop: 16 }}>
          {online ? (
            <Link className="btn" to={`/report/${facility.id}`}>
              <span aria-hidden="true">📣</span> {t('detail.reportProblem')}
            </Link>
          ) : (
            <>
              <button type="button" className="btn" disabled>
                <span aria-hidden="true">📣</span> {t('detail.reportProblem')}
              </button>
              <span className="notice warn" style={{ marginTop: 0 }}>
                {t('detail.reportNeedsNet')}
              </span>
            </>
          )}
          <a
            className="btn secondary"
            href={`https://www.google.com/maps/dir/?api=1&destination=${facility.lat},${facility.lng}`}
            target="_blank"
            rel="noopener noreferrer"
            aria-disabled={!online}
            onClick={(e) => {
              if (!online) e.preventDefault();
            }}
          >
            <span aria-hidden="true">➤</span> {t('detail.directions')}
          </a>
          {!online && <span className="map-note">{t('detail.directionsNote')}</span>}
        </div>

        <div className="privacy-note">
          <b>{t('detail.privacyTitle')}</b> {t('detail.privacyBody')}
        </div>

        <p className="map-note" style={{ marginTop: 14 }}>
          {t('detail.recordId')} {facility.id} · {t('detail.coordinates')} {facility.lat.toFixed(5)},{' '}
          {facility.lng.toFixed(5)} {t('detail.notYours')} · {t('detail.loaded')}{' '}
          {formatDate(new Date().toISOString())}
        </p>
      </div>
    </div>
  );
}
