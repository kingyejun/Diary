# 나르샵 (NarShop)

디스코드 샵용 롤 계정 판매 사이트입니다. GitHub Pages(정적 호스팅) + Firebase(로그인/DB)로 동작해서 **서버 비용 없이** 운영할 수 있어요.

- 손님: 회원가입 → 충전 요청(무통장 입금) → 잔액으로 계정 구매 → 내 정보에서 계정 확인
- 사장님: `admin.html`에서 재고 등록 / 충전 승인 / 회원 잔액 / 판매 내역 관리

```
index.html      상점 (손님용)
admin.html      관리자 페이지
css/style.css   디자인
js/config.js    ★ 설정 (Firebase 값, 입금 계좌, 디스코드 링크)
js/app.js       상점 로직
js/admin.js     관리자 로직
firestore.rules ★ 보안 규칙 (반드시 적용)
assets/         마스코트 SVG
```

## 1. Firebase 만들기 (무료)
1. https://console.firebase.google.com 에서 프로젝트 생성
2. **빌드 > Authentication > 시작하기 > 이메일/비밀번호** 사용 설정
3. **빌드 > Firestore Database > 데이터베이스 만들기** (서울 `asia-northeast3` 추천, 프로덕션 모드)
4. **프로젝트 설정 > 내 앱 > 웹(</>)** 앱 추가 후 나오는 `firebaseConfig` 값을 `js/config.js`에 붙여넣기
5. `js/config.js`의 입금 계좌, 디스코드 초대 링크도 수정

## 2. 보안 규칙 적용 (중요!)
Firestore > **규칙** 탭에 `firestore.rules` 내용을 전부 붙여넣고 **게시**하세요.
이 규칙이 없으면 누구나 잔액을 올리거나 계정 정보를 볼 수 있어요.

## 3. 관리자 지정
1. 사이트에서 평소처럼 회원가입 (사장님 계정)
2. Firebase 콘솔 > Authentication > 사용자 탭에서 내 **UID** 복사
3. Firestore > **컬렉션 시작** > 컬렉션 ID `admins` > 문서 ID에 **내 UID** 붙여넣기 > 필드 아무거나(예: `ok` = `true`) 저장
4. `/admin.html` 로 접속해서 로그인

## 4. GitHub Pages 배포
1. 이 폴더 전체를 GitHub 저장소에 업로드
2. 저장소 **Settings > Pages > Branch: main / (root)** 저장
3. 나온 주소(`https://아이디.github.io/저장소/`)를 Firebase **Authentication > 설정 > 승인된 도메인**에 `아이디.github.io` 로 추가
4. 로컬 테스트는 `python -m http.server` 후 `http://localhost:8000` (파일 더블클릭으로는 모듈이 안 불러져요)

## 운영 방법
- **충전**: 손님이 입금 후 충전 요청 → 은행 앱에서 입금 확인 → `admin.html > 충전 요청`에서 **승인**
- **재고**: `재고 등록`에서 계정 정보를 넣으면 즉시 상점에 진열. 팔리면 자동으로 판매됨 처리
- **구매**: 잔액 차감 + 판매 처리 + 주문 기록이 한 번에 처리되어 중복 판매가 안 돼요

## 꼭 알아두세요
- **자동 결제 아님**: 카드/계좌이체 자동 결제는 PG사 + 서버가 필요해서 정적 사이트로는 안전하게 만들 수 없어요. 그래서 무통장 입금 후 수동 승인 방식으로 만들었어요. 자동화하려면 추후 Firebase Functions 등을 붙여야 해요.
- **계정 비밀번호가 DB에 그대로 저장돼요.** 관리자 계정 비밀번호를 강하게 설정하고, Firebase 계정에 2단계 인증을 켜세요.
- **Riot Games 약관**: 라이엇은 계정 판매/거래를 이용약관으로 금지하고 있고, 거래된 계정은 제재(정지)될 수 있어요. 구매자 분쟁/환불 문제도 생길 수 있으니 운영 전에 꼭 확인하세요.
- 마스코트는 오리지널 그림이에요. 라이엇의 캐릭터 이미지는 저작권이 있어 직접 쓰면 안 되니, 자체 제작 그림을 `assets/`에 넣어 교체하세요.
