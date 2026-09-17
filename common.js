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
//
// 따옴표까지 직접 바꾸는 이유: textContent -> innerHTML 은 & < > 만 바꾸고
// 따옴표는 그대로 둔다. 그래서 src="..." 같은 속성 안에 넣으면 따옴표로
// 속성을 빠져나가 다른 속성을 심을 수 있다. 속성 안에서도 안전하게 만든다.
function safe(text) {
  const box = document.createElement("div");
  box.textContent = text ?? "";
  return box.innerHTML.replace(/"/g, "&quot;").replace(/'/g, "&#39;");
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

  // 장바구니는 로그인하지 않아도 쓸 수 있으므로 항상 보여준다.
  const links = [["index.html", "상품"], ["cart.html", "장바구니"]];
  if (user) links.push(["orders.html", "내 결제내역"]);
  if (isAdmin) links.push(["admin.html", "관리자"]);

  const menu = links.map(([href, label]) => {
    const active = href === current ? " active" : "";
    // 장바구니 링크 안에만 담긴 개수를 표시할 자리를 만든다.
    const badge = href === "cart.html"
      ? `<span class="nav-cart-count" id="cart-count" hidden></span>`
      : "";
    return `<a class="nav-link${active}" href="${href}">${label}${badge}</a>`;
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

  refreshCartCount();
  return user;
}

// 헤더의 장바구니 개수를 다시 그린다.
// 장바구니를 바꾼 페이지가 이 함수를 불러 숫자를 맞춘다.
function refreshCartCount() {
  const badge = document.getElementById("cart-count");
  if (!badge) return;

  // cart.js 는 장바구니를 쓰는 페이지만 불러온다.
  // 안 불러온 페이지에서는 개수를 셀 수 없으므로 배지를 숨긴다.
  if (typeof cartCount !== "function") {
    badge.hidden = true;
    return;
  }

  const count = cartCount();
  badge.textContent = count;
  badge.hidden = count === 0;
}

// 주문 행을 주문 단위로 묶는다.
// orders 는 한 행이 "품목 한 줄"이고, 같은 주문에 속한 줄들은 toss_order_id 가 같다.
// 내 결제내역과 관리자 화면이 똑같은 방식으로 묶어 보여주므로 여기에 둔다.
// 들어온 순서를 그대로 지킨다(Map 은 넣은 순서를 기억한다).
function groupOrders(rows) {
  const groups = new Map();
  for (const row of rows) {
    let group = groups.get(row.toss_order_id);
    if (!group) {
      group = {
        tossOrderId: row.toss_order_id,
        createdAt: row.created_at,
        userEmail: row.user_email,
        lines: [],
        total: 0,
      };
      groups.set(row.toss_order_id, group);
    }
    group.lines.push(row);
    group.total += row.amount;
  }
  return [...groups.values()];
}

// 같은 폴더의 다른 페이지 주소를 전체 주소로 만든다.
// 토스에 넘기는 성공/실패 주소는 전체 주소여야 한다.
// 로컬에서 열어보는 경우와 GitHub Pages 에 올린 경우 모두 맞게 동작한다.
function pageUrl(fileName) {
  return new URL(fileName, location.href).href;
}
