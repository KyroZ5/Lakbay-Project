import React from 'react';
import { Outlet } from 'react-router-dom';
import { AdminSidebar, AdminMobileNav } from './AdminSidebar';

export const AdminLayout = () => {
  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 font-sans antialiased">
      {/* Fixed sidebar on lg+; top bar with a Sheet menu below lg */}
      <AdminSidebar />
      <div className="lg:pl-64 flex flex-col min-h-screen">
        <AdminMobileNav />
        <main className="flex-1 min-w-0 p-4 sm:p-6 md:p-8">
          <Outlet />
        </main>
      </div>
    </div>
  );
};
