# Firebase 설정 메모 (2048 앱)

## 쓰는 것
- Authentication: 이메일/비밀번호 (커플 사이트와 같은 계정)
- Firestore: 컬렉션 `game2048_users` (문서 id = 로그인한 사람의 uid)
  - 필드: `nickname`, `avatar`(프로필 사진 id), `best`(최고 점수), `bestTile`(최고 타일), `plays`(끝낸 판 수), `updatedAt`, `gold`(보유 골드), `daily`(오늘 미션 상태 {day, done, claimed}), `owned`(상점에서 산 물건 id 목록)
  - 이메일은 저장하지 않아요. 서로에게는 닉네임과 기록만 보여요.

## 한 번만 하면 되는 설정
1. Firebase 콘솔 > Firestore Database 가 만들어져 있어야 해요 (커플 사이트에서 이미 쓰고 있으면 그대로).
2. Firestore Database > 규칙 탭에서 기존 규칙은 **그대로 두고**(이전 단계에서 이미 `game2048_users` 블록을 넣었다면 그 블록을 아래 내용으로 **교체** — 골드 필드가 추가됐어요. 교체하지 않으면 골드 받기가 실패해요), `match /databases/{database}/documents { ... }` 안쪽에 아래 블록만 **추가**한 뒤 게시해요.

```
    // 2048 앱: 로그인한 사람은 서로의 기록을 읽고, 자기 문서만 쓸 수 있어요
    match /game2048_users/{uid} {
      allow read: if request.auth != null;
      allow create, update: if request.auth != null
        && request.auth.uid == uid
        && request.resource.data.keys().hasOnly(['nickname', 'avatar', 'best', 'bestTile', 'plays', 'updatedAt', 'gold', 'daily', 'owned'])
        && (!('nickname' in request.resource.data) || (request.resource.data.nickname is string && request.resource.data.nickname.size() <= 24))
        && (!('avatar' in request.resource.data) || (request.resource.data.avatar is string && request.resource.data.avatar.size() <= 20))
        && (!('best' in request.resource.data) || (request.resource.data.best is int && request.resource.data.best >= 0))
        && (!('bestTile' in request.resource.data) || (request.resource.data.bestTile is int && request.resource.data.bestTile >= 0))
        && (!('plays' in request.resource.data) || (request.resource.data.plays is int && request.resource.data.plays >= 0))
        && (!('gold' in request.resource.data) || (request.resource.data.gold is int && request.resource.data.gold >= 0 && request.resource.data.gold <= 1000000))
        && (!('daily' in request.resource.data) || (request.resource.data.daily is map && request.resource.data.daily.keys().hasOnly(['day', 'done', 'claimed'])))
        && (!('owned' in request.resource.data) || (request.resource.data.owned is list && request.resource.data.owned.size() <= 100));
      allow delete: if false;
    }
```

3. (권장) 둘만 쓰는 앱이니, Authentication > 설정 > 사용자 작업에서 **가입 허용(만들기)** 을 꺼 두면 낯선 사람이 계정을 만들어 기록을 볼 수 없어요. 새 계정이 필요하면 콘솔에서 직접 추가하면 돼요. (커플 사이트가 가입 기능을 쓰고 있다면 끄지 마세요.)
