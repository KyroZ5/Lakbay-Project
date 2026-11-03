import React, { useState } from 'react';
import { Mail, Phone, MapPin, Send, CheckCircle2 } from 'lucide-react';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { Textarea } from '../../components/ui/textarea';
import { Badge } from '../../components/ui/badge';

export const ContactPage = () => {
  const [submitted, setSubmitted] = useState(false);
  const [formData, setFormData] = useState({ name: '', email: '', subject: '', message: '' });

  const handleSubmit = (e) => {
    e.preventDefault();
    setSubmitted(true);
  };

  return (
    <div className="min-h-screen bg-slate-50 py-10 sm:py-16">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8 max-w-5xl">
        {/* Header banner */}
        <div className="relative mb-8 sm:mb-14 overflow-hidden rounded-2xl sm:rounded-3xl bg-slate-900 text-white shadow-2xl shadow-slate-300/60">
          <img src="/images/coast.jpg" alt="" aria-hidden="true" className="absolute inset-0 h-full w-full object-cover opacity-30" loading="lazy" />
          <div className="absolute inset-0 bg-gradient-to-r from-slate-950 via-slate-900/85 to-slate-900/40" />
          <div className="orb orb-teal -right-8 -top-10 h-48 w-48 opacity-50" />
          <div className="relative px-5 py-10 sm:px-12 sm:py-14 text-center max-w-2xl mx-auto">
            <Badge className="bg-emerald-500/25 text-emerald-300 border-emerald-500/30 font-semibold mb-3 px-3 py-1">
              Get in Touch
            </Badge>
            <h1 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold font-heading break-words">
              We're Here to <span className="text-gradient">Help</span>
            </h1>
            <p className="mt-3 text-slate-300 text-sm">
              Have questions about tour package itineraries, departure schedules, or custom group bookings? Send us a message and our support team will respond within 24 hours.
            </p>
            <div className="mt-5 flex flex-wrap items-center justify-center gap-2 text-[11px] font-bold uppercase tracking-wider">
              {['Mon–Sat', '8AM–7PM PHT', '24h response'].map((t) => (
                <span key={t} className="rounded-full border border-white/25 bg-white/10 px-3 py-1 backdrop-blur-sm">
                  {t}
                </span>
              ))}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-12 gap-6 lg:gap-8">
          {/* Contact Details */}
          <div className="relative md:col-span-5 overflow-hidden rounded-2xl bg-slate-900 text-white p-5 sm:p-8 md:p-6 lg:p-8 space-y-6 min-w-0">
            <div className="orb orb-emerald -left-10 -top-10 h-36 w-36 opacity-40" />
            <div className="orb orb-coral -right-8 bottom-10 h-32 w-32 opacity-30" style={{ animationDelay: '-4s' }} />
            <div className="relative">
              <h3 className="text-xl font-bold font-heading">Contact Information</h3>
              <p className="text-sm text-slate-400">
                Our travel specialists are available Mondays to Saturdays, 8:00 AM – 7:00 PM (PHT).
              </p>
            </div>

            <div className="relative space-y-4 pt-4 text-sm">
              <div className="flex items-start gap-3">
                <MapPin className="h-5 w-5 text-emerald-400 shrink-0 mt-0.5" />
                <div className="min-w-0">
                  <p className="font-semibold text-white">Main Operations HQ</p>
                  <p className="text-slate-400 text-xs">Bonifacio Global City, Taguig, Metro Manila, Philippines</p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <Phone className="h-5 w-5 text-emerald-400 shrink-0 mt-0.5" />
                <div className="min-w-0">
                  <p className="font-semibold text-white">Telephone</p>
                  <p className="text-slate-400 text-xs">+63 (2) 8876-5432 / +63 917 123 4567</p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <Mail className="h-5 w-5 text-emerald-400 shrink-0 mt-0.5" />
                <div className="min-w-0">
                  <p className="font-semibold text-white">Support Email</p>
                  <p className="text-slate-400 text-xs break-all">support@lakbay.ph</p>
                </div>
              </div>
            </div>

            <div id="cancellation" className="relative pt-6 border-t border-slate-800">
              <h4 className="font-bold text-sm text-emerald-400 mb-1">Standard Cancellation Notice</h4>
              <p className="text-xs text-slate-400 leading-relaxed">
                Eligible early cancellations must be submitted through your customer dashboard on or before the package cutoff threshold (typically 7 days prior to departure) for automatic Stripe refund processing.
              </p>
            </div>
          </div>

          {/* Contact Form */}
          <div className="md:col-span-7 min-w-0 rounded-2xl border border-slate-200 bg-white p-5 sm:p-8 md:p-6 lg:p-8 shadow-lg shadow-slate-200/50">
            {submitted ? (
              <div role="status" className="text-center py-8 sm:py-12">
                <CheckCircle2 className="h-14 w-14 text-emerald-600 mx-auto mb-4" />
                <h3 className="text-2xl font-bold text-slate-900 font-heading">Message Sent!</h3>
                <p className="text-slate-600 text-sm mt-2">
                  Thank you for reaching out. One of our support coordinators will get back to you shortly.
                </p>
                <Button onClick={() => setSubmitted(false)} className="mt-6 h-11 sm:h-10 w-full sm:w-auto">
                  Send Another Message
                </Button>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-4">
                <h3 className="text-xl font-bold text-slate-900 font-heading mb-4">Send Us an Inquiry</h3>

                <div>
                  <Label htmlFor="contact-name" className="text-xs font-semibold text-slate-700">
                    Your Full Name <span className="text-red-600" aria-hidden="true">*</span>
                  </Label>
                  <Input
                    id="contact-name"
                    type="text"
                    required
                    placeholder="Maria Santos"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="mt-1"
                  />
                </div>

                <div>
                  <Label htmlFor="contact-email" className="text-xs font-semibold text-slate-700">
                    Email Address <span className="text-red-600" aria-hidden="true">*</span>
                  </Label>
                  <Input
                    id="contact-email"
                    type="email"
                    required
                    placeholder="maria@example.com"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    className="mt-1"
                  />
                </div>

                <div>
                  <Label htmlFor="contact-subject" className="text-xs font-semibold text-slate-700">
                    Subject <span className="text-red-600" aria-hidden="true">*</span>
                  </Label>
                  <Input
                    id="contact-subject"
                    type="text"
                    required
                    placeholder="Question about El Nido 4D3N departure..."
                    value={formData.subject}
                    onChange={(e) => setFormData({ ...formData, subject: e.target.value })}
                    className="mt-1"
                  />
                </div>

                <div>
                  <Label htmlFor="contact-message" className="text-xs font-semibold text-slate-700">
                    Message <span className="text-red-600" aria-hidden="true">*</span>
                  </Label>
                  <Textarea
                    id="contact-message"
                    rows={4}
                    required
                    placeholder="Write your message or inquiry here..."
                    value={formData.message}
                    onChange={(e) => setFormData({ ...formData, message: e.target.value })}
                    className="mt-1"
                  />
                </div>

                <Button type="submit" className="w-full font-bold h-11">
                  <Send className="h-4 w-4 mr-2" />
                  Send Message
                </Button>
              </form>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
