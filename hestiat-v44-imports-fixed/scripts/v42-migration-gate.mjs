import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const dir = path.join(root, 'prisma', 'migrations');
const entries = fs.readdirSync(dir, {withFileTypes:true}).filter(e=>e.isDirectory()).map(e=>e.name).sort();
const expected = Array.from({length:15}, (_,i)=>String(i+1).padStart(4,'0'));
const prefixes = entries.map(n=>n.slice(0,4));
const unique = new Set(prefixes);
const checks = [];
checks.push(['15 migration directories present', entries.length === 15]);
checks.push(['sequence 0001..0015 complete', expected.every(x=>prefixes.includes(x))]);
checks.push(['numeric prefixes unique', unique.size === prefixes.length]);
checks.push(['0001 contains baseline SQL', fs.existsSync(path.join(dir,'0001_initial_schema','migration.sql')) && fs.statSync(path.join(dir,'0001_initial_schema','migration.sql')).size > 1000]);
checks.push(['schema exists', fs.existsSync(path.join(root,'prisma','schema.prisma'))]);
const bad = entries.filter(n=>!/^\d{4}_[a-z0-9_]+$/.test(n));
checks.push(['migration names are Prisma-safe', bad.length === 0]);
let pass=0;
for (const [label,ok] of checks) { console.log(`${ok?'PASS':'FAIL'} ${label}`); if(ok) pass++; }
console.log(`\nV42 migration gate: ${pass}/${checks.length} PASS`);
if (pass !== checks.length) process.exit(1);
