/**
 * ONE-CITY SAMPLE DATASET — Kochi (Ernakulam), Kerala, India.
 *
 * IMPORTANT: The organiser-supplied facility dataset, accessibility fields,
 * local-body mapping, status categories and workflow rules were NOT present in
 * the repository. This file is clearly-labelled *seed/sample data* with the
 * exact shape required by the brief, so the organiser's real files can replace
 * it without touching application logic (see server/store.ts seedDatabase()).
 *
 * Coordinates are approximate public locations, for demo use only.
 */
import type {
  Accessibility,
  Condition,
  FacilityType,
  Issue,
  LocalBody,
  OpenStatus,
  Priority,
  TicketStatus,
  WorkflowRule,
} from '../shared/types';

export interface SeedFacility {
  id: string;
  name: string;
  type: FacilityType;
  address: string;
  locality: string;
  lat: number;
  lng: number;
  condition: Condition;
  openStatus: OpenStatus;
  hours: string | null;
  accessibility: Accessibility;
  localBodyId: string;
  lastUpdated: string;
}

export interface SeedTicket {
  id: string;
  facilityId: string;
  issue: Issue;
  description: string;
  status: TicketStatus;
  priority: Priority;
  slaHours: number;
  createdAt: string;
  updatedAt: string;
}

export const LOCAL_BODIES: LocalBody[] = [
  {
    id: 'kmc',
    name: 'Kochi Municipal Corporation',
    jurisdiction: 'Health & Sanitation Wing — Kochi city limits',
  },
  {
    id: 'kakkanad-tp',
    name: 'Kakkanad Town Panchayat',
    jurisdiction: 'Kakkanad town, Infopark & SmartCity area',
  },
  {
    id: 'kalamassery-mun',
    name: 'Kalamassery Municipality',
    jurisdiction: 'Kalamassery industrial & residential area',
  },
  {
    id: 'thripunithura-mun',
    name: 'Thripunithura Municipality',
    jurisdiction: 'Thripunithura town',
  },
  {
    id: 'ekd-panchayat',
    name: 'Ernakulam District Panchayat',
    jurisdiction: 'Rural pockets — Kumbalangi, Cheranalloor, Pizhala',
  },
];

/** Priority / response-time rules (simulated — replace with organiser rules). */
export const WORKFLOW_RULES: WorkflowRule[] = [
  { issue: 'no_water', priority: 'high', slaHours: 12 },
  { issue: 'broken', priority: 'high', slaHours: 24 },
  { issue: 'locked', priority: 'medium', slaHours: 48 },
  { issue: 'other', priority: 'medium', slaHours: 48 },
  { issue: 'clean', priority: 'low', slaHours: 72 },
  { issue: 'usable', priority: 'low', slaHours: 72 },
];

const access = (
  wheelchairAccessible: boolean,
  accessibleEntrance: boolean,
  accessibleToilet: boolean,
  handrails: boolean,
  babyChanging: boolean,
  brailleSignage: boolean,
  lighting: boolean,
): Accessibility => ({
  wheelchairAccessible,
  accessibleEntrance,
  accessibleToilet,
  handrails,
  babyChanging,
  brailleSignage,
  lighting,
});

const FULLY_ACCESSIBLE = access(true, true, true, true, true, true, true);

export const FACILITIES: SeedFacility[] = [
  // ── Kochi Municipal Corporation ───────────────────────────────────────────
  {
    id: 'f01', name: 'Fort Kochi Beach Public Toilet', type: 'toilet',
    address: 'Beach Road, near Chinese fishing nets', locality: 'Fort Kochi',
    lat: 9.9658, lng: 76.2423, condition: 'clean', openStatus: 'open',
    hours: '6:00 AM – 10:00 PM', accessibility: access(true, true, false, true, true, false, true),
    localBodyId: 'kmc', lastUpdated: '2026-09-21T09:15:00+05:30',
  },
  {
    id: 'f02', name: 'Marine Drive Public Convenience', type: 'toilet',
    address: 'Marine Drive Walkway, near Children’s Park', locality: 'Marine Drive',
    lat: 9.9816, lng: 76.2767, condition: 'usable', openStatus: 'open',
    hours: '24/7', accessibility: FULLY_ACCESSIBLE,
    localBodyId: 'kmc', lastUpdated: '2026-09-22T18:40:00+05:30',
  },
  {
    id: 'f03', name: 'Ernakulam Junction South Toilet Block', type: 'toilet',
    address: 'South Railway Station premises, Ernakulam', locality: 'Ernakulam',
    lat: 9.9775, lng: 76.2803, condition: 'clean', openStatus: 'open',
    hours: '5:30 AM – 11:00 PM', accessibility: access(true, true, true, true, false, false, true),
    localBodyId: 'kmc', lastUpdated: '2026-09-23T07:05:00+05:30',
  },
  {
    id: 'f04', name: 'Kaloor Stadium Road Toilet', type: 'toilet',
    address: 'Stadium Link Road, near Kaloor Metro access road', locality: 'Kaloor',
    lat: 9.9945, lng: 76.2983, condition: 'locked', openStatus: 'closed',
    hours: '6:00 AM – 10:00 PM', accessibility: access(false, false, false, true, false, false, true),
    localBodyId: 'kmc', lastUpdated: '2026-09-22T20:10:00+05:30',
  },
  {
    id: 'f05', name: 'Mattancherry Market Toilet', type: 'toilet',
    address: 'Jew Town Road, near Mattancherry Palace', locality: 'Mattancherry',
    lat: 9.9579, lng: 76.2599, condition: 'usable', openStatus: 'open',
    hours: '7:00 AM – 9:00 PM', accessibility: access(false, true, false, true, false, false, true),
    localBodyId: 'kmc', lastUpdated: '2026-09-22T14:30:00+05:30',
  },
  {
    id: 'f06', name: 'Willingdon Island Ferry Point Toilet', type: 'toilet',
    address: 'Ferry ghat road, Willingdon Island', locality: 'Willingdon Island',
    lat: 9.9470, lng: 76.2735, condition: 'clean', openStatus: 'open',
    hours: '6:00 AM – 10:00 PM', accessibility: access(false, false, false, true, true, false, true),
    localBodyId: 'kmc', lastUpdated: '2026-09-23T06:40:00+05:30',
  },
  {
    id: 'f07', name: 'Vyttila Mobility Hub Accessible Toilet', type: 'toilet',
    address: 'Vyttila Mobility Hub, Platform 1 side', locality: 'Vyttila',
    lat: 9.9670, lng: 76.3040, condition: 'clean', openStatus: 'open',
    hours: '24/7', accessibility: FULLY_ACCESSIBLE,
    localBodyId: 'kmc', lastUpdated: '2026-09-23T06:20:00+05:30',
  },
  {
    id: 'f08', name: 'Bolgatty Island Park Toilet', type: 'toilet',
    address: 'Bolgatty Island, near ferry landing', locality: 'Bolgatty',
    lat: 9.9943, lng: 76.2765, condition: 'usable', openStatus: 'open',
    hours: '8:00 AM – 7:00 PM', accessibility: access(false, false, false, true, false, false, true),
    localBodyId: 'kmc', lastUpdated: '2026-09-21T16:00:00+05:30',
  },
  {
    id: 'f09', name: 'Palarivattom Junction Toilet', type: 'toilet',
    address: 'NH bypass junction, Palarivattom', locality: 'Palarivattom',
    lat: 9.9917, lng: 76.3070, condition: 'no_water', openStatus: 'open',
    hours: '6:00 AM – 10:00 PM', accessibility: access(false, true, false, true, false, false, true),
    localBodyId: 'kmc', lastUpdated: '2026-09-22T08:45:00+05:30',
  },
  {
    id: 'f10', name: 'Edappally Flyover Public Toilet', type: 'toilet',
    address: 'Metro rail pillar 41, Edappally', locality: 'Edappally',
    lat: 9.9812, lng: 76.3110, condition: 'broken', openStatus: 'unknown',
    hours: '6:00 AM – 10:00 PM', accessibility: access(false, false, false, false, false, false, false),
    localBodyId: 'kmc', lastUpdated: '2026-09-19T11:20:00+05:30',
  },
  {
    id: 'f11', name: 'Marine Drive Drinking Water Point', type: 'water',
    address: 'Marine Drive walkway, near the north shelter', locality: 'Marine Drive',
    lat: 9.9822, lng: 76.2755, condition: 'usable', openStatus: 'open',
    hours: '24/7', accessibility: access(true, true, false, true, false, false, true),
    localBodyId: 'kmc', lastUpdated: '2026-09-23T07:30:00+05:30',
  },
  {
    id: 'f12', name: 'Fort Kochi Beach Water Kiosk', type: 'water',
    address: 'Beach promenade, opposite the fishing net area', locality: 'Fort Kochi',
    lat: 9.9660, lng: 76.2436, condition: 'no_water', openStatus: 'open',
    hours: '6:00 AM – 10:00 PM', accessibility: access(false, true, false, true, false, false, true),
    localBodyId: 'kmc', lastUpdated: '2026-09-22T17:10:00+05:30',
  },
  {
    id: 'f13', name: 'Nehru Stadium Water Point', type: 'water',
    address: 'Jawaharlal Nehru Stadium, main gate side', locality: 'Kaloor',
    lat: 9.9965, lng: 76.3135, condition: 'usable', openStatus: 'open',
    hours: '6:00 AM – 9:00 PM', accessibility: access(false, true, false, false, false, false, true),
    localBodyId: 'kmc', lastUpdated: '2026-09-21T12:00:00+05:30',
  },

  // ── Kakkanad Town Panchayat ───────────────────────────────────────────────
  {
    id: 'f14', name: 'Infopark Phase 1 Accessible Toilet', type: 'toilet',
    address: 'Infopark Phase 1, opposite the main food court', locality: 'Kakkanad',
    lat: 10.0265, lng: 76.3065, condition: 'clean', openStatus: 'open',
    hours: '24/7', accessibility: FULLY_ACCESSIBLE,
    localBodyId: 'kakkanad-tp', lastUpdated: '2026-09-23T08:00:00+05:30',
  },
  {
    id: 'f15', name: 'Kakkanad Town Junction Toilet', type: 'toilet',
    address: 'Town junction, near the KSRTC stop', locality: 'Kakkanad',
    lat: 10.0275, lng: 76.3205, condition: 'locked', openStatus: 'closed',
    hours: '7:00 AM – 8:00 PM', accessibility: access(false, false, false, true, false, false, true),
    localBodyId: 'kakkanad-tp', lastUpdated: '2026-09-22T19:00:00+05:30',
  },
  {
    id: 'f16', name: 'SmartCity Campus Public Toilet', type: 'toilet',
    address: 'SmartCity campus, visitor parking block', locality: 'Kakkanad',
    lat: 10.0320, lng: 76.2960, condition: 'usable', openStatus: 'open',
    hours: '8:00 AM – 8:00 PM', accessibility: access(true, true, true, true, true, false, true),
    localBodyId: 'kakkanad-tp', lastUpdated: '2026-09-21T15:30:00+05:30',
  },
  {
    id: 'f17', name: 'Kanjoottangara Park Water Point', type: 'water',
    address: 'Kanjoottangara community park', locality: 'Kakkanad',
    lat: 10.0248, lng: 76.3248, condition: 'usable', openStatus: 'open',
    hours: '24/7', accessibility: access(false, true, false, false, false, false, true),
    localBodyId: 'kakkanad-tp', lastUpdated: '2026-09-22T10:05:00+05:30',
  },
  {
    id: 'f18', name: 'Vadakkekkara Community Water Kiosk', type: 'water',
    address: 'Vadakkekkara panchayat road, near the clinic', locality: 'Kakkanad',
    lat: 10.0335, lng: 76.3290, condition: 'broken', openStatus: 'unknown',
    hours: '7:00 AM – 7:00 PM', accessibility: access(false, false, false, false, false, false, false),
    localBodyId: 'kakkanad-tp', lastUpdated: '2026-09-18T13:45:00+05:30',
  },
  {
    id: 'f19', name: 'Chitrakoodam Colony Toilet', type: 'toilet',
    address: 'Chitrakoodam housing colony gate 2', locality: 'Kakkanad',
    lat: 10.0200, lng: 76.3160, condition: 'usable', openStatus: 'open',
    hours: '6:00 AM – 9:00 PM', accessibility: access(false, true, false, true, false, false, true),
    localBodyId: 'kakkanad-tp', lastUpdated: '2026-09-20T09:30:00+05:30',
  },

  // ── Kalamassery Municipality ──────────────────────────────────────────────
  {
    id: 'f20', name: 'HMT Colony Public Toilet', type: 'toilet',
    address: 'HMT Colony bus stop, Kalamassery', locality: 'Kalamassery',
    lat: 10.0470, lng: 76.2950, condition: 'usable', openStatus: 'open',
    hours: '6:00 AM – 9:00 PM', accessibility: access(false, true, false, true, false, false, true),
    localBodyId: 'kalamassery-mun', lastUpdated: '2026-09-21T11:45:00+05:30',
  },
  {
    id: 'f21', name: 'Kalamassery Bus Stand Water Point', type: 'water',
    address: 'Bus stand forecourt, Kalamassery', locality: 'Kalamassery',
    lat: 10.0530, lng: 76.3050, condition: 'clean', openStatus: 'open',
    hours: '24/7', accessibility: access(false, true, false, false, false, false, true),
    localBodyId: 'kalamassery-mun', lastUpdated: '2026-09-23T07:55:00+05:30',
  },
  {
    id: 'f22', name: 'Ambattukavu Water Kiosk', type: 'water',
    address: 'Ambattukavu junction, temple road', locality: 'Kalamassery',
    lat: 10.0560, lng: 76.2900, condition: 'no_water', openStatus: 'open',
    hours: '6:00 AM – 8:00 PM', accessibility: access(false, false, false, false, false, false, true),
    localBodyId: 'kalamassery-mun', lastUpdated: '2026-09-22T06:50:00+05:30',
  },
  {
    id: 'f23', name: 'UC College Ground Water Point', type: 'water',
    address: 'Union Christian College grounds gate', locality: 'Aluva', // Aluva side of Kalamassery
    lat: 10.0445, lng: 76.3100, condition: 'usable', openStatus: 'open',
    hours: '8:00 AM – 6:00 PM', accessibility: access(false, true, false, false, false, false, false),
    localBodyId: 'kalamassery-mun', lastUpdated: '2026-09-20T14:20:00+05:30',
  },

  // ── Thripunithura Municipality ────────────────────────────────────────────
  {
    id: 'f24', name: 'Tripunithura Railway Station Toilet', type: 'toilet',
    address: 'Tripunithura station, footbridge side', locality: 'Tripunithura',
    lat: 9.9560, lng: 76.3250, condition: 'clean', openStatus: 'open',
    hours: '5:00 AM – 11:00 PM', accessibility: access(true, true, true, true, true, false, true),
    localBodyId: 'thripunithura-mun', lastUpdated: '2026-09-23T06:05:00+05:30',
  },
  {
    id: 'f25', name: 'Hill Palace Road Water Point', type: 'water',
    address: 'Hill Palace road entrance arch', locality: 'Tripunithura',
    lat: 9.9470, lng: 76.3320, condition: 'usable', openStatus: 'open',
    hours: '24/7', accessibility: access(false, true, false, true, false, false, true),
    localBodyId: 'thripunithura-mun', lastUpdated: '2026-09-21T17:40:00+05:30',
  },
  {
    id: 'f26', name: 'Market Junction Tripunithura Toilet', type: 'toilet',
    address: 'Market junction, opposite the post office', locality: 'Tripunithura',
    lat: 9.9540, lng: 76.3230, condition: 'usable', openStatus: 'open',
    hours: '7:00 AM – 8:00 PM', accessibility: access(false, false, false, true, false, false, true),
    localBodyId: 'thripunithura-mun', lastUpdated: '2026-09-20T18:15:00+05:30',
  },

  // ── Ernakulam District Panchayat (rural pockets) ──────────────────────────
  {
    id: 'f27', name: 'Kumbalangi Eco-Tourism Water Point', type: 'water',
    address: 'Kumbalangi tourism jetty area', locality: 'Kumbalangi',
    lat: 9.8800, lng: 76.2600, condition: 'usable', openStatus: 'open',
    hours: '24/7', accessibility: access(true, true, false, true, false, false, true),
    localBodyId: 'ekd-panchayat', lastUpdated: '2026-09-22T09:10:00+05:30',
  },
  {
    id: 'f28', name: 'Cheranalloor Village Water Kiosk', type: 'water',
    address: 'Cheranalloor village road, near the school gate', locality: 'Cheranalloor',
    lat: 9.9960, lng: 76.2600, condition: 'broken', openStatus: 'unknown',
    hours: '7:00 AM – 7:00 PM', accessibility: access(false, false, false, false, false, false, false),
    localBodyId: 'ekd-panchayat', lastUpdated: '2026-09-17T10:30:00+05:30',
  },
  {
    id: 'f29', name: 'Pizhala Jetty Water Point', type: 'water',
    address: 'Pizhala ferry jetty waiting area', locality: 'Pizhala',
    lat: 10.0100, lng: 76.2450, condition: 'usable', openStatus: 'open',
    hours: '24/7', accessibility: access(false, true, false, false, false, false, true),
    localBodyId: 'ekd-panchayat', lastUpdated: '2026-09-19T15:05:00+05:30',
  },
];

/**
 * Three pre-existing tickets so the judging demo opens with a populated
 * ticket desk. Conditions match the current facility states:
 *  - f05 was repaired (ticket resolved), f09 & f04 are still awaiting action.
 */
export const SEED_TICKETS: SeedTicket[] = [
  {
    id: 'JS-20260920-3F7K', facilityId: 'f05', issue: 'broken',
    description: 'Two western-style pans damaged; foul smell reported by visitors.',
    status: 'resolved', priority: 'high', slaHours: 24,
    createdAt: '2026-09-20T10:05:00+05:30', updatedAt: '2026-09-22T14:30:00+05:30',
  },
  {
    id: 'JS-20260922-M4QP', facilityId: 'f09', issue: 'no_water',
    description: 'Tap in the wash area is dry since morning.',
    status: 'in_progress', priority: 'high', slaHours: 12,
    createdAt: '2026-09-22T08:45:00+05:30', updatedAt: '2026-09-22T11:00:00+05:30',
  },
  {
    id: 'JS-20260923-B9X2', facilityId: 'f04', issue: 'locked',
    description: 'Gate locked at 7:30 AM although the signboard says 10 PM closing.',
    status: 'submitted', priority: 'medium', slaHours: 48,
    createdAt: '2026-09-23T07:50:00+05:30', updatedAt: '2026-09-23T07:50:00+05:30',
  },
];
