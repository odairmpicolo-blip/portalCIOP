import serverlessExpress from "@vendia/serverless-express";
import { app } from "./backend/src/index.js";

export const handler = serverlessExpress({ app });
