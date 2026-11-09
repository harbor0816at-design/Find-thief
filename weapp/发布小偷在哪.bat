@echo off
chcp 65001 >nul
cd /d "%~dp0"
where node >nul 2>nul
if errorlevel 1 (
  echo 没有找到 Node.js，正在用 winget 安装（可能弹出确认窗口）...
  winget install -e --id OpenJS.NodeJS.LTS --accept-source-agreements --accept-package-agreements
  echo.
  echo Node.js 安装完成后，请关闭这个窗口，再双击一次本脚本。
  pause
  exit /b
)
if not exist node_modules\miniprogram-ci (
  echo 首次运行，正在安装微信上传工具 miniprogram-ci ...
  call npm i miniprogram-ci --no-audit --no-fund --loglevel=error
)
node deploy.js
echo.
pause
