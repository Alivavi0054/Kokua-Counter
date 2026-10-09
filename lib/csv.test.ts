import { describe, expect, it } from "vitest";
import { toCsv } from "@/lib/csv";

const columns = [
  { key: "name", header: "Name" },
  { key: "amount", header: "Amount" },
];

describe("toCsv", () => {
  it("writes headers and plain rows", () => {
    expect(toCsv([{ name: "Aloha", amount: 5 }], columns)).toBe("Name,Amount\nAloha,5");
  });

  it("neutralizes formula injection in string cells", () => {
    for (const payload of ["=SUM(A1)", "+1+1", "-2+3", "@cmd", "\tcmd", "\rcmd"]) {
      const csv = toCsv([{ name: payload, amount: 1 }], columns);
      const cell = csv.split("\n").slice(1).join("\n");
      expect(cell.replace(/^"/, "").startsWith(`'${payload}`)).toBe(true);
    }
  });

  it("leaves negative numbers alone and quotes cells containing CR, LF, commas and quotes", () => {
    expect(toCsv([{ name: "x", amount: -500 }], columns)).toBe("Name,Amount\nx,-500");
    expect(toCsv([{ name: "a\rb", amount: 1 }], columns)).toBe('Name,Amount\n"a\rb",1');
    expect(toCsv([{ name: 'say "hi", ok\nbye', amount: 1 }], columns)).toBe(
      'Name,Amount\n"say ""hi"", ok\nbye",1',
    );
  });

  it("renders null and undefined as empty cells", () => {
    expect(toCsv([{ name: null }], columns)).toBe("Name,Amount\n,");
  });
});
