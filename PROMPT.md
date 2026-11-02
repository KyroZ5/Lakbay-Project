PROJECT PROMPT: TOUR AND TRAVEL BOOKING PLATFORM
Project Overview
Create a complete, responsive Tour and Travel Booking Platform priced in Philippine pesos (PHP). The platform must allow customers to explore travel destinations, browse multi-day tour packages with daily activity itineraries, check destination weather and interactive maps, book scheduled departures, and pay online via Stripe. It must also provide a dedicated internal portal for staff and administrators to manage website content, destinations, tour packages, schedules, bookings, refunds, accounts, and reports. Plan it first and you may ask me anything for confirmation if necessary before proceeding.

Architect the system as three separate, containerized applications in standalone root folders:
/customer-web: Public website and authenticated Customer Dashboard.
/admin-portal: Internal backoffice application for staff and administrators.
/api-server: Node.js and Express REST API backend handling all database transactions, role validation, Stripe payments, and external API requests.
All forms, buttons, navigation links, database operations, search functions, filters, and CRUD operations must be fully functional and connected to Firebase and the backend API rather than static mock data.

2. Required Technologies
   Use JavaScript and JSX (.js and .jsx) instead of TypeScript across all folders. Keep the code readable, organized, beginner-friendly, and easy to maintain.

Frontend Applications (/customer-web and /admin-portal):
React JS with functional components and hooks.
Vite for project setup and development.
Tailwind CSS and shadcn/ui (configured for JavaScript with "tsx": false in components.json) for the user interface.
Lucide React (lucide-react) for icons.
React Router DOM for navigation.
React Context API for shared authentication state.
Firebase Authentication Client SDK (firebase/auth) for login, registration, logout, password reset, and ID token retrieval.
Axios for HTTP requests to /api-server.
Backend Application (/api-server):
Node.js and Express.js.
Firebase Admin SDK (firebase-admin) for Cloud Firestore database management, Firebase Storage access, and Firebase Authentication account/role administration.
Stripe Node SDK (stripe) for Checkout sessions, webhook processing, and automated refunds.
Containerization:
Docker (Dockerfile and nginx.conf per frontend, Dockerfile for backend) and a root docker-compose.yml. 3. User Roles and Permissions
A. Customer (/customer-web)
Browse the homepage, destinations, tour packages, interactive maps, and weather forecasts without logging in.
Search and filter tour packages by destination, price, duration, category, and departure date.
View package details, day-by-day activity itineraries, and available schedules on the interactive calendar.
Register, log in, log out, and reset a forgotten password.
Manage profile details, change password, and save Co-Traveler companion profiles for checkout auto-fill.
Select a departure schedule and number of travelers, submit a booking, and pay via Stripe Checkout.
View booking history, booking details, booking references, payment statuses, and notifications.
Cancel eligible bookings: cancellations requested on or before the package's early-cancellation cutoff automatically trigger a Stripe refund and release the reserved seats.
Customers may only access their own data and bookings and must be blocked from /admin-portal and administrative API routes.
B. Tour Coordinator (/admin-portal)
Create, edit, publish, unpublish, and archive destinations.
Create, edit, publish, unpublish, and archive tour packages and daily geo-tagged activity itineraries.
Create and manage departure schedules, set tour prices and passenger capacities, and assign a Tour Guide to each departure.
Manage homepage featured destinations, featured packages, promotions, and FAQs.
C. Support Agent (/admin-portal)
View all bookings, customer contact details, and booking histories.
Confirm, reject, update permitted booking fields, reschedule departure dates, and add internal administrative notes.
Review special requests and process approved exception cancellations and refunds.
D. Tour Guide (/admin-portal)
View assigned departure schedules and daily activity itinerary maps.
View the passenger manifest (traveler names, headcount, phone numbers, special requests) for assigned departures.
Check live destination weather, mark passengers as checked in, and mark completed departures as Completed.
E. Admin (/admin-portal)
Full access to all Tour Coordinator, Support Agent, and Tour Guide modules.
View the overall business dashboard, booking statistics, and collected revenue reports, and export reports to CSV.
Create and manage staff accounts (coordinator, support, guide, admin) and assign roles using Firebase Admin SDK.
Manage customer account statuses (deactivate or reactivate via Firebase Authentication).
Configure global cancellation policies, basic website settings, and view system activity logs. 4. Authentication and Account Management
A. Customer Authentication (/customer-web)
Registration Page: Full name, Email address, Phone number, Password, Confirm password, Terms and conditions checkbox, Create Account button, and Link to Login. Validate all fields before submission. Create a corresponding Firestore document in users with the customer role. Public registration must never allow selecting a staff or admin role.
Login Page: Email address, Password, Show/hide password toggle, Forgot password link, Login button, and Link to registration. Display clear error messages for invalid credentials, network errors, disabled accounts, and missing profiles.
Account Management (/profile): Update full name, phone number, emergency contact, email address, and password. Provide a CRUD interface for Saved Co-Travelers (Full name, Birthdate, Relationship, Medical/Dietary notes) and an option to deactivate the account if no active bookings exist.
B. Staff & Admin Authentication (/admin-portal)
Staff Login Page: Email and password login with no public registration link. Verify the user's role upon login; reject and sign out any account with the customer role.
Route & API Protection: Keep authentication state synchronized with onAuthStateChanged. Show a loading screen during initialization. Verify Firebase ID tokens and role permissions on every protected /api-server endpoint using Firebase Admin SDK middleware. 5. Customer Web Application (/customer-web) — Public Pages
A. Homepage
Navigation Bar: Logo, agency name, Home, Destinations, Tour Packages, About Us, Contact Us, Login, and Register. When logged in, display an account menu with My Dashboard, My Bookings, My Profile, and Logout. Include a responsive mobile navigation sheet.
Main Hero Section: Travel background image with dark overlay, headline "Discover Your Next Adventure.", supporting description, Geoapify-powered destination autocomplete search input, optional departure date and traveler count, Search Tours button, and Explore Destinations button.
Featured Destinations: Image cards showing Destination image, Destination name, Location, Short description, and Explore button.
Popular Tour Packages: Cards displaying Package image, Package name, Destination, Duration, Price per person in PHP, Available departure date, View Details button, and Book Now button for published packages.
Why Choose Us: Sections for Easy booking, Carefully selected destinations, Transparent pricing, Customer support, and Convenient trip planning.
Special Offers: Active promotional packages or discounts configured by staff, excluding expired promotions.
How It Works: Step-by-step summary: 1. Explore destinations, 2. Select a tour package, 3. Choose a departure schedule, 4. Submit a booking and payment, 5. Receive booking confirmation and travel details.
Testimonials: Customer reviews, with sample reviews clearly labeled if used.
Frequently Asked Questions: Answers covering booking, Stripe payments, cancellation cutoffs, schedules, and travel requirements.
Footer: Contact information, navigation links, social media links, privacy policy, terms and conditions, and cancellation policy.
B. Destinations Page & Destination Details Page
Destinations Page: Responsive card grid of published destinations showing Destination name, Country or region, Location, Description, Image, Related tour packages, and Explore Details button, with search, filtering, and sorting.
Destination Details Page: Image gallery, Destination name, Description, Travel information, Recommended activities, Related tour packages, Available schedules, Interactive Leaflet Map, and Current Weather Card.
C. Tour Packages Page & Tour Package Details Page
Tour Packages Page: Responsive cards showing Image, Package name, Destination, Description, Duration in days and nights, Price per person, Available departure dates, Remaining slots, View Details button, and Book Now button. Include search, sorting (price, duration, name), and filters (Destination, Price range, Duration, Category, Departure date, Availability).
Tour Package Details Page:
Display Package name, Image gallery, Destination, Description, Duration, Price per person, Inclusions, Exclusions, Accommodation details, Transportation details, Remaining capacity, Cancellation policy, and Travel reminders.
Day-by-Day Activity Itinerary & Map: Display each day's title and specific activity stops (timeSlot, activityName, locationName, description) and plot the activity coordinates on the interactive Leaflet map.
Interactive Departure & Weather Calendar: Display a monthly calendar highlighting open departure dates, remaining seat counts, and OpenWeather forecast icons/temperatures for dates within the forecast window (or current destination weather for distant dates).
Booking Form: Selected departure schedule, Number of travelers (with Saved Co-Travelers selector), Customer contact information, Special requests, Price per person, and Total price (Total Price = Price Per Person * Number of Travelers). Submitting initiates a Stripe Checkout session via /api-server. 6. Customer Web Application (/customer-web) — Customer Dashboard
Overview: Total bookings, Pending bookings, Confirmed bookings, Upcoming trips, and Recent booking activity.
My Bookings: Filterable list/table with Booking reference, Package name, Destination, Departure date, Number of travelers, Total amount, Booking status, Payment status, Booking date, View Details button, and Cancel Booking button.
Booking Details: Full booking details, daily activity itinerary, price breakdown, payment status, cancellation policy, and booking history.
My Profile: Profile form, password update, and Saved Co-Travelers management.
Notifications: Alerts for Booking submitted, Booking confirmed, Booking rejected, Booking cancelled/refunded, Payment verified, and Departure schedule updated. 7. Staff & Admin Portal (/admin-portal)
Create a separate backoffice interface with a sidebar, top navigation bar, responsive content area, and user profile menu. Restrict sidebar modules by role:

A. Dashboard Overview (admin): Statistic cards (Total customers, Total destinations, Total tour packages, Total bookings, Pending bookings, Confirmed bookings, Upcoming departures, Recorded revenue) and charts (Bookings by month, Booking statuses, Popular destinations, Popular tour packages, Recorded revenue over time) calculated from Firestore data. Exclude cancelled and unpaid bookings from collected revenue.
B. Tour Package Management (coordinator, admin): Table with Package image, Package name, Destination, Duration, Price, Publication status, Available departures, and Actions (Add, View, Edit, Publish, Unpublish, Archive, Delete when safe). Include a daily activity builder using Geoapify to attach coordinates to each activity stop. Preserve historical booking prices when editing packages.
C. Destination Management (coordinator, admin): Searchable table to Add, Edit, View, Publish/unpublish, Feature on homepage, Archive, and safely Delete destinations. Prevent deleting destinations referenced by active packages or historical records.
D. Departure Schedule Management (coordinator, admin): Manage departures (packageId, departureDate, returnDate, capacity, bookedCount, assignedGuideId, status), open or close bookings, and cancel departures safely. Prevent reducing capacity below already confirmed reservations.
E. Promotions and Homepage Content (coordinator, admin): Manage featured destinations, featured packages, promotional banners, special offers with start/end dates, FAQs, and agency contact information.
F. Booking Management (support, admin): Searchable, filterable, paginated table showing Booking reference, Customer name, Tour package, Departure date, Number of travelers, Total price, Booking status (Pending, Confirmed, Rejected, Cancelled, Completed), Payment status (Unpaid, Paid, Refunded), Booking date, and Actions. Support viewing details, confirming, rejecting, cancelling, rescheduling, and adding internal notes.
G. Payment & Refund Management (support, admin): Display payment reference, booking reference, customer, amount, payment method, payment status, and timestamps, with support for initiating Stripe refunds on approved exception cancellations.
H. Tour Guide Manifest (guide, admin): Display departures assigned to the logged-in guide, passenger manifest details, destination weather, passenger check-in toggles, and a button to mark completed trips as Completed.
I. Customer & Staff Management (admin, customer view for support): Search and filter customers, view booking histories, deactivate/reactivate customer accounts via Firebase Auth, and create/manage staff accounts and roles. Never expose user passwords.
J. Reports and Analytics (admin): Date-filtered reports with CSV export for total bookings, bookings by status, popular packages/destinations, number of travelers, confirmed/cancelled bookings, and collected revenue.
K. Activity Logs (admin): Audit log recording actorUid, actorRole, action, targetType, targetId, metadata, and createdAt for package/destination edits, booking changes, refunds, account status changes, and settings updates. 8. Firestore Database Schema
users (Doc ID: UID): uid, fullName, email, phone, emergencyContact, role (customer | coordinator | support | guide | admin), accountStatus, createdAt, updatedAt.
coTravelers: userId, fullName, birthDate, relationship, dietaryOrMedicalNotes, createdAt.
destinations: name, country, region, location, coordinates ({ lat, lng }), description, recommendedActivities, imageUrls, category, isPublished, isFeatured, createdAt, updatedAt.

tourPackages: name, destinationId, description, category, pricePerPerson, durationDays, durationNights, cancellationCutoffDays, itinerary (Array of { dayNumber, dayTitle, activities: [{ timeSlot, activityName, locationName, coordinates: { lat, lng }, description }] }), inclusions, exclusions, accommodationDetails, transportDetails, imageUrls, isPublished, isFeatured, createdAt, updatedAt.
departures: packageId, departureDate, returnDate, capacity, bookedCount, assignedGuideId, status, createdAt, updatedAt.
bookings: bookingReference, customerId, packageId, departureId, customerName, customerEmail, customerPhone, numberOfTravelers, travelerManifest, pricePerPerson, totalPrice, bookingStatus, paymentStatus, specialRequests, createdAt, updatedAt.
payments: bookingId, customerId, amount, paymentMethod, referenceNumber (Stripe PaymentIntent ID), stripeSessionId, stripeRefundId, paymentStatus, createdAt, refundedAt.
notifications: userId, title, message, type, isRead, relatedBookingId, createdAt.
promotions: title, description, imageUrl, discountType, discountValue, startDate, endDate, isActive, createdAt, updatedAt.
activityLogs: actorUid, actorRole, action, targetType, targetId, metadata, createdAt. 9. Booking, Stripe Payment & Early-Cancellation Logic
All booking and payment operations must execute in /api-server:

Checkout Creation (POST /api/bookings/checkout): Verify customer authentication, published package status, future open departure date, and traveler count. Run a Firestore transaction to verify bookedCount + numberOfTravelers <= capacity, calculate totalPrice = pricePerPerson * numberOfTravelers from database values, reserve the seats, create the Pending / Unpaid booking with a unique bookingReference, and return a Stripe Checkout Session URL in PHP.
Webhook Handling (POST /api/webhooks/stripe): Verify the Stripe webhook signature. On checkout.session.completed, mark the booking Confirmed and Paid, create the payments record, and send a customer notification. On checkout.session.expired, decrement bookedCount in a transaction to release the reserved seats and mark the booking Cancelled.
Early-Cancellation Auto-Refund (POST /api/bookings/:id/cancel): If the customer cancels when the remaining time before departureDate is greater than or equal to cancellationCutoffDays (e.g., 7 days), automatically execute stripe.refunds.create(), decrement bookedCount on the departure document, update statuses to Cancelled and Refunded, and notify the customer. If past the cutoff window, log a cancellation request for Support Agent review. 10. External API Integrations
Integrate four external services via /api-server and frontend components:

Stripe API: Online checkout sessions, webhook fulfillment, and automated refunds.
Destination Search & Location API (Geoapify): Debounced destination search in the homepage hero and coordinate lookup for destinations and daily itinerary activities. Handle empty results, network errors, and rate limits gracefully.
Interactive Map API (Leaflet + OpenStreetMap): Responsive maps with markers and attribution on Destination Details pages and daily activity route maps on Tour Package Details pages. Handle missing coordinates gracefully.
Weather API (OpenWeather): Server-cached weather lookups using destination coordinates to display current weather on Destination Details pages and daily weather forecast badges on the Interactive Departure Calendar. Never block browsing or booking if the weather service is unavailable. 11. Repository Structure
Plaintext

tour-booking-platform/
├── docker-compose.yml
├── firestore.rules
├── storage.rules
├── README.md
├── api-server/
│ ├── Dockerfile
│ ├── package.json
│ ├── .env.example
│ └── src/
│ ├── config/ # firebaseAdmin.js, stripe.js
│ ├── middlewares/ # authMiddleware.js, roleMiddleware.js
│ ├── controllers/
│ ├── routes/ # auth, destinations, packages, departures, bookings, webhooks, external, admin
│ ├── services/ # locationService.js, weatherService.js
│ └── server.js
├── customer-web/
│ ├── Dockerfile
│ ├── nginx.conf
│ ├── package.json
│ ├── components.json
│ ├── .env.example
│ └── src/
│ ├── api/
│ ├── components/ # ui/, common/ (DestinationMap.jsx, WeatherCalendar.jsx), layout/
│ ├── contexts/ # AuthContext.jsx
│ ├── firebase/ # firebase.js
│ ├── pages/ # public/, auth/, customer/
│ ├── routes/ # AppRoutes.jsx, ProtectedRoute.jsx
│ ├── App.jsx
│ └── main.jsx
└── admin-portal/
├── Dockerfile
├── nginx.conf
├── package.json
├── components.json
├── .env.example
└── src/
├── api/
├── components/ # ui/, layout/ (AdminSidebar.jsx, Topbar.jsx)
├── contexts/ # StaffAuthContext.jsx
├── firebase/ # firebase.js
├── pages/ # auth/, dashboard/, catalog/, operations/, administration/
├── routes/ # AdminRoutes.jsx, RoleRoute.jsx
├── App.jsx
└── main.jsx 12. Containerization Requirements
/api-server/Dockerfile: Build on node:20-alpine, install production dependencies, expose port 5000, and run as a non-root user.
/customer-web/Dockerfile & /admin-portal/Dockerfile: Multi-stage builds (node:20-alpine build stage and nginx:stable-alpine runtime stage) with nginx.conf configured for React Router SPA fallback (try_files $uri $uri/ /index.html;).
docker-compose.yml: Run api-server (port 5000), customer-web (port 3000), and admin-portal (port 3001) on a shared network using environment variables from .env files. 13. Implementation Phases & Final Output Requirements
Generate the complete, working source code incrementally across four phases:

Phase 1: Root docker-compose.yml, firestore.rules, storage.rules, /api-server setup, Firebase Admin initialization, role middlewares, and initial Admin seed script.
Phase 2: /api-server controllers and routes for Destinations, Tour Packages (with geo-tagged daily activities), Departures, Bookings, Stripe Checkout/Webhooks/Refunds, Geoapify proxy, and OpenWeather proxy.
Phase 3: /customer-web setup (shadcn/ui in JS), authentication, public pages, Leaflet activity map, interactive weather departure calendar, Stripe checkout integration, and Customer Dashboard.
Phase 4: /admin-portal setup (shadcn/ui in JS), staff login, role-protected routes, Coordinator modules, Support Agent modules, Tour Guide manifest view, and Admin overview/IAM/reporting/audit modules.
