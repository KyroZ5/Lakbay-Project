import React from 'react';
import { Link } from 'react-router-dom';
import { Compass, Mail, Phone, MapPin, Shield, CreditCard, Heart } from 'lucide-react';

export const Footer = () => {
  return (
    <footer className="border-t border-slate-200 bg-slate-900 text-slate-400">
      <div className="container mx-auto px-4 py-16 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 gap-10 md:grid-cols-2 lg:grid-cols-5">
          {/* Brand & Mission */}
          <div className="lg:col-span-2 space-y-4">
            <Link to="/" className="flex items-center gap-2.5">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-500 text-white">
                <Compass className="h-6 w-6 stroke-[2.2]" />
              </div>
              <span className="text-2xl font-black tracking-tight text-white font-heading">
                Lakbay<span className="text-emerald-400">.ph</span>
              </span>
            </Link>
            <p className="text-sm leading-relaxed max-w-sm text-slate-400">
              Your gateway to authentic Philippine journeys. From the hidden turquoise lagoons of Palawan to the rolling emerald hills of Batanes, we craft unforgettable island experiences priced fairly in Philippine Pesos (PHP).
            </p>
            <div className="flex items-center gap-3 pt-2 text-xs text-slate-300">
              <span className="flex items-center gap-1.5 rounded-full bg-slate-800 px-3 py-1 border border-slate-700">
                <Shield className="h-3.5 w-3.5 text-emerald-400" />
                DOT Accredited Operator
              </span>
              <span className="flex items-center gap-1.5 rounded-full bg-slate-800 px-3 py-1 border border-slate-700">
                <CreditCard className="h-3.5 w-3.5 text-emerald-400" />
                Stripe Secured
              </span>
            </div>
          </div>

          {/* Quick Links */}
          <div className="space-y-3">
            <h4 className="text-sm font-bold uppercase tracking-wider text-white">Explore</h4>
            <ul className="space-y-2 text-sm">
              <li>
                <Link to="/destinations" className="hover:text-emerald-400 transition-colors">
                  All Destinations
                </Link>
              </li>
              <li>
                <Link to="/packages" className="hover:text-emerald-400 transition-colors">
                  Tour Packages
                </Link>
              </li>
              <li>
                <Link to="/packages?category=Island%20Hopping" className="hover:text-emerald-400 transition-colors">
                  Island Hopping
                </Link>
              </li>
              <li>
                <Link to="/packages?category=Adventure" className="hover:text-emerald-400 transition-colors">
                  Adventure & Diving
                </Link>
              </li>
              <li>
                <Link to="/packages?category=Heritage" className="hover:text-emerald-400 transition-colors">
                  Cultural Heritage
                </Link>
              </li>
            </ul>
          </div>

          {/* Company & Support */}
          <div className="space-y-3">
            <h4 className="text-sm font-bold uppercase tracking-wider text-white">Company</h4>
            <ul className="space-y-2 text-sm">
              <li>
                <Link to="/about" className="hover:text-emerald-400 transition-colors">
                  About Us
                </Link>
              </li>
              <li>
                <Link to="/become-operator" className="text-emerald-400 font-semibold hover:text-emerald-300 transition-colors">
                  Become an Operator
                </Link>
              </li>
              <li>
                <Link to="/contact" className="hover:text-emerald-400 transition-colors">
                  Customer Support
                </Link>
              </li>
              <li>
                <Link to="/contact#faqs" className="hover:text-emerald-400 transition-colors">
                  FAQs & Travel Advice
                </Link>
              </li>
              <li>
                <Link to="/contact#cancellation" className="hover:text-emerald-400 transition-colors">
                  Cancellation Policy
                </Link>
              </li>
              <li>
                <a href="#privacy" className="hover:text-emerald-400 transition-colors">
                  Privacy Policy
                </a>
              </li>
            </ul>
          </div>

          {/* Contact Details */}
          <div className="space-y-3">
            <h4 className="text-sm font-bold uppercase tracking-wider text-white">Contact Us</h4>
            <ul className="space-y-2.5 text-sm">
              <li className="flex items-start gap-2.5">
                <MapPin className="h-4 w-4 text-emerald-400 shrink-0 mt-0.5" />
                <span>BGC, Taguig City, Metro Manila, Philippines</span>
              </li>
              <li className="flex items-center gap-2.5">
                <Phone className="h-4 w-4 text-emerald-400 shrink-0" />
                <span>+63 (2) 8876-5432</span>
              </li>
              <li className="flex items-center gap-2.5">
                <Mail className="h-4 w-4 text-emerald-400 shrink-0" />
                <span>support@lakbay.ph</span>
              </li>
            </ul>
          </div>
        </div>

        {/* Bottom bar */}
        <div className="mt-12 border-t border-slate-800 pt-8 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs">
          <p>© {new Date().getFullYear()} Lakbay Philippines Inc. All rights reserved.</p>
          <p className="flex items-center gap-1 text-slate-500">
            Crafted with <Heart className="h-3 w-3 text-red-500 fill-red-500" /> for Philippine Travel
          </p>
        </div>
      </div>
    </footer>
  );
};
