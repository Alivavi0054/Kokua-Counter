import { EateryActiveToggle } from "@/components/admin-eatery-toggle";
import { SettleEateryButton } from "@/components/admin-settle-eatery-button";
import { Badge } from "@/components/ui/badge";
import { TableShell } from "@/components/ui/table-shell";

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
  return (
    <TableShell minWidth="44rem">
            <thead className="bg-muted/70 text-muted-foreground">
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
              {eateries.map((eatery) => (
                <tr key={eatery.id}>
                  <td className="px-4 py-3">
                    <p className="font-medium text-foreground">{eatery.name}</p>
                    <p className="text-xs text-muted-foreground">{eatery.address}</p>
                  </td>
                  <td className="px-4 py-3">{eatery.island}</td>
                  <td className="px-4 py-3">{eatery.contact_email}</td>
                  <td className="px-4 py-3">
                    <Badge variant={eatery.is_active ? "success" : "outline"}>
                      {eatery.is_active ? "Active" : "Inactive"}
                    </Badge>
                  </td>
                  <td className="px-4 py-3">
                    <Badge variant={eatery.stripe_connect_account_id ? "success" : "warning"}>
                      {eatery.stripe_connect_account_id ? "Connected" : "Not connected"}
                    </Badge>
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
        </TableShell>
  );
}
