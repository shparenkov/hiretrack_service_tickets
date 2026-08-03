#Requires -RunAsAdministrator

[CmdletBinding()]
param(
  [string]$InstallRoot = 'C:\Services',
  [string]$RepoUrl = 'C:\Services\deploy\hiretrack_service_tickets.bundle'
)

$ErrorActionPreference = 'Stop'
$parameters = @{
  InstallRoot = $InstallRoot
  RepoUrl = $RepoUrl
  Branch = 'develop'
  Port = 3003
  ServiceId = 'HireTrackServiceTicketsTest'
  ServiceName = 'HireTrack Service Tickets Test'
  ServiceDescription = 'HireTrack service tickets test environment.'
  AppDirectoryName = 'hiretrack_service_tickets_test'
  TicketFile = 'C:\Services\data\service-tickets-test.json'
  BasePath = '/service-tickets-test'
  Mode = 'test'
}

& (Join-Path $PSScriptRoot 'install-production.ps1') @parameters
