import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { ProtectedRoute } from './ProtectedRoute';

// Layouts
import { Navbar } from '../components/layout/Navbar';
import { Footer } from '../components/layout/Footer';
import { DashboardLayout } from '../components/layout/DashboardLayout';

// Public Pages
import { HomePage } from '../pages/public/HomePage';
import { DestinationsPage } from '../pages/public/DestinationsPage';
import { DestinationDetailPage } from '../pages/public/DestinationDetailPage';
import { PackagesPage } from '../pages/public/PackagesPage';
import { PackageDetailPage } from '../pages/public/PackageDetailPage';
import { AboutPage } from '../pages/public/AboutPage';
import { ContactPage } from '../pages/public/ContactPage';
import { BecomeOperatorPage } from '../pages/public/BecomeOperatorPage';

// Auth Pages
import { LoginPage } from '../pages/auth/LoginPage';
import { RegisterPage } from '../pages/auth/RegisterPage';
import { ForgotPasswordPage } from '../pages/auth/ForgotPasswordPage';

// Customer Dashboard Pages
import { DashboardOverview } from '../pages/customer/DashboardOverview';
import { MyBookingsPage } from '../pages/customer/MyBookingsPage';
import { BookingDetailPage } from '../pages/customer/BookingDetailPage';
import { ProfilePage } from '../pages/customer/ProfilePage';
import { CoTravelersPage } from '../pages/customer/CoTravelersPage';
import { NotificationsPage } from '../pages/customer/NotificationsPage';

export const AppRoutes = () => {
  return (
    <div className="flex flex-col min-h-screen">
      <Navbar />
      <div className="flex-1">
        <Routes>
          {/* Public Routes */}
          <Route path="/" element={<HomePage />} />
          <Route path="/destinations" element={<DestinationsPage />} />
          <Route path="/destinations/:id" element={<DestinationDetailPage />} />
          <Route path="/packages" element={<PackagesPage />} />
          <Route path="/packages/:id" element={<PackageDetailPage />} />
          <Route path="/about" element={<AboutPage />} />
          <Route path="/contact" element={<ContactPage />} />
          <Route path="/become-operator" element={<BecomeOperatorPage />} />

          {/* Auth Routes */}
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />
          <Route path="/forgot-password" element={<ForgotPasswordPage />} />

          {/* Protected Customer Dashboard */}
          <Route
            path="/dashboard"
            element={
              <ProtectedRoute>
                <DashboardLayout />
              </ProtectedRoute>
            }
          >
            <Route index element={<DashboardOverview />} />
            <Route path="bookings" element={<MyBookingsPage />} />
            <Route path="bookings/:id" element={<BookingDetailPage />} />
            <Route path="profile" element={<ProfilePage />} />
            <Route path="co-travelers" element={<CoTravelersPage />} />
            <Route path="notifications" element={<NotificationsPage />} />
          </Route>

          {/* Fallback */}
          <Route
            path="*"
            element={
              <div className="py-24 text-center">
                <h2 className="text-3xl font-black text-slate-800 font-heading">Page Not Found</h2>
                <p className="text-slate-500 mt-2">The page you are looking for does not exist.</p>
                <a href="/" className="mt-4 inline-block text-emerald-600 font-bold hover:underline">
                  Return Home
                </a>
              </div>
            }
          />
        </Routes>
      </div>
      <Footer />
    </div>
  );
};
