import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const required = [
  'app/page.tsx',
  'app/resultados/page.tsx',
  'app/alojamiento/page.tsx',
  'app/reserva/page.tsx',
  'app/confirmacion/page.tsx',
  'app/mi-viaje/page.tsx',
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
  'app/api/anfitrion/alojamientos/route.ts',
  'app/api/anfitrion/alojamientos/mios/route.ts',
  'app/api/calendario/ical/[token]/route.ts',
  'prisma/schema.prisma',
  'docker-compose.yml',
  '.env.example'
];

const missing = required.filter(f => !fs.existsSync(path.join(root, f)));
if (missing.length) {
  console.error('V39 smoke: faltan archivos críticos:');
  for (const f of missing) console.error(` - ${f}`);
  process.exit(1);
}

const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
const env = fs.readFileSync(path.join(root, '.env.example'), 'utf8');
const checks = [
  ['version 0.39.0', pkg.version === '0.39.0'],
  ['APP_URL documentada', env.includes('APP_URL=')],
  ['dev-login protegido en producción', fs.readFileSync(path.join(root, 'app/api/auth/dev-login/route.ts'), 'utf8').includes("process.env.NODE_ENV === \"production\"")],
  ['checkout revalida en servidor', fs.existsSync(path.join(root, 'app/api/alojamientos/[id]/cotizacion/route.ts')) && fs.existsSync(path.join(root, 'app/api/reservas/[id]/pago/route.ts'))],
  ['Stripe webhook presente', fs.existsSync(path.join(root, 'app/api/stripe/webhook/route.ts'))],
  ['iCal presente', fs.existsSync(path.join(root, 'app/api/calendario/ical/[token]/route.ts'))],
];
const failed = checks.filter(([, ok]) => !ok);
for (const [label, ok] of checks) console.log(`${ok ? 'PASS' : 'FAIL'} ${label}`);
if (failed.length) process.exit(1);
console.log(`PASS V39 smoke: ${required.length} archivos críticos encontrados.`);
