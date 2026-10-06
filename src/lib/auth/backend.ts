import createClient from "openapi-fetch";
import type { paths } from "@/lib/api/schema";

export function createBackendClient() {
  const baseUrl = process.env.API_BASE_URL;

  if (!baseUrl) {
    throw new Error("API_BASE_URL is required for BFF routes");
  }

  return createClient<paths>({ baseUrl });
}
