import fs from "node:fs";
import readline from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";

const rl = readline.createInterface({ input, output });

console.log("\nBALI LIVE AI — FIRST SETUP");
console.log("Your API key is stored only in bridge/.env on this PC.\n");

const apiKey = (await rl.question("Paste OPENAI_API_KEY: ")).trim();
if (!apiKey) {
  console.log("No key entered. Setup cancelled.");
  rl.close();
  process.exit(1);
}

const modelAnswer = (await rl.question("Model [gpt-5.6-luna]: ")).trim();
const model = modelAnswer || "gpt-5.6-luna";

const env = [
  `OPENAI_API_KEY=${apiKey}`,
  `OPENAI_MODEL=${model}`,
  "TIKFINITY_WS=ws://127.0.0.1:21213/",
  "PORT=8787",
  "USER_COOLDOWN_SECONDS=8",
  ""
].join("\n");

fs.writeFileSync(new URL("./.env", import.meta.url), env, "utf8");
console.log("\nSaved bridge/.env");
console.log("Do not upload .env to GitHub.\n");
rl.close();
