import Image from "next/image";
import Link from "next/link";
import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Shared meals, stronger community",
  description:
    "Help University of Hawaiʻi students access a meal through Kōkua Counter's shared meal pool.",
};

export default async function HomePage() {
  const supabase = await createClient();
  const { data: eateries } = await supabase
    .from("public_eateries")
    .select("name, slug, island, address")
    .order("name");

  return (
    <div className="relative left-1/2 -ml-[50vw] -mt-8 -mb-8 w-screen overflow-hidden bg-[#fbfaf6] text-[#1e2922]">
      <section className="border-b border-[#e8e5dc] px-4 pb-16 pt-12 sm:px-6 sm:pb-20 sm:pt-16 lg:px-8">
        <div className="mx-auto grid max-w-7xl items-center gap-12 lg:grid-cols-12 lg:gap-10">
          <div className="space-y-6 lg:col-span-7">
            <p className="inline-flex items-center gap-2 rounded-full bg-[#e7efe9] px-3.5 py-1.5 text-xs font-semibold text-[#24503b]">
              Shared meal credits for University of Hawaiʻi students
            </p>
            <h1 className="max-w-3xl font-serif text-4xl font-semibold leading-[1.08] text-[#18392b] sm:text-5xl lg:text-6xl">
              A good meal can change the shape of a day.
            </h1>
            <p className="max-w-2xl text-base leading-relaxed text-stone-700 sm:text-lg">
              Kōkua Counter brings neighbors, students, and local eateries together through a shared pool of meal credits. Students can use a private, single-use pass at participating counters.
            </p>
            <div className="flex flex-col gap-3 pt-1 sm:flex-row">
              <Link
                href="/donate"
                className="inline-flex min-h-12 items-center justify-center gap-2 rounded-lg bg-[#c8583d] px-6 text-sm font-semibold text-white transition-colors hover:bg-[#a94530]"
              >
                Contribute to the meal pool <span aria-hidden="true">→</span>
              </Link>
              <Link
                href="/auth/login"
                className="inline-flex min-h-12 items-center justify-center rounded-lg border border-[#c9d1c9] bg-white px-6 text-sm font-semibold text-[#18392b] transition-colors hover:bg-[#f0f3ef]"
              >
                Student Login
              </Link>
            </div>
            <div className="grid max-w-xl grid-cols-3 gap-4 border-t border-[#deded5] pt-6">
              <div>
                <p className="font-serif text-2xl font-semibold text-[#18392b]">$8</p>
                <p className="mt-1 text-xs leading-snug text-stone-600">per meal credit</p>
              </div>
              <div>
                <p className="font-serif text-2xl font-semibold text-[#2a6f78]">One-time</p>
                <p className="mt-1 text-xs leading-snug text-stone-600">private meal pass</p>
              </div>
              <div>
                <p className="font-serif text-2xl font-semibold text-[#c8583d]">Local</p>
                <p className="mt-1 text-xs leading-snug text-stone-600">participating eateries</p>
              </div>
            </div>
          </div>

          <div className="relative lg:col-span-5">
            <div className="relative aspect-[4/3] overflow-hidden rounded-xl bg-[#d9e0d5] shadow-xl">
              <Image
                src="/images/community-meals.jpg"
                alt="University students sharing a meal together outdoors"
                fill
                priority
                sizes="(max-width: 1024px) 100vw, 42vw"
                className="object-cover"
              />
            </div>
            <div className="absolute -bottom-5 left-3 right-3 flex items-center gap-3 rounded-lg border border-[#e6e4dc] bg-white p-3.5 shadow-lg sm:left-6 sm:right-auto sm:max-w-sm">
              <span className="flex size-10 shrink-0 items-center justify-center rounded-md bg-[#e7efe9] text-lg text-[#24503b]" aria-hidden="true">♡</span>
              <p className="text-xs leading-relaxed text-stone-700">One shared pool. A little more room for students to focus on their day.</p>
            </div>
          </div>
        </div>
      </section>

      <section className="bg-[#f0eee6] px-4 py-14 sm:px-6 sm:py-16 lg:px-8">
        <div className="mx-auto grid max-w-7xl gap-8 md:grid-cols-3">
          <article className="border-t-2 border-[#c8583d] pt-5">
            <p className="text-xs font-semibold uppercase text-[#a94530]">01 · Give</p>
            <h2 className="mt-3 font-serif text-2xl font-semibold text-[#18392b]">Add a meal credit</h2>
            <p className="mt-2 text-sm leading-relaxed text-stone-700">Choose an amount and complete checkout. Your contribution joins the shared meal pool.</p>
          </article>
          <article className="border-t-2 border-[#2a6f78] pt-5">
            <p className="text-xs font-semibold uppercase text-[#2a6f78]">02 · Sign in</p>
            <h2 className="mt-3 font-serif text-2xl font-semibold text-[#18392b]">Students create a pass</h2>
            <p className="mt-2 text-sm leading-relaxed text-stone-700">Eligible students sign in with a confirmed University of Hawaiʻi email and request a single-use QR pass.</p>
          </article>
          <article className="border-t-2 border-[#24503b] pt-5">
            <p className="text-xs font-semibold uppercase text-[#24503b]">03 · Share</p>
            <h2 className="mt-3 font-serif text-2xl font-semibold text-[#18392b]">Redeem at the counter</h2>
            <p className="mt-2 text-sm leading-relaxed text-stone-700">A participating eatery scans the pass and the corresponding meal credit is redeemed from the pool.</p>
          </article>
        </div>
      </section>

      <section id="eateries-section" className="scroll-mt-24 px-4 py-16 sm:px-6 sm:py-20 lg:px-8">
        <div className="mx-auto max-w-7xl">
          <div className="mb-8 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase text-[#2a6f78]">Community partners</p>
              <h2 className="mt-2 font-serif text-3xl font-semibold text-[#18392b] sm:text-4xl">Find a participating eatery</h2>
            </div>
            <p className="max-w-md text-sm leading-relaxed text-stone-600">The current partner list is pulled from Kōkua Counter, not sample restaurant data.</p>
          </div>
          {!eateries || eateries.length === 0 ? (
            <p className="border-y border-[#deded5] py-6 text-sm text-stone-600">No participating eateries are listed yet.</p>
          ) : (
            <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {eateries.map((eatery) => (
                <article key={eatery.slug} className="overflow-hidden rounded-lg border border-[#e2e0d8] bg-white">
                  <div className="relative aspect-[16/10] bg-[#d9e0d5]">
                    <Image
                      src="/images/local-meal.jpg"
                      alt="A freshly prepared meal at a local eatery"
                      fill
                      sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
                      className="object-cover"
                    />
                  </div>
                  <div className="p-5">
                    <p className="text-xs font-medium text-[#2a6f78]">{eatery.island}</p>
                    <h3 className="mt-1 font-serif text-xl font-semibold text-[#18392b]">{eatery.name}</h3>
                    {eatery.address ? <p className="mt-2 text-sm text-stone-600">{eatery.address}</p> : null}
                  </div>
                </article>
              ))}
            </div>
          )}
        </div>
      </section>

      <section className="bg-[#18392b] px-4 py-14 text-white sm:px-6 sm:py-16 lg:px-8">
        <div className="mx-auto grid max-w-7xl items-center gap-8 md:grid-cols-2">
          <div>
            <p className="text-xs font-semibold uppercase text-[#a3e0c8]">A community effort</p>
            <h2 className="mt-3 font-serif text-3xl font-semibold leading-tight sm:text-4xl">Food is part of feeling at home.</h2>
            <p className="mt-4 max-w-xl text-sm leading-relaxed text-stone-200">Kōkua Counter connects contributions with students through participating local kitchens, with a private pass at the point of redemption.</p>
            <Link href="/about" className="mt-5 inline-flex items-center gap-2 text-sm font-semibold text-[#a3e0c8] underline underline-offset-4 hover:text-white">Learn about the program <span aria-hidden="true">→</span></Link>
          </div>
          <div className="relative aspect-[16/10] overflow-hidden rounded-lg border border-white/15">
            <Image
              src="/images/community-team.jpg"
              alt="Community members sharing food and supporting one another"
              fill
              sizes="(max-width: 768px) 100vw, 50vw"
              className="object-cover"
            />
          </div>
        </div>
      </section>

      <section className="px-4 py-16 sm:px-6 sm:py-20 lg:px-8">
        <div className="mx-auto grid max-w-5xl gap-10 md:grid-cols-[0.8fr_1.2fr]">
          <div>
            <p className="text-xs font-semibold uppercase text-[#c8583d]">Good to know</p>
            <h2 className="mt-2 font-serif text-3xl font-semibold text-[#18392b]">Questions, answered.</h2>
          </div>
          <div className="divide-y divide-[#deded5] border-y border-[#deded5]">
            <details className="group py-4">
              <summary className="cursor-pointer list-none font-semibold text-[#18392b]">How much is one meal credit?<span className="float-right text-[#2a6f78] group-open:rotate-45">+</span></summary>
              <p className="mt-3 text-sm leading-relaxed text-stone-600">Each $8 in the shared pool covers one meal credit.</p>
            </details>
            <details className="group py-4">
              <summary className="cursor-pointer list-none font-semibold text-[#18392b]">Can I choose which eatery receives my contribution?<span className="float-right text-[#2a6f78] group-open:rotate-45">+</span></summary>
              <p className="mt-3 text-sm leading-relaxed text-stone-600">Contributions go into one shared pool. Students redeem credits at any participating eatery.</p>
            </details>
            <details className="group py-4">
              <summary className="cursor-pointer list-none font-semibold text-[#18392b]">What does an eatery see when scanning a pass?<span className="float-right text-[#2a6f78] group-open:rotate-45">+</span></summary>
              <p className="mt-3 text-sm leading-relaxed text-stone-600">The scanner confirms whether a pass is valid; it does not show the student’s name or email.</p>
            </details>
          </div>
        </div>
      </section>

      <section className="bg-[#e7efe9] px-4 py-12 text-center sm:px-6 lg:px-8">
        <div className="mx-auto max-w-3xl space-y-4">
          <h2 className="font-serif text-3xl font-semibold text-[#18392b]">Make room for one more at the table.</h2>
          <p className="text-sm leading-relaxed text-stone-700">A contribution helps keep meal credits available to University of Hawaiʻi students at participating eateries.</p>
          <Link href="/donate" className="inline-flex min-h-11 items-center justify-center rounded-lg bg-[#c8583d] px-6 text-sm font-semibold text-white transition-colors hover:bg-[#a94530]">Donate to the shared pool</Link>
        </div>
      </section>
    </div>
  );
}
