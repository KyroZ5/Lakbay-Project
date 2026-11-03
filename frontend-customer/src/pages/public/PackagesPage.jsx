import React, { useState, useEffect, useRef } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { packagesApi } from '../../api/packagesApi';
import { destinationsApi } from '../../api/destinationsApi';
import { Card, CardContent } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Badge } from '../../components/ui/badge';
import { Skeleton } from '../../components/ui/skeleton';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../components/ui/select';
import { EmptyState, ErrorState } from '../../components/common/DataStates';
import { LoadingRegion } from '../../components/common/Skeletons';
import { notify, getErrorMessage } from '../../lib/notify';
import { formatCurrency, formatDate } from '../../lib/utils';
import { todayInManila } from '../../lib/dates';
import { Search, MapPin, Calendar, Clock, Star, Percent, Compass } from 'lucide-react';

const PackageCardSkeleton = () => (
  <div className="flex flex-col justify-between overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm" aria-hidden="true">
    <div>
      <Skeleton className="h-48 sm:h-56 lg:h-60 w-full rounded-none" />
      <div className="p-5 sm:p-6">
        <div className="flex items-center justify-between gap-2 mb-2">
          <Skeleton className="h-3 w-28" />
          <Skeleton className="h-4 w-12 rounded-full" />
        </div>
        <Skeleton className="h-6 w-3/4" />
        <Skeleton className="mt-3 h-3 w-full" />
        <Skeleton className="mt-1.5 h-3 w-5/6" />
        <Skeleton className="mt-4 h-9 w-full rounded-xl" />
      </div>
    </div>
    <div className="p-5 sm:p-6 pt-4 sm:pt-4 border-t border-slate-100 mt-4 flex flex-wrap items-center justify-between gap-3">
      <div>
        <Skeleton className="h-2.5 w-16" />
        <Skeleton className="mt-1.5 h-7 w-28" />
      </div>
      <div className="flex gap-2">
        <Skeleton className="h-8 w-16" />
        <Skeleton className="h-8 w-20" />
      </div>
    </div>
  </div>
);

export const PackagesPage = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const initialSearch = searchParams.get('search') || '';
  const initialDiscounted = searchParams.get('discounted') === 'true';
  const parseTravelers = (value) => {
    const n = parseInt(value, 10);
    return Number.isInteger(n) && n > 0 ? n : 0;
  };

  const [packages, setPackages] = useState([]);
  const [destinations, setDestinations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Filter States
  const [search, setSearch] = useState(initialSearch);
  const [selectedDestination, setSelectedDestination] = useState('');
  const [category, setCategory] = useState(searchParams.get('category') || '');
  const [departureDate, setDepartureDate] = useState(searchParams.get('departureDate') || '');
  const [travelers, setTravelers] = useState(parseTravelers(searchParams.get('travelers')));
  const [onlyDiscounted, setOnlyDiscounted] = useState(initialDiscounted);
  const [minPrice, setMinPrice] = useState('');
  const [maxPrice, setMaxPrice] = useState('');
  const [sort, setSort] = useState('featured');

  // Re-sync filters when the URL changes while already on this page (e.g. footer category links)
  useEffect(() => {
    setSearch(searchParams.get('search') || '');
    setCategory(searchParams.get('category') || '');
    setDepartureDate(searchParams.get('departureDate') || '');
    setTravelers(parseTravelers(searchParams.get('travelers')));
    setOnlyDiscounted(searchParams.get('discounted') === 'true');
  }, [searchParams]);

  useEffect(() => {
    // Load destination options for the filter dropdown
    destinationsApi
      .getAll()
      .then((res) => {
        setDestinations(res.data || []);
      })
      .catch((err) => notify.error(err, 'Failed to load destination filters.'));
  }, []);

  // Ignore responses from superseded requests (fast filter clicks can resolve out of order)
  const requestIdRef = useRef(0);

  // `overrides` lets Reset fetch with cleared values before state updates land
  const fetchPackages = async (overrides = {}) => {
    const f = { search, selectedDestination, category, departureDate, onlyDiscounted, minPrice, maxPrice, sort, ...overrides };
    const requestId = ++requestIdRef.current;
    setLoading(true);
    setError('');
    try {
      const params = {};
      if (f.search) params.search = f.search;
      if (f.selectedDestination) params.destinationId = f.selectedDestination;
      if (f.category) params.category = f.category;
      // "From" date: any open departure on or after the chosen day
      if (f.departureDate) params.departureDateFrom = f.departureDate;
      if (f.onlyDiscounted) params.discounted = 'true';
      if (f.minPrice) params.minPrice = f.minPrice;
      if (f.maxPrice) params.maxPrice = f.maxPrice;
      if (f.sort) params.sort = f.sort;

      const res = await packagesApi.getAll(params);
      if (requestId !== requestIdRef.current) return;
      setPackages(res.data || []);
    } catch (err) {
      if (requestId !== requestIdRef.current) return;
      console.error('Failed to load packages:', err);
      setError(getErrorMessage(err, 'Failed to load tour packages.'));
    } finally {
      if (requestId === requestIdRef.current) setLoading(false);
    }
  };

  useEffect(() => {
    fetchPackages();
  }, [selectedDestination, category, departureDate, onlyDiscounted, sort]);

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    fetchPackages();
  };

  const handleResetFilters = () => {
    setSearch('');
    setSelectedDestination('');
    setCategory('');
    setDepartureDate('');
    setTravelers(0);
    setOnlyDiscounted(false);
    setMinPrice('');
    setMaxPrice('');
    setSort('featured');
    if (searchParams.toString()) setSearchParams({}, { replace: true });
    fetchPackages({
      search: '',
      selectedDestination: '',
      category: '',
      departureDate: '',
      onlyDiscounted: false,
      minPrice: '',
      maxPrice: '',
      sort: 'featured',
    });
  };

  const categories = ['All', 'Island Hopping', 'Adventure', 'Beach', 'Heritage', 'Nature'];
  const hasActiveFilters = Boolean(
    search || selectedDestination || category || departureDate || travelers || onlyDiscounted || minPrice || maxPrice
  );
  // Backend has no traveler-count filter: keep packages where a single bookable departure
  // (on/after the chosen date) can seat the whole group
  const visiblePackages = travelers
    ? packages.filter((pkg) =>
        (pkg.openDepartures || []).some(
          (d) =>
            d.remainingSlots >= travelers &&
            !d.isDeadlinePassed &&
            (!departureDate || (d.departureDate || '') >= departureDate)
        )
      )
    : packages;
  // Skeleton only when there are no cards yet; refreshes keep the current cards visible
  const showSkeleton = loading && packages.length === 0;
  const chipFocus = 'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1';

  return (
    <div className="min-h-screen bg-slate-50 py-8 sm:py-12">
      <div className="container mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        {/* Header banner */}
        <div className="relative mb-8 sm:mb-10 overflow-hidden rounded-2xl sm:rounded-3xl bg-gradient-to-r from-emerald-800 via-teal-800 to-slate-900 text-white shadow-2xl shadow-emerald-200/50">
          <img src="/images/island.jpg" alt="" aria-hidden="true" className="absolute inset-0 h-full w-full object-cover opacity-50" loading="lazy" />
          <div className="absolute inset-0 bg-gradient-to-r from-emerald-900/95 via-emerald-900/75 to-transparent" />
          <div className="orb orb-coral right-6 -top-8 h-40 w-40 opacity-40" />
          <div className="relative px-5 py-10 sm:px-10 sm:py-14 max-w-3xl">
            <Badge className="bg-white/15 text-emerald-200 border-white/25 font-semibold mb-3 px-3 py-1">
              Tour Catalog
            </Badge>
            <h1 className="text-3xl sm:text-4xl md:text-5xl font-extrabold font-heading break-words">
              Philippine <span className="text-gradient-warm">Tour Packages</span>
            </h1>
            <p className="mt-3 text-emerald-50/90 text-sm sm:text-base max-w-2xl">
              Multi-day handcrafted itineraries with daily activity schedules, licensed guides, and transparent Philippine Peso pricing.
            </p>
            <div className="mt-5 flex flex-wrap gap-2 text-[11px] font-bold uppercase tracking-wider">
              {['Island Hopping', 'Adventure', 'Heritage', 'Nature'].map((tag) => (
                <span key={tag} className="rounded-full border border-white/25 bg-white/10 px-3 py-1 backdrop-blur-sm">
                  {tag}
                </span>
              ))}
            </div>
          </div>
        </div>

        {/* Filter Controls Toolbar */}
        <div className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-6 shadow-lg shadow-slate-200/50 mb-8 sm:mb-10">
          <form onSubmit={handleSearchSubmit} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
              {/* Keyword Search */}
              <div className="sm:col-span-2 lg:col-span-2 relative">
                <Search className="absolute left-3.5 top-3 h-4 w-4 text-slate-400" />
                <Input
                  type="text"
                  placeholder="Search by package name or activity..."
                  aria-label="Search packages"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-10"
                />
              </div>

              {/* Destination Dropdown */}
              <div>
                <Select
                  value={selectedDestination || 'all'}
                  onValueChange={(v) => setSelectedDestination(v === 'all' ? '' : v)}
                >
                  <SelectTrigger aria-label="Filter by destination" className="font-medium text-slate-700">
                    <SelectValue placeholder="All Destinations" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Destinations</SelectItem>
                    {destinations.map((d) => (
                      <SelectItem key={d.id} value={String(d.id)}>
                        {d.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Departure Date Filter */}
              <div className="relative">
                <Calendar className="absolute left-3 top-3 h-4 w-4 text-slate-400 pointer-events-none" />
                <Input
                  type="date"
                  value={departureDate}
                  onChange={(e) => setDepartureDate(e.target.value)}
                  min={todayInManila()}
                  className="pl-9 text-xs h-10"
                  aria-label="Departure date from"
                  title="Filter tours with available departures from this date"
                />
              </div>

              {/* Sorting */}
              <div>
                <Select value={sort} onValueChange={setSort}>
                  <SelectTrigger aria-label="Sort packages" className="font-medium text-slate-700">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="featured">Featured First</SelectItem>
                    <SelectItem value="price_asc">Price: Low to High</SelectItem>
                    <SelectItem value="price_desc">Price: High to Low</SelectItem>
                    <SelectItem value="duration_asc">Duration: Shortest</SelectItem>
                    <SelectItem value="duration_desc">Duration: Longest</SelectItem>
                    <SelectItem value="name_asc">Name: A to Z</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Category Pills & Price Filter Row */}
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pt-3 border-t border-slate-100">
              {/* Category Pills */}
              <div className="flex flex-wrap items-center gap-1.5">
                {categories.map((cat) => {
                  const isActive = (cat === 'All' && !category) || category === cat;
                  return (
                    <button
                      key={cat}
                      type="button"
                      onClick={() => setCategory(cat === 'All' ? '' : cat)}
                      aria-pressed={isActive}
                      className={`rounded-full px-3 py-1.5 sm:py-1 text-xs font-semibold transition-colors cursor-pointer ${chipFocus} ${
                        isActive
                          ? 'bg-emerald-600 text-white shadow-sm'
                          : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                      }`}
                    >
                      {cat}
                    </button>
                  );
                })}

                {/* Special Direct Discounts Pill */}
                <button
                  type="button"
                  onClick={() => setOnlyDiscounted(!onlyDiscounted)}
                  aria-pressed={onlyDiscounted}
                  className={`rounded-full px-3 py-1.5 sm:py-1 text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 sm:ml-1 ${chipFocus} ${
                    onlyDiscounted
                      ? 'bg-rose-600 text-white shadow-sm ring-2 ring-rose-400'
                      : 'bg-rose-50 text-rose-700 hover:bg-rose-100 border border-rose-200'
                  }`}
                >
                  <Percent className="h-3 w-3" />
                  Special Discounts
                </button>

                {departureDate && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-200 px-2.5 py-0.5 text-xs font-semibold ml-1">
                    <Calendar className="h-3 w-3" />
                    From: {departureDate}
                    <button
                      type="button"
                      onClick={() => setDepartureDate('')}
                      aria-label="Clear departure date filter"
                      className={`ml-1 rounded-full text-emerald-600 hover:text-emerald-950 font-bold ${chipFocus}`}
                    >
                      <span aria-hidden="true">×</span>
                    </button>
                  </span>
                )}

                {travelers > 0 && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-200 px-2.5 py-0.5 text-xs font-semibold ml-1">
                    {travelers} traveler{travelers > 1 ? 's' : ''}
                    <button
                      type="button"
                      onClick={() => {
                        setTravelers(0);
                        const next = new URLSearchParams(searchParams);
                        next.delete('travelers');
                        setSearchParams(next, { replace: true });
                      }}
                      aria-label="Clear traveler count filter"
                      className={`ml-1 rounded-full text-emerald-600 hover:text-emerald-950 font-bold ${chipFocus}`}
                    >
                      <span aria-hidden="true">×</span>
                    </button>
                  </span>
                )}
              </div>

              {/* Price Filter Inputs & Action */}
              <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto">
                <div className="flex min-w-0 flex-1 items-center gap-2 sm:flex-none">
                  <span className="text-xs font-semibold text-slate-400 shrink-0">PHP</span>
                  <Input
                    type="number"
                    placeholder="Min ₱"
                    aria-label="Minimum price"
                    value={minPrice}
                    onChange={(e) => setMinPrice(e.target.value)}
                    className="min-w-0 flex-1 sm:w-24 sm:flex-none h-10 sm:h-9 text-xs"
                  />
                  <span className="text-slate-300 shrink-0">-</span>
                  <Input
                    type="number"
                    placeholder="Max ₱"
                    aria-label="Maximum price"
                    value={maxPrice}
                    onChange={(e) => setMaxPrice(e.target.value)}
                    className="min-w-0 flex-1 sm:w-24 sm:flex-none h-10 sm:h-9 text-xs"
                  />
                </div>
                <div className="flex w-full items-center gap-2 sm:w-auto">
                  <Button type="submit" size="sm" className="h-10 sm:h-9 flex-1 sm:flex-none font-semibold text-xs">
                    Apply
                  </Button>
                  <Button
                    type="button"
                    onClick={handleResetFilters}
                    variant="ghost"
                    size="sm"
                    className="h-10 sm:h-9 flex-1 sm:flex-none text-xs text-slate-500 hover:text-slate-800"
                  >
                    Reset
                  </Button>
                </div>
              </div>
            </div>
          </form>
        </div>

        {/* Packages Grid */}
        {error && (
          <ErrorState className="mb-8" message={error} onRetry={fetchPackages} retrying={loading} />
        )}

        {showSkeleton ? (
          <LoadingRegion label="Loading tour packages" className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 lg:gap-8">
            {Array.from({ length: 6 }).map((_, i) => (
              <PackageCardSkeleton key={i} />
            ))}
          </LoadingRegion>
        ) : visiblePackages.length === 0 ? (
          error ? null : (
            <div className="rounded-2xl border border-slate-200 bg-white">
              {hasActiveFilters ? (
                <EmptyState
                  filtered
                  onClearFilters={handleResetFilters}
                  title="No tour packages match your filters"
                  description="Try relaxing your price range or selecting another destination."
                />
              ) : (
                <EmptyState
                  icon={Calendar}
                  title="No tour packages available yet"
                  description="New itineraries are added regularly. In the meantime, explore our Philippine destinations."
                  action={
                    <Button asChild size="sm">
                      <Link to="/destinations">
                        <Compass className="mr-1.5 h-4 w-4" />
                        Explore Destinations
                      </Link>
                    </Button>
                  }
                />
              )}
            </div>
          )
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 lg:gap-8" aria-busy={loading}>
            {visiblePackages.map((pkg) => (
              <Card
                key={pkg.id}
                className="group card-tilt flex flex-col justify-between overflow-hidden rounded-2xl border-slate-200 bg-white shadow-sm"
              >
                <div>
                  <div className="relative h-48 sm:h-56 lg:h-60 overflow-hidden">
                    <img
                      src={pkg.imageUrls?.[0] || '/images/el-nido.jpg'}
                      alt={pkg.name}
                      className="h-full w-full object-cover group-hover:scale-110 transition-transform duration-700"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-slate-950/60 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                    <div className="absolute top-3 left-3">
                      <Badge className="bg-white/95 text-slate-900 font-bold text-xs backdrop-blur-sm shadow-sm flex items-center gap-1">
                        <Clock className="h-3 w-3 text-emerald-600" />
                        {pkg.durationDays}D / {pkg.durationNights}N
                      </Badge>
                    </div>
                    <div className="absolute top-3 right-3 flex max-w-[60%] flex-wrap items-center justify-end gap-1.5">
                      {pkg.discountPercent > 0 && (
                        <Badge className="bg-rose-600 text-white font-extrabold text-xs shadow-sm px-2 py-0.5">
                          {pkg.discountPercent}% OFF
                        </Badge>
                      )}
                      <Badge className="bg-emerald-600 text-white font-bold text-xs shadow-sm">
                        {pkg.category}
                      </Badge>
                    </div>
                  </div>

                  <CardContent className="p-5 sm:p-6">
                    <div className="flex items-center justify-between gap-2 mb-1">
                      <p className="min-w-0 truncate text-xs font-semibold text-emerald-700 uppercase tracking-wider flex items-center gap-1">
                        <MapPin className="h-3.5 w-3.5 shrink-0" />
                        {pkg.destinationName || 'Philippines'}
                      </p>
                      {pkg.averageRating > 0 ? (
                        <div className="flex shrink-0 items-center gap-1 text-xs font-bold text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full border border-amber-200/50">
                          <Star className="h-3 w-3 fill-amber-400 text-amber-500" />
                          <span>{Number(pkg.averageRating).toFixed(1)}</span>
                          <span className="text-slate-400 font-normal text-[10px]">({pkg.reviewCount || 0})</span>
                        </div>
                      ) : (
                        <span className="shrink-0 text-[10px] text-slate-400 font-medium bg-slate-100 px-2 py-0.5 rounded-full">New</span>
                      )}
                    </div>
                    <h3 className="text-lg sm:text-xl font-bold text-slate-900 font-heading break-words group-hover:text-emerald-700 transition-colors">
                      {pkg.name}
                    </h3>
                    <p className="mt-2 text-xs text-slate-600 line-clamp-2 leading-relaxed">
                      {pkg.description}
                    </p>

                    {/* Schedule availability indicators */}
                    <div className="mt-4 flex flex-wrap items-center justify-between gap-x-3 gap-y-1 rounded-xl bg-slate-50 p-2.5 text-xs text-slate-600">
                      <span className="flex items-center gap-1 font-medium">
                        <Calendar className="h-3.5 w-3.5 text-emerald-600" />
                        {pkg.nextDepartureDate ? `Next: ${formatDate(pkg.nextDepartureDate)}` : 'Upcoming departures'}
                      </span>
                      <span className="font-bold text-emerald-700">
                        {pkg.availableSlots > 0 ? `${pkg.availableSlots} slots left` : 'Fully booked'}
                      </span>
                    </div>
                  </CardContent>
                </div>

                <div className="p-5 sm:p-6 pt-0 sm:pt-0 border-t border-slate-100 mt-4 flex flex-wrap items-center justify-between gap-3">
                  <div className="min-w-0">
                    <span className="text-[10px] text-slate-400 block font-medium">Per traveler</span>
                    {pkg.discountPercent > 0 ? (
                      <div>
                        <span className="text-2xl font-black text-emerald-700 font-heading">
                          {formatCurrency(pkg.effectivePrice || pkg.discountPrice)}
                        </span>
                        <div className="flex flex-wrap items-center gap-1.5 text-xs">
                          <span className="text-slate-400 line-through">
                            {formatCurrency(pkg.pricePerPerson)}
                          </span>
                          <span className="text-[10px] font-bold text-rose-600 bg-rose-50 px-1 rounded">
                            Save {formatCurrency(pkg.pricePerPerson - (pkg.effectivePrice || pkg.discountPrice))}
                          </span>
                        </div>
                      </div>
                    ) : (
                      <span className="text-2xl font-black text-slate-900 font-heading">
                        {formatCurrency(pkg.pricePerPerson)}
                      </span>
                    )}
                  </div>
                  <div className="flex shrink-0 gap-2">
                    <Button asChild size="sm" variant="outline" className="h-10 sm:h-9 font-semibold text-xs">
                      <Link to={`/packages/${pkg.id}`}>Details</Link>
                    </Button>
                    <Button asChild size="sm" className="h-10 sm:h-9 font-bold text-xs shadow-md shadow-emerald-500/20">
                      <Link to={`/packages/${pkg.id}`}>Book Tour</Link>
                    </Button>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
