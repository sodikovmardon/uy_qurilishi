/**
 * User-submitted projects ("Loyiha yuklash") — local mock store.
 *
 * NOTE: This is a fully client-side mock of the submission/review workflow so
 * the form, status chips and "approved → appears in catalog" flow are
 * demoable. Replace with real backend endpoints:
 *   - POST /api/projects/submit/   (multipart: form fields + images + drawings)
 *   - GET  /api/projects/my/       (user's submissions with status)
 * when the moderation workflow exists.
 */
import type { ProjectItem } from '../components/projects/ProjectModal';
import type { DrawingSubtype, DrawingType } from '../api/client';

export type SubmissionStatus = 'pending' | 'approved' | 'rejected';

/** Technical drawing attached during submission (mirrors api/drawings.py). */
export interface SubmissionDrawing {
  type: string;
  subtype: string;
  title: string;
  floorNumber: string;
  name: string;
  ext: string;
  size: number;
  /** dataURL for previewable files (images / small PDFs); '' for raw CAD. */
  dataUrl: string;
}

export interface Submission {
  id: number;
  title: string;
  description: string;
  rooms: number;
  area: number;
  storeys: number;
  region: string;
  /** Quyosh yo'nalishi (ixtiyoriy) — stored label, e.g. "Janub". */
  orientation?: string;
  images: { name: string; dataUrl: string }[];
  technicalDrawings: SubmissionDrawing[];
  features: string[];
  status: SubmissionStatus;
  statusNote: string;
  createdAt: string;
}

const KEY = 'uy:submissions';
/** Simulated review delay — pending submissions older than this become approved. */
const REVIEW_DELAY_MS = 60_000;
/** Catalog ids for local submissions start high so they never collide with API ids. */
const BASE_ID = 100_000;

function read(): Submission[] {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as Submission[]) : [];
  } catch {
    return [];
  }
}

function write(list: Submission[]): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(list));
  } catch {
    // storage may be unavailable — fail silently
  }
}

/** Mock moderation pass: age out pending submissions into approved. */
function review(list: Submission[]): Submission[] {
  const now = Date.now();
  let changed = false;
  const next = list.map((s) => {
    if (s.status === 'pending' && now - new Date(s.createdAt).getTime() > REVIEW_DELAY_MS) {
      changed = true;
      return { ...s, status: 'approved' as const, statusNote: 'Mutaxassis tomonidan tasdiqlandi' };
    }
    return s;
  });
  if (changed) write(next);
  return next;
}

export function getSubmissions(): Submission[] {
  return review(read()).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export function submitProject(
  data: Omit<Submission, 'id' | 'status' | 'statusNote' | 'createdAt'>,
): Submission {
  const list = read();
  const entry: Submission = {
    ...data,
    id: BASE_ID + Date.now() % 10000,
    status: 'pending',
    statusNote: 'Ko’rib chiqilmoqda',
    createdAt: new Date().toISOString(),
  };
  write([entry, ...list]);
  return entry;
}

export function deleteSubmission(id: number): Submission[] {
  const next = read().filter((s) => s.id !== id);
  write(next);
  return next;
}

export function getSubmissionStatusLabel(s: Submission): string {
  switch (s.status) {
    case 'approved':
      return 'Tasdiqlangan';
    case 'rejected':
      return 'Rad etilgan';
    default:
      return 'Ko’rib chiqilmoqda';
  }
}

/** Approved submissions shaped as catalog projects so they render in the grid. */
export function approvedAsProjects(userName: string): ProjectItem[] {
  return getSubmissions()
    .filter((s) => s.status === 'approved')
    .map((s, i) => ({
      id: s.id,
      user_name: s.title || userName || 'Anonim',
      area: s.area,
      rooms: s.rooms,
      bathrooms: 1,
      has_pool: s.features.includes('pool'),
      has_garage: s.features.includes('garage'),
      has_terrace: s.features.includes('terrace'),
      features: s.features,
      source: 'web',
      created_at: s.createdAt,
      orientation: s.orientation,
      description: s.description,
      technical_drawings: (s.technicalDrawings ?? []).map((d) => ({
        type: d.type as DrawingType,
        subtype: d.subtype as DrawingSubtype,
        title: d.title || d.name,
        file_url: d.dataUrl || d.name,
        preview_url: d.dataUrl ? d.dataUrl : '',
        file_ext: d.ext,
        floor_number: d.floorNumber ? Number(d.floorNumber) : null,
        uploaded_date: s.createdAt.slice(0, 10),
      })),
    }));
}
