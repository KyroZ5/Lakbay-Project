import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { destinationsApi } from '../../api/destinationsApi';
import { packagesApi } from '../../api/packagesApi';
import { promotionsApi } from '../../api/promotionsApi';
import { externalApi } from '../../api/externalApi';
import { Button } from '../../components/ui/button';
import { Card, CardContent } from '../../components/ui/card';
import { Badge } from '../../components/ui/badge';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { Skeleton } from '../../components/ui/skeleton';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../components/ui/select';
import { EmptyState, ErrorState } from '../../components/common/DataStates';
import { LoadingRegion } from '../../components/common/Skeletons';
import { getErrorMessage } from '../../lib/notify';
import { formatCurrency } from '../../lib/utils';
import { HeroSlideshow } from '../../components/common/HeroSlideshow';
import { motion, useSpring, useTransform, useMotionValue } from 'framer-motion';
import {
  Search,
  MapPin,
  Calendar,
  Users,
  Compass,
  ShieldCheck,
  CreditCard,
  Headphones,
  Sparkles,
  ArrowRight,
  Star,
  ChevronDown,
  RefreshCw,
} from 'lucide-react';

// Promotion action links are free-text from staff: allow absolute http(s) URLs or
// in-app paths only; anything else falls back to the discounted-packages list.
const DEFAULT_PROMO_PATH = '/packages?discounted=true';

// Pick a column count that fills complete rows (avoids a lone card on the last row)
const cardGridCols = (count) =>
  count % 4 === 0 ? 'sm:grid-cols-2 xl:grid-cols-4' : 'sm:grid-cols-2 lg:grid-cols-3';
const resolvePromoLink = (url) => {
  const value = (url || '').trim();
  if (/^https?:\/\//i.test(value)) return { external: true, href: value };
  if (value.startsWith('/') && !value.startsWith('//')) return { external: false, href: value };
  return { external: false, href: DEFAULT_PROMO_PATH };
};

export const HomePage = () => {
  const navigate = useNavigate();

  // Parallax mouse tracking for hero background
  const [mouseX, setMouseX] = useState(50);
  const [mouseY, setMouseY] = useState(50);

  useEffect(() => {
    const handleMouseMove = (e) => {
      setMouseX((e.clientX / window.innerWidth) * 100);
      setMouseY((e.clientY / window.innerHeight) * 100);
    };
    window.addEventListener('mousemove', handleMouseMove);
    return () => window.removeEventListener('mousemove', handleMouseMove);
  }, []);

  // Search hero inputs
  const [searchQuery, setSearchQuery] = useState('');
  const [departureDate, setDepartureDate] = useState('');
  const [travelers, setTravelers] = useState(2);
  const [autocompleteResults, setAutocompleteResults] = useState([]);
  const [isSearchingAutocomplete, setIsSearchingAutocomplete] = useState(false);

  // Catalog data
  const [featuredDestinations, setFeaturedDestinations] = useState([]);
  const [popularPackages, setPopularPackages] = useState([]);
  const [promotions, setPromotions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Debounced Geoapify destination autocomplete
  const pickedQueryRef = useRef(null);
  useEffect(() => {
    if (!searchQuery || searchQuery.trim().length < 2) {
      setAutocompleteResults([]);
      return;
    }
    // Text was just filled from a picked suggestion — don't reopen the dropdown
    if (searchQuery === pickedQueryRef.current) return;

    let cancelled = false;
    const timer = setTimeout(async () => {
      setIsSearchingAutocomplete(true);
      try {
        const res = await externalApi.autocompleteLocation(searchQuery);
        // Drop responses for text the user has since changed
        if (!cancelled) setAutocompleteResults(res.data || []);
      } catch (err) {
        console.warn('Autocomplete fetch error:', err);
      } finally {
        if (!cancelled) setIsSearchingAutocomplete(false);
      }
    }, 250);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [searchQuery]);

  // Load featured destinations, popular packages, and promotional campaigns
  const loadHomeData = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [destRes, pkgRes, promoRes] = await Promise.all([
        destinationsApi.getFeatured(),
        packagesApi.getFeatured(),
        promotionsApi.getPublished().catch(() => ({ data: [] })),
      ]);
      setFeaturedDestinations(destRes.data || []);
      setPopularPackages(pkgRes.data || []);
      setPromotions(promoRes.data || []);
    } catch (err) {
      console.error('Home data load error:', err);
      setError(getErrorMessage(err, 'Failed to load featured destinations and tour packages.'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadHomeData();
  }, [loadHomeData]);

  // Scroll reveal is handled app-wide by <ScrollReveal /> in AppRoutes

  // Skeletons only on the initial load; retries keep any content already shown
  const showDestinationSkeleton = loading && featuredDestinations.length === 0;
  const showPackageSkeleton = loading && popularPackages.length === 0;
  const showPromoSkeleton = loading && promotions.length === 0;

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    const params = new URLSearchParams();
    if (searchQuery) params.append('search', searchQuery);
    if (departureDate) params.append('departureDate', departureDate);
    if (travelers) params.append('travelers', travelers);
    navigate(`/packages?${params.toString()}`);
  };

  const handleSelectAutocomplete = (item) => {
    const picked = item.name || item.formatted;
    pickedQueryRef.current = picked;
    setSearchQuery(picked);
    setAutocompleteResults([]);
  };

  const faqs = [
    {
      q: 'How does booking and payment via Stripe work?',
      a: 'All prices on Lakbay are quoted in Philippine Pesos (PHP). When you select a package and departure schedule, seats are reserved in real-time, and you are guided through Stripe Checkout. We accept international credit/debit cards, Visa, and Mastercard with instant confirmation.',
    },
    {
      q: 'What is the early-cancellation policy and how are refunds handled?',
      a: 'Each tour package specifies a cancellationCutoffDays threshold (typically 7 to 14 days before departure). If you cancel on or before the cutoff date, our platform automatically triggers an instant Stripe refund and releases your seats. Cancellations requested after the cutoff date are reviewed by our Support Agents for exceptions.',
    },
    {
      q: 'Are tour guides licensed and accredited?',
      a: 'Yes, every Lakbay departure is led by a Department of Tourism (DOT) accredited local tour guide who coordinates daily activities, manages safety manifests, and checks in travelers.',
    },
    {
      q: 'Can I save companion profiles for faster checkout?',
      a: 'Yes! Registered customers have a dedicated "Saved Co-Travelers" manager in their dashboard to save full names, birthdates, and dietary/medical notes for easy one-click checkout.',
    },
  ];

  const [openFaq, setOpenFaq] = useState(null);

  return (
    <div className="flex flex-col min-h-screen">
      {/* 1. HERO SECTION WITH GEOAPIFY AUTOCOMPLETE */}
      <section className="relative min-h-[640px] flex items-center justify-center text-white overflow-hidden py-24 px-4 sm:px-6 lg:px-8 reveal-up">
        <HeroSlideshow />
        {/* Parallax glow overlay that follows mouse */}
        <motion.div
          className="absolute inset-0 z-10 pointer-events-none"
          style={{
            backgroundImage: `radial-gradient(600px circle at ${mouseX}% ${mouseY}%, rgba(16, 185, 129, 0.15), transparent 40%)`,
          }}
        />
        <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-900/60 to-slate-900/40" />

        {/* Floating destination postcards */}
        <div className="pointer-events-none absolute inset-0 z-10 hidden lg:block" aria-hidden="true">
          <div className="absolute left-[6%] top-[22%] w-36 rotate-[-8deg] overflow-hidden rounded-xl border border-white/30 shadow-2xl shadow-black/40 animate-float">
            <img src="/images/el-nido.jpg" alt="" className="h-24 w-full object-cover" loading="lazy" />
            <div className="bg-white/95 px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-emerald-800 text-center">El Nido</div>
          </div>
          <div className="absolute right-[7%] top-[18%] w-32 rotate-[7deg] overflow-hidden rounded-xl border border-white/30 shadow-2xl shadow-black/40 animate-float" style={{ animationDelay: '-2s' }}>
            <img src="/images/beach.jpg" alt="" className="h-20 w-full object-cover" loading="lazy" />
            <div className="bg-white/95 px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-emerald-800 text-center">Boracay</div>
          </div>
          <div className="absolute left-[10%] bottom-[16%] w-28 rotate-[6deg] overflow-hidden rounded-xl border border-white/30 shadow-2xl shadow-black/40 animate-float" style={{ animationDelay: '-4s' }}>
            <img src="/images/chocolate-hills.jpg" alt="" className="h-16 w-full object-cover" loading="lazy" />
            <div className="bg-white/95 px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-emerald-800 text-center">Bohol</div>
          </div>
          <div className="absolute right-[9%] bottom-[20%] w-36 rotate-[-6deg] overflow-hidden rounded-xl border border-white/30 shadow-2xl shadow-black/40 animate-float" style={{ animationDelay: '-6s' }}>
            <img src="/images/mountain.jpg" alt="" className="h-20 w-full object-cover" loading="lazy" />
            <div className="bg-white/95 px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-emerald-800 text-center">Banaue</div>
          </div>
          <div className="absolute left-[4%] top-[52%] rounded-full bg-white/10 px-3.5 py-1.5 text-xs font-bold text-emerald-200 backdrop-blur-md border border-white/20 animate-bounce-soft">
            🌴 7,641 islands
          </div>
          <div className="absolute right-[4%] top-[46%] rounded-full bg-white/10 px-3.5 py-1.5 text-xs font-bold text-amber-200 backdrop-blur-md border border-white/20 animate-bounce-soft" style={{ animationDelay: '-1.2s' }}>
            ⭐ 4.9 traveler rating
          </div>
        </div>

        <div className="relative z-10 container mx-auto max-w-5xl text-center">
          <Badge className="bg-emerald-500/20 text-emerald-300 border-emerald-500/30 px-4 py-1.5 text-xs font-semibold uppercase tracking-wider mb-6">
            <Sparkles className="h-3.5 w-3.5 mr-1.5 inline text-emerald-400" />
            Island Escapes in the Philippines
          </Badge>

          {/* Hero headline with gradient shimmer */}
          <h1 className="text-4xl sm:text-5xl md:text-6xl font-extrabold tracking-tight font-heading leading-tight max-w-4xl mx-auto reveal-up">
            Discover Your Next <span className="text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 via-teal-400 to-cyan-400 animate-[shimmer_3s_infinite] underline decoration-emerald-500/40 underline-offset-8">Adventure</span>.
          </h1>

          <p className="mt-5 text-lg sm:text-xl text-slate-300 max-w-2xl mx-auto font-normal">
            Immerse yourself in breathtaking Philippine destinations with curated multi-day tour packages, transparent PHP pricing, and secure online bookings.
          </p>

          {/* Search Box Card with Geoapify Autocomplete */}
          <div className="mt-10 mx-auto max-w-4xl rounded-2xl bg-white/90 backdrop-blur-xl p-4 sm:p-5 text-slate-900 shadow-2xl border border-white/30 reveal-up magnetic-card">
            <form onSubmit={handleSearchSubmit} className="grid grid-cols-1 md:grid-cols-12 gap-3 items-center">
              {/* Destination Autocomplete Input */}
              <div className="md:col-span-5 relative text-left">
                <Label htmlFor="home-search-destination" className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">
                  Destination or Place
                </Label>
                <div className="relative">
                  <MapPin className="absolute left-3 top-3 h-5 w-5 text-emerald-600 pointer-events-none" aria-hidden="true" />
                  <Input
                    id="home-search-destination"
                    type="text"
                    autoComplete="off"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    onKeyDown={(e) => e.key === 'Escape' && setAutocompleteResults([])}
                    // Delay so a click on a suggestion registers before the list closes
                    onBlur={() => setTimeout(() => setAutocompleteResults([]), 150)}
                    placeholder="Where to? (e.g. El Nido, Coron, Siargao)"
                    aria-busy={isSearchingAutocomplete}
                    className="h-11 rounded-xl bg-slate-50/50 pl-10 pr-4 py-2.5 font-medium focus-visible:bg-white"
                  />
                </div>

                {/* Autocomplete Dropdown */}
                {autocompleteResults.length > 0 && (
                  <div className="absolute left-0 right-0 top-full mt-2 rounded-xl border border-slate-200 bg-white p-2 shadow-2xl z-50 animate-in fade-in-0 zoom-in-95">
                    <p className="px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                      Suggested Destinations
                    </p>
                    {autocompleteResults.map((item, idx) => (
                      <button
                        key={`${item.name}-${idx}`}
                        type="button"
                        onClick={() => handleSelectAutocomplete(item)}
                        className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left text-sm text-slate-700 hover:bg-emerald-50 hover:text-emerald-900 transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      >
                        <MapPin className="h-4 w-4 text-emerald-600 shrink-0" />
                        <span className="font-semibold text-slate-900">{item.name}</span>
                        <span className="text-xs text-slate-500 truncate">{item.formatted}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Optional Departure Date */}
              <div className="md:col-span-3 text-left">
                <Label htmlFor="home-search-date" className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">
                  Departure Date
                </Label>
                <div className="relative">
                  <Calendar className="absolute left-3 top-3 h-5 w-5 text-slate-400 pointer-events-none" aria-hidden="true" />
                  <Input
                    id="home-search-date"
                    type="date"
                    value={departureDate}
                    onChange={(e) => setDepartureDate(e.target.value)}
                    className="h-11 rounded-xl bg-slate-50/50 pl-10 pr-3 py-2.5 font-medium focus-visible:bg-white"
                  />
                </div>
              </div>

              {/* Number of Travelers */}
              <div className="md:col-span-2 text-left">
                <Label htmlFor="home-search-travelers" className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">
                  Travelers
                </Label>
                <div className="relative">
                  <Users className="absolute left-3 top-3 z-10 h-5 w-5 text-slate-400 pointer-events-none" aria-hidden="true" />
                  <Select value={String(travelers)} onValueChange={(v) => setTravelers(Number(v))}>
                    <SelectTrigger
                      id="home-search-travelers"
                      className="h-11 rounded-xl bg-slate-50/50 pl-10 pr-3 py-2.5 font-medium focus:bg-white"
                    >
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {[1, 2, 3, 4, 5, 6, 8, 10].map((n) => (
                        <SelectItem key={n} value={String(n)}>
                          {n} {n === 1 ? 'Guest' : 'Guests'}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Search Submit Button */}
              <div className="md:col-span-2 pt-2 md:pt-5">
                <Button
                  type="submit"
                  className="w-full h-11 font-bold rounded-xl shadow-lg shadow-emerald-600/30 text-sm flex items-center justify-center gap-2 pulse-cta"
                >
                  <Search className="h-4 w-4" aria-hidden="true" />
                  Search
                </Button>
              </div>
            </form>
          </div>

          {/* Quick CTA Links */}
          <div className="mt-8 flex flex-wrap items-center justify-center gap-4 reveal-up">
            <Button asChild size="lg" className="font-bold px-7 rounded-xl shadow-lg shadow-emerald-600/25 pulse-cta magnetic-btn">
              <Link to="/packages">
                Browse Tour Packages
                <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
            <Button asChild size="lg" variant="outline" className="border-white/30 text-white hover:bg-white/10 hover:text-white font-bold px-7 rounded-xl bg-white/5 backdrop-blur-sm pulse-cta magnetic-btn">
              <Link to="/destinations">Explore Destinations</Link>
            </Button>
          </div>
        </div>
      </section>

      {/* TRUST STATS BAND */}
      <section className="relative overflow-hidden bg-white border-b border-slate-100">
        <div className="pointer-events-none absolute inset-0 bg-dots opacity-60" />
        <div className="orb orb-emerald -left-16 top-0 h-40 w-40 opacity-40" />
        <div className="orb orb-coral -right-10 bottom-0 h-40 w-40 opacity-30" style={{ animationDelay: '-5s' }} />
        <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-10 relative">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-6 reveal-stagger">
            {[
              { value: '12K+', label: 'Happy Travelers', icon: Users, color: 'from-emerald-500 to-teal-500' },
              { value: '120+', label: 'Curated Destinations', icon: MapPin, color: 'from-sky-500 to-blue-500' },
              { value: '350+', label: 'Tour Packages', icon: Compass, color: 'from-amber-500 to-orange-500' },
              { value: '4.9', label: 'Average Rating', icon: Star, color: 'from-rose-500 to-pink-500' },
            ].map((stat, i) => (
              <div key={i} className="flex items-center gap-4 rounded-2xl border border-slate-100 bg-white/80 backdrop-blur px-4 py-5 shadow-sm hover:shadow-lg hover:-translate-y-1 transition-all">
                <div className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br ${stat.color} text-white shadow-lg`}>
                  <stat.icon className="h-6 w-6" />
                </div>
                <div>
                  <div className="text-2xl font-black text-slate-900 font-heading count-animate">{stat.value}</div>
                  <div className="text-xs font-semibold text-slate-500">{stat.label}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {showPromoSkeleton && (
        <section
          className="bg-gradient-to-r from-emerald-900 via-teal-900 to-slate-900 py-6 border-y border-emerald-700/60 shadow-md"
          aria-hidden="true"
        >
          <div className="container mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex flex-col lg:flex-row items-center justify-between gap-6">
              <div className="flex items-center gap-4 w-full lg:w-auto">
                <Skeleton className="h-12 w-12 shrink-0 rounded-xl bg-white/15" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-4 w-28 bg-white/15" />
                  <Skeleton className="h-5 w-64 max-w-full bg-white/15" />
                  <Skeleton className="h-3 w-80 max-w-full bg-white/10" />
                </div>
              </div>
              <Skeleton className="h-10 w-52 shrink-0 bg-white/15" />
            </div>
          </div>
        </section>
      )}
      {promotions.length > 0 && (
        <section className="bg-gradient-to-r from-emerald-900 via-teal-900 to-slate-900 text-white py-6 border-y border-emerald-700/60 shadow-md">
          <div className="container mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex flex-col lg:flex-row items-center justify-between gap-6">
              <div className="flex items-center gap-4">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-amber-400 text-slate-950 font-black shadow-lg">
                  <Sparkles className="h-6 w-6 fill-slate-950" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="rounded bg-amber-400/20 px-2 py-0.5 text-[11px] font-extrabold tracking-wider text-amber-300 uppercase border border-amber-300/30">
                      {promotions[0].badgeText || 'SPECIAL OFFER'}
                    </span>
                    {promotions[0].discountHighlight && (
                      <span className="text-xs font-semibold text-emerald-300">
                        • {promotions[0].discountHighlight}
                      </span>
                    )}
                  </div>
                  <h3 className="text-lg sm:text-xl font-bold font-heading text-white mt-0.5">
                    {promotions[0].title}
                  </h3>
                  {promotions[0].subtitle && (
                    <p className="text-xs sm:text-sm text-slate-300 max-w-2xl mt-0.5">
                      {promotions[0].subtitle}
                    </p>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-3 shrink-0">
                <Button asChild className="bg-amber-400 hover:bg-amber-300 active:bg-amber-300 text-slate-950 font-extrabold text-sm px-6 shadow-md">
                  {(() => {
                    const promoLink = resolvePromoLink(promotions[0].actionUrl);
                    const content = (
                      <>
                        {promotions[0].actionText || promotions[0].actionLabel || 'Explore Discounted Tours'}
                        <ArrowRight className="ml-1.5 h-4 w-4" />
                      </>
                    );
                    return promoLink.external ? (
                      <a href={promoLink.href} target="_blank" rel="noopener noreferrer">{content}</a>
                    ) : (
                      <Link to={promoLink.href}>{content}</Link>
                    );
                  })()}
                </Button>
              </div>
            </div>
          </div>
        </section>
      )}

      {/* 2. FEATURED DESTINATIONS */}
      <section className="py-20 bg-white reveal-up">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col md:flex-row md:items-end justify-between mb-12">
            <div>
              <Badge className="bg-emerald-100 text-emerald-800 border-none font-semibold mb-2">
                Top Picks
              </Badge>
              <h2 className="text-3xl sm:text-4xl font-extrabold text-slate-900 font-heading">
                Featured Destinations
              </h2>
              <p className="mt-2 text-slate-600 max-w-xl text-sm">
                Explore the most sought-after islands, coastal paradises, and cultural landscapes across the archipelago.
              </p>
            </div>
            <Button asChild variant="outline" className="mt-4 md:mt-0 self-start md:self-auto font-semibold text-emerald-700 border-emerald-200 hover:bg-emerald-50 hover:text-emerald-700">
              <Link to="/destinations">
                View All Destinations
                <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
          </div>

          {error && (
            <ErrorState
              className="mb-8"
              title="Unable to load featured tours"
              message={error}
              onRetry={loadHomeData}
              retrying={loading}
            />
          )}

          {showDestinationSkeleton && (
            <LoadingRegion label="Loading featured destinations" className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-sm" aria-hidden="true">
                  <Skeleton className="h-64 w-full rounded-none" />
                  <div className="p-5 space-y-2">
                    <Skeleton className="h-4 w-full" />
                    <Skeleton className="h-4 w-2/3" />
                    <div className="mt-5 pt-4 border-t border-slate-100 flex items-center justify-between">
                      <Skeleton className="h-3 w-28" />
                      <Skeleton className="h-8 w-20" />
                    </div>
                  </div>
                </div>
              ))}
            </LoadingRegion>
          )}

          {!loading && !error && featuredDestinations.length === 0 && (
            <EmptyState
              icon={MapPin}
              title="No featured destinations yet"
              description="Check back soon, or browse every destination we cover."
              action={
                <Button asChild size="sm" variant="outline">
                  <Link to="/destinations">View All Destinations</Link>
                </Button>
              }
            />
          )}

          <div className={`grid grid-cols-1 ${cardGridCols(featuredDestinations.length)} gap-6 reveal-stagger`}>
            {featuredDestinations.map((dest) => (
              <Card
                key={dest.id}
                className="group overflow-hidden rounded-2xl border-slate-200/80 shadow-sm hover:shadow-[0_20px_40px_-10px_rgba(16,185,129,0.35)] transition-all duration-300 hover:-translate-y-2 hover:scale-[1.02]"
              >
                <div className="relative h-64 overflow-hidden">
                  <div
                    role="img"
                    aria-label={dest.name}
                    className="h-full w-full bg-cover bg-center bg-no-repeat group-hover:scale-105 transition-transform duration-700"
                    style={{ backgroundImage: `url(${dest.imageUrls?.[0] || '/images/el-nido.jpg'})` }}
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-slate-950/80 via-transparent to-transparent" />
                  <div className="absolute bottom-4 left-4 right-4 text-white">
                    <span className="rounded-md bg-emerald-600/90 backdrop-blur-sm px-2.5 py-1 text-[11px] font-bold uppercase tracking-wider">
                      {dest.category || 'Island'}
                    </span>
                    <h3 className="text-xl font-bold font-heading mt-2">{dest.name}</h3>
                    <p className="text-xs text-slate-300 flex items-center gap-1 mt-0.5">
                      <MapPin className="h-3.5 w-3.5 text-emerald-400" />
                      {dest.location}
                    </p>
                  </div>
                </div>
                <CardContent className="p-5 flex flex-col justify-between">
                  <p className="text-sm text-slate-600 line-clamp-2 leading-relaxed">
                    {dest.description}
                  </p>
                  <div className="mt-5 pt-4 border-t border-slate-100 flex items-center justify-between">
                    <span className="text-xs font-semibold text-emerald-700">
                      {dest.relatedPackages?.length || 2}+ Tour Packages
                    </span>
                    <Button asChild size="sm" className="bg-slate-900 hover:bg-emerald-600 active:bg-emerald-700 font-semibold text-xs">
                      <Link to={`/destinations/${dest.id}`} aria-label={`Explore ${dest.name}`}>
                        Explore
                      </Link>
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* 4. POPULAR TOUR PACKAGES */}
      <section className="py-20 bg-slate-50 border-y border-slate-200 reveal-up">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col md:flex-row md:items-end justify-between mb-12">
            <div>
              <Badge className="bg-emerald-100 text-emerald-800 border-none font-semibold mb-2">
                Best Sellers
              </Badge>
              <h2 className="text-3xl sm:text-4xl font-extrabold text-slate-900 font-heading">
                Popular Tour Packages
              </h2>
              <p className="mt-2 text-slate-600 max-w-xl text-sm">
                Curated multi-day itineraries with daily activity schedules, licensed guides, and seamless booking.
              </p>
            </div>
            <Button asChild variant="outline" className="mt-4 md:mt-0 self-start md:self-auto font-semibold text-emerald-700 border-emerald-200 hover:bg-emerald-50 hover:text-emerald-700">
              <Link to="/packages">
                Browse All Packages
                <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
          </div>

          {showPackageSkeleton && (
            <LoadingRegion label="Loading popular tour packages" className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="flex flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm" aria-hidden="true">
                  <Skeleton className="h-56 w-full rounded-none" />
                  <div className="p-6 space-y-3">
                    <div className="flex items-center justify-between">
                      <Skeleton className="h-3 w-24" />
                      <Skeleton className="h-4 w-12 rounded-full" />
                    </div>
                    <Skeleton className="h-5 w-3/4" />
                    <Skeleton className="h-3 w-full" />
                    <Skeleton className="h-3 w-2/3" />
                    <div className="mt-6 pt-5 border-t border-slate-100 flex items-center justify-between">
                      <div className="space-y-1.5">
                        <Skeleton className="h-3 w-20" />
                        <Skeleton className="h-6 w-28" />
                      </div>
                      <div className="flex gap-2">
                        <Skeleton className="h-8 w-16" />
                        <Skeleton className="h-8 w-20" />
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </LoadingRegion>
          )}

          {!loading && !error && popularPackages.length === 0 && (
            <EmptyState
              icon={Compass}
              title="No popular tour packages yet"
              description="New itineraries are added regularly. Browse the full catalog in the meantime."
              action={
                <Button asChild size="sm" variant="outline">
                  <Link to="/packages">Browse All Packages</Link>
                </Button>
              }
            />
          )}

          <div className={`grid grid-cols-1 ${cardGridCols(popularPackages.length)} gap-6 reveal-stagger`}>
            {popularPackages.map((pkg) => (
              <Card
                key={pkg.id}
                className="group flex flex-col overflow-hidden rounded-2xl border-slate-200 bg-white shadow-sm hover:shadow-[0_20px_40px_-10px_rgba(16,185,129,0.35)] transition-all duration-300 hover:-translate-y-2 hover:scale-[1.02]"
              >
                <div className="relative h-56 overflow-hidden">
                  <div
                    role="img"
                    aria-label={pkg.name}
                    className="h-full w-full bg-cover bg-center bg-no-repeat group-hover:scale-105 transition-transform duration-700"
                    style={{ backgroundImage: `url(${pkg.imageUrls?.[0] || '/images/el-nido.jpg'})` }}
                  />
                  <div className="absolute top-3 left-3">
                    <Badge className="bg-white/90 text-slate-900 font-bold backdrop-blur-sm shadow-sm text-xs">
                      {pkg.durationDays}D / {pkg.durationNights}N
                    </Badge>
                  </div>
                  <div className="absolute top-3 right-3 flex items-center gap-1.5">
                    {pkg.discountPercent > 0 && (
                      <Badge className="bg-rose-600 text-white font-extrabold shadow-sm text-xs px-2 py-0.5">
                        {pkg.discountPercent}% OFF
                      </Badge>
                    )}
                    <Badge className="bg-emerald-600 text-white font-bold shadow-sm text-xs">
                      {pkg.category}
                    </Badge>
                  </div>
                </div>

                <CardContent className="p-6 flex-1 flex flex-col justify-between">
                  <div>
                    <div className="flex items-center justify-between gap-2 mb-1">
                      <p className="text-xs font-semibold text-emerald-700 uppercase tracking-wider flex items-center gap-1">
                        <MapPin className="h-3.5 w-3.5" />
                        {pkg.destinationName || 'Philippines'}
                      </p>
                      {pkg.averageRating > 0 ? (
                        <div className="flex items-center gap-1 text-xs font-bold text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full border border-amber-200/50">
                          <Star className="h-3 w-3 fill-amber-400 text-amber-500" />
                          <span>{Number(pkg.averageRating).toFixed(1)}</span>
                          <span className="text-slate-400 font-normal text-[10px]">({pkg.reviewCount || 0})</span>
                        </div>
                      ) : (
                        <span className="text-[10px] text-slate-400 font-medium bg-slate-100 px-2 py-0.5 rounded-full">New</span>
                      )}
                    </div>
                    <h3 className="text-lg font-bold text-slate-900 font-heading group-hover:text-emerald-700 transition-colors">
                      {pkg.name}
                    </h3>
                    <p className="mt-2 text-xs text-slate-500 line-clamp-2 leading-relaxed">
                      {pkg.description}
                    </p>
                  </div>

                  <div className="mt-6 pt-5 border-t border-slate-100 flex flex-col gap-3">
                    <div>
                      <span className="block text-[11px] text-slate-400 font-medium">Starting from</span>
                      {pkg.discountPercent > 0 ? (
                        <div>
                          <div className="flex items-baseline gap-1.5 whitespace-nowrap">
                            <span className="text-xl font-black text-emerald-700 font-heading">
                              {formatCurrency(pkg.effectivePrice || pkg.discountPrice)}
                            </span>
                            <span className="text-[10px] text-slate-500">/ person</span>
                          </div>
                          <div className="flex items-center gap-1.5 text-xs mt-0.5">
                            <span className="text-slate-400 line-through">
                              {formatCurrency(pkg.pricePerPerson)}
                            </span>
                            <span className="text-[10px] font-bold text-rose-600 bg-rose-50 px-1 rounded">
                              Save {formatCurrency(pkg.pricePerPerson - (pkg.effectivePrice || pkg.discountPrice))}
                            </span>
                          </div>
                        </div>
                      ) : (
                        <div className="flex items-baseline gap-1 whitespace-nowrap">
                          <span className="text-xl font-black text-slate-900 font-heading">
                            {formatCurrency(pkg.pricePerPerson)}
                          </span>
                          <span className="text-[10px] text-slate-500">/ person</span>
                        </div>
                      )}
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <Button asChild size="sm" variant="outline" className="font-semibold text-xs">
                        <Link to={`/packages/${pkg.id}`} aria-label={`View details for ${pkg.name}`}>
                          Details
                        </Link>
                      </Button>
                      <Button asChild size="sm" className="font-bold text-xs shadow-md shadow-emerald-500/20">
                        <Link to={`/packages/${pkg.id}`} aria-label={`Book ${pkg.name}`}>
                          Book Now
                        </Link>
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* 5. WHY CHOOSE US */}
      <section className="py-20 bg-white reveal-up">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-2xl mx-auto mb-16">
            <Badge className="bg-emerald-100 text-emerald-800 border-none font-semibold mb-2">
              The Lakbay Difference
            </Badge>
            <h2 className="text-3xl sm:text-4xl font-extrabold text-slate-900 font-heading">
              Why Travel With Us
            </h2>
            <p className="mt-2 text-slate-600 text-sm">
              We eliminate the stress of island coordination with transparent pricing, certified partners, and reliable support.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-8 reveal-stagger">
            {[
              {
                icon: Compass,
                title: 'Easy Online Booking',
                desc: 'Select departure dates and reserve slots online with instant seat locking.',
                color: 'from-emerald-500 to-teal-500',
              },
              {
                icon: MapPin,
                title: 'Handcrafted Itineraries',
                desc: 'Every daily activity is carefully planned with local guides and verified coordinates.',
                color: 'from-sky-500 to-blue-500',
              },
              {
                icon: CreditCard,
                title: 'Transparent PHP Pricing',
                desc: 'Zero hidden booking fees. What you see is what you pay in Philippine Pesos.',
                color: 'from-amber-500 to-orange-500',
              },
              {
                icon: ShieldCheck,
                title: 'Automatic Refund Policy',
                desc: 'Cancel before the package cutoff threshold and receive an automated Stripe refund.',
                color: 'from-violet-500 to-purple-500',
              },
              {
                icon: Headphones,
                title: 'Dedicated Local Support',
                desc: 'Support agents and licensed tour guides keep you covered from booking to return.',
                color: 'from-rose-500 to-pink-500',
              },
            ].map((feature, i) => (
              <div
                key={i}
                className="group flex flex-col items-center text-center p-6 rounded-2xl bg-slate-50 border border-slate-100 hover:border-emerald-200 hover:bg-white transition-all duration-300 hover:-translate-y-1.5 hover:shadow-xl hover:shadow-emerald-500/10"
              >
                <div className={`relative flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br ${feature.color} text-white mb-4 shadow-lg group-hover:scale-110 group-hover:rotate-3 transition-transform duration-300`}>
                  <span className="absolute inset-0 rounded-2xl ring-1 ring-white/30" />
                  <feature.icon className="h-7 w-7" />
                </div>
                <h4 className="font-bold text-slate-900 text-base mb-2 font-heading">{feature.title}</h4>
                <p className="text-xs text-slate-600 leading-relaxed">{feature.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* 6. HOW IT WORKS */}
      <section className="relative py-20 bg-slate-900 text-white overflow-hidden reveal-up">
        <div className="pointer-events-none absolute inset-0 bg-dots-light opacity-10" />
        <div className="orb orb-emerald -left-20 top-10 h-64 w-64 opacity-40" />
        <div className="orb orb-teal right-0 bottom-0 h-56 w-56 opacity-30" style={{ animationDelay: '-7s' }} />
        <div className="container mx-auto px-4 sm:px-6 lg:px-8 relative">
          <div className="text-center max-w-2xl mx-auto mb-16">
            <Badge className="bg-emerald-500/20 text-emerald-300 border-none font-semibold mb-2">
              Simple 5-Step Process
            </Badge>
            <h2 className="text-3xl sm:text-4xl font-extrabold text-white font-heading">
              How It Works
            </h2>
            <p className="mt-2 text-slate-400 text-sm">
              From island inspiration to your verified travel confirmation in minutes.
            </p>
          </div>

          <div className="relative grid grid-cols-1 md:grid-cols-5 gap-6 reveal-stagger">
            {/* Connecting dashed line (desktop) */}
            <div className="hidden md:block absolute left-0 right-0 top-1 -z-0 border-t-2 border-dashed border-emerald-500/30" aria-hidden="true" />
            {[
              { step: '01', title: 'Explore Destinations', desc: 'Browse our curated destination guides with live weather & Leaflet maps.', emoji: '🗺️' },
              { step: '02', title: 'Choose a Tour', desc: 'Select multi-day tour packages with day-by-day activity itineraries.', emoji: '🏝️' },
              { step: '03', title: 'Pick Departure', desc: 'Choose an open schedule on our interactive OpenWeather departure calendar.', emoji: '📅' },
              { step: '04', title: 'Book & Pay in PHP', desc: 'Pay securely via Stripe Checkout with card or mobile payment options.', emoji: '💳' },
              { step: '05', title: 'Travel & Check In', desc: 'Receive instant booking reference, itinerary vouchers, and guide support.', emoji: '🛫' },
            ].map((s, i) => (
              <div key={i} className="group relative flex flex-col items-center text-center p-6 rounded-2xl bg-slate-800/80 border border-slate-700/60 hover:border-emerald-500/50 hover:bg-slate-800 transition-all duration-300 hover:-translate-y-1.5">
                <div className="relative z-10 -mt-12 mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-500 text-white text-xl shadow-lg shadow-emerald-500/40 ring-4 ring-slate-900 group-hover:scale-110 transition-transform">
                  {s.emoji}
                </div>
                <span className="text-xs font-black text-emerald-400 tracking-widest mb-2">STEP {s.step}</span>
                <h4 className="text-base font-bold text-white mb-2 font-heading">{s.title}</h4>
                <p className="text-xs text-slate-400 leading-relaxed">{s.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* 6.5 TRAVELER TESTIMONIALS */}
      <section className="relative py-20 bg-gradient-to-b from-white via-emerald-50/40 to-white overflow-hidden reveal-up">
        <div className="orb orb-coral -right-16 top-10 h-56 w-56 opacity-30" />
        <div className="orb orb-sky -left-14 bottom-0 h-52 w-52 opacity-30" style={{ animationDelay: '-4s' }} />
        <div className="container mx-auto px-4 sm:px-6 lg:px-8 relative">
          <div className="text-center max-w-2xl mx-auto mb-14">
            <Badge className="bg-amber-100 text-amber-800 border-none font-semibold mb-2">
              <Star className="h-3 w-3 mr-1 fill-amber-500 text-amber-500" />
              Traveler Stories
            </Badge>
            <h2 className="text-3xl sm:text-4xl font-extrabold text-slate-900 font-heading">
              Loved by Adventurers
            </h2>
            <p className="mt-2 text-slate-600 text-sm">
              Sample reviews illustrating the island-hopping, diving, and trekking trips you can book on Lakbay.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 reveal-stagger">
            {[
              {
                name: 'Maria Santos',
                trip: 'El Nido Island Hopping — 4D/3N',
                initials: 'MS',
                gradient: 'from-emerald-500 to-teal-500',
                quote: 'Everything from the Stripe booking to the guide check-in was seamless. The big lagoon at sunrise was worth every peso — zero hidden fees, exactly as promised.',
              },
              {
                name: 'Jake Rivera',
                trip: 'Siargao Surf & Island — 5D/4N',
                initials: 'JR',
                gradient: 'from-sky-500 to-blue-500',
                quote: 'Rescheduling was painless and the refund hit my card in two days. The day-by-day itinerary on the site matched the actual trip perfectly. Will book again!',
              },
              {
                name: 'Aisha Dela Cruz',
                trip: 'Coron Shipwrecks & Lakes — 3D/2N',
                initials: 'AD',
                gradient: 'from-amber-500 to-orange-500',
                quote: 'The departure calendar with live weather made picking dates so easy. Our DOT-accredited guide was fantastic and the Kayangan Lake viewpoint was a highlight for the kids.',
              },
            ].map((t, i) => (
              <figure
                key={i}
                className="card-tilt relative rounded-2xl border border-white bg-white/90 backdrop-blur p-6 shadow-lg shadow-slate-200/60"
              >
                <div className="absolute -top-3 left-6 flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-amber-400 to-orange-500 text-white text-sm font-black shadow-lg">
                  ★
                </div>
                <div className="flex gap-0.5 mb-3 text-amber-400" aria-label="5 out of 5 stars">
                  {[1, 2, 3, 4, 5].map((s) => (
                    <Star key={s} className="h-4 w-4 fill-amber-400 text-amber-400" />
                  ))}
                </div>
                <blockquote className="text-sm text-slate-600 leading-relaxed">
                  “{t.quote}”
                </blockquote>
                <figcaption className="mt-5 flex items-center gap-3 border-t border-slate-100 pt-4">
                  <div className={`flex h-11 w-11 items-center justify-center rounded-full bg-gradient-to-br ${t.gradient} text-white text-sm font-black shadow-md ring-2 ring-white`}>
                    {t.initials}
                  </div>
                  <div>
                    <div className="text-sm font-bold text-slate-900">{t.name}</div>
                    <div className="text-[11px] font-semibold text-emerald-700">{t.trip}</div>
                  </div>
                </figcaption>
              </figure>
            ))}
          </div>

          {/* Photo strip */}
          <div className="mt-12 grid grid-cols-4 gap-3 reveal-stagger">
            {[
              { src: '/images/island.jpg', caption: 'Coron, Palawan' },
              { src: '/images/water.jpg', caption: 'Siargao' },
              { src: '/images/coast.jpg', caption: 'Batanes' },
              { src: '/images/lake.jpg', caption: 'Lake Sebu' },
            ].map((img) => (
              <div key={img.caption} className="img-zoom group relative aspect-[4/3] overflow-hidden rounded-xl border border-slate-200 shadow-sm">
                <img src={img.src} alt={img.caption} className="h-full w-full object-cover" loading="lazy" />
                <div className="absolute inset-0 bg-gradient-to-t from-slate-950/70 to-transparent" />
                <span className="absolute bottom-2 left-3 text-[11px] font-bold uppercase tracking-wider text-white drop-shadow">
                  {img.caption}
                </span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* 7. FREQUENTLY ASKED QUESTIONS */}
      <section id="faqs" className="scroll-mt-20 py-20 bg-slate-50 reveal-up">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8 max-w-4xl">
          <div className="text-center mb-14">
            <Badge className="bg-emerald-100 text-emerald-800 border-none font-semibold mb-2">
              Got Questions?
            </Badge>
            <h2 className="text-3xl sm:text-4xl font-extrabold text-slate-900 font-heading">
              Frequently Asked Questions
            </h2>
            <p className="mt-2 text-slate-600 text-sm">
              Everything you need to know about departures, Stripe payments, and early cancellations.
            </p>
          </div>

          <div className="space-y-4">
            {faqs.map((faq, i) => (
              <div
                key={i}
                className={`rounded-xl border bg-white p-5 shadow-sm transition-all ${
                  openFaq === i
                    ? 'border-emerald-300 shadow-lg shadow-emerald-500/10 ring-1 ring-emerald-200/60'
                    : 'border-slate-200 hover:border-emerald-200 hover:shadow-md'
                }`}
              >
                <button
                  type="button"
                  onClick={() => setOpenFaq(openFaq === i ? null : i)}
                  aria-expanded={openFaq === i}
                  aria-controls={`home-faq-${i}`}
                  className="flex w-full items-center justify-between gap-3 rounded-md text-left font-bold text-slate-900 text-base cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                >
                  <span>{faq.q}</span>
                  <ChevronDown
                    className={`h-5 w-5 text-slate-400 transition-transform duration-200 ${
                      openFaq === i ? 'rotate-180 text-emerald-600' : ''
                    }`}
                  />
                </button>
                {openFaq === i && (
                  <p id={`home-faq-${i}`} className="mt-3 text-sm text-slate-600 leading-relaxed border-t border-slate-100 pt-3">
                    {faq.a}
                  </p>
                )}
              </div>
            ))}
          </div>
        </div>
        </section>

        {/* FINAL CTA BANNER */}
        <section className="relative overflow-hidden">
          <img
            src="/images/coast.jpg"
            alt=""
            aria-hidden="true"
            className="absolute inset-0 h-full w-full object-cover"
            loading="lazy"
          />
          <div className="absolute inset-0 bg-gradient-to-r from-emerald-900/95 via-emerald-800/85 to-teal-900/75" />
          <div className="orb orb-coral right-10 top-4 h-40 w-40 opacity-40" />
          <div className="container mx-auto px-4 sm:px-6 lg:px-8 relative py-16 text-center text-white">
            <Badge className="bg-white/15 text-emerald-200 border-white/20 px-4 py-1.5 text-xs font-semibold uppercase tracking-wider mb-5">
              <Sparkles className="h-3.5 w-3.5 mr-1.5 inline" />
              Your island is waiting
            </Badge>
            <h2 className="text-3xl sm:text-4xl font-extrabold font-heading max-w-2xl mx-auto">
              Ready for your next <span className="text-gradient-warm">adventure</span>?
            </h2>
            <p className="mt-3 text-emerald-50/90 max-w-xl mx-auto text-sm sm:text-base">
              Join thousands of travelers who booked transparent, guide-led Philippine tours with instant Stripe confirmation.
            </p>
            <div className="mt-7 flex flex-wrap items-center justify-center gap-4">
              <Button asChild size="lg" className="font-bold px-8 rounded-xl bg-white text-emerald-800 hover:bg-emerald-50 shadow-xl shadow-black/20">
                <Link to="/packages">
                  Start Exploring
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
              </Button>
              <Button asChild size="lg" variant="outline" className="border-white/40 text-white hover:bg-white/15 hover:text-white font-bold px-8 rounded-xl bg-white/10 backdrop-blur">
                <Link to="/become-operator">Become an Operator</Link>
              </Button>
            </div>
          </div>
        </section>

        {/* Back to top button */}
        <motion.button
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 20 }}
          onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
          className="fixed bottom-8 right-8 z-50 w-14 h-14 rounded-full bg-emerald-600 text-white flex items-center justify-center shadow-2xl shadow-emerald-500/40 hover:bg-emerald-500 hover:scale-110 transition-all duration-300 back-to-top"
          aria-label="Back to top"
        >
          <ArrowRight className="h-7 w-7 rotate-90" />
        </motion.button>
      </div>
  );
};
