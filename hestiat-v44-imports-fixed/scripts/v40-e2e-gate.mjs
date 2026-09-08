import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const failures = [];
const passes = [];

function exists(rel) {
  return fs.existsSync(path.join(root, rel));
}
function read(rel) {
  return fs.readFileSync(path.join(root, rel), 'utf8');
}
function check(label, ok, detail = '') {
  (ok ? passes : failures).push({ label, detail });
  console.log(`${ok ? 'PASS' : 'FAIL'} ${label}${detail ? ` — ${detail}` : ''}`);
}

const criticalFiles = [
  'app/page.tsx',
  'app/resultados/page.tsx',
  'app/alojamiento/page.tsx',
  'app/alojamiento/DateRangePicker.tsx',
  'app/reserva/page.tsx',
  'app/reserva/PaymentElement.tsx',
  'app/confirmacion/page.tsx',
  'app/mi-viaje/page.tsx',
  'app/mi-viaje/[id]/page.tsx',
  'app/anfitrion/page.tsx',
  'app/api/alojamientos/route.ts',
  'app/api/alojamientos/[id]/cotizacion/route.ts',
  'app/api/alojamientos/[id]/disponibilidad/route.ts',
  'app/api/reservas/route.ts',
  'app/api/reservas/[id]/pago/route.ts',
  'app/api/stripe/webhook/route.ts',
  'app/api/auth/request-link/route.ts',
  'app/api/auth/verify/route.ts',
  'app/api/auth/logout/route.ts',
  'app/api/calendario/ical/[token]/route.ts',
  'src/server/lib/auth.ts',
  'src/server/modules/bookings/create.ts',
  'src/server/modules/cancellations/service.ts',
  'src/server/modules/availability/unified.ts',
  'prisma/schema.prisma',
  'docker-compose.yml',
  '.env.example'
];

for (const file of criticalFiles) check(`archivo crítico ${file}`, exists(file));

const pkg = JSON.parse(read('package.json'));
check('versión 0.40.0', pkg.version === '0.40.0');
check('script test:v40 presente', pkg.scripts?.['test:v40'] === 'node scripts/v40-e2e-gate.mjs');
check('release gate incluye V40', pkg.scripts?.['test:release']?.includes('test:v40'));

const env = read('.env.example');
for (const key of ['DATABASE_URL', 'REDIS_URL', 'APP_URL', 'STRIPE_SECRET_KEY', 'STRIPE_WEBHOOK_SECRET']) {
  check(`variable ${key} documentada`, env.includes(`${key}=`));
}

const auth = read('src/server/lib/auth.ts');
check('sesión usa cookie HttpOnly', /httpOnly:\s*true/.test(auth));
check('sesión SameSite=Lax', /sameSite:\s*["']lax["']/.test(auth));
check('sesión Secure en producción', /secure:\s*process\.env\.NODE_ENV\s*===\s*["']production["']/.test(auth));
check('token de sesión se hashea', /createHash\(["']sha256["']\)/.test(auth));

const booking = read('src/server/modules/bookings/create.ts');
check('checkout usa transacción Serializable', /isolationLevel:\s*["']Serializable["']/.test(booking));
check('checkout bloquea listing antes de comprobar disponibilidad', /lockListing\(tx, input\.listingId\)/.test(booking));
check('checkout comprueba disponibilidad unificada', /getListingAvailability\(/.test(booking));

const availability = read('src/server/modules/availability/unified.ts');
check('disponibilidad usa advisory lock PostgreSQL', /pg_advisory_xact_lock/.test(availability));
check('disponibilidad contempla reservas externas', /externalReservation|ExternalReservation/.test(availability));
check('disponibilidad contempla bloques manuales', /availabilityDay|BLOCKED/.test(availability));

const payment = read('app/api/reservas/[id]/pago/route.ts');
check('pago requiere sesión', /getCurrentUser\(\)/.test(payment));
check('pago restringido al huésped de la reserva', /guestId:\s*currentUser\.id/.test(payment));
check('PaymentIntent tiene idempotencia', /booking-payment:\$\{booking\.id\}/.test(payment));
check('pago rechaza reserva expirada', /expiresAt/.test(payment) && /EXPIRED/.test(payment));

const webhook = read('app/api/stripe/webhook/route.ts');
check('webhook verifica firma Stripe', /constructEvent\(raw, signature, secret\)/.test(webhook));
check('webhook es idempotente por event id', /stripeWebhookEvent\.findUnique/.test(webhook) && /stripeWebhookEvent\.create/.test(webhook));
check('webhook confirma pago', /payment_intent\.succeeded/.test(webhook) && /CONFIRMED/.test(webhook));
check('webhook registra reembolsos', /charge\.refunded/.test(webhook) && /Refunded|REFUNDED|PARTIALLY_REFUNDED/.test(webhook));

const cancel = read('src/server/modules/cancellations/service.ts');
check('cancelación usa idempotencia Stripe', /idempotencyKey/.test(cancel));
check('cancelación contempla política', /FLEXIBLE|MODERATE|FIRM/.test(cancel));

const smoke = read('scripts/v39-release-smoke.mjs');
check('smoke V39 conservado', smoke.includes('V39 smoke'));

// Basic static route safety: production must not expose dev-login.
const devLogin = exists('app/api/auth/dev-login/route.ts') ? read('app/api/auth/dev-login/route.ts') : '';
check('dev-login bloqueado en producción', !devLogin || /NODE_ENV\s*===\s*["']production["']/.test(devLogin));

// Detect accidental hard-coded local transaction URLs in app/server code.
const scanDirs = ['app', 'src'];
let localUrls = [];
for (const dir of scanDirs) {
  const base = path.join(root, dir);
  if (!fs.existsSync(base)) continue;
  const stack = [base];
  while (stack.length) {
    const current = stack.pop();
    for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
      const full = path.join(current, entry.name);
      if (entry.isDirectory()) stack.push(full);
      else if (/\.(ts|tsx|js|jsx|mjs)$/.test(entry.name)) {
        const text = fs.readFileSync(full, 'utf8');
        if (/https?:\/\/localhost(?::\d+)?/.test(text)) localUrls.push(path.relative(root, full));
      }
    }
  }
}
check('sin URLs localhost hard-coded en app/src', localUrls.length === 0, localUrls.join(', '));

// Optional live smoke test. It only runs when E2E_BASE_URL is explicitly provided.
if (process.env.E2E_BASE_URL) {
  const base = process.env.E2E_BASE_URL.replace(/\/$/, '');
  const routes = ['/', '/resultados', '/login', '/anfitrion'];
  for (const route of routes) {
    try {
      const res = await fetch(`${base}${route}`, { redirect: 'manual' });
      check(`HTTP ${route}`, res.status < 500, `status ${res.status}`);
    } catch (error) {
      check(`HTTP ${route}`, false, error instanceof Error ? error.message : String(error));
    }
  }
} else {
  console.log('INFO live HTTP smoke omitido: define E2E_BASE_URL para ejecutarlo contra una instancia desplegada.');
}

console.log(`\\nV40 gate: ${passes.length} PASS, ${failures.length} FAIL.`);
if (failures.length) {
  console.error('V40 NO está listo para release: hay fallos estáticos.');
  process.exit(1);
}
console.log('V40 gate estático: OK. Las pruebas de infraestructura/Stripe/DB requieren entorno real.');
