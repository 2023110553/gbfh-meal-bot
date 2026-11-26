# 2026-11-27 안정화

## 알림 시각

모두 KST입니다. 3~11월 평일 아침 05:30, 12~2월 평일 아침 06:00, 주말·공휴일 아침 06:00, 평일 점심 10:30, 주말·공휴일 점심 11:00, 매일 저녁 17:00입니다. 일요일도 식단이 있으면 보냅니다.

UTC Cron 4개가 KST 후보 시각 05:30·06:00·10:30·11:00·17:00을 호출합니다. scheduledTime의 KST 날짜·요일·월·공휴일을 확인해 해당 식사 시각만 선택합니다. 후보가 맞지 않으면 건너뛰며 15분 이상 늦은 실행도 버립니다. 중복 기록은 기존 날짜/끼니 키를 그대로 사용합니다.

holidays.json은 date-holidays 3.39.2의 한국 public 규칙으로 2026~2030년 법정·대체공휴일을 생성한 것입니다. 설·추석 연휴의 전체 기간을 포함합니다. 2026-06-03 지방선거일도 추가했습니다. 임시공휴일·새 선거일·법 개정은 실시간으로 자동 수신하지 않습니다. 새 지정이 있으면 달력 갱신과 재배포가 필요합니다. 2031년부터 달력이 없으면 예약 발송을 실패 처리해 잘못된 평일 판단을 막습니다.

## 최초 인증 설정과 일반 테스트

기존 finish-worker-setup은 매번 토큰을 바꿨습니다. 이제 Windows DPAPI로 암호화한 토큰을 %LOCALAPPDATA%\GBFH\worker-admin.dpapi에 저장하고 같은 Windows 계정에서 재사용합니다. 첫 1회만 --init을 사용합니다. 비밀은 출력·커밋하지 않습니다.

    npm.cmd install
    node .\finish-worker-setup.mjs --init --dry-run breakfast
    node .\finish-worker-setup.mjs breakfast
    node .\finish-worker-setup.mjs lunch
    node .\finish-worker-setup.mjs dinner

첫 명령의 --init은 현재 저장된 토큰을 Cloudflare에 등록합니다. 이후 일반 테스트는 Secret을 갱신하지 않습니다. 인증 불일치가 있으면 --init을 다시 사용해 같은 값을 재등록합니다. dry-run의 401 응답만 최대 10초 동안 재확인합니다. 실제 발송 요청은 자동 재시도하지 않습니다.

기존 날짜·끼니 발송 기록이 있으면 실제 테스트도 DUPLICATE_BLOCKED입니다. 테스트 때문에 중복 기록을 지우지 않습니다. 각 폰에서 실제 수신을 확인해야 완료입니다. 같은 날짜 테스트는 정규 발송 기록을 사용하므로 그 끼니의 예약 알림은 중복 차단됩니다.

## 배포와 전환

Cloudflare 인증이 있는 Windows PC에서 실행합니다. 첫 배포는 예약 없는 기본 설정을 사용합니다.

    npx.cmd wrangler deploy

기존 ntfy 주제는 그대로 사용합니다. Secret이 없을 때만 npx.cmd wrangler secret put NTFY_TOPIC으로 등록합니다.

실제 갤럭시·아이폰 수신 확인 후 GitHub Actions의 Meal notifications 워크플로를 Disable workflow로 비활성화하고 실행 중인 발송 작업이 없는지 확인합니다. 그다음 예약을 켭니다.

    npx.cmd wrangler deploy --config wrangler.cron.jsonc
    npx.cmd wrangler tail

실제 예약 확인은 Cloudflare 대시보드 Worker → Settings → Trigger Events에서 UTC Cron 4개를 확인합니다. 예약 반영에 최대 15분이 걸릴 수 있고 정시 실행을 보증하지 않습니다. tail은 다음 실행의 실제 로그를 확인하는 명령입니다. 이후 배포도 --config wrangler.cron.jsonc를 사용해야 예약을 유지합니다. 기본 설정으로 배포하면 예약이 해제됩니다.

Workers Free를 유지합니다. 유료 플랜 가입이나 카드 등록은 필요하지 않습니다. 계정의 실제 플랜 상태는 배포 PC에서 확인합니다.

## Windows 수집

저장소가 있는 폴더에서 절대 실행 경로로 호출합니다.

    & "$env:SystemRoot\System32\WindowsPowerShell\v1.0\powershell.exe" -NoProfile -ExecutionPolicy Bypass -File .\sync-meals.ps1
    & "$env:SystemRoot\System32\WindowsPowerShell\v1.0\powershell.exe" -NoProfile -ExecutionPolicy Bypass -File .\install-schedule.ps1
    & "$env:SystemRoot\System32\WindowsPowerShell\v1.0\powershell.exe" -NoProfile -ExecutionPolicy Bypass -File .\diagnose-schedule.ps1

로그인 시와 PC 현지 시간 04:30에 수집합니다. PC가 꺼져 있어도 GitHub에 저장된 날짜는 Worker가 읽습니다. 새 데이터 수집은 PC가 켜지고 로그인되어 있어야 가능합니다. 사용자 수정 파일은 보존하고 임시 worktree로 수집·업로드합니다. 로그는 %LOCALAPPDATA%\GBFH\sync.log입니다. 마지막 작업 결과 0과 GitHub의 meals.json 갱신을 함께 확인합니다. 작업 미등록도 진단 명령이 안내합니다. Access denied이면 해당 Windows 계정에서 작업 스케줄러 등록 권한을 확인해야 합니다.

## 팝업

Worker가 보내는 알림에 priority 4를 추가했습니다. ntfy 앱의 해당 주제가 음소거되지 않았는지 확인합니다. 갤럭시 설정 → 알림 → 앱 알림 → ntfy에서 알림·팝업·잠금화면 표시를 허용하고, 알림 카테고리의 high 우선순위를 소리 및 팝업 표시로 설정합니다. One UI 버전에 따라 알림 고급 설정의 앱별 알림 카테고리 관리 옵션을 먼저 켜야 합니다. 방해금지와 절전 제한도 확인합니다. iPhone은 설정 → 알림 → ntfy에서 배너·잠금화면·사운드를 허용하고 집중 모드·알림 요약 설정을 확인합니다. 발송 성공이 시스템 팝업 표시를 보증하지 않습니다.

## 검증 구분

로컬 모의 테스트에서 월·계절·주말·공휴일·대체공휴일·설/추석 전체 기간·UTC 날짜 변경·후보 시간 제외·15분 경계·빈 데이터·원산지 제거·중복·API 오류를 검사합니다. 테스트와 번들 검사는 실배포·폰 수신·실제 Cron 결과와 별개입니다.

공식 안내
- https://docs.ntfy.sh/subscribe/phone/
- https://docs.ntfy.sh/publish/
- https://developers.cloudflare.com/workers/configuration/cron-triggers/
- https://github.com/commenthol/date-holidays
