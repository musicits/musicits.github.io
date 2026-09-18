# musicits.github.io

`https://tools.musicits.com/` 루트를 서빙하는 저장소입니다.

- `index.html` — 도구 모음 랜딩 페이지 (빌드 없는 단일 파일)
- `og-image.png` — 카톡·SNS 공유 썸네일 (1200×630)
- `logo.png` — 머리줄 music ITs 로고 (도구들과 같은 파일)
- `naver79034692a7a496d9ff4b2c3ba5994dfd.html` · `naver7196f38f13da87260dd08e4f73b5ae13.html`
  — 네이버 서치어드바이저 소유확인 파일 (지우지 마세요)
- `google51f0d768bb1eba7a.html` — 구글 서치콘솔 소유확인 파일 (지우지 마세요)
- `robots.txt` · `sitemap.xml` — 검색엔진용

robots.txt 는 호스트 루트에 있을 때만 크롤러가 읽습니다. 하위 경로에 둔 것은 무시되므로,
개별 도구의 사이트맵도 여기 robots.txt 에서 함께 알립니다. 자기 사이트맵이 없는 도구는
여기 `sitemap.xml` 에 주소를 직접 적어 둡니다.

네이버 소유확인은 두 가지 방법을 모두 적용해 뒀습니다. 확인 파일과 `index.html` 의
`naver-site-verification` 메타 태그입니다. 둘 다 지우지 마세요.

## 랜딩 페이지

`index.html` 하나에 HTML·CSS·JS 가 다 들어 있습니다. 빌드 과정이 없으니 파일을 고쳐
커밋하면 그대로 반영됩니다.

**색·재질·머리줄은 코덱 매치와 같은 값을 씁니다.** 도구 화면과 이 화면이 한 벌로 보이게
하려는 것이니, 토큰(`--main`, `--canvas`, `--glass-*`, `--r-*` …)을 고칠 때는 도구 쪽도
같이 고쳐야 합니다. 글꼴도 도구들과 같은 Pretendard 입니다.

- 머리줄은 도구 화면과 똑같은 유리 띠 — 로고 · 화면 이름 · 한 줄 설명 · 오른쪽 [다크|시스템|기본]
- 밝은 화면이 기본이고 기기 설정을 따릅니다. 직접 고른 값은 브라우저에 기억됩니다
- 폰 폭부터 같이 짰습니다. 카드는 넓은 화면에서 2열, 좁아지면 1열입니다
- 검색용 구조화 데이터(`ItemList`)에 도구 네 개가 들어 있습니다

**도구를 하나 더 만들면 세 곳을 같이 고칩니다.** ① `index.html` 의 JSON-LD `ItemList`
② 본문 도구 카드 ③ `sitemap.xml`

`logo.png` 는 코덱 매치와 같은 파일입니다 (다크 모드에서 반전해서 씁니다).
`og-image.png` 는 랜딩과 같은 색을 쓰는 별도 이미지라, 색이나 도구 목록을 바꾸면
이 이미지도 같이 갱신하세요.

## 도구

도구 자체는 각각 별도 저장소입니다.

| 도구 | 주소 | 저장소 |
| --- | --- | --- |
| 코덱 매치 | `/codec-match/` | https://github.com/musicits/codec-match |
| 폰 목업 스튜디오 | `/phone-mockup-studio/` | https://github.com/musicits/phone-mockup-studio |
| 매거진 커버 메이커 | `/magazine-cover-maker/` (모바일 `/m/`) | https://github.com/musicits/magazine-cover-maker |
| 사진기능사 필기 예상문제 | `/photo-exam/` | https://github.com/musicits/photo-exam |
