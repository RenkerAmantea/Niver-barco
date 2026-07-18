import { Router } from "express";
import { db, guestsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { CreateGuestBody, UpdateRsvpBody, GetGuestParams, UpdateRsvpParams } from "@workspace/api-zod";

const router = Router();

// GET /api/guests
router.get("/guests", async (req, res) => {
  try {
    const guests = await db
      .select()
      .from(guestsTable)
      .orderBy(guestsTable.createdAt);
    res.json(guests.map(toGuestResponse));
  } catch (err) {
    req.log.error({ err }, "Failed to list guests");
    res.status(500).json({ error: "Internal server error" });
  }
});

// POST /api/guests
router.post("/guests", async (req, res) => {
  const parsed = CreateGuestBody.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "Invalid request body" });
  }

  const { name, googleId, avatarUrl, rsvpStatus } = parsed.data;

  try {
    // If googleId provided, check for duplicate
    if (googleId) {
      const existing = await db
        .select()
        .from(guestsTable)
        .where(eq(guestsTable.googleId, googleId))
        .limit(1);
      if (existing.length > 0) {
        return res.status(409).json({ error: "Guest already exists" });
      }
    }

    const [guest] = await db
      .insert(guestsTable)
      .values({
        name,
        googleId: googleId ?? null,
        avatarUrl: avatarUrl ?? null,
        rsvpStatus: (rsvpStatus as any) ?? "pending",
      })
      .returning();

    res.status(201).json(toGuestResponse(guest));
  } catch (err) {
    req.log.error({ err }, "Failed to create guest");
    res.status(500).json({ error: "Internal server error" });
  }
});

// GET /api/guests/:guestId
router.get("/guests/:guestId", async (req, res) => {
  const parsed = GetGuestParams.safeParse({ guestId: Number(req.params.guestId) });
  if (!parsed.success) {
    return res.status(400).json({ error: "Invalid guest ID" });
  }

  try {
    const [guest] = await db
      .select()
      .from(guestsTable)
      .where(eq(guestsTable.id, parsed.data.guestId))
      .limit(1);

    if (!guest) {
      return res.status(404).json({ error: "Guest not found" });
    }

    res.json(toGuestResponse(guest));
  } catch (err) {
    req.log.error({ err }, "Failed to get guest");
    res.status(500).json({ error: "Internal server error" });
  }
});

// PATCH /api/guests/:guestId/rsvp
router.patch("/guests/:guestId/rsvp", async (req, res) => {
  const paramsParsed = UpdateRsvpParams.safeParse({ guestId: Number(req.params.guestId) });
  if (!paramsParsed.success) {
    return res.status(400).json({ error: "Invalid guest ID" });
  }

  const bodyParsed = UpdateRsvpBody.safeParse(req.body);
  if (!bodyParsed.success) {
    return res.status(400).json({ error: "Invalid request body" });
  }

  try {
    const [updated] = await db
      .update(guestsTable)
      .set({ rsvpStatus: bodyParsed.data.rsvpStatus as any })
      .where(eq(guestsTable.id, paramsParsed.data.guestId))
      .returning();

    if (!updated) {
      return res.status(404).json({ error: "Guest not found" });
    }

    res.json(toGuestResponse(updated));
  } catch (err) {
    req.log.error({ err }, "Failed to update RSVP");
    res.status(500).json({ error: "Internal server error" });
  }
});

function toGuestResponse(guest: typeof guestsTable.$inferSelect) {
  return {
    id: guest.id,
    name: guest.name,
    googleId: guest.googleId,
    avatarUrl: guest.avatarUrl,
    rsvpStatus: guest.rsvpStatus,
    createdAt: guest.createdAt.toISOString(),
  };
}

export default router;
