import dotenv from "dotenv";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, "..", ".env") });

export const config = {
  port: Number(process.env.PORT || 3000),
  databaseUrl: process.env.DATABASE_URL || "",
  dsqlClusterId: process.env.DSQL_CLUSTER_ID || "",
  dsqlRegion: process.env.DSQL_REGION || process.env.AWS_REGION || "us-east-1",
  dsqlUser: process.env.DSQL_USER || "admin",
  firebaseProjectId: process.env.FIREBASE_PROJECT_ID || "portal-ciop",
  allowApiKeyRead: process.env.PORTAL_ALLOW_API_KEY_READ === "true",
  apiKey: process.env.PORTAL_API_KEY || "",
  corsOrigins: (process.env.CORS_ORIGINS || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean),
  firebaseCredentials: process.env.GOOGLE_APPLICATION_CREDENTIALS || ""
};
