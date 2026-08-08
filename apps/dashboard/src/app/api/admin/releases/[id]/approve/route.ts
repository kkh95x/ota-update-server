import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma, ReleaseStatus } from "@custom-os-ota/database";
import { writeAudit } from "@custom-os-ota/audit";
import { extractClientIp } from "@custom-os-ota/observability";
import { requireAdminApi, isAuthFailure } from "@/lib/api-auth";
import { RELEASE_APPROVALS_REQUIRED } from "@/lib/release-approval";

type Params = { params: Promise<{ id: string }> };

const approveSchema = z.object({
  note: z.string().max(500).optional(),
});

export async function POST(request: Request, { params }: Params) {
  const auth = await requireAdminApi("release.approve");
  if (isAuthFailure(auth)) return auth.error;

  const { id } = await params;
  const body = approveSchema.safeParse(await request.json().catch(() => ({})));
  if (!body.success) {
    return NextResponse.json({ error: "invalid_request" }, { status: 400 });
  }

  const release = await prisma.release.findUnique({
    where: { id },
    include: { approvals: true, packages: true },
  });

  if (!release) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  const approvableStatuses: ReleaseStatus[] = [
    ReleaseStatus.VALIDATED,
    ReleaseStatus.PENDING_APPROVAL,
    ReleaseStatus.APPROVED,
  ];
  if (!approvableStatuses.includes(release.status)) {
    return NextResponse.json({ error: "release_not_ready", status: release.status }, { status: 409 });
  }

  if (release.packages.length === 0) {
    return NextResponse.json({ error: "no_packages" }, { status: 409 });
  }

  const alreadyApproved = release.approvals.some((a) => a.approverId === auth.session.userId);
  if (alreadyApproved) {
    return NextResponse.json({ error: "already_approved" }, { status: 409 });
  }

  const { clientIp, forwardedFor } = extractClientIp(request.headers);

  await prisma.releaseApproval.create({
    data: {
      releaseId: release.id,
      approverId: auth.session.userId,
      note: body.data.note,
    },
  });

  const approvalCount = release.approvals.length + 1;
  let newStatus: ReleaseStatus = ReleaseStatus.PENDING_APPROVAL;
  let approvedAt: Date | undefined;

  if (approvalCount >= RELEASE_APPROVALS_REQUIRED) {
    newStatus = ReleaseStatus.APPROVED;
    approvedAt = new Date();
  }

  await prisma.release.update({
    where: { id: release.id },
    data: {
      status: newStatus,
      approvedAt,
    },
  });

  await writeAudit({
    actorId: auth.session.userId,
    action: "release.approve",
    targetType: "Release",
    targetId: release.id,
    metadata: { approvalCount, required: RELEASE_APPROVALS_REQUIRED, newStatus },
    clientIp,
    forwardedFor,
    result: "success",
  });

  return NextResponse.json({
    ok: true,
    approvalCount,
    required: RELEASE_APPROVALS_REQUIRED,
    status: newStatus,
  });
}
