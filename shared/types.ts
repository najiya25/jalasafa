/**
 * Shared types between the Express server and the React client.
 * One file, imported by both sides — keeps API responses type-safe end to end.
 */

export type FacilityType = 'toilet' | 'water';

/** Reported / observed facility condition (matches the brief's status categories). */
export type Condition = 'clean' | 'usable' | 'broken' | 'locked' | 'no_water';

export type Issue = Condition | 'other';

export type Availability = 'available' | 'unavailable';

export type OpenStatus = 'open' | 'closed' | 'unknown';

export type TicketStatus = 'submitted' | 'assigned' | 'in_progress' | 'resolved';

export type Priority = 'high' | 'medium' | 'low';

/**
 * Accessibility fields carried per facility.
 * NOTE: sample schema — replace/extend when the organiser dataset arrives.
 */
export interface Accessibility {
  wheelchairAccessible: boolean; // step-free / ramp approach
  accessibleEntrance: boolean;
  accessibleToilet: boolean;
  handrails: boolean;
  babyChanging: boolean;
  brailleSignage: boolean;
  lighting: boolean;
}

/** Facility row as returned by the API (booleans already converted, local body joined). */
export interface Facility {
  id: string;
  name: string;
  type: FacilityType;
  address: string;
  locality: string;
  lat: number;
  lng: number;
  condition: Condition;
  availability: Availability;
  openStatus: OpenStatus;
  hours: string | null;
  accessibility: Accessibility;
  localBodyId: string;
  localBodyName: string;
  lastUpdated: string; // ISO timestamp
}

export interface LocalBody {
  id: string;
  name: string;
  jurisdiction: string;
}

export interface WorkflowRule {
  issue: Issue;
  priority: Priority;
  slaHours: number;
}

export interface Ticket {
  id: string;
  facilityId: string;
  issue: Issue;
  description: string;
  status: TicketStatus;
  localBodyId: string;
  priority: Priority;
  slaHours: number;
  createdAt: string; // ISO
  updatedAt: string; // ISO
}

/** Ticket with display fields resolved — what the API actually returns. */
export interface TicketView extends Ticket {
  facilityName: string;
  facilityType: FacilityType;
  localBodyName: string;
  jurisdiction: string;
}

/** POST /api/tickets request body. Deliberately contains NO personal data. */
export interface CreateTicketRequest {
  facilityId: string;
  issue: Issue;
  description?: string;
}

export interface CreateTicketResponse {
  ticket: TicketView;
  /** The five judging-flow steps, already filled in for the confirmation screen. */
  workflow: WorkflowStep[];
}

export interface WorkflowStep {
  key: 'report' | 'created' | 'body' | 'routed' | 'status';
  label: string;
  detail: string;
  done: boolean;
}

export interface HealthResponse {
  ok: boolean;
  serverTime: string;
  facilityCount: number;
  simulated: true;
}

/**
 * Prototype authentication (hackathon feature — clearly NOT production auth).
 * An account holds only what sign-up needs: name, email, hashed password.
 * Accounts are NEVER linked to tickets/reports — see server/db.ts users table.
 */
export interface AuthUser {
  id: string;
  name: string;
  email: string;
}

/** POST /api/auth/signup · POST /api/auth/login response. */
export interface AuthResponse {
  user: AuthUser;
  /** Opaque session token (HMAC-signed, stateless). Sent back as Bearer token. */
  token: string;
}
