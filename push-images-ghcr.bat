@echo off
setlocal

set "BACKEND_IMAGE=ghcr.io/glintechnology/bomtool-backend"
set "FRONTEND_IMAGE=ghcr.io/glintechnology/bomtool-frontend"
set "IMAGE_TAG=latest"

set /p "GITHUB_USERNAME=GitHub username: "
if "%GITHUB_USERNAME%"=="" (
  echo GitHub username is required.
  exit /b 1
)

echo Enter GitHub token. It will not be shown.
for /f "usebackq delims=" %%T in (`powershell -NoProfile -Command "$token = Read-Host 'GitHub token' -AsSecureString; $bstr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($token); try { [Runtime.InteropServices.Marshal]::PtrToStringBSTR($bstr) } finally { [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($bstr) }"`) do set "GITHUB_TOKEN=%%T"

if "%GITHUB_TOKEN%"=="" (
  echo GitHub token is required.
  exit /b 1
)

echo %GITHUB_TOKEN% | docker login ghcr.io -u "%GITHUB_USERNAME%" --password-stdin
set "GITHUB_TOKEN="
if errorlevel 1 (
  echo GHCR login failed.
  exit /b 1
)

echo.
echo Pushing backend image: %BACKEND_IMAGE%:%IMAGE_TAG%
docker push "%BACKEND_IMAGE%:%IMAGE_TAG%"
if errorlevel 1 (
  echo Backend image push failed.
  exit /b 1
)

echo.
echo Pushing frontend image: %FRONTEND_IMAGE%:%IMAGE_TAG%
docker push "%FRONTEND_IMAGE%:%IMAGE_TAG%"
if errorlevel 1 (
  echo Frontend image push failed.
  exit /b 1
)

echo.
echo Pushed images:
echo   %BACKEND_IMAGE%:%IMAGE_TAG%
echo   %FRONTEND_IMAGE%:%IMAGE_TAG%

endlocal
