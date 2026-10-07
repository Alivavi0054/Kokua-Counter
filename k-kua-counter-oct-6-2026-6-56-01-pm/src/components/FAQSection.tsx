import React, { useState, useMemo } from 'react';
import { useApp } from '../context/AppContext';
import { FAQS } from '../data/mockData';
import { FAQItem } from '../types';
import {
  ChevronDown,
  Search,
  X,
  ShieldCheck,
  Heart,
  Utensils,
  Store,
  Sparkles,
  ArrowRight,
  HelpCircle,
  CheckCircle2,
} from 'lucide-react';

export const FAQSection: React.FC = () => {
  const { setCurrentPage } = useApp();

  const [activeCategory, setActiveCategory] = useState<'all' | 'students' | 'donors' | 'eateries'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedId, setExpandedId] = useState<string | null>('faq-eligibility-1');

  // Filtered FAQs based on category and query
  const filteredFaqs = useMemo(() => {
    return FAQS.filter((item: FAQItem) => {
      const matchesCategory =
        activeCategory === 'all' || item.category === activeCategory;
      const q = searchQuery.toLowerCase().trim();
      const matchesSearch =
        !q ||
        item.question.toLowerCase().includes(q) ||
        item.answer.toLowerCase().includes(q) ||
        item.categoryLabel.toLowerCase().includes(q) ||
        (item.highlight && item.highlight.toLowerCase().includes(q));

      return matchesCategory && matchesSearch;
    });
  }, [activeCategory, searchQuery]);

  const toggleAccordion = (id: string) => {
    setExpandedId((prev) => (prev === id ? null : id));
  };

  return (
    <section id="faq-section" className="py-16 sm:py-24 bg-[#FAF8F5] border-b border-stone-200/80">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 space-y-12">
        {/* Section Header */}
        <div className="max-w-3xl mx-auto text-center space-y-4">
          <div className="inline-flex items-center gap-2 text-xs font-semibold text-[#24503B] bg-[#E7EFEA] px-3.5 py-1.5 rounded-full">
            <HelpCircle className="w-3.5 h-3.5 text-[#24503B]" />
            <span>Transparency, Eligibility & Meal Usage</span>
          </div>
          <h2 className="font-serif text-3xl sm:text-4xl lg:text-5xl font-bold text-[#132A1E] text-balance leading-tight">
            Clear Answers for Students, Donors, and Eateries
          </h2>
          <p className="text-stone-600 text-sm sm:text-base leading-relaxed">
            Everything you need to know about qualifying for confidential meal credits, how passes redeem at local counters, and how 100% of donor contributions support our island community.
          </p>
        </div>

        {/* 3 Quick Assurance Banners */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          <div className="bg-white rounded-2xl p-5 border border-stone-200/90 shadow-sm flex items-start gap-3.5">
            <div className="w-10 h-10 rounded-xl bg-[#E7EFEA] text-[#24503B] flex items-center justify-center shrink-0">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div className="space-y-1">
              <h3 className="text-xs font-bold text-stone-900 uppercase tracking-wide">
                No Stigma or Means Testing
              </h3>
              <p className="text-xs text-stone-600 leading-relaxed">
                Eligible with active @hawaii.edu email. FERPA protected; no invasive financial interrogations.
              </p>
            </div>
          </div>

          <div className="bg-white rounded-2xl p-5 border border-stone-200/90 shadow-sm flex items-start gap-3.5">
            <div className="w-10 h-10 rounded-xl bg-[#FCECE8] text-[#C8583D] flex items-center justify-center shrink-0">
              <Heart className="w-5 h-5" />
            </div>
            <div className="space-y-1">
              <h3 className="text-xs font-bold text-stone-900 uppercase tracking-wide">
                100% Meal Pass-Through
              </h3>
              <p className="text-xs text-stone-600 leading-relaxed">
                Every $12 donated reimburses kitchen meals. Zero overhead taken from individual donors.
              </p>
            </div>
          </div>

          <div className="bg-white rounded-2xl p-5 border border-stone-200/90 shadow-sm flex items-start gap-3.5">
            <div className="w-10 h-10 rounded-xl bg-[#E2F0F2] text-[#2A6F78] flex items-center justify-center shrink-0">
              <Utensils className="w-5 h-5" />
            </div>
            <div className="space-y-1">
              <h3 className="text-xs font-bold text-stone-900 uppercase tracking-wide">
                1 Credit = 1 Full Hot Plate
              </h3>
              <p className="text-xs text-stone-600 leading-relaxed">
                Valid at partner counters like Mānoa Valley Plate & Bowl for wholesome, prepared entrees.
              </p>
            </div>
          </div>
        </div>

        {/* Search & Category Filter Controls */}
        <div className="space-y-4">
          <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
            {/* Category Segmented Buttons (Interactive filter controls complying with skill) */}
            <div className="flex items-center gap-1 p-1 bg-[#EAE4D9]/70 rounded-xl overflow-x-auto">
              <button
                type="button"
                onClick={() => setActiveCategory('all')}
                className={`px-3.5 py-2 text-xs font-semibold rounded-lg whitespace-nowrap transition-all ${
                  activeCategory === 'all'
                    ? 'bg-white text-stone-900 shadow-sm'
                    : 'text-stone-600 hover:text-stone-900'
                }`}
              >
                All Questions ({FAQS.length})
              </button>
              <button
                type="button"
                onClick={() => setActiveCategory('students')}
                className={`px-3.5 py-2 text-xs font-semibold rounded-lg whitespace-nowrap transition-all flex items-center gap-1.5 ${
                  activeCategory === 'students'
                    ? 'bg-white text-[#24503B] shadow-sm'
                    : 'text-stone-600 hover:text-stone-900'
                }`}
              >
                <Utensils className="w-3.5 h-3.5" />
                <span>For Students (Eligibility & Pass)</span>
              </button>
              <button
                type="button"
                onClick={() => setActiveCategory('donors')}
                className={`px-3.5 py-2 text-xs font-semibold rounded-lg whitespace-nowrap transition-all flex items-center gap-1.5 ${
                  activeCategory === 'donors'
                    ? 'bg-white text-[#C8583D] shadow-sm'
                    : 'text-stone-600 hover:text-stone-900'
                }`}
              >
                <Heart className="w-3.5 h-3.5" />
                <span>For Donors (Trust & Tax)</span>
              </button>
              <button
                type="button"
                onClick={() => setActiveCategory('eateries')}
                className={`px-3.5 py-2 text-xs font-semibold rounded-lg whitespace-nowrap transition-all flex items-center gap-1.5 ${
                  activeCategory === 'eateries'
                    ? 'bg-white text-[#2A6F78] shadow-sm'
                    : 'text-stone-600 hover:text-stone-900'
                }`}
              >
                <Store className="w-3.5 h-3.5" />
                <span>For Eatery Partners</span>
              </button>
            </div>

            {/* Search Input Box */}
            <div className="relative min-w-[260px] sm:min-w-[300px]">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-stone-400">
                <Search className="w-4 h-4" />
              </div>
              <input
                type="text"
                placeholder="Search eligibility, dietary, receipts..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-8 py-2 text-xs rounded-xl border border-stone-200 bg-white placeholder:text-stone-400 focus:outline-none focus:border-[#24503B] focus:ring-1 focus:ring-[#24503B]"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="absolute inset-y-0 right-0 pr-2.5 flex items-center text-stone-400 hover:text-stone-700"
                  aria-label="Clear search query"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>

          {/* Results feedback if searching */}
          {searchQuery && (
            <div className="text-xs text-stone-500 flex items-center justify-between px-1">
              <span>
                Found {filteredFaqs.length} question{filteredFaqs.length === 1 ? '' : 's'} matching "{searchQuery}"
              </span>
              <button
                onClick={() => setSearchQuery('')}
                className="text-[#24503B] hover:underline"
              >
                Reset search
              </button>
            </div>
          )}
        </div>

        {/* Accordion FAQ List */}
        <div className="space-y-4">
          {filteredFaqs.length > 0 ? (
            filteredFaqs.map((item) => {
              const isExpanded = expandedId === item.id;
              return (
                <div
                  key={item.id}
                  className={`bg-white rounded-2xl border transition-all duration-200 overflow-hidden shadow-sm ${
                    isExpanded
                      ? 'border-[#24503B] ring-1 ring-[#24503B]/20 shadow-md'
                      : 'border-stone-200/80 hover:border-stone-300'
                  }`}
                >
                  <button
                    type="button"
                    onClick={() => toggleAccordion(item.id)}
                    aria-expanded={isExpanded}
                    aria-controls={`faq-answer-${item.id}`}
                    className="w-full p-5 sm:p-6 text-left flex items-start justify-between gap-4 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#24503B]"
                  >
                    <div className="space-y-1">
                      {/* Zero-pill metadata tag complying with skill */}
                      <div className="text-[11px] font-semibold text-stone-500 uppercase tracking-wider flex items-center gap-1.5">
                        <span>{item.categoryLabel}</span>
                        <span aria-hidden="true">·</span>
                        <span className="text-stone-400">Kōkua Trust Standards</span>
                      </div>
                      <h3 className="font-serif text-lg sm:text-xl font-bold text-stone-900 text-balance leading-snug">
                        {item.question}
                      </h3>
                    </div>

                    <div
                      className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 transition-transform duration-200 ${
                        isExpanded
                          ? 'rotate-180 bg-[#E7EFEA] text-[#24503B]'
                          : 'bg-stone-100 text-stone-500'
                      }`}
                    >
                      <ChevronDown className="w-4 h-4" />
                    </div>
                  </button>

                  {isExpanded && (
                    <div
                      id={`faq-answer-${item.id}`}
                      className="px-5 pb-6 sm:px-6 pt-1 border-t border-stone-100 space-y-4 text-xs sm:text-sm text-stone-700 leading-relaxed animate-in fade-in duration-150"
                    >
                      <p>{item.answer}</p>

                      {/* Highlight callout note */}
                      {item.highlight && (
                        <div className="bg-[#FAF8F5] border-l-3 border-[#24503B] p-3 rounded-r-xl text-xs text-stone-800 flex items-start gap-2">
                          <CheckCircle2 className="w-4 h-4 text-[#24503B] shrink-0 mt-0.5" />
                          <span className="font-medium">{item.highlight}</span>
                        </div>
                      )}

                      {/* Direct CTA shortcut */}
                      {item.relatedAction && (
                        <div className="pt-2">
                          <button
                            type="button"
                            onClick={() => setCurrentPage(item.relatedAction!.target)}
                            className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#24503B] hover:text-[#18392B] underline decoration-[#24503B]/40 underline-offset-4"
                          >
                            <span>{item.relatedAction.label}</span>
                            <ArrowRight className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })
          ) : (
            <div className="bg-white rounded-2xl p-10 text-center border border-stone-200 space-y-3">
              <HelpCircle className="w-10 h-10 text-stone-300 mx-auto" />
              <h4 className="font-serif text-lg font-bold text-stone-800">
                No matching questions found
              </h4>
              <p className="text-xs text-stone-500 max-w-sm mx-auto">
                We couldn't find an answer for "{searchQuery}". Try browsing by category or reach out to our team directly.
              </p>
              <button
                type="button"
                onClick={() => {
                  setSearchQuery('');
                  setActiveCategory('all');
                }}
                className="mt-2 text-xs font-semibold text-[#24503B] hover:underline"
              >
                Clear all filters
              </button>
            </div>
          )}
        </div>

        {/* Direct Contact & Support Box */}
        <div className="bg-[#EAE4D9]/50 rounded-3xl p-6 sm:p-8 border border-stone-200/90 flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="space-y-1 text-center md:text-left">
            <h4 className="font-serif text-xl font-bold text-[#18392B]">
              Have a question not listed here?
            </h4>
            <p className="text-xs text-stone-600 max-w-lg leading-relaxed">
              Our campus team is here to help students access nourishment and assist community donors with customized fund endowments.
            </p>
          </div>

          <div className="flex flex-col sm:flex-row items-center gap-3 w-full md:w-auto">
            <a
              href="mailto:aloha@kokuacounter.org"
              className="w-full sm:w-auto text-center px-4 py-2.5 text-xs font-semibold text-[#18392B] bg-white hover:bg-stone-50 border border-stone-300 rounded-xl transition-colors shadow-sm"
            >
              Email aloha@kokuacounter.org
            </a>
            <button
              type="button"
              onClick={() => setCurrentPage('donate')}
              className="w-full sm:w-auto px-5 py-2.5 text-xs font-semibold text-white bg-[#E27357] hover:bg-[#C8583D] rounded-xl shadow-sm transition-colors whitespace-nowrap"
            >
              Donate a Meal ($12)
            </button>
          </div>
        </div>
      </div>
    </section>
  );
};
