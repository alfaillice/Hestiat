import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const checks = [];
function pass(name, ok, detail = "") { checks.push({ name, ok, detail }); }
function exists(rel) { return fs.existsSync(path.join(root, rel)); }

pass("OpenAI SDK dependency", /"openai"\s*:/.test(fs.readFileSync(path.join(root, "package.json"), "utf8")));
pass("OpenAI client", exists("src/server/lib/openai.ts"));
pass("Hestiat AI booking endpoint", exists("app/api/auth/bookings/[id]/ia/route.ts"));
pass("AI health endpoint", exists("app/api/internal/ai/health/route.ts"));
pass("Trip UI exposes Hestiat IA", /HESTIAT IA/.test(fs.readFileSync(path.join(root, "app/mi-viaje/[id]/page.tsx"), "utf8")));
pass("Responses API usage", /responses\.create/.test(fs.readFileSync(path.join(root, "app/api/auth/bookings/[id]/ia/route.ts"), "utf8")));
pass("Function tools enabled", /get_trip_details/.test(fs.readFileSync(path.join(root, "app/api/auth/bookings/[id]/ia/route.ts"), "utf8")));
pass("Safe default model", /gpt-5\.6-luna/.test(fs.readFileSync(path.join(root, "src/server/modules/ai/orchestrator.ts"), "utf8")));
pass("No hard-coded API key", !fs.readFileSync(path.join(root, "src/server/lib/openai.ts"), "utf8").match(/sk-[A-Za-z0-9]{20,}/));

console.log(`V44 AI gate: ${checks.filter(x=>x.ok).length} PASS / ${checks.filter(x=>!x.ok).length} FAIL`);
for (const c of checks) console.log(`${c.ok ? "PASS" : "FAIL"} ${c.name}${c.detail ? ` — ${c.detail}` : ""}`);
process.exit(checks.some(x=>!x.ok) ? 1 : 0);
