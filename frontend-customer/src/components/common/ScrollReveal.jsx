import { useEffect } from 'react';

const SELECTOR = '.reveal-up, .reveal-stagger > *';
const READY_CLASS = 'reveal-ready';

/**
 * App-wide scroll reveal for `.reveal-up` / `.reveal-stagger > *` elements.
 *
 * - Content is only hidden while <html> has `.reveal-ready` (see index.css), which is added
 *   here once the observers exist — a failure can never leave the page blank.
 * - Observed elements are tracked per effect run (WeakSet), never with a DOM marker, so React
 *   StrictMode's mount → cleanup → mount re-observes everything instead of skipping it.
 * - A MutationObserver picks up elements rendered later (async data, retries, route changes) and
 *   restores `.visible` if React / Fast Refresh rewrites the className of an already-revealed element.
 * - Reduced-motion users (or browsers without IntersectionObserver) see everything immediately.
 */
export const ScrollReveal = () => {
  useEffect(() => {
    const root = document.documentElement;
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduceMotion || typeof IntersectionObserver === 'undefined') {
      root.classList.remove(READY_CLASS);
      return undefined;
    }

    const revealed = new WeakSet();
    const reveal = (el) => {
      revealed.add(el);
      el.classList.add('visible');
    };

    // Any visible pixel reveals (no negative margin/threshold that strands half-visible elements)
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            reveal(entry.target);
            io.unobserve(entry.target);
          }
        });
      },
      { threshold: 0 }
    );

    const observed = new WeakSet();
    const observeNew = () => {
      document.querySelectorAll(SELECTOR).forEach((el) => {
        if (observed.has(el)) return;
        observed.add(el);
        if (el.classList.contains('visible')) {
          revealed.add(el);
          return;
        }
        // Already on screen: show right away (no flash of hidden above-the-fold content)
        const rect = el.getBoundingClientRect();
        if (rect.top < window.innerHeight && rect.bottom > 0) {
          reveal(el);
        } else {
          io.observe(el);
        }
      });
    };

    observeNew();
    root.classList.add(READY_CLASS);
    let scheduled = false;
    const mo = new MutationObserver((mutations) => {
      for (const m of mutations) {
        // A re-render replaced the className of a revealed element — put `.visible` back
        if (m.type === 'attributes' && revealed.has(m.target) && !m.target.classList.contains('visible')) {
          m.target.classList.add('visible');
        }
      }
      // Batch new-node scans to one per frame
      if (!scheduled && mutations.some((m) => m.type === 'childList')) {
        scheduled = true;
        requestAnimationFrame(() => {
          scheduled = false;
          observeNew();
        });
      }
    });
    mo.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['class'] });

    return () => {
      mo.disconnect();
      io.disconnect();
      // Without observers nothing would reveal the rest — stop hiding content
      root.classList.remove(READY_CLASS);
    };
  }, []);

  return null;
};
