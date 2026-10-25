import { NextRequest } from "next/server";
import { Logger } from "./logger";

export type RequestContext = {
  requestId: string;
  logger: Logger;
  path: string;
  method: string;
};

export function getRequestContext(req: NextRequest): RequestContext {
  const requestId = req.headers.get("x-request-id") ?? crypto.randomUUID();
  const path = req.nextUrl.pathname;
  const method = req.method;

  const reqLogger = new Logger({
    requestId,
    path,
    method,
  });

  return {
    requestId,
    logger: reqLogger,
    path,
    method,
  };
}
