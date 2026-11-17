# APK 만들기 (내 컴퓨터에서)
1. Node.js LTS, Android Studio(SDK 포함) 설치
2. 이 폴더에서 `npm install`
3. 웹 파일(`www/`)을 고쳤으면 `npx cap sync android`
4. `npx cap open android` → Android Studio 에서 Build > Build APK(s)
   (또는 `cd android && ./gradlew assembleDebug` → `android/app/build/outputs/apk/debug/app-debug.apk`)
5. APK 를 폰으로 옮겨 설치 (설정에서 '출처를 알 수 없는 앱' 허용)

# GitHub Actions 로 자동 빌드 (컴퓨터에 아무것도 안 깔아도 돼요)
1. GitHub 에 새 저장소를 만들고 이 폴더를 push (main 브랜치)
2. 저장소의 Actions 탭 → "Build APK" 실행이 끝날 때까지 기다리기 (처음엔 3~5분)
3. 완료된 실행을 열고 맨 아래 Artifacts 의 `2048-debug-apk` 다운로드 → 압축 풀면 app-debug.apk
4. 폰으로 옮겨 설치. 이후 push 할 때마다 새 APK 가 만들어져요.

# 웹 배포 (GitHub Pages) — 아이폰/PC 용
1. 저장소 Settings > Pages > Source 를 **GitHub Actions** 로 설정 (한 번만)
2. push 하면 `www/` 가 자동 배포돼요. 주소: https://<계정>.github.io/<저장소이름>/
3. 아이폰: Safari 로 주소를 열고 공유 버튼 > **홈 화면에 추가**
   PC: 주소를 북마크하거나 Chrome/Edge 주소창의 '앱 설치'
