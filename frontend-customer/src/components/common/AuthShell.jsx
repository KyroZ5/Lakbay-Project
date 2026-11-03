import React from 'react';
import { Link } from 'react-router-dom';
import { Star, ShieldCheck, Sparkles, ArrowLeft } from 'lucide-react';

const collage = [
  { src: '/images/el-nido.jpg', caption: 'El Nido', tilt: '-rotate-3' },
  { src: '/images/beach.jpg', caption: 'Boracay', tilt: 'rotate-2 translate-y-4' },
  { src: '/images/mountain.jpg', caption: 'Banaue', tilt: 'rotate-2' },
  { src: '/images/chocolate-hills.jpg', caption: 'Bohol', tilt: '-rotate-2 translate-y-4' },
];

const perks = [
  { icon: Star, text: 'Manage bookings, vouchers & departure check-ins' },
  { icon: ShieldCheck, text: 'Secure Stripe payments with automatic refunds' },
  { icon: Sparkles, text: 'Save co-travelers for one-click checkout' },
];

/**
 * Split-screen auth layout: branded visual panel on the left,
 * form content (children) on the right.
 * The panel is a normal flex column (badge → photo grid → copy) so nothing overlaps
 * regardless of viewport height.
 */
export const AuthShell = ({ children }) => {
  return (
    <div className="flex min-h-[calc(100vh-112px)] flex-col lg:flex-row">
      {/* Visual brand panel */}
      <aside className="relative hidden lg:flex lg:w-[46%] xl:w-1/2 flex-col gap-10 overflow-hidden bg-slate-900 px-10 py-10 xl:px-14 text-white">
        <img
          src="/images/el-nido.jpg"
          alt=""
          aria-hidden="true"
          className="absolute inset-0 h-full w-full object-cover opacity-60"
          loading="lazy"
        />
        <div className="absolute inset-0 bg-gradient-to-b from-slate-950/70 via-emerald-950/80 to-slate-950/95" />
        <div className="orb orb-emerald -left-16 top-1/4 h-64 w-64 opacity-40" />
        <div className="orb orb-coral -right-12 bottom-10 h-56 w-56 opacity-30" style={{ animationDelay: '-6s' }} />

        <div className="relative z-10 self-start rounded-full border border-white/25 bg-white/10 px-4 py-1.5 text-xs font-bold text-emerald-200 backdrop-blur">
          🌴 7,641 islands of adventure
        </div>

        {/* Photo postcards — in normal flow, never on top of the copy */}
        <div className="relative z-10 grid grid-cols-2 gap-5 max-w-md w-full mx-auto" aria-hidden="true">
          {collage.map((img) => (
            <div
              key={img.caption}
              className={`${img.tilt} overflow-hidden rounded-xl border border-white/30 bg-white shadow-2xl shadow-black/40 transition-transform duration-300 hover:rotate-0`}
            >
              <img src={img.src} alt="" className="h-28 xl:h-32 w-full object-cover" loading="lazy" />
              <div className="px-2 py-1.5 text-center text-[10px] font-bold uppercase tracking-wider text-emerald-800">
                {img.caption}
              </div>
            </div>
          ))}
        </div>

        {/* Tagline */}
        <div className="relative z-10 mt-auto max-w-md space-y-5">
          <h2 className="text-3xl xl:text-4xl font-extrabold font-heading leading-tight">
            Your next island escape is <span className="text-gradient-warm">one login away</span>.
          </h2>
          <ul className="space-y-3 text-sm text-slate-200">
            {perks.map(({ icon: Icon, text }) => (
              <li key={text} className="flex items-center gap-2.5">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-emerald-500/20 ring-1 ring-emerald-400/40">
                  <Icon className="h-3.5 w-3.5 text-emerald-300" />
                </span>
                {text}
              </li>
            ))}
          </ul>
        </div>
      </aside>

      {/* Form side */}
      <main className="relative flex flex-1 items-center justify-center overflow-hidden bg-slate-50 px-4 py-12 sm:px-6 lg:px-10">
        <div className="pointer-events-none absolute inset-0 bg-dots opacity-70" />
        <div className="orb orb-teal -left-16 bottom-0 h-56 w-56 opacity-30" />
        <div className="relative w-full max-w-md">
          <Link
            to="/"
            className="mb-6 inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-slate-500 hover:text-emerald-700 transition-colors"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Back to home
          </Link>
          {children}
        </div>
      </main>
    </div>
  );
};
