import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { Menu, X, Heart, User, Store } from 'lucide-react';

export const Header: React.FC = () => {
  const { currentPage, setCurrentPage, currentUser, logout } = useApp();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <>
      {/* Perspective Switcher / Reviewer Helper Ribbon (discreet, accessible) */}
      <aside aria-label="Demo view switcher" className="bg-[#18392B] text-stone-200 text-xs px-4 py-1.5 border-b border-[#24503B]/40">
        <div className="max-w-7xl mx-auto flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-2">
            <span className="text-[#A3E0C8] font-medium tracking-wide">University of Hawaiʻi Non-Profit Initiative</span>
            <span aria-hidden="true" className="text-stone-500">·</span>
            <span className="text-stone-300 hidden sm:inline">501(c)(3) Fiscal Sponsor</span>
          </div>
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-stone-400 mr-1 text-[11px]">View flows:</span>
            <button
              onClick={() => setCurrentPage('landing')}
              className={`px-2 py-0.5 rounded text-[11px] font-medium transition-colors ${
                currentPage === 'landing' ? 'bg-[#2F664C] text-white' : 'text-stone-300 hover:text-white'
              }`}
            >
              Public
            </button>
            <button
              onClick={() => setCurrentPage('donate')}
              className={`px-2 py-0.5 rounded text-[11px] font-medium transition-colors ${
                currentPage === 'donate' ? 'bg-[#2F664C] text-white' : 'text-stone-300 hover:text-white'
              }`}
            >
              Donate
            </button>
            <button
              onClick={() => setCurrentPage('signin')}
              className={`px-2 py-0.5 rounded text-[11px] font-medium transition-colors ${
                currentPage === 'signin' ? 'bg-[#2F664C] text-white' : 'text-stone-300 hover:text-white'
              }`}
            >
              Student Auth
            </button>
            <button
              onClick={() => setCurrentPage('dashboard')}
              className={`px-2 py-0.5 rounded text-[11px] font-medium transition-colors ${
                currentPage === 'dashboard' ? 'bg-[#2F664C] text-white' : 'text-stone-300 hover:text-white'
              }`}
            >
              Student Pass
            </button>
            <button
              onClick={() => setCurrentPage('eatery')}
              className={`px-2 py-0.5 rounded text-[11px] font-medium transition-colors ${
                currentPage === 'eatery' ? 'bg-[#2F664C] text-white' : 'text-stone-300 hover:text-white'
              }`}
            >
              Eatery Counter
            </button>
          </div>
        </div>
      </aside>

      {/* Main Top Bar strictly obeying Top Bar Contract */}
      <header className="sticky top-0 z-40 bg-[#FAF8F5]/95 backdrop-blur-md border-b border-stone-200/80 transition-colors">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-18 flex items-center justify-between">
          {/* Zone 1: Brand title, single line text element */}
          <button
            onClick={() => setCurrentPage('landing')}
            className="flex items-center gap-2 group text-left cursor-pointer focus-visible:ring-2 focus-visible:ring-[#24503B] rounded-md"
            aria-label="Kōkua Counter Home"
          >
            <div className="w-8 h-8 rounded-lg bg-[#24503B] flex items-center justify-center text-[#F7F4EE] shadow-sm group-hover:bg-[#1B3B2B] transition-colors">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
              </svg>
            </div>
            <span className="font-serif text-2xl font-bold tracking-tight text-[#18392B] group-hover:text-[#132A1E] transition-colors">
              Kōkua Counter
            </span>
          </button>

          {/* Zone 2: 4-6 nav links, 1-2 word labels, single-line */}
          <nav className="hidden md:flex items-center gap-7 text-sm font-medium text-stone-700">
            <button
              onClick={() => setCurrentPage('landing')}
              className={`transition-colors whitespace-nowrap hover:text-[#18392B] ${
                currentPage === 'landing' ? 'text-[#18392B] font-semibold underline underline-offset-8 decoration-2 decoration-[#24503B]' : ''
              }`}
            >
              Mission
            </button>
            <button
              onClick={() => {
                setCurrentPage('landing');
                setTimeout(() => {
                  const el = document.getElementById('eateries-section');
                  el?.scrollIntoView({ behavior: 'smooth' });
                }, 100);
              }}
              className="transition-colors whitespace-nowrap hover:text-[#18392B]"
            >
              Eateries
            </button>
            <button
              onClick={() => setCurrentPage('dashboard')}
              className={`transition-colors whitespace-nowrap hover:text-[#18392B] ${
                currentPage === 'dashboard' ? 'text-[#18392B] font-semibold underline underline-offset-8 decoration-2 decoration-[#24503B]' : ''
              }`}
            >
              Student Pass
            </button>
            <button
              onClick={() => setCurrentPage('eatery')}
              className={`transition-colors whitespace-nowrap hover:text-[#18392B] ${
                currentPage === 'eatery' ? 'text-[#18392B] font-semibold underline underline-offset-8 decoration-2 decoration-[#24503B]' : ''
              }`}
            >
              Eatery Terminal
            </button>
            <button
              onClick={() => {
                setCurrentPage('landing');
                setTimeout(() => {
                  const el = document.getElementById('impact-section');
                  el?.scrollIntoView({ behavior: 'smooth' });
                }, 100);
              }}
              className="transition-colors whitespace-nowrap hover:text-[#18392B]"
            >
              Impact
            </button>
          </nav>

          {/* Zone 3: 1-2 primary actions */}
          <div className="hidden md:flex items-center gap-3">
            {currentUser ? (
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setCurrentPage('dashboard')}
                  className="flex items-center gap-2 px-3 py-1.5 text-xs font-semibold text-[#18392B] bg-[#EAE4D9]/60 hover:bg-[#E2D7C5] rounded-lg transition-colors border border-stone-200/70"
                >
                  <img
                    src={currentUser.photoUrl}
                    alt={currentUser.name}
                    className="w-5 h-5 rounded-full object-cover"
                  />
                  <span>{currentUser.name.split(' ')[0]} ({currentUser.creditsRemaining} meals)</span>
                </button>
                <button
                  onClick={logout}
                  className="text-xs text-stone-500 hover:text-stone-800 transition-colors px-2 py-1"
                >
                  Sign Out
                </button>
              </div>
            ) : (
              <button
                onClick={() => setCurrentPage('signin')}
                className="px-3.5 py-2 text-xs font-semibold text-[#18392B] hover:text-stone-900 transition-colors"
              >
                Student Sign In
              </button>
            )}

            <button
              onClick={() => setCurrentPage('donate')}
              className="flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-[#E27357] hover:bg-[#C8583D] rounded-lg shadow-sm transition-all whitespace-nowrap active:scale-[0.98]"
            >
              <Heart className="w-3.5 h-3.5 fill-white/20" />
              <span>Donate a Meal</span>
            </button>
          </div>

          {/* Mobile hamburger button */}
          <div className="flex items-center gap-2 md:hidden">
            <button
              onClick={() => setCurrentPage('donate')}
              className="px-3 py-1.5 text-xs font-semibold text-white bg-[#E27357] rounded-md shadow-sm"
            >
              Donate
            </button>
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="p-2 text-stone-700 hover:text-stone-900 rounded-md focus:outline-none"
              aria-label="Toggle navigation menu"
            >
              {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
            </button>
          </div>
        </div>

        {/* Mobile Navigation Drawer */}
        {mobileMenuOpen && (
          <div className="md:hidden border-t border-stone-200 bg-[#FAF8F5] px-4 pt-3 pb-6 space-y-2 shadow-lg animate-in slide-in-from-top duration-200">
            <button
              onClick={() => {
                setCurrentPage('landing');
                setMobileMenuOpen(false);
              }}
              className="block w-full text-left px-3 py-2 text-sm font-medium text-stone-800 hover:bg-stone-100 rounded-md"
            >
              Mission & Model
            </button>
            <button
              onClick={() => {
                setCurrentPage('dashboard');
                setMobileMenuOpen(false);
              }}
              className="flex items-center justify-between w-full text-left px-3 py-2 text-sm font-medium text-stone-800 hover:bg-stone-100 rounded-md"
            >
              <span>Student Meal Pass</span>
              {currentUser && (
                <span className="text-xs font-semibold text-[#24503B] bg-emerald-50 px-2 py-0.5 rounded">
                  {currentUser.creditsRemaining} Credits Left
                </span>
              )}
            </button>
            <button
              onClick={() => {
                setCurrentPage('eatery');
                setMobileMenuOpen(false);
              }}
              className="flex items-center gap-2 w-full text-left px-3 py-2 text-sm font-medium text-stone-800 hover:bg-stone-100 rounded-md"
            >
              <Store className="w-4 h-4 text-[#2A6F78]" />
              <span>Eatery Staff Screen</span>
            </button>
            <button
              onClick={() => {
                setCurrentPage('donate');
                setMobileMenuOpen(false);
              }}
              className="flex items-center gap-2 w-full text-left px-3 py-2 text-sm font-medium text-[#C8583D] hover:bg-stone-100 rounded-md"
            >
              <Heart className="w-4 h-4" />
              <span>Make a Donation</span>
            </button>
            <div className="pt-2 border-t border-stone-200/80">
              {currentUser ? (
                <div className="flex items-center justify-between px-3 py-2">
                  <div className="flex items-center gap-2">
                    <img src={currentUser.photoUrl} alt="" className="w-6 h-6 rounded-full" />
                    <span className="text-xs font-medium text-stone-700">{currentUser.name}</span>
                  </div>
                  <button
                    onClick={() => {
                      logout();
                      setMobileMenuOpen(false);
                    }}
                    className="text-xs text-stone-500 hover:text-stone-800"
                  >
                    Sign Out
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => {
                    setCurrentPage('signin');
                    setMobileMenuOpen(false);
                  }}
                  className="w-full text-center px-4 py-2 text-xs font-semibold text-[#18392B] bg-[#EAE4D9] rounded-lg"
                >
                  Student Sign In
                </button>
              )}
            </div>
          </div>
        )}
      </header>
    </>
  );
};
