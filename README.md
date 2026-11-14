# 기숙사 식단 챗봇

Vercel Serverless Function을 서울 리전(`icn1`)에서 실행해 주간 식단을 조회합니다.

## API
- `/api/test?symd=20261114`: 원본 접속 진단 (실행 리전 포함)
- `/api/meal?symd=20261114`: 일~토 식단 JSON
- `/api/meal?symd=20261114&format=kakao`: 카카오 i 오픈빌더 스킬 응답 형식

조회 기준일은 `symd=YYYYMMDD`입니다. Kakao 오픈빌더에서 스킬 URL로 `/api/meal?format=kakao`를 설정하면 됩니다. 카카오에서 POST 요청을 보내는 경우에도 쿼리의 `format=kakao`는 유지됩니다.

## 배포
GitHub main에 연결된 Vercel 프로젝트가 자동 배포됩니다. 프로젝트는 Hobby 범위와 서울 리전을 사용합니다. 실제 접속 성공 여부는 배포 후 `/api/test`의 `status`, `hasFoodTable`, `region`으로 확인하세요.
