# Atualiza incidentes TCGL e publica no GitHub.
# Ignora se a data de hoje (America/Sao_Paulo) ja foi atualizada com sucesso.
param(
    [Parameter(Position = 0)]
    [ValidateSet('auto', 'manual')]
    [string]$Mode = 'auto'
)

$ErrorActionPreference = 'Stop'

$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$PortalRoot = if ($env:CIOP_PORTAL_ROOT) { $env:CIOP_PORTAL_ROOT } else { Split-Path -Parent $ScriptDir }
$StateDir = if ($env:CIOP_STATE_DIR) { $env:CIOP_STATE_DIR } else { Join-Path $env:USERPROFILE '.config\ciop-portal' }
$StateFile = Join-Path $StateDir 'incidentes-ultima-data'
$EnvFile = Join-Path $StateDir 'incidentes.env'
$LogDir = Join-Path $env:LOCALAPPDATA 'ciop-portal\logs'
$LogFile = Join-Path $LogDir 'atualizar-incidentes.log'
$TzId = 'E. South America Standard Time'

function Get-SpToday {
    [TimeZoneInfo]::ConvertTimeBySystemTimeZoneId([DateTime]::UtcNow, $TzId).ToString('yyyy-MM-dd')
}

function Get-SpTimestamp {
    [TimeZoneInfo]::ConvertTimeBySystemTimeZoneId([DateTime]::UtcNow, $TzId).ToString('yyyy-MM-dd HH:mm:ss') + ' -03'
}

function Write-Log {
    param([string]$Message)
    $line = "[$(Get-SpTimestamp)] $Message"
    Add-Content -Path $LogFile -Value $line -Encoding UTF8
    Write-Host $line
}

function Test-AlreadyRanToday {
    if (-not (Test-Path $StateFile)) { return $false }
    return (Get-Content $StateFile -Raw).Trim() -eq (Get-SpToday)
}

function Set-SuccessMark {
    Set-Content -Path $StateFile -Value (Get-SpToday) -Encoding ASCII -NoNewline
}

function Import-EnvFile {
    param([string]$Path)
    Get-Content $Path | ForEach-Object {
        $line = $_.Trim()
        if (-not $line -or $line.StartsWith('#')) { return }
        $index = $line.IndexOf('=')
        if ($index -lt 1) { return }
        $name = $line.Substring(0, $index).Trim()
        $value = $line.Substring($index + 1).Trim().Trim('"').Trim("'")
        Set-Item -Path "env:$name" -Value $value
    }
}

function Publish-PortalProd {
    param([string]$JsonPath)
    $prodRoot = $env:CIOP_PORTAL_PROD
    if (-not $prodRoot -or -not (Test-Path $prodRoot)) { return }
    if (-not (Test-Path $JsonPath)) { return }

    Write-Log "Publicando JSON no portal de producao: $prodRoot"
    Copy-Item -Path $JsonPath -Destination (Join-Path $prodRoot 'assets\data\incidentes-tcgl.json') -Force
    Push-Location $prodRoot
    try {
        git add assets/data/incidentes-tcgl.json | Out-Null
        git diff --cached --quiet
        if ($LASTEXITCODE -eq 0) {
            Write-Log 'portalCIOP: sem alteracoes no JSON.'
            return
        }
        $stamp = [TimeZoneInfo]::ConvertTimeBySystemTimeZoneId([DateTime]::UtcNow, $TzId).ToString('dd/MM/yyyy HH:mm')
        git commit -m "Atualiza incidentes TCGL - $stamp" | Out-Null
        git push | Out-Null
    }
    finally {
        Pop-Location
    }
}

function Invoke-Update {
    $nodeBin = if ($env:CIOP_NODE_BIN) { $env:CIOP_NODE_BIN } else { (Get-Command node -ErrorAction Stop).Source }
    $localScript = Join-Path $PortalRoot 'scripts\atualizar-incidentes-local.mjs'
    & $nodeBin $localScript 2>&1 | Out-File -FilePath $LogFile -Append -Encoding UTF8
    return $LASTEXITCODE -eq 0
}

New-Item -ItemType Directory -Force -Path $StateDir, $LogDir | Out-Null

if (Test-AlreadyRanToday) {
    Write-Log "Atualizacao de $(Get-SpToday) ja concluida ($Mode)."
    exit 0
}

if (-not (Test-Path $EnvFile)) {
    Write-Log "ERRO: Credenciais ausentes. Crie $EnvFile (veja scripts\incidentes.env.example)."
    exit 1
}

Write-Log "Iniciando atualizacao ($Mode) - portal: $PortalRoot"
Import-EnvFile -Path $EnvFile

$env:PORTAL_ROOT = $PortalRoot
if (-not $env:CIOP_PORTAL_PROD) { Remove-Item Env:CIOP_PORTAL_PROD -ErrorAction SilentlyContinue }

if (-not $env:CIOP_INCIDENTES_USUARIO -or -not $env:CIOP_INCIDENTES_SENHA) {
    Write-Log "ERRO: CIOP_INCIDENTES_USUARIO ou CIOP_INCIDENTES_SENHA vazio em $EnvFile"
    exit 1
}

$jsonPath = Join-Path $PortalRoot 'assets\data\incidentes-tcgl.json'

if (Invoke-Update) {
    Publish-PortalProd -JsonPath $jsonPath
    Set-SuccessMark
    Write-Log 'Atualizacao concluida com sucesso.'
    exit 0
}

Write-Log 'Primeira tentativa falhou. Nova tentativa em 120 segundos...'
Start-Sleep -Seconds 120

if (Invoke-Update) {
    Publish-PortalProd -JsonPath $jsonPath
    Set-SuccessMark
    Write-Log 'Atualizacao concluida na segunda tentativa.'
    exit 0
}

Write-Log 'ERRO: falha na atualizacao apos 2 tentativas. Proxima execucao amanha as 03:00.'
exit 1
