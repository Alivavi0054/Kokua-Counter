import React, { useState, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import {
  QrCode,
  Sparkles,
  RefreshCw,
  Clock,
  MapPin,
  Utensils,
  Receipt,
  Copy,
  Check,
  ShieldCheck,
  ArrowRight,
  Info,
  Calendar,
  AlertTriangle,
  ChevronRight,
} from 'lucide-react';

export const StudentDashboard: React.FC = () => {
  const {
    currentUser,
    redemptions,
    eateries,
    redeemMeal,
    reloadStudentCredits,
    setCurrentPage,
    addToast,
  } = useApp();

  const [dietaryFilter, setDietaryFilter] = useState<string>('all');
  const [copiedCode, setCopiedCode] = useState(false);
  const [securityTimer, setSecurityTimer] = useState(45);
  const [selectedReceipt, setSelectedReceipt] = useState<string | null>(null);
  const [showExtensionModal, setShowExtensionModal] = useState(false);
  const [extensionReason, setExtensionReason] = useState('heavy_exams');
  const [extensionSubmitted, setExtensionSubmitted] = useState(false);

  // Animated security token countdown
  useEffect(() => {
    const interval = setInterval(() => {
      setSecurityTimer((prev) => (prev > 1 ? prev - 1 : 60));
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  if (!currentUser) {
    return (
      <div className="min-h-screen bg-[#FAF8F5] py-20 px-4 text-center">
        <div className="max-w-md mx-auto bg-white rounded-3xl p-8 border border-stone-200 shadow-sm space-y-4">
          <Utensils className="w-12 h-12 text-[#24503B] mx-auto" />
          <h2 className="font-serif text-2xl font-bold text-stone-900">
            Student Access Required
          </h2>
          <p className="text-xs text-stone-600">
            Please sign in with your University of Hawaiʻi student credentials to view your meal pass and remaining balance.
          </p>
          <button
            onClick={() => setCurrentPage('signin')}
            className="w-full py-3 px-4 text-xs font-semibold text-white bg-[#24503B] rounded-xl hover:bg-[#1B3B2B] transition-colors"
          >
            Sign In to UH Account
          </button>
        </div>
      </div>
    );
  }

  const handleCopyPass = () => {
    navigator.clipboard?.writeText(currentUser.activePassCode);
    setCopiedCode(true);
    addToast('Code Copied', `Copied ${currentUser.activePassCode} to clipboard.`);
    setTimeout(() => setCopiedCode(false), 2000);
  };

  const handleQuickTestRedeem = () => {
    const eatery = eateries[0];
    const meal = eatery.eligibleMeals[0].name;
    redeemMeal(eatery.id, meal, currentUser.activePassCode);
  };

  const filteredEateries = eateries.filter((e) => {
    if (dietaryFilter === 'all') return true;
    return e.eligibleMeals.some((m) =>
      m.dietary.some((d) => d.toLowerCase().includes(dietaryFilter.toLowerCase()))
    );
  });

  return (
    <div className="min-h-screen bg-[#FAF8F5] py-8 sm:py-12">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-8">
        {/* Header Profile Bar */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white rounded-3xl p-6 sm:p-8 border border-stone-200/90 shadow-sm">
          <div className="flex items-center gap-4">
            <div className="relative">
              <img
                src={currentUser.photoUrl}
                alt={currentUser.name}
                className="w-16 h-16 rounded-2xl object-cover border-2 border-[#24503B]/20 shadow-sm"
              />
              <span className="absolute -bottom-1 -right-1 w-4 h-4 bg-[#24503B] border-2 border-white rounded-full flex items-center justify-center" title="Verified UH Student">
                <Check className="w-2.5 h-2.5 text-white" />
              </span>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="font-serif text-2xl sm:text-3xl font-bold text-[#132A1E]">
                  Aloha, {currentUser.name}!
                </h1>
              </div>
              <div className="flex items-center gap-2 text-xs text-stone-600 mt-1 flex-wrap">
                <span>{currentUser.campus}</span>
                <span aria-hidden="true">·</span>
                <span>{currentUser.major}</span>
                <span aria-hidden="true">·</span>
                <span className="font-mono text-stone-500">{currentUser.uhId}</span>
              </div>
            </div>
          </div>

          {/* Quick Actions on Profile */}
          <div className="flex items-center gap-2.5">
            <button
              onClick={() => setShowExtensionModal(true)}
              className="px-3.5 py-2 text-xs font-semibold text-stone-700 bg-stone-100 hover:bg-stone-200 rounded-xl transition-colors whitespace-nowrap"
            >
              Request Supplemental Credits
            </button>
            <button
              onClick={reloadStudentCredits}
              title="Reset credits back to 5 for testing"
              className="px-3.5 py-2 text-xs font-semibold text-[#24503B] bg-[#E7EFEA] hover:bg-[#D4E4DC] rounded-xl transition-colors flex items-center gap-1.5 whitespace-nowrap"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Reset Demo Balance</span>
            </button>
          </div>
        </div>

        {/* Top Metric Grid & Active Digital Meal Pass */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          {/* Digital Kōkua Meal Pass Card (Left 6 Cols) */}
          <div className="lg:col-span-6 bg-[#18392B] text-white rounded-3xl p-6 sm:p-8 border border-[#24503B] shadow-xl relative overflow-hidden">
            {/* Subtle background glow */}
            <div className="absolute top-0 right-0 w-64 h-64 bg-[#24503B]/30 rounded-full blur-3xl pointer-events-none" />

            {/* Pass Header */}
            <div className="flex items-start justify-between relative z-10">
              <div>
                <span className="text-[11px] font-semibold text-[#A3E0C8] tracking-widest uppercase">
                  Digital Meal Pass · Fall 2026
                </span>
                <div className="font-serif text-2xl font-bold text-[#FAF8F5] mt-0.5">
                  Kōkua Counter Pass
                </div>
              </div>
              <div className="flex items-center gap-1.5 bg-[#24503B]/80 text-[#A3E0C8] px-2.5 py-1 rounded-full text-xs font-medium border border-[#A3E0C8]/20">
                <span className="w-2 h-2 rounded-full bg-[#A3E0C8] animate-pulse" />
                <span>Live Auth</span>
              </div>
            </div>

            {/* QR Code and Pass Verification Token */}
            <div className="my-6 bg-white rounded-2xl p-6 text-stone-900 shadow-inner flex flex-col sm:flex-row items-center gap-6 relative z-10">
              {/* Stylized QR Code Visual */}
              <div className="w-36 h-36 bg-[#FAF8F5] border-2 border-stone-200 rounded-xl p-2.5 flex flex-col items-center justify-between shrink-0 shadow-sm relative group">
                <div className="w-full h-full grid grid-cols-6 grid-rows-6 gap-1 p-1">
                  {/* Visual QR pixel matrix representation */}
                  {Array.from({ length: 36 }).map((_, idx) => {
                    const isCorner =
                      idx === 0 || idx === 1 || idx === 4 || idx === 5 ||
                      idx === 6 || idx === 7 || idx === 10 || idx === 11 ||
                      idx === 24 || idx === 25 || idx === 30 || idx === 31;
                    const isRandom = (idx * 7) % 3 === 0;
                    return (
                      <div
                        key={idx}
                        className={`rounded-[2px] transition-colors ${
                          isCorner
                            ? 'bg-[#18392B]'
                            : isRandom
                            ? 'bg-[#24503B]'
                            : 'bg-stone-200'
                        }`}
                      />
                    );
                  })}
                </div>
                <div className="absolute inset-0 flex items-center justify-center bg-white/10 backdrop-blur-[0.5px]">
                  <div className="w-7 h-7 rounded-md bg-[#24503B] text-white flex items-center justify-center shadow-md font-serif font-bold text-xs">
                    K
                  </div>
                </div>
              </div>

              {/* Code details */}
              <div className="space-y-3 flex-1 text-center sm:text-left">
                <div>
                  <span className="text-[11px] text-stone-500 font-semibold uppercase tracking-wider">
                    Counter Verification Code
                  </span>
                  <div className="flex items-center justify-center sm:justify-start gap-2 mt-0.5">
                    <span className="font-mono text-2xl font-bold tracking-wider text-[#18392B]">
                      {currentUser.activePassCode}
                    </span>
                    <button
                      onClick={handleCopyPass}
                      className="p-1.5 rounded-lg text-stone-500 hover:text-stone-900 hover:bg-stone-100 transition-colors"
                      title="Copy Pass Code"
                    >
                      {copiedCode ? <Check className="w-4 h-4 text-[#24503B]" /> : <Copy className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                <div className="text-xs text-stone-600 space-y-1">
                  <div className="flex items-center justify-center sm:justify-start gap-1 text-[11px] text-stone-500">
                    <Clock className="w-3.5 h-3.5" />
                    <span>Security token refreshes in: <strong className="font-mono text-stone-800">{securityTimer}s</strong></span>
                  </div>
                  <div className="text-[11px] text-stone-500">
                    Valid for 1 hot entree at any participating partner kitchen.
                  </div>
                </div>
              </div>
            </div>

            {/* Pass Footer */}
            <div className="flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-stone-300 relative z-10 pt-2 border-t border-[#24503B]">
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-[#A3E0C8]" />
                <span>Zero Stigma · Scans as a prepaid gift card</span>
              </div>
              <button
                onClick={handleQuickTestRedeem}
                className="w-full sm:w-auto px-3.5 py-1.5 bg-[#E27357] hover:bg-[#C8583D] text-white font-semibold rounded-lg text-xs transition-colors flex items-center justify-center gap-1.5"
              >
                <span>Simulate 1-Tap Redemption</span>
                <ArrowRight className="w-3 h-3" />
              </button>
            </div>
          </div>

          {/* Balance & Schedule Overview (Right 6 Cols) */}
          <div className="lg:col-span-6 space-y-6">
            {/* Credit Balance Card */}
            <div className="bg-white rounded-3xl p-6 sm:p-8 border border-stone-200/90 shadow-sm space-y-6">
              <div className="flex items-start justify-between">
                <div>
                  <span className="text-xs font-semibold text-stone-500 uppercase tracking-wider">
                    Current Meal Allocation
                  </span>
                  <div className="flex items-baseline gap-2 mt-1">
                    <span className="font-serif text-5xl font-bold text-[#18392B] tabular-nums">
                      {currentUser.creditsRemaining}
                    </span>
                    <span className="text-sm font-medium text-stone-600">
                      of {currentUser.creditsWeeklyMax} weekly credits available
                    </span>
                  </div>
                </div>

                <div className="w-12 h-12 rounded-2xl bg-[#E7EFEA] text-[#24503B] flex items-center justify-center">
                  <Utensils className="w-6 h-6" />
                </div>
              </div>

              {/* Visual Credit Pills */}
              <div className="grid grid-cols-5 gap-2">
                {Array.from({ length: currentUser.creditsWeeklyMax }).map((_, i) => {
                  const isAvailable = i < currentUser.creditsRemaining;
                  return (
                    <div
                      key={i}
                      className={`h-3 rounded-full transition-all ${
                        isAvailable
                          ? 'bg-[#24503B]'
                          : 'bg-stone-200'
                      }`}
                      title={isAvailable ? `Credit #${i + 1} ready to redeem` : `Credit #${i + 1} redeemed`}
                    />
                  );
                })}
              </div>

              {/* Cycle Info */}
              <div className="bg-[#FAF8F5] rounded-2xl p-4 border border-stone-200/70 space-y-2 text-xs">
                <div className="flex items-center justify-between">
                  <span className="text-stone-600 flex items-center gap-1.5">
                    <Calendar className="w-4 h-4 text-[#24503B]" />
                    Weekly Cycle Refresh:
                  </span>
                  <span className="font-medium text-stone-900">Sunday @ 11:59 PM HST</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-stone-600 flex items-center gap-1.5">
                    <Clock className="w-4 h-4 text-[#24503B]" />
                    Daily Limit:
                  </span>
                  <span className="font-medium text-stone-900">Up to 2 hot meals per day</span>
                </div>
              </div>
            </div>

            {/* Quick Tips for Student Dignity */}
            <div className="bg-[#FAF8F5] rounded-3xl p-6 border border-stone-200/90 space-y-3">
              <h4 className="font-serif text-base font-bold text-[#18392B] flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-[#24503B]" />
                How to Order at the Counter
              </h4>
              <p className="text-xs text-stone-600 leading-relaxed">
                Step up to any participating cashier, choose from their eligible Kōkua plates, and say: <em className="text-stone-800 font-medium">“I’m paying with Kōkua pass.”</em> Show your QR code or 6-character code. The counter scans it with zero delay, just like Apple Pay or a Starbucks card.
              </p>
            </div>
          </div>
        </div>

        {/* Participating Eateries Directory with Dietary Filters */}
        <div className="bg-white rounded-3xl p-6 sm:p-8 border border-stone-200/90 shadow-sm space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h3 className="font-serif text-2xl font-bold text-stone-900">
                Where to Use Your Credits
              </h3>
              <p className="text-xs text-stone-600 mt-1">
                All listed dishes are 100% covered by 1 Kōkua meal credit.
              </p>
            </div>

            {/* Dietary filter controls */}
            <div className="flex items-center gap-1 p-1 bg-[#FAF8F5] border border-stone-200 rounded-xl overflow-x-auto">
              {[
                { id: 'all', label: 'All Dishes' },
                { id: 'gluten-free', label: 'Gluten-Free' },
                { id: 'vegan', label: 'Plant-Based' },
                { id: 'halal', label: 'Halal Chicken' },
              ].map((btn) => (
                <button
                  key={btn.id}
                  onClick={() => setDietaryFilter(btn.id)}
                  className={`px-3 py-1.5 text-xs font-medium rounded-lg whitespace-nowrap transition-colors ${
                    dietaryFilter === btn.id
                      ? 'bg-white text-stone-900 shadow-sm'
                      : 'text-stone-600 hover:text-stone-900'
                  }`}
                >
                  {btn.label}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredEateries.map((eatery) => (
              <div
                key={eatery.id}
                className="bg-[#FAF8F5] rounded-2xl border border-stone-200/80 p-5 space-y-4 hover:border-stone-300 transition-colors flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-start justify-between">
                    <div>
                      <span className="text-[11px] font-medium text-stone-500">
                        {eatery.neighborhood} · {eatery.distanceFromCampus}
                      </span>
                      <h4 className="font-serif text-lg font-bold text-stone-900 mt-0.5">
                        {eatery.name}
                      </h4>
                    </div>
                    <span className="text-[10px] font-semibold text-[#24503B] bg-[#E7EFEA] px-2 py-0.5 rounded">
                      Open Now
                    </span>
                  </div>

                  <div className="mt-3 space-y-2">
                    <span className="text-xs font-semibold text-stone-700 block">
                      Eligible 1-Credit Plates:
                    </span>
                    {eatery.eligibleMeals.map((meal, mIdx) => (
                      <div
                        key={mIdx}
                        className="p-2.5 bg-white rounded-xl border border-stone-200/70 text-xs space-y-1"
                      >
                        <div className="font-semibold text-stone-900 flex items-center justify-between">
                          <span>{meal.name}</span>
                          {meal.isStudentFavorite && (
                            <span className="text-[10px] font-normal text-[#C8583D]">★ Campus Fav</span>
                          )}
                        </div>
                        <p className="text-[11px] text-stone-500 line-clamp-1">
                          {meal.description}
                        </p>
                        <div className="flex items-center gap-1 pt-0.5">
                          {meal.dietary.map((d, dIdx) => (
                            <span key={dIdx} className="text-[10px] text-stone-500 bg-stone-100 px-1.5 py-0.2 rounded">
                              {d}
                            </span>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="pt-2 flex items-center justify-between text-xs text-stone-500 border-t border-stone-200/60">
                  <span className="flex items-center gap-1">
                    <MapPin className="w-3.5 h-3.5 text-stone-400" />
                    <span>{eatery.address.split(',')[0]}</span>
                  </span>
                  <button
                    onClick={() => {
                      redeemMeal(eatery.id, eatery.eligibleMeals[0].name, currentUser.activePassCode);
                    }}
                    className="text-xs font-semibold text-[#24503B] hover:underline"
                  >
                    Quick Order
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Recent Activity & Redemption Ledger */}
        <div className="bg-white rounded-3xl p-6 sm:p-8 border border-stone-200/90 shadow-sm space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-serif text-2xl font-bold text-stone-900">
                Recent Meal Redemptions
              </h3>
              <p className="text-xs text-stone-600 mt-0.5">
                Full ledger of past meals redeemed with your Kōkua pass.
              </p>
            </div>
            <span className="text-xs text-stone-500 font-medium">
              Showing {redemptions.length} transactions
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-[#FAF8F5] text-stone-600 font-semibold border-b border-stone-200">
                <tr>
                  <th className="py-3 px-4">Date & Time</th>
                  <th className="py-3 px-4">Eatery</th>
                  <th className="py-3 px-4">Meal Plate</th>
                  <th className="py-3 px-4">Pass Token</th>
                  <th className="py-3 px-4 text-center">Cost</th>
                  <th className="py-3 px-4 text-right">Receipt</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100">
                {redemptions.map((item) => (
                  <tr key={item.id} className="hover:bg-stone-50/60 transition-colors">
                    <td className="py-3.5 px-4 text-stone-700 whitespace-nowrap">
                      {item.timestamp}
                    </td>
                    <td className="py-3.5 px-4 font-semibold text-stone-900 whitespace-nowrap">
                      {item.eateryName}
                      <span className="block text-[11px] font-normal text-stone-500">
                        {item.eateryNeighborhood}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 text-stone-800 font-medium">
                      {item.mealName}
                    </td>
                    <td className="py-3.5 px-4 font-mono text-stone-600">
                      {item.passCode}
                    </td>
                    <td className="py-3.5 px-4 text-center">
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-bold bg-[#E7EFEA] text-[#24503B]">
                        1 Credit
                      </span>
                    </td>
                    <td className="py-3.5 px-4 text-right whitespace-nowrap">
                      <button
                        onClick={() => setSelectedReceipt(item.id)}
                        className="text-[#24503B] hover:text-[#18392B] font-semibold underline underline-offset-2 flex items-center gap-1 ml-auto"
                      >
                        <Receipt className="w-3.5 h-3.5" />
                        <span>View Slip</span>
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Extension / Supplemental Relief Modal */}
      {showExtensionModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 sm:p-8 border border-stone-200 shadow-2xl space-y-6">
            {!extensionSubmitted ? (
              <>
                <div>
                  <h3 className="font-serif text-2xl font-bold text-stone-900">
                    Request Supplemental Weekly Credits
                  </h3>
                  <p className="text-xs text-stone-600 mt-1">
                    We understand unforeseen expenses happen. Emergency additional credits can be approved within 2 hours.
                  </p>
                </div>

                <div className="space-y-4">
                  <div>
                    <label className="block text-xs font-semibold text-stone-800 mb-1">
                      Reason for Supplemental Request
                    </label>
                    <select
                      value={extensionReason}
                      onChange={(e) => setExtensionReason(e.target.value)}
                      className="w-full px-3 py-2 text-xs rounded-xl border border-stone-200 bg-white"
                    >
                      <option value="heavy_exams">Midterm / Exam study week with reduced job hours</option>
                      <option value="emergency_expense">Unforeseen medical or transit expense</option>
                      <option value="delayed_paycheck">Delayed campus work-study paycheck</option>
                      <option value="other">Other basic needs hardship</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-stone-800 mb-1">
                      Additional Credits Requested
                    </label>
                    <div className="grid grid-cols-3 gap-2">
                      {['+2 Credits', '+3 Credits', '+5 Credits (Full Week)'].map((opt, i) => (
                        <div
                          key={i}
                          className="p-2.5 text-center text-xs font-medium rounded-xl border border-[#24503B] bg-[#E7EFEA]/40 text-[#18392B]"
                        >
                          {opt}
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-3 pt-2">
                  <button
                    onClick={() => setShowExtensionModal(false)}
                    className="flex-1 py-2.5 px-4 text-xs font-semibold text-stone-700 bg-stone-100 hover:bg-stone-200 rounded-xl"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={() => {
                      setExtensionSubmitted(true);
                      setTimeout(() => {
                        reloadStudentCredits();
                      }, 1000);
                    }}
                    className="flex-1 py-2.5 px-4 text-xs font-semibold text-white bg-[#24503B] hover:bg-[#1B3B2B] rounded-xl"
                  >
                    Submit Confidential Request
                  </button>
                </div>
              </>
            ) : (
              <div className="text-center space-y-4 py-4">
                <div className="w-12 h-12 rounded-full bg-[#E7EFEA] text-[#24503B] flex items-center justify-center mx-auto">
                  <Check className="w-6 h-6" />
                </div>
                <h3 className="font-serif text-xl font-bold text-stone-900">
                  Request Granted Immediately
                </h3>
                <p className="text-xs text-stone-600">
                  Your meal balance has been refreshed to help you through this week without worry. Mālama pono!
                </p>
                <button
                  onClick={() => {
                    setShowExtensionModal(false);
                    setExtensionSubmitted(false);
                  }}
                  className="px-6 py-2.5 text-xs font-semibold text-white bg-[#24503B] rounded-xl"
                >
                  Return to Dashboard
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Slip / Digital Receipt Modal */}
      {selectedReceipt && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-sm w-full p-6 border border-stone-200 shadow-2xl space-y-4">
            <div className="text-center space-y-1">
              <span className="text-[10px] uppercase font-bold tracking-widest text-[#24503B]">
                Official Redemption Voucher
              </span>
              <h3 className="font-serif text-xl font-bold text-stone-900">
                Kōkua Counter Receipt
              </h3>
            </div>

            <div className="bg-[#FAF8F5] p-4 rounded-2xl border border-stone-200 space-y-2 text-xs">
              <div className="flex justify-between">
                <span className="text-stone-500">Transaction ID</span>
                <span className="font-mono font-bold text-stone-800">{selectedReceipt}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-stone-500">Student ID Masked</span>
                <span className="font-mono text-stone-800">UH-••••-8842</span>
              </div>
              <div className="flex justify-between">
                <span className="text-stone-500">Payment Authorization</span>
                <span className="text-[#24503B] font-semibold">1 Kōkua Meal Credit ($12 Paid)</span>
              </div>
              <div className="flex justify-between">
                <span className="text-stone-500">Settlement</span>
                <span className="text-stone-700">Weekly Merchant Direct Deposit</span>
              </div>
            </div>

            <button
              onClick={() => setSelectedReceipt(null)}
              className="w-full py-2.5 text-xs font-semibold text-stone-800 bg-stone-100 hover:bg-stone-200 rounded-xl transition-colors"
            >
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
