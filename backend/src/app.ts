import cors from 'cors';
import express from 'express';
import fs from 'fs';
import { ticketsRouter } from './routes/tickets';
import {
  renderBitrixTicketsAppShell,
  renderFrontendBuildMissingPage,
  resolveTicketsFrontendDistPath,
  resolveTicketsFrontendIndexPath,
} from './services/bitrix-ticket-app';
import { installPasswordAuth } from './services/password-auth';

export function createApp() {
  const app = express();
  app.set('trust proxy', 'loopback');
  const configuredBasePath = process.env.SERVICE_TICKETS_BASE_PATH || '/service-tickets';
  const basePath = `/${configuredBasePath.replace(/^\/+|\/+$/g, '')}`;
  const frontendDistPath = resolveTicketsFrontendDistPath();
  const frontendIndexPath = resolveTicketsFrontendIndexPath();
  const hasFrontendBuild = fs.existsSync(frontendIndexPath);

  app.use(cors());
  app.use(express.json({ limit: '2mb' }));
  app.use(express.urlencoded({ extended: false, limit: '16kb' }));

  app.get('/health', (_req, res) => {
    res.json({
      ok: true,
      service: 'hiretrack-service-tickets',
      mode: process.env.SERVICE_TICKETS_MODE || 'production',
      timestamp: new Date().toISOString(),
    });
  });

  installPasswordAuth(app, basePath);

  app.use('/api/tickets', ticketsRouter);
  app.use(`${basePath}/api/tickets`, ticketsRouter);

  app.all(['/bitrix/tickets/app', '/bitrix/tickets/install'], (_req, res) => {
    const uiPath = '/bitrix/tickets/ui/';
    res.type('html').send(renderBitrixTicketsAppShell({ uiPath }));
  });

  app.get(/^\/bitrix\/tickets\/ui$/, (_req, res) => {
    res.redirect(`${basePath}/`);
  });

  app.get(basePath, (_req, res) => {
    res.redirect(`${basePath}/`);
  });

  if (hasFrontendBuild) {
    app.get(['/', `${basePath}/`, '/bitrix/tickets/ui/'], (_req, res) => {
      res.sendFile(frontendIndexPath);
    });

    app.use(
      express.static(frontendDistPath, {
        index: false,
        redirect: false,
      }),
    );

    app.use(
      basePath,
      express.static(frontendDistPath, {
        index: false,
        redirect: false,
      }),
    );

    app.use(
      '/bitrix/tickets/ui',
      express.static(frontendDistPath, {
        index: false,
        redirect: false,
      }),
    );

    app.get([`${basePath}/*`, '/bitrix/tickets/ui/*'], (_req, res) => {
      res.sendFile(frontendIndexPath);
    });
  } else {
    app.get(['/', `${basePath}/`, `${basePath}/*`, '/bitrix/tickets/ui/', '/bitrix/tickets/ui/*'], (_req, res) => {
      res.type('html').send(renderFrontendBuildMissingPage());
    });
  }

  return app;
}
