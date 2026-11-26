# HTTP 500 조사와 단일 진단 절차

## 확인된 사실

사용자 출력에서 인증과 dry-run은 성공했고, 실제 저녁 발송은 HTTP 500으로 실패했습니다. 기존 저녁 기록은 attempting으로 남았습니다. 이는 발송 예약 쓰기가 완료됐음을 뜻합니다. ntfy가 받았는지는 해당 기록만으로 판단할 수 없습니다. 이후 재시도의 duplicate는 이 기록을 보호한 결과이며 최초 500의 원인이 아닙니다.

현재 작업 도구에는 대시보드를 제어할 브라우저가 없습니다. Cloudflare OAuth 승인 후 토큰 교환도 작업 환경의 네트워크 정책에 차단됐습니다. 인증을 반복하지 않았습니다. 기존 운영 오류의 Cloudflare 로그를 직접 조회하지 못했으므로 최초 원인을 확정하지 않습니다.

## 수정

외부 HTTP 요청 전체를 blockConcurrencyWhile로 잠그는 구조를 제거했습니다. 공식 문서상 이 블록은 30초 제한을 넘거나 예외가 전파되면 Durable Object를 재설정할 수 있습니다. 운영 오류의 확정 원인이라는 의미는 아닙니다.

ntfy 요청 직전 storage.transaction에서 기존 기록 확인과 attempting 기록을 원자적으로 처리합니다. 동시에 요청이 들어와도 한 요청만 발송권을 얻습니다. 외부 통신은 거래 밖에서 실행합니다. 기존 Object 이름, 클래스, migration, 날짜/끼니 키와 기존 기록은 그대로 유지합니다.

저장소 읽기·예약 쓰기·완료 쓰기·GitHub 조회·ntfy 연결·ntfy HTTP 거절을 stage와 traceId로 구분합니다. Secret은 오류 메시지에서 가립니다. 진단 요청은 probe/날짜/끼니 키에 별도 기록하고 기존 production 키를 읽거나 삭제·갱신하지 않습니다. 같은 날짜·끼니 진단도 한 번만 발송합니다. ntfy 우선순위와 기존 주제는 유지합니다.

## PC에서 필요한 최소 작업

배포 폴더에서 다음 명령을 한 줄씩 실행합니다. 기존 인증과 암호화된 ADMIN_TOKEN을 재사용합니다.

    git fetch origin main
    git restore --source=origin/main -- worker/index.mjs finish-worker-setup.mjs
    npx.cmd wrangler deploy
    node .\finish-worker-setup.mjs --diagnose dinner

진단은 기존 기록 조회 → 식단 미리보기 → 별도 진단 발송 → 중복 차단 검사를 수행합니다. PRODUCTION_RECORD와 PROBE_RESULT 또는 WORKER_FAILURE 출력만으로 상태를 확인할 수 있습니다. 별도 tail 창은 기본 절차에 필요하지 않습니다. 실패 응답에 stage·upstreamStatus·traceId를 표시합니다. 기존 attempting을 삭제해 재발송하지 않습니다.

실제 두 폰의 식단 수신을 확인한 뒤에만 GitHub 발송을 비활성화하고 Cloudflare 예약을 켭니다. Cron 활성화 명령과 Windows 수집 설정은 STABILIZATION.md를 따릅니다. 이 수정 과정에서는 실제 예약 설정을 전환하지 않았습니다.

## 검증 구분

node --test test/*.test.mjs는 모의 네트워크·저장소 테스트입니다. npm run test:runtime은 실제 로컬 workerd 및 SQLite Durable Object에서 동시 요청 10개가 한 건만 발송하도록 예약되는지, API 거절이 보존되는지, 진단 발송이 production 기록을 바꾸지 않는지 검사합니다. 이 테스트의 외부 GitHub·ntfy 응답은 가짜입니다. Cloudflare 운영망 발송이나 실제 폰 수신 성공과 구분합니다.

공식 문서
- https://developers.cloudflare.com/durable-objects/api/state/
- https://developers.cloudflare.com/durable-objects/best-practices/rules-of-durable-objects/
