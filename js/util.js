// HTML 이스케이프 (XSS 방지) — 사용자 입력은 항상 esc() 를 거쳐 출력합니다
export const esc = (s) =>
  String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

export const won = (n) => Number(n || 0).toLocaleString("ko-KR") + "원";

export const fmtDate = (ts) => {
  if (!ts) return "-";
  const d = ts.toDate ? ts.toDate() : new Date(ts);
  const p = (x) => String(x).padStart(2, "0");
  return `${d.getFullYear()}.${p(d.getMonth() + 1)}.${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`;
};

export const tsMs = (ts) => (ts && ts.toMillis ? ts.toMillis() : 0);

export const TIERS = ["언랭", "아이언", "브론즈", "실버", "골드", "플래티넘", "에메랄드", "다이아몬드", "마스터 이상"];
export const TIER_CLASS = {
  "언랭": "t-un", "아이언": "t-iron", "브론즈": "t-bronze", "실버": "t-silver", "골드": "t-gold",
  "플래티넘": "t-plat", "에메랄드": "t-emer", "다이아몬드": "t-dia", "마스터 이상": "t-master",
};

let toastTimer;
export function toast(msg, type = "ok") {
  let el = document.getElementById("toast");
  if (!el) { el = document.createElement("div"); el.id = "toast"; document.body.appendChild(el); }
  el.className = "toast show " + type;
  el.textContent = msg;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove("show"), 2800);
}

export const authErrorMsg = (e) => {
  const c = e?.code || "";
  if (c.includes("email-already")) return "이미 가입된 이메일이에요.";
  if (c.includes("invalid-email")) return "이메일 형식을 확인해 주세요.";
  if (c.includes("weak-password")) return "비밀번호는 6자 이상이어야 해요.";
  if (c.includes("invalid-credential") || c.includes("wrong-password") || c.includes("user-not-found"))
    return "이메일 또는 비밀번호가 맞지 않아요.";
  if (c.includes("too-many")) return "시도가 너무 많아요. 잠시 후 다시 해주세요.";
  return "문제가 생겼어요: " + (e?.message || c);
};
