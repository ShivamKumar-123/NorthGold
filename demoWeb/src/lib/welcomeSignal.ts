/**
 * The handoff between the welcome curtain and whatever should follow it.
 *
 * A window event rather than shared state: the curtain and the panel that
 * follows it are mounted side by side at the app root, neither owns the other,
 * and a context just to pass one moment between them would be more machinery
 * than the moment is worth.
 *
 * `WELCOME_DONE` fires on every path out of the curtain — played to the end,
 * skipped because it has already been seen this session, or skipped because
 * the visitor asked for reduced motion. Listeners decide for themselves
 * whether they still want to act; the signal only reports that the way is
 * clear.
 */
export const WELCOME_DONE = 'ng:welcome-done';

/** Ask the steps panel to open, whether or not the curtain just played. */
export const OPEN_STEPS = 'ng:open-steps';

/**
 * Sticky, and it has to be.
 *
 * The curtain announces itself from a LAYOUT effect — including on the paths
 * where it never plays at all — and React runs every layout effect before any
 * passive one. A listener registered in a `useEffect` therefore subscribes
 * after the event has already gone past, and the panel never opens. Recording
 * the fact lets a late listener ask whether it missed the moment.
 */
let welcomeDone = false;

export function signalWelcomeDone() {
  welcomeDone = true;
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new Event(WELCOME_DONE));
}

/** True once the curtain has cleared, however it cleared. */
export function welcomeHasFinished() {
  return welcomeDone;
}

export function openSteps() {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new Event(OPEN_STEPS));
}
