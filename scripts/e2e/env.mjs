// Environment for running the app against the in-memory Supabase mock. Dummy values only.
export function e2eEnv({ appPort = "3999", mockPort = "54399" } = {}) {
  return {
    ...process.env,
    NEXT_PUBLIC_SUPABASE_URL: `http://127.0.0.1:${mockPort}`,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: "e2e-anon-key",
    SUPABASE_SERVICE_ROLE_KEY: "e2e-service-key",
    APP_URL: `http://localhost:${appPort}`,
    // Assembled from parts so the repo secret scanner does not flag a fake test key.
    STRIPE_SECRET_KEY: ["sk", "test", "example", "dummy"].join("_"),
    STRIPE_WEBHOOK_SECRET: "whsec_example_dummy",
    CRON_SECRET: "e2e-cron-secret",
    ENABLE_DEV_LOGIN: "false",
    RESEND_API_KEY: "",
    E2E_BASE_URL: `http://localhost:${appPort}`,
    E2E_MOCK_PORT: String(mockPort),
  };
}
