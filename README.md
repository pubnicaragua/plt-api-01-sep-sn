# INCOEX Logistics API

API NestJS independiente para el panel web y las aplicaciones Flutter.

## Ejecutar localmente

```powershell
npm install
npm run start:dev
```

- Base URL: `http://localhost:3000/api`
- Swagger: `http://localhost:3000/api/docs`
- Health: `GET /api/health`

## Contrato inicial

La API expone autenticación de prototipo, dashboard, viajes, asignación, tracking, conductores, clientes, incidencias, historial, reportes y vista general de operaciones. La creación y asignación de viajes ya son mutaciones reales sobre el `OperationsStore` de la ejecución actual.

El módulo de `Entregables` sí usa SQLite local (`INCOEX_DB_PATH`, por defecto `data/incoex-local.sqlite`) para persistir el Kanban del proyecto. La persistencia operativa de viajes, usuarios, JWT/RBAC, filtros autorizados por cuenta, posiciones GPS, eventos WebSocket, evidencias y notificaciones todavía debe implementarse antes de producción. El `OperationsStore` es deliberadamente temporal para poder presentar el vertical slice conectado.

## Entregables locales

- `GET /api/deliverables`
- `GET /api/deliverables/summary`
- `PATCH /api/deliverables/:id/status` con `{ "status": "backlog|in_progress|review|done" }`
