#!/bin/bash
set -e

REPO="https://github.com/wooyaggo/slack_code_plan.git"
INSTALL_DIR="${HOME}/.slack_code_plan/app"
BIN_LINK="/usr/local/bin/slack_code_plan"

echo "[slack_code_plan] 설치 시작..."

# clone 또는 pull
if [ -d "$INSTALL_DIR" ]; then
  echo "[slack_code_plan] 기존 설치 발견. 업데이트 중..."
  cd "$INSTALL_DIR"
  git pull --quiet
else
  echo "[slack_code_plan] 다운로드 중..."
  git clone --quiet "$REPO" "$INSTALL_DIR"
  cd "$INSTALL_DIR"
fi

# 의존성 설치 + 빌드
echo "[slack_code_plan] 의존성 설치 중..."
npm install --silent --no-fund --no-audit 2>/dev/null

echo "[slack_code_plan] 빌드 중..."
npm run build --silent

# 심볼릭 링크 생성
if [ -w "/usr/local/bin" ]; then
  ln -sf "$INSTALL_DIR/dist/bin.js" "$BIN_LINK"
  chmod +x "$BIN_LINK"
else
  sudo ln -sf "$INSTALL_DIR/dist/bin.js" "$BIN_LINK"
  sudo chmod +x "$BIN_LINK"
fi

echo ""
echo "[slack_code_plan] 설치 완료!"
echo ""
echo "사용법:"
echo "  slack_code_plan init              # 초기 설정"
echo "  slack_code_plan start <CHANNEL_ID> # 모니터링 시작"
echo ""
