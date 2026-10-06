const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

async function pass<T>(label: string, callback: () => Promise<T>) {
  try {
    await callback();
    console.log(`PASS ${label}`);
  } catch {
    console.log(`FAIL ${label}`);
    process.exitCode = 1;
  }
}

async function main() {
  await pass("health", async () => {
    const response = await fetch(`${appUrl}/api/health`);
    if (response.status !== 200) {
      throw new Error(`Expected 200, got ${response.status}`);
    }
  });

  await pass("protected QR generation", async () => {
    const response = await fetch(`${appUrl}/api/qr/generate`, {
      method: "POST",
      headers: { Origin: appUrl },
    });
    if (response.status !== 401) {
      throw new Error("Expected unauthenticated request to be rejected.");
    }
  });

  await pass("cron authorization", async () => {
    const response = await fetch(`${appUrl}/api/cron/expire-qrs`);
    if (response.status !== 401) {
      throw new Error("Expected missing cron authorization to be rejected.");
    }
  });
}

main();
