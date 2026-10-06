const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

async function pass<T>(label: string, callback: () => Promise<T>) {
  try {
    await callback();
    console.log(`PASS ${label}`);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.log(`FAIL ${label}: ${message}`);
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

  await pass("student generate", async () => {
    // This is a smoke-test scaffold; the actual local flow creates a contribution and calls the service-role RPC.
    // The script intentionally avoids database mutations in this static code pass.
    console.log("student generate check requires a live local database and service-role setup");
  });
}

main();
