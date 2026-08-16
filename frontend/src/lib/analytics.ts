/**
 * Lightweight analytics wrapper (Phase 9 stub).
 * Swap the no-op below for any real backend (Plausible, GA, or a POST to /api/analytics/).
 */

export type TrackEvent =
  | 'calc_submit'
  | 'calc_pdf'
  | 'calc_stages_pdf'
  | 'calc_loan'
  | 'calc_store_inquiry'
  | 'budget_save'
  | 'tracker_start'
  | 'tracker_phase'
  | 'tracker_photo'
  | 'tracker_note'
  | 'tracker_delete'
  | 'review_submit'
  | 'review_update'
  | 'review_helpful'
  | 'region_apply'
  | 'submission_submit'
  | 'project_open'
  | 'project_bookmark'
  | 'auth_login';

export function trackEvent(_event: TrackEvent, _payload?: Record<string, unknown>): void {
  // stub — no-op until a real analytics backend is configured
}
