import React from 'react';
import { useApp } from '../context/AppContext';
import { Heart, MapPin, Mail, ShieldCheck } from 'lucide-react';

export const Footer: React.FC = () => {
  const { setCurrentPage } = useApp();

  return (
    <footer className="bg-[#18392B] text-stone-300 pt-16 pb-12 border-t border-[#24503B]/60">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-10 pb-12 border-b border-[#24503B]/50">
          {/* Brand & Purpose Column */}
          <div className="md:col-span-1 space-y-4">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-[#FAF8F5] flex items-center justify-center text-[#18392B]">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
                </svg>
              </div>
              <span className="font-serif text-xl font-bold text-white tracking-tight">
                Kōkua Counter
              </span>
            </div>
            <p className="text-sm text-stone-300 leading-relaxed">
              A nonprofit initiative bridging food security and student dignity across University of Hawaiʻi campuses. We connect donor generosity directly with independent local eateries.
            </p>
            <div className="flex items-center gap-2 text-xs text-stone-400">
              <ShieldCheck className="w-4 h-4 text-[#A3E0C8]" />
              <span>501(c)(3) Registered Public Charity · EIN: 99-0418291</span>
            </div>
          </div>

          {/* Quick Links */}
          <div className="space-y-3">
            <h4 className="text-xs font-semibold text-[#A3E0C8] uppercase tracking-wider">
              Platform & Access
            </h4>
            <ul className="space-y-2 text-sm">
              <li>
                <button
                  onClick={() => setCurrentPage('landing')}
                  className="hover:text-white transition-colors text-left"
                >
                  Our Mission & Values
                </button>
              </li>
              <li>
                <button
                  onClick={() => setCurrentPage('dashboard')}
                  className="hover:text-white transition-colors text-left"
                >
                  Student Meal Pass Portal
                </button>
              </li>
              <li>
                <button
                  onClick={() => setCurrentPage('eatery')}
                  className="hover:text-white transition-colors text-left"
                >
                  Participating Eatery Terminal
                </button>
              </li>
              <li>
                <button
                  onClick={() => setCurrentPage('donate')}
                  className="text-[#F5A38F] hover:text-white transition-colors text-left font-medium"
                >
                  Donate a Meal ($12 / plate)
                </button>
              </li>
            </ul>
          </div>

          {/* Community & Campus */}
          <div className="space-y-3">
            <h4 className="text-xs font-semibold text-[#A3E0C8] uppercase tracking-wider">
              Campus Partners
            </h4>
            <ul className="space-y-2 text-sm text-stone-300">
              <li>UH Mānoa Office of Student Success</li>
              <li>UH Student Food Pantry Committee</li>
              <li>UH Hilo & West Oʻahu Basic Needs</li>
              <li>Hawaiʻi Farm Bureau Local Dining Coalition</li>
            </ul>
          </div>

          {/* Contact & Location */}
          <div className="space-y-3">
            <h4 className="text-xs font-semibold text-[#A3E0C8] uppercase tracking-wider">
              Contact & Location
            </h4>
            <div className="space-y-2 text-sm text-stone-300">
              <p className="flex items-start gap-2">
                <MapPin className="w-4 h-4 text-[#A3E0C8] shrink-0 mt-0.5" />
                <span>Campus Center Suite 208, 2465 Campus Rd, Honolulu, HI 96822</span>
              </p>
              <p className="flex items-center gap-2">
                <Mail className="w-4 h-4 text-[#A3E0C8] shrink-0" />
                <a href="mailto:aloha@kokuacounter.org" className="hover:text-white underline decoration-stone-500">
                  aloha@kokuacounter.org
                </a>
              </p>
            </div>
            <div className="pt-2">
              <div className="text-xs text-stone-400">
                100% of individual meal donations are disbursed directly to partner kitchens. Zero platform extraction fees.
              </div>
            </div>
          </div>
        </div>

        {/* Bottom bar with legal notices */}
        <div className="pt-8 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-stone-400">
          <p>
            © {new Date().getFullYear()} Kōkua Counter Inc. Mālama one another. All rights reserved.
          </p>
          <div className="flex items-center gap-6">
            <button
              onClick={() => setCurrentPage('privacy')}
              className="hover:text-white transition-colors underline decoration-stone-600"
            >
              Privacy Policy & FERPA
            </button>
            <button
              onClick={() => setCurrentPage('terms')}
              className="hover:text-white transition-colors underline decoration-stone-600"
            >
              Terms of Service
            </button>
            <span className="hidden md:inline text-stone-500">·</span>
            <span className="text-[#A3E0C8] flex items-center gap-1">
              <Heart className="w-3.5 h-3.5 fill-[#E27357] text-transparent inline" />
              Honolulu, Hawaiʻi
            </span>
          </div>
        </div>
      </div>
    </footer>
  );
};
