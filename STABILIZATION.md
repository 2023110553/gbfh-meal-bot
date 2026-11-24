# 2026-11-24 조사와 검증

## 확인된 사실

- 공개 실행 목록의 마지막 schedule은 2026-11-16T09:02:36Z입니다. 이후 실행이 없는 원인은 미확정입니다.
- 실행 43727960897, job 132853921864는 cron 0 8 * * *를 2026-11-15T15:06:04Z에 실행했고 ntfy accepted 2026-11-16 (dinner)를 출력했습니다. 한국 시간 16일 00:06으로 목표보다 약 7시간 지연됐습니다.
- 기존 코드는 실행 날짜를 쓰고 지연 검사가 없어 날짜 변경 후 오발송이 가능합니다.
- 기존 데이터 마지막 날짜는 11월 21일입니다.
- dirty checkout이면 수집 전에 종료하는 코드 결함이 있습니다. 실제 Windows에서 갱신이 멈춘 원인이었는지는 미확정입니다.
- 현재 작업 환경은 Linux여서 사용자 Windows 예약 등록·실행·Git 인증은 조회하지 못했습니다.

## 실제 검증

원본 HTTP 조회에 성공했습니다. 행 날짜를 대조해 11월 22~29일의 등록 식단 8일을 추가했습니다. 30일 이후는 비어 있습니다. 오늘 24일 점심 JSON에서 파개장·참조기오븐구이 등의 본문 생성도 확인했습니다. 기존 Actions 로그에서 ntfy 접수 기록을 확인했습니다. 이번 변경 후 폰 수신은 미검증입니다.

## 모의 검증

npm test에서 정상 아침·점심·저녁, 다음 날 00시 지연, 원산지 제거, 빈 데이터, dry-run, 동일 날짜·끼니 중복, GitHub 503, ntfy 429, 응답 유실 시 재발송 방지를 검사합니다.

Worker 테스트는 메모리 저장소와 가짜 fetch를 사용합니다. Cloudflare 배포·실제 Durable Object 동시성·예약 시각·ntfy 수신 검증이 아닙니다. Windows PowerShell 실행도 미검증입니다.

## 남은 단계

사용자 요청으로 코드와 GitHub 반영부터 진행합니다. Cloudflare 인증·기존 NTFY_TOPIC 등록·실기기 수신·예약 전환·Windows 작업 실행 확인이 남습니다. 기존 GitHub 예약은 유지하며 새 Worker 예약은 비활성입니다.

SQLite Durable Objects는 Free 플랜에서 사용 가능하고 무료 제한 초과 시 작업이 실패합니다. 실제 계정 Free 플랜 상태는 배포 전 확인해야 합니다.

공식 문서
- https://developers.cloudflare.com/durable-objects/platform/pricing/
- https://developers.cloudflare.com/workers/configuration/cron-triggers/
- https://docs.github.com/en/actions/reference/workflows-and-actions/events-that-trigger-workflows#schedule
