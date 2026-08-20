export const MAX_JOB_ATTEMPTS = 3;
export const RETRY_BASE_MS = 10_000;
export const RETRY_MAX_MS = 60_000;

export function canRetry(attempts: number): boolean {
  return attempts < MAX_JOB_ATTEMPTS;
}

export function retryDelayMs(attempts: number): number {
  const exponent = Math.max(0, attempts - 1);
  return Math.min(RETRY_MAX_MS, RETRY_BASE_MS * 2 ** exponent);
}
