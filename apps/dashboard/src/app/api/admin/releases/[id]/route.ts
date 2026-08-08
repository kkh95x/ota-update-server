import { NextResponse } from "next/server";
import { loadEnv } from "@custom-os-ota/configuration";
import { prisma } from "@custom-os-ota/database";
import { publishedMetadataKey, publicArtifactUrl } from "@custom-os-ota/ota-protocol";
import { requireAdminApi, isAuthFailure } from "@/lib/api-auth";
import { extractValidationFailureReason, formatValidationErrors } from "@/lib/validation-failure";

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
      channelPublications: {
        include: { publishedBy: { select: { id: true, email: true, displayName: true } } },
        orderBy: { publishedAt: "asc" },
      },
    },
  });

  if (!release) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  const env = loadEnv();
  const metadataKey = publishedMetadataKey(release.deviceModel.codename, release.channelKey);
  const publicMetadataUrl = publicArtifactUrl(env.OTA_PUBLIC_BASE_URL, metadataKey);

  const channelPublications = release.channelPublications.map((pub) => ({
    id: pub.id,
    channelKey: pub.channelKey,
    metadataObjectKey: pub.metadataObjectKey,
    metadataUrl: publicArtifactUrl(env.OTA_PUBLIC_BASE_URL, pub.metadataObjectKey),
    publishedAt: pub.publishedAt.toISOString(),
    publishedBy: pub.publishedBy
      ? {
          id: pub.publishedBy.id,
          email: pub.publishedBy.email,
          displayName: pub.publishedBy.displayName,
        }
      : null,
  }));

  return NextResponse.json({
    release: {
      id: release.id,
      versionLabel: release.versionLabel,
      buildId: release.buildId,
      incrementalBuild: release.incrementalBuild,
      postTimestamp: release.postTimestamp,
      channelKey: release.channelKey,
      status: release.status,
      validationFailureReason:
        release.status === "QUARANTINED" ? extractValidationFailureReason(release.packages) : null,
      changelog: release.changelog,
      codename: release.deviceModel.codename,
      publicMetadataUrl,
      channelPublications,
      packages: release.packages.map((p) => {
        const report = p.validationReport as { errors?: string[] } | null;
        return {
          id: p.id,
          packageType: p.packageType,
          originalFilename: p.originalFilename,
          byteSize: p.byteSize.toString(),
          sha256: p.sha256,
          signatureValid: p.signatureValid,
          validationErrors:
            report?.errors?.length ? formatValidationErrors(report.errors) : null,
        };
      }),
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
