import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const root = process.cwd();
const checks = [];
const migrationsDir = path.join(root, 'prisma', 'migrations');
const entries = fs.readdirSync(migrationsDir, {withFileTypes:true}).filter(e=>e.isDirectory()).map(e=>e.name).sort();
const expected = Array.from({length:15}, (_,i)=>String(i+1).padStart(4,'0'));
checks.push(['migration chain 0001..0015', entries.map(x=>x.slice(0,4)).join(',') === expected.join(',')]);
checks.push(['schema.prisma present', fs.existsSync(path.join(root,'prisma','schema.prisma'))]);
checks.push(['docker compose present', fs.existsSync(path.join(root,'docker-compose.yml'))]);
checks.push(['staging env present', fs.existsSync(path.join(root,'.env.staging.example'))]);

const docker = spawnSync('docker',['--version'],{encoding:'utf8'});
const dockerAvailable = docker.status === 0;
checks.push(['Docker runtime available', dockerAvailable]);
if (dockerAvailable) {
  const up = spawnSync('docker',['compose','up','-d','postgres','redis'],{cwd:root,encoding:'utf8',timeout:120000});
  checks.push(['PostgreSQL + Redis containers started', up.status === 0]);
  if (up.status === 0) {
    const env = {...process.env,DATABASE_URL:process.env.DATABASE_URL || 'postgresql://hestiat:hestiat@localhost:5432/hestiat'};
    const migrate = spawnSync('npx',['prisma@6.16.2','migrate','deploy'],{cwd:root,encoding:'utf8',timeout:120000,env});
    fs.writeFileSync(path.join(root,'V43_MIGRATE_DEPLOY_OUTPUT.txt'), `${migrate.stdout||''}\n${migrate.stderr||''}`);
    checks.push(['prisma migrate deploy', migrate.status === 0]);
  }
} else {
  fs.writeFileSync(path.join(root,'V43_RUNTIME_LIMITATION.md'), '# V43 runtime limitation\n\nThe source and migration chain were statically validated, but this execution environment does not provide Docker. Therefore PostgreSQL/PostGIS/Redis could not be started and `prisma migrate deploy` could not be executed here.\n\nRun the commands in the V43 staging runbook on a machine with Docker.\n');
}
let pass=0;
for (const [label,ok] of checks) { console.log(`${ok?'PASS':'PENDING'} ${label}`); if(ok) pass++; }
console.log(`\\nV43 static/runtime gate: ${pass}/${checks.length} PASS`);
process.exit(dockerAvailable && checks.some(([l])=>l==='prisma migrate deploy' && checks.find(([x])=>x===l)?.[1]===false) ? 1 : 0);
