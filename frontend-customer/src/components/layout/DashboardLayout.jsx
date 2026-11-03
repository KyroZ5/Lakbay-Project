import React, { useState } from 'react';
import { Link, useLocation, useNavigate, Outlet } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import {
  Compass,
  Calendar,
  User,
  Users,
  Bell,
  LogOut,
  Menu,
  ChevronRight,
} from 'lucide-react';
import { Button } from '../ui/button';
import { Sheet, SheetContent, SheetTitle, SheetDescription } from '../ui/sheet';
import { notify } from '../../lib/notify';

export const DashboardLayout = () => {
  const { user, profile, logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);

  const handleLogout = async () => {
    if (loggingOut) return;
    setLoggingOut(true);
    try {
      // Leave protected routes first, otherwise ProtectedRoute redirects to /login on sign-out
      navigate('/', { replace: true });
      await logout();
      notify.success('You have been signed out.');
    } catch (err) {
      notify.error(err, 'Failed to sign out. Please try again.');
    } finally {
      setLoggingOut(false);
    }
  };

  const navItems = [
    { label: 'Overview', path: '/dashboard', icon: Compass, exact: true },
    { label: 'My Bookings', path: '/dashboard/bookings', icon: Calendar },
    { label: 'Co-Travelers', path: '/dashboard/co-travelers', icon: Users },
    { label: 'Profile & Security', path: '/dashboard/profile', icon: User },
    { label: 'Notifications', path: '/dashboard/notifications', icon: Bell },
  ];

  const isActive = (item) => {
    if (item.exact) return location.pathname === item.path;
    return location.pathname.startsWith(item.path);
  };

  // Shared sidebar body: rendered in the sticky desktop aside and in the mobile Sheet
  const sidebarBody = (
    <>
      <div>
        {/* User Profile Snippet */}
        <div className="relative overflow-hidden rounded-xl bg-gradient-to-br from-emerald-600 via-teal-600 to-emerald-500 p-4 mb-6 shadow-lg shadow-emerald-500/20">
          <div className="pointer-events-none absolute -right-6 -top-8 h-24 w-24 rounded-full bg-white/15" />
          <div className="pointer-events-none absolute -bottom-10 -left-4 h-20 w-20 rounded-full bg-white/10" />
          <div className="relative flex items-center gap-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-white text-emerald-700 font-black text-sm ring-2 ring-white/50 shadow">
              {(profile?.fullName || user?.email || 'U')[0].toUpperCase()}
            </div>
            <div className="overflow-hidden text-white">
              <h4 className="font-bold text-sm truncate drop-shadow-sm">
                {profile?.fullName || 'Traveler'}
              </h4>
              <p className="text-[11px] text-emerald-50/85 truncate">{user?.email}</p>
            </div>
          </div>
        </div>

        {/* Navigation Links */}
        <nav className="space-y-1" aria-label="Dashboard">
          {navItems.map((item) => (
            <Link
              key={item.path}
              to={item.path}
              onClick={() => setSidebarOpen(false)}
              aria-current={isActive(item) ? 'page' : undefined}
              className={`flex items-center justify-between rounded-xl px-3.5 py-2.5 text-sm font-semibold transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
                isActive(item)
                  ? 'bg-gradient-to-r from-emerald-50 to-teal-50 text-emerald-700 shadow-sm ring-1 ring-emerald-200/70 translate-x-0.5'
                  : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900 hover:translate-x-0.5'
              }`}
            >
              <div className="flex items-center gap-3">
                <span className={`flex h-7 w-7 items-center justify-center rounded-lg ${isActive(item) ? 'bg-emerald-600 text-white shadow-md shadow-emerald-500/30' : 'bg-slate-100 text-slate-400'}`}>
                  <item.icon className="h-3.5 w-3.5" />
                </span>
                <span>{item.label}</span>
              </div>
              {isActive(item) && <ChevronRight className="h-4 w-4 text-emerald-600" />}
            </Link>
          ))}
        </nav>
      </div>

      {/* Footer Actions */}
      <div className="pt-4 border-t border-slate-100 space-y-2">
        <Button asChild variant="outline" className="w-full text-xs font-semibold justify-start text-emerald-700">
          <Link to="/packages" onClick={() => setSidebarOpen(false)}>
            <Compass className="h-4 w-4 mr-2" />
            Book Another Tour
          </Link>
        </Button>
        <Button
          variant="ghost"
          onClick={handleLogout}
          disabled={loggingOut}
          className="h-auto w-full justify-start gap-2.5 px-3.5 py-2 text-xs font-semibold text-red-600 hover:bg-red-50 hover:text-red-600"
        >
          <LogOut className="h-4 w-4" />
          Sign Out
        </Button>
      </div>
    </>
  );

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col lg:flex-row">
      {/* Mobile / Tablet Top Bar: title + drawer trigger, with a horizontally scrollable tab bar */}
      <div className="lg:hidden border-b border-slate-200 bg-white">
        <div className="flex items-center justify-between gap-3 px-4 pt-3 sm:px-6">
          <div className="flex min-w-0 items-center gap-2">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-emerald-600 text-white">
              <Compass className="h-5 w-5" />
            </div>
            <span className="truncate font-bold text-slate-900 font-heading">Customer Portal</span>
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setSidebarOpen(true)}
            aria-label="Open dashboard menu"
            aria-expanded={sidebarOpen}
            className="shrink-0 text-slate-600"
          >
            <Menu className="h-6 w-6" />
          </Button>
        </div>
        <nav
          className="no-scrollbar flex gap-2 overflow-x-auto px-4 pb-3 pt-2 sm:px-6"
          aria-label="Dashboard sections"
        >
          {navItems.map((item) => (
            <Link
              key={item.path}
              to={item.path}
              aria-current={isActive(item) ? 'page' : undefined}
              className={`flex min-h-[40px] shrink-0 items-center gap-2 whitespace-nowrap rounded-full px-3.5 py-2 text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
                isActive(item)
                  ? 'bg-emerald-600 text-white shadow-md shadow-emerald-500/30'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200 hover:text-slate-900'
              }`}
            >
              <item.icon className="h-4 w-4" />
              {item.label}
            </Link>
          ))}
        </nav>
      </div>

      {/* Mobile Sidebar Navigation */}
      <Sheet open={sidebarOpen} onOpenChange={setSidebarOpen}>
        <SheetContent side="left" className="flex w-72 max-w-[85vw] flex-col justify-between gap-6 overflow-y-auto p-5 pt-12 lg:hidden">
          <SheetTitle className="sr-only">Dashboard navigation</SheetTitle>
          <SheetDescription className="sr-only">Navigate between your customer dashboard sections.</SheetDescription>
          {sidebarBody}
        </SheetContent>
      </Sheet>

      {/* Desktop Sidebar Navigation */}
      <aside className="hidden lg:flex sticky top-28 z-40 h-[calc(100vh-112px)] w-64 shrink-0 overflow-y-auto border-r border-slate-200 bg-white p-5 flex-col justify-between gap-6">
        {sidebarBody}
      </aside>

      {/* Main Dashboard Content Area */}
      <main className="relative mx-auto w-full min-w-0 flex-1 p-4 sm:p-6 lg:p-8 lg:max-w-6xl xl:max-w-7xl overflow-y-auto">
        <div className="pointer-events-none absolute inset-x-0 top-0 h-56 bg-gradient-to-b from-emerald-50/70 to-transparent" />
        <div className="pointer-events-none absolute right-8 top-40 h-40 w-40 rounded-full bg-teal-200/25 blur-3xl" />
        <div className="relative">
          <Outlet />
        </div>
      </main>
    </div>
  );
};
