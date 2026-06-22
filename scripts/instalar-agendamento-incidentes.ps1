# Instala agendamento no Windows (Task Scheduler): todo dia as 03:00 e ao iniciar sessao.
# Execute como Administrador apenas se o registro falhar; normalmente basta PowerShell do usuario.
#Requires -Version 5.1

$ErrorActionPreference = 'Stop'

$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$PortalRoot = Split-Path -Parent $ScriptDir
$Runner = Join-Path $ScriptDir 'executar-atualizacao-incidentes.ps1'
$StateDir = Join-Path $env:USERPROFILE '.config\ciop-portal'
$EnvFile = Join-Path $StateDir 'incidentes.env'
$ExampleEnv = Join-Path $ScriptDir 'incidentes.env.example'
$TaskName = 'CIOP Portal - Atualizar Incidentes'

New-Item -ItemType Directory -Force -Path $StateDir | Out-Null

if (-not (Test-Path $EnvFile)) {
    Copy-Item $ExampleEnv $EnvFile
    Write-Host "Arquivo de credenciais criado em:"
    Write-Host "  $EnvFile"
    Write-Host "Edite CIOP_INCIDENTES_USUARIO e CIOP_INCIDENTES_SENHA antes da primeira execucao."
}

$nodeBin = (Get-Command node -ErrorAction SilentlyContinue).Source
if (-not $nodeBin) {
    Write-Error "Node.js nao encontrado. Instale em https://nodejs.org/ e reinicie o PowerShell."
}

$arguments = "-NoProfile -ExecutionPolicy Bypass -File `"$Runner`" auto"
$action = New-ScheduledTaskAction -Execute 'powershell.exe' -Argument $arguments -WorkingDirectory $PortalRoot

$triggerDaily = New-ScheduledTaskTrigger -Daily -At '03:00'
$triggerLogon = New-ScheduledTaskTrigger -AtLogOn

$settings = New-ScheduledTaskSettingsSet `
    -AllowStartIfOnBatteries `
    -DontStopIfGoingOnBatteries `
    -StartWhenAvailable `
    -ExecutionTimeLimit (New-TimeSpan -Hours 4)

$principal = New-ScheduledTaskPrincipal -UserId $env:USERNAME -LogonType Interactive -RunLevel Limited

$existing = Get-ScheduledTask -TaskName $TaskName -ErrorAction SilentlyContinue
if ($existing) {
    Unregister-ScheduledTask -TaskName $TaskName -Confirm:$false
}

Register-ScheduledTask `
    -TaskName $TaskName `
    -Action $action `
    -Trigger @($triggerDaily, $triggerLogon) `
    -Settings $settings `
    -Principal $principal `
    -Description 'Atualiza incidentes TCGL e publica no GitHub (portal CIOP).' | Out-Null

Write-Host ""
Write-Host "Agendamento instalado no Windows."
Write-Host "  Horario: todo dia as 03:00 (horario local do Windows)"
Write-Host "  Ao entrar: executa se ainda nao atualizou hoje"
Write-Host "  Tarefa:  $TaskName"
Write-Host "  Log:     $env:LOCALAPPDATA\ciop-portal\logs\atualizar-incidentes.log"
Write-Host ""
Write-Host "Teste manual:"
Write-Host "  powershell -ExecutionPolicy Bypass -File `"$Runner`" manual"
Write-Host ""
Write-Host "Abra 'Agendador de Tarefas' (taskschd.msc) para revisar ou editar."
