import { cookies } from "next/headers";
import { validateSession } from "@custom-os-ota/auth";
import { prisma } from "@custom-os-ota/database";
import { SESSION_COOKIE } from "@/lib/session-cookie";

export type AdminSessionUser = {
  userId: string;
  email: string;
  displayName: string | null;
};

export async function getAdminSession(): Promise<AdminSessionUser | null> {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!token) return null;

  const session = await validateSession(token);
  if (!session) return null;

  const user = await prisma.adminUser.findUnique({
    where: { id: session.userId },
    select: { id: true, email: true, displayName: true, isActive: true },
  });

  if (!user?.isActive) return null;

  return {
    userId: user.id,
    email: user.email,
    displayName: user.displayName,
  };
}
