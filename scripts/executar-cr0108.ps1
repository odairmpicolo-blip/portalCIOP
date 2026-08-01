# Atualiza os agregados do CR-0108 a partir dos CSVs diarios e publica no GitHub.
# Roda na maquina Windows do CIOP que ja gera os relatorios - nao depende de nuvem:
# le os CSVs da propria pasta local onde a automacao os grava.
#
# Os quatro scripts sao incrementais: leem apenas os dias que ainda nao entraram.
# Se nao houver dia novo, nada muda e nenhum commit e feito.
param(
    [Parameter(Position = 0)]
    [ValidateSet('auto', 'manual')]
    [string]$Mode = 'auto'
)

$ErrorActionPreference = 'Stop'

$ScriptDir  = Split-Path -Parent $MyInvocation.MyCommand.Path
$PortalRoot = if ($env:CIOP_PORTAL_ROOT) { $env:CIOP_PORTAL_ROOT } else { Split-Path -Parent $ScriptDir }
$StateDir   = if ($env:CIOP_STATE_DIR) { $env:CIOP_STATE_DIR } else { Join-Path $env:USERPROFILE '.config\ciop-portal' }
$EnvFile    = Join-Path $StateDir 'cr0108.env'
$LogDir     = Join-Path $env:LOCALAPPDATA 'ciop-portal\logs'
$LogFile    = Join-Path $LogDir 'atualizar-cr0108.log'
$DadosDir   = Join-Path $PortalRoot 'assets\data\cr0108'
$TzId       = 'E. South America Standard Time'

function Get-SpTimestamp {
    [TimeZoneInfo]::ConvertTimeBySystemTimeZoneId([DateTime]::UtcNow, $TzId).ToString('yyyy-MM-dd HH:mm:ss') + ' -03'
}

function Write-Log {
    param([string]$Message)
    $line = "[$(Get-SpTimestamp)] $Message"
    Add-Content -Path $LogFile -Value $line -Encoding UTF8
    Write-Host $line
}

function Import-EnvFile {
    param([string]$Path)
    Get-Content $Path | ForEach-Object {
        $line = $_.Trim()
        if (-not $line -or $line.StartsWith('#')) { return }
        $i = $line.IndexOf('=')
        if ($i -lt 1) { return }
        Set-Item -Path ("env:" + $line.Substring(0, $i).Trim()) `
                 -Value $line.Substring($i + 1).Trim().Trim('"').Trim("'")
    }
}

function Invoke-Passo {
    # Atencao: nao nomear o parametro como $Args - e variavel automatica do PowerShell.
    param([string]$Nome, [string]$Script, [string[]]$Argumentos)
    Write-Log "  -> $Nome"
    $caminho = Join-Path $PortalRoot ("scripts\" + $Script)
    & $PythonBin $caminho @Argumentos 2>&1 | Out-File -FilePath $LogFile -Append -Encoding UTF8
    if ($LASTEXITCODE -ne 0) { throw "$Nome falhou (codigo $LASTEXITCODE)" }
}

New-Item -ItemType Directory -Force -Path $StateDir, $LogDir | Out-Null

if (-not (Test-Path $EnvFile)) {
    Write-Log "ERRO: configuracao ausente. Rode scripts\instalar-agendamento-cr0108.ps1 primeiro."
    exit 1
}
Import-EnvFile -Path $EnvFile

$Raiz = $env:CIOP_CR0108_RAIZ
if (-not $Raiz -or -not (Test-Path $Raiz)) {
    Write-Log "ERRO: CIOP_CR0108_RAIZ nao aponta para uma pasta valida ($Raiz). Ajuste em $EnvFile"
    exit 1
}

$PythonBin = if ($env:CIOP_PYTHON_BIN) { $env:CIOP_PYTHON_BIN } else { (Get-Command python -ErrorAction SilentlyContinue).Source }
if (-not $PythonBin) { $PythonBin = (Get-Command python3 -ErrorAction SilentlyContinue).Source }
if (-not $PythonBin) {
    Write-Log 'ERRO: Python nao encontrado. Instale em https://www.python.org/ ou defina CIOP_PYTHON_BIN.'
    exit 1
}

$GitBin = (Get-Command git -ErrorAction SilentlyContinue).Source
if (-not $GitBin) {
    Write-Log 'ERRO: Git nao encontrado. Instale em https://git-scm.com/'
    exit 1
}
if (-not (Test-Path (Join-Path $PortalRoot '.git'))) {
    Write-Log "ERRO: $PortalRoot nao e um clone do repositorio. Rode o instalador."
    exit 1
}

function Invoke-Atualizacao {
    Push-Location $PortalRoot
    try {
        # Puxa antes de mexer: outra maquina (ou eu, pelo navegador) pode ter publicado.
        & $GitBin pull --rebase --quiet 2>&1 | Out-File -FilePath $LogFile -Append -Encoding UTF8
        if ($LASTEXITCODE -ne 0) { throw "git pull falhou" }

        Invoke-Passo 'agregados'            'cr0108-incremental.py'     @($Raiz, $DadosDir)
        Invoke-Passo 'diagnostico e sugestoes' 'cr0108-diagnostico.py'  @($Raiz, $DadosDir)
        Invoke-Passo 'serie diaria'         'cr0108-serie-diaria.py'    @($Raiz, $DadosDir)
        Invoke-Passo 'operador x linha'     'cr0108-operador-linha.py'  @($Raiz, $DadosDir)

        # Carga das passagens cruas no Aurora DSQL. So roda se as credenciais estiverem
        # no cr0108.env - sem elas a etapa e pulada e o resto segue normalmente.
        # A tabela e o que permite consulta livre depois; as paginas continuam lendo os
        # JSONs estaticos, que sao o que da a resposta instantanea no navegador.
        if ($env:DSQL_CLUSTER_ID -and $env:AWS_ACCESS_KEY_ID -and $env:AWS_SECRET_ACCESS_KEY) {
            $nodeBin = if ($env:CIOP_NODE_BIN) { $env:CIOP_NODE_BIN } else { (Get-Command node -ErrorAction SilentlyContinue).Source }
            if (-not $nodeBin) {
                Write-Log '  -> AVISO: Node nao encontrado, carga no DSQL pulada.'
            } else {
                $desde = $env:CIOP_CR0108_DSQL_DESDE
                $argsImport = @((Join-Path $PortalRoot 'backend\scripts\importar-cr0108-csv.mjs'), $Raiz)
                if ($desde) { $argsImport += "--desde=$desde" }
                Write-Log ('  -> banco AWS (DSQL)' + $(if ($desde) { " desde $desde" } else { ' - carga completa' }))
                & $nodeBin @argsImport 2>&1 | Out-File -FilePath $LogFile -Append -Encoding UTF8
                if ($LASTEXITCODE -ne 0) { throw "carga no DSQL falhou (codigo $LASTEXITCODE)" }
                # Depois da primeira carga completa, so os dias novos interessam.
                if (-not $desde) {
                    $ultimo = (Get-Content (Join-Path $DadosDir 'meta.json') -Raw | ConvertFrom-Json).ultimoDia
                    Add-Content -Path $EnvFile -Value "CIOP_CR0108_DSQL_DESDE=$ultimo" -Encoding UTF8
                    Write-Log "     carga completa concluida; proximas rodadas usarao --desde=$ultimo"
                }
            }
        } else {
            Write-Log '  -> banco AWS: credenciais ausentes no cr0108.env, etapa pulada.'
        }

        $mudou = & $GitBin status --porcelain -- 'assets/data/cr0108'
        if (-not $mudou) {
            Write-Log 'Nenhum dia novo - nada a publicar.'
            return $true
        }

        & $GitBin add -- 'assets/data/cr0108' | Out-Null
        $dia = (Get-Content (Join-Path $DadosDir 'meta.json') -Raw | ConvertFrom-Json).ultimoDia
        $mensagem = "CR-0108: atualiza ate $dia (automatico)"
        & $GitBin -c "user.name=CIOP Portal" -c "user.email=ciop@tcgl.local" commit -m $mensagem --quiet
        if ($LASTEXITCODE -ne 0) { throw "git commit falhou" }

        & $GitBin push --quiet 2>&1 | Out-File -FilePath $LogFile -Append -Encoding UTF8
        if ($LASTEXITCODE -ne 0) { throw "git push falhou - verifique a credencial do GitHub" }

        Write-Log "Publicado: dados ate $dia."
        return $true
    }
    finally { Pop-Location }
}

Write-Log "Iniciando ($Mode) - portal: $PortalRoot | CSVs: $Raiz"

try {
    if (Invoke-Atualizacao) { exit 0 }
}
catch {
    Write-Log "Primeira tentativa falhou: $($_.Exception.Message)"
}

Write-Log 'Nova tentativa em 120 segundos...'
Start-Sleep -Seconds 120

try {
    if (Invoke-Atualizacao) { exit 0 }
}
catch {
    Write-Log "ERRO: falha apos 2 tentativas: $($_.Exception.Message)"
}

# Sai com erro para a tarefa aparecer como falha no Agendador, em vez de falhar em silencio -
# foi assim que a sincronizacao de incidentes ficou 25 dias parada sem ninguem perceber.
exit 1
