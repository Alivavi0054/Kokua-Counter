import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import {
  Heart,
  ShieldCheck,
  Lock,
  CreditCard,
  CheckCircle2,
  Calendar,
  Sparkles,
  ArrowLeft,
  Download,
  Share2,
} from 'lucide-react';

export const DonationPage: React.FC = () => {
  const { addDonation, donations, setCurrentPage } = useApp();

  const [frequency, setFrequency] = useState<'once' | 'monthly'>('once');
  const [selectedAmount, setSelectedAmount] = useState<number>(60);
  const [customAmount, setCustomAmount] = useState<string>('');
  const [donorName, setDonorName] = useState<string>('');
  const [donorEmail, setDonorEmail] = useState<string>('');
  const [isAnonymous, setIsAnonymous] = useState<boolean>(false);
  const [dedication, setDedication] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [paymentMethod, setPaymentMethod] = useState<'card' | 'apple' | 'uh_payroll'>('card');
  const [showReceiptModal, setShowReceiptModal] = useState<boolean>(false);
  const [lastReceipt, setLastReceipt] = useState<{
    amount: number;
    meals: number;
    receiptId: string;
    date: string;
    donor: string;
  } | null>(null);

  const finalAmount = customAmount ? parseFloat(customAmount) || 0 : selectedAmount;
  const mealsProvided = Math.max(1, Math.round(finalAmount / 12));

  const handlePresetClick = (amount: number) => {
    setSelectedAmount(amount);
    setCustomAmount('');
  };

  const handleCustomChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setCustomAmount(val);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (finalAmount < 5) return;

    setIsSubmitting(true);

    setTimeout(() => {
      const name = isAnonymous ? 'Anonymous Donor' : donorName || 'Generous Supporter';
      addDonation(finalAmount, name, frequency === 'monthly', dedication || undefined);

      setLastReceipt({
        amount: finalAmount,
        meals: mealsProvided,
        receiptId: `KC-TAX-${Math.floor(100000 + Math.random() * 900000)}`,
        date: new Date().toLocaleDateString('en-US', {
          year: 'numeric',
          month: 'long',
          day: 'numeric',
        }),
        donor: name,
      });

      setIsSubmitting(false);
      setShowReceiptModal(true);
    }, 700);
  };

  return (
    <div className="min-h-screen bg-[#FAF8F5] py-10 sm:py-16">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Top return link */}
        <div className="mb-6">
          <button
            onClick={() => setCurrentPage('landing')}
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-stone-600 hover:text-stone-900 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Back to Kōkua Counter Home</span>
          </button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 items-start">
          {/* Left Column: Donation Form */}
          <div className="lg:col-span-7 bg-white rounded-3xl p-6 sm:p-10 border border-stone-200/90 shadow-sm space-y-8">
            <div>
              <div className="inline-flex items-center gap-2 text-xs font-semibold text-[#24503B] bg-[#E7EFEA] px-3 py-1 rounded-full mb-3">
                <Sparkles className="w-3.5 h-3.5 text-[#24503B]" />
                <span>100% Tax Deductible · 501(c)(3)</span>
              </div>
              <h1 className="font-serif text-3xl sm:text-4xl font-bold text-[#132A1E]">
                Fund Wholesome Meals for UH Students
              </h1>
              <p className="text-stone-600 text-sm mt-2 leading-relaxed">
                Every $12 funds one full hot meal plate prepared by a local independent eatery in Honolulu. No administrative overhead deducted from your meal gift.
              </p>
            </div>

            {/* Frequency Toggle */}
            <div className="p-1.5 bg-[#FAF8F5] border border-stone-200/80 rounded-xl flex items-center">
              <button
                type="button"
                onClick={() => setFrequency('once')}
                className={`flex-1 py-2.5 text-xs font-semibold rounded-lg transition-all ${
                  frequency === 'once'
                    ? 'bg-white text-stone-900 shadow-sm'
                    : 'text-stone-600 hover:text-stone-900'
                }`}
              >
                One-Time Gift
              </button>
              <button
                type="button"
                onClick={() => setFrequency('monthly')}
                className={`flex-1 py-2.5 text-xs font-semibold rounded-lg transition-all flex items-center justify-center gap-1.5 ${
                  frequency === 'monthly'
                    ? 'bg-white text-[#24503B] shadow-sm'
                    : 'text-stone-600 hover:text-stone-900'
                }`}
              >
                <Calendar className="w-3.5 h-3.5" />
                <span>Monthly Sustainer (Most Impact)</span>
              </button>
            </div>

            {/* Suggested Amounts */}
            <div className="space-y-3">
              <label className="block text-xs font-semibold text-stone-800 uppercase tracking-wider">
                Select Your Contribution Amount
              </label>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {[
                  { amount: 12, label: '1 Hot Plate' },
                  { amount: 36, label: '3 Plates' },
                  { amount: 60, label: '5 Plates (1 Week)' },
                  { amount: 120, label: '10 Plates' },
                ].map((item) => {
                  const isSelected = !customAmount && selectedAmount === item.amount;
                  return (
                    <button
                      key={item.amount}
                      type="button"
                      onClick={() => handlePresetClick(item.amount)}
                      className={`p-3.5 rounded-xl border text-center transition-all cursor-pointer ${
                        isSelected
                          ? 'border-[#24503B] bg-[#E7EFEA]/50 ring-2 ring-[#24503B]/20 text-[#132A1E]'
                          : 'border-stone-200 hover:border-stone-300 bg-white text-stone-700'
                      }`}
                    >
                      <div className="text-xl font-bold font-serif">${item.amount}</div>
                      <div className="text-[11px] text-stone-500 mt-0.5">{item.label}</div>
                    </button>
                  );
                })}
              </div>

              {/* Custom amount */}
              <div className="pt-2">
                <div className="relative rounded-xl border border-stone-200 focus-within:border-[#24503B] focus-within:ring-2 focus-within:ring-[#24503B]/20 overflow-hidden bg-white">
                  <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-stone-500 font-serif font-bold text-lg">
                    $
                  </div>
                  <input
                    type="number"
                    min="5"
                    step="1"
                    placeholder="Custom amount (e.g. 240 for a full semester meal grant)"
                    value={customAmount}
                    onChange={handleCustomChange}
                    className="w-full pl-9 pr-4 py-3 text-sm font-medium text-stone-900 placeholder:text-stone-400 focus:outline-none"
                  />
                </div>
              </div>
            </div>

            {/* Impact Calculation Preview Bar */}
            <div className="bg-[#F8F5EE] border border-[#E5DAC6] rounded-2xl p-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-[#24503B] text-white flex items-center justify-center font-bold text-base shrink-0">
                  {mealsProvided}
                </div>
                <div>
                  <div className="text-sm font-bold text-[#18392B]">
                    {mealsProvided} Hot Student Meal{mealsProvided > 1 ? 's' : ''} Funded
                  </div>
                  <div className="text-xs text-stone-600">
                    Direct reimbursement to local Mānoa & Kaimukī kitchens
                  </div>
                </div>
              </div>
              <div className="text-right hidden sm:block">
                <div className="text-xs font-semibold text-[#24503B]">100% Tax Deductible</div>
                <div className="text-[11px] text-stone-500">Receipt issued instantly</div>
              </div>
            </div>

            {/* Donor Information & Payment */}
            <form onSubmit={handleSubmit} className="space-y-5">
              <div className="space-y-3">
                <label className="block text-xs font-semibold text-stone-800 uppercase tracking-wider">
                  Donor Information
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <input
                      type="text"
                      placeholder="Your Full Name"
                      value={donorName}
                      disabled={isAnonymous}
                      onChange={(e) => setDonorName(e.target.value)}
                      className="w-full px-4 py-2.5 text-sm rounded-xl border border-stone-200 focus:border-[#24503B] focus:outline-none disabled:bg-stone-100 disabled:text-stone-400"
                    />
                  </div>
                  <div>
                    <input
                      type="email"
                      required
                      placeholder="Email Address (for tax receipt)"
                      value={donorEmail}
                      onChange={(e) => setDonorEmail(e.target.value)}
                      className="w-full px-4 py-2.5 text-sm rounded-xl border border-stone-200 focus:border-[#24503B] focus:outline-none"
                    />
                  </div>
                </div>

                <div className="flex items-center gap-2 pt-1">
                  <input
                    type="checkbox"
                    id="anon"
                    checked={isAnonymous}
                    onChange={(e) => setIsAnonymous(e.target.checked)}
                    className="w-4 h-4 text-[#24503B] rounded border-stone-300 focus:ring-[#24503B]"
                  />
                  <label htmlFor="anon" className="text-xs text-stone-600 cursor-pointer">
                    Keep my gift anonymous on public donor acknowledgment lists
                  </label>
                </div>

                <div>
                  <input
                    type="text"
                    placeholder="Dedication (optional: e.g. In honor of UH Class of ‘88, or Grandma Leiko)"
                    value={dedication}
                    onChange={(e) => setDedication(e.target.value)}
                    className="w-full px-4 py-2 text-xs rounded-xl border border-stone-200 focus:border-[#24503B] focus:outline-none"
                  />
                </div>
              </div>

              {/* Payment Method Selector */}
              <div className="space-y-3 pt-2">
                <label className="block text-xs font-semibold text-stone-800 uppercase tracking-wider">
                  Payment Method
                </label>
                <div className="grid grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => setPaymentMethod('card')}
                    className={`py-2 px-3 text-xs font-medium rounded-xl border flex items-center justify-center gap-1.5 transition-all ${
                      paymentMethod === 'card'
                        ? 'border-[#24503B] bg-[#E7EFEA]/40 text-[#132A1E] font-semibold'
                        : 'border-stone-200 text-stone-600'
                    }`}
                  >
                    <CreditCard className="w-3.5 h-3.5" />
                    <span>Credit Card</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setPaymentMethod('apple')}
                    className={`py-2 px-3 text-xs font-medium rounded-xl border flex items-center justify-center gap-1.5 transition-all ${
                      paymentMethod === 'apple'
                        ? 'border-[#24503B] bg-[#E7EFEA]/40 text-[#132A1E] font-semibold'
                        : 'border-stone-200 text-stone-600'
                    }`}
                  >
                    <span>Apple / Google Pay</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setPaymentMethod('uh_payroll')}
                    className={`py-2 px-3 text-xs font-medium rounded-xl border flex items-center justify-center gap-1.5 transition-all ${
                      paymentMethod === 'uh_payroll'
                        ? 'border-[#24503B] bg-[#E7EFEA]/40 text-[#132A1E] font-semibold'
                        : 'border-stone-200 text-stone-600'
                    }`}
                  >
                    <span>UH Payroll Match</span>
                  </button>
                </div>

                {paymentMethod === 'card' && (
                  <div className="p-4 bg-stone-50 rounded-xl border border-stone-200 space-y-3">
                    <input
                      type="text"
                      placeholder="Card number (Simulated 4242 •••• •••• 4242)"
                      defaultValue="4242 •••• •••• 4242"
                      className="w-full px-3 py-2 text-xs rounded-lg border border-stone-200 bg-white font-mono"
                    />
                    <div className="grid grid-cols-2 gap-2">
                      <input
                        type="text"
                        placeholder="MM / YY"
                        defaultValue="12/28"
                        className="w-full px-3 py-2 text-xs rounded-lg border border-stone-200 bg-white"
                      />
                      <input
                        type="text"
                        placeholder="CVC"
                        defaultValue="842"
                        className="w-full px-3 py-2 text-xs rounded-lg border border-stone-200 bg-white font-mono"
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* Submit CTA */}
              <div className="pt-4">
                <button
                  type="submit"
                  disabled={isSubmitting || finalAmount <= 0}
                  className="w-full py-4 px-6 text-sm font-semibold text-white bg-[#E27357] hover:bg-[#C8583D] rounded-xl shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                >
                  <Lock className="w-4 h-4" />
                  <span>
                    {isSubmitting
                      ? 'Processing Secure Donation...'
                      : `Complete $${finalAmount.toFixed(0)} ${
                          frequency === 'monthly' ? '/ Month' : ''
                        } Meal Gift`}
                  </span>
                </button>
                <div className="mt-3 flex items-center justify-center gap-2 text-xs text-stone-500">
                  <ShieldCheck className="w-4 h-4 text-[#24503B]" />
                  <span>256-bit SSL encryption · Safe & instant nonprofit processing</span>
                </div>
              </div>
            </form>
          </div>

          {/* Right Column: Trust, Real Impact, Donor Wall */}
          <div className="lg:col-span-5 space-y-6">
            {/* Direct Impact Card */}
            <div className="bg-[#18392B] text-white rounded-3xl p-7 border border-[#24503B] space-y-4">
              <h3 className="font-serif text-2xl font-bold text-[#FAF8F5]">
                Where Your Gift Goes
              </h3>
              <ul className="space-y-3 text-xs sm:text-sm text-stone-300">
                <li className="flex items-start gap-2.5">
                  <CheckCircle2 className="w-4 h-4 text-[#A3E0C8] shrink-0 mt-0.5" />
                  <span>
                    <strong className="text-white">$12.00:</strong> Direct ACH reimbursement to the local kitchen for one full, hearty meal plate with proteins and fresh sides.
                  </span>
                </li>
                <li className="flex items-start gap-2.5">
                  <CheckCircle2 className="w-4 h-4 text-[#A3E0C8] shrink-0 mt-0.5" />
                  <span>
                    <strong className="text-white">$0.00:</strong> Zero administrative extraction from your meal donation. Private philanthropic grants cover our server and app operations.
                  </span>
                </li>
                <li className="flex items-start gap-2.5">
                  <CheckCircle2 className="w-4 h-4 text-[#A3E0C8] shrink-0 mt-0.5" />
                  <span>
                    <strong className="text-white">Confidential delivery:</strong> Student credits appear immediately on their UH verified pass without humiliating intake interviews.
                  </span>
                </li>
              </ul>
            </div>

            {/* Recent Community Donors Wall */}
            <div className="bg-white rounded-3xl p-6 sm:p-7 border border-stone-200/90 shadow-sm space-y-4">
              <div className="flex items-center justify-between">
                <h4 className="font-serif text-lg font-bold text-stone-900">
                  Recent Island Donors
                </h4>
                <span className="text-xs font-semibold text-[#24503B] bg-[#E7EFEA] px-2.5 py-0.5 rounded-full">
                  Live Feed
                </span>
              </div>
              <div className="space-y-3 divide-y divide-stone-100">
                {donations.slice(0, 4).map((d) => (
                  <div key={d.id} className="pt-3 first:pt-0">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold text-stone-900">
                        {d.donorName}
                      </span>
                      <span className="text-xs font-bold text-[#18392B] tabular-nums">
                        ${d.amount} {d.isMonthly && <span className="text-stone-500 font-normal">/mo</span>}
                      </span>
                    </div>
                    <div className="text-[11px] text-stone-500 mt-0.5 flex items-center justify-between">
                      <span>Funded {d.mealsFunded} student meal{d.mealsFunded > 1 ? 's' : ''}</span>
                      <span>{d.timestamp}</span>
                    </div>
                    {d.dedicatedTo && (
                      <div className="text-[11px] text-stone-600 italic mt-1 bg-stone-50 p-1.5 rounded">
                        “Dedicated to: {d.dedicatedTo}”
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* Institutional Seal */}
            <div className="p-4 bg-[#EAE4D9]/40 border border-stone-200/80 rounded-2xl flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-white border border-stone-200 flex items-center justify-center text-[#18392B] font-serif font-bold shrink-0">
                UH
              </div>
              <div className="text-xs text-stone-700">
                <span className="font-semibold text-stone-900">Community Partner Endorsement:</span> UH Mānoa Associated Students (ASUH) & Campus Center Board approved basic needs partner.
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Tax Receipt Modal */}
      {showReceiptModal && lastReceipt && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 sm:p-8 border border-stone-200 shadow-2xl space-y-6 animate-in zoom-in-95 duration-200">
            <div className="text-center space-y-2">
              <div className="w-12 h-12 rounded-full bg-[#E7EFEA] text-[#24503B] flex items-center justify-center mx-auto">
                <CheckCircle2 className="w-7 h-7" />
              </div>
              <h3 className="font-serif text-2xl font-bold text-stone-900">
                Mahalo Nui Loa for Your Kōkua!
              </h3>
              <p className="text-xs text-stone-600">
                Your generous meal donation has been processed. A copy of this tax-deductible receipt has been dispatched.
              </p>
            </div>

            {/* Printable Receipt Card */}
            <div className="bg-[#FAF8F5] border border-stone-200 rounded-2xl p-5 space-y-3 text-xs">
              <div className="flex justify-between border-b border-stone-200 pb-2">
                <span className="text-stone-500">Official Receipt #</span>
                <span className="font-mono font-bold text-stone-800">{lastReceipt.receiptId}</span>
              </div>
              <div className="flex justify-between border-b border-stone-200 pb-2">
                <span className="text-stone-500">Contribution Amount</span>
                <span className="font-bold text-[#18392B] text-sm tabular-nums">${lastReceipt.amount.toFixed(2)} USD</span>
              </div>
              <div className="flex justify-between border-b border-stone-200 pb-2">
                <span className="text-stone-500">Impact Equivalent</span>
                <span className="font-semibold text-stone-800">{lastReceipt.meals} Wholesome Student Plates</span>
              </div>
              <div className="flex justify-between border-b border-stone-200 pb-2">
                <span className="text-stone-500">Donor Recognized</span>
                <span className="font-medium text-stone-800">{lastReceipt.donor}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-stone-500">Nonprofit Tax Status</span>
                <span className="text-stone-700">501(c)(3) Public Charity (EIN 99-0418291)</span>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row gap-3">
              <button
                onClick={() => {
                  alert('Receipt downloaded to your device as PDF.');
                }}
                className="flex-1 py-3 px-4 text-xs font-semibold text-stone-800 bg-[#EAE4D9]/60 hover:bg-[#E2D7C5] rounded-xl transition-colors flex items-center justify-center gap-1.5"
              >
                <Download className="w-4 h-4" />
                <span>Save Tax Receipt (PDF)</span>
              </button>
              <button
                onClick={() => setShowReceiptModal(false)}
                className="flex-1 py-3 px-4 text-xs font-semibold text-white bg-[#24503B] hover:bg-[#1B3B2B] rounded-xl transition-colors"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
