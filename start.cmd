@echo off
chcp 65001 >nul
echo [1/2] 构建前端（首次会自动安装依赖，需联网一次；之后全离线）...
cd /d "%~dp0web"
if not exist node_modules (
  call npm install --no-audit --no-fund
  if errorlevel 1 ( echo npm 安装失败，请检查网络后重试 & pause & exit /b 1 )
)
call npm run build
if errorlevel 1 ( echo 前端构建失败 & pause & exit /b 1 )
cd /d "%~dp0"
echo [2/2] 启动后端（http://localhost:24680）...
node server\server.js
pause
