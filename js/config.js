// ============================================================
//  나르샵 설정 파일 — 여기만 고치면 됩니다
// ============================================================

// 1) Firebase 콘솔 > 프로젝트 설정 > 내 앱(웹) 에서 복사한 값을 붙여넣으세요.
//    (이 값은 공개되어도 안전합니다. 실제 보안은 firestore.rules 가 담당합니다)
export const firebaseConfig = {
  apiKey: "여기에_API_KEY",
  authDomain: "여기에_PROJECT_ID.firebaseapp.com",
  projectId: "여기에_PROJECT_ID",
  storageBucket: "여기에_PROJECT_ID.appspot.com",
  messagingSenderId: "000000000000",
  appId: "여기에_APP_ID",
};

// 2) 상점 정보
export const SHOP = {
  name: "나르샵",
  discordInvite: "https://discord.gg/여기에_초대코드",
  // 충전 안내에 표시되는 입금 계좌
  bank: { name: "카카오뱅크", number: "0000-00-0000000", holder: "예금주명" },
  // 충전 금액 빠른 선택 버튼
  chargePresets: [5000, 10000, 30000, 50000, 100000],
  minCharge: 1000,
};
