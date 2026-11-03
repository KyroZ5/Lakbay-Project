import React, { useState, useEffect } from 'react';
import { useParams, Link, useNavigate, useSearchParams } from 'react-router-dom';
import { packagesApi } from '../../api/packagesApi';
import { bookingsApi } from '../../api/bookingsApi';
import { customerApi } from '../../api/customerApi';
import { reviewsApi } from '../../api/reviewsApi';
import { useAuth } from '../../contexts/AuthContext';
import { ItineraryMap } from '../../components/common/ItineraryMap';
import { WeatherCalendar } from '../../components/common/WeatherCalendar';
import { Button } from '../../components/ui/button';
import { Badge } from '../../components/ui/badge';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { Separator } from '../../components/ui/separator';
import { Textarea } from '../../components/ui/textarea';
import { Checkbox } from '../../components/ui/checkbox';
import { Skeleton } from '../../components/ui/skeleton';
import { ErrorState } from '../../components/common/DataStates';
import { CardSkeleton, LoadingRegion } from '../../components/common/Skeletons';
import { notify, getErrorMessage } from '../../lib/notify';
import { formatCurrency, formatDate } from '../../lib/utils';
import {
  MapPin,
  Clock,
  Shield,
  CheckCircle2,
  XCircle,
  Bus,
  Hotel,
  CreditCard,
  ArrowLeft,
  Loader2,
  AlertCircle,
  Star,
  Percent,
} from 'lucide-react';

const PackageDetailSkeleton = () => (
  <LoadingRegion label="Loading tour package" className="min-h-screen bg-slate-50 py-6 sm:py-10">
    <div className="container mx-auto px-4 sm:px-6 lg:px-8 max-w-7xl" aria-hidden="true">
      <Skeleton className="h-4 w-44 mb-6" />

      {/* Title header + price box */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
        <div className="flex-1">
          <div className="flex flex-wrap items-center gap-2.5 mb-3">
            <Skeleton className="h-5 w-20 rounded-full" />
            <Skeleton className="h-5 w-32 rounded-full" />
            <Skeleton className="h-5 w-16 rounded-full" />
          </div>
          <Skeleton className="h-10 sm:h-12 w-3/4 max-w-xl" />
          <Skeleton className="mt-3 h-4 w-52" />
        </div>
        <Skeleton className="h-16 w-full sm:w-56 rounded-2xl shrink-0" />
      </div>

      {/* Hero image */}
      <Skeleton className="mb-8 lg:mb-12 h-56 sm:h-80 lg:h-[460px] w-full rounded-2xl" />

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-10">
        {/* Main content */}
        <div className="lg:col-span-7 min-w-0 space-y-8 lg:space-y-10">
          <CardSkeleton lines={6} className="rounded-2xl p-5 sm:p-7" />
          <div className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-7 shadow-sm">
            <Skeleton className="h-4 w-24 mb-2 rounded-full" />
            <Skeleton className="h-7 w-full max-w-72 mb-6" />
            <Skeleton className="h-[260px] sm:h-[340px] lg:h-[400px] w-full rounded-xl" />
          </div>
        </div>

        {/* Booking sidebar */}
        <div className="lg:col-span-5 min-w-0">
          <div className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-6 shadow-xl space-y-6">
            <div>
              <Skeleton className="h-3 w-24" />
              <Skeleton className="mt-2 h-7 w-full max-w-60" />
              <Skeleton className="mt-2 h-3 w-full" />
            </div>
            <Skeleton className="h-28 w-full rounded-xl" />
            <div className="flex items-center gap-3">
              <Skeleton className="h-10 w-10" />
              <Skeleton className="h-6 flex-1" />
              <Skeleton className="h-10 w-10" />
            </div>
            <div className="space-y-3">
              <Skeleton className="h-10 w-full" />
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-10 w-full" />
              </div>
              <Skeleton className="h-16 w-full" />
            </div>
            <Skeleton className="h-px w-full" />
            <div className="space-y-2">
              <Skeleton className="h-3 w-full" />
              <Skeleton className="h-3 w-2/3" />
              <Skeleton className="h-7 w-full" />
            </div>
            <Skeleton className="h-12 w-full rounded-xl" />
          </div>
        </div>
      </div>
    </div>
  </LoadingRegion>
);

const ReviewsSkeleton = () => (
  <LoadingRegion label="Loading reviews" className="space-y-4">
    {Array.from({ length: 3 }).map((_, i) => (
      <div key={i} className="p-4 rounded-xl border border-slate-100 bg-slate-50/40" aria-hidden="true">
        <div className="flex items-center justify-between gap-2 mb-2">
          <div className="flex items-center gap-2.5">
            <Skeleton className="h-8 w-8 rounded-full" />
            <div className="space-y-1.5">
              <Skeleton className="h-3 w-28" />
              <Skeleton className="h-2.5 w-20" />
            </div>
          </div>
          <div className="space-y-1.5">
            <Skeleton className="h-3 w-16 ml-auto" />
            <Skeleton className="h-2.5 w-20" />
          </div>
        </div>
        <div className="pl-10 mt-2 space-y-1.5">
          <Skeleton className="h-3 w-full" />
          <Skeleton className="h-3 w-3/4" />
        </div>
      </div>
    ))}
  </LoadingRegion>
);

export const PackageDetailPage = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  // Stripe cancel_url returns here with ?booking_ref=…&status=cancelled
  const cancelledRef = searchParams.get('status') === 'cancelled' ? searchParams.get('booking_ref') : null;
  const { user, profile } = useAuth();

  const [pkg, setPackage] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [activeImageIndex, setActiveImageIndex] = useState(0);

  // Reviews & Rating State
  const [reviewsData, setReviewsData] = useState({
    totalReviews: 0,
    averageRating: 0,
    distribution: { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 },
    reviews: [],
  });
  const [loadingReviews, setLoadingReviews] = useState(true);
  const [reviewsError, setReviewsError] = useState('');

  // Booking Form State
  const [selectedDeparture, setSelectedDeparture] = useState(null);
  const [numberOfTravelers, setNumberOfTravelers] = useState(1);
  const [specialRequests, setSpecialRequests] = useState('');
  const [customerName, setCustomerName] = useState('');
  const [customerEmail, setCustomerEmail] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');

  // Saved Co-Travelers
  const [savedCoTravelers, setSavedCoTravelers] = useState([]);
  const [selectedCoTravelerIds, setSelectedCoTravelerIds] = useState([]);

  // Submission state
  const [submittingBooking, setSubmittingBooking] = useState(false);
  const [bookingError, setBookingError] = useState('');

  const fetchPackageData = async () => {
    setLoading(true);
    setLoadError('');
    try {
      const res = await packagesApi.getById(id);
      const data = res.data;
      setPackage(data);

      // Pre-select first open departure if available (Rule D: unexpired deadline)
      if (data.departures && data.departures.length > 0) {
        const firstOpen = data.departures.find(
          (d) => d.status === 'open' && d.remainingSlots > 0 && !d.isDeadlinePassed
        );
        if (firstOpen) {
          setSelectedDeparture(firstOpen);
        } else {
          setSelectedDeparture(data.departures[0]);
        }
      }
    } catch (err) {
      console.error('Failed to load package details:', err);
      // A 404 falls through to the "Tour Package Not Found" view; anything else is a load failure
      if (err?.status !== 404) {
        setLoadError(getErrorMessage(err, 'Failed to load package details.'));
      }
    } finally {
      setLoading(false);
    }
  };

  const fetchReviews = async () => {
    setLoadingReviews(true);
    setReviewsError('');
    try {
      const res = await reviewsApi.getPackageReviews(id);
      if (res.data) {
        setReviewsData(res.data);
      }
    } catch (err) {
      console.warn('Failed to load package reviews:', err);
      setReviewsError(getErrorMessage(err, 'Failed to load package reviews.'));
    } finally {
      setLoadingReviews(false);
    }
  };

  useEffect(() => {
    // New route id: drop the previous record so the skeleton shows instead of stale content
    setPackage(null);
    fetchPackageData();
    fetchReviews();
  }, [id]);

  // Pre-fill user contact info & fetch saved co-travelers when user is authenticated
  useEffect(() => {
    if (user) {
      setCustomerName(profile?.fullName || user.displayName || '');
      setCustomerEmail(user.email || '');
      setCustomerPhone(profile?.phone || '');

      customerApi
        .getCoTravelers()
        .then((res) => {
          setSavedCoTravelers(res.data || []);
        })
        .catch((err) => console.warn('Co-travelers fetch error:', err));
    }
  }, [user, profile]);

  if (loading && !pkg) {
    return <PackageDetailSkeleton />;
  }

  if (!pkg) {
    if (loadError) {
      return (
        <div className="container mx-auto px-4 py-20 max-w-2xl">
          <ErrorState message={loadError} onRetry={fetchPackageData} retrying={loading} />
          <div className="mt-6 text-center">
            <Button asChild variant="outline">
              <Link to="/packages">Back to Packages</Link>
            </Button>
          </div>
        </div>
      );
    }
    return (
      <div className="container mx-auto px-4 py-20 text-center">
        <h2 className="text-2xl font-bold text-slate-800">Tour Package Not Found</h2>
        <Button asChild variant="outline" className="mt-4">
          <Link to="/packages">Back to Packages</Link>
        </Button>
      </div>
    );
  }

  const images = pkg.imageUrls?.length > 0
    ? pkg.imageUrls
    : ['/images/el-nido.jpg'];

  const originalUnitPrice = Number(pkg.pricePerPerson) || 0;
  const discountPercent = Number(pkg.discountPercent) || 0;
  const unitPrice = (discountPercent > 0 && discountPercent < 100)
    ? (Number(pkg.discountPrice) || Math.round(originalUnitPrice * (1 - discountPercent / 100)))
    : (Number(pkg.effectivePrice) || originalUnitPrice);
  const hasDiscount = discountPercent > 0;
  const totalPrice = unitPrice * numberOfTravelers;
  const originalTotalPrice = originalUnitPrice * numberOfTravelers;
  const totalSavings = originalTotalPrice - totalPrice;

  // Seats the traveler count may not exceed (backend caps a booking at 50 travelers)
  const maxTravelers = Math.max(1, Math.min(50, selectedDeparture?.remainingSlots ?? 10));
  const maxCoTravelers = numberOfTravelers - 1;

  // Change the traveler count and drop selected co-travelers that no longer fit
  const changeTravelers = (next) => {
    setNumberOfTravelers(next);
    setSelectedCoTravelerIds((ids) => ids.slice(0, Math.max(0, next - 1)));
  };

  const handleSelectDeparture = (dep) => {
    setSelectedDeparture(dep);
    const cap = Math.max(1, Math.min(50, dep?.remainingSlots ?? 10));
    if (numberOfTravelers > cap) changeTravelers(cap);
  };

  const handleToggleCoTraveler = (ct) => {
    if (selectedCoTravelerIds.includes(ct.id)) {
      setSelectedCoTravelerIds(selectedCoTravelerIds.filter((cid) => cid !== ct.id));
    } else if (selectedCoTravelerIds.length < maxCoTravelers) {
      setSelectedCoTravelerIds([...selectedCoTravelerIds, ct.id]);
    } else {
      notify.error(`Increase the number of travelers to add more companions (max ${maxCoTravelers}).`);
    }
  };

  const handleBookingSubmit = async (e) => {
    e.preventDefault();
    if (submittingBooking) return;
    setBookingError('');

    if (!user) {
      navigate(`/login?redirect=${encodeURIComponent(window.location.pathname + window.location.search)}`);
      return;
    }

    if (!selectedDeparture) {
      setBookingError('Please select a departure schedule from the calendar or list.');
      return;
    }

    if (selectedDeparture.isDeadlinePassed) {
      setBookingError(
        'Reservations for this departure date are now closed (Rule D booking deadline passed). Please select another departure date.'
      );
      return;
    }

    if (numberOfTravelers > selectedDeparture.remainingSlots) {
      setBookingError(
        `Selected departure only has ${selectedDeparture.remainingSlots} slot(s) remaining.`
      );
      return;
    }

    // Assemble traveler manifest
    const travelerManifest = [
      {
        fullName: customerName,
        relationship: 'Lead Traveler',
        contactPhone: customerPhone,
      },
    ];

    // Add selected co-travelers
    selectedCoTravelerIds.forEach((ctId) => {
      const ct = savedCoTravelers.find((c) => c.id === ctId);
      if (ct && travelerManifest.length < numberOfTravelers) {
        travelerManifest.push({
          fullName: ct.fullName,
          birthDate: ct.birthDate,
          relationship: ct.relationship,
          dietaryOrMedicalNotes: ct.dietaryOrMedicalNotes,
        });
      }
    });

    setSubmittingBooking(true);
    let redirecting = false;

    try {
      const bookingPayload = {
        packageId: pkg.id,
        departureId: selectedDeparture.id,
        numberOfTravelers,
        customerName,
        customerEmail,
        customerPhone,
        specialRequests,
        travelerManifest,
      };

      const res = await bookingsApi.createCheckout(bookingPayload);
      const { checkoutUrl, bookingReference } = res.data;

      if (checkoutUrl) {
        notify.success('Booking created. Redirecting to secure Stripe checkout...');
        // Redirect directly to Stripe Checkout; keep the button disabled while the browser navigates
        redirecting = true;
        window.location.href = checkoutUrl;
      } else {
        notify.success(
          bookingReference ? `Booking ${bookingReference} reserved.` : 'Your booking has been reserved.'
        );
        navigate(`/dashboard/bookings?ref=${bookingReference}&status=reserved`);
      }
    } catch (err) {
      notify.error(err, 'Failed to initialize Stripe checkout. Please try again.');
    } finally {
      if (!redirecting) setSubmittingBooking(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 py-6 sm:py-10">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8 max-w-7xl">
        {/* Navigation Breadcrumb */}
        <Link
          to="/packages"
          className="inline-flex items-center gap-2 text-sm font-semibold text-slate-500 hover:text-emerald-700 mb-6 transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Tour Packages
        </Link>

        {cancelledRef && (
          <div role="status" className="mb-6 flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm font-medium text-amber-900">
            <AlertCircle className="h-5 w-5 shrink-0 mt-0.5" />
            <p className="flex-1 min-w-0 break-words">
              Checkout for booking {cancelledRef} was not completed — no payment was charged. The reserved seats are released automatically when the checkout session expires.
            </p>
            <button
              type="button"
              onClick={() => setSearchParams({}, { replace: true })}
              aria-label="Dismiss message"
              className="rounded-full px-1 font-bold opacity-70 hover:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <span aria-hidden="true">×</span>
            </button>
          </div>
        )}

        {/* Title Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6 sm:mb-8">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2.5 mb-2">
              <Badge className="bg-emerald-600 text-white font-bold text-xs">
                {pkg.category}
              </Badge>
              <Badge variant="outline" className="text-slate-600 bg-white font-semibold text-xs">
                <Clock className="h-3 w-3 mr-1 text-emerald-600 inline" />
                {pkg.durationDays} Days / {pkg.durationNights} Nights
              </Badge>
              <div className="flex items-center gap-1 bg-amber-50 border border-amber-200/80 px-2.5 py-0.5 rounded-full text-xs font-bold text-amber-800">
                <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-500" />
                <span>{Number(reviewsData.averageRating) > 0 ? Number(reviewsData.averageRating).toFixed(1) : (Number(pkg.averageRating) > 0 ? Number(pkg.averageRating).toFixed(1) : 'New')}</span>
                <span className="text-slate-400 font-normal">
                  ({reviewsData.totalReviews || pkg.reviewCount || 0})
                </span>
              </div>
              <span className="text-xs font-semibold text-slate-500">
                Early-Cancellation Cutoff: {pkg.cancellationCutoffDays || 7} Days
              </span>
            </div>

            <h1 className="text-3xl sm:text-4xl md:text-5xl font-extrabold text-slate-900 font-heading break-words">
              {pkg.name}
            </h1>

            <p className="mt-2 text-sm text-slate-600 flex items-center gap-1.5 font-medium">
              <MapPin className="h-4 w-4 shrink-0 text-emerald-600" />
              {pkg.destination?.name || 'Philippines'}, {pkg.destination?.region}
            </p>
          </div>

          <div className="flex flex-col items-start sm:items-end self-start md:self-auto max-w-full bg-white px-4 sm:px-5 py-3 rounded-2xl border border-slate-200 shadow-sm shrink-0">
            {hasDiscount ? (
              <div>
                <div className="flex flex-wrap items-baseline gap-x-2">
                  <span className="text-2xl sm:text-3xl font-black text-emerald-700 font-heading">
                    {formatCurrency(unitPrice)}
                  </span>
                  <span className="text-xs text-slate-400">/ person (PHP)</span>
                </div>
                <div className="flex items-center sm:justify-end gap-2 mt-0.5">
                  <span className="text-xs text-slate-400 line-through">
                    {formatCurrency(originalUnitPrice)}
                  </span>
                  <Badge className="bg-rose-600 text-white font-extrabold text-[10px] px-1.5 py-0">
                    {discountPercent}% OFF
                  </Badge>
                </div>
              </div>
            ) : (
              <div className="flex flex-wrap items-baseline gap-x-2">
                <span className="text-xs text-slate-500 font-semibold uppercase tracking-wider">Price</span>
                <span className="text-2xl sm:text-3xl font-black text-slate-900 font-heading">
                  {formatCurrency(originalUnitPrice)}
                </span>
                <span className="text-xs text-slate-400">/ person (PHP)</span>
              </div>
            )}
          </div>
        </div>

        {/* Hero Image Showcase */}
        <div className="mb-8 lg:mb-12">
          <div className="relative h-56 sm:h-80 lg:h-[460px] w-full overflow-hidden rounded-2xl shadow-lg border border-slate-200">
            <img
              src={images[activeImageIndex]}
              alt={pkg.name}
              className="h-full w-full object-cover transition-all duration-500"
            />
          </div>

          {images.length > 1 && (
            <div className="flex gap-3 mt-4 overflow-x-auto pb-2">
              {images.map((img, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => setActiveImageIndex(i)}
                  aria-label={`Show image ${i + 1} of ${images.length}`}
                  aria-pressed={activeImageIndex === i}
                  className={`relative h-16 w-24 sm:h-20 sm:w-28 shrink-0 overflow-hidden rounded-xl border-2 transition-all cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 ${
                    activeImageIndex === i ? 'border-emerald-600 ring-2 ring-emerald-500/30' : 'border-transparent opacity-70 hover:opacity-100'
                  }`}
                >
                  <img src={img} alt="" className="h-full w-full object-cover" />
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Content Layout Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-10">
          {/* Main Package Information (8 Cols) */}
          <div className="lg:col-span-7 min-w-0 space-y-8 lg:space-y-10">
            {/* Overview */}
            <div className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-7 shadow-sm">
              <h2 className="text-xl sm:text-2xl font-bold text-slate-900 font-heading mb-4">
                Tour Overview
              </h2>
              <p className="text-slate-700 leading-relaxed whitespace-pre-line break-words text-sm sm:text-base">
                {pkg.description}
              </p>

              {/* Inclusions & Exclusions */}
              <div className="mt-8 pt-6 border-t border-slate-100 grid grid-cols-1 sm:grid-cols-2 gap-6">
                <div>
                  <h4 className="font-bold text-slate-900 text-sm uppercase tracking-wider mb-3 flex items-center gap-1.5 text-emerald-800">
                    <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                    Inclusions
                  </h4>
                  <ul className="space-y-2 text-xs text-slate-700">
                    {(pkg.inclusions || []).map((inc, i) => (
                      <li key={i} className="flex items-start gap-2">
                        <span className="text-emerald-500 font-bold">•</span>
                        <span>{inc}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                <div>
                  <h4 className="font-bold text-slate-900 text-sm uppercase tracking-wider mb-3 flex items-center gap-1.5 text-red-800">
                    <XCircle className="h-4 w-4 text-red-500" />
                    Exclusions
                  </h4>
                  <ul className="space-y-2 text-xs text-slate-700">
                    {(pkg.exclusions || []).map((exc, i) => (
                      <li key={i} className="flex items-start gap-2">
                        <span className="text-red-400 font-bold">•</span>
                        <span>{exc}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>

              {/* Lodging & Transportation */}
              <div className="mt-8 pt-6 border-t border-slate-100 grid grid-cols-1 sm:grid-cols-2 gap-4">
                {pkg.accommodationDetails && (
                  <div className="flex items-start gap-3 rounded-xl bg-slate-50 p-4 border border-slate-100">
                    <Hotel className="h-5 w-5 text-emerald-600 shrink-0 mt-0.5" />
                    <div>
                      <h5 className="font-bold text-xs uppercase tracking-wider text-slate-500">Accommodation</h5>
                      <p className="text-xs text-slate-800 mt-0.5">{pkg.accommodationDetails}</p>
                    </div>
                  </div>
                )}
                {pkg.transportDetails && (
                  <div className="flex items-start gap-3 rounded-xl bg-slate-50 p-4 border border-slate-100">
                    <Bus className="h-5 w-5 text-emerald-600 shrink-0 mt-0.5" />
                    <div>
                      <h5 className="font-bold text-xs uppercase tracking-wider text-slate-500">Transportation</h5>
                      <p className="text-xs text-slate-800 mt-0.5">{pkg.transportDetails}</p>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* DAY-BY-DAY ACTIVITY ITINERARY & LEAFLET MAP */}
            <div className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-7 shadow-sm">
              <div className="flex items-center justify-between mb-6">
                <div>
                  <Badge className="bg-emerald-100 text-emerald-800 border-none font-semibold mb-1">
                    Activity Route
                  </Badge>
                  <h2 className="text-xl sm:text-2xl font-bold text-slate-900 font-heading">
                    Day-by-Day Activity Itinerary
                  </h2>
                </div>
              </div>

              {/* Interactive Route Map */}
              <div className="mb-8">
                <ItineraryMap itinerary={pkg.itinerary} height="clamp(260px, 60vw, 400px)" />
                <p className="text-xs text-slate-400 mt-2 text-center">
                  *Click any numbered marker on the map to preview activity details.
                </p>
              </div>

              {/* Day Breakdown List */}
              <div className="space-y-6">
                {(pkg.itinerary || []).map((day) => (
                  <div key={day.dayNumber} className="rounded-xl border border-slate-200 bg-slate-50/50 p-4 sm:p-5">
                    <div className="flex items-center gap-3 mb-3">
                      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-emerald-600 text-white font-bold text-xs">
                        D{day.dayNumber}
                      </span>
                      <h3 className="min-w-0 break-words font-bold text-slate-900 text-base font-heading">
                        {day.dayTitle}
                      </h3>
                    </div>

                    <div className="space-y-3 pl-0 sm:pl-11">
                      {(day.activities || []).map((act, aIdx) => (
                        <div key={aIdx} className="border-l-2 border-emerald-400 pl-3.5 py-1">
                          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                            <span className="shrink-0 text-[11px] font-bold text-emerald-700 bg-emerald-100/80 px-2 py-0.5 rounded">
                              {act.timeSlot}
                            </span>
                            <h4 className="min-w-0 break-words font-bold text-slate-800 text-sm">{act.activityName}</h4>
                          </div>
                          <p className="text-xs text-slate-500 font-medium mt-0.5 flex items-start gap-1 break-words">
                            <MapPin className="h-3 w-3 shrink-0 mt-0.5 text-slate-400" />
                            {act.locationName}
                          </p>
                          {act.description && (
                            <p className="text-xs text-slate-600 mt-1 leading-relaxed">{act.description}</p>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* INTERACTIVE WEATHER DEPARTURE CALENDAR */}
            <div>
              <div className="mb-4">
                <Badge className="bg-emerald-100 text-emerald-800 border-none font-semibold mb-1">
                  Availability & Forecast
                </Badge>
                <h2 className="text-xl sm:text-2xl font-bold text-slate-900 font-heading">
                  Departure & Weather Calendar
                </h2>
                <p className="text-xs text-slate-500 mt-1">
                  Choose your departure date directly from the interactive calendar. Open departures show remaining seats and destination weather forecasts.
                </p>
              </div>

              <WeatherCalendar
                departures={pkg.departures || []}
                destinationCoordinates={pkg.destination?.coordinates}
                selectedDepartureId={selectedDeparture?.id}
                onSelectDeparture={handleSelectDeparture}
              />
            </div>

            {/* CUSTOMER REVIEWS & RATINGS */}
            <div className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-7 shadow-sm">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6 pb-6 border-b border-slate-100">
                <div>
                  <Badge className="bg-emerald-100 text-emerald-800 border-none font-semibold mb-1">
                    Verified Feedback
                  </Badge>
                  <h2 className="text-xl sm:text-2xl font-bold text-slate-900 font-heading">
                    Customer Reviews & Ratings
                  </h2>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Only verified travelers who completed this tour can submit reviews.
                  </p>
                </div>

                {reviewsData.totalReviews > 0 && (
                  <div className="flex items-center gap-3 self-start sm:self-auto bg-amber-50/70 border border-amber-200/60 px-4 py-2.5 rounded-xl shrink-0">
                    <div className="text-center">
                      <div className="text-2xl font-black text-amber-700 font-heading leading-tight">
                        {(Number(reviewsData.averageRating) || 0).toFixed(1)}
                      </div>
                      <div className="flex items-center gap-0.5 mt-0.5">
                        {[1, 2, 3, 4, 5].map((s) => (
                          <Star
                            key={s}
                            className={`h-3 w-3 ${
                              s <= Math.round(reviewsData.averageRating || 0)
                                ? 'fill-amber-400 text-amber-400'
                                : 'text-slate-200'
                            }`}
                          />
                        ))}
                      </div>
                    </div>
                    <div className="text-xs text-slate-500 border-l border-amber-200 pl-3">
                      <span className="font-bold text-slate-800 block">
                        {reviewsData.totalReviews} {reviewsData.totalReviews === 1 ? 'Review' : 'Reviews'}
                      </span>
                      <span className="text-[11px] text-emerald-700 font-medium">100% Verified</span>
                    </div>
                  </div>
                )}
              </div>

              {/* Star Distribution Breakdown */}
              {reviewsData.totalReviews > 0 && (
                <div className="mb-6 p-4 bg-slate-50 rounded-xl space-y-2 border border-slate-100">
                  {[5, 4, 3, 2, 1].map((star) => {
                    const count = reviewsData.distribution?.[star] || 0;
                    const pct = reviewsData.totalReviews > 0 ? (count / reviewsData.totalReviews) * 100 : 0;
                    return (
                      <div key={star} className="flex items-center gap-3 text-xs">
                        <span className="w-12 font-medium text-slate-600 flex items-center gap-1">
                          {star} <Star className="h-3 w-3 fill-amber-400 text-amber-400 inline" />
                        </span>
                        <div className="flex-1 bg-slate-200 rounded-full h-2 overflow-hidden">
                          <div
                            className="bg-amber-400 h-full rounded-full transition-all duration-300"
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                        <span className="w-8 text-right font-medium text-slate-500">{count}</span>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Review List */}
              {loadingReviews && !(reviewsData.reviews?.length > 0) ? (
                <ReviewsSkeleton />
              ) : reviewsError ? (
                <ErrorState
                  title="Unable to load reviews"
                  message={reviewsError}
                  onRetry={fetchReviews}
                  retrying={loadingReviews}
                />
              ) : !(reviewsData.reviews?.length > 0) ? (
                <div className="text-center py-10 bg-slate-50/50 rounded-xl border border-dashed border-slate-200">
                  <Star className="h-8 w-8 text-slate-300 mx-auto mb-2" />
                  <p className="text-sm font-semibold text-slate-700">No customer reviews yet</p>
                  <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
                    Be the first verified traveler to review this tour after completing your departure!
                  </p>
                </div>
              ) : (
                <div className="space-y-4">
                  {reviewsData.reviews.map((rev) => (
                    <div key={rev.id} className="p-4 rounded-xl border border-slate-100 bg-slate-50/40">
                      <div className="flex items-center justify-between gap-2 mb-2">
                        <div className="flex min-w-0 items-center gap-2.5">
                          <div className="h-8 w-8 shrink-0 rounded-full bg-emerald-100 text-emerald-800 font-bold text-xs flex items-center justify-center">
                            {rev.customerName?.charAt(0)?.toUpperCase() || 'T'}
                          </div>
                          <div className="min-w-0">
                            <span className="text-xs font-bold text-slate-800 block truncate">
                              {rev.customerName || 'Verified Traveler'}
                            </span>
                            <span className="text-[10px] text-emerald-700 font-medium flex items-center gap-0.5">
                              <CheckCircle2 className="h-3 w-3" /> Verified Traveler
                            </span>
                          </div>
                        </div>

                        <div className="text-right shrink-0">
                          <div className="flex items-center gap-0.5 justify-end">
                            {[1, 2, 3, 4, 5].map((s) => (
                              <Star
                                key={s}
                                className={`h-3 w-3 ${
                                  s <= rev.rating ? 'fill-amber-400 text-amber-400' : 'text-slate-200'
                                }`}
                              />
                            ))}
                          </div>
                          <span className="text-[10px] text-slate-400 mt-0.5 block">
                            {formatDate(rev.createdAt)}
                          </span>
                        </div>
                      </div>

                      {rev.comment && (
                        <p className="text-xs text-slate-700 leading-relaxed mt-2 pl-0 sm:pl-10 break-words">
                          "{rev.comment}"
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Sticky Booking Form Drawer (5 Cols) */}
          <div className="lg:col-span-5 min-w-0">
            <div className="lg:sticky lg:top-28 rounded-2xl border border-slate-200 bg-white p-5 sm:p-6 shadow-xl space-y-6">
              <div>
                <span className="text-xs font-bold text-emerald-700 uppercase tracking-wider">
                  Book This Tour
                </span>
                <h3 className="text-xl sm:text-2xl font-black text-slate-900 font-heading mt-1">
                  Secure Your Departure
                </h3>
                <p className="text-xs text-slate-500 mt-1">
                  Instant seat locking with Stripe Checkout in Philippine Pesos (PHP).
                </p>
              </div>

              {bookingError && (
                <div role="alert" className="flex items-start gap-2.5 rounded-xl bg-red-50 p-3.5 text-xs text-red-700 border border-red-200">
                  <AlertCircle className="h-4 w-4 shrink-0 text-red-600 mt-0.5" aria-hidden="true" />
                  <span>{bookingError}</span>
                </div>
              )}

              <form onSubmit={handleBookingSubmit} className="space-y-5">
                {/* 1. Selected Departure Indicator */}
                <div>
                  <Label className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5 block">
                    Departure Schedule & Logistics
                  </Label>
                  {selectedDeparture ? (
                    <div className={`rounded-xl border p-3.5 space-y-2.5 ${
                      selectedDeparture.isDeadlinePassed
                        ? 'border-red-200 bg-red-50/50'
                        : 'border-emerald-200 bg-emerald-50/50'
                    }`}>
                      <div className="flex items-center justify-between gap-2">
                        <div className="min-w-0">
                          <p className="text-xs font-bold text-slate-900">
                            {formatDate(selectedDeparture.departureDate)} to {formatDate(selectedDeparture.returnDate)}
                          </p>
                          <p className={`text-[11px] font-semibold ${
                            selectedDeparture.isDeadlinePassed ? 'text-red-700' : 'text-emerald-700'
                          }`}>
                            {selectedDeparture.remainingSlots} slot(s) available
                          </p>
                        </div>
                        <Badge className={
                          selectedDeparture.isDeadlinePassed
                            ? 'shrink-0 bg-red-600 text-white text-[10px]'
                            : 'shrink-0 bg-emerald-600 text-white text-[10px]'
                        }>
                          {selectedDeparture.isDeadlinePassed ? 'Deadline Passed' : 'Selected'}
                        </Badge>
                      </div>

                      {/* Logistics: Assembly Time, Meeting Point & Cutoff */}
                      <div className="pt-2 border-t border-slate-200/60 text-xs space-y-1.5 text-slate-700">
                        <div className="flex items-center gap-1.5">
                          <Clock className="h-3.5 w-3.5 text-emerald-600 shrink-0" />
                          <span>Assembly Time: <strong>{selectedDeparture.departureTime || '07:00 AM'}</strong></span>
                        </div>
                        <div className="flex items-start gap-1.5">
                          <MapPin className="h-3.5 w-3.5 text-emerald-600 shrink-0 mt-0.5" />
                          <span className="leading-snug min-w-0 break-words">
                            Meeting Point: <strong>{selectedDeparture.meetingPoint || 'Designated Harbor / Meeting Terminal'}</strong>
                          </span>
                        </div>
                        <div className="text-[11px] text-slate-500">
                          Cutoff: Closes {selectedDeparture.bookingDeadlineHours !== undefined ? selectedDeparture.bookingDeadlineHours : 24}h prior
                        </div>
                      </div>

                      {/* Rule D Deadline Alert */}
                      {selectedDeparture.isDeadlinePassed && (
                        <div className="rounded-lg bg-red-100 border border-red-200 p-2 text-xs text-red-800 flex items-start gap-1.5 font-medium">
                          <AlertCircle className="h-4 w-4 shrink-0 text-red-600 mt-0.5" />
                          <span>
                            <strong>Reservations Closed (Rule D):</strong> The booking cutoff for this departure has passed. Please select an upcoming departure date on the calendar.
                          </span>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800">
                      Please pick an open departure date on the calendar above.
                    </div>
                  )}
                </div>

                {/* 2. Number of Travelers */}
                <div>
                  <div className="flex justify-between items-center gap-2 mb-1.5">
                    <Label id="travelers-count-label" className="text-xs font-bold uppercase tracking-wider text-slate-500">
                      Number of Travelers
                    </Label>
                    <span className="text-xs text-slate-500 font-medium">
                      Max: {maxTravelers}
                    </span>
                  </div>
                  <div className="flex items-center gap-3" role="group" aria-labelledby="travelers-count-label">
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      onClick={() => changeTravelers(Math.max(1, numberOfTravelers - 1))}
                      aria-label="Decrease number of travelers"
                      className="h-11 w-11 sm:h-10 sm:w-10 bg-slate-50 font-bold text-slate-700 shadow-none"
                    >
                      -
                    </Button>
                    <div className="flex-1 text-center font-black text-lg text-slate-900" aria-live="polite">
                      {numberOfTravelers}
                    </div>
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      onClick={() =>
                        changeTravelers(
                          Math.min(maxTravelers, numberOfTravelers + 1)
                        )
                      }
                      aria-label="Increase number of travelers"
                      className="h-11 w-11 sm:h-10 sm:w-10 bg-slate-50 font-bold text-slate-700 shadow-none"
                    >
                      +
                    </Button>
                  </div>
                </div>

                {/* 3. Saved Co-Travelers Quick Selector (If user logged in and has saved companions) */}
                {user && savedCoTravelers.length > 0 && numberOfTravelers > 1 && (
                  <div className="rounded-xl bg-slate-50 p-3.5 border border-slate-100">
                    <Label className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-2 block">
                      Saved Co-Travelers ({selectedCoTravelerIds.length}/{numberOfTravelers - 1})
                    </Label>
                    <div className="space-y-1.5">
                      {savedCoTravelers.map((ct) => (
                        <div key={ct.id} className="flex items-center gap-2 min-h-8">
                          <Checkbox
                            id={`cotraveler-${ct.id}`}
                            checked={selectedCoTravelerIds.includes(ct.id)}
                            onCheckedChange={() => handleToggleCoTraveler(ct)}
                          />
                          <label
                            htmlFor={`cotraveler-${ct.id}`}
                            className="flex min-w-0 flex-wrap items-center gap-x-2 text-xs text-slate-700 cursor-pointer hover:text-slate-900"
                          >
                            <span className="font-semibold break-words">{ct.fullName}</span>
                            <span className="text-slate-400">({ct.relationship})</span>
                          </label>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* 4. Contact Details */}
                <div className="space-y-3">
                  <div>
                    <Label htmlFor="booking-name" className="text-xs font-semibold text-slate-600">
                      Lead Traveler Full Name <span className="text-red-600" aria-hidden="true">*</span>
                    </Label>
                    <Input
                      id="booking-name"
                      type="text"
                      required
                      placeholder="Juan Dela Cruz"
                      value={customerName}
                      onChange={(e) => setCustomerName(e.target.value)}
                      className="mt-1"
                    />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    <div className="min-w-0">
                      <Label htmlFor="booking-email" className="text-xs font-semibold text-slate-600">
                        Email Address <span className="text-red-600" aria-hidden="true">*</span>
                      </Label>
                      <Input
                        id="booking-email"
                        type="email"
                        required
                        placeholder="juan@email.com"
                        value={customerEmail}
                        onChange={(e) => setCustomerEmail(e.target.value)}
                        className="mt-1 text-xs"
                      />
                    </div>
                    <div className="min-w-0">
                      <Label htmlFor="booking-phone" className="text-xs font-semibold text-slate-600">
                        Phone Number <span className="text-red-600" aria-hidden="true">*</span>
                      </Label>
                      <Input
                        id="booking-phone"
                        type="tel"
                        required
                        placeholder="+63 917 123 4567"
                        value={customerPhone}
                        onChange={(e) => setCustomerPhone(e.target.value)}
                        className="mt-1 text-xs"
                      />
                    </div>
                  </div>

                  <div>
                    <Label htmlFor="booking-requests" className="text-xs font-semibold text-slate-600">Special Requests / Dietary</Label>
                    <Textarea
                      id="booking-requests"
                      rows={2}
                      placeholder="Vegetarian meal, airport pick-up notes, etc."
                      value={specialRequests}
                      onChange={(e) => setSpecialRequests(e.target.value)}
                      className="mt-1 min-h-0 p-2.5 text-xs text-slate-800"
                    />
                  </div>
                </div>

                <Separator />

                {/* 5. Pricing Breakdown */}
                <div className="space-y-2 text-xs">
                  {hasDiscount ? (
                    <>
                      <div className="flex justify-between gap-3 text-slate-500">
                        <span>
                          Standard Rate: {formatCurrency(originalUnitPrice)} × {numberOfTravelers}
                        </span>
                        <span className="line-through shrink-0">{formatCurrency(originalTotalPrice)}</span>
                      </div>
                      <div className="flex justify-between gap-3 text-emerald-700 font-bold bg-emerald-50 px-2.5 py-1.5 rounded-lg border border-emerald-200/60">
                        <span className="flex items-center gap-1">
                          <Percent className="h-3.5 w-3.5" />
                          Direct Discount ({discountPercent}% OFF)
                        </span>
                        <span className="shrink-0">- {formatCurrency(totalSavings)}</span>
                      </div>
                      <div className="flex justify-between gap-3 text-slate-700 font-medium pt-0.5">
                        <span>
                          Discounted Rate: {formatCurrency(unitPrice)} × {numberOfTravelers}
                        </span>
                        <span className="shrink-0 font-bold text-slate-900">{formatCurrency(totalPrice)}</span>
                      </div>
                    </>
                  ) : (
                    <div className="flex justify-between gap-3 text-slate-600">
                      <span>
                        {formatCurrency(originalUnitPrice)} × {numberOfTravelers} traveler(s)
                      </span>
                      <span className="shrink-0 font-bold text-slate-900">{formatCurrency(totalPrice)}</span>
                    </div>
                  )}
                  <div className="flex justify-between gap-3 text-slate-500">
                    <span>Environmental & Permit Fees</span>
                    <span className="text-emerald-700 font-semibold">Included</span>
                  </div>
                  <div className="flex flex-wrap items-baseline justify-between gap-x-3 pt-2 border-t border-slate-100 text-sm">
                    <span className="font-bold text-slate-900">Total Price (PHP)</span>
                    <span className="text-xl sm:text-2xl font-black text-slate-900 font-heading">
                      {formatCurrency(totalPrice)}
                    </span>
                  </div>
                </div>

                {/* 6. Checkout CTA */}
                <Button
                  type="submit"
                  disabled={submittingBooking || !selectedDeparture || selectedDeparture.status !== 'open' || selectedDeparture.isDeadlinePassed || selectedDeparture.remainingSlots <= 0}
                  className="w-full h-auto min-h-12 py-3 whitespace-normal text-center font-bold text-sm sm:text-base rounded-xl shadow-lg shadow-emerald-600/30 flex items-center justify-center gap-2 disabled:bg-slate-300 disabled:shadow-none"
                >
                  {submittingBooking ? (
                    <>
                      <Loader2 className="h-5 w-5 animate-spin" />
                      Redirecting to Stripe...
                    </>
                  ) : selectedDeparture?.isDeadlinePassed ? (
                    'Booking Closed (Deadline Passed)'
                  ) : (
                    <>
                      <CreditCard className="h-5 w-5" />
                      {user ? 'Pay & Book via Stripe' : 'Log in to Complete Booking'}
                    </>
                  )}
                </Button>

                {/* Trust Badges */}
                <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1 text-center text-[11px] text-slate-400 pt-1">
                  <span className="flex items-center gap-1">
                    <Shield className="h-3.5 w-3.5 shrink-0 text-emerald-600" />
                    Stripe 256-bit Encryption
                  </span>
                  <span className="hidden sm:inline" aria-hidden="true">•</span>
                  <span>Free cancellation until {pkg.cancellationCutoffDays || 7} days prior</span>
                </div>
              </form>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
