# HireTrack Service Tickets

Web interface for receiving equipment into service by barcode or serial number.

## Features

- camera barcode scanner over HTTPS
- equipment and current job lookup in HireTrack NX
- duplicate active-ticket protection
- Logged Fault creation in HireTrack NX
- Bitrix ticket synchronization
- persistent local ticket and activity history

The current HireTrack adapter uses the existing HTTP/QBE integration. It can be
replaced with a direct ODBC adapter after the production DSN, credentials, and
write-safe HireTrack schema are confirmed.

## Development

```powershell
npm.cmd ci
npm.cmd run prisma:generate
npm.cmd run frontend:build
npm.cmd run build
npm.cmd start
```

The UI is available at `http://127.0.0.1:3002/service-tickets/`.

## Windows Production

Production runs from `master` as the `HireTrackServiceTickets` Windows service
in `C:\Services\hiretrack_service_tickets` on port `3002`.

Configuration shared with the HireTrack integration is read from
`C:\Services\hiretrack.config.json`. The access password is read from
`C:\Services\hiretrack-access-password.txt`. Ticket history is stored in
`C:\Services\data\service-tickets.json`.

Install:

```powershell
Set-ExecutionPolicy -Scope Process Bypass
Invoke-WebRequest -UseBasicParsing `
  https://raw.githubusercontent.com/shparenkov/hiretrack_service_tickets/master/deploy/windows/install-production.ps1 `
  -OutFile $env:TEMP\install-hiretrack-service-tickets.ps1
& $env:TEMP\install-hiretrack-service-tickets.ps1
```

Update:

```powershell
& C:\Services\hiretrack_service_tickets\deploy\windows\update-production.ps1
```
