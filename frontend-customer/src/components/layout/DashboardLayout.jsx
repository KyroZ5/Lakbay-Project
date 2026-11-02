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
      await logout();
      notify.success('You have been signed out.');
      navigate('/');
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
        <div className="flex items-center gap-3 p-3 rounded-xl bg-slate-50 border border-slate-100 mb-6">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-emerald-800 font-bold text-sm">
            {(profile?.fullName || user?.email || 'U')[0].toUpperCase()}
          </div>
          <div className="overflow-hidden">
            <h4 className="font-bold text-slate-900 text-sm truncate">
              {profile?.fullName || 'Traveler'}
            </h4>
            <p className="text-[11px] text-slate-500 truncate">{user?.email}</p>
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
              className={`flex items-center justify-between rounded-xl px-3.5 py-2.5 text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
                isActive(item)
                  ? 'bg-emerald-50 text-emerald-700 shadow-sm'
                  : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
              }`}
            >
              <div className="flex items-center gap-3">
                <item.icon className={`h-4 w-4 ${isActive(item) ? 'text-emerald-600' : 'text-slate-400'}`} />
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
    <div className="min-h-screen bg-slate-50 flex flex-col md:flex-row">
      {/* Mobile Top Bar */}
      <div className="md:hidden flex items-center justify-between border-b border-slate-200 bg-white p-4 sticky top-0 z-30">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-600 text-white">
            <Compass className="h-5 w-5" />
          </div>
          <span className="font-bold text-slate-900 font-heading">Customer Portal</span>
        </div>
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setSidebarOpen(true)}
          aria-label="Open dashboard menu"
          aria-expanded={sidebarOpen}
          className="text-slate-600"
        >
          <Menu className="h-6 w-6" />
        </Button>
      </div>

      {/* Mobile Sidebar Navigation */}
      <Sheet open={sidebarOpen} onOpenChange={setSidebarOpen}>
        <SheetContent side="left" className="flex w-64 flex-col justify-between p-5 pt-12 md:hidden">
          <SheetTitle className="sr-only">Dashboard navigation</SheetTitle>
          <SheetDescription className="sr-only">Navigate between your customer dashboard sections.</SheetDescription>
          {sidebarBody}
        </SheetContent>
      </Sheet>

      {/* Desktop Sidebar Navigation */}
      <aside className="hidden md:flex sticky top-20 z-40 h-[calc(100vh-80px)] w-64 shrink-0 border-r border-slate-200 bg-white p-5 flex-col justify-between">
        {sidebarBody}
      </aside>

      {/* Main Dashboard Content Area */}
      <main className="flex-1 p-4 sm:p-6 lg:p-8 max-w-6xl overflow-y-auto">
        <Outlet />
      </main>
    </div>
  );
};
