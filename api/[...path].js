import webpush from 'web-push';
import { createHash, randomBytes } from 'node:crypto';

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const VAPID_PUBLIC_KEY = process.env.VAPID_PUBLIC_KEY;
const VAPID_PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY;
const ADMIN_PASSWORD = process.env.NIVER_ADMIN_PASSWORD;
const PHOTO_BUCKET = 'niver-barco-fotos';

function rest(path, options = {}) {
  return fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    ...options,
    headers: {
      apikey: SUPABASE_SERVICE_ROLE_KEY,
      Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
      'Content-Type': 'application/json',
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
  const response = await storage('bucket', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      id: PHOTO_BUCKET,
      name: PHOTO_BUCKET,
      public: true,
      file_size_limit: 8 * 1024 * 1024,
      allowed_mime_types: ['image/jpeg', 'image/png', 'image/webp', 'image/heic'],
    }),
  });
  // Storage returns 400 when the bucket was already created. Both states are fine.
  if (!response.ok && response.status !== 400 && response.status !== 409) {
    throw new Error(`Photo bucket setup failed: ${response.status}`);
  }
}

function publicPhotoUrl(objectName) {
  return `${SUPABASE_URL}/storage/v1/object/public/${PHOTO_BUCKET}/${objectName.split('/').map(encodeURIComponent).join('/')}`;
}

function parsePhotoPost(content) {
  const match = typeof content === 'string' && content.match(/^\[\[niver-photo:([^|\]]+)(?:\|([^\]]+))?\]\]([\s\S]*)$/);
  if (!match) return null;
  // The original marker had no source and was only ever created by the mural.
  return { url: match[1], source: match[2] === 'album' ? 'album' : 'mural', caption: match[3].trim() };
}

async function readJson(response) {
  const text = await response.text();
  return text ? JSON.parse(text) : null;
}

function noteFromContent(content) {
  const match = typeof content === 'string' && content.match(/^\[\[niver-rsvp-note\]\]([\s\S]*)$/);
  return match ? match[1].trim() : null;
}

function replyReactionFromContent(content) {
  const match = typeof content === 'string' && content.match(/^\[\[niver-reply-reaction:(\d+):(heart|fire|boat|party)\]\]$/);
  return match ? { replyId: Number(match[1]), emoji: match[2] } : null;
}

function pushSubscriptionFromContent(content) {
  const match = typeof content === 'string' && content.match(/^\[\[niver-push-subscription\]\](.+)$/s);
  if (!match) return null;
  try { return JSON.parse(match[1]); } catch { return null; }
}

function notificationFromContent(content) {
  const match = typeof content === 'string' && content.match(/^\[\[niver-notification\]\](.+)$/s);
  if (!match) return null;
  try {
    const notification = JSON.parse(match[1]);
    if (!notification?.title || !notification?.body) return null;
    return {
      title: String(notification.title), body: String(notification.body),
      url: typeof notification.url === 'string' && notification.url.startsWith('/') ? notification.url : '/evento',
      readAt: typeof notification.readAt === 'string' ? notification.readAt : null,
    };
  } catch { return null; }
}

function inviteFromContent(content) {
  const match = typeof content === 'string' && content.match(/^\[\[niver-invite\]\](.+)$/s);
  if (!match) return null;
  try {
    const invite = JSON.parse(match[1]);
    if (!invite?.tokenHash || !invite?.slug) return null;
    return {
      tokenHash: String(invite.tokenHash),
      slug: String(invite.slug),
      createdAt: typeof invite.createdAt === 'string' ? invite.createdAt : null,
      claimedAt: typeof invite.claimedAt === 'string' ? invite.claimedAt : null,
    };
  } catch { return null; }
}

function tokenHash(token) {
  return createHash('sha256').update(token).digest('hex');
}

function inviteSlug(name) {
  const result = normalizedName(name)
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')
    .slice(0, 42);
  return result || 'convidado';
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
  return noteFromContent(content) !== null || replyReactionFromContent(content) !== null || pushSubscriptionFromContent(content) !== null || notificationFromContent(content) !== null || inviteFromContent(content) !== null;
}

function admin(req) {
  return Boolean(ADMIN_PASSWORD) && req.headers.authorization === `Bearer ${ADMIN_PASSWORD}`;
}

async function pushSubscriptions() {
  const response = await rest('niver_barco_posts?select=id,guest_id,content');
  const records = await readJson(response);
  if (!response.ok) throw new Error(`Push subscriptions read failed: ${response.status}`);
  return (records ?? []).flatMap((record) => {
    const subscription = pushSubscriptionFromContent(record.content);
    return subscription?.endpoint ? [{ ...subscription, markerId: record.id, guestId: record.guest_id }] : [];
  });
}

async function sendPushToGuests(guestIds, payload) {
  if (!VAPID_PUBLIC_KEY || !VAPID_PRIVATE_KEY || !guestIds?.length) return { sent: 0, failed: 0 };
  webpush.setVapidDetails('mailto:renker@niver-barco.app', VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);
  const targetIds = new Set(guestIds);
  const subscriptions = (await pushSubscriptions()).filter((item) => targetIds.has(item.guestId));
  const result = { sent: 0, failed: 0 };
  await Promise.all(subscriptions.map(async (item) => {
    try {
      await webpush.sendNotification(item.subscription, JSON.stringify(payload)); result.sent += 1;
    } catch (error) {
      result.failed += 1;
      if (error?.statusCode === 404 || error?.statusCode === 410) await rest(`niver_barco_posts?id=eq.${item.markerId}`, { method: 'DELETE' });
    }
  }));
  return result;
}

async function createNotifications(guestIds, payload) {
  const uniqueGuestIds = [...new Set((guestIds ?? []).filter(Number.isInteger))];
  if (!uniqueGuestIds.length) return 0;
  const content = JSON.stringify({
    title: String(payload.title).slice(0, 80),
    body: String(payload.body).slice(0, 240),
    url: typeof payload.url === 'string' && payload.url.startsWith('/') ? payload.url : '/evento',
    readAt: null,
  });
  const response = await rest('niver_barco_posts', {
    method: 'POST', headers: { Prefer: 'return=minimal' },
    body: JSON.stringify(uniqueGuestIds.map((guest_id) => ({ guest_id, content: `[[niver-notification]]${content}` }))),
  });
  if (!response.ok) throw new Error(`Notification save failed: ${response.status}`);
  return uniqueGuestIds.length;
}

function mentionedGuestIds(content, guests) {
  const lower = content.toLocaleLowerCase('pt-BR');
  return guests.filter((guest) => lower.includes(`@${guest.name.toLocaleLowerCase('pt-BR')}`)).map((guest) => guest.id);
}

function normalizedName(name) {
  return name.normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().replace(/\s+/g, ' ').toLowerCase();
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
    guestName: guest?.name ?? 'Convidado',
    guestAvatarUrl: guest?.avatar_url ?? null,
    rsvpStatus: guest?.rsvp_status ?? 'pending',
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
    guestName: guest?.name ?? 'Convidado',
    guestAvatarUrl: guest?.avatar_url ?? null,
    content: reply.content,
    createdAt: reply.created_at,
  };
}

export default async function handler(req, res) {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    return res.status(500).json({ error: 'Database configuration is missing' });
  }

  const path = new URL(req.url, 'https://app.local').pathname.replace(/^\/api/, '') || '/';

  try {
    if (req.method === 'GET' && path === '/healthz') {
      return res.status(200).json({ ok: true });
    }

    if (req.method === 'GET' && path === '/push/config') {
      return res.status(200).json({ supported: Boolean(VAPID_PUBLIC_KEY), publicKey: VAPID_PUBLIC_KEY ?? null });
    }

    if (req.method === 'POST' && path === '/push/subscriptions') {
      const guestId = Number(req.body?.guestId);
      const subscription = req.body?.subscription;
      if (!Number.isInteger(guestId) || !subscription?.endpoint || !subscription?.keys?.p256dh || !subscription?.keys?.auth) return res.status(400).json({ error: 'Inscrição de push inválida.' });
      const old = await rest('niver_barco_posts?select=id,content'); const markers = await readJson(old);
      for (const marker of markers ?? []) { const item = pushSubscriptionFromContent(marker.content); if (item?.endpoint === subscription.endpoint) await rest(`niver_barco_posts?id=eq.${marker.id}`, { method: 'DELETE' }); }
      const response = await rest('niver_barco_posts', { method: 'POST', headers: { Prefer: 'return=minimal' }, body: JSON.stringify({ guest_id: guestId, content: `[[niver-push-subscription]]${JSON.stringify({ subscription, preferences: req.body?.preferences ?? { replies: true, mentions: true, photos: true } })}` }) });
      return response.ok ? res.status(201).json({ ok: true }) : res.status(response.status).json(await readJson(response));
    }

    if (req.method === 'GET' && path === '/notifications') {
      const guestId = Number(new URL(req.url, 'https://app.local').searchParams.get('guestId'));
      if (!Number.isInteger(guestId)) return res.status(400).json({ error: 'Convidado inválido.' });
      const response = await rest(`niver_barco_posts?select=id,guest_id,content,created_at&guest_id=eq.${guestId}&order=created_at.desc`);
      const records = await readJson(response);
      if (!response.ok) return res.status(response.status).json(records);
      const notifications = (records ?? []).flatMap((record) => {
        const notification = notificationFromContent(record.content);
        return notification ? [{ id: record.id, ...notification, createdAt: record.created_at }] : [];
      }).slice(0, 40);
      return res.status(200).json({ notifications, unreadCount: notifications.filter((item) => !item.readAt).length });
    }

    const notificationReadMatch = path.match(/^\/notifications\/(\d+)\/read$/);
    if (notificationReadMatch && req.method === 'PATCH') {
      const notificationId = Number(notificationReadMatch[1]);
      const guestId = Number(req.body?.guestId);
      if (!Number.isInteger(notificationId) || !Number.isInteger(guestId)) return res.status(400).json({ error: 'Notificação inválida.' });
      const currentResponse = await rest(`niver_barco_posts?select=id,content&id=eq.${notificationId}&guest_id=eq.${guestId}`);
      const records = await readJson(currentResponse);
      const current = records?.[0]; const notification = notificationFromContent(current?.content);
      if (!currentResponse.ok) return res.status(currentResponse.status).json(records);
      if (!notification) return res.status(404).json({ error: 'Notificação não encontrada.' });
      if (notification.readAt) return res.status(200).json({ ok: true, readAt: notification.readAt });
      const readAt = new Date().toISOString();
      const content = `[[niver-notification]]${JSON.stringify({ ...notification, readAt })}`;
      const response = await rest(`niver_barco_posts?id=eq.${notificationId}&guest_id=eq.${guestId}`, { method: 'PATCH', headers: { Prefer: 'return=minimal' }, body: JSON.stringify({ content }) });
      return response.ok ? res.status(200).json({ ok: true, readAt }) : res.status(response.status).json(await readJson(response));
    }

    if (path === '/admin/notify') {
      if (!admin(req)) return res.status(401).json({ error: 'Área administrativa protegida.' });
      if (req.method !== 'POST') return res.status(405).end();
      const title = typeof req.body?.title === 'string' ? req.body.title.trim().slice(0, 80) : '';
      const body = typeof req.body?.body === 'string' ? req.body.body.trim().slice(0, 240) : '';
      const url = typeof req.body?.url === 'string' && req.body.url.startsWith('/') ? req.body.url : '/evento';
      if (!title || !body) return res.status(400).json({ error: 'Título e mensagem são obrigatórios.' });
      const guestsResponse = await rest('niver_barco_guests?select=id');
      const guests = await readJson(guestsResponse);
      if (!guestsResponse.ok) return res.status(guestsResponse.status).json(guests);
      const guestIds = (guests ?? []).map((guest) => guest.id);
      const saved = await createNotifications(guestIds, { title, body, url });
      const records = await pushSubscriptions();
      const outcome = await sendPushToGuests([...new Set(records.map((item) => item.guestId))], { title, body, url, tag: `admin-${Date.now()}` });
      return res.status(200).json({ ...outcome, saved, subscribedDevices: records.length });
    }

    if (path === '/admin/invites') {
      if (!admin(req)) return res.status(401).json({ error: 'Área administrativa protegida.' });
      if (req.method === 'GET') {
        const [guestsResponse, markersResponse] = await Promise.all([
          rest('niver_barco_guests?select=id,name,created_at,rsvp_status&order=created_at.desc'),
          rest('niver_barco_posts?select=id,guest_id,content&order=created_at.desc'),
        ]);
        const [guests, markers] = await Promise.all([readJson(guestsResponse), readJson(markersResponse)]);
        if (!guestsResponse.ok) return res.status(guestsResponse.status).json(guests);
        if (!markersResponse.ok) return res.status(markersResponse.status).json(markers);
        const byGuest = new Map((guests ?? []).map((guest) => [guest.id, guest]));
        const invites = (markers ?? []).flatMap((marker) => {
          const invite = inviteFromContent(marker.content); const guest = byGuest.get(marker.guest_id);
          return invite && guest ? [{ id: marker.id, guestId: guest.id, name: guest.name, slug: invite.slug, createdAt: invite.createdAt, claimedAt: invite.claimedAt, rsvpStatus: guest.rsvp_status }] : [];
        });
        return res.status(200).json(invites);
      }
      if (req.method === 'POST') {
        const name = typeof req.body?.name === 'string' ? req.body.name.trim().replace(/\s+/g, ' ') : '';
        if (!name || name.length > 80) return res.status(400).json({ error: 'Nome inválido.' });
        const namesResponse = await rest('niver_barco_guests?select=id,name'); const names = await readJson(namesResponse);
        if (!namesResponse.ok) return res.status(namesResponse.status).json(names);
        if ((names ?? []).some((guest) => normalizedName(guest.name) === normalizedName(name))) return res.status(409).json({ error: 'Esse nome já está reservado ou em uso.' });
        const guestResponse = await rest('niver_barco_guests', { method: 'POST', headers: { Prefer: 'return=representation' }, body: JSON.stringify({ name, rsvp_status: 'pending' }) });
        const createdGuests = await readJson(guestResponse); const guest = createdGuests?.[0];
        if (!guestResponse.ok || !guest) return res.status(guestResponse.status).json(createdGuests);
        const token = `${inviteSlug(name)}-${randomBytes(24).toString('base64url')}`;
        const invite = { tokenHash: tokenHash(token), slug: inviteSlug(name), createdAt: new Date().toISOString(), claimedAt: null };
        const markerResponse = await rest('niver_barco_posts', { method: 'POST', headers: { Prefer: 'return=representation' }, body: JSON.stringify({ guest_id: guest.id, content: `[[niver-invite]]${JSON.stringify(invite)}` }) });
        const markers = await readJson(markerResponse);
        if (!markerResponse.ok) {
          await rest(`niver_barco_guests?id=eq.${guest.id}`, { method: 'DELETE' });
          return res.status(markerResponse.status).json(markers);
        }
        const origin = req.headers.origin || 'https://niver-barco.vercel.app';
        return res.status(201).json({ id: markers?.[0]?.id, guestId: guest.id, name: guest.name, slug: invite.slug, url: `${origin}/i/${token}`, createdAt: invite.createdAt, claimedAt: null });
      }
      return res.status(405).end();
    }

    const inviteMatch = path.match(/^\/invites\/([^/]+)$/);
    if (inviteMatch && req.method === 'GET') {
      const token = decodeURIComponent(inviteMatch[1]);
      if (token.length < 36) return res.status(404).json({ error: 'Convite não encontrado.' });
      const markersResponse = await rest('niver_barco_posts?select=id,guest_id,content'); const markers = await readJson(markersResponse);
      if (!markersResponse.ok) return res.status(markersResponse.status).json(markers);
      const marker = (markers ?? []).find((item) => inviteFromContent(item.content)?.tokenHash === tokenHash(token));
      const invite = marker && inviteFromContent(marker.content);
      if (!marker || !invite) return res.status(404).json({ error: 'Convite não encontrado.' });
      const invitedGuestResponse = await rest(`niver_barco_guests?select=*&id=eq.${marker.guest_id}`); const guests = await readJson(invitedGuestResponse);
      if (!invitedGuestResponse.ok || !guests?.[0]) return res.status(404).json({ error: 'Convidado não encontrado.' });
      if (!invite.claimedAt) {
        const claimedAt = new Date().toISOString();
        const content = `[[niver-invite]]${JSON.stringify({ ...invite, claimedAt })}`;
        const claimResponse = await rest(`niver_barco_posts?id=eq.${marker.id}`, { method: 'PATCH', headers: { Prefer: 'return=minimal' }, body: JSON.stringify({ content }) });
        if (!claimResponse.ok) return res.status(claimResponse.status).json(await readJson(claimResponse));
      }
      return res.status(200).json(guestResponse(guests[0]));
    }

    if (req.method === 'GET' && path === '/photos') {
      await ensurePhotoBucket();
      const guestsResponse = await rest('niver_barco_guests?select=id,name,avatar_url');
      const guests = await readJson(guestsResponse);
      if (!guestsResponse.ok) return res.status(guestsResponse.status).json(guests);
      const postsResponse = await rest('niver_barco_posts?select=id,content');
      const posts = await readJson(postsResponse);
      if (!postsResponse.ok) return res.status(postsResponse.status).json(posts);
      const photoPosts = new Map((posts ?? []).flatMap((post) => {
        const photo = parsePhotoPost(post.content);
        return photo ? [[photo.url, { ...photo, postId: post.id }]] : [];
      }));
      const objectResponses = await Promise.all((guests ?? []).map(async (guest) => {
        const response = await storage(`object/list/${PHOTO_BUCKET}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ prefix: `guests/${guest.id}/`, limit: 100, offset: 0, sortBy: { column: 'created_at', order: 'desc' } }),
        });
        return { guestId: guest.id, response, objects: await readJson(response) };
      }));
      const failed = objectResponses.find(({ response }) => !response.ok);
      if (failed) return res.status(failed.response.status).json(failed.objects);
      const guestById = new Map((guests ?? []).map((guest) => [guest.id, guest]));
      const photos = objectResponses.flatMap(({ guestId, objects }) => (objects ?? []).map((object) => ({
        ...object,
        name: object.name?.startsWith('guests/') ? object.name : `guests/${guestId}/${object.name}`,
      })))
        .filter((object) => object.name && !object.id?.endsWith('/'))
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
            guestName: guest?.name ?? 'Tripulação',
            guestAvatarUrl: guest?.avatar_url ?? null,
            source: post?.source ?? 'album',
            postId: post?.postId ?? null,
            caption: post?.caption ?? '',
          };
        });
      return res.status(200).json(photos);
    }

    if (req.method === 'POST' && path === '/photos/upload-url') {
      const guestId = Number(req.body?.guestId);
      const contentType = typeof req.body?.contentType === 'string' ? req.body.contentType : '';
      const allowedTypes = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/heic']);
      if (!Number.isInteger(guestId) || !allowedTypes.has(contentType)) {
        return res.status(400).json({ error: 'Imagem inválida' });
      }
      const guestResponse = await rest(`niver_barco_guests?select=id&id=eq.${guestId}`);
      const guests = await readJson(guestResponse);
      if (!guests?.[0]) return res.status(404).json({ error: 'Convidado não encontrado' });
      await ensurePhotoBucket();
      const extension = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp', 'image/heic': 'heic' }[contentType];
      const isAvatar = req.body?.purpose === 'avatar';
      const objectName = isAvatar
        ? `avatars/${guestId}/${Date.now()}-${crypto.randomUUID()}.${extension}`
        : `guests/${guestId}/${Date.now()}-${crypto.randomUUID()}.${extension}`;
      const signedResponse = await storage(`object/upload/sign/${PHOTO_BUCKET}/${objectName}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });
      const signed = await readJson(signedResponse);
      if (!signedResponse.ok) return res.status(signedResponse.status).json(signed);
      return res.status(200).json({
        path: objectName,
        publicUrl: publicPhotoUrl(objectName),
        uploadUrl: `${SUPABASE_URL}/storage/v1${signed.url}`,
      });
    }

    if (req.method === 'GET' && path === '/guests') {
      const [response, notesResponse] = await Promise.all([rest('niver_barco_guests?select=*&order=created_at.asc'), rest('niver_barco_posts?select=guest_id,content,created_at&order=created_at.asc')]);
      const [guests, posts] = await Promise.all([readJson(response), readJson(notesResponse)]);
      if (!notesResponse.ok) return res.status(notesResponse.status).json(posts);
      const notes = rsvpNotes(posts); const hiddenGuestIds = unclaimedInviteGuestIds(posts);
      return res.status(response.status).json(Array.isArray(guests) ? guests.filter((guest) => !hiddenGuestIds.has(guest.id)).map((guest) => guestResponse(guest, notes)) : guests);
    }

    if (req.method === 'POST' && path === '/guests') {
      const name = typeof req.body?.name === 'string' ? req.body.name.trim() : '';
      if (!name) return res.status(400).json({ error: 'Nome é obrigatório' });
      const existingResponse = await rest('niver_barco_guests?select=id,name');
      const existing = await readJson(existingResponse);
      if (!existingResponse.ok) return res.status(existingResponse.status).json(existing);
      if ((existing ?? []).some((guest) => normalizedName(guest.name) === normalizedName(name))) return res.status(409).json({ error: 'Esse nome já está em uso. Se você já entrou antes, use “Entrar como” para retomar seu perfil.' });
      const response = await rest('niver_barco_guests', {
        method: 'POST',
        headers: { Prefer: 'return=representation' },
        body: JSON.stringify({ name, avatar_url: typeof req.body?.avatarUrl === 'string' ? req.body.avatarUrl : null, rsvp_status: req.body?.rsvpStatus ?? 'pending' }),
      });
      const guests = await readJson(response);
      return res.status(response.status).json(guestResponse(guests[0]));
    }

    const guestMatch = path.match(/^\/guests\/(\d+)(?:\/rsvp)?$/);
    if (guestMatch) {
      const guestId = Number(guestMatch[1]);
      if (req.method === 'GET') {
        const [response, notesResponse] = await Promise.all([rest(`niver_barco_guests?select=*&id=eq.${guestId}`), rest(`niver_barco_posts?select=guest_id,content,created_at&guest_id=eq.${guestId}&order=created_at.asc`)]);
        const [guests, posts] = await Promise.all([readJson(response), readJson(notesResponse)]);
        if (!notesResponse.ok) return res.status(notesResponse.status).json(posts);
        return guests?.[0] ? res.status(200).json(guestResponse(guests[0], rsvpNotes(posts))) : res.status(404).json({ error: 'Guest not found' });
      }
      if (req.method === 'PATCH' && path.endsWith('/rsvp')) {
        const allowed = new Set(['going', 'maybe', 'not_going', 'pending']);
        if (!allowed.has(req.body?.rsvpStatus)) return res.status(400).json({ error: 'Invalid RSVP status' });
        const note = typeof req.body?.rsvpNote === 'string' ? req.body.rsvpNote.trim().slice(0, 220) : null;
        const response = await rest(`niver_barco_guests?id=eq.${guestId}`, {
          method: 'PATCH',
          headers: { Prefer: 'return=representation' },
          body: JSON.stringify({ rsvp_status: req.body.rsvpStatus }),
        });
        const guests = await readJson(response);
        if (!guests?.[0]) return res.status(404).json({ error: 'Guest not found' });
        if (req.body.rsvpStatus === 'not_going' && note !== null) {
          const noteResponse = await rest('niver_barco_posts', { method: 'POST', headers: { Prefer: 'return=minimal' }, body: JSON.stringify({ guest_id: guestId, content: `[[niver-rsvp-note]]${note}` }) });
          if (!noteResponse.ok) return res.status(noteResponse.status).json(await readJson(noteResponse));
        }
        return res.status(200).json(guestResponse(guests[0], new Map(note !== null ? [[guestId, note]] : [])));
      }
    }

    const profileMatch = path.match(/^\/guests\/(\d+)\/profile$/);
    if (profileMatch && req.method === 'PATCH') {
      const guestId = Number(profileMatch[1]);
      const name = typeof req.body?.name === 'string' ? req.body.name.trim() : '';
      const avatarUrl = typeof req.body?.avatarUrl === 'string' ? req.body.avatarUrl : null;
      if (!name || name.length > 80) return res.status(400).json({ error: 'Nome inválido' });
      const namesResponse = await rest('niver_barco_guests?select=id,name');
      const names = await readJson(namesResponse);
      if (!namesResponse.ok) return res.status(namesResponse.status).json(names);
      if ((names ?? []).some((guest) => guest.id !== guestId && normalizedName(guest.name) === normalizedName(name))) return res.status(409).json({ error: 'Esse nome já está em uso.' });
      const response = await rest(`niver_barco_guests?id=eq.${guestId}`, {
        method: 'PATCH', headers: { Prefer: 'return=representation' }, body: JSON.stringify({ name, avatar_url: avatarUrl }),
      });
      const guests = await readJson(response);
      return guests?.[0] ? res.status(200).json(guestResponse(guests[0])) : res.status(404).json({ error: 'Convidado não encontrado' });
    }

    if (req.method === 'GET' && path === '/stats/rsvp-summary') {
      const [response, markersResponse] = await Promise.all([rest('niver_barco_guests?select=id,rsvp_status'), rest('niver_barco_posts?select=guest_id,content')]);
      const [guests, markers] = await Promise.all([readJson(response), readJson(markersResponse)]);
      if (!markersResponse.ok) return res.status(markersResponse.status).json(markers);
      const hiddenGuestIds = unclaimedInviteGuestIds(markers);
      const summary = { going: 0, maybe: 0, notGoing: 0, pending: 0 };
      for (const guest of guests.filter((item) => !hiddenGuestIds.has(item.id))) {
        if (guest.rsvp_status === 'not_going') summary.notGoing += 1;
        else if (guest.rsvp_status in summary) summary[guest.rsvp_status] += 1;
      }
      return res.status(200).json(summary);
    }

    if (req.method === 'GET' && path === '/posts') {
      const [postsResponse, guestsResponse, repliesResponse] = await Promise.all([
        rest('niver_barco_posts?select=*&order=created_at.desc'),
        rest('niver_barco_guests?select=*'),
        rest('niver_barco_replies?select=post_id'),
      ]);
      const [posts, guests, replies] = await Promise.all([
        readJson(postsResponse),
        readJson(guestsResponse),
        readJson(repliesResponse),
      ]);
      if (!postsResponse.ok) return res.status(postsResponse.status).json(posts);
      return res.status(200).json(posts.filter((post) => !isPrivateMarker(post.content)).map((post) => postResponse(post, guests, replies)));
    }

    if (req.method === 'POST' && path === '/posts') {
      const guestId = Number(req.body?.guestId);
      const content = typeof req.body?.content === 'string' ? req.body.content.trim() : '';
      if (!Number.isInteger(guestId) || !content) return res.status(400).json({ error: 'Dados inválidos' });
      const response = await rest('niver_barco_posts', {
        method: 'POST',
        headers: { Prefer: 'return=representation' },
        body: JSON.stringify({ guest_id: guestId, content }),
      });
      const posts = await readJson(response);
      if (!response.ok) return res.status(response.status).json(posts);
      const guestsResponse = await rest(`niver_barco_guests?select=*&id=eq.${guestId}`);
      const guests = await readJson(guestsResponse);
      const allGuestsResponse = await rest('niver_barco_guests?select=id,name');
      const allGuests = await readJson(allGuestsResponse);
      const photo = parsePhotoPost(content);
      const targetIds = photo ? (allGuests ?? []).filter((guest) => guest.id !== guestId).map((guest) => guest.id) : mentionedGuestIds(content, allGuests ?? []).filter((id) => id !== guestId);
      const notification = photo
        ? { title: 'Nova foto a bordo', body: `${guests?.[0]?.name ?? 'Alguém'} subiu uma foto no convite.`, url: '/fotos', tag: `photo-${posts[0].id}` }
        : { title: 'Você foi marcado no mural', body: `${guests?.[0]?.name ?? 'Alguém'} te marcou: ${content.slice(0, 120)}`, url: `/forum#post-${posts[0].id}`, tag: `mention-${posts[0].id}` };
      await createNotifications(targetIds, notification);
      await sendPushToGuests(targetIds, notification);
      return res.status(201).json(postResponse(posts[0], guests, []));
    }

    const repliesMatch = path.match(/^\/posts\/(\d+)\/replies$/);
    if (repliesMatch) {
      const postId = Number(repliesMatch[1]);
      if (req.method === 'GET') {
        const [repliesResponse, guestsResponse, markersResponse] = await Promise.all([
          rest(`niver_barco_replies?select=*&post_id=eq.${postId}&order=created_at.asc`),
          rest('niver_barco_guests?select=*'),
          rest('niver_barco_posts?select=guest_id,content'),
        ]);
        const [replies, guests, markers] = await Promise.all([readJson(repliesResponse), readJson(guestsResponse), readJson(markersResponse)]);
        if (!repliesResponse.ok) return res.status(repliesResponse.status).json(replies);
        const reactionsByReply = new Map();
        for (const marker of markers ?? []) { const reaction = replyReactionFromContent(marker.content); if (reaction) { const bucket = reactionsByReply.get(reaction.replyId) ?? []; bucket.push({ emoji: reaction.emoji, guest_id: marker.guest_id }); reactionsByReply.set(reaction.replyId, bucket); } }
        return res.status(200).json(replies.map((reply) => ({ ...replyResponse(reply, guests), reactions: reactionsByReply.get(reply.id) ?? [] })));
      }
      if (req.method === 'POST') {
        const guestId = Number(req.body?.guestId);
        const content = typeof req.body?.content === 'string' ? req.body.content.trim() : '';
        if (!Number.isInteger(guestId) || !content) return res.status(400).json({ error: 'Dados inválidos' });
        const response = await rest('niver_barco_replies', {
          method: 'POST',
          headers: { Prefer: 'return=representation' },
          body: JSON.stringify({ post_id: postId, guest_id: guestId, content }),
        });
        const replies = await readJson(response);
        if (!response.ok) return res.status(response.status).json(replies);
        const guestsResponse = await rest(`niver_barco_guests?select=*&id=eq.${guestId}`);
        const guests = await readJson(guestsResponse);
        const [postOwnerResponse, allGuestsResponse] = await Promise.all([rest(`niver_barco_posts?select=guest_id&id=eq.${postId}`), rest('niver_barco_guests?select=id,name')]);
        const [postOwner, allGuests] = await Promise.all([readJson(postOwnerResponse), readJson(allGuestsResponse)]);
        const targetIds = [...new Set([postOwner?.[0]?.guest_id, ...mentionedGuestIds(content, allGuests ?? [])])].filter((id) => id && id !== guestId);
        const notification = { title: 'Nova resposta no mural', body: `${guests?.[0]?.name ?? 'Alguém'} respondeu: ${content.slice(0, 120)}`, url: `/forum#post-${postId}`, tag: `reply-${replies[0].id}` };
        await createNotifications(targetIds, notification);
        await sendPushToGuests(targetIds, notification);
        return res.status(201).json(replyResponse(replies[0], guests));
      }
    }

    const replyReactionsMatch = path.match(/^\/replies\/(\d+)\/reactions$/);
    if (replyReactionsMatch) {
      const replyId = Number(replyReactionsMatch[1]);
      const allowed = new Set(['heart', 'fire', 'boat', 'party']);
      if (req.method === 'GET') {
        const response = await rest('niver_barco_posts?select=guest_id,content'); const markers = await readJson(response);
        if (!response.ok) return res.status(response.status).json(markers);
        return res.status(200).json((markers ?? []).flatMap((marker) => { const reaction = replyReactionFromContent(marker.content); return reaction?.replyId === replyId ? [{ emoji: reaction.emoji, guest_id: marker.guest_id }] : []; }));
      }
      const guestId = Number(req.body?.guestId); const emoji = req.body?.emoji;
      if (!Number.isInteger(guestId) || !allowed.has(emoji)) return res.status(400).json({ error: 'Reação inválida' });
      const content = `[[niver-reply-reaction:${replyId}:${emoji}]]`;
      if (req.method === 'POST') { const response = await rest('niver_barco_posts', { method: 'POST', headers: { Prefer: 'return=minimal' }, body: JSON.stringify({ guest_id: guestId, content }) }); return res.status(response.status).json(response.ok ? { ok: true } : await readJson(response)); }
      if (req.method === 'DELETE') { const response = await rest(`niver_barco_posts?guest_id=eq.${guestId}&content=eq.${encodeURIComponent(content)}`, { method: 'DELETE' }); return response.ok ? res.status(204).end() : res.status(response.status).json(await readJson(response)); }
    }

    const reactionsMatch = path.match(/^\/posts\/(\d+)\/reactions$/);
    if (reactionsMatch) {
      const postId = Number(reactionsMatch[1]);
      if (req.method === 'GET') {
        const response = await rest(`niver_barco_reactions?select=emoji,guest_id&post_id=eq.${postId}`);
        const reactions = await readJson(response);
        if (!response.ok) return res.status(response.status).json(reactions);
        const summary = Object.fromEntries(['heart', 'fire', 'boat', 'party'].map((emoji) => [emoji, { count: 0, reacted: false }]));
        for (const reaction of reactions) summary[reaction.emoji].count += 1;
        return res.status(200).json({ reactions, summary });
      }
      const guestId = Number(req.body?.guestId);
      const emoji = req.body?.emoji;
      const allowed = new Set(['heart', 'fire', 'boat', 'party']);
      if (!Number.isInteger(guestId) || !allowed.has(emoji)) return res.status(400).json({ error: 'Reação inválida' });
      if (req.method === 'POST') {
        const response = await rest('niver_barco_reactions', {
          method: 'POST', headers: { Prefer: 'return=representation' },
          body: JSON.stringify({ post_id: postId, guest_id: guestId, emoji }),
        });
        const data = await readJson(response);
        return res.status(response.status).json(data);
      }
      if (req.method === 'DELETE') {
        const response = await rest(`niver_barco_reactions?post_id=eq.${postId}&guest_id=eq.${guestId}&emoji=eq.${emoji}`, { method: 'DELETE' });
        if (!response.ok) return res.status(response.status).json(await readJson(response));
        return res.status(204).end();
      }
    }

    return res.status(404).json({ error: 'Not found' });
  } catch (error) {
    console.error('API error', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
