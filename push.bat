@echo off
chcp 65001 >nul
setlocal enabledelayedexpansion

:: 检查是否在 git 仓库中
git rev-parse --is-inside-work-tree >nul 2>&1
if errorlevel 1 (
    echo [ERROR] 当前目录不是 git 仓库
    exit /b 1
)

:: 检查是否有改动
git status --porcelain >nul 2>&1
for /f %%i in ('git status --porcelain') do set HAS_CHANGES=1
if not defined HAS_CHANGES (
    echo [INFO] 没有需要提交的改动
    exit /b 0
)

:: 显示当前改动
echo ========================================
echo  当前改动:
echo ========================================
git status --short
echo.

:: 获取 commit message
if "%~1"=="" (
    set "MSG=更新db"
) else (
    set "MSG=%*"
)

if "!MSG!"=="" (
    echo [ERROR] commit message 不能为空
    exit /b 1
)

:: 执行 git add, commit, push
echo.
echo [1/3] git add -A
git add -A
if errorlevel 1 (
    echo [ERROR] git add 失败
    exit /b 1
)

echo [2/3] git commit -m "!MSG!"
git commit -m "!MSG!"
if errorlevel 1 (
    echo [ERROR] git commit 失败
    exit /b 1
)

echo [3/3] git push
git push
if errorlevel 1 (
    echo [WARN] push 失败，尝试设置上游分支...
    for /f "tokens=*" %%b in ('git branch --show-current') do set BRANCH=%%b
    git push --set-upstream origin !BRANCH!
    if errorlevel 1 (
        echo [ERROR] git push 失败
        exit /b 1
    )
)

echo.
echo ========================================
echo  推送成功!
echo ========================================
