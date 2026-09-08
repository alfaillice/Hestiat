# Hestiat V23 — Authentication & Account Hardening

V23 replaces the previous insecure user-id cookie with opaque, random, database-backed sessions.

- Magic links remain passwordless and expire after 15 minutes.
- Magic-link tokens are stored only as SHA-256 hashes and are single-use.
- Sessions use random 256-bit opaque tokens; the browser never receives a user ID.
- Session cookies are HttpOnly, SameSite=Lax and Secure in production.
- Expired sessions are rejected and cleaned opportunistically.
- Logout revokes the current server-side session.
- Production magic-link requests are delivered through the configured Resend adapter.
- Dev login remains unavailable in production.

## Required production environment

`APP_URL`, `RESEND_API_KEY`, `RESEND_FROM_EMAIL`, and `DATABASE_URL`.
