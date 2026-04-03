@echo off
REM Run All Workflow Migrations Script
REM This script runs all SQL migrations for workflow management

echo ====================================
REM echo RUNNING WORKFLOW MIGRATIONS
echo ====================================
echo.

REM Find MySQL path from common locations
set MYSQL_PATH=
if exist "C:\Program Files\MySQL\MySQL Server 8.0\bin\mysql.exe" set MYSQL_PATH=C:\Program Files\MySQL\MySQL Server 8.0\bin\mysql.exe
if exist "C:\Program Files\MySQL\MySQL Server 8.4\bin\mysql.exe" set MYSQL_PATH=C:\Program Files\MySQL\MySQL Server 8.4\bin\mysql.exe
if exist "C:\Program Files (x86)\MySQL\MySQL Server 8.0\bin\mysql.exe" set MYSQL_PATH=C:\Program Files (x86)\MySQL\MySQL Server 8.0\bin\mysql.exe

if "%MYSQL_PATH%"=="" (
    echo ERROR: MySQL not found in common locations!
    echo Please run migrations manually in MySQL Workbench.
    echo.
    echo Files to run in order:
    echo 1. 2026-03-28_01_workflow_definitions.sql
    echo 2. 2026-03-28_02_workflow_transitions_update.sql
    echo 3. 2026-03-28_03_seed_default_workflow.sql
    echo 4. 2026-03-28_04_import_workflowa_transitions.sql
    echo 5. 2026-03-28_05_link_customer_request_cases_to_workflow.sql
    pause
    exit /b 1
)

echo Using MySQL: %MYSQL_PATH%
echo.

cd /d "%~dp0"

echo [1/5] Running 2026-03-28_01_workflow_definitions.sql...
"%MYSQL_PATH%" -h localhost -u root -proot vnpt_business_db < 2026-03-28_01_workflow_definitions.sql
if errorlevel 1 (
    echo ERROR in script 1!
    pause
    exit /b 1
)
echo [OK] Script 1 completed
echo.

echo [2/5] Running 2026-03-28_02_workflow_transitions_update.sql...
"%MYSQL_PATH%" -h localhost -u root -proot vnpt_business_db < 2026-03-28_02_workflow_transitions_update.sql
if errorlevel 1 (
    echo ERROR in script 2!
    pause
    exit /b 1
)
echo [OK] Script 2 completed
echo.

echo [3/5] Running 2026-03-28_03_seed_default_workflow.sql...
"%MYSQL_PATH%" -h localhost -u root -proot vnpt_business_db < 2026-03-28_03_seed_default_workflow.sql
if errorlevel 1 (
    echo ERROR in script 3!
    pause
    exit /b 1
)
echo [OK] Script 3 completed
echo.

echo [4/5] Running 2026-03-28_04_import_workflowa_transitions.sql...
"%MYSQL_PATH%" -h localhost -u root -proot vnpt_business_db < 2026-03-28_04_import_workflowa_transitions.sql
if errorlevel 1 (
    echo ERROR in script 4!
    pause
    exit /b 1
)
echo [OK] Script 4 completed
echo.

echo [5/5] Running 2026-03-28_05_link_customer_request_cases_to_workflow.sql...
"%MYSQL_PATH%" -h localhost -u root -proot vnpt_business_db < 2026-03-28_05_link_customer_request_cases_to_workflow.sql
if errorlevel 1 (
    echo ERROR in script 5!
    pause
    exit /b 1
)
echo [OK] Script 5 completed
echo.

echo ====================================
echo ALL MIGRATIONS COMPLETED SUCCESSFULLY!
echo ====================================
echo.
echo Next steps:
echo 1. Run: verify-tables.bat to check tables
echo 2. Run: php artisan migrate (for permission migration)
echo 3. Refresh frontend at http://localhost:5174/workflow-management
echo.
pause
