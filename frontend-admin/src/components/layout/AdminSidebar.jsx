import React, { useState, useEffect } from 'react';
import { NavLink, Link, useLocation } from 'react-router-dom';
import { useStaffAuth } from '../../contexts/StaffAuthContext';
import {
  LayoutDashboard,
  MapPin,
  Package,
  Calendar,
  Ticket,
  CreditCard,
  Compass,
  Users,
  FileSpreadsheet,
  LogOut,
  ChevronsUpDown,
  Settings,
  Star,
  Building2,
  Sparkles,
  Menu,
} from 'lucide-react';
import { cn } from '../../lib/utils';
import { notify } from '../../lib/notify';
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '../ui/dropdown-menu';
import { Sheet, SheetContent, SheetDescription, SheetTitle } from '../ui/sheet';

const navigationSections = [
  {
    title: 'Analytics & Overview',
    items: [
      {
        name: 'Dashboard',
        to: '/dashboard',
        icon: LayoutDashboard,
        // GET /admin/dashboard is admin-only; operators use /operators/dashboard
        roles: ['admin', 'operator'],
      },
    ],
  },
  {
    title: 'Catalog Management',
    items: [
      {
        name: 'Destinations',
        to: '/catalog/destinations',
        icon: MapPin,
        roles: ['admin', 'coordinator'],
      },
      {
        name: 'Tour Packages',
        to: '/catalog/packages',
        icon: Package,
        roles: ['admin', 'coordinator', 'operator'],
      },
      {
        name: 'Promotions',
        to: '/catalog/promotions',
        icon: Sparkles,
        roles: ['admin', 'coordinator'],
      },
    ],
  },
  {
    title: 'Tour Operations',
    items: [
      {
        name: 'Departures',
        to: '/operations/departures',
        icon: Calendar,
        roles: ['admin', 'coordinator', 'operator'],
      },
      {
        name: 'Bookings Hub',
        to: '/operations/bookings',
        icon: Ticket,
        roles: ['admin', 'support', 'coordinator', 'operator'],
      },
      {
        name: 'Refunds & Payments',
        to: '/operations/payments-refunds',
        icon: CreditCard,
        roles: ['admin', 'support'],
      },
      {
        name: 'Guide Manifest',
        to: '/operations/guide-manifest',
        icon: Compass,
        roles: ['admin', 'guide', 'operator'],
      },
      {
        name: 'Customer Reviews',
        to: '/operations/reviews',
        icon: Star,
        roles: ['admin', 'support', 'coordinator', 'guide', 'operator'],
      },
    ],
  },
  {
    title: 'Administration',
    items: [
      {
        name: 'Tour Operators',
        to: '/administration/operators',
        icon: Building2,
        roles: ['admin'],
      },
      {
        name: 'Users & Staff IAM',
        to: '/administration/staff-customers',
        icon: Users,
        roles: ['admin'],
      },
      {
        name: 'Financial Reports',
        to: '/administration/reports',
        icon: FileSpreadsheet,
        roles: ['admin'],
      },
    ],
  },
];

const BrandMark = () => (
  <div className="flex items-center gap-2.5">
    <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-600 text-white font-bold text-lg shadow-sm">
      L
    </div>
    <div>
      <span className="font-bold text-slate-900 text-lg tracking-tight">Lakbay</span>
    </div>
  </div>
);

/**
 * Brand header + role-filtered navigation + account footer.
 * Shared by the fixed desktop sidebar and the mobile Sheet so nav data and markup live in one place.
 */
const SidebarPanel = ({ onNavigate }) => {
  const { user, role, profile, logout } = useStaffAuth();

  const handleLogout = async () => {
    try {
      await logout();
      notify.success('Signed out');
    } catch (err) {
      notify.error(err, 'Failed to sign out. Please try again.');
    }
  };

  return (
    <>
      {/* Brand Header */}
      <div className="flex h-16 shrink-0 items-center border-b border-slate-200 px-6">
        <BrandMark />
      </div>

      {/* Navigation Links */}
      <nav aria-label="Main navigation" className="flex-1 overflow-y-auto px-4 py-4 space-y-6">
        {navigationSections.map((section) => {
          // Filter items based on user role
          const visibleItems = section.items.filter((item) =>
            item.roles.includes(role || '')
          );

          if (visibleItems.length === 0) return null;

          return (
            <div key={section.title}>
              <h3 className="px-2 text-xs font-semibold uppercase tracking-wider text-slate-400">
                {section.title}
              </h3>
              <div className="mt-2 space-y-1">
                {visibleItems.map((item) => {
                  const Icon = item.icon;
                  return (
                    <NavLink
                      key={item.to}
                      to={item.to}
                      onClick={onNavigate}
                      className={({ isActive }) =>
                        cn(
                          'flex min-h-10 items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium lg:min-h-0 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                          isActive
                            ? 'bg-emerald-50 text-emerald-700 font-semibold shadow-xs'
                            : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                        )
                      }
                    >
                      <Icon className="h-4 w-4 shrink-0" />
                      <span className="truncate">{item.name}</span>
                    </NavLink>
                  );
                })}
              </div>
            </div>
          );
        })}
      </nav>

      {/* Account Footer with Dropdown for Settings / Sign Out */}
      <div className="shrink-0 border-t border-slate-200 p-3">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              className="flex w-full items-center justify-between gap-2 rounded-xl p-2 text-left transition-colors hover:bg-slate-50 data-[state=open]:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-emerald-800 font-bold text-sm border border-emerald-200">
                  {profile?.fullName ? profile.fullName.charAt(0).toUpperCase() : 'S'}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-semibold text-slate-900 truncate">
                    {profile?.fullName || 'Staff User'}
                  </p>
                  <p className="text-[11px] text-slate-500 truncate capitalize">
                    {role || 'Staff'}
                  </p>
                </div>
              </div>
              <ChevronsUpDown className="h-4 w-4 shrink-0 text-slate-400" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            side="top"
            align="start"
            sideOffset={8}
            className="w-[var(--radix-dropdown-menu-trigger-width)] rounded-xl border-slate-200 bg-white p-2 shadow-lg"
          >
            <DropdownMenuLabel className="px-3 py-2 font-normal">
              <p className="text-xs font-semibold text-slate-900 truncate">
                {profile?.fullName || 'Staff User'}
              </p>
              <p className="text-[11px] text-slate-500 truncate mt-0.5">
                {profile?.email || user?.email}
              </p>
              <div className="mt-2">
                <Badge
                  variant={
                    role === 'admin'
                      ? 'destructive'
                      : role === 'coordinator'
                      ? 'info'
                      : role === 'guide'
                      ? 'success'
                      : 'secondary'
                  }
                  className="capitalize text-[10px] font-bold px-1.5 py-0.5"
                >
                  {role || 'Staff'}
                </Badge>
              </div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator className="bg-slate-100" />
            <DropdownMenuItem
              asChild
              className="rounded-lg px-3 py-2 text-xs font-medium text-slate-700 focus:bg-slate-100 focus:text-slate-900 [&_svg]:size-3.5"
            >
              <Link to="/settings" onClick={onNavigate}>
                <Settings className="text-slate-500" />
                <span>Account Settings</span>
              </Link>
            </DropdownMenuItem>
            <DropdownMenuItem
              onSelect={handleLogout}
              className="rounded-lg px-3 py-2 text-xs font-medium text-red-600 focus:bg-red-50 focus:text-red-700 [&_svg]:size-3.5"
            >
              <LogOut />
              <span>Sign Out</span>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </>
  );
};

/** Fixed 64-wide sidebar, shown from the lg breakpoint up. */
export const AdminSidebar = () => (
  <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 flex-col border-r border-slate-200 bg-white lg:flex">
    <SidebarPanel />
  </aside>
);

/** Slim top bar with a menu button that opens the same navigation in a left Sheet (below lg). */
export const AdminMobileNav = () => {
  const [open, setOpen] = useState(false);
  const location = useLocation();

  // Close the sheet whenever the route changes
  useEffect(() => {
    setOpen(false);
  }, [location.pathname]);

  return (
    <header className="sticky top-0 z-30 flex h-14 items-center gap-3 border-b border-slate-200 bg-white px-4 lg:hidden">
      <Sheet open={open} onOpenChange={setOpen}>
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setOpen(true)}
          aria-label="Open navigation menu"
          aria-expanded={open}
          className="-ml-2 h-10 w-10 text-slate-700"
        >
          <Menu className="h-5 w-5" />
        </Button>
        <SheetContent side="left" className="flex w-72 max-w-[85vw] flex-col gap-0 overflow-hidden p-0 sm:max-w-[85vw]">
          <SheetTitle className="sr-only">Navigation</SheetTitle>
          <SheetDescription className="sr-only">Lakbay staff portal sections</SheetDescription>
          <SidebarPanel onNavigate={() => setOpen(false)} />
        </SheetContent>
      </Sheet>
      <BrandMark />
    </header>
  );
};
