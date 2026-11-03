import React from 'react';
import { Outlet } from 'react-router-dom';
import { AdminSidebar, AdminMobileNav } from './AdminSidebar';

export const AdminLayout = () => {
  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 font-sans antialiased">
      {/* Fixed sidebar on lg+; top bar with a Sheet menu below lg */}
      <AdminSidebar />
      <div className="lg:pl-64 flex min-w-0 flex-col min-h-screen">
        <AdminMobileNav />
        {/* min-w-0 lets wide tables scroll inside their own overflow container instead of widening the page */}
        <main className="flex-1 min-w-0 p-4 sm:p-6 md:p-8">
          {/* Cap content width on very wide (1920px+) screens */}
          <div className="mx-auto w-full min-w-0 max-w-screen-2xl">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
};
