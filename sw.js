// 서비스워커 — 오프라인일 때 쓸 예비 사본을 보관한다.
//
// 기본 방침: "네트워크 우선".
//   온라인이면 항상 새로 받아온다  -> 지금까지와 똑같이 동작한다
//   네트워크가 안 되면 그때만 저장해 둔 사본을 보여준다
//
// 왜 캐시 우선이 아닌가: 캐시를 먼저 쓰면, 사이트를 새로 배포해도 사용자에게는
// 한참 동안 옛 화면이 보인다. 서비스워커 캐시는 한번 박히면 지우기도 번거롭다.
// 네트워크 우선이면 그런 사고가 구조적으로 생기지 않는다.
//
// 캐시를 갱신하려면 아래 CACHE 의 v 숫자를 올린다. 옛 캐시는 자동으로 지워진다.

const CACHE = "goods-shop-v1";

// 처음 설치할 때 미리 받아두는 것들. 이게 있어야 오프라인에서 화면이 뜬다.
const PRECACHE = [
  "./",
  "./index.html",
  "./cart.html",
  "./product.html",
  "./login.html",
  "./orders.html",
  "./offline.html",
  "./style.css",
  "./common.js",
  "./cart.js",
  "./config.js",
  "./pwa.js",
  "./manifest.webmanifest",
  "./icons/icon-192.png",
];

// ── 캐시에 절대 넣지 않는 것 ────────────────────────────
//
// 결제 경로다. 저장된 응답으로 결제가 처리되면 금액이나 승인 결과가 어긋난다.
// 이 페이지들은 서비스워커가 손대지 않고 브라우저에 그대로 맡긴다.
const NEVER_CACHE = ["checkout.html", "success.html", "fail.html"];

// 캐시해도 되는 바깥 주소.
// supabase-js 라이브러리는 모든 페이지가 쓴다. 이게 없으면 오프라인에서
// 화면이 아예 안 그려지므로(스크립트 오류) 예외로 저장해 둔다.
// Supabase 서버(데이터)와 토스는 여기 없다 = 절대 저장하지 않는다.
const CACHEABLE_ORIGINS = ["https://cdn.jsdelivr.net"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE)
      // 하나라도 실패하면 설치 전체가 실패하므로 개별로 담는다.
      .then((cache) => Promise.allSettled(PRECACHE.map((url) => cache.add(url))))
      // 새 서비스워커를 기다리지 않고 바로 쓴다.
      // 네트워크 우선이라 옛 화면이 섞일 걱정이 없어 안전하다.
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys()
      .then((names) => Promise.all(
        // 이름이 다른 = 예전 버전 캐시를 지운다. 이게 없으면 캐시가 계속 쌓인다.
        names.filter((name) => name !== CACHE).map((name) => caches.delete(name)),
      ))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const request = event.request;

  // 1) 읽기(GET)가 아닌 요청은 건드리지 않는다. 로그인·결제 등은 전부 여기 해당.
  if (request.method !== "GET") return;

  const url = new URL(request.url);

  // 2) 결제 경로는 건드리지 않는다.
  if (NEVER_CACHE.some((name) => url.pathname.endsWith(name))) return;

  // 3) 우리 사이트 파일과, 위에서 허락한 바깥 주소만 다룬다.
  //    Supabase·토스 요청은 여기서 걸러져 그대로 통과한다.
  const isOurs = url.origin === self.location.origin;
  if (!isOurs && !CACHEABLE_ORIGINS.includes(url.origin)) return;

  event.respondWith(networkFirst(request));
});

// 네트워크를 먼저 시도하고, 안 되면 저장해 둔 사본을 준다.
async function networkFirst(request) {
  const cache = await caches.open(CACHE);

  try {
    const response = await fetch(request);
    // 정상 응답이면 사본을 갱신해 둔다(= 방문한 페이지가 캐시된다).
    if (response && response.ok) {
      cache.put(request, response.clone());
    }
    return response;
  } catch (_) {
    // 여기로 오면 인터넷이 끊긴 것이다.
    const cached = await cache.match(request);
    if (cached) return cached;

    // 페이지 이동인데 사본도 없으면 안내 화면을 보여준다.
    if (request.mode === "navigate") {
      const offline = await cache.match("./offline.html");
      if (offline) return offline;
    }
    return Response.error();
  }
}
