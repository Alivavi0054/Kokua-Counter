import Link from "next/link";
import type { Metadata } from "next";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "About",
  description: "How Kōkua Counter shares meal credits across Hawaiʻi eateries.",
};

const steps = [
  {
    title: "Donors fund the pool",
    body: "Every $8 is one meal credit. Contributions go into one shared pool, not to a specific restaurant or student.",
  },
  {
    title: "Students create a pass",
    body: "A University of Hawaiʻi student signs in with a confirmed @hawaii.edu email and requests a private, single-use QR pass.",
  },
  {
    title: "Eateries scan and serve",
    body: "A participating eatery scans the pass. The meal is drawn from the pool, and the eatery is paid out for the meals it served.",
  },
];

const faqs = [
  {
    q: "Is a student’s identity shared with the eatery?",
    a: "No. The scanner only confirms whether a pass is valid. It does not show a name or email.",
  },
  {
    q: "Are there limits on use?",
    a: "By default a student can redeem one meal per day and generate up to three passes per day, so the pool reaches more people.",
  },
  {
    q: "Who can become a participating eatery?",
    a: "Local food businesses are added by the program team. Eatery staff and administrators use accounts that the team creates for them.",
  },
];

export default function AboutPage() {
  return (
    <div className="mx-auto max-w-4xl space-y-12">
      <PageHeader
        eyebrow="About the program"
        title="A suspended-meal program for Hawaiʻi"
        description="Kōkua Counter connects neighbors, students, and local eateries through a shared pool of meal credits, with privacy built into every step."
      />

      <section aria-labelledby="how" className="space-y-5">
        <h2 id="how" className="font-serif text-2xl font-semibold text-primary">How it works</h2>
        <ol className="grid gap-4 md:grid-cols-3">
          {steps.map((step, index) => (
            <li key={step.title}>
              <Card className="h-full">
                <CardHeader>
                  <span className="flex size-9 items-center justify-center rounded-full bg-secondary font-serif text-lg font-semibold text-primary" aria-hidden="true">
                    {index + 1}
                  </span>
                  <CardTitle>{step.title}</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm leading-relaxed text-muted-foreground">{step.body}</p>
                </CardContent>
              </Card>
            </li>
          ))}
        </ol>
      </section>

      <section aria-labelledby="faq" className="space-y-4">
        <h2 id="faq" className="font-serif text-2xl font-semibold text-primary">Good to know</h2>
        <dl className="divide-y rounded-xl border bg-card shadow-soft">
          {faqs.map((item) => (
            <div key={item.q} className="space-y-1 px-5 py-4">
              <dt className="font-semibold text-foreground">{item.q}</dt>
              <dd className="text-sm leading-relaxed text-muted-foreground">{item.a}</dd>
            </div>
          ))}
        </dl>
      </section>

      <section className="flex flex-col items-start gap-4 rounded-xl bg-primary px-6 py-8 text-primary-foreground sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="font-serif text-2xl font-semibold">Make room for one more at the table.</h2>
          <p className="mt-1 text-sm text-primary-foreground/80">Add a meal credit, or bring Kōkua Counter to your school.</p>
        </div>
        <div className="flex flex-wrap gap-3">
          <Button asChild variant="accent" size="lg"><Link href="/donate">Donate a meal</Link></Button>
          <Button asChild variant="outline" size="lg" className="border-primary-foreground/30 bg-transparent text-primary-foreground hover:bg-primary-foreground/10 hover:text-primary-foreground">
            <Link href="/school/register">Register a school</Link>
          </Button>
        </div>
      </section>
    </div>
  );
}
