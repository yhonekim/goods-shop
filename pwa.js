// 홈 화면 설치 관련. 모든 페이지의 맨 아래에서 불러온다.
//
// 하는 일 두 가지
//  1. 서비스워커 등록 (오프라인 대비)
//  2. "홈 화면에 추가" 안내 배너 표시
//
// 이 파일은 장바구니나 결제 로직을 건드리지 않는다.
// 오류가 나더라도 쇼핑에 지장이 없게 전부 감싸 두었다.

(function () {
  const DISMISS_KEY = "goods-shop-install-dismissed";
  const SHOW_DELAY_MS = 3000; // 들어오자마자 띄우면 거슬린다. 잠깐 뒤에 올린다.

  // ── 1. 서비스워커 등록 ──────────────────────────────
  // 주소를 상대경로로 쓴다. 이 사이트는 github.io 의 하위 폴더에 있어서
  // "/sw.js" 라고 쓰면 엉뚱한 곳을 가리킨다.
  if ("serviceWorker" in navigator) {
    window.addEventListener("load", () => {
      navigator.serviceWorker.register("sw.js").catch(() => {
        // 등록에 실패해도 사이트는 그대로 동작한다. 조용히 넘어간다.
      });
    });
  }

  // ── 2. 설치 안내 배너 ───────────────────────────────

  // 이미 앱으로 설치해서 실행 중이면 안내할 필요가 없다.
  function isInstalled() {
    return window.matchMedia("(display-mode: standalone)").matches ||
      window.navigator.standalone === true;
  }

  function isIos() {
    return /iphone|ipad|ipod/i.test(navigator.userAgent);
  }

  function dismissed() {
    try {
      return localStorage.getItem(DISMISS_KEY) === "1";
    } catch (_) {
      return false;
    }
  }

  function remember() {
    try {
      localStorage.setItem(DISMISS_KEY, "1");
    } catch (_) { /* 저장이 막혀 있어도 그냥 넘어간다 */ }
  }

  let deferredPrompt = null; // 안드로이드에서 브라우저가 건네주는 설치 도구
  let banner = null;

  function hide() {
    if (!banner) return;
    banner.classList.remove("show");
    // 사라지는 동작이 끝난 뒤 지운다.
    setTimeout(() => {
      if (banner && banner.parentNode) banner.parentNode.removeChild(banner);
      banner = null;
    }, 300);
  }

  function show(ios) {
    if (banner || isInstalled() || dismissed()) return;

    banner = document.createElement("div");
    banner.className = "install-banner";

    const icon = `<img class="install-icon" src="icons/icon-192.png" alt="">`;

    if (ios) {
      // 아이폰은 브라우저가 설치창을 안 띄워준다. 방법을 글로 알려준다.
      banner.innerHTML = `
        <div class="install-card install-ios">
          <div class="install-top">
            ${icon}
            <div class="install-text">
              <p class="install-title">홈 화면에 추가하면</p>
              <p class="install-desc">앱처럼 빠르게 열려요</p>
            </div>
          </div>
          <ol class="install-steps">
            <li>아래쪽 공유 버튼을 누르세요</li>
            <li>“홈 화면에 추가”를 고르세요</li>
          </ol>
          <div class="install-actions">
            <button class="install-later" type="button">닫기</button>
          </div>
        </div>`;
    } else {
      banner.innerHTML = `
        <div class="install-card">
          ${icon}
          <div class="install-text">
            <p class="install-title">홈 화면에 추가하면</p>
            <p class="install-desc">앱처럼 빠르게 열려요</p>
          </div>
          <div class="install-actions">
            <button class="install-later" type="button">나중에</button>
            <button class="install-add" type="button">추가</button>
          </div>
        </div>`;
    }

    document.body.appendChild(banner);
    // 붙이자마자 올리면 애니메이션이 안 먹는다. 한 박자 뒤에 올린다.
    requestAnimationFrame(() => banner.classList.add("show"));

    banner.querySelector(".install-later").addEventListener("click", () => {
      remember();
      hide();
    });

    const addButton = banner.querySelector(".install-add");
    if (addButton) {
      addButton.addEventListener("click", async () => {
        hide();
        if (!deferredPrompt) return;
        deferredPrompt.prompt();
        try {
          await deferredPrompt.userChoice;
        } catch (_) { /* 사용자가 취소한 경우 */ }
        // 설치 도구는 한 번만 쓸 수 있다.
        deferredPrompt = null;
        remember();
      });
    }
  }

  // 안드로이드/크롬: 설치 가능해지면 브라우저가 이 신호를 준다.
  window.addEventListener("beforeinstallprompt", (event) => {
    // 브라우저 기본 안내를 막고, 우리 배너로 대신한다.
    event.preventDefault();
    deferredPrompt = event;
    setTimeout(() => show(false), SHOW_DELAY_MS);
  });

  // 아이폰: 위 신호가 없으므로 직접 판단해서 띄운다.
  if (isIos() && !isInstalled() && !dismissed()) {
    window.addEventListener("load", () => {
      setTimeout(() => show(true), SHOW_DELAY_MS);
    });
  }

  // 설치가 끝나면 배너를 치우고 다시 묻지 않는다.
  window.addEventListener("appinstalled", () => {
    remember();
    hide();
  });
})();
