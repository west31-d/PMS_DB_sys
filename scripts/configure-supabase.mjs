// Only public/anon keys are written. Never log or persist admin/secret keys.
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
if (existsSync(".env.local")) throw new Error(".env.local already exists; preserve existing configuration.");
const projectRef = readFileSync("supabase/.temp/project-ref", "utf8").trim();
if (!/^[a-z0-9]+$/.test(projectRef)) throw new Error("Invalid linked project reference.");
const raw = execFileSync(process.execPath, [resolve("node_modules/supabase/dist/supabase.js"), "projects", "api-keys", "--project-ref", projectRef, "--output", "json"], { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
const result = JSON.parse(raw);
const keys = Array.isArray(result) ? result : result.api_keys ?? result.keys;
if (!Array.isArray(keys)) throw new Error("Unrecognized API key response; no configuration written.");
const publicKey = keys.find((k) => k.type === "publishable") ?? keys.find((k) => k.name === "anon");
if (!publicKey?.api_key || publicKey.api_key.startsWith("sb_secret_")) throw new Error("Public API key unavailable.");
writeFileSync(".env.local", `VITE_SUPABASE_URL=https://${projectRef}.supabase.co\nVITE_SUPABASE_PUBLISHABLE_KEY=${publicKey.api_key}\nVITE_DEMO_MODE=false\n`, { encoding: "utf8", flag: "wx" });
console.log("Configured .env.local with the linked project's public key (key not printed).");
