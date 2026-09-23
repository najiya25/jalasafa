/**
 * All SQL lives here ("the store"). Routes never write SQL directly, which keeps
 * the API layer small and the data logic easy to explain during judging.
 */
import { randomBytes, randomInt } from 'node:crypto';
import type {
  AuthUser,
  Availability,
  Condition,
  CreateTicketResponse,
  Facility,
  Issue,
  LocalBody,
  OpenStatus,
  Priority,
  TicketStatus,
  TicketView,
  WorkflowRule,
  WorkflowStep,
} from '../shared/types';
import { client } from './db';

type Row = Record<string, unknown>;

const str = (r: Row, k: string): string => String(r[k] ?? '');
const num = (r: Row, k: string): number => Number(r[k] ?? 0);
const maybeStr = (r: Row, k: string): string | null => (r[k] == null ? null : String(r[k]));
const bool = (r: Row, k: string): boolean => num(r, k) === 1;

const asRows = (rs: { rows: unknown[] }): Row[] => rs.rows as unknown as Row[];

const availabilityFor = (condition: Condition): Availability =>
  condition === 'clean' || condition === 'usable' ? 'available' : 'unavailable';

function toFacility(r: Row): Facility {
  return {
    id: str(r, 'id'),
    name: str(r, 'name'),
    type: str(r, 'type') as Facility['type'],
    address: str(r, 'address'),
    locality: str(r, 'locality'),
    lat: num(r, 'lat'),
    lng: num(r, 'lng'),
    condition: str(r, 'condition') as Condition,
    availability: str(r, 'availability') as Availability,
    openStatus: str(r, 'open_status') as OpenStatus,
    hours: maybeStr(r, 'hours'),
    accessibility: {
      wheelchairAccessible: bool(r, 'wheelchair_accessible'),
      accessibleEntrance: bool(r, 'accessible_entrance'),
      accessibleToilet: bool(r, 'accessible_toilet'),
      handrails: bool(r, 'handrails'),
      babyChanging: bool(r, 'baby_changing'),
      brailleSignage: bool(r, 'braille_signage'),
      lighting: bool(r, 'lighting'),
    },
    localBodyId: str(r, 'local_body_id'),
    localBodyName: str(r, 'local_body_name'),
    lastUpdated: str(r, 'last_updated'),
  };
}

function toTicketView(r: Row): TicketView {
  return {
    id: str(r, 'id'),
    facilityId: str(r, 'facility_id'),
    issue: str(r, 'issue') as Issue,
    description: str(r, 'description'),
    status: str(r, 'status') as TicketStatus,
    localBodyId: str(r, 'local_body_id'),
    priority: str(r, 'priority') as Priority,
    slaHours: num(r, 'sla_hours'),
    createdAt: str(r, 'created_at'),
    updatedAt: str(r, 'updated_at'),
    facilityName: str(r, 'facility_name'),
    facilityType: str(r, 'facility_type') as TicketView['facilityType'],
    localBodyName: str(r, 'local_body_name'),
    jurisdiction: str(r, 'jurisdiction'),
  };
}

// ── Local bodies ────────────────────────────────────────────────────────────

export async function listLocalBodies(): Promise<LocalBody[]> {
  const rs = await client.execute('SELECT id, name, jurisdiction FROM local_bodies ORDER BY name');
  return asRows(rs).map((r) => ({
    id: str(r, 'id'),
    name: str(r, 'name'),
    jurisdiction: str(r, 'jurisdiction'),
  }));
}

// ── Facilities ──────────────────────────────────────────────────────────────

const FACILITY_SELECT = `
  SELECT f.*, lb.name AS local_body_name
  FROM facilities f
  JOIN local_bodies lb ON lb.id = f.local_body_id
`;

export async function listFacilities(): Promise<Facility[]> {
  const rs = await client.execute(`${FACILITY_SELECT} ORDER BY f.name`);
  return asRows(rs).map(toFacility);
}

export async function getFacility(id: string): Promise<Facility | null> {
  const rs = await client.execute({ sql: `${FACILITY_SELECT} WHERE f.id = ?`, args: [id] });
  const rows = asRows(rs);
  return rows.length ? toFacility(rows[0]) : null;
}

export async function countFacilities(): Promise<number> {
  const rs = await client.execute('SELECT COUNT(*) AS n FROM facilities');
  return Number(rs.rows[0].n);
}

// ── Prototype accounts (login feature) ──────────────────────────────────────
// Never joined with tickets: an account carries no reports, and a report
// carries no account. See server/auth.ts for hashing/token helpers.

/** Thrown when the email is already registered (routes map it to HTTP 409). */
export class EmailTakenError extends Error {
  constructor() {
    super('That email address is already registered. Try signing in instead.');
    this.name = 'EmailTakenError';
  }
}

export async function createUser(
  name: string,
  email: string,
  passwordHash: string,
): Promise<AuthUser> {
  const id = `u-${randomBytes(8).toString('hex')}`;
  try {
    await client.execute({
      sql: 'INSERT INTO users (id, name, email, password_hash, created_at) VALUES (?, ?, ?, ?, ?)',
      args: [id, name, email, passwordHash, new Date().toISOString()],
    });
  } catch (err) {
    if (err instanceof Error && /unique/i.test(err.message)) throw new EmailTakenError();
    throw err;
  }
  return { id, name, email };
}

export interface StoredUser extends AuthUser {
  passwordHash: string;
}

export async function findUserByEmail(email: string): Promise<StoredUser | null> {
  const rs = await client.execute({
    sql: 'SELECT id, name, email, password_hash FROM users WHERE email = ?',
    args: [email],
  });
  const rows = asRows(rs);
  if (!rows.length) return null;
  const r = rows[0];
  return {
    id: str(r, 'id'),
    name: str(r, 'name'),
    email: str(r, 'email'),
    passwordHash: str(r, 'password_hash'),
  };
}

export async function getUserById(id: string): Promise<AuthUser | null> {
  const rs = await client.execute({
    sql: 'SELECT id, name, email FROM users WHERE id = ?',
    args: [id],
  });
  const rows = asRows(rs);
  if (!rows.length) return null;
  return { id: str(rows[0], 'id'), name: str(rows[0], 'name'), email: str(rows[0], 'email') };
}

// ── Workflow rules ──────────────────────────────────────────────────────────

export async function listWorkflowRules(): Promise<WorkflowRule[]> {
  const rs = await client.execute('SELECT issue, priority, sla_hours FROM workflow_rules');
  return asRows(rs).map((r) => ({
    issue: str(r, 'issue') as Issue,
    priority: str(r, 'priority') as Priority,
    slaHours: num(r, 'sla_hours'),
  }));
}

async function ruleFor(issue: Issue): Promise<WorkflowRule> {
  const rs = await client.execute({
    sql: 'SELECT issue, priority, sla_hours FROM workflow_rules WHERE issue = ?',
    args: [issue],
  });
  const rows = asRows(rs);
  if (rows.length) {
    return {
      issue: str(rows[0], 'issue') as Issue,
      priority: str(rows[0], 'priority') as Priority,
      slaHours: num(rows[0], 'sla_hours'),
    };
  }
  return { issue, priority: 'medium', slaHours: 48 };
}

// ── Tickets ─────────────────────────────────────────────────────────────────

const TICKET_SELECT = `
  SELECT t.*,
         f.name  AS facility_name,
         f.type  AS facility_type,
         lb.name AS local_body_name,
         lb.jurisdiction AS jurisdiction
  FROM tickets t
  JOIN facilities f   ON f.id  = t.facility_id
  JOIN local_bodies lb ON lb.id = t.local_body_id
`;

export async function listTickets(filter: {
  status?: TicketStatus;
  localBodyId?: string;
} = {}): Promise<TicketView[]> {
  const where: string[] = [];
  const args: (string | number)[] = [];
  if (filter.status) {
    where.push('t.status = ?');
    args.push(filter.status);
  }
  if (filter.localBodyId) {
    where.push('t.local_body_id = ?');
    args.push(filter.localBodyId);
  }
  const sql = `${TICKET_SELECT}${where.length ? ` WHERE ${where.join(' AND ')}` : ''} ORDER BY t.created_at DESC`;
  const rs = await client.execute({ sql, args });
  return asRows(rs).map(toTicketView);
}

export async function getTicket(id: string): Promise<TicketView | null> {
  const rs = await client.execute({ sql: `${TICKET_SELECT} WHERE t.id = ?`, args: [id] });
  const rows = asRows(rs);
  return rows.length ? toTicketView(rows[0]) : null;
}

const ID_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // no ambiguous chars

function randomSuffix(): string {
  let out = '';
  for (let i = 0; i < 4; i += 1) out += ID_ALPHABET[randomInt(ID_ALPHABET.length)];
  return out;
}

async function newTicketId(now: Date): Promise<string> {
  const ymd = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}`;
  for (let attempt = 0; attempt < 20; attempt += 1) {
    const id = `JS-${ymd}-${randomSuffix()}`;
    if (!(await getTicket(id))) return id;
  }
  throw new Error('Could not generate a unique ticket id');
}

export function buildWorkflow(ticket: TicketView): WorkflowStep[] {
  return [
    { key: 'report', label: 'User report', detail: `${ticket.issue.replace('_', ' ')} reported for ${ticket.facilityName}`, done: true },
    { key: 'created', label: 'Ticket created', detail: ticket.id, done: true },
    { key: 'body', label: 'Responsible local body identified', detail: ticket.localBodyName, done: true },
    { key: 'routed', label: 'Ticket routed (simulated)', detail: ticket.jurisdiction, done: true },
    {
      key: 'status',
      label: 'Status',
      detail: ticket.status.replace('_', ' '),
      done: true,
    },
  ];
}

/**
 * Create a ticket and (unless it is an "other" report) refresh the facility's
 * condition + last-updated timestamp. Runs in one transaction.
 * NO reporter identity or location is accepted or stored.
 */
export async function createTicket(input: {
  facilityId: string;
  issue: Issue;
  description: string;
}): Promise<CreateTicketResponse> {
  const facility = await getFacility(input.facilityId);
  if (!facility) throw Object.assign(new Error('Facility not found'), { status: 404 });

  const rule = await ruleFor(input.issue);
  const now = new Date();
  const id = await newTicketId(now);

  const statements = [
    {
      sql: `INSERT INTO tickets (id, facility_id, issue, description, status, local_body_id, priority, sla_hours, created_at, updated_at)
            VALUES (?,?,?,?, 'submitted', ?, ?, ?, ?, ?)`,
      args: [
        id, facility.id, input.issue, input.description, facility.localBodyId,
        rule.priority, rule.slaHours, now.toISOString(), now.toISOString(),
      ] as (string | number)[],
    },
  ];

  if (input.issue !== 'other') {
    statements.push({
      sql: 'UPDATE facilities SET condition = ?, availability = ?, last_updated = ? WHERE id = ?',
      args: [input.issue, availabilityFor(input.issue as Condition), now.toISOString(), facility.id],
    });
  }

  await client.batch(statements, 'write');

  const ticket = await getTicket(id);
  if (!ticket) throw new Error('Ticket creation failed');
  return { ticket, workflow: buildWorkflow(ticket) };
}

const NEXT_STATUS: Record<TicketStatus, TicketStatus | null> = {
  submitted: 'assigned',
  assigned: 'in_progress',
  in_progress: 'resolved',
  resolved: null,
};

export async function advanceTicket(id: string): Promise<TicketView> {
  const ticket = await getTicket(id);
  if (!ticket) throw Object.assign(new Error('Ticket not found'), { status: 404 });
  const next = NEXT_STATUS[ticket.status];
  if (!next) throw Object.assign(new Error('Ticket is already resolved'), { status: 409 });

  await client.execute({
    sql: 'UPDATE tickets SET status = ?, updated_at = ? WHERE id = ?',
    args: [next, new Date().toISOString(), id],
  });
  const updated = await getTicket(id);
  if (!updated) throw new Error('Ticket update failed');
  return updated;
}
