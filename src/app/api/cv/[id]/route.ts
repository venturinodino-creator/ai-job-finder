import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { ApiError, handle, requireUserId } from "@/lib/api";
import { getStorage } from "@/lib/storage";
import { levelForPoints } from "@/lib/gamification";
import { updateSearchProfile } from "@/lib/searchProfile";

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
    // Edited copies made for job applications live beside the upload; they go too.
    const edited = await db.tailoredCv.findMany({
      where: { cvId: id, editedStorageKey: { not: null } },
      select: { editedStorageKey: true },
    });

    // A search without its CV is a different search: file the one that used
    // this CV in the Archive and drop the scores it earned, rather than
    // leaving them on screen against a CV that no longer exists.
    const usingIt = await db.searchProfile.findMany({ where: { userId, activeCvId: id }, select: { id: true } });
    for (const profile of usingIt) await updateSearchProfile(userId, profile.id, { activeCvId: null });

    await db.$transaction(async (tx) => {
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
    const storage = getStorage();
    for (const key of [cv.storageKey, ...edited.map((e) => e.editedStorageKey!)]) {
      try {
        await storage.delete(key);
      } catch (err) {
        console.warn(`Deleted CV ${id} but could not remove file ${key}:`, err);
      }
    }

    return NextResponse.json({ ok: true });
  });
}
