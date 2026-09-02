# Despliegue productivo — INCOEX Logistics

Estado actual y recomendaciones para pasar de prototipo (Render + SQLite efímero) a una
plataforma estable con respaldo de datos.

## Dónde estamos hoy (prototipo)

| Pieza | Dónde corre | Base de datos | Riesgo principal |
|---|---|---|---|
| API NestJS (`api-incoex`) | Render, servicio web | SQLite en el disco efímero del contenedor | **Los datos se pierden en cada deploy/restart** (SQLite no persiste en Render free/starter) |
| Panel web (`web`) | Vercel, estático | — | Ninguno relevante (es SPA puro) |
| App Flutter | Play Store / APK | API remota | Ninguno (no guarda datos locales) |
| Evidencias (fotos) | `data/uploads/evidence` en el contenedor | Filesystem | Se pierden igual que SQLite |

## Recomendación: DigitalOcean Droplet (vía rápida y barata) vs AWS ECS (escala)

### Opción A — Droplet + Docker Compose (recomendada para empezar)

- **Costo**: USD 12–24/mes (1 vCPU / 2 GB es suficiente).
- **Persistencia**: volumen Docker montado → SQLite y fotos sobreviven reinicios y deploys.
- **Backups**: cron `sqlite3 .backup` + `rclone` a Spaces; las fotos se sincronizan igual.
- **HTTPS**: Caddy o Nginx reverse proxy con Let's Encrypt automático.
- **Operación**: `docker compose up -d` tras cada `git pull`; CI opcional.

Paso a paso (una vez que tengas el droplet):

1. Instalar Docker + Compose en el droplet.
2. Crear `/opt/incoex/data` y `/opt/incoex/uploads`.
3. Subir el repo y ejecutar `docker compose up -d --build` (el `Dockerfile` de `api-incoex` ya existe).
4. Apuntar un subdominio (`api.incoex.ni`) al droplet y emitir certificado con Caddy.
5. Configurar `VITE_API_URL` en Vercel apuntando a `https://api.incoex.ni/api` y redeployar la web.
6. Cron de backup diario: `sqlite3 incoex-local.sqlite ".backup backups/$(date +%F).sqlite"` + copia a Spaces.

### Opción B — AWS ECS Fargate (cuando haya varios servicios y quieras autoescalar)

- Docker images en ECR; tarea Fargate con **volumen EFS** para SQLite y evidencias.
- **PostgreSQL (RDS)** pasa a ser obligatorio: SQLite sobre EFS funciona pero PostgreSQL
  es lo correcto a esta escala (los stores abren la misma ruta; la migración es mecánica:
  el modelo ya está tablas relacionales puras).
- ALB + Route 53 para el API; CloudFront opcional delante de Vercel.
- Costo base: ~USD 25–40/mes solo en infraestructura (sin contar RDS).

## Plan de endurecimiento (orden sugerido)

1. **[crítico] Persistencia**: mover la API a un host con volumen persistente (Droplet)
   o migrar a PostgreSQL. Es lo único que hoy puede perder datos reales.
2. **[alto] Evidencias**: cambiar `data/uploads/evidence` por S3/Spaces (CDN + retención).
3. **[alto] Secretos**: `INCOEX_DB_PATH`, `GOOGLE_MAPS_API_KEY`, credenciales en variables
   de entorno del proveedor (jamás en el repo).
4. **[medio] CI/CD**: GitHub Actions → build + test + push de imagen + deploy por `git push`.
5. **[medio] Observabilidad**: logs a stdout (ya es así) + uptime check + alerta de error 500.
6. **[medio] Backups**: retención 30 días + restauración probada una vez al mes.

## Notas de arquitectura

- La API es un solo proceso NestJS stateless (excepto SQLite/fs) → escalable horizontalmente
  una vez que la base esté fuera del contenedor.
- El web es 100% estático: Vercel está bien, no requiere servidor.
- Los `driver_locations` (GPS) se guardan en la misma SQLite; con PostgreSQL podrían pasar a
  Redis/geospatial sin tocar el contrato del panel.