// دالة Netlify: تحفظ حالة المسابقة لكل غرفة (Netlify Blobs) وتقرؤها شاشة الصف.
// القراءة تنتظر التغيير (long polling) فتصل تحديثات الهاتف إلى الشاشة خلال أجزاء من الثانية.
import { getStore } from '@netlify/blobs';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

export default async (req) => {
  const url = new URL(req.url);
  const room = (url.searchParams.get('room') || '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 12);
  if (!room) return new Response('room required', { status: 400 });
  // consistency: strong => القراءة تُرجع آخر نسخة مكتوبة دائمًا (الافتراضي قد يتأخر ثوانيَ)
  const store = getStore({ name: 'fikr-rooms', consistency: 'strong' });
  const headers = { 'content-type': 'application/json', 'cache-control': 'no-store' };

  if (req.method === 'GET') {
    const since = Number(url.searchParams.get('since') || 0);
    const deadline = Date.now() + (url.searchParams.get('wait') === '1' ? 7000 : 0);
    for (;;) {
      const saved = await store.get(room, { type: 'json' });
      if (saved && saved.t !== since) return new Response(JSON.stringify(saved), { headers });
      if (Date.now() >= deadline) return new Response(JSON.stringify(saved ? { t: saved.t } : {}), { headers });
      await sleep(250);
    }
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
