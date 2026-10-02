/* 한 해 가계부 서비스 워커
   - 앱 화면 파일만 저장해 두고, 인터넷이 끊겨도 화면이 열리게 해요.
   - 가계부 데이터(Supabase)와 로그인 요청은 절대 저장하지 않아요.
   - 화면 파일은 항상 인터넷에서 최신을 먼저 받고, 실패할 때만 저장본을 써요. */
const CACHE = 'gagyebu-shell-v2';
const SHELL = ['/', '/index.html', '/app.js', '/theme.js', '/config.js', '/vender/supabase.js',
  '/manifest.webmanifest', '/icons/icon-192.png', '/icons/icon-512.png', '/privacy.html'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
    .then(() => self.clients.claim()));
});
self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;           // 외부(Supabase·구글 등)는 손대지 않음
  if (url.searchParams.has('code')) return;                  // 로그인 돌아오는 주소는 그대로 통과
  e.respondWith(
    fetch(req).then(res => {
      if (res.ok && res.type === 'basic') {
        const copy = res.clone();
        caches.open(CACHE).then(c => c.put(req, copy));
      }
      return res;
    }).catch(() => caches.match(req, { ignoreSearch: req.mode === 'navigate' })
      .then(r => r || (req.mode === 'navigate' ? caches.match('/index.html') : undefined)))
  );
});
