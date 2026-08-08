import { prisma, Prisma } from "@custom-os-ota/database";
import { createLogger } from "@custom-os-ota/observability";

const log = createLogger("audit");

export interface AuditInput {
  actorId?: string;
  action: string;
  targetType?: string;
  targetId?: string;
  metadata?: Record<string, unknown>;
  correlationId?: string;
  clientIp?: string;
  forwardedFor?: string;
  result: "success" | "failure";
  reason?: string;
}

export async function writeAudit(input: AuditInput): Promise<void> {
  await prisma.auditLog.create({
    data: {
      actorId: input.actorId,
      action: input.action,
      targetType: input.targetType,
      targetId: input.targetId,
      metadata: (input.metadata ?? undefined) as Prisma.InputJsonValue | undefined,
      correlationId: input.correlationId,
      clientIp: input.clientIp,
      forwardedFor: input.forwardedFor,
      result: input.result,
      reason: input.reason,
    },
  });

  log.info("audit.recorded", {
    event: input.action,
    actorId: input.actorId,
    targetType: input.targetType,
    targetId: input.targetId,
    clientIp: input.clientIp,
    forwardedFor: input.forwardedFor,
    result: input.result,
    correlationId: input.correlationId,
  });
}

export interface AccessLogInput {
  service: string;
  event: string;
  method?: string;
  path?: string;
  statusCode?: number;
  clientIp?: string;
  forwardedFor?: string;
  correlationId?: string;
  byteSize?: bigint;
  durationMs?: number;
  metadata?: Record<string, unknown>;
}

export async function writeAccessLog(input: AccessLogInput): Promise<void> {
  await prisma.accessLog.create({
    data: {
      service: input.service,
      event: input.event,
      method: input.method,
      path: input.path,
      statusCode: input.statusCode,
      clientIp: input.clientIp,
      forwardedFor: input.forwardedFor,
      correlationId: input.correlationId,
      byteSize: input.byteSize,
      durationMs: input.durationMs,
      metadata: (input.metadata ?? undefined) as Prisma.InputJsonValue | undefined,
    },
  });
}

export interface SecurityEventInput {
  severity: "low" | "medium" | "high" | "critical";
  eventType: string;
  detail?: Record<string, unknown>;
  clientIp?: string;
  forwardedFor?: string;
  correlationId?: string;
}

export async function writeSecurityEvent(input: SecurityEventInput): Promise<void> {
  await prisma.securityEvent.create({
    data: {
      severity: input.severity,
      eventType: input.eventType,
      detail: (input.detail ?? undefined) as Prisma.InputJsonValue | undefined,
      clientIp: input.clientIp,
      forwardedFor: input.forwardedFor,
      correlationId: input.correlationId,
    },
  });

  log.warn("security.event", {
    event: input.eventType,
    clientIp: input.clientIp,
    metadata: { severity: input.severity, ...input.detail },
  });
}
