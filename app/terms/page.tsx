import type { Metadata } from "next";
import { ContactLine, LegalPage } from "@/components/legal-page";
import { getSiteContact } from "@/lib/site";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Terms",
  description: "Terms for using Kōkua Counter.",
};

export default function TermsPage() {
  const contact = getSiteContact();
  return (
    <LegalPage
      eyebrow="Legal"
      title="Terms"
      intro="A plain-language summary of how Kōkua Counter works. It is not final terms of service and is being reviewed by the operating organization."
    >
      <section>
        <h2>Using meal passes</h2>
        <p>Eligible students at participating Hawaiʻi schools sign in with a confirmed school email address and present an active, single-use QR pass at a participating eatery. A pass expires at the time shown in the app. Do not share or reuse a pass.</p>
        <p>Default limits are one redeemed meal and three generated passes per Honolulu calendar day. Limits may be adjusted by the operating organization.</p>
      </section>

      <section>
        <h2>Contributions</h2>
        <p>Contributions go to a shared pool and are not assigned to a particular student or eatery. Stripe processes checkout. Refund and tax treatment are set by the operating organization.</p>
      </section>

      <section>
        <h2>Questions</h2>
        <p>
          Contact the operating organization at{" "}
          <ContactLine email={contact.email} fallback="the program administrator or through the school registration form" />.
        </p>
      </section>
    </LegalPage>
  );
}
