import { writeFileSync, mkdirSync } from "node:fs";
export default async function setup() {
  mkdirSync(".logs", { recursive: true });
  writeFileSync(".logs/e2e-start", new Date().toISOString());
}
