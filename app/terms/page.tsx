import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Terms",
  description: "Draft terms for using Kōkua Counter.",
};

export default function TermsPage() {
  return (
    <article className="prose prose-stone max-w-3xl space-y-6">
      <p className="text-sm font-semibold text-accent">Draft for review by a lawyer</p>
      <h1 className="font-serif text-4xl">Terms</h1>
      <p>This plain-language draft is not final terms of service. It needs review by a lawyer and the operating organization before public launch.</p>

      <section className="space-y-2">
        <h2 className="font-serif text-2xl">Using meal passes</h2>
        <p>Eligible students sign in with a confirmed University of Hawaiʻi email address and present an active, single-use QR pass at a participating eatery. A pass expires at the time shown in the app. Do not share or reuse a pass.</p>
        <p>Default limits are one redeemed meal and three generated passes per Honolulu calendar day. Limits may be adjusted by the operating organization.</p>
      </section>

      <section className="space-y-2">
        <h2 className="font-serif text-2xl">Contributions</h2>
        <p>Contributions go to a shared pool and are not assigned to a particular student or eatery. Stripe processes checkout. The operating organization must publish its refund and tax treatment after legal and accounting review.</p>
      </section>

      <section className="space-y-2">
        <h2 className="font-serif text-2xl">Questions</h2>
        <p>Contact the operating organization at <strong>[OWNER: ADD CONTACT EMAIL]</strong>. This placeholder must be completed before launch.</p>
      </section>
    </article>
  );
}