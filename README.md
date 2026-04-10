# slack_code_plan

Slack 채널을 모니터링하면서 개발 작업이 필요한 메시지를 감지하고, Claude CLI를 이용해 코드베이스 기준의 작업 계획을 자동으로 생성해 스레드에 응답하는 CLI 도구입니다.

## 사용법

한 번만 설치:

```bash
npm install -g github:wooyaggo/slack_code_plan
```

즉시 실행:

```bash
npx github:wooyaggo/slack_code_plan --help
```

초기 설정:

```bash
slack_code_plan init
```

도움말 확인:

```bash
slack_code_plan --help
```

채널 모니터링 시작:

```bash
slack_code_plan start <CHANNEL_ID>
```

예시:

```bash
slack_code_plan start C0123456789
```

## 개요

이 프로젝트는 다음 흐름으로 동작합니다.

1. 지정한 Slack 채널의 새 메시지와 스레드 메시지를 수신합니다.
2. 일반 메시지는 Claude 기반 분류기로 개발 요청 여부를 판별합니다.
3. 개발 요청으로 판단되면 첨부파일을 다운로드하고 내용을 정리합니다.
4. Claude CLI 세션을 생성하거나 이어서, 현재 코드베이스 기준의 실행 계획을 작성합니다.
5. 결과를 Slack 스레드에 상태 메시지 형태로 업데이트합니다.

`@봇멘션`이 포함된 메시지는 분류 결과와 관계없이 강제로 작업 요청으로 처리합니다.

## 요구 사항

- Node.js 20 이상 권장
- npm
- `claude` CLI가 PATH에 설치되어 있어야 함
- Slack App Bot Token (`xoxb-...`)
- Slack App Token (`xapp-...`, Socket Mode)

## 설치

### 로컬 개발 환경에서 실행

```bash
npm install
npm run build
```

개발 모드 실행:

```bash
npm run dev -- --help
```

### GitHub에서 직접 설치

전역 설치:

```bash
npm install -g github:wooyaggo/slack_code_plan
```

설치 없이 1회 실행:

```bash
npx github:wooyaggo/slack_code_plan --help
```

설치 또는 실행 후에는 아래 순서로 사용합니다.

```bash
slack_code_plan init
slack_code_plan start <CHANNEL_ID>
```

이미 전역 설치했다면 도움말은 아래 명령으로 확인할 수 있습니다.

```bash
slack_code_plan --help
```

## Slack 앱 준비

이 도구는 Bolt + Socket Mode 기반으로 동작합니다. Slack 앱에는 최소한 아래 준비가 필요합니다.

- Bot Token 발급
- App Token 발급(Socket Mode)
- 대상 채널에 봇 초대
- 메시지 이벤트 수신 가능하도록 앱 설정

`SLACK_BOT_USER_ID`는 선택값입니다. 비워 두면 실행 시 `auth.test`로 자동 조회합니다.

## 초기 설정

최초 1회 아래 명령으로 토큰을 저장합니다.

```bash
slack_code_plan init
```

설정은 `~/.slack_code_plan/.env`에 저장됩니다.

저장되는 값:

- `SLACK_BOT_TOKEN`
- `SLACK_APP_TOKEN`
- `SLACK_BOT_USER_ID` (선택)

## 동작 방식

### 1. 메시지 분류

- 새 일반 메시지는 Claude CLI 기반 분류 세션으로 개발 요청 여부를 판별합니다.
- 잡담으로 분류되면 무시합니다.
- `@봇멘션` 메시지는 무조건 작업 요청으로 취급합니다.

### 2. 첨부파일 처리

- Slack 첨부파일은 `~/.slack_code_plan/tmp/<thread_ts>/` 아래로 다운로드합니다.
- 텍스트 계열 파일은 내용을 읽어 프롬프트에 포함합니다.
- 이미지 파일은 경로와 메타데이터만 전달합니다.

### 3. 세션 생성 및 응답

- 새 요청은 Claude 세션을 생성해 실행 계획을 만듭니다.
- 같은 스레드의 후속 메시지는 기존 세션을 이어받아 응답합니다.
- 응답은 Slack 스레드 메시지로 업데이트됩니다.

### 4. 오분류 보정

- 멘션으로 강제 처리된 메시지는 `src/missed_examples.json` 학습 예시로 축적됩니다.
- 축적된 예시는 이후 분류 프롬프트 강화에 사용됩니다.

## 프로젝트 구조

```text
src/
  bin.ts                CLI 엔트리포인트
  init.ts               초기 설정 저장
  config.ts             설정 로드
  slack_monitor.ts      Slack 메시지 수신 및 라우팅
  classifier.ts         개발 요청 여부 분류
  attachment_handler.ts 첨부파일 다운로드/정리
  session_manager.ts    Claude 세션 생성 및 지속
  responder.ts          Slack 응답 전송
  cli.ts                외부 CLI 실행 래퍼
  types.ts              공용 타입
```

## 스크립트

```bash
npm run build   # TypeScript 빌드
npm run start   # 빌드 결과 실행
npm run dev     # tsx로 직접 실행
```

## 주의 사항

- GitHub 저장소 직접 설치와 `npx` 실행을 위해 빌드된 `dist/` 산출물을 저장소에 포함합니다. 따라서 설치 환경에 `tsc`가 없어도 실행 가능합니다.
- `start` 실행 위치가 프로젝트 루트로 간주됩니다. Claude CLI는 이 경로를 기준으로 코드베이스를 읽습니다.
- `createSession()` 내부에서 `git pull`을 수행하므로, 원격이 설정된 git 저장소에서 사용하는 것이 전제입니다.
- Slack 메시지 길이 제한을 고려해 긴 응답은 여러 청크로 분할 전송할 수 있습니다.
- 현재 저장소에는 테스트 코드가 포함되어 있지 않습니다. 변경 후에는 최소한 `npm run build`로 타입 검증을 권장합니다.

## 라이선스

`UNLICENSED`
