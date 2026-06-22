# BKG-SOOP 전적표 archive 연동 v3

기존 BKG-SOOP 전적표에 BKG.GG 누적 전적 연동 기능을 추가한 버전입니다.

## v3 추가 내용

### 1. BKG.GG 전적 관리
관리자 로그인 후 사이드 버튼 영역에 `BKG.GG 전적 관리` 버튼이 추가됩니다.

- 최근 archive 전적 목록 확인
- 테스트용 일괄 전적 삭제
- 잘못 입력된 archive 전적 삭제
- 삭제 시 아래 경로 동시 정리
  - `archiveMatches/{matchId}`
  - `memberArchive/{playerId}/{matchId}`
  - `monthlyMatches/{month}/{matchId}`
  - 연결된 `players/{playerId}/records`
  - 연결된 `players/{playerId}/recordArchiveIds`

### 2. BKG.GG 누적 보정
관리자 로그인 후 `BKG.GG 누적 보정` 버튼이 추가됩니다.

초기화되었거나 누락된 과거 전적을 멤버별로 수동 보정할 수 있습니다.

입력 항목:
- 멤버 선택
- 보정 월
- 추가 승리 수
- 추가 패배 수
- 메모

저장 경로:
- `manualAdjustments/{playerId}/{adjustmentId}`

보정값은 BKG.GG에서 누적 전적과 월별 전적에는 포함되지만, 최근 5전에는 포함되지 않습니다.

### 3. 기존 기능 유지
- 기존 `players` 구조 유지
- 최근 30전 구조 유지
- 기존 일괄 전적 추가 기능 유지
- 일괄 전적 추가 시 archive 동시 저장 유지
- `BKG.GG 초기 연동` 기능 유지
- `최근 일괄 전적 취소` 기능 유지

## 주의 사항

- Firebase 백업 후 적용하는 것을 권장합니다.
- `BKG.GG 전적 관리`에서 삭제하는 archive 전적은 BKG.GG 집계에서도 제외됩니다.
- 수동 보정은 경기 순서가 없는 누적 보정값이므로 최근 5전에는 반영하지 않습니다.
