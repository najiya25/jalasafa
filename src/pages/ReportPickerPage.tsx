import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import type { Facility } from '../../shared/types';
import { api } from '../lib/api';
import { loadFacilityList, saveFacilityList } from '../lib/cache';
import { useOnline } from '../lib/hooks';
import { useI18n } from '../lib/i18n';
import { facilityTypeLabel } from '../lib/labels';

type Source = 'loading' | 'live' | 'cache' | 'empty';

/**
 * Step 1 of reporting: pick which facility has the problem. Searchable list —
 * no identity is asked for at any point (spec D).
 */
export function ReportPickerPage() {
  const { t } = useI18n();
  const online = useOnline();

  const [facilities, setFacilities] = useState<Facility[]>([]);
  const [source, setSource] = useState<Source>('loading');
  const [cachedAt, setCachedAt] = useState<string | null>(null);
  const [query, setQuery] = useState('');

  useEffect(() => {
    let cancelled = false;
    setSource('loading');
    api
      .facilities()
      .then((list) => {
        if (cancelled) return;
        setFacilities(list);
        saveFacilityList(list);
        setSource('live');
      })
      .catch(() => {
        if (cancelled) return;
        const cached = loadFacilityList();
        if (cached) {
          setFacilities(cached.facilities);
          setCachedAt(cached.savedAt);
          setSource('cache');
        } else {
          setFacilities([]);
          setSource('empty');
        }
      });
    return () => {
      cancelled = true;
    };
  }, [online]);

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = q
      ? facilities.filter((f) => [f.name, f.address, f.locality].some((v) => v.toLowerCase().includes(q)))
      : facilities;
    return [...list].sort((a, b) => a.name.localeCompare(b.name));
  }, [facilities, query]);

  const isLoading = source === 'loading';
  const hasNoData = source === 'empty' || (source !== 'loading' && facilities.length === 0);
  const hasNoMatch = source !== 'loading' && facilities.length > 0 && results.length === 0;

  return (
    <div className="container" style={{ paddingTop: 24 }}>
      <div className="card form-card">
        <h1>{t('picker.title')}</h1>
        <p style={{ marginTop: 0 }}>{t('picker.intro')}</p>

        <div className="field">
          <label htmlFor="pick-q">{t('picker.searchLabel')}</label>
          <input
            id="pick-q"
            type="search"
            placeholder={t('picker.searchPlaceholder')}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>

        {source === 'cache' && (
          <div className="notice warn" role="status">
            {t('home.cacheBody', {
              when: cachedAt ? new Date(cachedAt).toLocaleString() : t('home.earlierVisit'),
            })}
          </div>
        )}
        {hasNoData && (
          <div className="notice error" role="alert">
            {t('picker.emptyDataset')}
          </div>
        )}
        {isLoading && (
          <p role="status" style={{ marginTop: 16 }}>
            {t('picker.loading')}
          </p>
        )}

        {results.length > 0 && (
          <ul className="picker-list">
            {results.map((f) => {
              const type = facilityTypeLabel(f.type);
              return (
                <li className="picker-row" key={f.id}>
                  <span className={`pill ${f.type}`}>
                    <span aria-hidden="true">{type.glyph}</span> {type.text}
                  </span>
                  <span className="who">
                    <Link to={`/facility/${f.id}`}>
                      <b>{f.name}</b>
                    </Link>
                    <span className="locality">
                      {f.locality} · {f.address}
                    </span>
                  </span>
                  <Link className="btn small" to={`/report/${f.id}`}>
                    {t('picker.reportAction')}
                  </Link>
                </li>
              );
            })}
          </ul>
        )}

        {hasNoMatch && (
          <p role="status" style={{ marginTop: 16 }}>
            {t('picker.noMatch')}
          </p>
        )}
      </div>
    </div>
  );
}
