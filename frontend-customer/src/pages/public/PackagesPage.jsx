import React, { useState, useEffect } from 'react';
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
import { Search, MapPin, Calendar, Clock, Star, Percent, Compass } from 'lucide-react';

const PackageCardSkeleton = () => (
  <div className="flex flex-col justify-between overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm" aria-hidden="true">
    <div>
      <Skeleton className="h-60 w-full rounded-none" />
      <div className="p-6">
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
    <div className="p-6 pt-4 border-t border-slate-100 mt-4 flex items-center justify-between">
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
  const [searchParams] = useSearchParams();
  const initialSearch = searchParams.get('search') || '';
  const initialDiscounted = searchParams.get('discounted') === 'true';

  const [packages, setPackages] = useState([]);
  const [destinations, setDestinations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Filter States
  const [search, setSearch] = useState(initialSearch);
  const [selectedDestination, setSelectedDestination] = useState('');
  const [category, setCategory] = useState('');
  const [departureDate, setDepartureDate] = useState('');
  const [onlyDiscounted, setOnlyDiscounted] = useState(initialDiscounted);
  const [minPrice, setMinPrice] = useState('');
  const [maxPrice, setMaxPrice] = useState('');
  const [sort, setSort] = useState('featured');

  useEffect(() => {
    // Load destination options for the filter dropdown
    destinationsApi
      .getAll()
      .then((res) => {
        setDestinations(res.data || []);
      })
      .catch((err) => notify.error(err, 'Failed to load destination filters.'));
  }, []);

  const fetchPackages = async () => {
    setLoading(true);
    setError('');
    try {
      const params = {};
      if (search) params.search = search;
      if (selectedDestination) params.destinationId = selectedDestination;
      if (category) params.category = category;
      if (departureDate) params.departureDate = departureDate;
      if (onlyDiscounted) params.discounted = 'true';
      if (minPrice) params.minPrice = minPrice;
      if (maxPrice) params.maxPrice = maxPrice;
      if (sort) params.sort = sort;

      const res = await packagesApi.getAll(params);
      setPackages(res.data || []);
    } catch (err) {
      console.error('Failed to load packages:', err);
      setError(getErrorMessage(err, 'Failed to load tour packages.'));
    } finally {
      setLoading(false);
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
    setOnlyDiscounted(false);
    setMinPrice('');
    setMaxPrice('');
    setSort('featured');
    fetchPackages();
  };

  const categories = ['All', 'Island Hopping', 'Adventure', 'Beach', 'Heritage', 'Nature'];
  const hasActiveFilters = Boolean(
    search || selectedDestination || category || departureDate || onlyDiscounted || minPrice || maxPrice
  );
  // Skeleton only when there are no cards yet; refreshes keep the current cards visible
  const showSkeleton = loading && packages.length === 0;
  const chipFocus = 'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1';

  return (
    <div className="min-h-screen bg-slate-50 py-12">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="max-w-3xl mb-10">
          <Badge className="bg-emerald-100 text-emerald-800 border-none font-semibold mb-2">
            Tour Catalog
          </Badge>
          <h1 className="text-3xl sm:text-4xl md:text-5xl font-extrabold text-slate-900 font-heading">
            Philippine Tour Packages
          </h1>
          <p className="mt-3 text-slate-600 text-base">
            Multi-day handcrafted itineraries with daily activity schedules, licensed guides, and transparent Philippine Peso pricing.
          </p>
        </div>

        {/* Filter Controls Toolbar */}
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm mb-10">
          <form onSubmit={handleSearchSubmit} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
              {/* Keyword Search */}
              <div className="lg:col-span-2 relative">
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
                  min={new Date().toISOString().split('T')[0]}
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
            <div className="flex flex-wrap items-center justify-between gap-4 pt-3 border-t border-slate-100">
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
                      className={`rounded-full px-3 py-1 text-xs font-semibold transition-colors cursor-pointer ${chipFocus} ${
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
                  className={`rounded-full px-3 py-1 text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ml-1 ${chipFocus} ${
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
              </div>

              {/* Price Filter Inputs & Action */}
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold text-slate-400">PHP</span>
                <Input
                  type="number"
                  placeholder="Min ₱"
                  aria-label="Minimum price"
                  value={minPrice}
                  onChange={(e) => setMinPrice(e.target.value)}
                  className="w-24 h-9 text-xs"
                />
                <span className="text-slate-300">-</span>
                <Input
                  type="number"
                  placeholder="Max ₱"
                  aria-label="Maximum price"
                  value={maxPrice}
                  onChange={(e) => setMaxPrice(e.target.value)}
                  className="w-24 h-9 text-xs"
                />
                <Button type="submit" size="sm" className="h-9 font-semibold text-xs">
                  Apply
                </Button>
                <Button
                  type="button"
                  onClick={handleResetFilters}
                  variant="ghost"
                  size="sm"
                  className="h-9 text-xs text-slate-500 hover:text-slate-800"
                >
                  Reset
                </Button>
              </div>
            </div>
          </form>
        </div>

        {/* Packages Grid */}
        {error && (
          <ErrorState className="mb-8" message={error} onRetry={fetchPackages} retrying={loading} />
        )}

        {showSkeleton ? (
          <LoadingRegion label="Loading tour packages" className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {Array.from({ length: 6 }).map((_, i) => (
              <PackageCardSkeleton key={i} />
            ))}
          </LoadingRegion>
        ) : packages.length === 0 ? (
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
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8" aria-busy={loading}>
            {packages.map((pkg) => (
              <Card
                key={pkg.id}
                className="group flex flex-col justify-between overflow-hidden rounded-2xl border-slate-200 bg-white shadow-sm hover:shadow-xl transition-all duration-300 hover:-translate-y-1"
              >
                <div>
                  <div className="relative h-60 overflow-hidden">
                    <img
                      src={pkg.imageUrls?.[0] || 'https://images.unsplash.com/photo-1544735716-392fe2489ffa?auto=format&fit=crop&w=800&q=80'}
                      alt={pkg.name}
                      className="h-full w-full object-cover group-hover:scale-105 transition-transform duration-500"
                    />
                    <div className="absolute top-3 left-3">
                      <Badge className="bg-white/95 text-slate-900 font-bold text-xs backdrop-blur-sm shadow-sm flex items-center gap-1">
                        <Clock className="h-3 w-3 text-emerald-600" />
                        {pkg.durationDays}D / {pkg.durationNights}N
                      </Badge>
                    </div>
                    <div className="absolute top-3 right-3 flex items-center gap-1.5">
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

                  <CardContent className="p-6">
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
                    <h3 className="text-xl font-bold text-slate-900 font-heading group-hover:text-emerald-700 transition-colors">
                      {pkg.name}
                    </h3>
                    <p className="mt-2 text-xs text-slate-600 line-clamp-2 leading-relaxed">
                      {pkg.description}
                    </p>

                    {/* Schedule availability indicators */}
                    <div className="mt-4 flex items-center justify-between rounded-xl bg-slate-50 p-2.5 text-xs text-slate-600">
                      <span className="flex items-center gap-1 font-medium">
                        <Calendar className="h-3.5 w-3.5 text-emerald-600" />
                        {pkg.nextDepartureDate ? `Next: ${formatDate(pkg.nextDepartureDate)}` : 'Upcoming departures'}
                      </span>
                      <span className="font-bold text-emerald-700">
                        {pkg.availableSlots || 15} slots left
                      </span>
                    </div>
                  </CardContent>
                </div>

                <div className="p-6 pt-0 border-t border-slate-100 mt-4 flex items-center justify-between">
                  <div>
                    <span className="text-[10px] text-slate-400 block font-medium">Per traveler</span>
                    {pkg.discountPercent > 0 ? (
                      <div>
                        <span className="text-2xl font-black text-emerald-700 font-heading">
                          {formatCurrency(pkg.effectivePrice || pkg.discountPrice)}
                        </span>
                        <div className="flex items-center gap-1.5 text-xs">
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
                  <div className="flex gap-2">
                    <Button asChild size="sm" variant="outline" className="font-semibold text-xs">
                      <Link to={`/packages/${pkg.id}`}>Details</Link>
                    </Button>
                    <Button asChild size="sm" className="font-bold text-xs shadow-md shadow-emerald-500/20">
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
