/**
 * Garage Jobs is in a limited rollout: only these accounts see the Jobs tabs
 * (the founder console and the member job board) and can open those pages.
 * Add an email here to widen it; remove the gate when Jobs goes public.
 */
export const ALLOWED_JOBS_EMAILS: string[] = ["shorupan@gmail.com"];

export function isJobsAllowed(email?: string | null): boolean {
  return !!email && ALLOWED_JOBS_EMAILS.includes(email.trim().toLowerCase());
}
