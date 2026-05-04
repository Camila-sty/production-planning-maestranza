import { config } from "dotenv";
// Load .env.local first (Next.js convention), then fall back to .env
config({ path: ".env.local", override: false });
config({ override: false });

import { defineConfig } from "prisma/config";

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
  datasource: {
    url: process.env["DATABASE_URL"],
    // For Supabase production: set DATABASE_URL to the transaction pooler URL
    // and run migrations with the direct connection URL set as DATABASE_URL temporarily
  },
});
