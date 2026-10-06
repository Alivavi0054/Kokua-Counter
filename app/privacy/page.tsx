import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Privacy",
  description: "Draft privacy information for Kōkua Counter.",
};

export default function PrivacyPage() {
  return (
    <article className="prose prose-stone max-w-3xl space-y-6">
      <p className="text-sm font-semibold text-accent">Draft for review by a lawyer</p>
      <h1 className="font-serif text-4xl">Privacy</h1>
      <p>This draft describes the information Kōkua Counter uses to run meal credits. It is not a final privacy policy and needs review by a lawyer and the operating organization.</p>

      <section className="space-y-2">
        <h2 className="font-serif text-2xl">Information used</h2>
        <p>Students use an email address to confirm eligibility and sign in. The app stores a profile role and a generic display label. Donors may provide an email address for Stripe checkout and a receipt; that address is sent to Stripe and is not retained in Kōkua Counter contribution records. A donation can be anonymous in program displays.</p>
        <p>The app stores contribution amounts and status, pass hashes and expiry/status timestamps, and redemption time and eatery. The raw pass code is held in the active browser session and is not stored in the database.</p>
      </section>

      <section className="space-y-2">
        <h2 className="font-serif text-2xl">Who can see information</h2>
        <p>Participating eateries can confirm that a pass is accepted. They do not see a student’s name, email, or profile. Donors do not see recipient identities. Authorized program administrators can access account and transaction information needed to operate the service. Stripe processes checkout information under its own terms.</p>
      </section>

      <section className="space-y-2">
        <h2 className="font-serif text-2xl">Retention and deletion</h2>
        <p>A retention schedule has not yet been established. The pool ledger is append-only, so accounting entries cannot be edited through the application. The operating organization must determine retention and deletion procedures, including how to handle records required for accounting, before launch.</p>
        <p>To request account deletion or ask a privacy question, contact: <strong>[OWNER: ADD PRIVACY CONTACT EMAIL]</strong>. The owner must define the request-verification and response process before launch.</p>
      </section>
    </article>
  );
}