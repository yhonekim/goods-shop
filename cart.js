// 장바구니 저장소. config.js -> common.js 다음에 불러온다.
//
// 이 파일은 DB 를 건드리지 않는다. 가격 계산도 하지 않는다.
// 여기 담기는 건 "상품 번호와 수량" 뿐이고, 금액은 항상 서버가 정한다.
//
// 중요: localStorage 는 사용자가 직접 고칠 수 있다.
// 그래서 여기 든 값은 전부 "사용자가 입력한 값"으로 취급하고,
// 결제할 때 서버(create-checkout)가 처음부터 다시 검증한다.

const CART_KEY = "goods-shop-cart";
const BUY_NOW_KEY = "goods-shop-buynow";
const MODE_KEY = "goods-shop-mode";

const MIN_QTY = 1;
const MAX_QTY = 99;

// 수량을 1~99 정수로 맞춘다. 숫자가 아니면 1로 본다.
// 아주 큰 값(Infinity 포함)은 99로 내린다. NaN 만 1로 본다.
function clampQty(value) {
  const number = Math.floor(Number(value));
  if (Number.isNaN(number)) return MIN_QTY;
  if (number < MIN_QTY) return MIN_QTY;
  if (number > MAX_QTY) return MAX_QTY;
  return number;
}

// 저장소가 막혀 있을 수 있다(시크릿 모드 등). 막혀도 페이지가 죽으면 안 된다.
function readStore(store, key) {
  try {
    return store.getItem(key);
  } catch (_) {
    return null;
  }
}

function writeStore(store, key, value) {
  try {
    store.setItem(key, value);
  } catch (_) {
    // 저장이 안 되면 이번 화면에서만 동작하고 만다. 알림까지 띄우진 않는다.
  }
}

function removeStore(store, key) {
  try {
    store.removeItem(key);
  } catch (_) { /* 위와 같다 */ }
}

// 항목 하나가 쓸 수 있는 모양인지 확인하고 정리한다. 아니면 null.
function cleanItem(item) {
  if (!item || typeof item !== "object") return null;
  const productId = Math.floor(Number(item.productId));
  if (!Number.isInteger(productId) || productId <= 0) return null;
  return { productId, quantity: clampQty(item.quantity) };
}

// 장바구니를 읽는다. 값이 깨져 있으면 빈 장바구니로 돌린다.
function cartItems() {
  const raw = readStore(localStorage, CART_KEY);
  if (!raw) return [];

  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch (_) {
    return [];
  }
  if (!Array.isArray(parsed)) return [];

  // 깨진 항목은 버리고, 같은 상품이 두 번 있으면 수량을 합친다.
  const merged = new Map();
  for (const item of parsed) {
    const clean = cleanItem(item);
    if (!clean) continue;
    const already = merged.get(clean.productId);
    merged.set(
      clean.productId,
      already
        ? { productId: clean.productId, quantity: clampQty(already.quantity + clean.quantity) }
        : clean,
    );
  }
  return [...merged.values()];
}

function saveCart(items) {
  writeStore(localStorage, CART_KEY, JSON.stringify(items));
}

// 담기. 이미 있는 상품이면 수량을 더한다.
// 실제로 늘어난 수량을 돌려준다. 이미 99개여서 더 담기지 않았으면 0 이다.
// (화면이 "5개 담았습니다" 라고 거짓말하지 않게 하려고 돌려준다)
function cartAdd(productId, quantity) {
  const clean = cleanItem({ productId, quantity });
  if (!clean) return 0;

  const items = cartItems();
  const found = items.find((item) => item.productId === clean.productId);
  if (found) {
    const before = found.quantity;
    found.quantity = clampQty(before + clean.quantity);
    saveCart(items);
    return found.quantity - before;
  }
  items.push(clean);
  saveCart(items);
  return clean.quantity;
}

// 수량을 특정 값으로 맞춘다. 0 이하면 장바구니에서 뺀다.
function cartSetQty(productId, quantity) {
  const id = Math.floor(Number(productId));
  if (!Number.isInteger(id) || id <= 0) return;

  const wanted = Math.floor(Number(quantity));
  if (!Number.isFinite(wanted) || wanted <= 0) {
    cartRemove(id);
    return;
  }

  const items = cartItems();
  const found = items.find((item) => item.productId === id);
  if (!found) return;
  found.quantity = clampQty(wanted);
  saveCart(items);
}

function cartRemove(productId) {
  const id = Math.floor(Number(productId));
  saveCart(cartItems().filter((item) => item.productId !== id));
}

function cartClear() {
  removeStore(localStorage, CART_KEY);
}

// 헤더 배지에 쓰는 총 수량.
function cartCount() {
  return cartItems().reduce((sum, item) => sum + item.quantity, 0);
}

// ── 바로 구매 ────────────────────────────────────────────
// 장바구니를 거치지 않고 한 상품만 결제할 때 쓴다.
// 그 화면에서만 쓰고 끝나는 값이라 sessionStorage 에 둔다(탭을 닫으면 사라진다).

function buyNowSet(productId, quantity) {
  const clean = cleanItem({ productId, quantity });
  if (!clean) return;
  writeStore(sessionStorage, BUY_NOW_KEY, JSON.stringify(clean));
}

function buyNowGet() {
  const raw = readStore(sessionStorage, BUY_NOW_KEY);
  if (!raw) return null;
  try {
    return cleanItem(JSON.parse(raw));
  } catch (_) {
    return null;
  }
}

function buyNowClear() {
  removeStore(sessionStorage, BUY_NOW_KEY);
}

// ── 이번 결제가 어느 쪽이었는지 기억해 둔다 ──────────────
// 결제가 끝나면 success.html 이 뒷정리를 하는데, 무엇을 지울지 알아야 한다.
//  - 장바구니 결제였으면 장바구니를 비운다
//  - 바로 구매였으면 장바구니는 그대로 두고 바로구매 항목만 지운다
// 이걸 구분하지 않으면, 장바구니에 담아둔 물건이 있는 사람이 다른 상품을
// "바로 구매" 했을 때 담아둔 게 통째로 사라진다.
function checkoutModeSet(mode) {
  writeStore(sessionStorage, MODE_KEY, mode === "buynow" ? "buynow" : "cart");
}

function checkoutModeGet() {
  return readStore(sessionStorage, MODE_KEY) === "buynow" ? "buynow" : "cart";
}

function checkoutModeClear() {
  removeStore(sessionStorage, MODE_KEY);
}
