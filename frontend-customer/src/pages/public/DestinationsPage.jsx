import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { destinationsApi } from '../../api/destinationsApi';
import { Card, CardContent } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Badge } from '../../components/ui/badge';
import { Skeleton } from '../../components/ui/skeleton';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../components/ui/select';
import { EmptyState, ErrorState } from '../../components/common/DataStates';
import { LoadingRegion } from '../../components/common/Skeletons';
import { getErrorMessage } from '../../lib/notify';
import { MapPin, Search, ArrowRight } from 'lucide-react';

const DestinationCardSkeleton = () => (
  <div className="flex flex-col justify-between overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm" aria-hidden="true">
    <div>
      <Skeleton className="h-48 sm:h-56 lg:h-60 w-full rounded-none" />
      <div className="p-5 sm:p-6">
        <Skeleton className="h-3 w-32 mb-2" />
        <Skeleton className="h-6 w-2/3" />
        <Skeleton className="mt-3 h-3 w-full" />
        <Skeleton className="mt-1.5 h-3 w-full" />
        <Skeleton className="mt-1.5 h-3 w-4/5" />
        <div className="mt-4 flex gap-1.5">
          <Skeleton className="h-5 w-16" />
          <Skeleton className="h-5 w-20" />
          <Skeleton className="h-5 w-14" />
        </div>
      </div>
    </div>
    <div className="p-5 sm:p-6 pt-4 sm:pt-4 border-t border-slate-100 mt-4 flex flex-wrap items-center justify-between gap-3">
      <Skeleton className="h-3 w-20" />
      <Skeleton className="h-8 w-32" />
    </div>
  </div>
);

export const DestinationsPage = () => {
  const [destinations, setDestinations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('');
  const [sort, setSort] = useState('');

  const fetchDestinations = async (overrides = {}) => {
    setLoading(true);
    setError('');
    try {
      const params = {};
      const searchTerm = overrides.search ?? search;
      if (searchTerm) params.search = searchTerm;
      if (category) params.category = category;
      if (sort) params.sort = sort;

      const res = await destinationsApi.getAll(params);
      setDestinations(res.data || []);
    } catch (err) {
      console.error('Failed to load destinations:', err);
      setError(getErrorMessage(err, 'Failed to load destinations.'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDestinations();
  }, [category, sort]);

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    fetchDestinations();
  };

  const handleClearFilters = () => {
    setSearch('');
    if (category) {
      // The category effect refetches once the cleared state applies
      setCategory('');
    } else {
      fetchDestinations({ search: '' });
    }
  };

  const categories = ['All', 'Island', 'Beach', 'Heritage', 'Cultural', 'Nature', 'Mountain'];
  const hasActiveFilters = Boolean(search || category);
  // Skeleton only when there are no cards yet; refreshes keep the current cards visible
  const showSkeleton = loading && destinations.length === 0;

  return (
    <div className="min-h-screen bg-slate-50 py-8 sm:py-12">
      <div className="container mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        {/* Header banner */}
        <div className="relative mb-8 sm:mb-10 overflow-hidden rounded-2xl sm:rounded-3xl bg-slate-900 text-white shadow-2xl shadow-slate-300/60">
          <img src="/images/el-nido.jpg" alt="" aria-hidden="true" className="absolute inset-0 h-full w-full object-cover opacity-50" loading="lazy" />
          <div className="absolute inset-0 bg-gradient-to-r from-slate-950 via-slate-900/85 to-slate-900/40" />
          <div className="orb orb-emerald -left-10 -top-12 h-48 w-48 opacity-50" />
          <div className="relative px-5 py-10 sm:px-10 sm:py-14 max-w-3xl">
            <Badge className="bg-emerald-500/25 text-emerald-300 border-emerald-500/30 font-semibold mb-3 px-3 py-1">
              Archipelago Catalog
            </Badge>
            <h1 className="text-3xl sm:text-4xl md:text-5xl font-extrabold font-heading break-words">
              Explore Philippine <span className="text-gradient">Destinations</span>
            </h1>
            <p className="mt-3 text-slate-300 text-sm sm:text-base max-w-2xl">
              Discover tropical archipelagos, coastal sanctuaries, historical towns, and highland ridges across Luzon, Visayas, and Mindanao.
            </p>
            <div className="mt-5 flex flex-wrap gap-2 text-[11px] font-bold uppercase tracking-wider">
              {['Luzon', 'Visayas', 'Mindanao'].map((region) => (
                <span key={region} className="rounded-full border border-white/25 bg-white/10 px-3 py-1 backdrop-blur-sm">
                  {region}
                </span>
              ))}
            </div>
          </div>
        </div>

        {/* Search & Filter Toolbar */}
        <div className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-5 shadow-lg shadow-slate-200/50 mb-8 sm:mb-10 ring-1 ring-white/60">
          <div className="flex flex-col lg:flex-row lg:items-center gap-4 justify-between">
            {/* Search Input */}
            <form onSubmit={handleSearchSubmit} className="relative w-full lg:w-80 xl:w-96 lg:shrink-0">
              <Search className="absolute left-3.5 top-3 h-4 w-4 text-slate-400" />
              <Input
                type="text"
                placeholder="Search destination, island, or region..."
                aria-label="Search destinations"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-10"
              />
            </form>

            {/* Category Filter Pills */}
            <div className="flex flex-wrap items-center gap-2 w-full lg:w-auto lg:flex-1 lg:justify-center">
              {categories.map((cat) => {
                const isActive = (cat === 'All' && !category) || category === cat;
                return (
                  <button
                    key={cat}
                    type="button"
                    onClick={() => setCategory(cat === 'All' ? '' : cat)}
                    aria-pressed={isActive}
                    className={`rounded-full px-3.5 py-1.5 text-xs font-semibold transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 ${
                      isActive
                        ? 'bg-emerald-600 text-white shadow-sm'
                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                    }`}
                  >
                    {cat}
                  </button>
                );
              })}
            </div>

            {/* Sort Select */}
            <div className="flex items-center gap-2 w-full sm:w-auto lg:shrink-0">
              <span id="destinations-sort-label" className="text-xs font-semibold text-slate-400 uppercase tracking-wider shrink-0">
                Sort:
              </span>
              <Select
                value={sort || 'featured'}
                onValueChange={(v) => setSort(v === 'featured' ? '' : v)}
              >
                <SelectTrigger
                  aria-labelledby="destinations-sort-label"
                  className="h-10 sm:h-8 flex-1 sm:flex-none w-auto min-w-[9.5rem] gap-2 px-3 py-1.5 text-xs font-semibold text-slate-700"
                >
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="featured">Featured First</SelectItem>
                  <SelectItem value="name_asc">Name (A-Z)</SelectItem>
                  <SelectItem value="name_desc">Name (Z-A)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>

        {/* Destination Cards Grid */}
        {error && (
          <ErrorState className="mb-8" message={error} onRetry={fetchDestinations} retrying={loading} />
        )}

        {showSkeleton ? (
          <LoadingRegion label="Loading destinations" className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 lg:gap-8">
            {Array.from({ length: 6 }).map((_, i) => (
              <DestinationCardSkeleton key={i} />
            ))}
          </LoadingRegion>
        ) : destinations.length === 0 ? (
          error ? null : (
            <div className="rounded-2xl border border-slate-200 bg-white">
              {hasActiveFilters ? (
                <EmptyState
                  filtered
                  onClearFilters={handleClearFilters}
                  title="No destinations found"
                  description="Try adjusting your search terms or category filters."
                />
              ) : (
                <EmptyState
                  icon={MapPin}
                  title="No destinations available yet"
                  description="Our destination catalog is being prepared. Check back soon or browse our tour packages."
                  action={
                    <Button asChild size="sm">
                      <Link to="/packages">
                        Browse Tour Packages
                        <ArrowRight className="ml-1.5 h-3.5 w-3.5" />
                      </Link>
                    </Button>
                  }
                />
              )}
            </div>
          )
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 lg:gap-8" aria-busy={loading}>
            {destinations.map((dest) => (
              <Card
                key={dest.id}
                className="group card-tilt overflow-hidden rounded-2xl border-slate-200 bg-white shadow-sm flex flex-col justify-between"
              >
                <div>
                  <div className="relative h-48 sm:h-56 lg:h-60 overflow-hidden">
                    <img
                      src={dest.imageUrls?.[0] || '/images/el-nido.jpg'}
                      alt={dest.name}
                      className="h-full w-full object-cover group-hover:scale-110 transition-transform duration-700"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-slate-950/70 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                    <div className="absolute top-3 left-3">
                      <Badge className="bg-emerald-600/90 text-white font-bold text-xs backdrop-blur-sm shadow-md">
                        {dest.category || 'Island'}
                      </Badge>
                    </div>
                    <div className="absolute top-3 right-3 flex h-9 w-9 translate-y-2 items-center justify-center rounded-full bg-white/95 text-emerald-700 opacity-0 shadow-lg transition-all duration-300 group-hover:translate-y-0 group-hover:opacity-100">
                      <ArrowRight className="h-4 w-4 -rotate-45" />
                    </div>
                  </div>

                  <CardContent className="p-5 sm:p-6">
                    <p className="min-w-0 break-words text-xs font-semibold text-emerald-700 uppercase tracking-wider mb-1 flex items-center gap-1">
                      <MapPin className="h-3.5 w-3.5 shrink-0" />
                      {dest.location}
                    </p>
                    <h3 className="text-lg sm:text-xl font-bold text-slate-900 font-heading break-words group-hover:text-emerald-700 transition-colors">
                      {dest.name}
                    </h3>
                    <p className="mt-2 text-xs text-slate-600 line-clamp-3 leading-relaxed">
                      {dest.description}
                    </p>

                    {/* Recommended Activities tags */}
                    {dest.recommendedActivities && dest.recommendedActivities.length > 0 && (
                      <div className="mt-4 flex flex-wrap gap-1.5">
                        {dest.recommendedActivities.slice(0, 3).map((act, i) => (
                          <span
                            key={i}
                            className="rounded-md bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-600"
                          >
                            {act}
                          </span>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </div>

                <div className="p-5 sm:p-6 pt-0 sm:pt-0 border-t border-slate-100 mt-4 flex flex-wrap items-center justify-between gap-3">
                  <span className="min-w-0 text-xs text-slate-500 font-medium">
                    {dest.region || 'Philippines'}
                  </span>
                  <Button asChild size="sm" className="h-10 sm:h-9 bg-slate-900 hover:bg-emerald-600 text-white font-semibold text-xs">
                    <Link to={`/destinations/${dest.id}`}>
                      Explore Details
                      <ArrowRight className="ml-1.5 h-3.5 w-3.5" />
                    </Link>
                  </Button>
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
