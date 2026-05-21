import { neon } from "@neondatabase/serverless";
import { DATABASE_URL } from "./env.mjs";

export const sql = neon(DATABASE_URL);
