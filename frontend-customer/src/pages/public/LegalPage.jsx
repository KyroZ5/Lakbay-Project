import React from 'react';
import { Link } from 'react-router-dom';
import { ShieldCheck, FileText, Cookie } from 'lucide-react';
import { Badge } from '../../components/ui/badge';

const sections = [
  {
    id: 'privacy',
    icon: ShieldCheck,
    title: 'Privacy Policy',
    paragraphs: [
      'Lakbay collects only the information needed to process your bookings: your name, email address, phone number, emergency contact, saved co-traveler details, and booking history.',
      'Payments are processed by Stripe. Lakbay never sees or stores your full card number — we only keep the Stripe payment reference needed for confirmations and refunds.',
      'Your details are shared only with the tour operator and assigned guide for the departures you book, so they can prepare the passenger manifest. We do not sell your personal data.',
      'You can update your profile at any time from your dashboard, and you may deactivate your account once you have no active bookings.',
    ],
  },
  {
    id: 'terms',
    icon: FileText,
    title: 'Terms & Conditions',
    paragraphs: [
      'All prices are quoted per person in Philippine Pesos (PHP). The total shown at checkout is calculated by our servers from the published package price and the number of travelers.',
      'Seats are reserved when you start checkout and are confirmed once Stripe verifies your payment. Unpaid reservations are released automatically when the checkout session expires.',
      'Each package lists an early-cancellation cutoff. Cancellations made on or before the cutoff are refunded automatically; later requests are reviewed by our support team.',
      'Travelers are responsible for carrying valid identification and meeting any destination-specific travel requirements. Itineraries may change for safety or weather reasons.',
    ],
  },
  {
    id: 'cookies',
    icon: Cookie,
    title: 'Cookie Policy',
    paragraphs: [
      'Lakbay uses essential browser storage to keep you signed in through Firebase Authentication and to remember your session between visits.',
      'Stripe may set its own cookies during checkout for fraud prevention. Map tiles from OpenStreetMap may also be cached by your browser.',
      'We do not use advertising or cross-site tracking cookies. Clearing your browser storage will simply sign you out.',
    ],
  },
];

export const LegalPage = () => {
  return (
    <div className="min-h-screen bg-slate-50 py-10 sm:py-16">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8 max-w-4xl">
        <div className="relative mb-8 sm:mb-12 overflow-hidden rounded-2xl sm:rounded-3xl bg-slate-900 text-white shadow-2xl shadow-slate-300/60">
          <img src="/images/coast.jpg" alt="" aria-hidden="true" className="absolute inset-0 h-full w-full object-cover opacity-30" loading="lazy" />
          <div className="absolute inset-0 bg-gradient-to-r from-slate-950 via-slate-900/85 to-slate-900/40" />
          <div className="relative px-5 py-10 sm:px-12 sm:py-12 text-center max-w-2xl mx-auto">
            <Badge className="bg-emerald-500/25 text-emerald-300 border-emerald-500/30 font-semibold mb-3 px-3 py-1">
              Legal
            </Badge>
            <h1 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold font-heading">Policies</h1>
            <p className="mt-3 text-slate-300 text-sm">
              How Lakbay handles your data, bookings, and browser storage.
            </p>
            <div className="mt-5 flex flex-wrap items-center justify-center gap-2 text-xs font-bold">
              {sections.map((s) => (
                <a key={s.id} href={`#${s.id}`} className="inline-flex min-h-[36px] items-center rounded-full border border-white/25 bg-white/10 px-3 py-1 backdrop-blur-sm hover:bg-white/20">
                  {s.title}
                </a>
              ))}
            </div>
          </div>
        </div>

        <div className="space-y-5 sm:space-y-8">
          {sections.map(({ id, icon: Icon, title, paragraphs }) => (
            <section
              key={id}
              id={id}
              className="scroll-mt-24 rounded-2xl border border-slate-200 bg-white p-5 sm:p-8 shadow-lg shadow-slate-200/50"
            >
              <h2 className="flex items-center gap-2 text-xl sm:text-2xl font-bold text-slate-900 font-heading">
                <Icon className="h-5 w-5 sm:h-6 sm:w-6 shrink-0 text-emerald-600" />
                {title}
              </h2>
              <div className="mt-4 space-y-3 text-sm text-slate-600 leading-relaxed">
                {paragraphs.map((p) => (
                  <p key={p}>{p}</p>
                ))}
              </div>
            </section>
          ))}
        </div>

        <p className="mt-10 text-center text-sm text-slate-500">
          Questions about these policies? <Link to="/contact" className="text-emerald-600 font-semibold underline">Contact our support team</Link>.
        </p>
      </div>
    </div>
  );
};
