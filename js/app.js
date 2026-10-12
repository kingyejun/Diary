import {
  auth, db, onAuthStateChanged, createUserWithEmailAndPassword, signInWithEmailAndPassword, signOut,
  collection, doc, getDoc, getDocs, setDoc, addDoc, query, where, runTransaction, serverTimestamp,
} from "./firebase.js";
import { SHOP, firebaseConfig } from "./config.js";
import { esc, won, fmtDate, tsMs, TIERS, TIER_CLASS, toast, authErrorMsg } from "./util.js";

const $ = (s, r = document) => r.querySelector(s);
const dlg = $("#dlg");
let me = null;          // Firebase user
let profile = null;     // users/{uid}
let items = [];
let signingUp = false;

if (firebaseConfig.apiKey.startsWith("여기에")) $("#setupWarn").hidden = false;
$("#discordLink").href = SHOP.discordInvite;

/* ---------- 라우팅 ---------- */
function route() {
  const r = (location.hash || "#shop").slice(1);
  const page = ["shop", "charge", "me"].includes(r) ? r : "shop";
  ["shop", "charge", "me"].forEach((id) => ($("#" + id).hidden = id !== page));
  document.querySelectorAll("#nav a").forEach((a) => a.classList.toggle("active", a.dataset.r === page));
  if (page === "charge") renderCharge();
  if (page === "me") renderMe();
}
window.addEventListener("hashchange", route);

/* ---------- 다이얼로그 ---------- */
function openDlg(html) { dlg.innerHTML = html; if (!dlg.open) dlg.showModal(); }
dlg.addEventListener("click", (e) => { if (e.target === dlg || e.target.closest("[data-close]")) dlg.close(); });

/* ---------- 로그인 / 회원가입 ---------- */
function loginDialog(mode = "login") {
  const signup = mode === "signup";
  openDlg(`
    <h2>${signup ? "회원가입" : "로그인"}</h2>
    <div class="tabs">
      <button class="btn small ${signup ? "ghost" : ""}" data-mode="login">로그인</button>
      <button class="btn small ${signup ? "" : "ghost"}" data-mode="signup">회원가입</button>
    </div>
    <form class="form" id="authForm" style="max-width:none">
      ${signup ? `<div class="field"><label>닉네임 (디스코드 이름)</label><input name="nick" maxlength="20" required></div>` : ""}
      <div class="field"><label>이메일</label><input name="email" type="email" autocomplete="email" required></div>
      <div class="field"><label>비밀번호 (6자 이상)</label><input name="pw" type="password" minlength="6" autocomplete="${signup ? "new-password" : "current-password"}" required></div>
      <div class="actions"><button type="button" class="btn ghost" data-close>닫기</button>
      <button class="btn pink" type="submit">${signup ? "가입하기" : "로그인"}</button></div>
    </form>`);
  dlg.querySelectorAll("[data-mode]").forEach((b) => (b.onclick = () => loginDialog(b.dataset.mode)));
  $("#authForm").onsubmit = async (e) => {
    e.preventDefault();
    const f = new FormData(e.target);
    const email = f.get("email").trim(), pw = f.get("pw");
    try {
      if (signup) {
        signingUp = true;
        const cred = await createUserWithEmailAndPassword(auth, email, pw);
        await setDoc(doc(db, "users", cred.user.uid), {
          nickname: f.get("nick").trim(), email, balance: 0, createdAt: serverTimestamp(),
        });
        signingUp = false;
        await loadProfile(cred.user);
        toast("가입 완료! 환영해요 🎉");
      } else {
        await signInWithEmailAndPassword(auth, email, pw);
        toast("어서오세요!");
      }
      dlg.close();
    } catch (err) { signingUp = false; toast(authErrorMsg(err), "err"); }
  };
}

async function loadProfile(user) {
  const snap = await getDoc(doc(db, "users", user.uid));
  if (snap.exists()) profile = snap.data();
  else if (!signingUp) {
    profile = { nickname: user.email.split("@")[0], email: user.email, balance: 0 };
    await setDoc(doc(db, "users", user.uid), { ...profile, createdAt: serverTimestamp() });
  }
  renderUser();
}

function renderUser() {
  const box = $("#userbox");
  if (!me) {
    box.innerHTML = `<button class="btn pink" id="btnLogin">로그인 / 가입</button>`;
    $("#btnLogin").onclick = () => loginDialog();
  } else {
    box.innerHTML = `
      <span class="coinpill">🪙 ${won(profile?.balance)}</span>
      <button class="btn ghost small" id="btnLogout">로그아웃</button>`;
    $("#btnLogout").onclick = () => signOut(auth).then(() => toast("다음에 또 만나요!"));
  }
}

onAuthStateChanged(auth, async (user) => {
  me = user; profile = null;
  if (user) await loadProfile(user); else renderUser();
  route();
});

/* ---------- 상점 ---------- */
$("#fTier").insertAdjacentHTML("beforeend", TIERS.map((t) => `<option>${t}</option>`).join(""));
["q", "fTier", "fSort"].forEach((id) => $("#" + id).addEventListener("input", renderGrid));

async function loadItems() {
  try {
    const snap = await getDocs(query(collection(db, "items"), where("status", "==", "available")));
    items = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
  } catch (e) { console.error(e); items = []; toast("상품을 불러오지 못했어요. 설정을 확인해 주세요.", "err"); }
  renderGrid();
}

function renderGrid() {
  const q = $("#q").value.trim().toLowerCase(), tier = $("#fTier").value, sort = $("#fSort").value;
  let list = items.filter((i) =>
    (!tier || i.tier === tier) && (!q || (i.title + " " + (i.desc || "")).toLowerCase().includes(q)));
  list.sort((a, b) => sort === "low" ? a.price - b.price : sort === "high" ? b.price - a.price : tsMs(b.createdAt) - tsMs(a.createdAt));
  $("#grid").innerHTML = list.length ? list.map((i) => `
    <article class="card">
      <span class="tier ${TIER_CLASS[i.tier] || ""}">${esc(i.tier)}</span>
      <h3>${esc(i.title)}</h3>
      <div class="stats">
        <div><b>${esc(i.level ?? "-")}</b>레벨</div>
        <div><b>${esc(i.champs ?? "-")}</b>챔피언</div>
        <div><b>${esc(i.skins ?? "-")}</b>스킨</div>
      </div>
      ${i.desc ? `<p class="desc">${esc(i.desc)}</p>` : ""}
      <div class="buy"><span class="price">${won(i.price)}</span>
        <button class="btn pink small" data-buy="${esc(i.id)}">구매하기</button></div>
    </article>`).join("")
    : `<div class="empty" style="grid-column:1/-1"><img src="assets/slime.svg" alt="">
        지금은 진열된 계정이 없어요.<br>재고가 들어오면 여기에 올라와요!</div>`;
}

$("#grid").addEventListener("click", (e) => {
  const b = e.target.closest("[data-buy]"); if (!b) return;
  const item = items.find((i) => i.id === b.dataset.buy); if (!item) return;
  if (!me) return loginDialog();
  const bal = profile?.balance || 0, short = item.price - bal;
  openDlg(`
    <h2>구매할까요?</h2>
    <p><b>${esc(item.title)}</b><br>${esc(item.tier)} · ${won(item.price)}</p>
    <p class="note">내 잔액 ${won(bal)} → 구매 후 ${won(Math.max(bal - item.price, 0))}</p>
    ${short > 0 ? `<p style="color:var(--danger)">잔액이 ${won(short)} 부족해요. 먼저 충전해 주세요.</p>` : ""}
    <div class="actions">
      <button class="btn ghost" data-close>취소</button>
      ${short > 0 ? `<a class="btn" href="#charge" data-close style="text-decoration:none">충전하러 가기</a>`
                  : `<button class="btn pink" id="confirmBuy">구매 확정</button>`}
    </div>`);
  const ok = $("#confirmBuy");
  if (ok) ok.onclick = () => purchase(item, ok);
});

async function purchase(item, btn) {
  btn.disabled = true; btn.textContent = "처리 중...";
  const uRef = doc(db, "users", me.uid), iRef = doc(db, "items", item.id), oRef = doc(collection(db, "orders"));
  try {
    const newBal = await runTransaction(db, async (tx) => {
      const [u, i] = await Promise.all([tx.get(uRef), tx.get(iRef)]);
      if (!i.exists() || i.data().status !== "available") throw new Error("SOLD");
      const price = i.data().price, bal = u.data().balance || 0;
      if (bal < price) throw new Error("FUNDS");
      tx.update(uRef, { balance: bal - price, lastItem: item.id });
      tx.update(iRef, { status: "sold", buyerUid: me.uid, soldAt: serverTimestamp() });
      tx.set(oRef, { uid: me.uid, nickname: profile.nickname, itemId: item.id, title: i.data().title,
        tier: i.data().tier, price, createdAt: serverTimestamp() });
      return bal - price;
    });
    profile.balance = newBal; renderUser(); dlg.close();
    toast("구매 완료! 내 정보에서 계정을 확인하세요 🎁");
    await loadItems(); location.hash = "#me";
  } catch (e) {
    const m = e.message === "SOLD" ? "아쉽게도 방금 다른 분이 가져갔어요."
      : e.message === "FUNDS" ? "잔액이 부족해요." : "구매 중 문제가 생겼어요. 잠시 후 다시 시도해 주세요.";
    toast(m, "err"); dlg.close(); await loadItems();
    if (me) await loadProfile(me);
  }
}

/* ---------- 충전 ---------- */
$("#bankbox").innerHTML = `입금 계좌<br><b>${esc(SHOP.bank.name)} ${esc(SHOP.bank.number)}</b><br>예금주 ${esc(SHOP.bank.holder)}`;
$("#cAmount").min = SHOP.minCharge;
$("#presets").innerHTML = SHOP.chargePresets.map((n) => `<button type="button" class="btn ghost small" data-amt="${n}">${won(n)}</button>`).join("");
$("#presets").onclick = (e) => { const b = e.target.closest("[data-amt]"); if (b) $("#cAmount").value = b.dataset.amt; };

$("#chargeForm").onsubmit = async (e) => {
  e.preventDefault();
  if (!me) return loginDialog();
  const amount = Number($("#cAmount").value), name = $("#cName").value.trim();
  if (!(amount >= SHOP.minCharge)) return toast(`최소 충전 금액은 ${won(SHOP.minCharge)}이에요.`, "err");
  try {
    await addDoc(collection(db, "chargeRequests"), {
      uid: me.uid, nickname: profile?.nickname || "", amount, depositor: name, status: "pending", createdAt: serverTimestamp(),
    });
    toast("충전 요청을 보냈어요. 확인되면 잔액이 올라가요!");
    $("#cAmount").value = ""; $("#cName").value = ""; renderCharge();
  } catch (err) { console.error(err); toast("요청을 보내지 못했어요.", "err"); }
};

const STATUS = { pending: "확인 중", approved: "충전 완료", rejected: "거절됨" };
async function renderCharge() {
  const el = $("#chargeList");
  if (!me) { el.innerHTML = `<div class="empty">로그인하면 충전 요청 내역을 볼 수 있어요.</div>`; return; }
  const snap = await getDocs(query(collection(db, "chargeRequests"), where("uid", "==", me.uid)));
  const rows = snap.docs.map((d) => d.data()).sort((a, b) => tsMs(b.createdAt) - tsMs(a.createdAt));
  el.innerHTML = rows.length ? rows.map((r) => `
    <div class="row"><div class="grow"><b>${won(r.amount)}</b> <small>입금자 ${esc(r.depositor)} · ${fmtDate(r.createdAt)}</small></div>
    <span class="badge ${esc(r.status)}">${STATUS[r.status] || esc(r.status)}</span></div>`).join("")
    : `<div class="empty">아직 충전 요청이 없어요.</div>`;
}

/* ---------- 내 정보 ---------- */
async function renderMe() {
  const info = $("#meInfo"), list = $("#orderList");
  if (!me) {
    info.innerHTML = `<div class="empty"><img src="assets/mascot.svg" alt="">로그인이 필요해요.<br><br><button class="btn pink" id="meLogin">로그인 / 가입</button></div>`;
    list.innerHTML = ""; $("#meLogin").onclick = () => loginDialog(); return;
  }
  info.innerHTML = `<p><b>${esc(profile?.nickname)}</b> <small class="note">${esc(me.email)}</small></p>
    <p>보유 잔액 <span class="price">${won(profile?.balance)}</span></p>`;
  const snap = await getDocs(query(collection(db, "orders"), where("uid", "==", me.uid)));
  const rows = snap.docs.map((d) => ({ id: d.id, ...d.data() })).sort((a, b) => tsMs(b.createdAt) - tsMs(a.createdAt));
  list.innerHTML = rows.length ? rows.map((o) => `
    <div class="row"><div class="grow"><b>${esc(o.title)}</b><br><small>${esc(o.tier)} · ${won(o.price)} · ${fmtDate(o.createdAt)}</small></div>
    <button class="btn small" data-secret="${esc(o.itemId)}">계정 정보 보기</button></div>`).join("")
    : `<div class="empty">아직 구매한 계정이 없어요.</div>`;
}

$("#orderList").addEventListener("click", async (e) => {
  const b = e.target.closest("[data-secret]"); if (!b) return;
  try {
    const s = await getDoc(doc(db, "secrets", b.dataset.secret));
    if (!s.exists()) return toast("계정 정보를 찾지 못했어요. 디스코드로 문의해 주세요.", "err");
    const d = s.data();
    const line = (label, v) => `<div class="note">${label}</div><div class="secretbox"><code>${esc(v)}</code>
      <button class="btn small ghost" data-copy="${esc(v)}">복사</button></div>`;
    openDlg(`<h2>계정 정보</h2>${line("아이디", d.loginId)}${line("비밀번호", d.loginPw)}
      ${d.note ? `<div class="note">메모</div><p style="white-space:pre-wrap">${esc(d.note)}</p>` : ""}
      <p class="note">받자마자 비밀번호를 바꿔 주세요.</p>
      <div class="actions"><button class="btn" data-close>닫기</button></div>`);
    dlg.querySelectorAll("[data-copy]").forEach((c) => (c.onclick = () =>
      navigator.clipboard.writeText(c.dataset.copy).then(() => toast("복사했어요!"))));
  } catch (err) { console.error(err); toast("계정 정보를 불러오지 못했어요.", "err"); }
});

loadItems();
route();
