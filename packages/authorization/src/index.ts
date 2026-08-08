import { prisma, AdminRoleName } from "@custom-os-ota/database";

export type PermissionCode = string;

export async function getUserPermissions(userId: string): Promise<Set<string>> {
  const user = await prisma.adminUser.findUnique({
    where: { id: userId },
    include: {
      roles: {
        include: {
          role: { include: { permissions: true } },
        },
      },
    },
  });

  const codes = new Set<string>();
  if (!user) return codes;

  for (const adminRole of user.roles) {
    for (const permission of adminRole.role.permissions) {
      codes.add(permission.code);
    }
  }
  return codes;
}

export function hasPermission(permissions: Set<string>, required: PermissionCode): boolean {
  if (permissions.has("*")) return true;
  return permissions.has(required);
}

export async function authorize(userId: string, required: PermissionCode): Promise<boolean> {
  const permissions = await getUserPermissions(userId);
  return hasPermission(permissions, required);
}

export async function userHasRole(userId: string, role: AdminRoleName): Promise<boolean> {
  const count = await prisma.adminRole.count({
    where: { userId, role: { name: role } },
  });
  return count > 0;
}
