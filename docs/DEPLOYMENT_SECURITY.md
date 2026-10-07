# Deployment security checklist

## Ubuntu hardening

- Use SSH key-only access; disable password login and root SSH access.
- Limit inbound traffic with ufw to 22, 80, and 443 only.
- Enable fail2ban for repeated failed SSH or HTTP attacks.
- Keep unattended-upgrades enabled for security patches.
- Run the app as a dedicated non-root user behind systemd or Docker.
- Bind local Supabase ports to 127.0.0.1 only during development.
- Place Caddy or nginx in front of the app with automatic HTTPS and HSTS.
- Do not publish Docker ports to 0.0.0.0 in production.

## Backup and restore

- Take encrypted daily database backups.
- Test restores in a staging environment.
- Store backups off-system and keep at least one restore point outside the application host.

## Pre-launch checklist

- Confirm secrets are sourced from the deployment environment, never committed.
- Verify environment values are set for the production URL, Stripe, and Supabase.
- Confirm the app is behind TLS with HSTS enabled.
- Verify security headers are present in the live deployment.
- Validate the app responds only on HTTPS.
- Run the secret scanner and audit scripts before release.
- Confirm admins are the only role allowed to view health and metrics.
