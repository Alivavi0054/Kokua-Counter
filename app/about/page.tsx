export default function AboutPage() {
  return (
    <article className="prose-none max-w-2xl space-y-4">
      <h1 className="font-serif text-4xl">About Kōkua Counter</h1>
      <p className="text-lg text-muted-foreground">
        Kōkua Counter is a suspended-meal program. Donors buy $8 meal credits
        that go into one shared pool. Verified Hawaiʻi students generate a
        single-use QR meal pass and redeem it at a participating eatery.
      </p>
      <p>
        Credits are not assigned to a specific restaurant at donation time.
        When a pass is shown and accepted, that meal is drawn from the pool.
      </p>
      <p>
        Students sign in with a University of Hawaiʻi email (@hawaii.edu).
        Eatery staff sign in with the account created for their kitchen.
      </p>
    </article>
  );
}
