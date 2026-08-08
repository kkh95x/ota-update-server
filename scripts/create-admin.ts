import { createAdminUser } from "@custom-os-ota/auth";
import { prisma, AdminRoleName } from "@custom-os-ota/database";
import { loadEnv } from "@custom-os-ota/configuration";

async function main() {
  loadEnv();
  const [email, password, displayName] = process.argv.slice(2);
  if (!email || !password) {
    console.error("Usage: tsx scripts/create-admin.ts <email> <password> [displayName]");
    process.exit(1);
  }

  const existing = await prisma.adminUser.findUnique({ where: { email } });
  if (existing) {
    console.error("Admin already exists:", email);
    process.exit(1);
  }

  const user = await createAdminUser(email, password, displayName);
  const superRole = await prisma.role.findUnique({ where: { name: AdminRoleName.SUPER_ADMIN } });
  if (superRole) {
    await prisma.adminRole.create({ data: { userId: user.id, roleId: superRole.id } });
  }

  console.log("Created SUPER_ADMIN:", user.email);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
