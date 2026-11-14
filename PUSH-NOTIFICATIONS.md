# 경기푸른미래관 식단 알림

Windows PC가 이번 주와 다음 주 식단을 수집해 GitHub의 meals.json을 갱신합니다. GitHub Actions는 한국 시간 07:00, 11:00, 17:00에 날짜별 메뉴를 ntfy로 보냅니다. 이미 저장된 식단은 PC가 꺼져도 발송할 수 있습니다. 당일 식단이 비어 있으면 발송하지 않습니다. Actions 예약은 부하에 따라 지연될 수 있습니다.

## 첫 설정

1. Git for Windows가 설치된 PC에서 이 저장소를 전용 폴더로 clone하고 main을 사용합니다.
2. Git 사용자 이름과 이메일을 설정하고, Git Credential Manager로 저장소 쓰기 권한이 있는 GitHub 계정에 로그인합니다. 토큰을 파일에 넣지 않습니다.
3. ntfy 앱에서 임의의 긴 영문·숫자 주제를 구독합니다. 공개 호스트의 주제는 이름을 아는 사람이 접근할 수 있으니 식단만 사용합니다.
4. 저장소 Settings → Secrets and variables → Actions에 같은 주제를 NTFY_TOPIC 저장소 비밀로 등록합니다.
5. Actions → Meal notifications → Run workflow에서 메뉴 종류를 골라 테스트하고, 갤럭시 잠금 화면에 메뉴가 표시되는지 확인합니다.

## Windows에서 수집

전용 clone 폴더의 PowerShell에서 실행합니다.

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\sync-meals.ps1
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\install-schedule.ps1
```

첫 명령이 수집과 GitHub 동기화를 수행합니다. 두 번째 명령은 현재 Windows 사용자의 로그인 시 및 매일 06:30(PC 현지 시각)에 작업을 실행하도록 등록합니다. PC가 켜져 있고 사용자가 로그인한 상태에서 수집합니다.

친구 PC로 이전할 때는 먼저 그 PC에서 원본 접속을 확인한 뒤 같은 절차를 반복합니다. 쓰기 권한이 필요한 경우 친구 계정에 부여하고 친구 계정의 Git 인증을 사용합니다. 두 PC에서 동시에 갱신하는 것을 피하려면 이전 PC의 작업을 비활성화합니다.
