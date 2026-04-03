@echo off
REM Verify Workflow Tables Script
REM Run this to check if workflow tables exist

echo ====================================
echo VERIFY WORKFLOW TABLES
echo ====================================
echo.

REM Find MySQL path from common locations
set MYSQL_PATH=
if exist "C:\Program Files\MySQL\MySQL Server 8.0\bin\mysql.exe" set MYSQL_PATH=C:\Program Files\MySQL\MySQL Server 8.0\bin\mysql.exe
if exist "C:\Program Files\MySQL\MySQL Server 8.4\bin\mysql.exe" set MYSQL_PATH=C:\Program Files\MySQL\MySQL Server 8.4\bin\mysql.exe
if exist "C:\Program Files (x86)\MySQL\MySQL Server 8.0\bin\mysql.exe" set MYSQL_PATH=C:\Program Files (x86)\MySQL\MySQL Server 8.0\bin\mysql.exe

if "%MYSQL_PATH%"=="" (
    echo ERROR: MySQL not found in common locations!
    echo Please update MYSQL_PATH or run commands manually in MySQL Workbench.
    echo.
    echo SQL Commands to run manually:
    echo USE vnpt_business_db;
    echo SHOW TABLES LIKE 'workflow%';
    echo SELECT * FROM workflow_definitions;
    pause
    exit /b 1
)

echo Using MySQL: %MYSQL_PATH%
echo.

echo [1/3] Checking workflow tables...
"%MYSQL_PATH%" -h localhost -u root -proot vnpt_business_db -e "SHOW TABLES LIKE 'workflow%';"
echo.

echo [2/3] Checking workflow_definitions content...
"%MYSQL_PATH%" -h localhost -u root -proot vnpt_business_db -e "SELECT id, code, name, is_active, is_default FROM workflow_definitions;"
echo.

echo [3/3] Checking customer_request_cases workflow column...
"%MYSQL_PATH%" -h localhost -u root -proot vnpt_business_db -e "DESCRIBE customer_request_cases;" | findstr workflow
echo.

echo ====================================
echo VERIFICATION COMPLETE
echo ====================================
pause
