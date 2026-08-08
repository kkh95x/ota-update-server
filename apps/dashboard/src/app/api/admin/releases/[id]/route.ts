import { NextResponse } from "next/server";
import { loadEnv } from "@custom-os-ota/configuration";
import { prisma } from "@custom-os-ota/database";
import { publishedMetadataKey, publicArtifactUrl } from "@custom-os-ota/ota-protocol";
import { requireAdminApi, isAuthFailure } from "@/lib/api-auth";

type Params = { params: Promise<{ id: string }> };

export async function GET(_request: Request, { params }: Params) {
  const auth = await requireAdminApi("release.read");
  if (isAuthFailure(auth)) return auth.error;

  const { id } = await params;
  const release = await prisma.release.findUnique({
    where: { id },
    include: {
      deviceModel: true,
      packages: true,
      approvals: {
        include: { approver: { select: { id: true, email: true, displayName: true } } },
      },
    },
  });

  if (!release) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  const env = loadEnv();
  const metadataKey = publishedMetadataKey(release.deviceModel.codename, release.channelKey);
  const publicMetadataUrl = publicArtifactUrl(env.OTA_PUBLIC_BASE_URL, metadataKey);

  return NextResponse.json({
    release: {
      id: release.id,
      versionLabel: release.versionLabel,
      buildId: release.buildId,
      incrementalBuild: release.incrementalBuild,
      postTimestamp: release.postTimestamp,
      channelKey: release.channelKey,
      status: release.status,
      changelog: release.changelog,
      codename: release.deviceModel.codename,
      publicMetadataUrl,
      packages: release.packages.map((p) => ({
        id: p.id,
        packageType: p.packageType,
        originalFilename: p.originalFilename,
        byteSize: p.byteSize.toString(),
        sha256: p.sha256,
        signatureValid: p.signatureValid,
      })),
      approvals: release.approvals.map((a) => ({
        id: a.id,
        approverEmail: a.approver.email,
        approverName: a.approver.displayName,
        note: a.note,
        createdAt: a.createdAt.toISOString(),
      })),
      createdAt: release.createdAt.toISOString(),
      validatedAt: release.validatedAt?.toISOString() ?? null,
      approvedAt: release.approvedAt?.toISOString() ?? null,
      publishedAt: release.publishedAt?.toISOString() ?? null,
    },
  });
}
