import React from 'react';
import { Link } from 'react-router-dom';
import { ShieldCheck, Award, Users, Compass, MapPin, Heart, ArrowRight, Sparkles } from 'lucide-react';
import { Badge } from '../../components/ui/badge';
import { Button } from '../../components/ui/button';

const gallery = [
  { src: '/images/el-nido.jpg', caption: 'El Nido lagoons' },
  { src: '/images/beach.jpg', caption: 'White Beach, Boracay' },
  { src: '/images/mountain.jpg', caption: 'Banaue terraces' },
  { src: '/images/island.jpg', caption: 'Coron island hops' },
  { src: '/images/chocolate-hills.jpg', caption: 'Chocolate Hills, Bohol' },
  { src: '/images/lake.jpg', caption: 'Lake Sebu' },
];

const values = [
  {
    icon: ShieldCheck,
    title: 'DOT Accredited',
    desc: 'We operate strictly with certified Department of Tourism operators and safety protocols.',
    color: 'from-emerald-500 to-teal-500',
  },
  {
    icon: Users,
    title: 'Community-Led',
    desc: 'A percentage of every booking directly benefits indigenous and local boatman cooperatives.',
    color: 'from-sky-500 to-blue-500',
  },
  {
    icon: Award,
    title: 'Guaranteed Fair Rates',
    desc: 'Fixed, all-inclusive pricing in Philippine Pesos (PHP) with zero hidden foreign exchange fees.',
    color: 'from-amber-500 to-orange-500',
  },
];

export const AboutPage = () => {
  return (
    <div className="min-h-screen bg-slate-50 py-10 sm:py-16">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8 max-w-6xl">
        {/* Hero */}
        <div className="relative mb-10 sm:mb-16 overflow-hidden rounded-2xl sm:rounded-3xl bg-slate-900 text-white shadow-2xl shadow-slate-300/60">
          <img src="/images/lake.jpg" alt="" aria-hidden="true" className="absolute inset-0 h-full w-full object-cover opacity-50" loading="lazy" />
          <div className="absolute inset-0 bg-gradient-to-r from-slate-950 via-slate-900/85 to-slate-900/40" />
          <div className="orb orb-emerald -left-12 -top-12 h-52 w-52 opacity-50" />
          <div className="orb orb-coral right-8 bottom-0 h-40 w-40 opacity-40" style={{ animationDelay: '-5s' }} />
          <div className="relative px-5 py-10 sm:px-12 sm:py-16 max-w-3xl">
            <Badge className="bg-emerald-500/25 text-emerald-300 border-emerald-500/30 font-semibold mb-3 px-3 py-1">
              <Sparkles className="h-3 w-3 mr-1.5 inline" />
              Our Story
            </Badge>
            <h1 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold font-heading leading-tight break-words">
              Connecting You to the <span className="text-gradient">Heart of the Philippines</span>
            </h1>
            <p className="mt-4 text-slate-300 text-base leading-relaxed max-w-2xl">
              Lakbay was founded with a singular vision: to empower travelers from around the world to discover the 7,641 islands of the Philippines seamlessly, responsibly, and affordably.
            </p>
            <div className="mt-6 flex flex-col min-[400px]:flex-row flex-wrap gap-3">
              <Button asChild className="h-11 sm:h-10 font-bold shadow-lg shadow-emerald-600/30">
                <Link to="/packages">
                  Explore Tours
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
              </Button>
              <Button asChild variant="outline" className="h-11 sm:h-10 border-white/30 text-white hover:bg-white/10 hover:text-white font-bold bg-white/5 backdrop-blur">
                <Link to="/become-operator">Partner With Us</Link>
              </Button>
            </div>
          </div>
        </div>

        {/* Story + photo */}
        <div className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-8 lg:p-12 shadow-sm space-y-8 mb-10 sm:mb-16 overflow-hidden">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 lg:gap-8 items-center">
            <div className="img-zoom relative aspect-[4/3] overflow-hidden rounded-2xl shadow-xl shadow-emerald-100">
              <img src="/images/el-nido.jpg" alt="Boats in a turquoise lagoon in El Nido" className="h-full w-full object-cover" loading="lazy" />
              <div className="absolute inset-0 bg-gradient-to-t from-slate-950/50 to-transparent" />
              <div className="absolute bottom-4 left-4 rounded-xl bg-white/90 px-3.5 py-2 backdrop-blur">
                <p className="text-[11px] font-bold uppercase tracking-wider text-emerald-700">Since day one</p>
                <p className="text-xs font-semibold text-slate-700">Palawan, Philippines</p>
              </div>
            </div>
            <div>
              <h2 className="text-xl sm:text-2xl font-bold text-slate-900 font-heading mb-3">
                Why We Built Lakbay
              </h2>
              <p className="text-slate-700 leading-relaxed text-sm">
                Coordinating multi-island trips in the Philippines historically required navigating fragmented ferry schedules, unverified local boat operators, and opaque cash payments. Lakbay bridges this gap by providing an end-to-end digital travel platform with verified departure schedules, licensed guides, and transparent Philippine Peso pricing.
              </p>
              <div className="mt-5 flex items-center gap-3 rounded-xl bg-gradient-to-r from-emerald-50 to-teal-50 p-4 border border-emerald-100">
                <Heart className="h-5 w-5 text-rose-500 fill-rose-500 shrink-0" />
                <p className="text-xs font-semibold text-emerald-900">
                  Every booking supports local boatman cooperatives and coastal communities.
                </p>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 sm:gap-6 pt-6 border-t border-slate-100">
            {values.map((v, i) => (
              <div key={i} className={`group p-5 rounded-xl bg-slate-50 border border-slate-100 ${i === 2 ? 'sm:col-span-2 md:col-span-1' : ''} hover:bg-white hover:shadow-lg hover:-translate-y-1 transition-all duration-300`}>
                <div className={`flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br ${v.color} text-white mb-3 shadow-lg group-hover:scale-110 transition-transform`}>
                  <v.icon className="h-6 w-6" />
                </div>
                <h3 className="font-bold text-slate-900 text-base font-heading">{v.title}</h3>
                <p className="text-xs text-slate-600 mt-1">
                  {v.desc}
                </p>
              </div>
            ))}
          </div>
        </div>

        {/* Stats band */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-5 mb-10 sm:mb-16 reveal-stagger">
          {[
            { value: '7,641', label: 'Islands to discover', icon: MapPin, color: 'from-emerald-500 to-teal-500' },
            { value: '120+', label: 'Curated destinations', icon: Compass, color: 'from-sky-500 to-blue-500' },
            { value: '12K+', label: 'Happy travelers', icon: Users, color: 'from-amber-500 to-orange-500' },
            { value: '100%', label: 'PHP transparent pricing', icon: Award, color: 'from-rose-500 to-pink-500' },
          ].map((stat, i) => (
            <div key={i} className="min-w-0 rounded-2xl border border-slate-100 bg-white px-3 sm:px-5 py-5 sm:py-6 text-center shadow-sm hover:shadow-lg hover:-translate-y-1 transition-all">
              <div className={`mx-auto mb-3 flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br ${stat.color} text-white shadow-lg`}>
                <stat.icon className="h-5 w-5" />
              </div>
              <div className="text-xl sm:text-2xl font-black text-slate-900 font-heading">{stat.value}</div>
              <div className="text-xs font-semibold text-slate-500 mt-0.5">{stat.label}</div>
            </div>
          ))}
        </div>

        {/* Photo gallery */}
        <div className="mb-4 text-center">
          <Badge className="bg-emerald-100 text-emerald-800 border-none font-semibold mb-2">
            Postcards
          </Badge>
          <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-900 font-heading">
            A Glimpse of the Journey
          </h2>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          {gallery.map((img, i) => (
            <div
              key={img.caption}
              className={`img-zoom group relative aspect-square overflow-hidden rounded-xl border border-slate-200 shadow-sm ${
                i % 2 === 0 ? 'md:-translate-y-2' : ''
              }`}
            >
              <img src={img.src} alt={img.caption} className="h-full w-full object-cover" loading="lazy" />
              <div className="absolute inset-0 bg-gradient-to-t from-slate-950/75 via-transparent to-transparent" />
              <span className="absolute bottom-2 left-2.5 right-2.5 text-[10px] font-bold uppercase tracking-wider text-white drop-shadow">
                {img.caption}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
