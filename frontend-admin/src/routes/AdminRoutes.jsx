import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { RoleRoute } from './RoleRoute';
import { AdminLayout } from '../components/layout/AdminLayout';

// Pages
import { StaffLoginPage } from '../pages/auth/StaffLoginPage';
import { DashboardOverviewPage } from '../pages/dashboard/DashboardOverviewPage';
import { DestinationsManagePage } from '../pages/catalog/DestinationsManagePage';
import { PackagesManagePage } from '../pages/catalog/PackagesManagePage';
import { PromotionsManagePage } from '../pages/catalog/PromotionsManagePage';
import { DeparturesManagePage } from '../pages/operations/DeparturesManagePage';
import { BookingsManagePage } from '../pages/operations/BookingsManagePage';
import { PaymentsRefundsPage } from '../pages/operations/PaymentsRefundsPage';
import { GuideManifestPage } from '../pages/operations/GuideManifestPage';
import { ReviewsModeratePage } from '../pages/operations/ReviewsModeratePage';
import { OperatorsManagePage } from '../pages/administration/OperatorsManagePage';
import { StaffCustomersPage } from '../pages/administration/StaffCustomersPage';
import { ReportsPage } from '../pages/administration/ReportsPage';
import { SettingsPage } from '../pages/settings/SettingsPage';

export const AdminRoutes = () => {
  return (
    <Routes>
      {/* Public Login Route */}
      <Route path="/login" element={<StaffLoginPage />} />

      {/* Authenticated Staff Shell */}
      <Route
        path="/"
        element={
          <RoleRoute>
            <AdminLayout />
          </RoleRoute>
        }
      >
        <Route index element={<Navigate to="/dashboard" replace />} />

        {/* Dashboard */}
        <Route
          path="dashboard"
          element={
            <RoleRoute allowedRoles={['admin', 'coordinator', 'support', 'guide', 'operator']}>
              <DashboardOverviewPage />
            </RoleRoute>
          }
        />

        {/* Catalog Management (Coordinator & Admin & Operator) */}
        <Route
          path="catalog/destinations"
          element={
            <RoleRoute allowedRoles={['admin', 'coordinator']}>
              <DestinationsManagePage />
            </RoleRoute>
          }
        />
        <Route
          path="catalog/packages"
          element={
            <RoleRoute allowedRoles={['admin', 'coordinator', 'operator']}>
              <PackagesManagePage />
            </RoleRoute>
          }
        />
        <Route
          path="catalog/promotions"
          element={
            <RoleRoute allowedRoles={['admin', 'coordinator']}>
              <PromotionsManagePage />
            </RoleRoute>
          }
        />

        {/* Tour Operations */}
        <Route
          path="operations/departures"
          element={
            <RoleRoute allowedRoles={['admin', 'coordinator', 'operator']}>
              <DeparturesManagePage />
            </RoleRoute>
          }
        />
        <Route
          path="operations/bookings"
          element={
            <RoleRoute allowedRoles={['admin', 'support', 'coordinator', 'operator']}>
              <BookingsManagePage />
            </RoleRoute>
          }
        />
        <Route
          path="operations/payments-refunds"
          element={
            <RoleRoute allowedRoles={['admin', 'support']}>
              <PaymentsRefundsPage />
            </RoleRoute>
          }
        />
        <Route
          path="operations/guide-manifest"
          element={
            <RoleRoute allowedRoles={['admin', 'guide', 'operator']}>
              <GuideManifestPage />
            </RoleRoute>
          }
        />
        <Route
          path="operations/reviews"
          element={
            <RoleRoute allowedRoles={['admin', 'coordinator', 'support', 'guide', 'operator']}>
              <ReviewsModeratePage />
            </RoleRoute>
          }
        />

        {/* Administration IAM & Reports (Admin only) */}
        <Route
          path="administration/operators"
          element={
            <RoleRoute allowedRoles={['admin']}>
              <OperatorsManagePage />
            </RoleRoute>
          }
        />
        <Route
          path="administration/staff-customers"
          element={
            <RoleRoute allowedRoles={['admin']}>
              <StaffCustomersPage />
            </RoleRoute>
          }
        />
        <Route
          path="administration/reports"
          element={
            <RoleRoute allowedRoles={['admin']}>
              <ReportsPage />
            </RoleRoute>
          }
        />

        {/* Staff Account Settings */}
        <Route
          path="settings"
          element={
            <RoleRoute allowedRoles={['admin', 'coordinator', 'support', 'guide', 'operator']}>
              <SettingsPage />
            </RoleRoute>
          }
        />
      </Route>

      {/* Catch-all */}
      <Route path="*" element={<Navigate to="/dashboard" replace />} />
    </Routes>
  );
};
