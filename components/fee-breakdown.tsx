import { formatFeeRate } from "@/lib/fees";
import { cn, formatUsdFromCents } from "@/lib/utils";

/**
 * The one place a payment breakdown is rendered (checkout, confirmation, admin). Amounts always come
 * from the same calculation the server uses: donation + operational fee = total charged.
 */
export function FeeBreakdown({
  donationCents,
  feeCents,
  feeRateBps,
  totalCents,
  showExplanation = true,
  className,
}: {
  donationCents: number;
  feeCents: number;
  feeRateBps: number;
  totalCents: number;
  showExplanation?: boolean;
  className?: string;
}) {
  return (
    <div className={cn("rounded-xl border bg-secondary/40 p-4", className)} aria-label="Payment breakdown">
      <dl className="space-y-2 text-sm">
        <div className="flex items-baseline justify-between gap-4">
          <dt>Your donation to the meal pool</dt>
          <dd className="font-medium tabular-nums">{formatUsdFromCents(donationCents)}</dd>
        </div>
        {feeRateBps > 0 || feeCents > 0 ? (
          <div className="flex items-baseline justify-between gap-4">
            <dt>Operational fee ({formatFeeRate(feeRateBps)})</dt>
            <dd className="font-medium tabular-nums">{formatUsdFromCents(feeCents)}</dd>
          </div>
        ) : null}
        <div className="flex items-baseline justify-between gap-4 border-t pt-2 text-base">
          <dt className="font-semibold">Total payment</dt>
          <dd className="font-serif text-lg font-semibold tabular-nums text-primary">{formatUsdFromCents(totalCents)}</dd>
        </div>
      </dl>
      <p className="mt-3 text-sm font-medium text-primary">
        The meal pool receives the full {formatUsdFromCents(donationCents)}.
      </p>
      {showExplanation && feeCents > 0 ? (
        <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
          The operational fee is added on top of your donation to help cover platform operating costs such as software, hosting and staff. It is not a
          donation and it does not go to the meal pool.
        </p>
      ) : null}
    </div>
  );
}
