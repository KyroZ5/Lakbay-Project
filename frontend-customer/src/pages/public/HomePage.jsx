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
  useEffect(() => {
    if (!searchQuery || searchQuery.trim().length < 2) {
      setAutocompleteResults([]);
      return;
    }

    const timer = setTimeout(async () => {
      setIsSearchingAutocomplete(true);
      try {
        const res = await externalApi.autocompleteLocation(searchQuery);
        setAutocompleteResults(res.data || []);
      } catch (err) {
        console.warn('Autocomplete fetch error:', err);
      } finally {
        setIsSearchingAutocomplete(false);
      }
    }, 250);

    return () => clearTimeout(timer);
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

  // Scroll reveal for sections and staggered grid items
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add('visible');
          }
        });
      },
      { threshold: 0.1 }
    );
    const targets = document.querySelectorAll(
      '.reveal-up, .reveal-stagger > *'
    );
    targets.forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, [loading]);

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
    setSearchQuery(item.name || item.formatted);
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

      {/* PROMOTIONAL CAMPAIGN BANNER / RIBBON */}
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
                  <Link to={promotions[0].actionUrl || '/packages?discounted=true'}>
                    {promotions[0].actionLabel || 'Explore Discounted Tours'}
                    <ArrowRight className="ml-1.5 h-4 w-4" />
                  </Link>
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

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8 reveal-stagger">
            {featuredDestinations.map((dest) => (
              <Card
                key={dest.id}
                className="group overflow-hidden rounded-2xl border-slate-200/80 shadow-sm hover:shadow-[0_20px_40px_-10px_rgba(16,185,129,0.35)] transition-all duration-300 hover:-translate-y-2 hover:scale-[1.02]"
              >
                <div className="relative h-64 overflow-hidden">
                  <motion.div
                    whileHover={{ scale: 1.05, rotate: 1 }}
                    className="h-full w-full object-cover group-hover:scale-105 transition-transform duration-700"
                    style={{ backgroundImage: `url(${dest.imageUrls?.[0] || 'https://images.unsplash.com/photo-1518509562904-e7ef99cdcc86?auto=format&fit=crop&w=800&q=80'})` }}
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

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 reveal-stagger">
            {popularPackages.map((pkg) => (
              <Card
                key={pkg.id}
                className="group flex flex-col overflow-hidden rounded-2xl border-slate-200 bg-white shadow-sm hover:shadow-[0_20px_40px_-10px_rgba(16,185,129,0.35)] transition-all duration-300 hover:-translate-y-2 hover:scale-[1.02]"
              >
                <div className="relative h-56 overflow-hidden">
                  <motion.div
                    whileHover={{ scale: 1.05, rotate: 1 }}
                    className="h-full w-full object-cover group-hover:scale-105 transition-transform duration-700"
                    style={{ backgroundImage: `url(${pkg.imageUrls?.[0] || 'https://images.unsplash.com/photo-1544735716-392fe2489ffa?auto=format&fit=crop&w=800&q=80'})` }}
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
                          <span>{pkg.averageRating.toFixed(1)}</span>
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

                  <div className="mt-6 pt-5 border-t border-slate-100 flex items-center justify-between">
                    <div>
                      <span className="block text-[11px] text-slate-400 font-medium">Starting from</span>
                      {pkg.discountPercent > 0 ? (
                        <div>
                          <div className="flex items-baseline gap-1.5">
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
                        <div>
                          <span className="text-xl font-black text-slate-900 font-heading">
                            {formatCurrency(pkg.pricePerPerson)}
                          </span>
                          <span className="text-[10px] text-slate-500 ml-1">/ person</span>
                        </div>
                      )}
                    </div>

                    <div className="flex gap-2">
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
              },
              {
                icon: MapPin,
                title: 'Handcrafted Itineraries',
                desc: 'Every daily activity is carefully planned with local guides and verified coordinates.',
              },
              {
                icon: CreditCard,
                title: 'Transparent PHP Pricing',
                desc: 'Zero hidden booking fees. What you see is what you pay in Philippine Pesos.',
              },
              {
                icon: ShieldCheck,
                title: 'Automatic Refund Policy',
                desc: 'Cancel before the package cutoff threshold and receive an automated Stripe refund.',
              },
              {
                icon: Headphones,
                title: 'Dedicated Local Support',
                desc: 'Support agents and licensed tour guides keep you covered from booking to return.',
              },
            ].map((feature, i) => (
              <div
                key={i}
                className="flex flex-col items-center text-center p-6 rounded-2xl bg-slate-50 border border-slate-100 hover:border-emerald-200 hover:bg-emerald-50/20 transition-colors"
              >
                <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-100 text-emerald-700 mb-4 shadow-sm">
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
      <section className="py-20 bg-slate-900 text-white reveal-up">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
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

          <div className="grid grid-cols-1 md:grid-cols-5 gap-6 reveal-stagger">
            {[
              { step: '01', title: 'Explore Destinations', desc: 'Browse our curated destination guides with live weather & Leaflet maps.' },
              { step: '02', title: 'Choose a Tour', desc: 'Select multi-day tour packages with day-by-day activity itineraries.' },
              { step: '03', title: 'Pick Departure', desc: 'Choose an open schedule on our interactive OpenWeather departure calendar.' },
              { step: '04', title: 'Book & Pay in PHP', desc: 'Pay securely via Stripe Checkout with card or mobile payment options.' },
              { step: '05', title: 'Travel & Check In', desc: 'Receive instant booking reference, itinerary vouchers, and guide support.' },
            ].map((s, i) => (
              <div key={i} className="relative flex flex-col p-6 rounded-2xl bg-slate-800/80 border border-slate-700/60">
                <span className="text-3xl font-black text-emerald-400 font-heading mb-3">{s.step}</span>
                <h4 className="text-base font-bold text-white mb-2 font-heading">{s.title}</h4>
                <p className="text-xs text-slate-400 leading-relaxed">{s.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* 7. FREQUENTLY ASKED QUESTIONS */}
      <section className="py-20 bg-slate-50 reveal-up">
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
                className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm transition-all"
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
