import {
  auth, db, onAuthStateChanged, signInWithEmailAndPassword, signOut,
  collection, doc, getDoc, getDocs, writeBatch, serverTimestamp, increment,
} from "./firebase.js";
import { esc, won, fmtDate, tsMs, TIERS, TIER_CLASS, toast, authErrorMsg } from "./util.js";

const $ = (s) => document.querySelector(s);
const PAGES = ["add", "stock", "charges", "members", "orders"];
let isAdmin = false;

$("#tierSel").innerHTML = TIERS.map((t) => `<option>${t}</option>`).join("");

/* ---------- 로그인 / 권한 확인 ---------- */
$("#loginForm").onsubmit = async (e) => {
  e.preventDefault();
  const f = new FormData(e.target);
  try { await signInWithEmailAndPassword(auth, f.get("email").trim(), f.get("pw")); }
  catch (err) { toast(authErrorMsg(err), "err"); }
};
$("#btnLogout").onclick = () => signOut(auth);

onAuthStateChanged(auth, async (user) => {
  isAdmin = false;
  if (user) {
    try { isAdmin = (await getDoc(doc(db, "admins", user.uid))).exists(); } catch { isAdmin = false; }
    $("#gateMsg").textContent = isAdmin ? "" : "관리자 권한이 없는 계정이에요.";
  }
  $("#gate").hidden = isAdmin;
  $("#app").hidden = !isAdmin;
  $("#nav").hidden = !isAdmin;
  $("#btnLogout").hidden = !user;
  if (isAdmin) route();
});

function route() {
  const r = (location.hash || "#add").slice(1);
  const page = PAGES.includes(r) ? r : "add";
  PAGES.forEach((id) => ($("#" + id).hidden = id !== page));
  document.querySelectorAll("#nav a").forEach((a) => a.classList.toggle("active", a.dataset.r === page));
  ({ stock: renderStock, charges: renderCharges, members: renderMembers, orders: renderOrders }[page] || (() => {}))();
}
window.addEventListener("hashchange", () => isAdmin && route());

const all = async (name) => (await getDocs(collection(db, name))).docs.map((d) => ({ id: d.id, ...d.data() }));
const num = (v) => (v === "" || v == null ? null : Number(v));

/* ---------- 재고 등록 ---------- */
$("#addForm").onsubmit = async (e) => {
  e.preventDefault();
  const f = Object.fromEntries(new FormData(e.target));
  const iRef = doc(collection(db, "items")), batch = writeBatch(db);
  batch.set(iRef, {
    title: f.title.trim(), tier: f.tier, level: num(f.level), champs: num(f.champs), skins: num(f.skins),
    price: Number(f.price), desc: f.desc.trim(), status: "available", createdAt: serverTimestamp(),
  });
  batch.set(doc(db, "secrets", iRef.id), { loginId: f.loginId.trim(), loginPw: f.loginPw, note: f.note.trim() });
  try { await batch.commit(); toast("진열 완료!"); e.target.reset(); }
  catch (err) { console.error(err); toast("등록에 실패했어요. 규칙/권한을 확인하세요.", "err"); }
};

/* ---------- 재고 목록 ---------- */
async function renderStock() {
  const rows = (await all("items")).sort((a, b) => tsMs(b.createdAt) - tsMs(a.createdAt));
  $("#stockList").innerHTML = rows.length ? rows.map((i) => `
    <div class="row">
      <span class="tier ${TIER_CLASS[i.tier] || ""}">${esc(i.tier)}</span>
      <div class="grow"><b>${esc(i.title)}</b><br><small>${won(i.price)} · ${fmtDate(i.createdAt)}</small></div>
      <span class="badge ${i.status === "sold" ? "sold" : "approved"}">${i.status === "sold" ? "판매됨" : "판매 중"}</span>
      <button class="btn small ghost" data-view="${esc(i.id)}">계정정보</button>
      <button class="btn small danger" data-del="${esc(i.id)}">삭제</button>
    </div>`).join("") : `<div class="empty">등록된 재고가 없어요.</div>`;
}
$("#stockList").onclick = async (e) => {
  const v = e.target.closest("[data-view]"), d = e.target.closest("[data-del]");
  if (v) {
    const s = await getDoc(doc(db, "secrets", v.dataset.view));
    const x = s.data() || {};
    alert(`아이디: ${x.loginId}\n비밀번호: ${x.loginPw}\n메모: ${x.note || "-"}`);
  }
  if (d && confirm("이 재고를 삭제할까요? (되돌릴 수 없어요)")) {
    const b = writeBatch(db);
    b.delete(doc(db, "items", d.dataset.del)); b.delete(doc(db, "secrets", d.dataset.del));
    await b.commit(); toast("삭제했어요."); renderStock();
  }
};

/* ---------- 충전 요청 ---------- */
const STATUS = { pending: "대기", approved: "승인", rejected: "거절" };
async function renderCharges() {
  const rows = (await all("chargeRequests")).sort((a, b) => (a.status === "pending" ? -1 : 1) - (b.status === "pending" ? -1 : 1) || tsMs(b.createdAt) - tsMs(a.createdAt));
  $("#chargeList").innerHTML = rows.length ? rows.map((r) => `
    <div class="row">
      <div class="grow"><b>${won(r.amount)}</b> · ${esc(r.nickname)}<br><small>입금자 ${esc(r.depositor)} · ${fmtDate(r.createdAt)}</small></div>
      <span class="badge ${esc(r.status)}">${STATUS[r.status] || esc(r.status)}</span>
      ${r.status === "pending" ? `<button class="btn small" data-ok="${esc(r.id)}" data-uid="${esc(r.uid)}" data-amt="${r.amount}">승인</button>
        <button class="btn small danger" data-no="${esc(r.id)}">거절</button>` : ""}
    </div>`).join("") : `<div class="empty">충전 요청이 없어요.</div>`;
}
$("#chargeList").onclick = async (e) => {
  const ok = e.target.closest("[data-ok]"), no = e.target.closest("[data-no]");
  try {
    if (ok) {
      if (!confirm(`${won(ok.dataset.amt)} 입금을 확인했나요? 승인하면 바로 충전돼요.`)) return;
      const rq = doc(db, "chargeRequests", ok.dataset.ok);
      if ((await getDoc(rq)).data().status !== "pending") return toast("이미 처리된 요청이에요.", "err");
      const b = writeBatch(db);
      b.update(rq, { status: "approved", handledAt: serverTimestamp() });
      b.update(doc(db, "users", ok.dataset.uid), { balance: increment(Number(ok.dataset.amt)) });
      await b.commit(); toast("충전 완료!");
    } else if (no) {
      const b = writeBatch(db);
      b.update(doc(db, "chargeRequests", no.dataset.no), { status: "rejected", handledAt: serverTimestamp() });
      await b.commit(); toast("거절했어요.");
    } else return;
    renderCharges();
  } catch (err) { console.error(err); toast("처리에 실패했어요.", "err"); }
};

/* ---------- 회원 ---------- */
async function renderMembers() {
  const rows = (await all("users")).sort((a, b) => tsMs(b.createdAt) - tsMs(a.createdAt));
  $("#memberList").innerHTML = `<table><thead><tr><th>닉네임</th><th>이메일</th><th>잔액</th><th>가입일</th><th></th></tr></thead><tbody>
    ${rows.map((u) => `<tr><td>${esc(u.nickname)}</td><td>${esc(u.email)}</td><td>${won(u.balance)}</td><td>${fmtDate(u.createdAt)}</td>
    <td><button class="btn small ghost" data-adj="${esc(u.id)}">잔액 조정</button></td></tr>`).join("")}</tbody></table>`;
}
$("#memberList").onclick = async (e) => {
  const b = e.target.closest("[data-adj]"); if (!b) return;
  const v = prompt("더하거나 뺄 금액을 입력하세요. (예: 5000 또는 -3000)");
  const n = Number(v);
  if (!v || !Number.isFinite(n) || n === 0) return;
  const batch = writeBatch(db);
  batch.update(doc(db, "users", b.dataset.adj), { balance: increment(n) });
  await batch.commit(); toast("잔액을 조정했어요."); renderMembers();
};

/* ---------- 판매 내역 ---------- */
async function renderOrders() {
  const rows = (await all("orders")).sort((a, b) => tsMs(b.createdAt) - tsMs(a.createdAt));
  const total = rows.reduce((s, o) => s + (o.price || 0), 0);
  $("#orderList").innerHTML = `<p>총 ${rows.length}건 · 매출 <b class="price">${won(total)}</b></p>
    <table><thead><tr><th>일시</th><th>구매자</th><th>상품</th><th>티어</th><th>금액</th></tr></thead><tbody>
    ${rows.map((o) => `<tr><td>${fmtDate(o.createdAt)}</td><td>${esc(o.nickname)}</td><td>${esc(o.title)}</td><td>${esc(o.tier)}</td><td>${won(o.price)}</td></tr>`).join("")}</tbody></table>`;
}
