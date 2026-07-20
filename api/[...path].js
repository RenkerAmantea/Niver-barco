import webpush from "web-push";
import {
  createHash,
  createECDH,
  randomBytes,
  randomInt,
  scryptSync,
  timingSafeEqual,
} from "node:crypto";

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const VAPID_PUBLIC_KEY = process.env.VAPID_PUBLIC_KEY;
const VAPID_PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY;
const ADMIN_PASSWORD = process.env.NIVER_ADMIN_PASSWORD;
const PHOTO_BUCKET = "niver-barco-fotos";

function rest(path, options = {}) {
  return fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    ...options,
    headers: {
      apikey: SUPABASE_SERVICE_ROLE_KEY,
      Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
      "Content-Type": "application/json",
      ...(options.headers ?? {}),
    },
  });
}

function storage(path, options = {}) {
  return fetch(`${SUPABASE_URL}/storage/v1/${path}`, {
    ...options,
    headers: {
      apikey: SUPABASE_SERVICE_ROLE_KEY,
      Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
      ...(options.headers ?? {}),
    },
  });
}

async function ensurePhotoBucket() {
  const bucketSettings = {
    public: true,
    file_size_limit: 8 * 1024 * 1024,
    allowed_mime_types: [
      "image/jpeg",
      "image/png",
      "image/webp",
      "image/heic",
      "audio/webm",
      "audio/ogg",
      "audio/mp4",
    ],
  };
  const response = await storage("bucket", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      id: PHOTO_BUCKET,
      name: PHOTO_BUCKET,
      ...bucketSettings,
    }),
  });
  // Storage returns 400 when the bucket was already created. Both states are fine.
  if (!response.ok && response.status !== 400 && response.status !== 409) {
    throw new Error(`Photo bucket setup failed: ${response.status}`);
  }
  // Existing buckets need their allow-list expanded before an audio can be
  // uploaded. Updating it is idempotent and keeps the same size limit.
  if (response.status === 400 || response.status === 409) {
    const updated = await storage(`bucket/${PHOTO_BUCKET}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(bucketSettings),
    });
    if (!updated.ok)
      throw new Error(`Photo bucket update failed: ${updated.status}`);
  }
}

async function deleteGuestMedia(guestId) {
  // Object deletion is deliberately best-effort: database cleanup must still
  // work if a bucket was never created or an old test account has no media.
  for (const prefix of [
    `guests/${guestId}/`,
    `avatars/${guestId}/`,
    `audio/${guestId}/`,
  ]) {
    const listedResponse = await storage(`object/list/${PHOTO_BUCKET}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ prefix, limit: 100, offset: 0 }),
    });
    const objects = await readJson(listedResponse);
    if (!listedResponse.ok || !Array.isArray(objects) || !objects.length)
      continue;
    const prefixes = objects
      .map((object) =>
        object.name?.startsWith(prefix)
          ? object.name
          : `${prefix}${object.name}`,
      )
      .filter(Boolean);
    if (prefixes.length)
      await storage(`object/${PHOTO_BUCKET}`, {
        method: "DELETE",
        body: JSON.stringify({ prefixes }),
      });
  }
}

function publicPhotoUrl(objectName) {
  return `${SUPABASE_URL}/storage/v1/object/public/${PHOTO_BUCKET}/${objectName.split("/").map(encodeURIComponent).join("/")}`;
}

function parsePhotoPost(content) {
  const match =
    typeof content === "string" &&
    content.match(/^\[\[niver-photo:([^|\]]+)(?:\|([^\]]+))?\]\]([\s\S]*)$/);
  if (!match) return null;
  // The original marker had no source and was only ever created by the mural.
  return {
    url: match[1],
    source: match[2] === "album" ? "album" : "mural",
    caption: match[3].trim(),
  };
}

function parseAudioPost(content) {
  const match = typeof content === "string" && content.match(/^\[\[niver-audio:([^|\]]+)(?:\|(\d+))?\]\]([\s\S]*)$/);
  return match ? { url: match[1], durationMs: Number(match[2]) || null, caption: match[3].trim() } : null;
}

async function readJson(response) {
  const text = await response.text();
  return text ? JSON.parse(text) : null;
}

function noteFromContent(content) {
  const match =
    typeof content === "string" &&
    content.match(/^\[\[niver-rsvp-note\]\]([\s\S]*)$/);
  return match ? match[1].trim() : null;
}

function replyReactionFromContent(content) {
  const match =
    typeof content === "string" &&
    content.match(
      /^\[\[niver-reply-reaction:(\d+):(heart|thumb|fire|boat)\]\]$/,
    );
  return match ? { replyId: Number(match[1]), emoji: match[2] } : null;
}

function pushSubscriptionFromContent(content) {
  const match =
    typeof content === "string" &&
    content.match(/^\[\[niver-push-subscription\]\](.+)$/s);
  if (!match) return null;
  try {
    return JSON.parse(match[1]);
  } catch {
    return null;
  }
}

function passwordFromContent(content) {
  const match =
    typeof content === "string" &&
    content.match(/^\[\[niver-password\]\](.+)$/s);
  if (!match) return null;
  try {
    const password = JSON.parse(match[1]);
    if (!password?.salt || !password?.hash) return null;
    return { salt: String(password.salt), hash: String(password.hash) };
  } catch {
    return null;
  }
}

function validPassword(password) {
  return (
    typeof password === "string" &&
    password.length >= 4 &&
    password.length <= 72
  );
}

function passwordRecord(password) {
  const salt = randomBytes(16).toString("base64url");
  return { salt, hash: scryptSync(password, salt, 32).toString("base64url") };
}

function passwordMatches(password, record) {
  if (!validPassword(password) || !record) return false;
  const expected = Buffer.from(record.hash, "base64url");
  const actual = scryptSync(password, record.salt, 32);
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}

function notificationFromContent(content) {
  const match =
    typeof content === "string" &&
    content.match(/^\[\[niver-notification\]\](.+)$/s);
  if (!match) return null;
  try {
    const notification = JSON.parse(match[1]);
    if (!notification?.title || !notification?.body) return null;
    return {
      title: String(notification.title),
      body: String(notification.body),
      url:
        typeof notification.url === "string" && notification.url.startsWith("/")
          ? notification.url
          : "/evento",
      readAt:
        typeof notification.readAt === "string" ? notification.readAt : null,
    };
  } catch {
    return null;
  }
}

function inviteFromContent(content) {
  const match =
    typeof content === "string" && content.match(/^\[\[niver-invite\]\](.+)$/s);
  if (!match) return null;
  try {
    const invite = JSON.parse(match[1]);
    if (!invite?.tokenHash || !invite?.slug) return null;
    return {
      tokenHash: String(invite.tokenHash),
      slug: String(invite.slug),
      createdAt: typeof invite.createdAt === "string" ? invite.createdAt : null,
      claimedAt: typeof invite.claimedAt === "string" ? invite.claimedAt : null,
    };
  } catch {
    return null;
  }
}

function adminMarkerFromContent(content) {
  return typeof content === "string" && content === "[[niver-admin]]";
}
function isCaptainGuest(guestId, markers = []) {
  return (
    Number(process.env.NIVER_CAPTAIN_GUEST_ID) === Number(guestId) ||
    markers.some(
      (marker) =>
        marker.guest_id === guestId && adminMarkerFromContent(marker.content),
    )
  );
}
function paymentFromContent(content) {
  const match =
    typeof content === "string" &&
    content.match(/^\[\[niver-payment\]\](.+)$/s);
  if (!match) return null;
  try {
    const payment = JSON.parse(match[1]);
    return ["pending", "paid", "on_site"].includes(payment?.status)
      ? { status: payment.status, updatedAt: payment.updatedAt ?? null }
      : null;
  } catch {
    return null;
  }
}
function paymentSettingsFromContent(content) {
  const match =
    typeof content === "string" &&
    content.match(/^\[\[niver-payment-settings\]\](.+)$/s);
  if (!match) return null;
  try {
    const settings = JSON.parse(match[1]);
    return typeof settings?.enabled === "boolean"
      ? { enabled: settings.enabled }
      : null;
  } catch {
    return null;
  }
}
function paymentDismissedFromContent(content) {
  return (
    typeof content === "string" &&
    content === "[[niver-payment-reminder-dismissed]]"
  );
}

function tokenHash(token) {
  return createHash("sha256").update(token).digest("hex");
}

function vapidPairMatches() {
  if (!VAPID_PUBLIC_KEY || !VAPID_PRIVATE_KEY) return false;
  try {
    const ecdh = createECDH("prime256v1");
    ecdh.setPrivateKey(Buffer.from(VAPID_PRIVATE_KEY, "base64url"));
    const derivedPublic = ecdh.getPublicKey();
    const configuredPublic = Buffer.from(VAPID_PUBLIC_KEY, "base64url");
    return (
      derivedPublic.length === configuredPublic.length &&
      timingSafeEqual(derivedPublic, configuredPublic)
    );
  } catch {
    return false;
  }
}

function inviteSlug(name) {
  const result = normalizedName(name)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 42);
  return result || "convidado";
}

function inviteToken(name) {
  // Para este evento pequeno, o nome já diferencia cada convite. O código de
  // quatro dígitos deixa o link legível; as tentativas de abertura recebem
  // limite abaixo para evitar varredura casual.
  return `${inviteSlug(name)}-${randomInt(1000, 10000)}`;
}

const inviteAttemptWindows = new Map();

function inviteAttemptAllowed(req) {
  const forwarded = req.headers["x-forwarded-for"];
  const address =
    typeof forwarded === "string"
      ? forwarded.split(",")[0].trim()
      : req.socket?.remoteAddress || "unknown";
  const now = Date.now();
  const previous = inviteAttemptWindows.get(address);
  if (!previous || now - previous.startedAt > 10 * 60 * 1000) {
    inviteAttemptWindows.set(address, { startedAt: now, count: 1 });
    return true;
  }
  if (previous.count >= 15) return false;
  previous.count += 1;
  return true;
}

function unclaimedInviteGuestIds(posts) {
  const ids = new Set();
  for (const post of posts ?? []) {
    const invite = inviteFromContent(post.content);
    if (invite && !invite.claimedAt) ids.add(post.guest_id);
  }
  return ids;
}

function isPrivateMarker(content) {
  return (
    noteFromContent(content) !== null ||
    replyReactionFromContent(content) !== null ||
    pushSubscriptionFromContent(content) !== null ||
    passwordFromContent(content) !== null ||
    notificationFromContent(content) !== null ||
    inviteFromContent(content) !== null ||
    adminMarkerFromContent(content) ||
    paymentFromContent(content) !== null ||
    paymentSettingsFromContent(content) !== null ||
    paymentDismissedFromContent(content)
  );
}

function admin(req) {
  return (
    Boolean(ADMIN_PASSWORD) &&
    req.headers.authorization === `Bearer ${ADMIN_PASSWORD}`
  );
}

async function inviteAdmin(req) {
  const token =
    typeof req.headers["x-niver-admin-invite"] === "string"
      ? req.headers["x-niver-admin-invite"]
      : "";
  if (token.length < 36) return false;
  const response = await rest("niver_barco_posts?select=guest_id,content");
  const markers = await readJson(response);
  if (!response.ok) return false;
  const invite = (markers ?? []).find(
    (item) => inviteFromContent(item.content)?.tokenHash === tokenHash(token),
  );
  return Boolean(
    invite &&
    (markers ?? []).some(
      (item) =>
        item.guest_id === invite.guest_id &&
        adminMarkerFromContent(item.content),
    ),
  );
}

async function authorizedAdmin(req) {
  return admin(req) || (await inviteAdmin(req));
}

async function pushSubscriptions() {
  const response = await rest("niver_barco_posts?select=id,guest_id,content");
  const records = await readJson(response);
  if (!response.ok)
    throw new Error(`Push subscriptions read failed: ${response.status}`);
  return (records ?? []).flatMap((record) => {
    const subscription = pushSubscriptionFromContent(record.content);
    return subscription?.subscription?.endpoint
      ? [{ ...subscription, markerId: record.id, guestId: record.guest_id }]
      : [];
  });
}

async function sendPushToGuests(guestIds, payload) {
  if (!VAPID_PUBLIC_KEY || !VAPID_PRIVATE_KEY || !guestIds?.length)
    return { sent: 0, failed: 0 };
  webpush.setVapidDetails(
    "mailto:renker@niver-barco.app",
    VAPID_PUBLIC_KEY,
    VAPID_PRIVATE_KEY,
  );
  const targetIds = new Set(guestIds);
  const subscriptions = (await pushSubscriptions()).filter(
    (item) =>
      targetIds.has(item.guestId) &&
      (!payload.preference || item.preferences?.[payload.preference] !== false),
  );
  const result = { sent: 0, failed: 0 };
  await Promise.all(
    subscriptions.map(async (item) => {
      try {
        await webpush.sendNotification(
          item.subscription,
          JSON.stringify(payload),
        );
        result.sent += 1;
      } catch (error) {
        result.failed += 1;
        if (error?.statusCode === 404 || error?.statusCode === 410)
          await rest(`niver_barco_posts?id=eq.${item.markerId}`, {
            method: "DELETE",
          });
      }
    }),
  );
  return result;
}

async function createNotifications(guestIds, payload) {
  const uniqueGuestIds = [
    ...new Set((guestIds ?? []).filter(Number.isInteger)),
  ];
  if (!uniqueGuestIds.length) return 0;
  const content = JSON.stringify({
    title: String(payload.title).slice(0, 80),
    body: String(payload.body).slice(0, 240),
    url:
      typeof payload.url === "string" && payload.url.startsWith("/")
        ? payload.url
        : "/evento",
    readAt: null,
  });
  const response = await rest("niver_barco_posts", {
    method: "POST",
    headers: { Prefer: "return=minimal" },
    body: JSON.stringify(
      uniqueGuestIds.map((guest_id) => ({
        guest_id,
        content: `[[niver-notification]]${content}`,
      })),
    ),
  });
  if (!response.ok)
    throw new Error(`Notification save failed: ${response.status}`);
  return uniqueGuestIds.length;
}

function mentionedGuestIds(content, guests) {
  const lower = content.toLocaleLowerCase("pt-BR");
  return guests
    .filter((guest) =>
      lower.includes(`@${guest.name.toLocaleLowerCase("pt-BR")}`),
    )
    .map((guest) => guest.id);
}

function normalizedName(name) {
  return name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .replace(/\s+/g, " ")
    .toLowerCase();
}

// Fallback server-side for every creation path. The regular login sends one of
// the richer client-side options, but invitations and direct API calls must
// never leave a guest with an empty visual identity.
const DEFAULT_AVATARS = [
  {
    background: "#40215f",
    accent: "#f8cc6d",
    shape:
      '<path d="M48 20l5.5 18 18.5-5.5-13 13L72 58l-18.5-1L48 76l-5.5-19L24 58l13-12.5-13-13 18.5 5.5z" fill="ACCENT"/>',
  },
  {
    background: "#123d65",
    accent: "#7fe5ff",
    shape:
      '<path d="M20 51c9-12 17 12 28 0s19 12 28 0M20 63c9-12 17 12 28 0s19 12 28 0" fill="none" stroke="ACCENT" stroke-width="5" stroke-linecap="round"/>',
  },
  {
    background: "#54224f",
    accent: "#ff9bd2",
    shape:
      '<path d="M61 24a25 25 0 1 0 11 43A28 28 0 1 1 61 24z" fill="ACCENT"/>',
  },
  {
    background: "#19524e",
    accent: "#93f5d2",
    shape:
      '<path d="M48 18l10 30-10 30-10-30z" fill="ACCENT"/><path d="M18 48l30-10 30 10-30 10z" fill="ACCENT" opacity=".7"/>',
  },
  {
    background: "#693a15",
    accent: "#ffe08a",
    shape:
      '<circle cx="48" cy="48" r="16" fill="ACCENT"/><path d="M48 20v9m0 38v9M20 48h9m38 0h9M28 28l6 6m28 28 6 6m0-40-6 6M34 62l-6 6" stroke="ACCENT" stroke-width="4" stroke-linecap="round"/>',
  },
  {
    background: "#34345d",
    accent: "#d7d4ff",
    shape:
      '<path d="M48 18v59M48 23l27 42H48zM44 32L20 65h24zM16 78h64" fill="none" stroke="ACCENT" stroke-width="4" stroke-linejoin="round"/>',
  },
  {
    background: "#233b5c",
    accent: "#cfdef3",
    shape:
      '<path d="M48 18v42m-9-31h18m-30 31c0 14 9 20 21 20s21-6 21-20M24 60h48" fill="none" stroke="ACCENT" stroke-width="5" stroke-linecap="round"/><circle cx="48" cy="17" r="5" fill="ACCENT"/>',
  },
  {
    background: "#30275a",
    accent: "#a9d7ff",
    shape:
      '<circle cx="48" cy="48" r="9" fill="ACCENT"/><ellipse cx="48" cy="48" rx="29" ry="12" fill="none" stroke="ACCENT" stroke-width="3.5"/><ellipse cx="48" cy="48" rx="12" ry="29" fill="none" stroke="ACCENT" stroke-width="3.5"/>',
  },
];

function defaultAvatarUrl(seed) {
  const source = String(seed || "convidado");
  const index =
    [...source].reduce((total, char) => total + char.charCodeAt(0), 0) %
    DEFAULT_AVATARS.length;
  const avatar = DEFAULT_AVATARS[index];
  const shape = avatar.shape.replaceAll("ACCENT", avatar.accent);
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 96 96"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop stop-color="${avatar.background}"/><stop offset="1" stop-color="#100d2c"/></linearGradient></defs><rect width="96" height="96" rx="48" fill="url(#g)"/><circle cx="48" cy="48" r="30" fill="none" stroke="${avatar.accent}" stroke-width="2" opacity=".45"/>${shape}</svg>`;
  return `data:image/svg+xml,${encodeURIComponent(svg)}`;
}

function rsvpNotes(posts) {
  const notes = new Map();
  for (const post of posts ?? []) {
    const note = noteFromContent(post.content);
    if (note !== null) notes.set(post.guest_id, note);
  }
  return notes;
}

function guestResponse(guest, notes = new Map()) {
  return {
    id: guest.id,
    name: guest.name,
    googleId: guest.google_id,
    avatarUrl: guest.avatar_url,
    rsvpStatus: guest.rsvp_status,
    rsvpNote: notes.get(guest.id) ?? null,
    createdAt: guest.created_at,
  };
}

function postResponse(post, guests, replies) {
  const guest = guests.find((item) => item.id === post.guest_id);
  return {
    id: post.id,
    guestId: post.guest_id,
    guestName: guest?.name ?? "Convidado",
    guestAvatarUrl: guest?.avatar_url ?? null,
    rsvpStatus: guest?.rsvp_status ?? "pending",
    content: post.content,
    replyCount: replies.filter((reply) => reply.post_id === post.id).length,
    createdAt: post.created_at,
  };
}

function replyResponse(reply, guests) {
  const guest = guests.find((item) => item.id === reply.guest_id);
  return {
    id: reply.id,
    postId: reply.post_id,
    guestId: reply.guest_id,
    guestName: guest?.name ?? "Convidado",
    guestAvatarUrl: guest?.avatar_url ?? null,
    content: reply.content,
    createdAt: reply.created_at,
  };
}

export default async function handler(req, res) {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    return res.status(500).json({ error: "Database configuration is missing" });
  }

  const path =
    new URL(req.url, "https://app.local").pathname.replace(/^\/api/, "") || "/";

  try {
    if (req.method === "GET" && path === "/healthz") {
      return res.status(200).json({ ok: true });
    }

    if (req.method === "GET" && path === "/push/config") {
      return res.status(200).json({
        supported: Boolean(VAPID_PUBLIC_KEY),
        publicKey: VAPID_PUBLIC_KEY ?? null,
      });
    }

    if (req.method === "GET" && path === "/push/health") {
      // Diagnóstico sem segredos: permite confirmar que o par VAPID do
      // servidor é coerente antes de culpar o aparelho do convidado.
      return res.status(200).json({
        configured: Boolean(VAPID_PUBLIC_KEY && VAPID_PRIVATE_KEY),
        pairMatches: vapidPairMatches(),
        publicKeyFingerprint: VAPID_PUBLIC_KEY
          ? createHash("sha256")
              .update(VAPID_PUBLIC_KEY)
              .digest("hex")
              .slice(0, 12)
          : null,
      });
    }

    if (req.method === "POST" && path === "/push/subscriptions") {
      const guestId = Number(req.body?.guestId);
      const subscription = req.body?.subscription;
      if (
        !Number.isInteger(guestId) ||
        !subscription?.endpoint ||
        !subscription?.keys?.p256dh ||
        !subscription?.keys?.auth
      )
        return res.status(400).json({ error: "Inscrição de push inválida." });
      const old = await rest("niver_barco_posts?select=id,content");
      const markers = await readJson(old);
      for (const marker of markers ?? []) {
        const item = pushSubscriptionFromContent(marker.content);
        if (item?.endpoint === subscription.endpoint)
          await rest(`niver_barco_posts?id=eq.${marker.id}`, {
            method: "DELETE",
          });
      }
      const preferences = {
        announcements: true,
        posts: true,
        mentions: true,
        replies: true,
        threadActivity: true,
        photos: true,
        ...(req.body?.preferences ?? {}),
      };
      const response = await rest("niver_barco_posts", {
        method: "POST",
        headers: { Prefer: "return=minimal" },
        body: JSON.stringify({
          guest_id: guestId,
          content: `[[niver-push-subscription]]${JSON.stringify({ subscription, preferences })}`,
        }),
      });
      return response.ok
        ? res.status(201).json({ ok: true })
        : res.status(response.status).json(await readJson(response));
    }

    if (req.method === "GET" && path === "/notifications") {
      const guestId = Number(
        new URL(req.url, "https://app.local").searchParams.get("guestId"),
      );
      if (!Number.isInteger(guestId))
        return res.status(400).json({ error: "Convidado inválido." });
      const response = await rest(
        `niver_barco_posts?select=id,guest_id,content,created_at&guest_id=eq.${guestId}&order=created_at.desc`,
      );
      const records = await readJson(response);
      if (!response.ok) return res.status(response.status).json(records);
      const notifications = (records ?? [])
        .flatMap((record) => {
          const notification = notificationFromContent(record.content);
          return notification
            ? [{ id: record.id, ...notification, createdAt: record.created_at }]
            : [];
        })
        .slice(0, 40);
      return res.status(200).json({
        notifications,
        unreadCount: notifications.filter((item) => !item.readAt).length,
      });
    }

    const notificationReadMatch = path.match(/^\/notifications\/(\d+)\/read$/);
    if (notificationReadMatch && req.method === "PATCH") {
      const notificationId = Number(notificationReadMatch[1]);
      const guestId = Number(req.body?.guestId);
      if (!Number.isInteger(notificationId) || !Number.isInteger(guestId))
        return res.status(400).json({ error: "Notificação inválida." });
      const currentResponse = await rest(
        `niver_barco_posts?select=id,content&id=eq.${notificationId}&guest_id=eq.${guestId}`,
      );
      const records = await readJson(currentResponse);
      const current = records?.[0];
      const notification = notificationFromContent(current?.content);
      if (!currentResponse.ok)
        return res.status(currentResponse.status).json(records);
      if (!notification)
        return res.status(404).json({ error: "Notificação não encontrada." });
      if (notification.readAt)
        return res.status(200).json({ ok: true, readAt: notification.readAt });
      const readAt = new Date().toISOString();
      const content = `[[niver-notification]]${JSON.stringify({ ...notification, readAt })}`;
      const response = await rest(
        `niver_barco_posts?id=eq.${notificationId}&guest_id=eq.${guestId}`,
        {
          method: "PATCH",
          headers: { Prefer: "return=minimal" },
          body: JSON.stringify({ content }),
        },
      );
      return response.ok
        ? res.status(200).json({ ok: true, readAt })
        : res.status(response.status).json(await readJson(response));
    }

    if (path === "/admin/notify") {
      if (!(await authorizedAdmin(req)))
        return res
          .status(401)
          .json({ error: "Área administrativa protegida." });
      if (req.method !== "POST") return res.status(405).end();
      const title =
        typeof req.body?.title === "string"
          ? req.body.title.trim().slice(0, 80)
          : "";
      const body =
        typeof req.body?.body === "string"
          ? req.body.body.trim().slice(0, 240)
          : "";
      const url =
        typeof req.body?.url === "string" && req.body.url.startsWith("/")
          ? req.body.url
          : "/evento";
      if (!title || !body)
        return res
          .status(400)
          .json({ error: "Título e mensagem são obrigatórios." });
      const guestsResponse = await rest("niver_barco_guests?select=id");
      const guests = await readJson(guestsResponse);
      if (!guestsResponse.ok)
        return res.status(guestsResponse.status).json(guests);
      const guestIds = (guests ?? []).map((guest) => guest.id);
      const saved = await createNotifications(guestIds, { title, body, url });
      const records = await pushSubscriptions();
      const outcome = await sendPushToGuests(
        [...new Set(records.map((item) => item.guestId))],
        {
          title,
          body,
          url,
          tag: `admin-${Date.now()}`,
          preference: "announcements",
        },
      );
      return res
        .status(200)
        .json({ ...outcome, saved, subscribedDevices: records.length });
    }

    if (req.method === "GET" && path === "/admin/push/status") {
      if (!(await authorizedAdmin(req)))
        return res
          .status(401)
          .json({ error: "Área administrativa protegida." });
      const records = await pushSubscriptions();
      return res.status(200).json({
        configured: Boolean(VAPID_PUBLIC_KEY && VAPID_PRIVATE_KEY),
        pairMatches: vapidPairMatches(),
        subscribedDevices: records.length,
        subscribedGuests: new Set(records.map((record) => record.guestId)).size,
        subscriptions: records.map((record) => ({
          guestId: record.guestId,
          endpointHost: (() => {
            try {
              return new URL(record.subscription.endpoint).host;
            } catch {
              return "inválido";
            }
          })(),
          preferences: record.preferences ?? {},
        })),
      });
    }

    if (path === "/admin/invites") {
      if (!(await authorizedAdmin(req)))
        return res
          .status(401)
          .json({ error: "Área administrativa protegida." });
      if (req.method === "GET") {
        const [guestsResponse, markersResponse] = await Promise.all([
          rest(
            "niver_barco_guests?select=id,name,created_at,rsvp_status&order=created_at.desc",
          ),
          rest(
            "niver_barco_posts?select=id,guest_id,content&order=created_at.desc",
          ),
        ]);
        const [guests, markers] = await Promise.all([
          readJson(guestsResponse),
          readJson(markersResponse),
        ]);
        if (!guestsResponse.ok)
          return res.status(guestsResponse.status).json(guests);
        if (!markersResponse.ok)
          return res.status(markersResponse.status).json(markers);
        const byGuest = new Map(
          (guests ?? []).map((guest) => [guest.id, guest]),
        );
        const invites = (markers ?? []).flatMap((marker) => {
          const invite = inviteFromContent(marker.content);
          const guest = byGuest.get(marker.guest_id);
          return invite && guest
            ? [
                {
                  id: marker.id,
                  guestId: guest.id,
                  name: guest.name,
                  slug: invite.slug,
                  createdAt: invite.createdAt,
                  claimedAt: invite.claimedAt,
                  rsvpStatus: guest.rsvp_status,
                },
              ]
            : [];
        });
        return res.status(200).json(invites);
      }
      if (req.method === "POST") {
        const name =
          typeof req.body?.name === "string"
            ? req.body.name.trim().replace(/\s+/g, " ")
            : "";
        if (!name || name.length > 80)
          return res.status(400).json({ error: "Nome inválido." });
        const namesResponse = await rest("niver_barco_guests?select=id,name");
        const names = await readJson(namesResponse);
        if (!namesResponse.ok)
          return res.status(namesResponse.status).json(names);
        if (
          (names ?? []).some(
            (guest) => normalizedName(guest.name) === normalizedName(name),
          )
        )
          return res
            .status(409)
            .json({ error: "Esse nome já está reservado ou em uso." });
        const guestResponse = await rest("niver_barco_guests", {
          method: "POST",
          headers: { Prefer: "return=representation" },
          body: JSON.stringify({
            name,
            avatar_url: defaultAvatarUrl(name),
            rsvp_status: "pending",
          }),
        });
        const createdGuests = await readJson(guestResponse);
        const guest = createdGuests?.[0];
        if (!guestResponse.ok || !guest)
          return res.status(guestResponse.status).json(createdGuests);
        const token = inviteToken(name);
        const invite = {
          tokenHash: tokenHash(token),
          slug: inviteSlug(name),
          createdAt: new Date().toISOString(),
          claimedAt: null,
        };
        const markerResponse = await rest("niver_barco_posts", {
          method: "POST",
          headers: { Prefer: "return=representation" },
          body: JSON.stringify({
            guest_id: guest.id,
            content: `[[niver-invite]]${JSON.stringify(invite)}`,
          }),
        });
        const markers = await readJson(markerResponse);
        if (!markerResponse.ok) {
          await rest(`niver_barco_guests?id=eq.${guest.id}`, {
            method: "DELETE",
          });
          return res.status(markerResponse.status).json(markers);
        }
        const origin =
          req.headers.origin || "https://renker-niver-barco.vercel.app";
        return res.status(201).json({
          id: markers?.[0]?.id,
          guestId: guest.id,
          name: guest.name,
          slug: invite.slug,
          url: `${origin}/i/${token}`,
          createdAt: invite.createdAt,
          claimedAt: null,
        });
      }
      return res.status(405).end();
    }

    const inviteLinkMatch = path.match(/^\/admin\/invites\/(\d+)\/link$/);
    if (inviteLinkMatch && req.method === "POST") {
      if (!(await authorizedAdmin(req)))
        return res
          .status(401)
          .json({ error: "Área administrativa protegida." });
      const markerId = Number(inviteLinkMatch[1]);
      const markerResponse = await rest(
        `niver_barco_posts?select=id,guest_id,content&id=eq.${markerId}`,
      );
      const markers = await readJson(markerResponse);
      const marker = markers?.[0];
      const invite = marker && inviteFromContent(marker.content);
      if (!markerResponse.ok)
        return res.status(markerResponse.status).json(markers);
      if (!marker || !invite)
        return res.status(404).json({ error: "Convite não encontrado." });
      const guestResponse = await rest(
        `niver_barco_guests?select=id,name&id=eq.${marker.guest_id}`,
      );
      const guests = await readJson(guestResponse);
      const guest = guests?.[0];
      if (!guestResponse.ok)
        return res.status(guestResponse.status).json(guests);
      if (!guest)
        return res.status(404).json({ error: "Convidado não encontrado." });
      const token = inviteToken(guest.name);
      const updatedInvite = { ...invite, tokenHash: tokenHash(token) };
      const updateResponse = await rest(
        `niver_barco_posts?id=eq.${marker.id}`,
        {
          method: "PATCH",
          headers: { Prefer: "return=minimal" },
          body: JSON.stringify({
            content: `[[niver-invite]]${JSON.stringify(updatedInvite)}`,
          }),
        },
      );
      if (!updateResponse.ok)
        return res
          .status(updateResponse.status)
          .json(await readJson(updateResponse));
      const origin =
        req.headers.origin || "https://renker-niver-barco.vercel.app";
      return res.status(200).json({
        id: marker.id,
        guestId: guest.id,
        name: guest.name,
        slug: invite.slug,
        url: `${origin}/i/${token}`,
        createdAt: invite.createdAt,
        claimedAt: invite.claimedAt,
      });
    }

    const inviteMatch = path.match(/^\/invites\/([^/]+)$/);
    const inviteClaimMatch = path.match(/^\/invites\/([^/]+)\/claim$/);
    if (
      (inviteMatch && req.method === "GET") ||
      (inviteClaimMatch && req.method === "POST")
    ) {
      if (!inviteAttemptAllowed(req))
        return res.status(429).json({
          error:
            "Muitas tentativas neste aparelho. Aguarde alguns minutos antes de tentar de novo.",
        });
      const token = decodeURIComponent((inviteMatch ?? inviteClaimMatch)[1]);
      if (token.length < 6)
        return res.status(404).json({ error: "Convite não encontrado." });
      const markersResponse = await rest(
        "niver_barco_posts?select=id,guest_id,content",
      );
      const markers = await readJson(markersResponse);
      if (!markersResponse.ok)
        return res.status(markersResponse.status).json(markers);
      const marker = (markers ?? []).find(
        (item) =>
          inviteFromContent(item.content)?.tokenHash === tokenHash(token),
      );
      const invite = marker && inviteFromContent(marker.content);
      if (!marker || !invite)
        return res.status(404).json({ error: "Convite não encontrado." });
      const invitedGuestResponse = await rest(
        `niver_barco_guests?select=*&id=eq.${marker.guest_id}`,
      );
      const guests = await readJson(invitedGuestResponse);
      if (!invitedGuestResponse.ok || !guests?.[0])
        return res.status(404).json({ error: "Convidado não encontrado." });
      if (invite.claimedAt)
        return res.status(409).json({
          error:
            "Este convite já foi ativado. Entre pela página inicial usando o nome e a senha escolhidos pela pessoa convidada.",
        });
      let invitedGuest = guests[0];
      if (!invitedGuest.avatar_url) {
        const avatar_url = defaultAvatarUrl(invitedGuest.name);
        const avatarResponse = await rest(
          `niver_barco_guests?id=eq.${invitedGuest.id}`,
          {
            method: "PATCH",
            headers: { Prefer: "return=representation" },
            body: JSON.stringify({ avatar_url }),
          },
        );
        const updated = await readJson(avatarResponse);
        if (avatarResponse.ok && updated?.[0]) invitedGuest = updated[0];
      }
      if (req.method === "GET")
        return res.status(200).json({
          id: invitedGuest.id,
          name: invitedGuest.name,
          avatarUrl: invitedGuest.avatar_url ?? null,
        });

      const password = req.body?.password;
      if (!validPassword(password))
        return res
          .status(400)
          .json({ error: "Crie uma senha de pelo menos 4 caracteres." });
      const existingPassword = (markers ?? [])
        .filter((item) => item.guest_id === marker.guest_id)
        .map((item) => passwordFromContent(item.content))
        .find(Boolean);
      if (existingPassword)
        return res.status(409).json({
          error:
            "Este convite já foi ativado. Entre pela página inicial com nome e senha.",
        });
      const passwordResponse = await rest("niver_barco_posts", {
        method: "POST",
        headers: { Prefer: "return=representation" },
        body: JSON.stringify({
          guest_id: invitedGuest.id,
          content: `[[niver-password]]${JSON.stringify(passwordRecord(password))}`,
        }),
      });
      const passwordMarkers = await readJson(passwordResponse);
      const passwordMarker = passwordMarkers?.[0];
      if (!passwordResponse.ok || !passwordMarker)
        return res.status(passwordResponse.status).json(passwordMarkers);
      const claimedAt = new Date().toISOString();
      const claimResponse = await rest(`niver_barco_posts?id=eq.${marker.id}`, {
        method: "PATCH",
        headers: { Prefer: "return=minimal" },
        body: JSON.stringify({
          content: `[[niver-invite]]${JSON.stringify({ ...invite, claimedAt })}`,
        }),
      });
      if (!claimResponse.ok) {
        await rest(`niver_barco_posts?id=eq.${passwordMarker.id}`, {
          method: "DELETE",
        });
        return res
          .status(claimResponse.status)
          .json(await readJson(claimResponse));
      }
      const adminMarkerResponse = await rest(
        `niver_barco_posts?select=content&guest_id=eq.${marker.guest_id}`,
      );
      const guestMarkers = await readJson(adminMarkerResponse);
      return res.status(200).json({
        ...guestResponse(invitedGuest),
        isAdmin: (guestMarkers ?? []).some((item) =>
          adminMarkerFromContent(item.content),
        ),
      });
    }

    if (path === "/admin/payments") {
      if (!(await authorizedAdmin(req)))
        return res
          .status(401)
          .json({ error: "Área administrativa protegida." });
      const [guestsResponse, markersResponse] = await Promise.all([
        rest(
          "niver_barco_guests?select=id,name,rsvp_status,avatar_url&order=created_at.asc",
        ),
        rest(
          "niver_barco_posts?select=id,guest_id,content,created_at&order=created_at.asc",
        ),
      ]);
      const [guests, markers] = await Promise.all([
        readJson(guestsResponse),
        readJson(markersResponse),
      ]);
      if (!guestsResponse.ok || !markersResponse.ok)
        return res
          .status(500)
          .json({ error: "Não foi possível carregar o controle." });
      const hidden = unclaimedInviteGuestIds(markers);
      const payments = new Map();
      for (const marker of markers ?? []) {
        const payment = paymentFromContent(marker.content);
        if (payment) payments.set(marker.guest_id, payment);
      }
      const settingsMarker = [...(markers ?? [])]
        .reverse()
        .find((marker) => paymentSettingsFromContent(marker.content));
      return res.status(200).json({
        guests: (guests ?? [])
          .filter((guest) => !hidden.has(guest.id))
          .map((guest) => ({
            ...guest,
            payment: payments.get(guest.id)?.status ?? "pending",
            isAdmin: isCaptainGuest(guest.id, markers ?? []),
          })),
        reminderEnabled:
          paymentSettingsFromContent(settingsMarker?.content)?.enabled ?? false,
      });
    }

    const adminGuestMatch = path.match(/^\/admin\/guests\/(\d+)$/);
    if (adminGuestMatch && req.method === "DELETE") {
      if (!(await authorizedAdmin(req)))
        return res
          .status(401)
          .json({ error: "Área administrativa protegida." });
      const guestId = Number(adminGuestMatch[1]);
      if (!Number.isInteger(guestId))
        return res.status(400).json({ error: "Convidado inválido." });
      const guestResponse = await rest(
        `niver_barco_guests?select=id,name&id=eq.${guestId}`,
      );
      const guests = await readJson(guestResponse);
      const guest = guests?.[0];
      if (!guestResponse.ok)
        return res.status(guestResponse.status).json(guests);
      if (!guest)
        return res.status(404).json({ error: "Convidado não encontrado." });
      const markerResponse = await rest(
        `niver_barco_posts?select=content&guest_id=eq.${guestId}`,
      );
      const markers = await readJson(markerResponse);
      if (!markerResponse.ok)
        return res.status(markerResponse.status).json(markers);
      if (isCaptainGuest(guestId, markers ?? []))
        return res.status(403).json({
          error: "A conta do capitão não pode ser apagada pelo painel.",
        });
      const deleteResponse = await rest(`niver_barco_guests?id=eq.${guestId}`, {
        method: "DELETE",
        headers: { Prefer: "return=minimal" },
      });
      if (!deleteResponse.ok)
        return res
          .status(deleteResponse.status)
          .json(await readJson(deleteResponse));
      await deleteGuestMedia(guestId);
      return res.status(200).json({ ok: true, id: guestId, name: guest.name });
    }

    const adminPostMatch = path.match(/^\/admin\/posts\/(\d+)$/);
    if (adminPostMatch && req.method === "DELETE") {
      if (!(await authorizedAdmin(req)))
        return res
          .status(401)
          .json({ error: "Área administrativa protegida." });
      const postId = Number(adminPostMatch[1]);
      const postResponse = await rest(
        `niver_barco_posts?select=id,content&id=eq.${postId}`,
      );
      const posts = await readJson(postResponse);
      const post = posts?.[0];
      if (!postResponse.ok) return res.status(postResponse.status).json(posts);
      if (!post || isPrivateMarker(post.content))
        return res.status(404).json({ error: "Publicação não encontrada." });
      await rest(`niver_barco_reactions?post_id=eq.${postId}`, {
        method: "DELETE",
      });
      await rest(`niver_barco_replies?post_id=eq.${postId}`, {
        method: "DELETE",
      });
      const media = parsePhotoPost(post.content) ?? parseAudioPost(post.content);
      const deleted = await rest(`niver_barco_posts?id=eq.${postId}`, {
        method: "DELETE",
        headers: { Prefer: "return=minimal" },
      });
      if (!deleted.ok)
        return res.status(deleted.status).json(await readJson(deleted));
      if (
        media?.url.startsWith(
          `${SUPABASE_URL}/storage/v1/object/public/${PHOTO_BUCKET}/`,
        )
      ) {
        const objectPath = decodeURIComponent(
          media.url.split(`/public/${PHOTO_BUCKET}/`)[1] ?? "",
        );
        if (objectPath.startsWith("guests/") || objectPath.startsWith("audio/"))
          await storage(`object/${PHOTO_BUCKET}`, {
            method: "DELETE",
            body: JSON.stringify({ prefixes: [objectPath] }),
          });
      }
      return res.status(200).json({ ok: true, id: postId });
    }

    if (path === "/admin/photos" && req.method === "DELETE") {
      if (!(await authorizedAdmin(req)))
        return res
          .status(401)
          .json({ error: "Área administrativa protegida." });
      const objectPath =
        typeof req.body?.path === "string" ? req.body.path : "";
      if (!/^guests\/\d+\/[^/]+$/.test(objectPath))
        return res.status(400).json({ error: "Foto inválida." });
      const publicUrl = publicPhotoUrl(objectPath);
      const postsResponse = await rest("niver_barco_posts?select=id,content");
      const posts = await readJson(postsResponse);
      if (!postsResponse.ok)
        return res.status(postsResponse.status).json(posts);
      for (const post of posts ?? []) {
        if (parsePhotoPost(post.content)?.url === publicUrl) {
          await rest(`niver_barco_reactions?post_id=eq.${post.id}`, {
            method: "DELETE",
          });
          await rest(`niver_barco_replies?post_id=eq.${post.id}`, {
            method: "DELETE",
          });
          await rest(`niver_barco_posts?id=eq.${post.id}`, {
            method: "DELETE",
          });
        }
      }
      const deleted = await storage(`object/${PHOTO_BUCKET}`, {
        method: "DELETE",
        body: JSON.stringify({ prefixes: [objectPath] }),
      });
      return deleted.ok
        ? res.status(200).json({ ok: true })
        : res.status(deleted.status).json(await readJson(deleted));
    }

    const paymentMatch = path.match(/^\/admin\/payments\/(\d+)$/);
    if (paymentMatch && req.method === "PATCH") {
      if (!(await authorizedAdmin(req)))
        return res
          .status(401)
          .json({ error: "Área administrativa protegida." });
      const guestId = Number(paymentMatch[1]);
      const status = req.body?.status;
      if (
        !Number.isInteger(guestId) ||
        !["pending", "paid", "on_site"].includes(status)
      )
        return res.status(400).json({ error: "Status inválido." });
      const oldResponse = await rest(
        `niver_barco_posts?select=id,content&guest_id=eq.${guestId}`,
      );
      const old = await readJson(oldResponse);
      for (const marker of old ?? [])
        if (paymentFromContent(marker.content))
          await rest(`niver_barco_posts?id=eq.${marker.id}`, {
            method: "DELETE",
          });
      const response = await rest("niver_barco_posts", {
        method: "POST",
        headers: { Prefer: "return=minimal" },
        body: JSON.stringify({
          guest_id: guestId,
          content: `[[niver-payment]]${JSON.stringify({ status, updatedAt: new Date().toISOString() })}`,
        }),
      });
      return response.ok
        ? res.status(200).json({ ok: true, status })
        : res.status(response.status).json(await readJson(response));
    }

    if (path === "/admin/surprise-guests" && req.method === "POST") {
      if (!(await authorizedAdmin(req)))
        return res
          .status(401)
          .json({ error: "Área administrativa protegida." });
      const name =
        typeof req.body?.name === "string"
          ? req.body.name.trim().replace(/\s+/g, " ")
          : "";
      const payment = req.body?.payment ?? "pending";
      if (!name || !["pending", "paid", "on_site"].includes(payment))
        return res.status(400).json({ error: "Dados inválidos." });
      const namesResponse = await rest("niver_barco_guests?select=id,name");
      const names = await readJson(namesResponse);
      if (
        (names ?? []).some(
          (guest) => normalizedName(guest.name) === normalizedName(name),
        )
      )
        return res.status(409).json({ error: "Esse nome já está em uso." });
      const createResponse = await rest("niver_barco_guests", {
        method: "POST",
        headers: { Prefer: "return=representation" },
        body: JSON.stringify({ name, rsvp_status: "going" }),
      });
      const created = await readJson(createResponse);
      const guest = created?.[0];
      if (!createResponse.ok || !guest)
        return res.status(createResponse.status).json(created);
      await rest("niver_barco_posts", {
        method: "POST",
        headers: { Prefer: "return=minimal" },
        body: JSON.stringify({
          guest_id: guest.id,
          content: `[[niver-payment]]${JSON.stringify({ status: payment, updatedAt: new Date().toISOString() })}`,
        }),
      });
      return res.status(201).json({ ...guest, payment });
    }

    if (path === "/admin/payment-reminder" && req.method === "PATCH") {
      if (!(await authorizedAdmin(req)))
        return res
          .status(401)
          .json({ error: "Área administrativa protegida." });
      if (typeof req.body?.enabled !== "boolean")
        return res.status(400).json({ error: "Configuração inválida." });
      const ownerId = Number(req.body?.guestId);
      if (!Number.isInteger(ownerId))
        return res
          .status(400)
          .json({ error: "Conta administrativa inválida." });
      const oldResponse = await rest("niver_barco_posts?select=id,content");
      const old = await readJson(oldResponse);
      for (const marker of old ?? [])
        if (paymentSettingsFromContent(marker.content))
          await rest(`niver_barco_posts?id=eq.${marker.id}`, {
            method: "DELETE",
          });
      const response = await rest("niver_barco_posts", {
        method: "POST",
        headers: { Prefer: "return=minimal" },
        body: JSON.stringify({
          guest_id: ownerId,
          content: `[[niver-payment-settings]]${JSON.stringify({ enabled: req.body.enabled })}`,
        }),
      });
      return response.ok
        ? res.status(200).json({ ok: true, enabled: req.body.enabled })
        : res.status(response.status).json(await readJson(response));
    }

    if (req.method === "GET" && path === "/photos") {
      await ensurePhotoBucket();
      const guestsResponse = await rest(
        "niver_barco_guests?select=id,name,avatar_url",
      );
      const guests = await readJson(guestsResponse);
      if (!guestsResponse.ok)
        return res.status(guestsResponse.status).json(guests);
      const postsResponse = await rest("niver_barco_posts?select=id,content");
      const posts = await readJson(postsResponse);
      if (!postsResponse.ok)
        return res.status(postsResponse.status).json(posts);
      const photoPosts = new Map(
        (posts ?? []).flatMap((post) => {
          const photo = parsePhotoPost(post.content);
          return photo ? [[photo.url, { ...photo, postId: post.id }]] : [];
        }),
      );
      const objectResponses = await Promise.all(
        (guests ?? []).map(async (guest) => {
          const response = await storage(`object/list/${PHOTO_BUCKET}`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              prefix: `guests/${guest.id}/`,
              limit: 100,
              offset: 0,
              sortBy: { column: "created_at", order: "desc" },
            }),
          });
          return {
            guestId: guest.id,
            response,
            objects: await readJson(response),
          };
        }),
      );
      const failed = objectResponses.find(({ response }) => !response.ok);
      if (failed)
        return res.status(failed.response.status).json(failed.objects);
      const guestById = new Map(
        (guests ?? []).map((guest) => [guest.id, guest]),
      );
      const photos = objectResponses
        .flatMap(({ guestId, objects }) =>
          (objects ?? []).map((object) => ({
            ...object,
            name: object.name?.startsWith("guests/")
              ? object.name
              : `guests/${guestId}/${object.name}`,
          })),
        )
        .filter((object) => object.name && !object.id?.endsWith("/"))
        .map((object) => {
          const name = object.name;
          const match = name.match(/^guests\/(\d+)\//);
          const guest = match ? guestById.get(Number(match[1])) : null;
          const post = photoPosts.get(publicPhotoUrl(name));
          return {
            id: object.id ?? name,
            path: name,
            url: publicPhotoUrl(name),
            createdAt: object.created_at ?? null,
            guestName: guest?.name ?? "Tripulação",
            guestAvatarUrl: guest?.avatar_url ?? null,
            source: post?.source ?? "album",
            postId: post?.postId ?? null,
            caption: post?.caption ?? "",
          };
        });
      return res.status(200).json(photos);
    }

    if (req.method === "POST" && path === "/photos/upload-url") {
      const guestId = Number(req.body?.guestId);
      const rawContentType =
        typeof req.body?.contentType === "string" ? req.body.contentType : "";
      // MediaRecorder commonly reports `audio/webm;codecs=opus`. Storage and
      // our allow-list use the media type itself, so discard its parameters.
      const contentType = rawContentType.split(";", 1)[0].trim().toLowerCase();
      const allowedTypes = new Set([
        "image/jpeg",
        "image/png",
        "image/webp",
        "image/heic",
        "audio/webm",
        "audio/ogg",
        "audio/mp4",
      ]);
      if (!Number.isInteger(guestId) || !allowedTypes.has(contentType)) {
        return res.status(400).json({ error: "Arquivo inválido" });
      }
      const guestResponse = await rest(
        `niver_barco_guests?select=id&id=eq.${guestId}`,
      );
      const guests = await readJson(guestResponse);
      if (!guests?.[0])
        return res.status(404).json({ error: "Convidado não encontrado" });
      await ensurePhotoBucket();
      const extension = {
        "image/jpeg": "jpg",
        "image/png": "png",
        "image/webp": "webp",
        "image/heic": "heic",
        "audio/webm": "webm",
        "audio/ogg": "ogg",
        "audio/mp4": "m4a",
      }[contentType];
      const isAvatar = req.body?.purpose === "avatar";
      const isAudio = req.body?.purpose === "audio";
      const objectName = isAvatar
        ? `avatars/${guestId}/${Date.now()}-${crypto.randomUUID()}.${extension}`
        : isAudio ? `audio/${guestId}/${Date.now()}-${crypto.randomUUID()}.${extension}` : `guests/${guestId}/${Date.now()}-${crypto.randomUUID()}.${extension}`;
      const signedResponse = await storage(
        `object/upload/sign/${PHOTO_BUCKET}/${objectName}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({}),
        },
      );
      const signed = await readJson(signedResponse);
      if (!signedResponse.ok)
        return res.status(signedResponse.status).json(signed);
      return res.status(200).json({
        path: objectName,
        publicUrl: publicPhotoUrl(objectName),
        uploadUrl: `${SUPABASE_URL}/storage/v1${signed.url}`,
      });
    }

    if (req.method === "GET" && path === "/invited-guests") {
      const [guestsResponse, markersResponse] = await Promise.all([
        rest("niver_barco_guests?select=*&order=created_at.asc"),
        rest("niver_barco_posts?select=guest_id,content&order=created_at.asc"),
      ]);
      const [guests, markers] = await Promise.all([
        readJson(guestsResponse),
        readJson(markersResponse),
      ]);
      if (!guestsResponse.ok) return res.status(guestsResponse.status).json(guests);
      if (!markersResponse.ok) return res.status(markersResponse.status).json(markers);
      const invitedIds = new Set((markers ?? [])
        .filter((marker) => inviteFromContent(marker.content))
        .map((marker) => marker.guest_id));
      return res.status(200).json((guests ?? [])
        .filter((guest) => invitedIds.has(guest.id))
        .map((guest) => guestResponse(guest)));
    }

    if (req.method === "GET" && path === "/guests") {
      const [response, notesResponse] = await Promise.all([
        rest("niver_barco_guests?select=*&order=created_at.asc"),
        rest(
          "niver_barco_posts?select=guest_id,content,created_at&order=created_at.asc",
        ),
      ]);
      const [guests, posts] = await Promise.all([
        readJson(response),
        readJson(notesResponse),
      ]);
      if (!notesResponse.ok)
        return res.status(notesResponse.status).json(posts);
      const notes = rsvpNotes(posts);
      const hiddenGuestIds = unclaimedInviteGuestIds(posts);
      return res
        .status(response.status)
        .json(
          Array.isArray(guests)
            ? guests
                .filter((guest) => !hiddenGuestIds.has(guest.id))
                .map((guest) => guestResponse(guest, notes))
            : guests,
        );
    }

    // A senha é uma credencial de recuperação, não um atributo público do
    // perfil. Ela permite que alguém criado no navegador entre no mesmo
    // perfil depois de instalar o PWA (ou trocar de aparelho), sem depender
    // do localStorage daquele navegador.
    if (req.method === "POST" && path === "/auth/access") {
      const name =
        typeof req.body?.name === "string"
          ? req.body.name.trim().replace(/\s+/g, " ")
          : "";
      const password = req.body?.password;
      if (!name || name.length > 80)
        return res.status(400).json({ error: "Digite seu nome para entrar." });
      if (!validPassword(password))
        return res
          .status(400)
          .json({ error: "Crie uma senha de pelo menos 4 caracteres." });
      const existingResponse = await rest(
        "niver_barco_guests?select=*&order=created_at.asc",
      );
      const existing = await readJson(existingResponse);
      if (!existingResponse.ok)
        return res.status(existingResponse.status).json(existing);
      const guest = (existing ?? []).find(
        (item) => normalizedName(item.name) === normalizedName(name),
      );
      if (guest) {
        const markersResponse = await rest(
          `niver_barco_posts?select=content&guest_id=eq.${guest.id}`,
        );
        const markers = await readJson(markersResponse);
        if (!markersResponse.ok)
          return res.status(markersResponse.status).json(markers);
        const record = (markers ?? [])
          .map((marker) => passwordFromContent(marker.content))
          .find(Boolean);
        if (!record)
          return res.status(409).json({
            error:
              "Este perfil foi criado antes do acesso com senha. Entre pelo atalho “Entrar como” deste aparelho para não perder o perfil.",
          });
        if (!passwordMatches(password, record))
          return res.status(401).json({ error: "Nome ou senha não conferem." });
        return res.status(200).json(guestResponse(guest));
      }
      const avatarUrl =
        typeof req.body?.avatarUrl === "string" && req.body.avatarUrl
          ? req.body.avatarUrl
          : defaultAvatarUrl(name);
      const createResponse = await rest("niver_barco_guests", {
        method: "POST",
        headers: { Prefer: "return=representation" },
        body: JSON.stringify({
          name,
          avatar_url: avatarUrl,
          rsvp_status: "pending",
        }),
      });
      const created = await readJson(createResponse);
      const createdGuest = created?.[0];
      if (!createResponse.ok || !createdGuest)
        return res.status(createResponse.status).json(created);
      const record = passwordRecord(password);
      const passwordResponse = await rest("niver_barco_posts", {
        method: "POST",
        headers: { Prefer: "return=minimal" },
        body: JSON.stringify({
          guest_id: createdGuest.id,
          content: `[[niver-password]]${JSON.stringify(record)}`,
        }),
      });
      if (!passwordResponse.ok) {
        await rest(`niver_barco_guests?id=eq.${createdGuest.id}`, {
          method: "DELETE",
        });
        return res.status(500).json({
          error:
            "Não foi possível preparar o acesso deste perfil. Tente de novo.",
        });
      }
      return res.status(201).json(guestResponse(createdGuest));
    }

    if (req.method === "POST" && path === "/guests") {
      const name =
        typeof req.body?.name === "string" ? req.body.name.trim() : "";
      if (!name) return res.status(400).json({ error: "Nome é obrigatório" });
      const existingResponse = await rest("niver_barco_guests?select=id,name");
      const existing = await readJson(existingResponse);
      if (!existingResponse.ok)
        return res.status(existingResponse.status).json(existing);
      if (
        (existing ?? []).some(
          (guest) => normalizedName(guest.name) === normalizedName(name),
        )
      )
        return res.status(409).json({
          error:
            "Esse nome já está em uso. Se você já entrou antes, use “Entrar como” para retomar seu perfil.",
        });
      const response = await rest("niver_barco_guests", {
        method: "POST",
        headers: { Prefer: "return=representation" },
        body: JSON.stringify({
          name,
          avatar_url:
            typeof req.body?.avatarUrl === "string" && req.body.avatarUrl
              ? req.body.avatarUrl
              : defaultAvatarUrl(name),
          rsvp_status: req.body?.rsvpStatus ?? "pending",
        }),
      });
      const guests = await readJson(response);
      return res.status(response.status).json(guestResponse(guests[0]));
    }

    const guestMatch = path.match(/^\/guests\/(\d+)(?:\/rsvp)?$/);
    if (guestMatch) {
      const guestId = Number(guestMatch[1]);
      if (req.method === "GET") {
        const [response, notesResponse] = await Promise.all([
          rest(`niver_barco_guests?select=*&id=eq.${guestId}`),
          rest(
            `niver_barco_posts?select=guest_id,content,created_at&guest_id=eq.${guestId}&order=created_at.asc`,
          ),
        ]);
        const [guests, posts] = await Promise.all([
          readJson(response),
          readJson(notesResponse),
        ]);
        if (!notesResponse.ok)
          return res.status(notesResponse.status).json(posts);
        return guests?.[0]
          ? res.status(200).json(guestResponse(guests[0], rsvpNotes(posts)))
          : res.status(404).json({ error: "Guest not found" });
      }
      if (req.method === "PATCH" && path.endsWith("/rsvp")) {
        const allowed = new Set(["going", "maybe", "not_going", "pending"]);
        if (!allowed.has(req.body?.rsvpStatus))
          return res.status(400).json({ error: "Invalid RSVP status" });
        const note =
          typeof req.body?.rsvpNote === "string"
            ? req.body.rsvpNote.trim().slice(0, 220)
            : null;
        const response = await rest(`niver_barco_guests?id=eq.${guestId}`, {
          method: "PATCH",
          headers: { Prefer: "return=representation" },
          body: JSON.stringify({ rsvp_status: req.body.rsvpStatus }),
        });
        const guests = await readJson(response);
        if (!guests?.[0])
          return res.status(404).json({ error: "Guest not found" });
        if (req.body.rsvpStatus === "not_going" && note !== null) {
          const noteResponse = await rest("niver_barco_posts", {
            method: "POST",
            headers: { Prefer: "return=minimal" },
            body: JSON.stringify({
              guest_id: guestId,
              content: `[[niver-rsvp-note]]${note}`,
            }),
          });
          if (!noteResponse.ok)
            return res
              .status(noteResponse.status)
              .json(await readJson(noteResponse));
        }
        return res
          .status(200)
          .json(
            guestResponse(
              guests[0],
              new Map(note !== null ? [[guestId, note]] : []),
            ),
          );
      }
    }

    const profileMatch = path.match(/^\/guests\/(\d+)\/profile$/);
    if (profileMatch && req.method === "PATCH") {
      const guestId = Number(profileMatch[1]);
      const name =
        typeof req.body?.name === "string" ? req.body.name.trim() : "";
      const avatarUrl =
        typeof req.body?.avatarUrl === "string" ? req.body.avatarUrl : null;
      if (!name || name.length > 80)
        return res.status(400).json({ error: "Nome inválido" });
      const namesResponse = await rest("niver_barco_guests?select=id,name");
      const names = await readJson(namesResponse);
      if (!namesResponse.ok)
        return res.status(namesResponse.status).json(names);
      if (
        (names ?? []).some(
          (guest) =>
            guest.id !== guestId &&
            normalizedName(guest.name) === normalizedName(name),
        )
      )
        return res.status(409).json({ error: "Esse nome já está em uso." });
      const response = await rest(`niver_barco_guests?id=eq.${guestId}`, {
        method: "PATCH",
        headers: { Prefer: "return=representation" },
        body: JSON.stringify({ name, avatar_url: avatarUrl }),
      });
      const guests = await readJson(response);
      return guests?.[0]
        ? res.status(200).json(guestResponse(guests[0]))
        : res.status(404).json({ error: "Convidado não encontrado" });
    }

    if (req.method === "GET" && path === "/stats/rsvp-summary") {
      const [response, markersResponse] = await Promise.all([
        rest("niver_barco_guests?select=id,rsvp_status"),
        rest("niver_barco_posts?select=guest_id,content"),
      ]);
      const [guests, markers] = await Promise.all([
        readJson(response),
        readJson(markersResponse),
      ]);
      if (!markersResponse.ok)
        return res.status(markersResponse.status).json(markers);
      const hiddenGuestIds = unclaimedInviteGuestIds(markers);
      const summary = { going: 0, maybe: 0, notGoing: 0, pending: 0 };
      for (const guest of guests.filter(
        (item) => !hiddenGuestIds.has(item.id),
      )) {
        if (guest.rsvp_status === "not_going") summary.notGoing += 1;
        else if (guest.rsvp_status in summary) summary[guest.rsvp_status] += 1;
      }
      return res.status(200).json(summary);
    }

    if (req.method === "GET" && path === "/posts") {
      const [postsResponse, guestsResponse, repliesResponse] =
        await Promise.all([
          rest("niver_barco_posts?select=*&order=created_at.desc"),
          rest("niver_barco_guests?select=*"),
          rest("niver_barco_replies?select=post_id"),
        ]);
      const [posts, guests, replies] = await Promise.all([
        readJson(postsResponse),
        readJson(guestsResponse),
        readJson(repliesResponse),
      ]);
      if (!postsResponse.ok)
        return res.status(postsResponse.status).json(posts);
      return res
        .status(200)
        .json(
          posts
            .filter((post) => !isPrivateMarker(post.content))
            .map((post) => postResponse(post, guests, replies)),
        );
    }

    if (req.method === "POST" && path === "/posts") {
      const guestId = Number(req.body?.guestId);
      const content =
        typeof req.body?.content === "string" ? req.body.content.trim() : "";
      if (!Number.isInteger(guestId) || !content)
        return res.status(400).json({ error: "Dados inválidos" });
      if (
        /^\[\[niver-(admin|invite|payment|payment-settings|payment-reminder-dismissed)\]\]/.test(
          content,
        )
      )
        return res.status(403).json({ error: "Marcador reservado." });
      const response = await rest("niver_barco_posts", {
        method: "POST",
        headers: { Prefer: "return=representation" },
        body: JSON.stringify({ guest_id: guestId, content }),
      });
      const posts = await readJson(response);
      if (!response.ok) return res.status(response.status).json(posts);
      const guestsResponse = await rest(
        `niver_barco_guests?select=*&id=eq.${guestId}`,
      );
      const guests = await readJson(guestsResponse);
      const allGuestsResponse = await rest("niver_barco_guests?select=id,name");
      const allGuests = await readJson(allGuestsResponse);
      const photo = parsePhotoPost(content);
      const audio = parseAudioPost(content);
      const mentionedIds = photo
        ? []
        : mentionedGuestIds(content, allGuests ?? []).filter((id) => id !== guestId);
      const targetIds = (allGuests ?? [])
        .map((guest) => guest.id)
        .filter((id) => id !== guestId && (photo || !mentionedIds.includes(id)));
      const notification = photo
        ? {
            title: "Nova foto a bordo",
            body: `${guests?.[0]?.name ?? "Alguém"} subiu uma foto no convite.`,
            url: "/fotos",
            tag: `photo-${posts[0].id}`,
            preference: "photos",
          }
        : audio ? {
            title: "Novo áudio no mural",
            body: `${guests?.[0]?.name ?? "Alguém"} deixou um áudio.`,
            url: `/forum#post-${posts[0].id}`,
            tag: `audio-${posts[0].id}`,
            preference: "posts",
          } : {
            title: "Nova postagem no mural",
            body: `${guests?.[0]?.name ?? "Alguém"} publicou: ${content.slice(0, 120)}`,
            url: `/forum#post-${posts[0].id}`,
            tag: `post-${posts[0].id}`,
            preference: "posts",
          };
      await createNotifications(targetIds, notification);
      await sendPushToGuests(targetIds, notification);
      if (mentionedIds.length) {
        const mentionNotification = {
          title: "Você foi marcado no mural",
          body: `${guests?.[0]?.name ?? "Alguém"} te marcou: ${content.slice(0, 120)}`,
          url: `/forum#post-${posts[0].id}`,
          tag: `mention-${posts[0].id}`,
          preference: "mentions",
        };
        await createNotifications(mentionedIds, mentionNotification);
        await sendPushToGuests(mentionedIds, mentionNotification);
      }
      return res.status(201).json(postResponse(posts[0], guests, []));
    }

    const repliesMatch = path.match(/^\/posts\/(\d+)\/replies$/);
    if (repliesMatch) {
      const postId = Number(repliesMatch[1]);
      if (req.method === "GET") {
        const [repliesResponse, guestsResponse, markersResponse] =
          await Promise.all([
            rest(
              `niver_barco_replies?select=*&post_id=eq.${postId}&order=created_at.asc`,
            ),
            rest("niver_barco_guests?select=*"),
            rest("niver_barco_posts?select=guest_id,content"),
          ]);
        const [replies, guests, markers] = await Promise.all([
          readJson(repliesResponse),
          readJson(guestsResponse),
          readJson(markersResponse),
        ]);
        if (!repliesResponse.ok)
          return res.status(repliesResponse.status).json(replies);
        const reactionsByReply = new Map();
        for (const marker of markers ?? []) {
          const reaction = replyReactionFromContent(marker.content);
          if (reaction) {
            const bucket = reactionsByReply.get(reaction.replyId) ?? [];
            bucket.push({ emoji: reaction.emoji, guest_id: marker.guest_id });
            reactionsByReply.set(reaction.replyId, bucket);
          }
        }
        return res.status(200).json(
          replies.map((reply) => ({
            ...replyResponse(reply, guests),
            reactions: reactionsByReply.get(reply.id) ?? [],
          })),
        );
      }
      if (req.method === "POST") {
        const guestId = Number(req.body?.guestId);
        const content =
          typeof req.body?.content === "string" ? req.body.content.trim() : "";
        if (!Number.isInteger(guestId) || !content)
          return res.status(400).json({ error: "Dados inválidos" });
        const response = await rest("niver_barco_replies", {
          method: "POST",
          headers: { Prefer: "return=representation" },
          body: JSON.stringify({ post_id: postId, guest_id: guestId, content }),
        });
        const replies = await readJson(response);
        if (!response.ok) return res.status(response.status).json(replies);
        const guestsResponse = await rest(
          `niver_barco_guests?select=*&id=eq.${guestId}`,
        );
        const guests = await readJson(guestsResponse);
        const [postOwnerResponse, allGuestsResponse, existingRepliesResponse] = await Promise.all([
          rest(`niver_barco_posts?select=guest_id&id=eq.${postId}`),
          rest("niver_barco_guests?select=id,name"),
          rest(`niver_barco_replies?select=guest_id&post_id=eq.${postId}`),
        ]);
        const [postOwner, allGuests, existingReplies] = await Promise.all([
          readJson(postOwnerResponse),
          readJson(allGuestsResponse),
          readJson(existingRepliesResponse),
        ]);
        const postOwnerId = postOwner?.[0]?.guest_id;
        const mentionTargetIds = mentionedGuestIds(content, allGuests ?? [])
          .filter((id) => id && id !== guestId && id !== postOwnerId);
        const directTargetIds = postOwnerId && postOwnerId !== guestId
          ? [postOwnerId]
          : [];
        const directNotification = {
          title: "Nova resposta no mural",
          body: `${guests?.[0]?.name ?? "Alguém"} respondeu: ${content.slice(0, 120)}`,
          url: `/forum#post-${postId}`,
          tag: `reply-${replies[0].id}`,
          preference: "replies",
        };
        const watcherIds = [...new Set((existingReplies ?? [])
          .map((reply) => reply.guest_id)
          .filter((id) => id && id !== guestId && !directTargetIds.includes(id) && !mentionTargetIds.includes(id)))];
        const watcherNotification = {
          title: "Conversa atualizada no mural",
          body: `${guests?.[0]?.name ?? "Alguém"} respondeu em uma conversa que você comentou.`,
          url: `/forum#post-${postId}`,
          tag: `thread-${postId}`,
          preference: "threadActivity",
        };
        await createNotifications(directTargetIds, directNotification);
        await sendPushToGuests(directTargetIds, directNotification);
        if (mentionTargetIds.length) {
          const mentionNotification = {
            title: "Você foi marcado no mural",
            body: `${guests?.[0]?.name ?? "Alguém"} te marcou em uma resposta: ${content.slice(0, 120)}`,
            url: `/forum#post-${postId}`,
            tag: `mention-reply-${replies[0].id}`,
            preference: "mentions",
          };
          await createNotifications(mentionTargetIds, mentionNotification);
          await sendPushToGuests(mentionTargetIds, mentionNotification);
        }
        await createNotifications(watcherIds, watcherNotification);
        await sendPushToGuests(watcherIds, watcherNotification);
        return res.status(201).json(replyResponse(replies[0], guests));
      }
    }

    const replyReactionsMatch = path.match(/^\/replies\/(\d+)\/reactions$/);
    if (replyReactionsMatch) {
      const replyId = Number(replyReactionsMatch[1]);
      const allowed = new Set(["heart", "thumb", "fire", "boat"]);
      if (req.method === "GET") {
        const response = await rest(
          "niver_barco_posts?select=guest_id,content",
        );
        const markers = await readJson(response);
        if (!response.ok) return res.status(response.status).json(markers);
        return res.status(200).json(
          (markers ?? []).flatMap((marker) => {
            const reaction = replyReactionFromContent(marker.content);
            return reaction?.replyId === replyId
              ? [{ emoji: reaction.emoji, guest_id: marker.guest_id }]
              : [];
          }),
        );
      }
      const guestId = Number(req.body?.guestId);
      const emoji = req.body?.emoji;
      if (!Number.isInteger(guestId) || !allowed.has(emoji))
        return res.status(400).json({ error: "Reação inválida" });
      const content = `[[niver-reply-reaction:${replyId}:${emoji}]]`;
      if (req.method === "POST") {
        const response = await rest("niver_barco_posts", {
          method: "POST",
          headers: { Prefer: "return=minimal" },
          body: JSON.stringify({ guest_id: guestId, content }),
        });
        return res
          .status(response.status)
          .json(response.ok ? { ok: true } : await readJson(response));
      }
      if (req.method === "DELETE") {
        const response = await rest(
          `niver_barco_posts?guest_id=eq.${guestId}&content=eq.${encodeURIComponent(content)}`,
          { method: "DELETE" },
        );
        return response.ok
          ? res.status(204).end()
          : res.status(response.status).json(await readJson(response));
      }
    }

    const reactionsMatch = path.match(/^\/posts\/(\d+)\/reactions$/);
    if (reactionsMatch) {
      const postId = Number(reactionsMatch[1]);
      if (req.method === "GET") {
        const response = await rest(
          `niver_barco_reactions?select=emoji,guest_id&post_id=eq.${postId}`,
        );
        const reactions = await readJson(response);
        if (!response.ok) return res.status(response.status).json(reactions);
        const summary = Object.fromEntries(
          ["heart", "thumb", "fire", "boat"].map((emoji) => [
            emoji,
            { count: 0, reacted: false },
          ]),
        );
        for (const reaction of reactions) summary[reaction.emoji].count += 1;
        return res.status(200).json({ reactions, summary });
      }
      const guestId = Number(req.body?.guestId);
      const emoji = req.body?.emoji;
      const allowed = new Set(["heart", "thumb", "fire", "boat"]);
      if (!Number.isInteger(guestId) || !allowed.has(emoji))
        return res.status(400).json({ error: "Reação inválida" });
      if (req.method === "POST") {
        const response = await rest("niver_barco_reactions", {
          method: "POST",
          headers: { Prefer: "return=representation" },
          body: JSON.stringify({ post_id: postId, guest_id: guestId, emoji }),
        });
        const data = await readJson(response);
        return res.status(response.status).json(data);
      }
      if (req.method === "DELETE") {
        const response = await rest(
          `niver_barco_reactions?post_id=eq.${postId}&guest_id=eq.${guestId}&emoji=eq.${emoji}`,
          { method: "DELETE" },
        );
        if (!response.ok)
          return res.status(response.status).json(await readJson(response));
        return res.status(204).end();
      }
    }

    return res.status(404).json({ error: "Not found" });
  } catch (error) {
    console.error("API error", error);
    return res.status(500).json({ error: "Internal server error" });
  }
}
