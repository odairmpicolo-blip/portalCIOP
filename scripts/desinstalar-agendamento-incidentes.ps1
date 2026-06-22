# Remove o agendamento de incidentes do Task Scheduler (Windows).
$TaskName = 'CIOP Portal - Atualizar Incidentes'

$task = Get-ScheduledTask -TaskName $TaskName -ErrorAction SilentlyContinue
if (-not $task) {
    Write-Host "Nenhuma tarefa encontrada: $TaskName"
    exit 0
}

Unregister-ScheduledTask -TaskName $TaskName -Confirm:$false
Write-Host "Agendamento removido: $TaskName"
