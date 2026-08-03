#Requires -RunAsAdministrator

[CmdletBinding()]
param([string]$InstallRoot = 'C:\Services')

$ErrorActionPreference = 'Stop'
$parameters = @{
  InstallRoot = $InstallRoot
  Branch = 'develop'
  Port = 3003
  ServiceId = 'HireTrackServiceTicketsTest'
  ServiceName = 'HireTrack Service Tickets Test'
  AppDirectoryName = 'hiretrack_service_tickets_test'
  TicketFile = 'C:\Services\data\service-tickets-test.json'
  BasePath = '/service-tickets-test'
  Mode = 'test'
}

& (Join-Path $PSScriptRoot 'update-production.ps1') @parameters
