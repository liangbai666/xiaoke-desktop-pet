@echo off
chcp 65001 >nul
cd /d "%~dp0"
if not exist node_modules (
  echo 首次运行，正在安装依赖（需要联网，请稍候）...
  npm install
)
echo 启动小柯桌面萌宠...
npm start
pause
