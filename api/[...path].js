const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

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

export default async function handler(req, res) {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    return res.status(500).json({ error: 'Database configuration is missing' });
  }

  const path = new URL(req.url, 'https://app.local').pathname.replace(/^\/api/, '') || '/';

  try {
    if (req.method === 'GET' && path === '/healthz') {
      return res.status(200).json({ ok: true });
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
        body: JSON.stringify({ name, rsvp_status: req.body?.rsvpStatus ?? 'pending' }),
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

    return res.status(404).json({ error: 'Not found' });
  } catch (error) {
    console.error('API error', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
