import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { ApiError, handle, requireUserId } from "@/lib/api";
import { getStorage } from "@/lib/storage";
import { levelForPoints } from "@/lib/gamification";

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return handle(async () => {
    const userId = await requireUserId();
    const { id } = await params;
    const cv = await db.cv.findUnique({ where: { id } });
    if (!cv || cv.userId !== userId) throw new ApiError(404, "CV not found");

    // The points this CV earned (upload/review/tailor events carry its id in
    // metadata) go with it, so the ledger stays consistent with what's left.
    const events = await db.activityEvent.findMany({
      where: { userId, metadata: { path: ["cvId"], equals: id } },
      select: { id: true, points: true },
    });
    const refund = events.reduce((sum, e) => sum + e.points, 0);

    await db.$transaction(async (tx) => {
      await tx.searchProfile.updateMany({ where: { activeCvId: id }, data: { activeCvId: null } });
      await tx.tailoredCv.deleteMany({ where: { cvId: id } });
      await tx.cv.delete({ where: { id } });

      if (events.length > 0) {
        await tx.activityEvent.deleteMany({ where: { id: { in: events.map((e) => e.id) } } });
        const progress = await tx.userProgress.findUnique({ where: { userId } });
        if (progress) {
          const points = Math.max(0, progress.points - refund);
          await tx.userProgress.update({ where: { userId }, data: { points, level: levelForPoints(points) } });
        }
      }
    });

    // DB is the source of truth; an orphaned file is harmless, a dangling row
    // pointing at a missing file is not — so the file goes last, best-effort.
    try {
      await getStorage().delete(cv.storageKey);
    } catch (err) {
      console.warn(`Deleted CV ${id} but could not remove file ${cv.storageKey}:`, err);
    }

    return NextResponse.json({ ok: true });
  });
}
