# BKG-SOOP 전적표 archive 연동 수정본 v2

## 이번 버전 반영 사항

### 1. 전적 일괄 추가 시 BKG.GG archive 동시 저장
- `archiveMatches`
- `memberArchive`
- `monthlyMatches`
- 기존 `players/{playerId}/records` 최근 30전 구조 유지

### 2. BKG.GG 초기 연동 기능 추가
관리자 로그인 후 좌측 관리자 버튼 영역에 `BKG.GG 초기 연동` 버튼이 표시됩니다.

이 기능은 현재 전적표의 `players/{playerId}/records`에 남아 있는 최근 승패 데이터를 BKG.GG용 `memberArchive`로 1회 복사합니다.

주의:
- 기존 최근 30전 데이터에는 경기별 묶음/날짜 정보가 없으므로 개인별 승패 기록으로 복사됩니다.
- 월별 참여율의 분모는 초기 연동 시 입력한 `해당 월 전체 진행 판 수`를 사용합니다.
- 같은 월은 중복 방지를 위해 한 번만 초기 연동할 수 있습니다.

### 3. 최근 일괄 전적 취소 기능 추가
관리자 로그인 후 좌측 관리자 버튼 영역에 `최근 일괄 전적 취소` 버튼이 표시됩니다.

이 기능은 가장 최근에 일괄 추가된 전적 1개를 취소하며, 아래 데이터를 함께 정리합니다.
- `archiveMatches/{matchId}` 삭제
- `memberArchive/{playerId}/{matchId}` 삭제
- `monthlyMatches/{month}/{matchId}` 삭제
- 연결된 최근 30전 기록 정리

### 4. 전적-archive 연결 ID 추가
`players/{playerId}/recordArchiveIds`가 추가됩니다.
- 기존 `records`와 같은 순서로 archive matchId를 저장합니다.
- 앞으로 일괄 추가한 전적은 취소 시 BKG.GG에서도 같이 제거됩니다.
- 개별 승/패 추가는 archive에 연결하지 않고 최근 30전만 수정합니다.

## 권장 사용 순서
1. 기존 Firebase JSON 백업 확인
2. 이 수정본을 기존 전적표 사이트에 업로드
3. 관리자 로그인
4. 만약 테스트로 잘못 들어간 archive가 있다면 `최근 일괄 전적 취소` 먼저 실행
5. `BKG.GG 초기 연동` 실행
6. BKG.GG 사이트에서 카드 검색 후 누적 전적 확인

