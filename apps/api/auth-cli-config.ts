import { createDb } from "./src/db/client.js";
import { createAuth } from "./src/auth.js";

const db = createDb(process.env["DATABASE_URL"] ?? "postgres://aldenfer:aldenfer@localhost:5432/aldenfer");

export const auth = createAuth(db, {
  secret: "cli-generate-secret-32-characters!",
  baseURL: "http://localhost:3000",
  webOrigin: "http://localhost:4200",
});
