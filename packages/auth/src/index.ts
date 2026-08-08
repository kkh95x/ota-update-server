import { randomBytes, createHash } from "node:crypto";
import { hash, verify } from "@node-rs/argon2";
import { prisma } from "@custom-os-ota/database";
import { writeAudit, writeSecurityEvent } from "@custom-os-ota/audit";

const ARGON2_OPTIONS = {
  memoryCost: 19456,
  timeCost: 2,
  parallelism: 1,
};

export async function hashPassword(password: string): Promise<string> {
  return hash(password, ARGON2_OPTIONS);
}

export async function verifyPassword(password: string, passwordHash: string): Promise<boolean> {
  return verify(passwordHash, password, ARGON2_OPTIONS);
}

function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export interface SessionContext {
  clientIp?: string;
  forwardedFor?: string;
  userAgent?: string;
}

export async function createAdminUser(
  email: string,
  password: string,
  displayName?: string,
): Promise<{ id: string; email: string }> {
  const passwordHash = await hashPassword(password);
  const user = await prisma.adminUser.create({
    data: { email, passwordHash, displayName },
    select: { id: true, email: true },
  });
  return user;
}

export async function authenticateAdmin(
  email: string,
  password: string,
  ctx: SessionContext = {},
): Promise<{ sessionToken: string; userId: string } | null> {
  const user = await prisma.adminUser.findUnique({ where: { email } });

  if (!user || !user.isActive) {
    await writeSecurityEvent({
      severity: "medium",
      eventType: "admin.login.failure",
      clientIp: ctx.clientIp,
      forwardedFor: ctx.forwardedFor,
      detail: { email, reason: "invalid_credentials" },
    });
    return null;
  }

  if (user.lockedUntil && user.lockedUntil > new Date()) {
    await writeSecurityEvent({
      severity: "high",
      eventType: "admin.login.locked",
      clientIp: ctx.clientIp,
      forwardedFor: ctx.forwardedFor,
      detail: { userId: user.id },
    });
    return null;
  }

  const valid = await verifyPassword(password, user.passwordHash);
  if (!valid) {
    const failedLoginCount = user.failedLoginCount + 1;
    await prisma.adminUser.update({
      where: { id: user.id },
      data: {
        failedLoginCount,
        lockedUntil: failedLoginCount >= 5 ? new Date(Date.now() + 15 * 60 * 1000) : null,
      },
    });
    await writeSecurityEvent({
      severity: "medium",
      eventType: "admin.login.failure",
      clientIp: ctx.clientIp,
      forwardedFor: ctx.forwardedFor,
      detail: { userId: user.id, failedLoginCount },
    });
    return null;
  }

  const sessionToken = randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + 8 * 60 * 60 * 1000);
  const idleExpiresAt = new Date(Date.now() + 30 * 60 * 1000);

  await prisma.adminSession.create({
    data: {
      userId: user.id,
      tokenHash: hashToken(sessionToken),
      expiresAt,
      idleExpiresAt,
      clientIp: ctx.clientIp,
      forwardedFor: ctx.forwardedFor,
      userAgent: ctx.userAgent,
    },
  });

  await prisma.adminUser.update({
    where: { id: user.id },
    data: { failedLoginCount: 0, lockedUntil: null },
  });

  await writeAudit({
    actorId: user.id,
    action: "admin.login.success",
    result: "success",
    clientIp: ctx.clientIp,
    forwardedFor: ctx.forwardedFor,
  });

  return { sessionToken, userId: user.id };
}

export async function validateSession(sessionToken: string): Promise<{ userId: string } | null> {
  const session = await prisma.adminSession.findUnique({
    where: { tokenHash: hashToken(sessionToken) },
  });
  if (!session || session.revokedAt) return null;
  if (session.expiresAt < new Date()) return null;
  if (session.idleExpiresAt && session.idleExpiresAt < new Date()) return null;

  await prisma.adminSession.update({
    where: { id: session.id },
    data: { idleExpiresAt: new Date(Date.now() + 30 * 60 * 1000) },
  });

  return { userId: session.userId };
}

export async function revokeSession(sessionToken: string, actorId?: string): Promise<void> {
  await prisma.adminSession.updateMany({
    where: { tokenHash: hashToken(sessionToken), revokedAt: null },
    data: { revokedAt: new Date() },
  });
  await writeAudit({
    actorId,
    action: "admin.logout",
    result: "success",
  });
}

export { hashToken };
