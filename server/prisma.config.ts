import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig, env } from "prisma/config";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const loadEnvFile = (filePath: string) => {
  if (!fs.existsSync(filePath)) {
    return;
  }

  const lines = fs.readFileSync(filePath, "utf8").split(/\r?\n/);

  for (const line of lines) {
    const trimmed = line.trim();

    if (!trimmed || trimmed.startsWith("#")) {
      continue;
    }

    const separatorIndex = trimmed.indexOf("=");

    if (separatorIndex === -1) {
      continue;
    }

    const key = trimmed.slice(0, separatorIndex).trim();
    const rawValue = trimmed.slice(separatorIndex + 1).trim();
    const value = rawValue.replace(/^["']|["']$/g, "");

    process.env[key] ??= value;
  }
};

loadEnvFile(path.resolve(__dirname, "../.env"));
loadEnvFile(path.resolve(__dirname, ".env"));

export default defineConfig({
  schema: path.resolve(__dirname, "prisma/schema.prisma"),
  migrations: {
    path: path.resolve(__dirname, "prisma/migrations"),
  },
  datasource: {
    url: env("DATABASE_URL"),
  },
});
