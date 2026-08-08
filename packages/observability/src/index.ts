import { generateCorrelationId } from "@custom-os-ota/shared";

export type LogLevel = "debug" | "info" | "warn" | "error" | "fatal";

export interface LogContext {
  service: string;
  event: string;
  correlationId?: string;
  clientIp?: string;
  forwardedFor?: string;
  actorId?: string;
  targetType?: string;
  targetId?: string;
  result?: "success" | "failure";
  errorCode?: string;
  metadata?: Record<string, unknown>;
}

export interface Logger {
  debug(message: string, ctx?: Partial<LogContext>): void;
  info(message: string, ctx?: Partial<LogContext>): void;
  warn(message: string, ctx?: Partial<LogContext>): void;
  error(message: string, ctx?: Partial<LogContext>): void;
  fatal(message: string, ctx?: Partial<LogContext>): void;
  child(defaults: Partial<LogContext>): Logger;
}

function write(level: LogLevel, message: string, service: string, ctx?: Partial<LogContext>): void {
  const entry = {
    timestamp: new Date().toISOString(),
    level,
    service,
    message,
    correlationId: ctx?.correlationId ?? generateCorrelationId(),
    ...ctx,
  };
  const line = JSON.stringify(entry);
  if (level === "error" || level === "fatal") {
    console.error(line);
  } else if (level === "warn") {
    console.warn(line);
  } else {
    console.log(line);
  }
}

export function createLogger(service: string, defaults: Partial<LogContext> = {}): Logger {
  const base = { service, ...defaults };
  return {
    debug: (message, ctx) => write("debug", message, service, { ...base, ...ctx }),
    info: (message, ctx) => write("info", message, service, { ...base, ...ctx }),
    warn: (message, ctx) => write("warn", message, service, { ...base, ...ctx }),
    error: (message, ctx) => write("error", message, service, { ...base, ...ctx }),
    fatal: (message, ctx) => write("fatal", message, service, { ...base, ...ctx }),
    child: (childDefaults) => createLogger(service, { ...base, ...childDefaults }),
  };
}

export function extractClientIp(headers: Headers): { clientIp?: string; forwardedFor?: string } {
  const forwardedFor = headers.get("x-forwarded-for") ?? undefined;
  const clientIp =
    headers.get("x-real-ip") ??
    (forwardedFor ? forwardedFor.split(",")[0]?.trim() : undefined) ??
    undefined;
  return { clientIp, forwardedFor };
}
