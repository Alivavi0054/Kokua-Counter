import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { APP_IMAGES } from '../data/mockData';
import { FAQSection } from '../components/FAQSection';
import {
  Heart,
  ArrowRight,
  ShieldCheck,
  CheckCircle2,
  Utensils,
  Sparkles,
  MapPin,
  Clock,
  ExternalLink,
} from 'lucide-react';

export const LandingPage: React.FC = () => {
  const { setCurrentPage, totalMealsFunded, eateries } = useApp();
  const [selectedCampusFilter, setSelectedCampusFilter] = useState<'all' | 'manoa' | 'kaimuki'>('all');

  const filteredEateries = eateries.filter((eatery) => {
    if (selectedCampusFilter === 'manoa') return eatery.neighborhood.toLowerCase().includes('mānoa');
    if (selectedCampusFilter === 'kaimuki') return eatery.neighborhood.toLowerCase().includes('kaimukī');
    return true;
  });

  return (
    <div className="min-h-screen bg-[#FAF8F5]">
      {/* 1. Hero Section */}
      <section className="relative overflow-hidden pt-10 pb-16 lg:pt-16 lg:pb-24 border-b border-stone-200/70">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-8 items-center">
            {/* Left Column: Proposition & CTAs */}
            <div className="lg:col-span-7 space-y-6">
              <div className="inline-flex items-center gap-2 text-xs font-semibold tracking-wide text-[#24503B] bg-[#E7EFEA] px-3.5 py-1.5 rounded-full">
                <Sparkles className="w-3.5 h-3.5 text-[#24503B]" />
                <span>University of Hawaiʻi Student Food Security Initiative</span>
              </div>

              <h1 className="font-serif text-4xl sm:text-5xl lg:text-6xl font-bold tracking-tight text-[#132A1E] leading-[1.12] text-balance">
                No student studies on an empty stomach in Hawaiʻi.
              </h1>

              <p className="text-base sm:text-lg text-stone-700 leading-relaxed max-w-2xl">
                Kōkua Counter turns community generosity into confidential, prepaid meal passes for University of Hawaiʻi students at beloved local neighborhood eateries. Dignity-first, stigma-free, and nourishing our island future.
              </p>

              {/* Action Buttons */}
              <div className="pt-2 flex flex-col sm:flex-row items-stretch sm:items-center gap-3.5">
                <button
                  onClick={() => setCurrentPage('donate')}
                  className="inline-flex items-center justify-center gap-2 px-6 py-3.5 text-sm font-semibold text-white bg-[#E27357] hover:bg-[#C8583D] rounded-xl shadow-sm hover:shadow transition-all whitespace-nowrap active:scale-[0.98]"
                >
                  <Heart className="w-4 h-4 fill-white/20" />
                  <span>Donate a Meal ($12)</span>
                  <ArrowRight className="w-4 h-4" />
                </button>

                <button
                  onClick={() => setCurrentPage('signin')}
                  className="inline-flex items-center justify-center gap-2 px-6 py-3.5 text-sm font-semibold text-[#18392B] bg-[#FAF8F5] hover:bg-[#F2ECE1] border border-stone-300 rounded-xl transition-all whitespace-nowrap"
                >
                  <Utensils className="w-4 h-4 text-[#24503B]" />
                  <span>Student Pass Portal</span>
                </button>
              </div>

              {/* Trust Indicators */}
              <div className="pt-6 border-t border-stone-200/90 grid grid-cols-3 gap-4">
                <div>
                  <div className="font-serif text-2xl sm:text-3xl font-bold text-[#18392B] tabular-nums">
                    {totalMealsFunded.toLocaleString()}+
                  </div>
                  <div className="text-xs text-stone-600 mt-0.5">Hot meals served</div>
                </div>
                <div>
                  <div className="font-serif text-2xl sm:text-3xl font-bold text-[#2A6F78] tabular-nums">
                    100%
                  </div>
                  <div className="text-xs text-stone-600 mt-0.5">Disbursed to kitchens</div>
                </div>
                <div>
                  <div className="font-serif text-2xl sm:text-3xl font-bold text-[#24503B] tabular-nums">
                    0 Stigma
                  </div>
                  <div className="text-xs text-stone-600 mt-0.5">Private digital pass</div>
                </div>
              </div>
            </div>

            {/* Right Column: Hero Visual Asset with Scrim & Caption */}
            <div className="lg:col-span-5 relative">
              <div className="relative rounded-2xl overflow-hidden shadow-xl border border-stone-200/80 aspect-4/3 lg:aspect-5/4 group bg-stone-200">
                <img
                  src={APP_IMAGES.hero}
                  alt="University of Hawaiʻi students sharing wholesome meal plates outdoors under shade trees"
                  className="w-full h-full object-cover group-hover:scale-[1.02] transition-transform duration-500"
                  referrerPolicy="no-referrer"
                  onError={(e) => {
                    // Fallback container
                    (e.target as HTMLElement).style.display = 'none';
                  }}
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/20 to-transparent flex flex-col justify-end p-6 text-white">
                  <div className="text-xs font-medium text-[#A3E0C8] tracking-wide uppercase">
                    Mālama kekahi i kekahi
                  </div>
                  <p className="font-serif text-lg sm:text-xl font-medium mt-1 leading-snug">
                    “Taking care of each other through the sacred act of feeding our students.”
                  </p>
                  <p className="text-xs text-stone-300 mt-2">
                    UH Mānoa Campus Courtyard & participating local kitchens
                  </p>
                </div>
              </div>

              {/* Discreet floating verification card */}
              <div className="absolute -bottom-5 -left-4 sm:left-4 bg-white/95 backdrop-blur-md rounded-xl p-3.5 border border-stone-200/90 shadow-md flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-[#E7EFEA] flex items-center justify-center text-[#24503B] shrink-0">
                  <ShieldCheck className="w-5 h-5" />
                </div>
                <div>
                  <div className="text-xs font-semibold text-stone-900">
                    FERPA & Privacy Protected
                  </div>
                  <div className="text-[11px] text-stone-600">
                    Anonymous checkout at all participating counters
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 2. The Real Challenge & Why Kōkua Exists */}
      <section className="py-16 sm:py-20 bg-[#F4EFE6]/70 border-b border-stone-200/70">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="max-w-3xl mx-auto text-center space-y-4 mb-14">
            <span className="text-xs font-semibold text-[#24503B] uppercase tracking-wider">
              The Reality on Island
            </span>
            <h2 className="font-serif text-3xl sm:text-4xl font-bold text-[#18392B] text-balance">
              Hawaiʻi students face some of the highest cost-of-living burdens in the nation.
            </h2>
            <p className="text-stone-700 text-base leading-relaxed">
              Nearly 1 in 2 university students in Hawaiʻi skip meals to afford rent, tuition, and basic living essentials. Traditional food drives provide shelf-stable groceries, but working students with packed schedules need hot, fresh, culturally comforting food they can eat between classes.
            </p>
          </div>

          {/* 3 Pillars */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="bg-white rounded-2xl p-7 border border-stone-200/80 shadow-sm flex flex-col justify-between">
              <div className="space-y-3">
                <div className="w-10 h-10 rounded-xl bg-[#FCECE8] text-[#C8583D] flex items-center justify-center font-serif text-lg font-bold">
                  01
                </div>
                <h3 className="font-serif text-xl font-semibold text-stone-900">
                  Absolute Dignity & Privacy
                </h3>
                <p className="text-sm text-stone-600 leading-relaxed">
                  Students shouldn't stand in visible charity lines. The Kōkua meal pass uses a clean mobile pass that scans identically to a regular prepaid gift card.
                </p>
              </div>
              <div className="pt-4 border-t border-stone-100 flex items-center gap-1.5 text-xs text-[#24503B] font-medium">
                <CheckCircle2 className="w-4 h-4" />
                <span>Zero stigma at the checkout counter</span>
              </div>
            </div>

            <div className="bg-white rounded-2xl p-7 border border-stone-200/80 shadow-sm flex flex-col justify-between">
              <div className="space-y-3">
                <div className="w-10 h-10 rounded-xl bg-[#E7EFEA] text-[#24503B] flex items-center justify-center font-serif text-lg font-bold">
                  02
                </div>
                <h3 className="font-serif text-xl font-semibold text-stone-900">
                  Direct Economic Reciprocity
                </h3>
                <p className="text-sm text-stone-600 leading-relaxed">
                  Every meal dollar is paid directly to mom-and-pop eateries and local plate lunch counters in Mānoa, Kaimukī, and Moʻiliʻili. It strengthens the island food ecosystem.
                </p>
              </div>
              <div className="pt-4 border-t border-stone-100 flex items-center gap-1.5 text-xs text-[#24503B] font-medium">
                <CheckCircle2 className="w-4 h-4" />
                <span>100% of meal funds stay in local kitchens</span>
              </div>
            </div>

            <div className="bg-white rounded-2xl p-7 border border-stone-200/80 shadow-sm flex flex-col justify-between">
              <div className="space-y-3">
                <div className="w-10 h-10 rounded-xl bg-[#E2F0F2] text-[#2A6F78] flex items-center justify-center font-serif text-lg font-bold">
                  03
                </div>
                <h3 className="font-serif text-xl font-semibold text-stone-900">
                  Nourishing Hawaiian Food
                </h3>
                <p className="text-sm text-stone-600 leading-relaxed">
                  Eligible plates include locally sourced kalo, fresh poke, poi, hearty stews, and fresh vegetable bowls — real nourishment that fuels academic stamina.
                </p>
              </div>
              <div className="pt-4 border-t border-stone-100 flex items-center gap-1.5 text-xs text-[#24503B] font-medium">
                <CheckCircle2 className="w-4 h-4" />
                <span>Wholesome, hot farm-to-table plates</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 3. Participating Eateries Showcase */}
      <section id="eateries-section" className="py-16 sm:py-20 border-b border-stone-200/70">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-10">
            <div>
              <span className="text-xs font-semibold text-[#24503B] uppercase tracking-wider">
                Neighborhood Dining Partners
              </span>
              <h2 className="font-serif text-3xl sm:text-4xl font-bold text-[#18392B] mt-1">
                Where students redeem warm plates today
              </h2>
              <p className="text-sm text-stone-600 mt-2 max-w-xl">
                Independent kitchens within walking distance or a short Biki ride from UH Mānoa and surrounding community hubs.
              </p>
            </div>

            {/* Filter buttons (Interactive filter controls complying with skill) */}
            <div className="flex items-center gap-1 p-1 bg-[#EAE4D9]/70 rounded-xl">
              <button
                onClick={() => setSelectedCampusFilter('all')}
                className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-all ${
                  selectedCampusFilter === 'all'
                    ? 'bg-white text-stone-900 shadow-sm'
                    : 'text-stone-600 hover:text-stone-900'
                }`}
              >
                All Neighborhoods ({eateries.length})
              </button>
              <button
                onClick={() => setSelectedCampusFilter('manoa')}
                className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-all ${
                  selectedCampusFilter === 'manoa'
                    ? 'bg-white text-stone-900 shadow-sm'
                    : 'text-stone-600 hover:text-stone-900'
                }`}
              >
                Mānoa Valley
              </button>
              <button
                onClick={() => setSelectedCampusFilter('kaimuki')}
                className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-all ${
                  selectedCampusFilter === 'kaimuki'
                    ? 'bg-white text-stone-900 shadow-sm'
                    : 'text-stone-600 hover:text-stone-900'
                }`}
              >
                Kaimukī
              </button>
            </div>
          </div>

          {/* Eateries Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-7">
            {filteredEateries.map((eatery) => (
              <div
                key={eatery.id}
                className="bg-white rounded-2xl border border-stone-200/90 overflow-hidden shadow-sm hover:shadow-md transition-shadow flex flex-col justify-between"
              >
                <div>
                  <div className="relative aspect-16/10 bg-stone-200 overflow-hidden">
                    <img
                      src={eatery.imageUrl}
                      alt={eatery.name}
                      className="w-full h-full object-cover"
                      referrerPolicy="no-referrer"
                    />
                    <div className="absolute top-3 left-3 bg-[#FAF8F5]/90 backdrop-blur-md px-2.5 py-1 rounded-md text-xs font-medium text-stone-800">
                      {eatery.cuisine}
                    </div>
                  </div>

                  <div className="p-6">
                    <div className="flex items-center gap-1.5 text-xs text-stone-500 mb-1.5">
                      <MapPin className="w-3.5 h-3.5 text-[#24503B]" />
                      <span>{eatery.distanceFromCampus}</span>
                      <span aria-hidden="true">·</span>
                      <span>{eatery.neighborhood}</span>
                    </div>

                    <h3 className="font-serif text-xl font-bold text-stone-900">
                      {eatery.name}
                    </h3>

                    <p className="text-xs text-stone-600 mt-2 flex items-center gap-1">
                      <Clock className="w-3.5 h-3.5 text-stone-400" />
                      <span>{eatery.operatingHours}</span>
                    </p>

                    <div className="mt-4 pt-4 border-t border-stone-100">
                      <div className="text-xs font-semibold text-stone-900 mb-2">
                        Featured Kōkua Plate:
                      </div>
                      <div className="bg-[#FAF8F5] rounded-xl p-3 border border-stone-200/60">
                        <div className="text-xs font-medium text-[#18392B]">
                          {eatery.eligibleMeals[0].name}
                        </div>
                        <p className="text-[11px] text-stone-600 mt-1 line-clamp-2">
                          {eatery.eligibleMeals[0].description}
                        </p>
                        <div className="flex items-center gap-1.5 mt-2 text-[10px] text-stone-500">
                          {eatery.eligibleMeals[0].dietary.map((d, i) => (
                            <span key={i} className="bg-stone-200/70 px-1.5 py-0.5 rounded">
                              {d}
                            </span>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="px-6 pb-6 pt-2">
                  <button
                    onClick={() => setCurrentPage('dashboard')}
                    className="w-full py-2.5 px-4 text-xs font-semibold text-[#18392B] bg-[#EAE4D9]/60 hover:bg-[#E2D7C5] rounded-xl transition-colors flex items-center justify-center gap-1.5"
                  >
                    <span>View All Eligible Plates</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>

          <div className="mt-10 text-center">
            <p className="text-sm text-stone-600">
              Own a restaurant or food counter near a University of Hawaiʻi campus?
            </p>
            <button
              onClick={() => setCurrentPage('eatery')}
              className="mt-2 inline-flex items-center gap-1.5 text-sm font-semibold text-[#24503B] hover:text-[#132A1E] underline decoration-[#24503B]/40 underline-offset-4"
            >
              <span>Explore the Eatery Staff Terminal & Onboarding</span>
              <ExternalLink className="w-4 h-4" />
            </button>
          </div>
        </div>
      </section>

      {/* 4. Concrete Impact & Attributable Voices */}
      <section id="impact-section" className="py-16 sm:py-20 bg-[#18392B] text-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
            <div className="lg:col-span-5 space-y-6">
              <span className="text-xs font-semibold text-[#A3E0C8] uppercase tracking-wider">
                Community Voices & Proven Outcomes
              </span>

              <h2 className="font-serif text-3xl sm:text-4xl font-bold leading-tight">
                “It relieved the gnawing anxiety of how I would eat dinner.”
              </h2>

              <p className="text-stone-300 text-sm sm:text-base leading-relaxed">
                Kōkua Counter was started by UH alumni and faculty who saw students struggling with basic sustenance while balancing 20-hour workweeks and full course loads.
              </p>

              <div className="pt-4 border-t border-[#24503B] space-y-4">
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-full overflow-hidden shrink-0 border border-[#A3E0C8]/40">
                    <img
                      src={APP_IMAGES.studentPortrait}
                      alt="Leilani Kealoha"
                      className="w-full h-full object-cover"
                    />
                  </div>
                  <div>
                    <div className="text-sm font-semibold text-white">Leilani Kealoha</div>
                    <div className="text-xs text-[#A3E0C8]">
                      Junior, Natural Resources Management · UH Mānoa
                    </div>
                    <p className="text-xs text-stone-300 mt-1 italic">
                      “I don't have to choose between lab textbooks and eating. When I go to the counter, it's just a normal tap. Nobody stares. It makes me feel respected.”
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-3 pt-3 border-t border-[#24503B]">
                  <div className="w-10 h-10 rounded-full bg-[#FAF8F5] text-[#18392B] flex items-center justify-center font-bold text-sm shrink-0">
                    MK
                  </div>
                  <div>
                    <div className="text-sm font-semibold text-white">Chef Marcus Kamaka</div>
                    <div className="text-xs text-[#A3E0C8]">
                      Proprietor, Mānoa Valley Plate & Bowl
                    </div>
                    <p className="text-xs text-stone-300 mt-1 italic">
                      “Every dollar donated by our neighbors is paid to our cooks on Monday. We feed our students fresh local kalo and kalua pork. It's how Hawaiʻi takes care of its own.”
                    </p>
                  </div>
                </div>
              </div>
            </div>

            <div className="lg:col-span-7">
              <div className="rounded-2xl overflow-hidden border border-[#24503B] shadow-2xl relative">
                <img
                  src={APP_IMAGES.volunteers}
                  alt="Kōkua Counter community partners in Honolulu"
                  className="w-full aspect-16/10 object-cover"
                  referrerPolicy="no-referrer"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent p-6 sm:p-8 flex flex-col justify-end">
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 text-center sm:text-left">
                    <div>
                      <div className="font-serif text-3xl font-bold text-white tabular-nums">
                        620+
                      </div>
                      <div className="text-xs text-stone-300 mt-0.5">Enrolled UH Students</div>
                    </div>
                    <div>
                      <div className="font-serif text-3xl font-bold text-[#F5A38F] tabular-nums">
                        $221,400
                      </div>
                      <div className="text-xs text-stone-300 mt-0.5">Paid to Local Eateries</div>
                    </div>
                    <div className="col-span-2 sm:col-span-1">
                      <div className="font-serif text-3xl font-bold text-[#A3E0C8] tabular-nums">
                        14 Kitchens
                      </div>
                      <div className="text-xs text-stone-300 mt-0.5">Active Island Partners</div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 5. Frequently Asked Questions (Comprehensive FAQ Component) */}
      <FAQSection />

      {/* 6. Closing Call to Action */}
      <section className="py-16 sm:py-20 bg-[#FAF8F5]">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="bg-[#EAE4D9]/60 rounded-3xl p-8 sm:p-12 border border-stone-200 text-center space-y-6">
            <h2 className="font-serif text-3xl sm:text-4xl font-bold text-[#18392B] text-balance">
              Feed a student today. Keep a neighborhood kitchen thriving.
            </h2>
            <p className="text-stone-700 max-w-2xl mx-auto text-sm sm:text-base leading-relaxed">
              For just $12, you fund a complete, nutritious hot meal for a student at the University of Hawaiʻi. 100% of your meal gift goes directly to the restaurant counter.
            </p>
            <div className="pt-2 flex flex-col sm:flex-row items-center justify-center gap-3">
              <button
                onClick={() => setCurrentPage('donate')}
                className="w-full sm:w-auto px-8 py-3.5 text-sm font-semibold text-white bg-[#E27357] hover:bg-[#C8583D] rounded-xl shadow-sm transition-all"
              >
                Donate $12 (1 Meal)
              </button>
              <button
                onClick={() => setCurrentPage('signin')}
                className="w-full sm:w-auto px-8 py-3.5 text-sm font-semibold text-[#18392B] bg-white hover:bg-stone-50 border border-stone-300 rounded-xl transition-all"
              >
                Enrolled Student? Sign In
              </button>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
};
