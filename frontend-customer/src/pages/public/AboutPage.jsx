import React from 'react';
import { ShieldCheck, Award, Users } from 'lucide-react';
import { Badge } from '../../components/ui/badge';

export const AboutPage = () => {
  return (
    <div className="min-h-screen bg-slate-50 py-16">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8 max-w-5xl">
        <div className="text-center max-w-2xl mx-auto mb-16">
          <Badge className="bg-emerald-100 text-emerald-800 border-none font-semibold mb-2">
            Our Story
          </Badge>
          <h1 className="text-4xl sm:text-5xl font-extrabold text-slate-900 font-heading">
            Connecting You to the Heart of the Philippines
          </h1>
          <p className="mt-4 text-slate-600 text-base leading-relaxed">
            Lakbay was founded with a singular vision: to empower travelers from around the world to discover the 7,641 islands of the Philippines seamlessly, responsibly, and affordably.
          </p>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-8 sm:p-12 shadow-sm space-y-8 mb-16">
          <div>
            <h2 className="text-2xl font-bold text-slate-900 font-heading mb-3">
              Why We Built Lakbay
            </h2>
            <p className="text-slate-700 leading-relaxed text-sm">
              Coordinating multi-island trips in the Philippines historically required navigating fragmented ferry schedules, unverified local boat operators, and opaque cash payments. Lakbay bridges this gap by providing an end-to-end digital travel platform with verified departure schedules, licensed guides, and transparent Philippine Peso pricing.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-6 border-t border-slate-100">
            <div className="p-5 rounded-xl bg-slate-50 border border-slate-100">
              <ShieldCheck className="h-8 w-8 text-emerald-600 mb-3" />
              <h3 className="font-bold text-slate-900 text-base font-heading">DOT Accredited</h3>
              <p className="text-xs text-slate-600 mt-1">
                We operate strictly with certified Department of Tourism operators and safety protocols.
              </p>
            </div>
            <div className="p-5 rounded-xl bg-slate-50 border border-slate-100">
              <Users className="h-8 w-8 text-emerald-600 mb-3" />
              <h3 className="font-bold text-slate-900 text-base font-heading">Community-Led</h3>
              <p className="text-xs text-slate-600 mt-1">
                A percentage of every booking directly benefits indigenous and local boatman cooperatives.
              </p>
            </div>
            <div className="p-5 rounded-xl bg-slate-50 border border-slate-100">
              <Award className="h-8 w-8 text-emerald-600 mb-3" />
              <h3 className="font-bold text-slate-900 text-base font-heading">Guaranteed Fair Rates</h3>
              <p className="text-xs text-slate-600 mt-1">
                Fixed, all-inclusive pricing in Philippine Pesos (PHP) with zero hidden foreign exchange fees.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
