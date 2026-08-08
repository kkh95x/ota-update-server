import { AdminRoleName, PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const ROLES: { name: AdminRoleName; description: string; permissions: string[] }[] = [
  {
    name: "SUPER_ADMIN",
    description: "Full platform access",
    permissions: ["*"],
  },
  {
    name: "SECURITY_ADMIN",
    description: "Security, audit, global pause",
    permissions: ["audit.read", "security.read", "ota.pause.global", "settings.write", "device.write", "release.create"],
  },
  {
    name: "RELEASE_PUBLISHER",
    description: "Publish approved releases",
    permissions: ["release.publish", "rollout.manage", "device.write", "release.create"],
  },
  {
    name: "RELEASE_REVIEWER",
    description: "Approve releases",
    permissions: ["release.approve", "release.read"],
  },
  {
    name: "RELEASE_UPLOADER",
    description: "Upload OTA packages",
    permissions: ["upload.create", "release.read", "release.create"],
  },
  {
    name: "SUPPORT",
    description: "Read-only support access",
    permissions: ["device.read", "release.read", "audit.read.masked"],
  },
  {
    name: "VIEWER",
    description: "Dashboard viewer",
    permissions: ["dashboard.read"],
  },
];

async function main() {
  for (const role of ROLES) {
    const permissions = await Promise.all(
      role.permissions.map((code) =>
        prisma.permission.upsert({
          where: { code },
          create: { code, description: code },
          update: {},
        }),
      ),
    );
    await prisma.role.upsert({
      where: { name: role.name },
      create: {
        name: role.name,
        description: role.description,
        permissions: { connect: permissions.map((p) => ({ id: p.id })) },
      },
      update: {
        description: role.description,
        permissions: { set: permissions.map((p) => ({ id: p.id })) },
      },
    });
  }

  await prisma.retentionPolicy.upsert({
    where: { logType: "access_log" },
    create: { logType: "access_log", retentionDays: 90 },
    update: {},
  });

  await prisma.retentionPolicy.upsert({
    where: { logType: "audit_log" },
    create: { logType: "audit_log", retentionDays: 365 },
    update: {},
  });

  await prisma.systemSetting.upsert({
    where: { key: "otaOffersPaused" },
    create: { key: "otaOffersPaused", value: false },
    update: {},
  });

  console.log("Seed completed: roles, permissions, retention policies");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
