# Instala o agendamento do CR-0108 no Windows (Agendador de Tarefas).
# Roda todo dia as 03:20 - depois da automacao que grava o CSV do dia, as 03:00.
#
# Uso:
#   powershell -ExecutionPolicy Bypass -File instalar-agendamento-cr0108.ps1 -Raiz "D:\relatorios\108 - reports"
#
# Se -Raiz nao for informado, o script pergunta.
#Requires -Version 5.1
param(
    [string]$Raiz,
    [string]$Repo,
    [string]$Hora = '03:20'
)

$ErrorActionPreference = 'Stop'

$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$StateDir  = Join-Path $env:USERPROFILE '.config\ciop-portal'
$EnvFile   = Join-Path $StateDir 'cr0108.env'
$TaskName  = 'CIOP Portal - Atualizar CR-0108'
$RepoUrl   = 'https://github.com/odairmpicolo-blip/portalCIOP.git'

New-Item -ItemType Directory -Force -Path $StateDir | Out-Null

# ---------------------------------------------------------------- pre-requisitos
$python = (Get-Command python -ErrorAction SilentlyContinue).Source
if (-not $python) { $python = (Get-Command python3 -ErrorAction SilentlyContinue).Source }
if (-not $python) { Write-Error "Python nao encontrado. Instale em https://www.python.org/downloads/windows/ (marque 'Add to PATH')." }
Write-Host "Python: $python"

$git = (Get-Command git -ErrorAction SilentlyContinue).Source
if (-not $git) { Write-Error "Git nao encontrado. Instale em https://git-scm.com/download/win" }
Write-Host "Git:    $git"

# ---------------------------------------------------------------- clone do portal
if (-not $Repo) {
    $padrao = Join-Path $env:USERPROFILE 'portalCIOP'
    $Repo = Read-Host "Pasta do repositorio portalCIOP [$padrao]"
    if (-not $Repo) { $Repo = $padrao }
}

if (-not (Test-Path (Join-Path $Repo '.git'))) {
    Write-Host ""
    Write-Host "Clonando o portal em $Repo ..."
    Write-Host "Na primeira vez o Git vai pedir a sua credencial do GitHub."
    & $git clone $RepoUrl $Repo
    if ($LASTEXITCODE -ne 0) { Write-Error "Falha ao clonar. Verifique a credencial do GitHub." }
} else {
    Write-Host "Repositorio ja existe em $Repo"
}

# ---------------------------------------------------------------- pasta dos CSVs
if (-not $Raiz) {
    Write-Host ""
    Write-Host "Informe a pasta onde a automacao grava os relatorios do CR-0108."
    Write-Host "E a pasta que contem as subpastas por mes (ex.: '07 - Julho 2026')."
    $Raiz = Read-Host "Pasta dos CSVs"
}
if (-not (Test-Path $Raiz)) { Write-Error "Pasta nao encontrada: $Raiz" }

$csvs = @(Get-ChildItem -Path $Raiz -Filter *.csv -Recurse -ErrorAction SilentlyContinue)
if ($csvs.Count -eq 0) { Write-Error "Nenhum CSV encontrado em $Raiz - confira o caminho." }
Write-Host "CSVs encontrados: $($csvs.Count)"

# ---------------------------------------------------------------- configuracao
if (-not (Test-Path $EnvFile)) {
@"
# Configuracao do CR-0108 (portal CIOP).
CIOP_CR0108_RAIZ=$Raiz

# Banco AWS (opcional). Sem estas tres linhas preenchidas, a carga no Aurora DSQL
# e pulada e apenas os JSONs do portal sao atualizados.
# DSQL_CLUSTER_ID=
# DSQL_REGION=sa-east-1
# AWS_ACCESS_KEY_ID=
# AWS_SECRET_ACCESS_KEY=
"@ | Set-Content -Path $EnvFile -Encoding UTF8
    Write-Host "Configuracao criada em $EnvFile"
} else {
    $conteudo = Get-Content $EnvFile
    if ($conteudo -match '^CIOP_CR0108_RAIZ=') {
        ($conteudo -replace '^CIOP_CR0108_RAIZ=.*', "CIOP_CR0108_RAIZ=$Raiz") | Set-Content -Path $EnvFile -Encoding UTF8
    } else {
        Add-Content -Path $EnvFile -Value "CIOP_CR0108_RAIZ=$Raiz" -Encoding UTF8
    }
    Write-Host "Configuracao atualizada em $EnvFile"
}

# ---------------------------------------------------------------- tarefa agendada
$Runner = Join-Path $Repo 'scripts\executar-cr0108.ps1'
if (-not (Test-Path $Runner)) { Write-Error "Runner nao encontrado: $Runner" }

$acao = New-ScheduledTaskAction `
    -Execute 'powershell.exe' `
    -Argument "-NoProfile -ExecutionPolicy Bypass -File `"$Runner`" auto" `
    -WorkingDirectory $Repo

$gatilhoDiario = New-ScheduledTaskTrigger -Daily -At $Hora
$gatilhoLogon  = New-ScheduledTaskTrigger -AtLogOn

$config = New-ScheduledTaskSettingsSet `
    -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries `
    -StartWhenAvailable `
    -ExecutionTimeLimit (New-TimeSpan -Hours 3)

$principal = New-ScheduledTaskPrincipal -UserId $env:USERNAME -LogonType Interactive -RunLevel Limited

if (Get-ScheduledTask -TaskName $TaskName -ErrorAction SilentlyContinue) {
    Unregister-ScheduledTask -TaskName $TaskName -Confirm:$false
}

Register-ScheduledTask -TaskName $TaskName -Action $acao `
    -Trigger @($gatilhoDiario, $gatilhoLogon) -Settings $config -Principal $principal `
    -Description 'Agrega os relatorios do CR-0108 e publica no portal CIOP.' | Out-Null

Write-Host ""
Write-Host "Agendamento instalado."
Write-Host "  Horario: todo dia as $Hora (e ao entrar na maquina)"
Write-Host "  Tarefa:  $TaskName"
Write-Host "  CSVs:    $Raiz"
Write-Host "  Portal:  $Repo"
Write-Host "  Log:     $env:LOCALAPPDATA\ciop-portal\logs\atualizar-cr0108.log"
Write-Host ""
Write-Host "Rode uma vez agora para validar (a primeira leva alguns minutos, monta os caches):"
Write-Host "  powershell -ExecutionPolicy Bypass -File `"$Runner`" manual"
