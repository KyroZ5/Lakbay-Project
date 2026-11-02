/**
 * Hero background slideshow — auto-rotating destination images with cross-fade transitions.
 * Uses CSS transitions (more reliable than framer-motion for stacked background images).
 * Respects prefers-reduced-motion (displays a single static image).
 */
import { useEffect, useState, useRef, useCallback } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

const DEFAULT_SLIDES = [
  {
    src: '/images/el-nido.jpg',
    alt: 'El Nido, Palawan — limestone cliffs and turquoise lagoon',
    label: 'El Nido, Palawan',
  },
  {
    src: '/images/beach.jpg',
    alt: 'White sand beach at sunset',
    label: 'Boracay Island',
  },
  {
    src: '/images/sunset.jpg',
    alt: 'Sunset over the water',
    label: 'Sunset Cruise',
  },
  {
    src: '/images/island.jpg',
    alt: 'Tropical island getaway',
    label: 'Island Hopping',
  },
  {
    src: '/images/water.jpg',
    alt: 'Crystal clear waters',
    label: 'Palawan',
  },
  {
    src: '/images/coast.jpg',
    alt: 'Coastal scenery',
    label: 'Coastal Tour',
  },
  {
    src: '/images/mountain.jpg',
    alt: 'Mountain terraces above the clouds',
    label: 'Banaue Rice Terraces',
  },
  {
    src: '/images/lake.jpg',
    alt: 'Mirror-still volcanic lake',
    label: 'Lake Sebu',
  },
];

export const HeroSlideshow = ({ slides = DEFAULT_SLIDES, intervalMs = 4000 }) => {
  const [index, setIndex] = useState(0);
  const [isHovered, setIsHovered] = useState(false);
  const [isReducedMotion, setIsReducedMotion] = useState(false);
  const timerRef = useRef(null);

  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    setIsReducedMotion(mq.matches);
    const handler = () => setIsReducedMotion(mq.matches);
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, []);

  // Auto-advance slide — interval restarted only on hover/motion changes, not on index
  useEffect(() => {
    if (isReducedMotion || slides.length <= 1) return;
    if (timerRef.current) clearInterval(timerRef.current);
    if (isHovered) return;
    timerRef.current = setInterval(() => {
      setIndex((i) => (i + 1) % slides.length);
    }, intervalMs);
    return () => clearInterval(timerRef.current);
  }, [isHovered, isReducedMotion, slides.length, intervalMs]);

  const goTo = useCallback((next) => {
    setIndex(((next % slides.length) + slides.length) % slides.length);
  }, [slides.length]);

  const prev = () => goTo(index - 1);
  const next = () => goTo(index + 1);

  return (
    <>
      {/* Background images — all stacked, only active one visible via CSS opacity transition */}
      <div className="absolute inset-0 z-0">
        {slides.map((slide, i) => (
          <div
            key={slide.src}
            className={`absolute inset-0 bg-cover bg-center transition-opacity duration-700 ease-in-out ${
              i === index ? 'opacity-100' : 'opacity-0'
            }`}
            style={{ backgroundImage: `url(${slide.src})` }}
          />
        ))}
      </div>

      {/* Subtle dark overlay so text stays readable — lighter so images show through */}
      <div className="absolute inset-0 z-10 bg-gradient-to-b from-slate-900/80 via-slate-900/40 to-transparent pointer-events-none" />

      {/* Navigation controls */}
      {slides.length > 1 && !isReducedMotion && (
        <>
          <button
            onMouseDown={(e) => {
              e.preventDefault();
              prev();
            }}
            onMouseEnter={() => setIsHovered(true)}
            onMouseLeave={() => setIsHovered(false)}
            aria-label={`Previous: ${slides[((index - 1) % slides.length + slides.length) % slides.length].label}`}
            className="absolute left-6 top-1/2 -translate-y-1/2 z-20 w-12 h-12 rounded-full bg-black/50 backdrop-blur-sm text-white flex items-center justify-center hover:bg-black/70 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
          >
            <ChevronLeft className="h-5 w-5" />
          </button>
          <button
            onMouseDown={(e) => {
              e.preventDefault();
              next();
            }}
            onMouseEnter={() => setIsHovered(true)}
            onMouseLeave={() => setIsHovered(false)}
            aria-label={`Next: ${slides[((index + 1) % slides.length + slides.length) % slides.length].label}`}
            className="absolute right-6 top-1/2 -translate-y-1/2 z-20 w-12 h-12 rounded-full bg-black/50 backdrop-blur-sm text-white flex items-center justify-center hover:bg-black/70 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
          >
            <ChevronRight className="h-5 w-5" />
          </button>
        </>
      )}

      {/* Dot navigation */}
      {slides.length > 1 && (
        <div className="absolute bottom-8 left-1/2 -translate-x-1/2 z-20 flex gap-3">
          {slides.map((_, i) => (
            <button
              key={i}
              onMouseDown={(e) => {
                e.preventDefault();
                goTo(i);
              }}
              aria-label={`Slide ${i + 1} of ${slides.length}`}
              aria-pressed={i === index}
              className={`w-2.5 h-2.5 rounded-full transition-all duration-300 ${
                i === index
                  ? 'bg-emerald-400 ring-2 ring-white'
                  : 'bg-white/40 hover:bg-white/60'
              }`}
            />
          ))}
        </div>
      )}
    </>
  );
};
