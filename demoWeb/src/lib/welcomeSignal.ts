/**
 * The welcome curtain's completion signal.
 *
 * A window event rather than shared state: the curtain is mounted at the app
 * root and owns nothing below it, so a context existing only to announce one
 * moment would be more machinery than the moment is worth.
 *
 * It fires on every path out of the curtain — played to the end, skipped
 * because it has already been seen this session, or skipped because the
 * visitor asked for reduced motion. Listeners decide for themselves whether
 * they still want to act; the signal only reports that the way is clear.
 */
export const WELCOME_DONE = 'ng:welcome-done';

export function signalWelcomeDone() {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new Event(WELCOME_DONE));
}
