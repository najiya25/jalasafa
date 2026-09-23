import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import type { Facility } from '../../shared/types';
import { api } from '../lib/api';
import { loadFacilityList, saveFacilityList } from '../lib/cache';
import { distanceToSegmentKm, haversineKm, type LatLon } from '../lib/geo';
import { useOnline } from '../lib/hooks';
import { useI18n } from '../lib/i18n';
import { conditionLabel } from '../lib/labels';
import { FacilityCard } from '../components/FacilityCard';
import { FacilityMap } from '../components/FacilityMap';

interface Place extends LatLon {
  name: string;
}

/**
 * Demo-city places for the SIMULATED route search. Free, offline and honest:
 * no routing service, no paid API key — the corridor is a straight line
 * between the two chosen coordinates (see distanceToSegmentKm in lib/geo).
 */
const PLACES: Place[] = [
  { name: 'Kochi', lat: 9.9816, lng: 76.2999 },
  { name: 'Fort Kochi', lat: 9.9658, lng: 76.2423 },
  { name: 'Mattancherry', lat: 9.9579, lng: 76.2599 },
  { name: 'Ernakulam', lat: 9.9775, lng: 76.2803 },
  { name: 'Vyttila', lat: 9.967, lng: 76.304 },
  { name: 'Tripunithura', lat: 9.956, lng: 76.325 },
  { name: 'Kaloor', lat: 9.9945, lng: 76.2983 },
  { name: 'Palarivattom', lat: 9.9917, lng: 76.307 },
  { name: 'Edappally', lat: 9.9812, lng: 76.311 },
  { name: 'Kakkanad', lat: 10.0265, lng: 76.3065 },
  { name: 'Kalamassery', lat: 10.053, lng: 76.305 },
  { name: 'Aluva', lat: 10.1081, lng: 76.3517 },
  { name: 'Kadamakudy', lat: 9.993, lng: 76.41 },
];

const SUGGESTED = 'Kochi, Aluva, Fort Kochi, Kakkanad, Kalamassery, Tripunithura, Kadamakudy';

const WIDTHS = [0.5, 1, 2] as const;
type Width = (typeof WIDTHS)[number];

type Source = 'loading' | 'live' | 'cache' | 'empty';

/**
 * "Facilities Along My Route" (simulated): straight-line corridor between a
 * start and a destination, showing every facility within a chosen distance of
 * it — sorted nearest-to-route first, with distance-from-route on each card.
 */
export function RoutePage() {
  const { t } = useI18n();
  const online = useOnline();

  const [facilities, setFacilities] = useState<Facility[]>([]);
  const [source, setSource] = useState<Source>('loading');
  const [cachedAt, setCachedAt] = useState<string | null>(null);

  const [startText, setStartText] = useState('');
  const [destText, setDestText] = useState('');
  const [route, setRoute] = useState<{ start: Place; end: Place } | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [width, setWidth] = useState<Width>(1);
  const [availOnly, setAvailOnly] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  // Load facilities: live API → save to cache; on failure use the saved copy.
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

  const findPlace = (input: string): Place | null => {
    const v = input.trim().toLowerCase();
    if (!v) return null;
    return (
      PLACES.find((p) => p.name.toLowerCase() === v) ??
      PLACES.find((p) => p.name.toLowerCase().includes(v)) ??
      null
    );
  };

  const onSubmit = (e: FormEvent): void => {
    e.preventDefault();
    const s = startText.trim();
    const d = destText.trim();
    if (!s || !d) {
      setFormError(t('route.needBoth'));
      return;
    }
    const sp = findPlace(s);
    const dp = findPlace(d);
    if (!sp || !dp) {
      setFormError(t('route.unknownPlace', { place: !sp ? s : d }));
      return;
    }
    if (sp.name === dp.name) {
      setFormError(t('route.samePlace'));
      return;
    }
    setFormError(null);
    setRoute({ start: sp, end: dp });
  };

  const widthLabel = (w: Width): string =>
    w === 0.5 ? t('route.width05') : w === 1 ? t('route.width1') : t('route.width2');

  // Facilities within `width` km of the corridor, nearest to the route first.
  const corridor = useMemo(() => {
    if (!route) return [];
    return facilities
      .map((facility) => ({ facility, dist: distanceToSegmentKm(facility, route.start, route.end) }))
      .filter((item) => item.dist <= width)
      .sort((a, b) => a.dist - b.dist);
  }, [facilities, route, width]);

  const results = useMemo(
    () => (availOnly ? corridor.filter((i) => i.facility.availability === 'available') : corridor),
    [corridor, availOnly],
  );
  const routeFacilities = useMemo(() => results.map((r) => r.facility), [results]);
  const routeLine = useMemo<[number, number][] | null>(
    () => (route ? [[route.start.lat, route.start.lng], [route.end.lat, route.end.lng]] : null),
    [route],
  );

  const routeKm = route ? haversineKm(route.start, route.end) : 0;
  const selected = selectedId ? results.find((r) => r.facility.id === selectedId) : undefined;

  return (
    <div className="container" style={{ paddingTop: 24 }}>
      <section className="card route-intro">
        <span className="pill sim">{t('route.simPill')}</span>
        <h1>{t('route.title')}</h1>
        <p>{t('route.explain')}</p>
      </section>

      <section className="card route-form" aria-label={t('route.findAction')}>
        <form onSubmit={onSubmit} noValidate>
          <div className="route-fields">
            <div className="field">
              <label htmlFor="route-start">{t('route.startLabel')}</label>
              <input
                id="route-start"
                list="route-places"
                autoComplete="off"
                placeholder={t('route.startPlaceholder')}
                value={startText}
                onChange={(e) => {
                  setStartText(e.target.value);
                  setFormError(null);
                }}
              />
            </div>
            <div className="field">
              <label htmlFor="route-dest">{t('route.destLabel')}</label>
              <input
                id="route-dest"
                list="route-places"
                autoComplete="off"
                placeholder={t('route.destPlaceholder')}
                value={destText}
                onChange={(e) => {
                  setDestText(e.target.value);
                  setFormError(null);
                }}
              />
            </div>
            <button type="submit" className="btn route-submit">
              <span aria-hidden="true">🔍</span> {t('route.findAction')}
            </button>
          </div>
        </form>

        <datalist id="route-places">
          {PLACES.map((p) => (
            <option key={p.name} value={p.name} />
          ))}
        </datalist>

        <p className="hint" style={{ marginTop: 10 }}>
          {t('route.suggested', { places: SUGGESTED })}
        </p>

        {formError && (
          <div className="notice error" role="alert">
            {formError}
          </div>
        )}
      </section>

      {source === 'loading' && (
        <div className="card empty-state" style={{ marginTop: 14 }}>
          {t('home.loadingCards')}
        </div>
      )}
      {source === 'empty' && (
        <div className="notice error" role="alert" style={{ marginTop: 14 }}>
          {t('home.emptyBody')}
        </div>
      )}
      {source === 'cache' && (
        <div className="notice warn" role="status" style={{ marginTop: 14 }}>
          {t('route.worksOffline')}{' '}
          {t('home.cacheBody', {
            when: cachedAt ? new Date(cachedAt).toLocaleString() : t('home.earlierVisit'),
          })}
        </div>
      )}

      {route && (
        <section aria-label={t('route.resultsHeading')} style={{ marginTop: 4 }}>
          <div className="route-summary">
            <p className="results-note" aria-live="polite">
              <b>
                {t('route.summary', {
                  n: corridor.length,
                  w: widthLabel(width),
                  d: routeKm.toFixed(1),
                })}
              </b>
              {results.length < corridor.length ? t('route.summaryFiltered', { shown: results.length }) : ''}
            </p>
            <div className="route-controls">
              <label htmlFor="route-width">{t('route.widthLabel')}</label>
              <select
                id="route-width"
                value={width}
                onChange={(e) => {
                  setWidth(Number(e.target.value) as Width);
                  setSelectedId(null);
                }}
              >
                {WIDTHS.map((w) => (
                  <option key={w} value={w}>
                    {widthLabel(w)}
                  </option>
                ))}
              </select>
              <button
                type="button"
                className="chip"
                aria-pressed={availOnly}
                onClick={() => setAvailOnly((v) => !v)}
              >
                {t('route.availOnly')}
              </button>
            </div>
          </div>

          <FacilityMap
            facilities={routeFacilities}
            userLocation={null}
            selectedId={selectedId}
            onSelect={setSelectedId}
            routeLine={routeLine}
          >
            <p className="map-note">{t('route.mapHint')}</p>
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

          {results.length === 0 ? (
            <div className="card empty-state" role="status">
              <p>{t('route.noResults', { w: widthLabel(width) })}</p>
              {width < 2 && (
                <button type="button" className="btn small" onClick={() => setWidth(2)}>
                  {t('route.widen')}
                </button>
              )}
            </div>
          ) : (
            <>
              <h2 id="route-results" style={{ fontSize: 20, margin: '16px 0 10px' }}>
                {t('route.resultsHeading')}
              </h2>
              <div className="results route-results">
                {results.map(({ facility, dist }) => (
                  <FacilityCard key={facility.id} facility={facility} distanceKm={dist} distanceFrom="route" />
                ))}
              </div>
            </>
          )}
        </section>
      )}
    </div>
  );
}
