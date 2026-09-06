import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';

/**
 * Router-level scroll behaviour.
 *
 * A single-page app keeps the scroll position across navigations, so without
 * this you arrive at the middle of the next page. Hash links are honoured
 * separately: `/#plans` from another route has to wait for the landing page to
 * mount before the target exists to scroll to.
 */
export default function ScrollManager() {
  const { pathname, hash } = useLocation();

  useEffect(() => {
    if (!hash) {
      window.scrollTo({ top: 0, behavior: 'auto' });
      return;
    }
    // One frame is not always enough — the section may still be laying out.
    const target = () => document.querySelector(hash);
    let tries = 0;
    const attempt = () => {
      const el = target();
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'start' });
        return;
      }
      if (tries++ < 20) requestAnimationFrame(attempt);
    };
    requestAnimationFrame(attempt);
  }, [pathname, hash]);

  return null;
}
