import { defineConfig } from "drizzle-kit";
import { requiredEnv } from "./src/env.js";

export default defineConfig({
  schema: "./src/db/schema.ts",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: {
    url: requiredEnv("DATABASE_URL"),
  },
  strict: true,
  verbose: true,
});
