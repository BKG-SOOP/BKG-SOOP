# BKG-SOOP 전적표 - BKG.GG archive 연동 + 0티어 최하 병합본

이 버전은 기존 `BKG-SOOP_전적표_archive연동` 파일을 기준으로, 오늘 추가한 `0티어 / 최하` 티어와 안전한 전체 전적 초기화를 병합한 버전입니다.

## 반영 사항

- `0티어` 하위 분류에 `최하` 추가
  - `GOD / 상 / 중 / 하 / 최하`
- 전적 일괄 추가 시 BKG.GG가 읽는 archive 경로에 동시 저장
  - `bkgSoopRecordBoard/archiveMatches/{matchId}`
  - `bkgSoopRecordBoard/memberArchive/{playerId}/{matchId}`
  - `bkgSoopRecordBoard/monthlyMatches/{YYYY-MM}/{matchId}`
- 기존 BKG-SOOP 최근 30전 경로도 유지
  - `bkgSoopRecordBoard/players/{playerId}/records`
- 전체 초기화 버튼은 멤버를 삭제하지 않고 최근 30전 `records`만 비웁니다.
- 전체 초기화는 BKG.GG 누적 archive 데이터를 삭제하지 않습니다.

## 중요

BKG.GG의 7월 참여율과 월별 전적은 `monthlyMatches`, `memberArchive` 기준으로 계산됩니다.
따라서 반드시 이 병합본의 `전적 추가` 기능으로 전적을 입력해야 BKG.GG에 반영됩니다.

개별 멤버 행의 `승`, `패`, `취소` 버튼은 기존처럼 BKG-SOOP 최근 30전 관리용입니다. BKG.GG archive에는 반영되지 않습니다.

## 적용 권장

현재 사이트 파일에서 `script.js`만 교체해도 되지만, 실수를 줄이려면 이 ZIP 전체를 배포하는 것을 권장합니다.


## 2026-07-01 선택 전적 삭제 추가

- 관리자 로그인 시 우측 상단에 `전적 선택 삭제` 버튼이 표시됩니다.
- `전적 일괄 추가`로 저장된 archive 전적 목록을 날짜/닉네임으로 검색하고 체크해서 삭제할 수 있습니다.
- 삭제 시 아래 Firebase 경로를 함께 정리합니다.
  - `bkgSoopRecordBoard/archiveMatches/{matchId}`
  - `bkgSoopRecordBoard/memberArchive/{playerId}/{matchId}`
  - `bkgSoopRecordBoard/monthlyMatches/{YYYY-MM}/{matchId}`
  - 영향받은 멤버의 `players/{playerId}/records` 최근 30전 재계산
- BKG.GG의 월별 전적, 월별 참여율, 최근 5전에서 삭제 전적이 같이 빠지도록 구성했습니다.
## 2026-07-01 사이드바 티어 점수 표시 추가

- 왼쪽 사이드바 티어 이동 표에 점수를 함께 표시합니다.
  - 예: `GOD (160)`, `상 (145)`, `최하 (110)`
- 실제 Firebase에 저장되는 티어/하위티어 값은 기존과 동일하게 `GOD`, `상`, `중`, `하`, `최하` 등으로 유지됩니다.
- 멤버 추가/수정/티어 이동 기능의 데이터 구조는 변경하지 않았습니다.
