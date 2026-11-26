# 경기푸른미래관 식단 자동 알림

Windows PC가 식단을 수집해 GitHub JSON을 갱신하고 ntfy로 Android·iOS에 메뉴를 알립니다. PC가 꺼져 있어도 저장된 날짜의 메뉴를 보낼 수 있습니다.

식사 시작 1시간 전 알림과 공휴일 처리를 추가했습니다. 실제 배포·수신 확인 후 Cloudflare 예약 설정으로 전환합니다. 최신 절차는 STABILIZATION.md를 따릅니다.

[설치 및 운영](PUSH-NOTIFICATIONS.md) · [조사 및 검증 결과](STABILIZATION.md)

- 수집 collect-meals.ps1
- 업로드 sync-meals.ps1
- Windows 예약 install-schedule.ps1
- Windows 진단 diagnose-schedule.ps1
- Cloudflare 발송 worker/index.mjs
- 회귀 검사 npm test

기존 Vercel API는 보존됩니다. 자동 알림은 날짜별 meals.json을 사용합니다.
