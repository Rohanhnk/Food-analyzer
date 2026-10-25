import { NextResponse } from "next/server";

export type ApiErrorCode =
  | "INVALID_INPUT"
  | "UNAUTHENTICATED"
  | "FORBIDDEN"
  | "NOT_FOUND"
  | "CONFLICT"
  | "PAYLOAD_TOO_LARGE"
  | "RATE_LIMITED"
  | "PROVIDER_FAILURE"
  | "SERVICE_UNAVAILABLE"
  | "INTERNAL_SERVER_ERROR";

export class ApiError extends Error {
  constructor(
    public readonly code: ApiErrorCode,
    message: string,
    public readonly statusCode: number,
    public readonly field?: string
  ) {
    super(message);
    this.name = "ApiError";
  }
}

export function createErrorResponse(
  code: ApiErrorCode,
  message: string,
  statusCode: number,
  field?: string
): NextResponse {
  return NextResponse.json(
    {
      error: {
        code,
        message,
        ...(field ? { field } : {}),
      },
    },
    { status: statusCode }
  );
}

export function handleRouteError(error: unknown): NextResponse {
  if (error instanceof ApiError) {
    return createErrorResponse(error.code, error.message, error.statusCode, error.field);
  }

  if (error instanceof SyntaxError && error.message.includes("JSON")) {
    return createErrorResponse("INVALID_INPUT", "Malformed JSON request body.", 400);
  }

  const message = error instanceof Error ? error.message : "An unexpected server error occurred.";
  return createErrorResponse("INTERNAL_SERVER_ERROR", message, 500);
}

export const badRequest = (message: string, field?: string) =>
  new ApiError("INVALID_INPUT", message, 400, field);

export const unauthenticated = (message = "Authentication required.") =>
  new ApiError("UNAUTHENTICATED", message, 401);

export const forbidden = (message = "Access to the requested resource is denied.") =>
  new ApiError("FORBIDDEN", message, 403);

export const notFound = (message = "Resource not found.") =>
  new ApiError("NOT_FOUND", message, 404);

export const conflict = (message: string) =>
  new ApiError("CONFLICT", message, 409);

export const payloadTooLarge = (message = "Payload exceeds maximum allowed size.") =>
  new ApiError("PAYLOAD_TOO_LARGE", message, 413);

export const rateLimited = (message = "Rate limit exceeded. Please try again later.") =>
  new ApiError("RATE_LIMITED", message, 429);

export const providerFailure = (message = "Upstream provider failed.") =>
  new ApiError("PROVIDER_FAILURE", message, 502);
