import { z } from "zod";
import type { components } from "./core";

export type ApiProblem = components["schemas"]["Problem"];
export type ApiFieldError = components["schemas"]["FieldError"];

export const fieldErrorSchema = z.object({
  field: z.string(),
  code: z.string(),
  message: z.string(),
});

export const problemSchema = z.object({
  type: z.string().default("about:blank"),
  title: z.string().default("Error"),
  status: z.number(),
  code: z.string(),
  detail: z.string().optional(),
  instance: z.string().optional(),
  trace_id: z.string().optional(),
  errors: z.array(fieldErrorSchema).optional(),
  remaining_attempts: z.number().optional(),
  distance_meters: z.number().optional(),
  allowed_meters: z.number().optional(),
});

export function parseProblem(input: unknown, response?: Response): ApiProblem {
  const parsed = problemSchema.safeParse(input);
  if (parsed.success) {
    return parsed.data;
  }

  return {
    type: "about:blank",
    title: response?.statusText || "Error",
    status: response?.status ?? 500,
    code: response?.status === 503 ? "SERVICE_UNAVAILABLE" : "INTERNAL_ERROR",
    trace_id: response?.headers.get("X-Trace-Id") ?? undefined,
  };
}

export class ApiError extends Error {
  constructor(
    public readonly response: Response,
    public readonly problem: ApiProblem,
  ) {
    super(problem.code);
    this.name = "ApiError";
  }
}

export function isApiError(error: unknown): error is ApiError {
  return error instanceof ApiError;
}

export async function unwrap<T>({
  data,
  error,
  response,
}: {
  data?: T;
  error?: unknown;
  response: Response;
}): Promise<T> {
  if (response.ok && data !== undefined) {
    return data;
  }

  throw new ApiError(response, parseProblem(error, response));
}
