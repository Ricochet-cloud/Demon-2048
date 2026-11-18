# Firebase 설정 메모 (2048 앱)

## 쓰는 것
- Authentication: 이메일/비밀번호 (커플 사이트와 같은 계정)
- Firestore: 컬렉션 `game2048_users` (문서 id = 로그인한 사람의 uid), `game2048_cheers` (응원, 문서 id = 보낸이_받는이_날짜)
  - 필드: `nickname`, `avatar`(프로필 사진 id), `best`(최고 점수), `bestTile`(최고 타일), `plays`(끝낸 판 수), `updatedAt`, `gold`(보유 골드), `daily`(오늘 미션 상태 {day, done, claimed}), `owned`(상점에서 산 물건 id 목록), `frame`(고른 사진 테두리), `title`(고른 칭호), `bio`(상태 메시지), `week`·`weekClaim`(주간 순위), `bg`(카드 배경), `nameFx`(이름 꾸미기), `streak`(연속 출석 {last, n, claimed}), `challenge`·`chDone`·`chClaim`(오늘의 도전)
  - 이메일은 저장하지 않아요. 서로에게는 닉네임과 기록만 보여요.

## 한 번만 하면 되는 설정
1. Firebase 콘솔 > Firestore Database 가 만들어져 있어야 해요 (커플 사이트에서 이미 쓰고 있으면 그대로).
2. Firestore Database > 규칙 탭에서 기존 규칙은 **그대로 두고**(이전 단계에서 이미 `game2048_users` 블록을 넣었다면 그 블록을 아래 내용으로 **교체** — 프레임·칭호·상태 메시지 필드가 추가됐어요. 교체하지 않으면 그 기능이 저장에 실패해요), `match /databases/{database}/documents { ... }` 안쪽에 아래 블록만 **추가**한 뒤 게시해요. (`game2048_cheers` 블록은 새로 추가돼요.)

```
    // 2048 앱: 로그인한 사람은 서로의 기록을 읽고, 자기 문서만 쓸 수 있어요
    match /game2048_users/{uid} {
      allow read: if request.auth != null;
      allow create, update: if request.auth != null
        && request.auth.uid == uid
        && request.resource.data.keys().hasOnly(['nickname', 'avatar', 'best', 'bestTile', 'plays', 'updatedAt', 'gold', 'daily', 'owned', 'frame', 'title', 'bio', 'week', 'weekClaim', 'bg', 'nameFx', 'streak', 'chDone', 'chClaim', 'challenge', 'jokers', 'bestJk'])
        && (!('nickname' in request.resource.data) || (request.resource.data.nickname is string && request.resource.data.nickname.size() <= 24))
        && (!('avatar' in request.resource.data) || (request.resource.data.avatar is string && request.resource.data.avatar.size() <= 20))
        && (!('best' in request.resource.data) || (request.resource.data.best is int && request.resource.data.best >= 0))
        && (!('bestTile' in request.resource.data) || (request.resource.data.bestTile is int && request.resource.data.bestTile >= 0))
        && (!('plays' in request.resource.data) || (request.resource.data.plays is int && request.resource.data.plays >= 0))
        && (!('gold' in request.resource.data) || (request.resource.data.gold is int && request.resource.data.gold >= 0 && request.resource.data.gold <= 1000000))
        && (!('daily' in request.resource.data) || (request.resource.data.daily is map && request.resource.data.daily.keys().hasOnly(['day', 'done', 'claimed'])))
        && (!('owned' in request.resource.data) || (request.resource.data.owned is list && request.resource.data.owned.size() <= 100))
        && (!('frame' in request.resource.data) || (request.resource.data.frame is string && request.resource.data.frame.size() <= 20))
        && (!('title' in request.resource.data) || (request.resource.data.title is string && request.resource.data.title.size() <= 20))
        && (!('bio' in request.resource.data) || (request.resource.data.bio is string && request.resource.data.bio.size() <= 40))
        && (!('week' in request.resource.data) || (request.resource.data.week is map && request.resource.data.week.keys().hasOnly(['k', 's', 'pk', 'ps'])))
        && (!('weekClaim' in request.resource.data) || (request.resource.data.weekClaim is string && request.resource.data.weekClaim.size() <= 10))
        && (!('bg' in request.resource.data) || (request.resource.data.bg is string && request.resource.data.bg.size() <= 20))
        && (!('nameFx' in request.resource.data) || (request.resource.data.nameFx is string && request.resource.data.nameFx.size() <= 20))
        && (!('streak' in request.resource.data) || (request.resource.data.streak is map && request.resource.data.streak.keys().hasOnly(['last', 'n', 'claimed'])))
        && (!('chDone' in request.resource.data) || (request.resource.data.chDone is string && request.resource.data.chDone.size() <= 10))
        && (!('chClaim' in request.resource.data) || (request.resource.data.chClaim is string && request.resource.data.chClaim.size() <= 10))
        && (!('challenge' in request.resource.data) || (request.resource.data.challenge is map && request.resource.data.challenge.keys().hasOnly(['day', 'score', 'tile', 'pd', 'ps'])))
        && (!('jokers' in request.resource.data) || (request.resource.data.jokers is map && request.resource.data.jokers.keys().hasOnly(['undo', 'erase', 'shuffle', 'upgrade']) && request.resource.data.jokers.get('undo', 0) is int && request.resource.data.jokers.get('undo', 0) >= 0 && request.resource.data.jokers.get('undo', 0) <= 99 && request.resource.data.jokers.get('erase', 0) is int && request.resource.data.jokers.get('erase', 0) >= 0 && request.resource.data.jokers.get('erase', 0) <= 99 && request.resource.data.jokers.get('shuffle', 0) is int && request.resource.data.jokers.get('shuffle', 0) >= 0 && request.resource.data.jokers.get('shuffle', 0) <= 99 && request.resource.data.jokers.get('upgrade', 0) is int && request.resource.data.jokers.get('upgrade', 0) >= 0 && request.resource.data.jokers.get('upgrade', 0) <= 99))
        && (!('bestJk' in request.resource.data) || request.resource.data.bestJk is bool);
      allow delete: if false;
    }

    // 응원 보내기: 보낸 사람과 받는 사람만 읽고, 보낸 사람이 하루에 한 사람에게 한 번만 만들 수 있어요 (문서 id 가 보낸이_받는이_날짜)
    match /game2048_cheers/{id} {
      allow read: if request.auth != null && (resource.data.to == request.auth.uid || resource.data.from == request.auth.uid);
      allow create: if request.auth != null
        && request.resource.data.keys().hasOnly(['from', 'to', 'day', 'msg', 'at'])
        && request.resource.data.from == request.auth.uid
        && request.resource.data.to is string && request.resource.data.to != request.auth.uid
        && request.resource.data.day is string && request.resource.data.day.size() <= 10
        && request.resource.data.msg is string && request.resource.data.msg.size() <= 20
        && id == request.auth.uid + '_' + request.resource.data.to + '_' + request.resource.data.day;
      allow update, delete: if false;
    }
```

3. (권장) 둘만 쓰는 앱이니, Authentication > 설정 > 사용자 작업에서 **가입 허용(만들기)** 을 꺼 두면 낯선 사람이 계정을 만들어 기록을 볼 수 없어요. 새 계정이 필요하면 콘솔에서 직접 추가하면 돼요. (커플 사이트가 가입 기능을 쓰고 있다면 끄지 마세요.)
