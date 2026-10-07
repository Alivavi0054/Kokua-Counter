"use client";

import { useMemo, useState } from "react";
import { EateryActiveToggle } from "@/components/admin-eatery-toggle";
import { SettleEateryButton } from "@/components/admin-settle-eatery-button";
import { Input } from "@/components/ui/input";

type Eatery = {
  id: string;
  name: string;
  island: string;
  address: string;
  contact_email: string;
  is_active: boolean;
  stripe_connect_account_id: string | null;
};

export function AdminEateriesTable({ eateries }: { eateries: Eatery[] }) {
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    const term = query.trim().toLowerCase();
    if (!term) return eateries;
    return eateries.filter((eatery) =>
      [eatery.name, eatery.island, eatery.address, eatery.contact_email].some((field) =>
        field.toLowerCase().includes(term),
      ),
    );
  }, [eateries, query]);

  return (
    <div className="space-y-3">
      <Input
        placeholder="Search by name, island, address, or email"
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        className="max-w-sm"
        aria-label="Search eateries"
      />
      {filtered.length === 0 ? (
        <p className="text-muted-foreground">No eateries match your search.</p>
      ) : (
        <div className="overflow-x-auto rounded-md border">
          <table className="w-full min-w-[40rem] text-left text-sm">
            <thead className="bg-muted text-muted-foreground">
              <tr>
                <th className="px-4 py-3 font-medium">Name</th>
                <th className="px-4 py-3 font-medium">Island</th>
                <th className="px-4 py-3 font-medium">Contact</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium">Payouts</th>
                <th className="px-4 py-3 text-right font-medium">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {filtered.map((eatery) => (
                <tr key={eatery.id}>
                  <td className="px-4 py-3">
                    <p className="font-medium text-foreground">{eatery.name}</p>
                    <p className="text-xs text-muted-foreground">{eatery.address}</p>
                  </td>
                  <td className="px-4 py-3">{eatery.island}</td>
                  <td className="px-4 py-3">{eatery.contact_email}</td>
                  <td className="px-4 py-3">
                    <span className={eatery.is_active ? "text-green-700" : "text-muted-foreground"}>
                      {eatery.is_active ? "Active" : "Inactive"}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span className={eatery.stripe_connect_account_id ? "text-green-700" : "text-muted-foreground"}>
                      {eatery.stripe_connect_account_id ? "Connected" : "Not connected"}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex flex-col items-end gap-2">
                      <EateryActiveToggle eateryId={eatery.id} isActive={eatery.is_active} />
                      <SettleEateryButton eateryId={eatery.id} isConnected={Boolean(eatery.stripe_connect_account_id)} />
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
