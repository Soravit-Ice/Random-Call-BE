import { prisma } from "../db.js";
import { distanceKm } from "../utils/haversine.js";

// Very simple matching: pick nearest online user who is not blocked and not in call
export async function requestMatch(userId, mode = "near", radiusKm) {
  const me = await prisma.user.findUnique({ where: { id: userId } });
  if (!me) return null;

  const candidates = await prisma.user.findMany({
    where: {
      id: { not: userId },
      isOnline: true,
      inCall: false,
      blockedBy: { none: { blockerId: userId } },
      blocks: { none: { blockedId: userId } }
    },
    take: 100
  });

  let best = null;
  let bestDistance = Infinity;

  for (const candidate of candidates) {
    const d = distanceKm(me, candidate);
    if (mode === "near") {
      const limit = radiusKm ?? me.radiusKmDefault ?? 10;
      if (d > limit) continue;
    }

    if (d < bestDistance) {
      best = candidate;
      bestDistance = d;
    }
  }

  if (!best && mode === "near") {
    best = candidates[0] || null;
    bestDistance = best ? distanceKm(me, best) : Infinity;
  }

  if (!best) return null;

  // Optimistically mark both users as in a call so no others match them meanwhile.
  await prisma.$transaction([
    prisma.user.update({ where: { id: me.id }, data: { inCall: true } }),
    prisma.user.update({ where: { id: best.id }, data: { inCall: true } })
  ]);

  return { partner: best, distanceKm: bestDistance, me };
}
