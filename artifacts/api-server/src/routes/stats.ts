import { Router } from "express";
import { db, guestsTable } from "@workspace/db";
import { sql } from "drizzle-orm";

const router = Router();

// GET /api/stats/rsvp-summary
router.get("/stats/rsvp-summary", async (req, res) => {
  try {
    const rows = await db
      .select({
        rsvpStatus: guestsTable.rsvpStatus,
        count: sql<number>`cast(count(*) as integer)`,
      })
      .from(guestsTable)
      .groupBy(guestsTable.rsvpStatus);

    const summary = {
      going: 0,
      maybe: 0,
      notGoing: 0,
      pending: 0,
      total: 0,
    };

    for (const row of rows) {
      const count = row.count ?? 0;
      summary.total += count;
      if (row.rsvpStatus === "going") summary.going = count;
      else if (row.rsvpStatus === "maybe") summary.maybe = count;
      else if (row.rsvpStatus === "not_going") summary.notGoing = count;
      else if (row.rsvpStatus === "pending") summary.pending = count;
    }

    res.json(summary);
  } catch (err) {
    req.log.error({ err }, "Failed to get RSVP summary");
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
