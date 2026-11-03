import React, { useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { Button } from '../ui/button';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from '../ui/sheet';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '../ui/dropdown-menu';
import { notify } from '../../lib/notify';
import {
  Compass,
  Calendar,
  User,
  LogOut,
  Menu,
  Bell,
  Building2,
} from 'lucide-react';

export const Navbar = () => {
  const { user, profile, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [signingOut, setSigningOut] = useState(false);

  const handleLogout = async () => {
    if (signingOut) return;
    try {
      setSigningOut(true);
      // Leave protected routes first, otherwise ProtectedRoute redirects to /login on sign-out
      navigate('/', { replace: true });
      await logout();
      notify.success('Signed out');
    } catch (err) {
      notify.error(err, 'Failed to sign out. Please try again.');
    } finally {
      setSigningOut(false);
    }
  };

  const navLinks = [
    { name: 'Home', path: '/' },
    { name: 'Destinations', path: '/destinations' },
    { name: 'Tour Packages', path: '/packages' },
    { name: 'About Us', path: '/about' },
    { name: 'Contact', path: '/contact' },
  ];

  const isActive = (path) => {
    if (path === '/') return location.pathname === '/';
    return location.pathname.startsWith(path);
  };

  const accountLinks = [
    { to: '/dashboard', icon: Compass, label: 'My Dashboard' },
    { to: '/dashboard/bookings', icon: Calendar, label: 'My Bookings' },
    { to: '/dashboard/profile', icon: User, label: 'Profile & Co-Travelers' },
    { to: '/dashboard/notifications', icon: Bell, label: 'Notifications' },
  ];

  const closeMobile = () => setMobileOpen(false);

  return (
    <header className="sticky top-0 z-50 w-full">
      {/* Announcement ribbon */}
      <div className="relative overflow-hidden bg-gradient-to-r from-emerald-700 via-teal-600 to-emerald-700 bg-[length:200%_auto] animate-gradient-x text-white">
        <div className="container mx-auto flex h-8 items-center justify-center gap-2 px-4 text-[11px] font-semibold tracking-wide sm:text-xs">
          <span className="hidden sm:inline">🎉</span>
          <span>
            Dry-season seats opening — book early for Palawan &amp; Visayas departures
          </span>
          <Link
            to="/packages"
            className="hidden rounded-full bg-white/15 px-2.5 py-0.5 text-[11px] font-bold underline-offset-2 hover:bg-white/25 hover:underline sm:inline-block"
          >
            Browse tours →
          </Link>
        </div>
      </div>

      <div className="border-b border-white/40 bg-white/80 backdrop-blur-xl shadow-lg shadow-white/10">
        <div className="container mx-auto flex h-20 items-center justify-between px-4 sm:px-6 lg:px-8">
          {/* Brand Logo */}
          <Link to="/" className="flex items-center gap-2.5 transition-transform hover:scale-102">
            <div className="relative flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-tr from-emerald-600 via-teal-500 to-emerald-400 bg-[length:200%_auto] animate-gradient-x text-white shadow-md shadow-emerald-500/30">
              <span className="absolute inset-0 rounded-xl ring-1 ring-white/30" />
              <Compass className="h-6 w-6 stroke-[2.2]" />
            </div>
            <div>
              <span className="text-2xl font-black tracking-tight text-slate-900 font-heading">
                Lakbay<span className="text-gradient">.ph</span>
              </span>
              <span className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 -mt-1">
                Philippine Tours
              </span>
            </div>
          </Link>

        {/* Desktop Navigation Links */}
        <nav className="hidden md:flex items-center gap-8">
          {navLinks.map((link) => (
            <Link
              key={link.path}
              to={link.path}
              aria-current={isActive(link.path) ? 'page' : undefined}
              className={`text-sm font-semibold transition-colors relative py-1 ${
                isActive(link.path)
                  ? 'text-emerald-600'
                  : 'text-slate-600 hover:text-slate-950'
              }`}
            >
              {link.name}
              {isActive(link.path) && (
                <span className="absolute bottom-0 left-0 right-0 h-1 rounded-full bg-emerald-600 shadow-[0_0_12px_rgba(16,185,129,0.6)]" />
              )}
            </Link>
          ))}
        </nav>

        {/* Authentication Actions */}
        <div className="hidden md:flex items-center gap-3">
          {user ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  aria-label="Open account menu"
                  className="flex items-center gap-2.5 rounded-full border border-slate-200 bg-white py-1.5 pl-3 pr-4 text-sm font-medium text-slate-700 shadow-sm hover:border-slate-300 hover:bg-slate-50 transition-all cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                >
                  <div className="flex h-7 w-7 items-center justify-center rounded-full bg-emerald-100 text-xs font-bold text-emerald-800">
                    {(profile?.fullName || user.email || 'U')[0].toUpperCase()}
                  </div>
                  <span className="max-w-[120px] truncate">{profile?.fullName || 'My Account'}</span>
                </button>
              </DropdownMenuTrigger>

              <DropdownMenuContent align="end" sideOffset={8} className="w-56 rounded-xl border-slate-200 p-2 shadow-xl">
                <DropdownMenuLabel className="px-3 py-2 font-normal">
                  <p className="text-sm font-semibold text-slate-900 truncate">
                    {profile?.fullName || 'Traveler'}
                  </p>
                  <p className="text-xs text-slate-500 truncate">{user.email}</p>
                </DropdownMenuLabel>
                <DropdownMenuSeparator className="bg-slate-100" />

                {accountLinks.map(({ to, icon: Icon, label }) => (
                  <DropdownMenuItem key={to} asChild className="gap-2.5 rounded-lg px-3 py-2 text-slate-700 focus:bg-emerald-50 focus:text-slate-900 hover:bg-emerald-50 hover:text-emerald-700 transition-all duration-200">
                    <Link to={to}>
                      <Icon className="h-4 w-4 text-emerald-600" />
                      {label}
                    </Link>
                  </DropdownMenuItem>
                ))}
                <DropdownMenuItem asChild className="gap-2.5 rounded-lg px-3 py-2 font-semibold text-emerald-700 focus:bg-emerald-50 focus:text-emerald-700">
                  <Link to="/become-operator">
                    <Building2 className="h-4 w-4 text-emerald-600" />
                    Become an Operator
                  </Link>
                </DropdownMenuItem>

                <DropdownMenuSeparator className="bg-slate-100" />
                <DropdownMenuItem
                  onSelect={handleLogout}
                  disabled={signingOut}
                  className="gap-2.5 rounded-lg px-3 py-2 text-red-600 focus:bg-red-50 focus:text-red-600"
                >
                  <LogOut className="h-4 w-4" />
                  {signingOut ? 'Signing out...' : 'Sign Out'}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          ) : (
            <div className="flex items-center gap-2">
              <Button asChild variant="ghost" className="font-semibold text-slate-700 hover:text-emerald-700 hover:bg-emerald-50">
                <Link to="/login">Log in</Link>
              </Button>
              <Button
                asChild
                className="font-semibold shadow-lg shadow-emerald-500/25 bg-gradient-to-r from-emerald-600 to-teal-500 hover:from-emerald-700 hover:to-teal-600 transition-all hover:shadow-emerald-500/40"
              >
                <Link to="/register">Register</Link>
              </Button>
            </div>
          )}
        </div>

        {/* Mobile Navigation Drawer */}
        <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={() => setMobileOpen(true)}
            className="md:hidden rounded-lg p-2 text-slate-600 hover:bg-slate-100"
            aria-label="Open mobile navigation"
          >
            <Menu className="h-6 w-6" />
          </Button>

          <SheetContent side="right" className="overflow-y-auto">
            <SheetHeader>
              <SheetTitle>Lakbay Navigation</SheetTitle>
              <SheetDescription className="sr-only">Site navigation and account links</SheetDescription>
            </SheetHeader>

            <nav className="flex flex-col gap-1 mt-6">
              {navLinks.map((link) => (
                <Link
                  key={link.path}
                  to={link.path}
                  onClick={closeMobile}
                  aria-current={isActive(link.path) ? 'page' : undefined}
                  className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-base font-semibold transition-colors ${
                    isActive(link.path)
                      ? 'bg-emerald-50 text-emerald-700'
                      : 'text-slate-700 hover:bg-slate-50'
                  }`}
                >
                  {link.name}
                </Link>
              ))}
            </nav>

            <div className="mt-8 pt-6 border-t border-slate-100">
              {user ? (
                <div className="space-y-2">
                  <p className="px-3 text-xs font-bold uppercase tracking-wider text-slate-400">
                    Customer Portal
                  </p>
                  {accountLinks.map(({ to, icon: Icon, label }) => (
                    <Link
                      key={to}
                      to={to}
                      onClick={closeMobile}
                      className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
                    >
                      <Icon className="h-4 w-4 text-emerald-600" />
                      {label}
                    </Link>
                  ))}
                  <Link
                    to="/become-operator"
                    onClick={closeMobile}
                    className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-semibold text-emerald-700 hover:bg-emerald-50"
                  >
                    <Building2 className="h-4 w-4 text-emerald-600" />
                    Become an Operator
                  </Link>
                  <button
                    type="button"
                    onClick={() => {
                      closeMobile();
                      handleLogout();
                    }}
                    disabled={signingOut}
                    className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-semibold text-red-600 hover:bg-red-50 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50"
                  >
                    <LogOut className="h-4 w-4" />
                    Sign Out
                  </button>
                </div>
              ) : (
                <div className="flex flex-col gap-2.5">
                  <Button asChild variant="outline" className="w-full">
                    <Link to="/login" onClick={closeMobile}>Log in</Link>
                  </Button>
                  <Button asChild className="w-full">
                    <Link to="/register" onClick={closeMobile}>Create Account</Link>
                  </Button>
                </div>
              )}
            </div>
          </SheetContent>
        </Sheet>
        </div>
      </div>
    </header>
  );
};
