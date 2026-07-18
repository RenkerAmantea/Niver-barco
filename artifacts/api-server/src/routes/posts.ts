import { Router } from "express";
import { db, postsTable, repliesTable, guestsTable } from "@workspace/db";
import { eq, sql, desc } from "drizzle-orm";
import { CreatePostBody, CreateReplyBody, ListRepliesParams, CreateReplyParams } from "@workspace/api-zod";

const router = Router();

// GET /api/posts
router.get("/posts", async (req, res) => {
  try {
    const posts = await db
      .select({
        id: postsTable.id,
        guestId: postsTable.guestId,
        guestName: guestsTable.name,
        guestAvatarUrl: guestsTable.avatarUrl,
        content: postsTable.content,
        createdAt: postsTable.createdAt,
        replyCount: sql<number>`cast(count(${repliesTable.id}) as integer)`,
      })
      .from(postsTable)
      .leftJoin(guestsTable, eq(postsTable.guestId, guestsTable.id))
      .leftJoin(repliesTable, eq(repliesTable.postId, postsTable.id))
      .groupBy(postsTable.id, guestsTable.name, guestsTable.avatarUrl)
      .orderBy(desc(postsTable.createdAt));

    res.json(posts.map(toPostResponse));
  } catch (err) {
    req.log.error({ err }, "Failed to list posts");
    res.status(500).json({ error: "Internal server error" });
  }
});

// POST /api/posts
router.post("/posts", async (req, res) => {
  const parsed = CreatePostBody.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "Invalid request body" });
  }

  try {
    const [post] = await db
      .insert(postsTable)
      .values({
        guestId: parsed.data.guestId,
        content: parsed.data.content,
      })
      .returning();

    const [guest] = await db
      .select()
      .from(guestsTable)
      .where(eq(guestsTable.id, post.guestId))
      .limit(1);

    res.status(201).json({
      id: post.id,
      guestId: post.guestId,
      guestName: guest?.name ?? "Convidado",
      guestAvatarUrl: guest?.avatarUrl ?? null,
      content: post.content,
      replyCount: 0,
      createdAt: post.createdAt.toISOString(),
    });
  } catch (err) {
    req.log.error({ err }, "Failed to create post");
    res.status(500).json({ error: "Internal server error" });
  }
});

// GET /api/posts/:postId/replies
router.get("/posts/:postId/replies", async (req, res) => {
  const parsed = ListRepliesParams.safeParse({ postId: Number(req.params.postId) });
  if (!parsed.success) {
    return res.status(400).json({ error: "Invalid post ID" });
  }

  try {
    const replies = await db
      .select({
        id: repliesTable.id,
        postId: repliesTable.postId,
        guestId: repliesTable.guestId,
        guestName: guestsTable.name,
        guestAvatarUrl: guestsTable.avatarUrl,
        content: repliesTable.content,
        createdAt: repliesTable.createdAt,
      })
      .from(repliesTable)
      .leftJoin(guestsTable, eq(repliesTable.guestId, guestsTable.id))
      .where(eq(repliesTable.postId, parsed.data.postId))
      .orderBy(repliesTable.createdAt);

    res.json(replies.map(toReplyResponse));
  } catch (err) {
    req.log.error({ err }, "Failed to list replies");
    res.status(500).json({ error: "Internal server error" });
  }
});

// POST /api/posts/:postId/replies
router.post("/posts/:postId/replies", async (req, res) => {
  const paramsParsed = CreateReplyParams.safeParse({ postId: Number(req.params.postId) });
  if (!paramsParsed.success) {
    return res.status(400).json({ error: "Invalid post ID" });
  }

  const bodyParsed = CreateReplyBody.safeParse(req.body);
  if (!bodyParsed.success) {
    return res.status(400).json({ error: "Invalid request body" });
  }

  try {
    const [reply] = await db
      .insert(repliesTable)
      .values({
        postId: paramsParsed.data.postId,
        guestId: bodyParsed.data.guestId,
        content: bodyParsed.data.content,
      })
      .returning();

    const [guest] = await db
      .select()
      .from(guestsTable)
      .where(eq(guestsTable.id, reply.guestId))
      .limit(1);

    res.status(201).json({
      id: reply.id,
      postId: reply.postId,
      guestId: reply.guestId,
      guestName: guest?.name ?? "Convidado",
      guestAvatarUrl: guest?.avatarUrl ?? null,
      content: reply.content,
      createdAt: reply.createdAt.toISOString(),
    });
  } catch (err) {
    req.log.error({ err }, "Failed to create reply");
    res.status(500).json({ error: "Internal server error" });
  }
});

function toPostResponse(post: {
  id: number;
  guestId: number;
  guestName: string | null;
  guestAvatarUrl: string | null;
  content: string;
  replyCount: number;
  createdAt: Date;
}) {
  return {
    id: post.id,
    guestId: post.guestId,
    guestName: post.guestName ?? "Convidado",
    guestAvatarUrl: post.guestAvatarUrl,
    content: post.content,
    replyCount: post.replyCount ?? 0,
    createdAt: post.createdAt.toISOString(),
  };
}

function toReplyResponse(reply: {
  id: number;
  postId: number;
  guestId: number;
  guestName: string | null;
  guestAvatarUrl: string | null;
  content: string;
  createdAt: Date;
}) {
  return {
    id: reply.id,
    postId: reply.postId,
    guestId: reply.guestId,
    guestName: reply.guestName ?? "Convidado",
    guestAvatarUrl: reply.guestAvatarUrl,
    content: reply.content,
    createdAt: reply.createdAt.toISOString(),
  };
}

export default router;
