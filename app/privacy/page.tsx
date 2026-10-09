import type { Metadata } from "next";
import { ContactLine, LegalPage } from "@/components/legal-page";
import { getSiteContact } from "@/lib/site";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Privacy",
  description: "How Kōkua Counter uses and protects information.",
};

export default function PrivacyPage() {
  const contact = getSiteContact();
  return (
    <LegalPage
      eyebrow="Legal"
      title="Privacy"
      intro="A plain-language summary of the information Kōkua Counter uses to run meal credits. It is not a final privacy policy and is being reviewed by the operating organization."
    >
      <section>
        <h2>Information used</h2>
        <p>Students use an email address to confirm eligibility and sign in. The app stores a profile role and a generic display label. Donors may provide an email address for Stripe checkout and a receipt; that address is sent to Stripe and is not retained in Kōkua Counter contribution records. A donation can be anonymous in program displays.</p>
        <p>The app stores contribution amounts and status, pass hashes and expiry/status timestamps, and redemption time and eatery. The raw pass code is held in the active browser session and is not stored in the database.</p>
      </section>

      <section>
        <h2>Who can see information</h2>
        <p>Participating eateries can confirm that a pass is accepted. They do not see a student’s name, email, or profile. Donors do not see recipient identities. Authorized program administrators can access account and transaction information needed to operate the service. Stripe processes checkout information under its own terms.</p>
      </section>

      <section>
        <h2>Retention and deletion</h2>
        <p>The pool ledger is append-only, so accounting entries cannot be edited through the application. Records required for accounting are kept; other account information can be removed on request.</p>
        <p>
          To request account deletion or ask a privacy question, contact{" "}
          <ContactLine email={contact.email} fallback="the program administrator or the team through the school registration form" />.
        </p>
      </section>
    </LegalPage>
  );
}
