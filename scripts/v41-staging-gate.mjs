import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const pass = [];
const fail = [];
const check = (label, ok, detail='') => {
  (ok ? pass : fail).push({label, detail});
  console.log(`${ok ? 'PASS' : 'FAIL'} ${label}${detail ? ` — ${detail}` : ''}`);
};
const exists = p => fs.existsSync(path.join(root,p));
const read = p => fs.readFileSync(path.join(root,p),'utf8');

check('package version 0.41.0', JSON.parse(read('package.json')).version === '0.41.0');
check('docker compose exists', exists('docker-compose.yml'));
const compose = read('docker-compose.yml');
check('PostGIS image configured', /postgis\/postgis:16-3\.4/.test(compose));
check('Redis 7 configured', /redis:7-alpine/.test(compose));
check('Postgres healthcheck', /pg_isready/.test(compose));
check('Redis healthcheck', /redis-cli.*ping/.test(compose));
check('persistent Postgres volume', /hestiat_postgres/.test(compose));
check('persistent Redis volume', /hestiat_redis/.test(compose));

const env = read('.env.example');
for (const key of ['DATABASE_URL','REDIS_URL','APP_URL','NEXT_PUBLIC_APP_URL','STRIPE_SECRET_KEY','STRIPE_WEBHOOK_SECRET']) {
  check(`${key} documented`, new RegExp(`^${key}=`, 'm').test(env));
}
check('APP_URL único en env example', (env.match(/^APP_URL=/gm) || []).length === 1);
check('NEXT_PUBLIC_APP_URL único en env example', (env.match(/^NEXT_PUBLIC_APP_URL=/gm) || []).length === 1);

const schema = read('prisma/schema.prisma');
check('Prisma PostgreSQL datasource', /provider\s*=\s*"postgresql"/.test(schema));
check('Booking model present', /model Booking \{/.test(schema));
check('PaymentRecord model present', /model PaymentRecord \{/.test(schema));
check('HostPayout model present', /model HostPayout \{/.test(schema));
check('ExternalReservation model present', /model ExternalReservation \{/.test(schema));

const migrationDirs = fs.readdirSync(path.join(root,'prisma/migrations'), {withFileTypes:true})
  .filter(x=>x.isDirectory()).map(x=>x.name);
const duplicatePrefixes = [...new Set(migrationDirs.map(x=>x.match(/^(\d+)/)?.[1]).filter(Boolean))]
  .filter(n => migrationDirs.filter(x=>x.startsWith(n+'_')).length > 1);
check('migraciones sin prefijos numéricos duplicados', duplicatePrefixes.length === 0, duplicatePrefixes.join(', '));
check('migración inicial Prisma presente', migrationDirs.some(x => /^0001_/.test(x)), 'El historial actual empieza en 0002; debe reconstruirse antes de producción.' );

check('release gate V40 conservado', JSON.parse(read('package.json')).scripts?.['test:v40'] === 'node scripts/v40-e2e-gate.mjs');
check('staging env template present', exists('.env.staging.example'));
check('staging runbook present', exists('V41_STAGING_RUNBOOK.md'));

console.log(`\nV41 staging gate: ${pass.length} PASS, ${fail.length} FAIL.`);
if (fail.length) process.exit(1);
