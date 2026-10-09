import { NextResponse } from "next/server";
import { recordAdminAction } from "@/lib/audit";
import { requireApiRole } from "@/lib/auth/guards";
import { describeError } from "@/lib/errors";
import { entriesCsv, isValidMonth, monthRangeHonolulu, summaryCsv, type ExportEntry } from "@/lib/finance-export";
import { rateLimit } from "@/lib/rate-limit";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const BATCH = 1000;
const MAX_ROWS = 50_000;

async function loadEntries(from: string, to: string): Promise<ExportEntry[]> {
  const admin = createAdminClient();
  const entries: ExportEntry[] = [];

  for (let offset = 0; offset < MAX_ROWS; offset += BATCH) {
    const { data, error } = await admin
      .from("pool_ledger")
      .select("created_at, entry_type, amount_cents, contribution_id, reference_key")
      .gte("created_at", from)
      .lt("created_at", to)
      .order("created_at")
      .order("id")
      .range(offset, offset + BATCH - 1);
    if (error) throw error;
    for (const row of data ?? []) {
      entries.push({ ...row, ledger: "pool", refund_id: null, amount_cents: Number(row.amount_cents) });
    }
    if ((data?.length ?? 0) < BATCH) break;
  }

  for (let offset = 0; offset < MAX_ROWS; offset += BATCH) {
    const { data, error } = await admin
      .from("operations_ledger")
      .select("created_at, entry_type, amount_cents, contribution_id, refund_id, reference_key")
      .gte("created_at", from)
      .lt("created_at", to)
      .order("created_at")
      .order("id")
      .range(offset, offset + BATCH - 1);
    if (error) throw error;
    for (const row of data ?? []) {
      entries.push({ ...row, ledger: "operations", amount_cents: Number(row.amount_cents) });
    }
    if ((data?.length ?? 0) < BATCH) break;
  }
  return entries;
}

/** Month statement for the accountant: `?month=YYYY-MM&view=entries|summary` (Hawaiʻi time). */
export async function GET(request: Request) {
  const auth = await requireApiRole("admin");
  if (!auth.ok) return auth.response;

  const limited = rateLimit(`admin-finance-export:${auth.user.id}`, 10, 60_000);
  if (!limited.ok) {
    return NextResponse.json({ error: "Please wait before trying again." }, { status: 429 });
  }

  const params = new URL(request.url).searchParams;
  const month = params.get("month");
  const view = params.get("view") === "summary" ? "summary" : "entries";
  if (!isValidMonth(month)) {
    return NextResponse.json({ error: "Choose a month in the form YYYY-MM." }, { status: 400 });
  }

  try {
    const { from, to } = monthRangeHonolulu(month);
    const entries = await loadEntries(from, to);
    const csv = view === "summary" ? summaryCsv(month, entries) : entriesCsv(entries);
    await recordAdminAction({ actorId: auth.user.id, action: "export.finance", details: { month, view, rows: entries.length } });
    return new NextResponse(csv, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="kokua-counter-${view}-${month}.csv"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    console.error("admin/finance-export: failed", describeError(error));
    return NextResponse.json({ error: "Could not build the statement." }, { status: 500 });
  }
}
