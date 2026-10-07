import React from 'react';
import { useApp } from '../context/AppContext';
import { ShieldCheck, ArrowLeft, Lock, FileText } from 'lucide-react';

export const LegalPrivacyPage: React.FC = () => {
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
            <ShieldCheck className="w-3.5 h-3.5" />
            <span>FERPA & Student Dignity Compliant</span>
          </div>
          <h1 className="font-serif text-3xl sm:text-4xl font-bold text-[#132A1E]">
            Privacy Policy & Student Data Protections
          </h1>
          <p className="text-xs text-stone-500 mt-2">
            Last Updated: Fall Semester 2026 · Official Non-Profit Disclosure
          </p>
        </div>

        <div className="bg-white rounded-3xl p-6 sm:p-10 border border-stone-200/90 shadow-sm space-y-8 text-sm text-stone-700 leading-relaxed">
          <section className="space-y-3">
            <h2 className="font-serif text-xl font-bold text-stone-900">
              1. Our Core Principle: Zero-Stigma Privacy
            </h2>
            <p>
              Kōkua Counter was founded on the fundamental principle that receiving food assistance should carry zero stigma and total privacy. We recognize that students navigating food insecurity deserve the same confidentiality and respect as any paying customer at an island restaurant.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="font-serif text-xl font-bold text-stone-900">
              2. FERPA & University Data Protection
            </h2>
            <p>
              In alignment with the Family Educational Rights and Privacy Act (FERPA) and State of Hawaiʻi privacy statutes:
            </p>
            <ul className="list-disc pl-5 space-y-2 text-xs sm:text-sm">
              <li>
                <strong>No Academic Penalty:</strong> Your enrollment in Kōkua Counter is never noted on your academic transcript, nor disclosed to department chairs, professors, or student housing.
              </li>
              <li>
                <strong>No Financial Aid Impact:</strong> Meal credits provided through Kōkua Counter are treated as emergency basic needs hospitality gifts and are not counted against student loan eligibility.
              </li>
              <li>
                <strong>Masked Identifiers:</strong> At point-of-sale restaurant terminals, your student identification is strictly masked (e.g. UH-••••-8842). Cashiers cannot access your full legal name, academic major, GPA, or personal contact info.
              </li>
            </ul>
          </section>

          <section className="space-y-3">
            <h2 className="font-serif text-xl font-bold text-stone-900">
              3. Information We Collect
            </h2>
            <div className="space-y-2 text-xs sm:text-sm">
              <p>
                <strong>From Students:</strong> Verified University of Hawaiʻi email address (@hawaii.edu), student enrollment verification token, and transaction logs (timestamp and eatery location) strictly to reconcile merchant ACH reimbursements.
              </p>
              <p>
                <strong>From Donors:</strong> Legal name, email for tax-exempt 501(c)(3) receipts, billing address, and transaction amount. Payment card details are tokenized by PCI-DSS Level 1 compliant processors; Kōkua Counter never stores full credit card numbers.
              </p>
            </div>
          </section>

          <section className="space-y-3">
            <h2 className="font-serif text-xl font-bold text-stone-900">
              4. Merchant Terminal Security
            </h2>
            <p>
              Eatery staff terminals run on authenticated tokens. When a student passes their digital pass, the cashier only sees that an authorized credit is active and which wholesome dish was selected. The system automatically issues an ACH ledger entry and clears the screen after 30 seconds.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="font-serif text-xl font-bold text-stone-900">
              5. Questions & Contact
            </h2>
            <p>
              For privacy inquiries or data removal requests, contact our designated privacy officer at{' '}
              <a href="mailto:privacy@kokuacounter.org" className="text-[#24503B] font-semibold underline">
                privacy@kokuacounter.org
              </a>{' '}
              or write to Kōkua Counter, Campus Center Suite 208, Honolulu, HI 96822.
            </p>
          </section>
        </div>
      </div>
    </div>
  );
};
