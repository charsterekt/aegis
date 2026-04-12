import { execFileSync } from "node:child_process";
import path from "node:path";

const MOCK_DIR = path.join(process.cwd(), "aegis-mock-run");

const args = process.argv.slice(2);
if (args.length === 0) {
  console.log("Usage: npm run mock:run -- <command> [args...]");
  console.log("  npm run mock:run -- node ../dist/index.js status");
  console.log("  npm run mock:run -- node ../dist/index.js start");
  process.exit(1);
}

execFileSync(args[0], args.slice(1), {
  cwd: MOCK_DIR,
  stdio: "inherit",
  env: { ...process.env },
});
