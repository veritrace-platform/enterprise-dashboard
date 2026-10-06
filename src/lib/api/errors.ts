import type { components } from "./schema";

export type ApiProblem = components["schemas"]["Problem"];

export class ApiError extends Error {
  constructor(
    public readonly response: Response,
    public readonly problem: ApiProblem,
  ) {
    super(problem.code);
    this.name = "ApiError";
  }
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

  const problem =
    (error as ApiProblem | undefined) ??
    ({
      code: "UPSTREAM_ERROR",
      status: response.status,
      title: response.statusText,
      type: "about:blank",
    } satisfies ApiProblem);

  throw new ApiError(response, problem);
}