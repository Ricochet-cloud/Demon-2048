# 2048 (12귀월) 단독 버전

서버·로그인 없이 `index.html` 하나로 돌아가요. 빌드 도구도 필요 없어요.

## 실행
- PC: `index.html` 을 더블클릭하면 브라우저에서 바로 열려요.
- 폰/앱: 아래 "안드로이드 앱으로 만들기" 참고.

## 폴더
- `index.html` 화면
- `css/game.css` 스타일
- `js/game.js` 게임 로직 (맨 위 `설정` 에서 판 크기·애니메이션 시간·4 가 나올 확률을 바꿀 수 있어요)
- `images/` 타일 그림 (파일 이름 = 타일 숫자, 2048 초과는 `big.webp`)
- `fonts/Galmuri-11.subset.ttf` 갈무리 폰트 (한글 2,350자 + 영문/숫자만 담아 용량을 줄인 것)
- `icon-512.png` 아이콘 (앱 아이콘으로 쓸 때 교체하세요)

## 저장
`localStorage` 키 `game2048.v1` 에 최고 점수·최고 타일·진행 중인 판이 저장돼요. 앱을 껐다 켜면 이어서 해요.

## 사이트 버전에서 뺀 것
Firebase 로그인, 서버 기록(상대 최고기록), 뽑기권 보상(512 타일), 개발 모드 버튼.

## 안드로이드 앱으로 만들기 (추천: Capacitor)
1. 이 폴더를 `www/` 로 두고 `npm i @capacitor/core @capacitor/cli @capacitor/android`
2. `npx cap init` → webDir 을 이 폴더로 지정, `npx cap add android`, `npx cap sync`
3. Android Studio 에서 열어 빌드. (WebView 는 `file://` 이어도 동작하도록 일반 스크립트로 만들어 뒀어요.)
- 세로 고정은 `AndroidManifest.xml` 의 activity 에 `android:screenOrientation="portrait"`.
- 폰트에 없는 글자(이모지 등)는 기기 기본 폰트로 보여요. 한글 문구를 바꿨는데 글자가 깨지면 `pyftsubset` 로 폰트를 다시 만들어야 해요(2,350자 밖의 한글을 쓸 때만).
- 타일 그림(귀멸의 칼날 팬아트)은 스토어에 올릴 때 저작권 이슈가 있을 수 있어요. 공개 배포 전에 직접 만든 그림으로 바꾸는 걸 권해요.
