# Configura tudo de uma vez no Windows: credenciais, teste e agendamento 03:00.
# Uso (PowerShell):
#   cd C:\Users\SEU_USUARIO\projetos\portal-teste
#   powershell -ExecutionPolicy Bypass -File .\scripts\configurar-windows-incidentes.ps1
#
# Ou baixe o repo e rode direto apos git clone.
#Requires -Version 5.1

param(
    [string]$Usuario = 'odairmarino',
    [string]$Senha = '',
    [string]$PastaProjetos = '',
    [switch]$PularTeste,
    [switch]$SomenteTeste
)

$ErrorActionPreference = 'Stop'

if (-not $Senha) {
    Write-Host "Digite a senha do TCGL (nao aparece na tela):" -ForegroundColor Yellow
    $Senha = Read-Host -AsSecureString | ForEach-Object {
        [Runtime.InteropServices.Marshal]::PtrToStringAuto(
            [Runtime.InteropServices.Marshal]::SecureStringToBSTR($_)
        )
    }
    if (-not $Senha) {
        Write-Error 'Senha obrigatoria.'
    }
}

function Write-Passo {
    param([string]$Numero, [string]$Texto)
    Write-Host ""
    Write-Host "=== Passo $Numero — $Texto ===" -ForegroundColor Cyan
}

function Test-Comando {
    param([string]$Nome)
    $cmd = Get-Command $Nome -ErrorAction SilentlyContinue
    if (-not $cmd) {
        Write-Host "ERRO: '$Nome' nao encontrado." -ForegroundColor Red
        if ($Nome -eq 'node') { Write-Host "Instale em https://nodejs.org/ (LTS) e abra o PowerShell de novo." }
        if ($Nome -eq 'git')  { Write-Host "Instale em https://git-scm.com/download/win e abra o PowerShell de novo." }
        exit 1
    }
    Write-Host "OK: $($cmd.Source)" -ForegroundColor Green
}

Write-Passo '1' 'Verificando Node.js e Git'
Test-Comando 'node'
Test-Comando 'git'
Write-Host "Node: $(node -v)"
Write-Host "Git:  $(git -v)"
Write-Host "Usuario Windows: $env:USERNAME"
Write-Host "Pasta usuario:   $env:USERPROFILE"

if (-not $PastaProjetos) {
    $PastaProjetos = Join-Path $env:USERPROFILE 'projetos'
}

$PortalTeste = Join-Path $PastaProjetos 'portal-teste'
$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$RepoAtual = Split-Path -Parent $ScriptDir

Write-Passo '2' 'Preparando pasta do portal-teste'

if ((Test-Path (Join-Path $RepoAtual 'scripts\executar-atualizacao-incidentes.ps1')) -and
    (Test-Path (Join-Path $RepoAtual 'assets\data\incidentes-tcgl.json'))) {
    $PortalTeste = $RepoAtual
    Write-Host "Usando repositorio atual: $PortalTeste" -ForegroundColor Green
}
elseif (-not (Test-Path $PortalTeste)) {
    New-Item -ItemType Directory -Force -Path $PastaProjetos | Out-Null
    Write-Host "Clonando portal-teste..."
    git clone https://github.com/odairmpicolo-blip/portal-teste.git $PortalTeste
}
else {
    Write-Host "Repositorio ja existe: $PortalTeste" -ForegroundColor Green
}

Set-Location $PortalTeste
git pull 2>&1 | Out-Host

Write-Passo '3' 'Criando credenciais'
$StateDir = Join-Path $env:USERPROFILE '.config\ciop-portal'
$EnvFile = Join-Path $StateDir 'incidentes.env'
New-Item -ItemType Directory -Force -Path $StateDir | Out-Null

$conteudo = @"
CIOP_INCIDENTES_USUARIO=$Usuario
CIOP_INCIDENTES_SENHA=$Senha
CIOP_PORTAL_ROOT=$PortalTeste
"@

Set-Content -Path $EnvFile -Value $conteudo -Encoding UTF8
Write-Host "Arquivo criado: $EnvFile" -ForegroundColor Green

if ($SomenteTeste) {
    Write-Passo '4' 'Executando teste manual'
    & (Join-Path $PortalTeste 'scripts\executar-atualizacao-incidentes.ps1') manual
    exit $LASTEXITCODE
}

if (-not $PularTeste) {
    Write-Passo '4' 'Teste manual (pode levar alguns minutos)'
    Write-Host "Aguarde..." -ForegroundColor Yellow
    & (Join-Path $PortalTeste 'scripts\executar-atualizacao-incidentes.ps1') manual
    if ($LASTEXITCODE -ne 0) {
        Write-Host ""
        Write-Host "Teste falhou. Veja o log:" -ForegroundColor Red
        Write-Host "$env:LOCALAPPDATA\ciop-portal\logs\atualizar-incidentes.log"
        Write-Host ""
        Write-Host "Corrija o problema e rode de novo este script."
        exit 1
    }
    Write-Host "Teste concluido com sucesso!" -ForegroundColor Green
}

Write-Passo '5' 'Instalando agendamento (todo dia as 03:00)'
& (Join-Path $PortalTeste 'scripts\instalar-agendamento-incidentes.ps1')

Write-Host ""
Write-Host "========================================" -ForegroundColor Green
Write-Host "  CONFIGURACAO CONCLUIDA!" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Green
Write-Host ""
Write-Host "  Horario: todo dia as 03:00"
Write-Host "  Log:     $env:LOCALAPPDATA\ciop-portal\logs\atualizar-incidentes.log"
Write-Host "  Tarefa:  CIOP Portal - Atualizar Incidentes (taskschd.msc)"
Write-Host ""
Write-Host "Para testar de novo:"
Write-Host "  powershell -ExecutionPolicy Bypass -File `"$PortalTeste\scripts\executar-atualizacao-incidentes.ps1`" manual"
