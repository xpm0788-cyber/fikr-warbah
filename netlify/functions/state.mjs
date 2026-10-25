// دالة Netlify: تحفظ حالة المسابقة في Netlify Blobs لكل غرفة، وتقرؤها شاشة الصف.
import { getStore } from '@netlify/blobs';

export default async (req) => {
  const url = new URL(req.url);
  const room = (url.searchParams.get('room') || '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 12);
  if (!room) return new Response('room required', { status: 400 });
  const store = getStore('fikr-rooms');
  const headers = { 'content-type': 'application/json', 'cache-control': 'no-store' };

  if (req.method === 'GET') {
    const saved = await store.get(room, { type: 'json' });
    if (!saved) return new Response('{}', { headers });
    const since = Number(url.searchParams.get('since') || 0);
    if (since === saved.t) return new Response(JSON.stringify({ t: saved.t }), { headers });
    return new Response(JSON.stringify(saved), { headers });
  }

  if (req.method === 'POST') {
    let body;
    try { body = await req.json(); } catch { return new Response('bad json', { status: 400 }); }
    const pin = process.env.TEACHER_PIN;
    if (pin && body.pin !== pin) return new Response('unauthorized', { status: 401 });
    if (typeof body.state !== 'string' || body.state.length > 200000) return new Response('bad state', { status: 400 });
    const saved = { state: body.state, t: Date.now() };
    await store.setJSON(room, saved);
    return new Response(JSON.stringify({ ok: true, t: saved.t }), { headers });
  }
  return new Response('method not allowed', { status: 405 });
};

export const config = { path: '/api/state' };
