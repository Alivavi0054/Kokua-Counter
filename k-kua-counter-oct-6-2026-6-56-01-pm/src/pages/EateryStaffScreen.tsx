import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import {
  QrCode,
  CheckCircle2,
  AlertCircle,
  Utensils,
  Store,
  DollarSign,
  Camera,
  RefreshCw,
  Clock,
  ArrowRight,
  ShieldCheck,
  Receipt,
} from 'lucide-react';

export const EateryStaffScreen: React.FC = () => {
  const {
    eateries,
    activeEateryId,
    setActiveEateryId,
    currentUser,
    redeemMeal,
    redemptions,
    addToast,
  } = useApp();

  const [inputCode, setInputCode] = useState('KK-8429-UH');
  const [selectedMealIndex, setSelectedMealIndex] = useState(0);
  const [isVerifying, setIsVerifying] = useState(false);
  const [verifiedStudent, setVerifiedStudent] = useState<{
    name: string;
    uhIdMasked: string;
    creditsRemaining: number;
    photoUrl: string;
    campus: string;
  } | null>(null);
  const [validationError, setValidationError] = useState<string | null>(null);
  const [scanModeActive, setScanModeActive] = useState(false);
  const [lastRedeemedSlip, setLastRedeemedSlip] = useState<{
    id: string;
    meal: string;
    time: string;
    code: string;
  } | null>(null);

  const currentEatery = eateries.find((e) => e.id === activeEateryId) || eateries[0];

  const handleVerifyCode = (codeToVerify?: string) => {
    const code = codeToVerify || inputCode.trim().toUpperCase();
    setIsVerifying(true);
    setValidationError(null);

    setTimeout(() => {
      setIsVerifying(false);
      // If code matches the active student
      if (currentUser && (code === currentUser.activePassCode || code === 'KK-8429-UH' || code === 'DEMO')) {
        if (currentUser.creditsRemaining <= 0) {
          setValidationError('This student pass has 0 remaining meal credits for the current weekly cycle.');
          setVerifiedStudent(null);
          return;
        }

        setVerifiedStudent({
          name: currentUser.name,
          uhIdMasked: 'UH-••••-8842',
          creditsRemaining: currentUser.creditsRemaining,
          photoUrl: currentUser.photoUrl,
          campus: currentUser.campus,
        });
        setScanModeActive(false);
      } else {
        setValidationError('Invalid or expired Kōkua pass token. Please request the student to refresh their app.');
        setVerifiedStudent(null);
      }
    }, 500);
  };

  const handleSimulateCameraScan = () => {
    setScanModeActive(true);
    setTimeout(() => {
      handleVerifyCode('KK-8429-UH');
    }, 1200);
  };

  const handleConfirmRedemption = () => {
    if (!verifiedStudent) return;
    const dish = currentEatery.eligibleMeals[selectedMealIndex]?.name || 'House Special Plate';
    const success = redeemMeal(currentEatery.id, dish, inputCode);

    if (success) {
      const slip = {
        id: `TKT-${Math.floor(100 + Math.random() * 900)}`,
        meal: dish,
        time: new Date().toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }),
        code: inputCode,
      };
      setLastRedeemedSlip(slip);
      setVerifiedStudent(null);
      setInputCode('KK-8429-UH');
    }
  };

  // Calculate today's shift totals for this eatery
  const shiftRedemptions = redemptions.filter(
    (r) => r.eateryName.toLowerCase() === currentEatery.name.toLowerCase()
  );
  const shiftTotalMeals = shiftRedemptions.length;
  const shiftPayout = shiftTotalMeals * 12.0;

  return (
    <div className="min-h-screen bg-[#FAF8F5] py-8 sm:py-12">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 space-y-8">
        {/* Terminal Header Bar */}
        <div className="bg-[#18392B] text-white rounded-3xl p-6 sm:p-8 border border-[#24503B] shadow-md flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-2xl bg-[#FAF8F5] text-[#18392B] flex items-center justify-center font-bold shadow-sm">
              <Store className="w-7 h-7" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[11px] font-semibold text-[#A3E0C8] uppercase tracking-wider">
                  Participating Eatery Staff Screen
                </span>
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              </div>
              <h1 className="font-serif text-2xl sm:text-3xl font-bold text-white mt-0.5">
                {currentEatery.name}
              </h1>
              <p className="text-xs text-stone-300 mt-1">
                {currentEatery.neighborhood} · Reimbursed at $12.00 per Kōkua plate
              </p>
            </div>
          </div>

          {/* Switch Eatery Terminal Location for testing */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
            <div className="text-right">
              <span className="text-[11px] text-stone-300 block mb-1">Terminal Location:</span>
              <select
                value={activeEateryId}
                onChange={(e) => {
                  setActiveEateryId(e.target.value);
                  setVerifiedStudent(null);
                  setValidationError(null);
                }}
                className="bg-[#24503B] text-white text-xs px-3 py-2 rounded-xl border border-[#A3E0C8]/30 focus:outline-none"
              >
                {eateries.map((eat) => (
                  <option key={eat.id} value={eat.id}>
                    {eat.name}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Shift Summary Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="bg-white rounded-2xl p-5 border border-stone-200/90 shadow-sm flex items-center justify-between">
            <div>
              <span className="text-xs font-semibold text-stone-500 uppercase tracking-wider">
                Shift Meals Redeemed
              </span>
              <div className="font-serif text-3xl font-bold text-[#18392B] tabular-nums mt-1">
                {shiftTotalMeals} Plates
              </div>
            </div>
            <div className="w-10 h-10 rounded-xl bg-[#E7EFEA] text-[#24503B] flex items-center justify-center">
              <Utensils className="w-5 h-5" />
            </div>
          </div>

          <div className="bg-white rounded-2xl p-5 border border-stone-200/90 shadow-sm flex items-center justify-between">
            <div>
              <span className="text-xs font-semibold text-stone-500 uppercase tracking-wider">
                Reimbursement Due
              </span>
              <div className="font-serif text-3xl font-bold text-[#2A6F78] tabular-nums mt-1">
                ${shiftPayout.toFixed(2)}
              </div>
            </div>
            <div className="w-10 h-10 rounded-xl bg-[#E2F0F2] text-[#2A6F78] flex items-center justify-center">
              <DollarSign className="w-5 h-5" />
            </div>
          </div>

          <div className="bg-white rounded-2xl p-5 border border-stone-200/90 shadow-sm flex items-center justify-between">
            <div>
              <span className="text-xs font-semibold text-stone-500 uppercase tracking-wider">
                Next Payout Run
              </span>
              <div className="font-serif text-lg font-bold text-stone-900 mt-1">
                Monday 4:00 AM HST
              </div>
              <span className="text-[11px] text-stone-500">Direct ACH via UH Foundation</span>
            </div>
            <div className="w-10 h-10 rounded-xl bg-stone-100 text-stone-700 flex items-center justify-center">
              <Clock className="w-5 h-5" />
            </div>
          </div>
        </div>

        {/* Main Verification Console (Split Grid) */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          {/* Scanner / Code Input (Left 6 Cols) */}
          <div className="lg:col-span-6 bg-white rounded-3xl p-6 sm:p-8 border border-stone-200/90 shadow-sm space-y-6">
            <div>
              <div className="inline-flex items-center gap-2 text-xs font-semibold text-[#24503B] bg-[#E7EFEA] px-3 py-1 rounded-full mb-2">
                <QrCode className="w-3.5 h-3.5" />
                <span>Cashier Rapid Redemption</span>
              </div>
              <h2 className="font-serif text-2xl font-bold text-stone-900">
                Scan or Enter Student Pass
              </h2>
              <p className="text-xs text-stone-600 mt-1">
                Point counter scanner at the student's mobile screen or type their 6-character code.
              </p>
            </div>

            {/* Camera Viewfinder Simulation */}
            <div className="relative rounded-2xl overflow-hidden border-2 border-dashed border-stone-300 bg-stone-900 aspect-16/10 flex flex-col items-center justify-center p-6 text-white text-center">
              {scanModeActive ? (
                <div className="space-y-3">
                  <div className="w-16 h-16 border-4 border-[#A3E0C8] border-t-transparent rounded-full animate-spin mx-auto" />
                  <p className="text-xs font-medium text-[#A3E0C8]">
                    Scanning optical QR barcode...
                  </p>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="w-12 h-12 rounded-full bg-white/10 flex items-center justify-center mx-auto text-stone-300">
                    <Camera className="w-6 h-6" />
                  </div>
                  <div>
                    <p className="text-xs font-medium text-stone-200">
                      Counter Scanner Idle
                    </p>
                    <p className="text-[11px] text-stone-400 mt-0.5">
                      Ready to detect dynamic Kōkua QR tokens
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={handleSimulateCameraScan}
                    className="py-2 px-4 bg-white/20 hover:bg-white/30 text-white rounded-xl text-xs font-semibold transition-colors cursor-pointer"
                  >
                    Simulate Camera Scan (Leilani's Pass)
                  </button>
                </div>
              )}

              {/* Viewfinder corner brackets */}
              <div className="absolute top-4 left-4 w-6 h-6 border-t-2 border-l-2 border-[#A3E0C8]" />
              <div className="absolute top-4 right-4 w-6 h-6 border-t-2 border-r-2 border-[#A3E0C8]" />
              <div className="absolute bottom-4 left-4 w-6 h-6 border-b-2 border-l-2 border-[#A3E0C8]" />
              <div className="absolute bottom-4 right-4 w-6 h-6 border-b-2 border-r-2 border-[#A3E0C8]" />
            </div>

            {/* Manual Code Input Form */}
            <div className="space-y-3 pt-2">
              <label className="block text-xs font-semibold text-stone-800 uppercase tracking-wider">
                Or Type 6-Character Pass Code
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="e.g. KK-8429-UH"
                  value={inputCode}
                  onChange={(e) => setInputCode(e.target.value.toUpperCase())}
                  className="flex-1 px-4 py-2.5 font-mono text-sm tracking-widest uppercase rounded-xl border border-stone-200 focus:border-[#24503B] focus:outline-none"
                />
                <button
                  type="button"
                  onClick={() => handleVerifyCode()}
                  disabled={isVerifying || !inputCode.trim()}
                  className="px-5 py-2.5 text-xs font-semibold text-white bg-[#24503B] hover:bg-[#1B3B2B] rounded-xl transition-all cursor-pointer disabled:opacity-50 whitespace-nowrap"
                >
                  {isVerifying ? 'Checking...' : 'Verify Token'}
                </button>
              </div>
            </div>

            {/* Error Display */}
            {validationError && (
              <div className="p-3.5 bg-[#FCECE8] text-[#C8583D] border border-[#F5A38F]/50 rounded-xl text-xs flex items-start gap-2">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                <span className="leading-relaxed">{validationError}</span>
              </div>
            )}
          </div>

          {/* Verification Result & Dish Deduction (Right 6 Cols) */}
          <div className="lg:col-span-6 space-y-6">
            {verifiedStudent ? (
              <div className="bg-white rounded-3xl p-6 sm:p-8 border-2 border-[#24503B] shadow-lg space-y-6 animate-in zoom-in-95 duration-150">
                <div className="flex items-center justify-between pb-4 border-b border-stone-100">
                  <div className="flex items-center gap-3">
                    <img
                      src={verifiedStudent.photoUrl}
                      alt={verifiedStudent.name}
                      className="w-14 h-14 rounded-2xl object-cover border-2 border-[#24503B]/20"
                    />
                    <div>
                      <div className="flex items-center gap-1.5">
                        <CheckCircle2 className="w-4 h-4 text-[#24503B]" />
                        <span className="text-xs font-bold text-[#24503B] uppercase">
                          Authorized Kōkua Pass
                        </span>
                      </div>
                      <h3 className="font-serif text-xl font-bold text-stone-900 mt-0.5">
                        {verifiedStudent.name}
                      </h3>
                      <div className="text-xs text-stone-500 font-mono">
                        {verifiedStudent.uhIdMasked} · {verifiedStudent.campus}
                      </div>
                    </div>
                  </div>

                  <div className="text-right">
                    <span className="text-[11px] text-stone-500 block">Available Credits</span>
                    <span className="font-serif text-2xl font-bold text-[#18392B] tabular-nums">
                      {verifiedStudent.creditsRemaining}
                    </span>
                  </div>
                </div>

                {/* Dish Selection */}
                <div className="space-y-3">
                  <label className="block text-xs font-semibold text-stone-800 uppercase tracking-wider">
                    Select Prepared Meal to Deduct
                  </label>
                  <div className="space-y-2">
                    {currentEatery.eligibleMeals.map((meal, index) => (
                      <label
                        key={index}
                        className={`flex items-start gap-3 p-3 rounded-xl border cursor-pointer transition-all ${
                          selectedMealIndex === index
                            ? 'border-[#24503B] bg-[#E7EFEA]/40'
                            : 'border-stone-200 hover:border-stone-300'
                        }`}
                      >
                        <input
                          type="radio"
                          name="meal"
                          checked={selectedMealIndex === index}
                          onChange={() => setSelectedMealIndex(index)}
                          className="mt-1 text-[#24503B] focus:ring-[#24503B]"
                        />
                        <div className="flex-1 text-xs">
                          <span className="font-semibold text-stone-900 block">
                            {meal.name}
                          </span>
                          <span className="text-stone-500 text-[11px]">
                            {meal.description}
                          </span>
                        </div>
                        <span className="text-xs font-bold text-[#18392B] shrink-0">
                          1 Credit ($12)
                        </span>
                      </label>
                    ))}
                  </div>
                </div>

                {/* Action Buttons */}
                <div className="pt-2 flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => setVerifiedStudent(null)}
                    className="flex-1 py-3 px-4 text-xs font-semibold text-stone-700 bg-stone-100 hover:bg-stone-200 rounded-xl transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={handleConfirmRedemption}
                    className="flex-2 py-3 px-4 text-xs font-semibold text-white bg-[#E27357] hover:bg-[#C8583D] rounded-xl shadow-md transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    <CheckCircle2 className="w-4 h-4" />
                    <span>Approve Meal & Print Kitchen Slip</span>
                  </button>
                </div>
              </div>
            ) : (
              <div className="bg-white rounded-3xl p-8 border border-stone-200/90 shadow-sm text-center space-y-4">
                <div className="w-14 h-14 rounded-2xl bg-[#FAF8F5] border border-stone-200 flex items-center justify-center mx-auto text-stone-400">
                  <Utensils className="w-7 h-7 text-[#24503B]" />
                </div>
                <div>
                  <h3 className="font-serif text-xl font-bold text-stone-900">
                    Awaiting Student Pass Verification
                  </h3>
                  <p className="text-xs text-stone-600 max-w-sm mx-auto mt-1 leading-relaxed">
                    Once verified, the student photo and eligible dishes will appear here for fast, one-tap approval.
                  </p>
                </div>

                <div className="pt-3 border-t border-stone-100 flex items-center justify-center gap-2 text-xs text-stone-500">
                  <ShieldCheck className="w-4 h-4 text-[#24503B]" />
                  <span>Dignified, courteous service guaranteed</span>
                </div>
              </div>
            )}

            {/* Last Redeemed Kitchen Slip */}
            {lastRedeemedSlip && (
              <div className="bg-[#FAF8F5] rounded-3xl p-6 border border-stone-200/90 shadow-sm space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-[#24503B] uppercase tracking-wider flex items-center gap-1.5">
                    <CheckCircle2 className="w-4 h-4" />
                    Last Processed Ticket
                  </span>
                  <span className="text-xs font-mono font-bold text-stone-800">
                    {lastRedeemedSlip.id}
                  </span>
                </div>
                <div className="p-3 bg-white rounded-xl border border-stone-200/80 text-xs space-y-1">
                  <div className="font-semibold text-stone-900">
                    {lastRedeemedSlip.meal}
                  </div>
                  <div className="text-[11px] text-stone-500 flex justify-between">
                    <span>Pass Token: {lastRedeemedSlip.code}</span>
                    <span>{lastRedeemedSlip.time}</span>
                  </div>
                </div>
                <div className="text-[11px] text-stone-500 text-center">
                  Kitchen ticket dispatched · $12.00 added to merchant ledger
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
