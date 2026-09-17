// 모든 페이지가 함께 쓰는 코드.
// config.js 다음에 불러와야 한다 (SUPABASE_URL 등을 사용하기 때문).

// 관리자 이메일. 실제 권한 판단은 서버(DB 정책)에서 하고,
// 여기서는 메뉴에 "관리자" 링크를 보여줄지 결정하는 데만 쓴다.
const ADMIN_EMAIL = "admin@admin.com";

const db = supabase.createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY);

// 금액을 "39,900원" 형태로 바꾼다.
function won(amount) {
  return Number(amount).toLocaleString("ko-KR") + "원";
}

// 날짜를 "2026. 9. 16. 오후 3:12" 형태로 바꾼다.
function dateText(value) {
  return new Date(value).toLocaleString("ko-KR", {
    year: "numeric", month: "long", day: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
}

// 화면에 글자를 넣을 때 HTML 로 해석되지 않게 막는다.
// 상품명이나 이메일에 < 같은 문자가 있어도 안전하게 표시된다.
function safe(text) {
  const box = document.createElement("div");
  box.textContent = text ?? "";
  return box.innerHTML;
}

// 현재 로그인한 사용자를 돌려준다. 로그인 상태가 아니면 null.
async function currentUser() {
  const { data } = await db.auth.getUser();
  return data.user ?? null;
}

// 로그인이 필요한 페이지에서 쓴다.
// 로그인하지 않았으면 로그인 페이지로 보내고 null 을 돌려준다.
async function requireLogin() {
  const user = await currentUser();
  if (!user) {
    // 로그인 후 원래 보려던 페이지로 돌아오게 주소를 넘긴다.
    const back = encodeURIComponent(location.pathname + location.search);
    location.replace("login.html?next=" + back);
    return null;
  }
  return user;
}

// 페이지 위쪽 메뉴를 그린다. 로그인 상태에 따라 메뉴가 달라진다.
// current 는 지금 보고 있는 페이지 이름(메뉴에 표시를 남기기 위함).
async function renderHeader(current) {
  const user = await currentUser();
  const isAdmin = user?.email === ADMIN_EMAIL;

  const links = [["index.html", "상품"]];
  if (user) links.push(["orders.html", "내 결제내역"]);
  if (isAdmin) links.push(["admin.html", "관리자"]);

  const menu = links.map(([href, label]) => {
    const active = href === current ? " active" : "";
    return `<a class="nav-link${active}" href="${href}">${label}</a>`;
  }).join("");

  const authArea = user
    ? `<a class="nav-link" href="#" id="logout-link">로그아웃</a>`
    : `<a class="nav-link" href="login.html">로그인</a>`;

  document.getElementById("header").innerHTML = `
    <div class="header-inner">
      <a class="logo" href="index.html">굿즈 샵</a>
      ${menu}
      ${authArea}
    </div>`;

  const logout = document.getElementById("logout-link");
  if (logout) {
    logout.addEventListener("click", async (event) => {
      event.preventDefault();
      await db.auth.signOut();
      location.href = "index.html";
    });
  }
  return user;
}

// 같은 폴더의 다른 페이지 주소를 전체 주소로 만든다.
// 토스에 넘기는 성공/실패 주소는 전체 주소여야 한다.
// 로컬에서 열어보는 경우와 GitHub Pages 에 올린 경우 모두 맞게 동작한다.
function pageUrl(fileName) {
  return new URL(fileName, location.href).href;
}
