export async function proxySharedApi(request, upstream, proxyKey) {
  const local = new URL(request.url);
  if (!['http://127.0.0.1:4173', 'http://localhost:4173'].includes(local.origin)) return new Response('Forbidden', { status: 403 });
  if (!['GET', 'HEAD'].includes(request.method) && request.headers.get('Origin') !== local.origin) return new Response('Forbidden', { status: 403 });
  const target = new URL(upstream);
  if (target.protocol !== 'https:' || target.pathname !== '/') throw new Error('Shared API must use a HTTPS origin');
  const headers = new Headers();
  for (const name of ['Cookie','Content-Type','Origin']) if (request.headers.has(name)) headers.set(name, request.headers.get(name));
  headers.set('X-Studio-Proxy-Origin', local.origin);
  headers.set('X-Studio-Proxy-Key', proxyKey);
  return fetch(new URL(local.pathname + local.search, target), { method: request.method, headers, redirect: 'manual', ...(['GET','HEAD'].includes(request.method) ? {} : { body: await request.arrayBuffer() }) });
}
