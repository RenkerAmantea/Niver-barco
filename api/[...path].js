const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
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

function guestResponse(guest) {
  return {
    id: guest.id,
    name: guest.name,
    googleId: guest.google_id,
    avatarUrl: guest.avatar_url,
    rsvpStatus: guest.rsvp_status,
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
      const response = await rest('niver_barco_guests?select=*&order=created_at.asc');
      const guests = await readJson(response);
      return res.status(response.status).json(Array.isArray(guests) ? guests.map(guestResponse) : guests);
    }

    if (req.method === 'POST' && path === '/guests') {
      const name = typeof req.body?.name === 'string' ? req.body.name.trim() : '';
      if (!name) return res.status(400).json({ error: 'Nome é obrigatório' });
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
        const response = await rest(`niver_barco_guests?select=*&id=eq.${guestId}`);
        const guests = await readJson(response);
        return guests?.[0] ? res.status(200).json(guestResponse(guests[0])) : res.status(404).json({ error: 'Guest not found' });
      }
      if (req.method === 'PATCH' && path.endsWith('/rsvp')) {
        const allowed = new Set(['going', 'maybe', 'not_going', 'pending']);
        if (!allowed.has(req.body?.rsvpStatus)) return res.status(400).json({ error: 'Invalid RSVP status' });
        const response = await rest(`niver_barco_guests?id=eq.${guestId}`, {
          method: 'PATCH',
          headers: { Prefer: 'return=representation' },
          body: JSON.stringify({ rsvp_status: req.body.rsvpStatus }),
        });
        const guests = await readJson(response);
        return guests?.[0] ? res.status(200).json(guestResponse(guests[0])) : res.status(404).json({ error: 'Guest not found' });
      }
    }

    const profileMatch = path.match(/^\/guests\/(\d+)\/profile$/);
    if (profileMatch && req.method === 'PATCH') {
      const guestId = Number(profileMatch[1]);
      const name = typeof req.body?.name === 'string' ? req.body.name.trim() : '';
      const avatarUrl = typeof req.body?.avatarUrl === 'string' ? req.body.avatarUrl : null;
      if (!name || name.length > 80) return res.status(400).json({ error: 'Nome inválido' });
      const response = await rest(`niver_barco_guests?id=eq.${guestId}`, {
        method: 'PATCH', headers: { Prefer: 'return=representation' }, body: JSON.stringify({ name, avatar_url: avatarUrl }),
      });
      const guests = await readJson(response);
      return guests?.[0] ? res.status(200).json(guestResponse(guests[0])) : res.status(404).json({ error: 'Convidado não encontrado' });
    }

    if (req.method === 'GET' && path === '/stats/rsvp-summary') {
      const response = await rest('niver_barco_guests?select=rsvp_status');
      const guests = await readJson(response);
      const summary = { going: 0, maybe: 0, notGoing: 0, pending: 0 };
      for (const guest of guests) {
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
      return res.status(200).json(posts.map((post) => postResponse(post, guests, replies)));
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
      return res.status(201).json(postResponse(posts[0], guests, []));
    }

    const repliesMatch = path.match(/^\/posts\/(\d+)\/replies$/);
    if (repliesMatch) {
      const postId = Number(repliesMatch[1]);
      if (req.method === 'GET') {
        const [repliesResponse, guestsResponse] = await Promise.all([
          rest(`niver_barco_replies?select=*&post_id=eq.${postId}&order=created_at.asc`),
          rest('niver_barco_guests?select=*'),
        ]);
        const [replies, guests] = await Promise.all([readJson(repliesResponse), readJson(guestsResponse)]);
        if (!repliesResponse.ok) return res.status(repliesResponse.status).json(replies);
        return res.status(200).json(replies.map((reply) => replyResponse(reply, guests)));
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
        return res.status(201).json(replyResponse(replies[0], guests));
      }
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
