import { useEffect, useMemo, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import type { Accessibility, Facility } from '../../shared/types';
import { api } from '../lib/api';
import { loadFacilityDetail, loadFacilityList, loadRecentIds, saveFacilityList } from '../lib/cache';
import { haversineKm } from '../lib/geo';
import { useGeolocation, useOnline } from '../lib/hooks';
import { conditionLabel } from '../lib/labels';
import { useI18n } from '../lib/i18n';
import { useAuth } from '../lib/auth';
import { FacilityCard } from '../components/FacilityCard';
import { FacilityMap } from '../components/FacilityMap';
import { FilterPanel, activeFilterCount, emptyFilters, type Filters } from '../components/FilterPanel';

type Source = 'live' | 'cache' | 'empty';

export function HomePage() {
  const { t } = useI18n();
  const { status: choice, continueAsGuest } = useAuth();
  const [filters, setFilters] = useState<Filters>(emptyFilters);
  const [facilities, setFacilities] = useState<Facility[]>([]);
  const [source, setSource] = useState<Source>('empty');
  const [cachedAt, setCachedAt] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [recent] = useState<string[]>(() => loadRecentIds());

  const { coords, request, requesting, denied } = useGeolocation();
  const online = useOnline();
  const location = useLocation();

  // Navbar "Find Facilities" links to /#find — scroll to the search card.
  useEffect(() => {
    if (location.hash === '#find') {
      document.getElementById('find')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }, [location.hash]);

  // Load facilities: live API → cache on success, localStorage cache on failure.
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    api
      .facilities()
      .then((list) => {
        if (cancelled) return;
        setFacilities(list);
        saveFacilityList(list);
        setSource('live');
        setLoading(false);
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
        setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [online]);

  const results = useMemo(() => {
    type Item = { facility: Facility; distanceKm: number | null };
    let list: Item[] = facilities.map((facility) => ({
      facility,
      distanceKm: coords ? haversineKm(coords, facility) : null,
    }));

    const q = filters.query.trim().toLowerCase();
    if (q) {
      list = list.filter(({ facility: f }) =>
        [f.name, f.address, f.locality].some((v) => v.toLowerCase().includes(q)),
      );
    }
    if (filters.type !== 'all') list = list.filter(({ facility: f }) => f.type === filters.type);
    if (filters.availability.length) {
      list = list.filter(({ facility: f }) => filters.availability.includes(f.availability));
    }
    if (filters.conditions.length) {
      list = list.filter(({ facility: f }) => filters.conditions.includes(f.condition));
    }
    if (filters.accessibleOnly) {
      list = list.filter(
        ({ facility: f }) =>
          f.accessibility.wheelchairAccessible && f.accessibility.accessibleEntrance && f.accessibility.accessibleToilet,
      );
    }
    const activeAccess = (Object.keys(filters.access) as (keyof Accessibility)[]).filter(
      (k) => filters.access[k],
    );
    if (activeAccess.length) {
      list = list.filter(({ facility: f }) => activeAccess.every((k) => f.accessibility[k]));
    }
    if (filters.maxDistanceKm != null && coords) {
      list = list.filter((item) => item.distanceKm != null && item.distanceKm <= (filters.maxDistanceKm ?? Infinity));
    }

    if (coords) list.sort((a, b) => (a.distanceKm ?? 1e9) - (b.distanceKm ?? 1e9));
    else list.sort((a, b) => a.facility.name.localeCompare(b.facility.name));

    return list;
  }, [facilities, filters, coords]);

  const selected = selectedId ? results.find((r) => r.facility.id === selectedId) : undefined;
  const filterCount = activeFilterCount(filters);
  const recentFacilities = recent
    .map((id) => facilities.find((f) => f.id === id) ?? loadFacilityDetail(id))
    .filter((f): f is Facility => Boolean(f));

  return (
    <>
      <section className="hero-strip">
        <div className="container">
          <h1>{t('hero.title')}</h1>
          <p>
            {t('hero.demoLabel')} <b>Kochi, Kerala</b> {t('hero.demoNote')}
          </p>
        </div>
      </section>

      {/* First-visit choice: guest / sign in / sign up. Purely optional — the
          finder below works identically either way, and reports stay anonymous. */}
      {choice === 'unknown' && (
        <div className="container welcome-wrap">
          <div className="welcome-bar" role="region" aria-label={t('welcome.title')}>
            <div className="welcome-text">
              <b>{t('welcome.title')}</b>
              <span>{t('welcome.body')}</span>
            </div>
            <div className="welcome-actions">
              <button type="button" className="btn secondary small" onClick={continueAsGuest}>
                {t('welcome.guest')}
              </button>
              <Link className="btn small" to="/signin">
                {t('welcome.signIn')}
              </Link>
              <Link className="btn small" to="/signup">
                {t('welcome.signUp')}
              </Link>
              <button
                type="button"
                className="welcome-dismiss"
                aria-label={t('welcome.dismiss')}
                onClick={continueAsGuest}
              >
                ✕
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="container search-filters">
        <section id="find" className="card" aria-label={t('search.aria')}>
          <div className="search-row">
            <label className="sr-only" htmlFor="q">
              {t('search.label')}
            </label>
            <input
              id="q"
              type="search"
              placeholder={t('search.placeholder')}
              value={filters.query}
              onChange={(e) => setFilters({ ...filters, query: e.target.value })}
            />
            <button type="button" onClick={() => document.getElementById('results-heading')?.focus()}>
              <span aria-hidden="true">🔍</span> {t('search.button')}
            </button>
          </div>

          <div className="toolbar" style={{ marginTop: 12 }}>
            {coords ? (
              <span className="chip chip-active" style={{ cursor: 'default' }}>
                <span aria-hidden="true">📍</span> {t('search.nearbyChip')}
              </span>
            ) : (
              <button type="button" className="chip" onClick={request} disabled={requesting}>
                <span aria-hidden="true">📍</span> {requesting ? t('search.locating') : t('search.useLocation')}
              </button>
            )}
            {denied && (
              <span className="badge warn" role="status">
                <span className="glyph" aria-hidden="true">
                  ⚠️
                </span>
                {t('search.denied')}
              </span>
            )}
          </div>
        </section>

        <div style={{ marginTop: 14 }}>
          <FilterPanel value={filters} onChange={setFilters} hasLocation={Boolean(coords)} />
        </div>

        {!online && (
          <div className="notice warn" role="status">
            <b>{t('home.offlineBold')}</b>{' '}
            {t('home.offlineBody', {
              from: cachedAt ? t('home.offlineFrom', { when: new Date(cachedAt).toLocaleString() }) : '',
            })}{' '}
            <b>{t('home.offlineBold2')}</b> {t('home.offlineTail')}
          </div>
        )}
        {source === 'cache' && online && (
          <div className="notice warn" role="status">
            {t('home.cacheBody', {
              when: cachedAt ? new Date(cachedAt).toLocaleString() : t('home.earlierVisit'),
            })}
          </div>
        )}
        {source === 'empty' && !loading && (
          <div className="notice error" role="alert">
            {t('home.emptyBody')}
          </div>
        )}

        <p className="results-note" aria-live="polite">
          <b>
            {loading
              ? t('home.resultsLoading')
              : t('home.resultsShowing', { shown: results.length, total: facilities.length })}
          </b>{' '}
          ·{' '}
          {filterCount > 0
            ? t(filterCount > 1 ? 'home.filtersActive' : 'home.filterActive', { n: filterCount })
            : ''}
          {coords ? t('home.sortedNearest') : t('home.sortAz')}
        </p>

        <div className="split">
          <FacilityMap
            facilities={results.map((r) => r.facility)}
            userLocation={coords}
            selectedId={selectedId}
            onSelect={setSelectedId}
          >
            {selected && (
              <div className="selected-strip">
                <span className="name">
                  {conditionLabel(selected.facility.condition).glyph} {selected.facility.name}
                </span>
                <Link className="btn small" to={`/facility/${selected.facility.id}`}>
                  {t('map.openDetails')}
                </Link>
                <button type="button" className="btn small ghost" onClick={() => setSelectedId(null)}>
                  {t('map.close')}
                </button>
              </div>
            )}
          </FacilityMap>

          <div>
            <h2 id="results-heading" tabIndex={-1} style={{ fontSize: 20, margin: '2px 0 10px' }}>
              {t('home.resultsHeading')}
            </h2>
            <div className="results">
              {loading && <div className="card empty-state">{t('home.loadingCards')}</div>}
              {!loading && results.length === 0 && (
                <div className="card empty-state">
                  <p>{t('home.noMatch')}</p>
                  <button type="button" className="btn secondary" onClick={() => setFilters(emptyFilters)}>
                    {t('home.clearAll')}
                  </button>
                </div>
              )}
              {results.map(({ facility, distanceKm }) => (
                <FacilityCard key={facility.id} facility={facility} distanceKm={distanceKm} />
              ))}
            </div>

            {recentFacilities.length > 0 && (
              <div className="recent-row" aria-label={t('home.recentAria')}>
                <span className="label">{t('home.recentLabel')}</span>
                {recentFacilities.map((f) => (
                  <Link key={f.id} className="chip" to={`/facility/${f.id}`}>
                    {f.name}
                  </Link>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
