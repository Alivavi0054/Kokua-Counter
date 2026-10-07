import React from 'react';
import { useApp } from '../context/AppContext';
import { ArrowLeft, Scale, ShieldCheck } from 'lucide-react';

export const LegalTermsPage: React.FC = () => {
  const { setCurrentPage } = useApp();

  return (
    <div className="min-h-screen bg-[#FAF8F5] py-12 sm:py-16">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 space-y-8">
        <div>
          <button
            onClick={() => setCurrentPage('landing')}
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-stone-600 hover:text-stone-900 transition-colors mb-4"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Back to Kōkua Counter Home</span>
          </button>
          <div className="flex items-center gap-2 text-xs font-semibold text-[#24503B] bg-[#E7EFEA] px-3 py-1 rounded-full w-fit mb-3">
            <Scale className="w-3.5 h-3.5" />
            <span>Official Non-Profit Terms</span>
          </div>
          <h1 className="font-serif text-3xl sm:text-4xl font-bold text-[#132A1E]">
            Terms of Service & Community Agreement
          </h1>
          <p className="text-xs text-stone-500 mt-2">
            Effective: Academic Year 2026–2027 · Kōkua Counter Public Benefit Charity
          </p>
        </div>

        <div className="bg-white rounded-3xl p-6 sm:p-10 border border-stone-200/90 shadow-sm space-y-8 text-sm text-stone-700 leading-relaxed">
          <section className="space-y-3">
            <h2 className="font-serif text-xl font-bold text-stone-900">
              1. Acceptance of Terms
            </h2>
            <p>
              By accessing Kōkua Counter as a student recipient, donor, or participating eatery merchant, you agree to uphold our community standards of respect, reciprocity (kōkua), and mutual mālama.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="font-serif text-xl font-bold text-stone-900">
              2. Student Pass Usage & Fair Reciprocity
            </h2>
            <ul className="list-disc pl-5 space-y-2 text-xs sm:text-sm">
              <li>
                <strong>Personal Use Only:</strong> Meal passes are allocated specifically to the enrolled University of Hawaiʻi student linked to the @hawaii.edu account and may not be sold or transferred.
              </li>
              <li>
                <strong>Eligible Food Only:</strong> Meal passes may only be redeemed for nutritious prepared food and non-alcoholic beverages designated on the participating eatery’s Kōkua menu. They cannot be redeemed for cash or alcoholic beverages.
              </li>
              <li>
                <strong>Weekly Cycle:</strong> Unused credits do not accumulate indefinitely; allocations refresh on a weekly cadence to ensure active student food distribution across the university year.
              </li>
            </ul>
          </section>

          <section className="space-y-3">
            <h2 className="font-serif text-xl font-bold text-stone-900">
              3. Participating Eatery Covenant
            </h2>
            <p>
              Partner restaurants agree to:
            </p>
            <ul className="list-disc pl-5 space-y-2 text-xs sm:text-sm">
              <li>
                Serve Kōkua Counter pass holders with the identical portion size, culinary quality, and warm island hospitality afforded to any commercial dining guest.
              </li>
              <li>
                Honor the negotiated $12.00 full-plate reimbursement rate without imposing additional surcharge, service fees, or card minimums on the student.
              </li>
              <li>
                Maintain proper municipal food hygiene licenses and Hawaiʻi Department of Health certifications.
              </li>
            </ul>
          </section>

          <section className="space-y-3">
            <h2 className="font-serif text-xl font-bold text-stone-900">
              4. Donor Contributions & 501(c)(3) Stewardship
            </h2>
            <p>
              Kōkua Counter guarantees that 100% of individual meal donations are directed to restaurant reimbursement funds. Operational expenses (servers, web hosting, basic needs staff) are underwritten separately through philanthropic endowments. All donations are irrevocable and tax-deductible to the fullest extent permitted under IRS Section 501(c)(3).
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="font-serif text-xl font-bold text-stone-900">
              5. Governing Law
            </h2>
            <p>
              These terms are governed by the laws of the State of Hawaiʻi. Any disputes will be resolved through good-faith mediation in the City and County of Honolulu.
            </p>
          </section>
        </div>
      </div>
    </div>
  );
};
