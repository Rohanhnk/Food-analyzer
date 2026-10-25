export type LogLevel = "debug" | "info" | "warn" | "error";

export type LogContext = {
  requestId?: string;
  userId?: string;
  path?: string;
  method?: string;
  [key: string]: unknown;
};

/** Redacts sensitive keys such as passwords, tokens, API keys, and authorization headers */
export function sanitizeLogData(data: unknown): unknown {
  if (data === null || data === undefined) return data;
  if (typeof data !== "object") return data;

  if (Array.isArray(data)) {
    return data.map(sanitizeLogData);
  }

  const SENSITIVE_KEYS = new Set([
    "authorization",
    "cookie",
    "token",
    "secret",
    "password",
    "apikey",
    "clerk_secret_key",
    "convex_deploy_key",
  ]);

  const sanitized: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(data as Record<string, unknown>)) {
    const lowerKey = key.toLowerCase();
    if (SENSITIVE_KEYS.has(lowerKey) || lowerKey.includes("secret") || lowerKey.includes("token")) {
      sanitized[key] = "[REDACTED]";
    } else if (typeof value === "object") {
      sanitized[key] = sanitizeLogData(value);
    } else {
      sanitized[key] = value;
    }
  }

  return sanitized;
}

export class Logger {
  constructor(private readonly context: LogContext = {}) {}

  withContext(additional: LogContext): Logger {
    return new Logger({ ...this.context, ...additional });
  }

  private log(level: LogLevel, message: string, extra?: Record<string, unknown>) {
    const entry = {
      timestamp: new Date().toISOString(),
      level,
      message,
      context: sanitizeLogData(this.context),
      ...(extra ? { extra: sanitizeLogData(extra) } : {}),
    };

    if (process.env.NODE_ENV !== "test") {
      const line = JSON.stringify(entry);
      if (level === "error") {
        console.error(line);
      } else if (level === "warn") {
        console.warn(line);
      } else {
        console.log(line);
      }
    }
  }

  debug(message: string, extra?: Record<string, unknown>) {
    this.log("debug", message, extra);
  }

  info(message: string, extra?: Record<string, unknown>) {
    this.log("info", message, extra);
  }

  warn(message: string, extra?: Record<string, unknown>) {
    this.log("warn", message, extra);
  }

  error(message: string, extra?: Record<string, unknown>) {
    this.log("error", message, extra);
  }
}

export const logger = new Logger();
