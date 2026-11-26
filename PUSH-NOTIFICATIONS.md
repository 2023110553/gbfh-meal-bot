# 최신 운영 절차

2026-11-27 이후 배포·예약·인증 설정은 [STABILIZATION.md](STABILIZATION.md)를 따릅니다. 아래는 초기 구성 기록이며 이전 고정 시각 및 토큰 설정 설명이 포함되어 있습니다.

# 설치와 운영

## Windows PC

Git for Windows 설치 후 저장소를 clone합니다. Git 사용자 이름과 이메일을 설정하고 Git Credential Manager로 본인 계정에 로그인합니다. 토큰을 코드에 넣지 않습니다.

저장소의 Windows PowerShell 5.1에서 다음 명령을 각각 실행합니다.

    powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\sync-meals.ps1
    powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\install-schedule.ps1
    powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\diagnose-schedule.ps1

수집기는 이번 주·다음 주 토요일 날짜로 요청하고 행의 날짜 7개를 검사합니다. 전부 실패하면 기존 JSON을 보존합니다. 정상 표의 빈 끼니는 반영하며 다음 주 전체가 빈 표면 건너뜁니다.

동기화는 origin/main에서 임시 worktree를 만들어 실행합니다. 사용자 체크아웃의 변경은 보존합니다. JSON이 바뀐 경우만 커밋합니다. 인증 실패·푸시 충돌은 로그를 남기고 종료합니다. 미전송 커밋이나 미커밋 파일이 있는 임시 폴더는 복구용으로 보존하고 다음 실행은 새 origin/main에서 다시 수집합니다.

예약은 현재 사용자 로그인 시와 매일 PC 현지 시간 06:30입니다. 사용자가 로그인하고 PC가 켜져 있어야 수집합니다. 진단 스크립트에서 마지막 실행 결과 0, 실행 시각, 다음 실행 시각을 확인합니다. 로그는 %LOCALAPPDATA%\GBFH\sync.log입니다. Windows 재시작 후 실제 실행 여부도 이 명령으로 확인합니다.

친구 PC에는 친구 계정의 쓰기 권한과 Git 인증을 사용합니다. 친구 PC의 실제 수집·푸시 확인 후 이전 PC 작업을 비활성화합니다.

## Cloudflare 준비

SQLite Durable Object로 발송 기록을 직렬 처리합니다. Workers Free 플랜을 유지합니다. 현재 wrangler.jsonc의 crons는 빈 배열이라 배포만으로 예약이 활성화되지 않습니다.

    npm install
    npx wrangler login
    npx wrangler deploy
    npx wrangler secret put NTFY_TOPIC
    npx wrangler secret put ADMIN_TOKEN

NTFY_TOPIC에는 기존 폰 구독값을 입력합니다. GitHub Secret은 다시 읽을 수 없으니 기존 구독 화면에서 확인합니다. ADMIN_TOKEN은 임의의 긴 비밀로 설정합니다. 비밀을 커밋하지 않습니다.

Worker URL에 Authorization: Bearer ADMIN_TOKEN 헤더로 POST합니다. 본문 {"meal":"dinner","dryRun":true}는 현재 한국 날짜 메뉴를 확인합니다. dryRun을 false로 바꾸면 실제 발송합니다. 오늘 식단이 있는 날 테스트합니다. 수동 발송도 같은 날짜·끼니는 재발송하지 않습니다.

npx wrangler tail에서 결과를 확인합니다. missing-menu는 HTTP 409이고 최신 데이터 날짜를 로그에 남깁니다. ntfy가 받았으나 응답이 유실된 경우 중복 방지를 위해 uncertain 기록을 유지합니다. 자동 재시도하지 않으므로 실제 수신 여부를 확인해야 합니다.

## 예약 전환

1. Worker dry-run과 실기기 수신 확인.
2. 기존 GitHub 발송 워크플로 비활성화와 실행 중 작업 종료 확인.
3. wrangler.jsonc의 crons를 ["0 22 * * *","0 2 * * *","0 8 * * *"]로 바꾸고 배포.
4. 다음 예약의 로그 시각과 폰 수신 확인.

한국 시간 07:00·11:00·17:00입니다. scheduledTime의 한국 날짜를 사용하고 실제 실행이 15분 이상 늦으면 버립니다. 15분은 운영 기본값입니다. Cloudflare도 정시 실행을 보증하지 않습니다.

검증 전까지 GitHub 예약은 유지됩니다. 기존 발송기도 15분 제한으로 날짜가 바뀐 지연 발송을 막습니다. 기존 발송기는 Worker 중복 기록을 공유하지 않으므로 두 예약을 동시에 켜지 않습니다. 전환 후 수동 발송은 Worker를 사용합니다.

ntfy 무료 공개 주제는 이름을 아는 사람이 접근할 수 있습니다. 기존 구독은 유지하고 공개 식단만 보냅니다.
