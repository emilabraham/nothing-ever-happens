import * as fs from "fs";
import * as path from "path";

const LOG_FILE = path.join(__dirname, "..", "bot.log");

function timestamp(): string {
  return new Date().toISOString();
}

function write(level: string, ...args: unknown[]): void {
  const message = args.map((a) => (typeof a === "object" ? JSON.stringify(a) : String(a))).join(" ");
  const line = `[${timestamp()}] ${level}: ${message}`;
  if (process.env.DEBUG_CONSOLE) {
    console.log(line);
  } else {
    fs.appendFileSync(LOG_FILE, line + "\n");
  }
}

export const log = (...args: unknown[]) => write("INFO", ...args);
export const logError = (...args: unknown[]) => write("ERROR", ...args);
