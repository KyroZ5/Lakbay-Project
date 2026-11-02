import React, { useState, useEffect } from 'react';
import { adminApi } from '../../api/adminApi';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { Badge } from '../../components/ui/badge';
import { Textarea } from '../../components/ui/textarea';
import { Switch } from '../../components/ui/switch';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../../components/ui/select';
import { Tooltip, TooltipContent, TooltipTrigger } from '../../components/ui/tooltip';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '../../components/ui/dialog';
import {
  Table,
  TableHeader,
  TableRow,
  TableHead,
  TableBody,
  TableCell,
} from '../../components/ui/table';
import { ImageUpload } from '../../components/common/ImageUpload';
import { ConfirmDialog } from '../../components/common/ConfirmDialog';
import { EmptyState, ErrorState } from '../../components/common/DataStates';
import { TableRowsSkeleton } from '../../components/common/Skeletons';
import { FieldError } from '../../components/common/FieldError';
import { notify, getErrorMessage } from '../../lib/notify';
import {
  Plus,
  Search,
  Edit2,
  Trash2,
  MapPin,
  RefreshCw,
  LocateFixed,
  Check,
} from 'lucide-react';

const CATEGORIES = ['Island', 'Beach', 'Mountain', 'Cultural', 'Heritage', 'Nature', 'Urban'];
const REGIONS = ['Luzon', 'Visayas', 'Mindanao', 'MIMAROPA', 'Bicol', 'Cordillera', 'Central Visayas', 'Caraga'];
const ALL_CATEGORIES = 'all';

export const DestinationsManagePage = () => {
  const [destinations, setDestinations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingDestination, setEditingDestination] = useState(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [destinationToDelete, setDestinationToDelete] = useState(null);
  const [togglingId, setTogglingId] = useState(null);

  // Form State
  const [formData, setFormData] = useState({
    name: '',
    country: 'Philippines',
    region: 'Visayas',
    location: '',
    category: 'Island',
    description: '',
    lat: '',
    lng: '',
    recommendedActivities: '',
    imageUrls: '',
    isPublished: true,
    isFeatured: false,
  });
  const [formErrors, setFormErrors] = useState({});
  const [geocodeHint, setGeocodeHint] = useState('');
  const [geocoding, setGeocoding] = useState(false);
  const [saving, setSaving] = useState(false);

  const fetchDestinations = async () => {
    try {
      setLoading(true);
      setError('');
      const res = await adminApi.getDestinations();
      setDestinations(res.data || res || []);
    } catch (err) {
      console.error('[DestinationsManagePage] Fetch error:', err);
      setError(getErrorMessage(err, 'Failed to load destinations.'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDestinations();
  }, []);

  const openCreateModal = () => {
    setEditingDestination(null);
    setFormErrors({});
    setGeocodeHint('');
    setFormData({
      name: '',
      country: 'Philippines',
      region: 'Visayas',
      location: '',
      category: 'Island',
      description: '',
      lat: '',
      lng: '',
      recommendedActivities: '',
      imageUrls: '',
      isPublished: true,
      isFeatured: false,
    });
    setIsModalOpen(true);
  };

  const openEditModal = (dest) => {
    setEditingDestination(dest);
    setFormErrors({});
    setGeocodeHint('');
    setFormData({
      name: dest.name || '',
      country: dest.country || 'Philippines',
      region: dest.region || 'Visayas',
      location: dest.location || '',
      category: dest.category || 'Island',
      description: dest.description || '',
      lat: dest.coordinates?.lat?.toString() || '',
      lng: dest.coordinates?.lng?.toString() || '',
      recommendedActivities: (dest.recommendedActivities || []).join(', '),
      imageUrls: (dest.imageUrls || []).join('\n'),
      isPublished: Boolean(dest.isPublished),
      isFeatured: Boolean(dest.isFeatured),
    });
    setIsModalOpen(true);
  };

  // Geoapify Geocoding
  const handleAutoGeocode = async () => {
    if (geocoding) return;
    if (!formData.name && !formData.location) {
      setGeocodeHint('Please enter at least a Destination Name or Location to auto-geocode.');
      return;
    }
    setGeocodeHint('');
    try {
      setGeocoding(true);
      const query = `${formData.name}, ${formData.location || formData.region}, Philippines`;
      const res = await adminApi.geocodeLocation(query);
      const coords = res.data || res;
      if (coords?.lat && coords?.lng) {
        setFormData((prev) => ({
          ...prev,
          lat: coords.lat.toString(),
          lng: coords.lng.toString(),
        }));
      } else {
        setGeocodeHint('Could not resolve coordinates for this query. You may enter them manually.');
      }
    } catch (err) {
      notify.error(err, 'Geocoding service error. You may enter coordinates manually.');
    } finally {
      setGeocoding(false);
    }
  };

  // Submit Form
  const handleSubmit = async (e) => {
    e.preventDefault();
    if (saving) return;
    if (!formData.name.trim()) {
      setFormErrors({ name: 'Destination name is required.' });
      return;
    }
    setFormErrors({});

    try {
      setSaving(true);
      const payload = {
        name: formData.name.trim(),
        country: formData.country.trim(),
        region: formData.region.trim(),
        location: formData.location.trim(),
        category: formData.category,
        description: formData.description,
        coordinates: {
          lat: parseFloat(formData.lat) || 12.8797,
          lng: parseFloat(formData.lng) || 121.774,
        },
        recommendedActivities: formData.recommendedActivities
          .split(',')
          .map((a) => a.trim())
          .filter(Boolean),
        imageUrls: formData.imageUrls
          .split('\n')
          .map((url) => url.trim())
          .filter(Boolean),
        isPublished: formData.isPublished,
        isFeatured: formData.isFeatured,
      };

      if (editingDestination) {
        await adminApi.updateDestination(editingDestination.id, payload);
        notify.success(`Destination "${payload.name}" updated.`);
      } else {
        await adminApi.createDestination(payload);
        notify.success(`Destination "${payload.name}" created.`);
      }

      setIsModalOpen(false);
      fetchDestinations();
    } catch (err) {
      notify.error(err, 'Failed to save destination.');
    } finally {
      setSaving(false);
    }
  };

  // Quick Toggle Published
  const handleTogglePublish = async (dest) => {
    if (togglingId) return;
    try {
      setTogglingId(dest.id);
      const updated = !dest.isPublished;
      await adminApi.updateDestination(dest.id, { isPublished: updated });
      setDestinations((prev) =>
        prev.map((d) => (d.id === dest.id ? { ...d, isPublished: updated } : d))
      );
      notify.success(updated ? `"${dest.name}" is now published.` : `"${dest.name}" moved to draft.`);
    } catch (err) {
      notify.error(err, 'Failed to update published status.');
    } finally {
      setTogglingId(null);
    }
  };

  // Delete Destination Guard
  const confirmDelete = async () => {
    if (!destinationToDelete) return;
    try {
      setIsDeleting(true);
      await adminApi.deleteDestination(destinationToDelete.id);
      notify.success(`Destination "${destinationToDelete.name}" deleted.`);
      setDestinationToDelete(null);
      fetchDestinations();
    } catch (err) {
      notify.error(err, 'Failed to delete destination.');
    } finally {
      setIsDeleting(false);
    }
  };

  // Filtered List
  const filtered = destinations.filter((dest) => {
    const matchesSearch =
      !search ||
      dest.name?.toLowerCase().includes(search.toLowerCase()) ||
      dest.location?.toLowerCase().includes(search.toLowerCase()) ||
      dest.region?.toLowerCase().includes(search.toLowerCase());
    const matchesCategory = !categoryFilter || dest.category === categoryFilter;
    return matchesSearch && matchesCategory;
  });

  const clearFilters = () => {
    setSearch('');
    setCategoryFilter('');
  };

  // Keep legacy values (not in the preset lists) selectable so editing doesn't blank them out
  const categoryOptions = CATEGORIES.includes(formData.category) || !formData.category
    ? CATEGORIES
    : [...CATEGORIES, formData.category];
  const regionOptions = REGIONS.includes(formData.region) || !formData.region
    ? REGIONS
    : [...REGIONS, formData.region];

  // Skeleton only on initial load; refreshes keep the current rows visible
  const showSkeleton = loading && destinations.length === 0;

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col justify-between gap-4 md:flex-row md:items-center">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">
            Destinations Catalog
          </h1>
          <p className="text-sm text-slate-500 mt-0.5">
            Configure Philippine travel hubs, GPS geo-coordinates, and publication visibility.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Button onClick={openCreateModal} className="font-medium flex items-center gap-1.5 shadow-sm">
            <Plus className="h-4 w-4" />
            Add Destination
          </Button>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="flex flex-col gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm sm:flex-row sm:items-center sm:justify-between">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
          <Input
            placeholder="Search destination, region..."
            aria-label="Search destinations"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 text-sm"
          />
        </div>
        <div className="flex items-center gap-2">
          <Select
            value={categoryFilter || ALL_CATEGORIES}
            onValueChange={(v) => setCategoryFilter(v === ALL_CATEGORIES ? '' : v)}
          >
            <SelectTrigger aria-label="Filter by category" className="w-[180px] text-slate-700">
              <SelectValue placeholder="All Categories" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL_CATEGORIES}>All Categories</SelectItem>
              {CATEGORIES.map((cat) => (
                <SelectItem key={cat} value={cat}>
                  {cat}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                onClick={fetchDestinations}
                disabled={loading}
                aria-label="Refresh destinations"
                className="text-slate-500 hover:text-slate-800"
              >
                <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Refresh</TooltipContent>
          </Tooltip>
        </div>
      </div>

      {/* Error State */}
      {error && <ErrorState message={error} onRetry={fetchDestinations} retrying={loading} />}

      {/* Destinations Table */}
      <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden" aria-busy={loading}>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[80px]">Preview</TableHead>
              <TableHead>Destination Name</TableHead>
              <TableHead>Region & Location</TableHead>
              <TableHead>Category</TableHead>
              <TableHead>Coordinates</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {showSkeleton ? (
              <TableRowsSkeleton
                rows={5}
                columns={['h-10 w-12', 'w-36', 'w-28', 'w-16', 'w-28', 'w-20', 'ml-auto w-16']}
              />
            ) : filtered.length === 0 ? (
              error ? null : (
                <TableRow className="hover:bg-transparent">
                  <TableCell colSpan={7}>
                    {destinations.length > 0 ? (
                      <EmptyState filtered onClearFilters={clearFilters} />
                    ) : (
                      <EmptyState
                        icon={MapPin}
                        title="No destinations yet"
                        description="Add your first destination to start building the travel catalog."
                        action={
                          <Button size="sm" onClick={openCreateModal}>
                            <Plus className="mr-1.5 h-4 w-4" />
                            Add Destination
                          </Button>
                        }
                      />
                    )}
                  </TableCell>
                </TableRow>
              )
            ) : (
              filtered.map((dest) => (
                <TableRow key={dest.id}>
                  <TableCell>
                    {dest.imageUrls?.[0] ? (
                      <img
                        src={dest.imageUrls[0]}
                        alt={dest.name}
                        className="h-10 w-12 rounded object-cover border border-slate-200"
                      />
                    ) : (
                      <div className="flex h-10 w-12 items-center justify-center rounded bg-slate-100 text-slate-400">
                        <MapPin className="h-4 w-4" />
                      </div>
                    )}
                  </TableCell>
                  <TableCell className="font-semibold text-slate-900">
                    <div className="flex items-center gap-2">
                      <span>{dest.name}</span>
                      {dest.isFeatured && (
                        <Badge variant="warning" className="text-[10px] px-1.5 py-0">
                          Featured
                        </Badge>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="text-sm text-slate-600">
                    <div>{dest.region}</div>
                    <div className="text-xs text-slate-400">{dest.location}</div>
                  </TableCell>
                  <TableCell>
                    <Badge variant="secondary" className="text-xs">
                      {dest.category}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-xs font-mono text-slate-500">
                    {dest.coordinates?.lat?.toFixed(4)}, {dest.coordinates?.lng?.toFixed(4)}
                  </TableCell>
                  <TableCell>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <button
                          type="button"
                          onClick={() => handleTogglePublish(dest)}
                          disabled={togglingId === dest.id}
                          aria-label={`${dest.isPublished ? 'Unpublish' : 'Publish'} ${dest.name}`}
                          className="cursor-pointer rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50"
                        >
                          {dest.isPublished ? (
                            <Badge variant="success" className="flex items-center gap-1">
                              <Check className="h-3 w-3" /> Published
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="text-slate-500 border-slate-300">
                              Draft (Hidden)
                            </Badge>
                          )}
                        </button>
                      </TooltipTrigger>
                      <TooltipContent>Click to toggle publish status</TooltipContent>
                    </Tooltip>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-1">
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => openEditModal(dest)}
                            aria-label={`Edit ${dest.name}`}
                            className="h-8 w-8 p-0 text-slate-600 hover:text-emerald-600"
                          >
                            <Edit2 className="h-4 w-4" />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>Edit destination</TooltipContent>
                      </Tooltip>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setDestinationToDelete(dest)}
                            aria-label={`Delete ${dest.name}`}
                            className="h-8 w-8 p-0 text-slate-600 hover:text-red-600"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>Delete destination</TooltipContent>
                      </Tooltip>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Create / Edit Modal Dialog */}
      <Dialog open={isModalOpen} onOpenChange={(open) => !saving && setIsModalOpen(open)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>
              {editingDestination ? 'Edit Destination' : 'Add New Destination'}
            </DialogTitle>
            <DialogDescription>
              Configure destination coordinates, geographical tags, and recommended activities.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSubmit} className="space-y-4 py-2" noValidate>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="dest-name" className="text-xs font-semibold">
                  Destination Name *
                </Label>
                <Input
                  id="dest-name"
                  placeholder="e.g. El Nido, Palawan"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  required
                  aria-invalid={Boolean(formErrors.name)}
                  aria-describedby={formErrors.name ? 'dest-name-error' : undefined}
                />
                <FieldError id="dest-name-error">{formErrors.name}</FieldError>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="dest-category" className="text-xs font-semibold">
                  Category
                </Label>
                <Select
                  value={formData.category}
                  onValueChange={(v) => setFormData({ ...formData, category: v })}
                >
                  <SelectTrigger id="dest-category" className="text-slate-700">
                    <SelectValue placeholder="Select category" />
                  </SelectTrigger>
                  <SelectContent>
                    {categoryOptions.map((c) => (
                      <SelectItem key={c} value={c}>
                        {c}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="dest-region" className="text-xs font-semibold">
                  Region
                </Label>
                <Select
                  value={formData.region}
                  onValueChange={(v) => setFormData({ ...formData, region: v })}
                >
                  <SelectTrigger id="dest-region" className="text-slate-700">
                    <SelectValue placeholder="Select region" />
                  </SelectTrigger>
                  <SelectContent>
                    {regionOptions.map((r) => (
                      <SelectItem key={r} value={r}>
                        {r}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="dest-location" className="text-xs font-semibold">
                  Location Specifics
                </Label>
                <Input
                  id="dest-location"
                  placeholder="e.g. Palawan, Philippines"
                  value={formData.location}
                  onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                />
              </div>
            </div>

            {/* Geoapify Coordinates Section */}
            <div className="rounded-lg border border-slate-200 bg-slate-50/60 p-3 space-y-2">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                  <LocateFixed className="h-3.5 w-3.5 text-emerald-600" />
                  GPS Coordinates (Geoapify Proxy)
                </span>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleAutoGeocode}
                  disabled={geocoding}
                  aria-describedby={geocodeHint ? 'dest-geocode-hint' : undefined}
                  className="h-7 text-xs bg-white text-emerald-700 border-emerald-300 hover:bg-emerald-50"
                >
                  {geocoding && <RefreshCw className="mr-1.5 h-3 w-3 animate-spin" />}
                  {geocoding ? 'Geocoding...' : 'Auto-Detect via Geoapify'}
                </Button>
              </div>
              <FieldError id="dest-geocode-hint">{geocodeHint}</FieldError>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label htmlFor="dest-lat" className="text-[11px] text-slate-500">
                    Latitude
                  </Label>
                  <Input
                    id="dest-lat"
                    type="number"
                    step="any"
                    placeholder="11.1956"
                    value={formData.lat}
                    onChange={(e) => setFormData({ ...formData, lat: e.target.value })}
                  />
                </div>
                <div>
                  <Label htmlFor="dest-lng" className="text-[11px] text-slate-500">
                    Longitude
                  </Label>
                  <Input
                    id="dest-lng"
                    type="number"
                    step="any"
                    placeholder="119.4075"
                    value={formData.lng}
                    onChange={(e) => setFormData({ ...formData, lng: e.target.value })}
                  />
                </div>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="dest-desc" className="text-xs font-semibold">
                Overview & Description
              </Label>
              <Textarea
                id="dest-desc"
                rows={3}
                placeholder="Highlight attractions, natural beauty, cultural history..."
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="dest-activities" className="text-xs font-semibold">
                Recommended Activities (Comma-separated)
              </Label>
              <Input
                id="dest-activities"
                placeholder="Island Hopping, Scuba Diving, Sunset Trekking"
                value={formData.recommendedActivities}
                onChange={(e) =>
                  setFormData({ ...formData, recommendedActivities: e.target.value })
                }
              />
            </div>

            <ImageUpload
              folder="destinations"
              label="Destination Photos (Direct Upload)"
              value={formData.imageUrls}
              onChange={(urls) => setFormData({ ...formData, imageUrls: urls.join('\n') })}
              maxFiles={6}
            />

            {/* Visibility Toggles */}
            <div className="flex flex-wrap items-center gap-6 pt-2">
              <div className="flex items-center gap-2">
                <Switch
                  id="dest-published"
                  checked={formData.isPublished}
                  onCheckedChange={(checked) => setFormData({ ...formData, isPublished: checked })}
                />
                <Label
                  htmlFor="dest-published"
                  className="text-sm font-medium normal-case tracking-normal text-slate-700 cursor-pointer"
                >
                  Published (Visible on Customer Catalog)
                </Label>
              </div>

              <div className="flex items-center gap-2">
                <Switch
                  id="dest-featured"
                  checked={formData.isFeatured}
                  onCheckedChange={(checked) => setFormData({ ...formData, isFeatured: checked })}
                />
                <Label
                  htmlFor="dest-featured"
                  className="text-sm font-medium normal-case tracking-normal text-slate-700 cursor-pointer"
                >
                  Featured on Homepage
                </Label>
              </div>
            </div>

            <DialogFooter className="mt-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsModalOpen(false)}
                disabled={saving}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={saving}>
                {saving && <RefreshCw className="mr-2 h-4 w-4 animate-spin" />}
                {saving ? 'Saving...' : editingDestination ? 'Update Destination' : 'Create Destination'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <ConfirmDialog
        open={Boolean(destinationToDelete)}
        onOpenChange={(open) => !open && setDestinationToDelete(null)}
        title="Delete destination?"
        description={
          <>
            Are you sure you want to permanently delete{' '}
            <strong className="text-slate-800">{destinationToDelete?.name}</strong>? This can't be undone.
          </>
        }
        confirmLabel="Confirm Delete"
        loadingLabel="Deleting..."
        loading={isDeleting}
        onConfirm={confirmDelete}
      >
        <p className="text-xs text-slate-500">
          Note: Lakbay prevents deleting destinations that have existing tour packages assigned to prevent broken reservations.
        </p>
      </ConfirmDialog>
    </div>
  );
};
