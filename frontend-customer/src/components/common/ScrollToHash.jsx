import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';

/**
 * React Router doesn't scroll to `#hash` targets on navigation.
 * Scrolls to the hash element when present, otherwise to the top on route change.
 */
export const ScrollToHash = () => {
  const { pathname, hash } = useLocation();

  useEffect(() => {
    if (!hash) {
      window.scrollTo(0, 0);
      return;
    }
    const id = decodeURIComponent(hash.slice(1));
    let attempts = 0;
    const timers = [];
    // Target may render after async data loads — retry briefly.
    const timer = setInterval(() => {
      const el = document.getElementById(id);
      if (el || ++attempts > 20) {
        clearInterval(timer);
        if (!el) return;
        el.scrollIntoView({ behavior: 'smooth', block: 'start' });
        // Content loading above the target (cards, images) pushes it down — re-align a few times
        // unless the user has scrolled away on their own.
        let lastY = null;
        [700, 1500, 2600].forEach((delay) => {
          timers.push(setTimeout(() => {
            if (lastY !== null && Math.abs(window.scrollY - lastY) > 4) return;
            const top = el.getBoundingClientRect().top;
            if (Math.abs(top) > 8) el.scrollIntoView({ behavior: 'auto', block: 'start' });
            lastY = window.scrollY;
          }, delay));
        });
      }
    }, 50);
    return () => {
      clearInterval(timer);
      timers.forEach(clearTimeout);
    };
  }, [pathname, hash]);

  return null;
};
