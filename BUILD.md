# APK 만들기 (내 컴퓨터에서)
1. Node.js LTS, Android Studio(SDK 포함) 설치
2. 이 폴더에서 `npm install`
3. 웹 파일(`www/`)을 고쳤으면 `npx cap sync android`
4. `npx cap open android` → Android Studio 에서 Build > Build APK(s)
   (또는 `cd android && ./gradlew assembleDebug` → `android/app/build/outputs/apk/debug/app-debug.apk`)
5. APK 를 폰으로 옮겨 설치 (설정에서 '출처를 알 수 없는 앱' 허용)
