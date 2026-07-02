@echo off
setlocal

set "BACKEND_IMAGE=ghcr.io/glintechnology/bomtool-backend"
set "FRONTEND_IMAGE=ghcr.io/glintechnology/bomtool-frontend"
set "IMAGE_TAG=latest"

echo Building backend image: %BACKEND_IMAGE%:%IMAGE_TAG%
docker build -t "%BACKEND_IMAGE%:%IMAGE_TAG%" .\backend
if errorlevel 1 (
  echo Backend image build failed.
  exit /b 1
)

echo.
echo Building frontend image: %FRONTEND_IMAGE%:%IMAGE_TAG%
docker build -t "%FRONTEND_IMAGE%:%IMAGE_TAG%" .\frontend
if errorlevel 1 (
  echo Frontend image build failed.
  exit /b 1
)

echo.
echo Built images:
echo   %BACKEND_IMAGE%:%IMAGE_TAG%
echo   %FRONTEND_IMAGE%:%IMAGE_TAG%

endlocal
