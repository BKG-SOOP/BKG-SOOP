# BKG-SOOP 전적표 - archive 연동 버전

기존 BKG-SOOP 전적표에 BKG.GG 누적 전적용 archive 저장을 추가한 버전입니다.

## 변경 사항

- 기존 `players/{playerId}/records` 최근 30전 구조 유지
- 전적 일괄 추가 시 아래 경로에 누적 archive 동시 저장
  - `bkgSoopRecordBoard/archiveMatches/{matchId}`
  - `bkgSoopRecordBoard/memberArchive/{playerId}/{matchId}`
  - `bkgSoopRecordBoard/monthlyMatches/{YYYY-MM}/{matchId}`
- 기존 멤버 정보 경로 `bkgSoopRecordBoard/players`는 그대로 사용
- `ROOT_PATH`는 기존과 동일하게 `bkgSoopRecordBoard`

## 중요

BKG.GG의 월별 참여율은 “판 수 기준”입니다. 1개의 실제 판을 1개의 matchId로 저장해야 하므로, 누적 archive 저장은 `전적 추가` 버튼의 일괄 입력 기능에만 연결되어 있습니다.

개별 멤버 행의 승/패 버튼은 기존 최근 30전 관리용으로 유지되며, BKG.GG 누적 archive에는 반영하지 않습니다.

## 데이터 보존

archive 추가는 기존 `players` 전체를 덮어쓰지 않고 새 경로만 추가 저장합니다.
