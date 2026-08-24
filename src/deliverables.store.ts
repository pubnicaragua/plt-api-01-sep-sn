import { Injectable, NotFoundException, OnModuleDestroy } from '@nestjs/common'
import { mkdirSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { DatabaseSync } from 'node:sqlite'

export type DeliverableStatus = 'backlog' | 'in_progress' | 'review' | 'done'
export type DeliverablePriority = 'Alta' | 'Media' | 'Baja'

export interface Deliverable {
  id: string
  title: string
  area: string
  summary: string
  status: DeliverableStatus
  priority: DeliverablePriority
  evidence: string
  source: 'Verificado' | 'En implementación' | 'Pendiente'
  updatedAt: string
}

interface DeliverableRow {
  id: string
  title: string
  area: string
  summary: string
  status: DeliverableStatus
  priority: DeliverablePriority
  evidence: string
  source: Deliverable['source']
  updated_at: string
}

const SEED: Omit<Deliverable, 'updatedAt'>[] = [
  { id: 'web-shell', title: 'Panel administrativo Vite + React', area: 'Web superadmin', summary: 'Shell visual con navegación de operaciones, métricas, tablas y estados de conexión.', status: 'done', priority: 'Alta', evidence: 'web/src/App.tsx, web/src/styles.css; build Vite validado.', source: 'Verificado' },
  { id: 'api-contract', title: 'Contrato base de API NestJS', area: 'API', summary: 'Health, auth de prototipo, viajes, asignaciones, tracking, reportes e incidencias.', status: 'done', priority: 'Alta', evidence: 'api-incoex/src/*; build NestJS y pruebas HTTP locales.', source: 'Verificado' },
  { id: 'connected-web', title: 'Web conectada a la API', area: 'Integración', summary: 'El panel consulta la API y muestra error explícito cuando el backend no responde.', status: 'done', priority: 'Alta', evidence: 'web/src/lib/api.ts; Promise.all de módulos y sin fallback local.', source: 'Verificado' },
  { id: 'mobile-api-layer', title: 'Cliente Flutter HTTP tipado', area: 'Apps Flutter', summary: 'Login, registro, viajes, creación, tracking e historial con modelos tipados.', status: 'done', priority: 'Alta', evidence: 'apps/lib/core/api_client.dart y apps/lib/models/api_models.dart.', source: 'Verificado' },
  { id: 'navigation-docs', title: 'Flujos de navegación documentados', area: 'Producto', summary: 'Diagramas Mermaid, inventario de módulos y matriz de endpoints para web y móvil.', status: 'done', priority: 'Media', evidence: 'web/FLUJO_NAVEGACION.md y apps/FLUJO_NAVEGACION.md.', source: 'Verificado' },
  { id: 'proposal-html', title: 'Propuesta comercial HTML', area: 'Entrega comercial', summary: 'Documento imprimible con alcance de cuatro semanas y límites comerciales.', status: 'done', priority: 'Media', evidence: 'docs/propuesta-comercial-mario-martinez.html.', source: 'Verificado' },
  { id: 'local-deliverables-db', title: 'Base local de entregables', area: 'Gestión del proyecto', summary: 'SQLite local para persistir tarjetas, estado, prioridad, evidencia y fuente.', status: 'in_progress', priority: 'Alta', evidence: 'api-incoex/data/incoex-local.sqlite y DeliverablesStore.', source: 'En implementación' },
  { id: 'deliverables-view', title: 'Ruta Entregables + Kanban', area: 'Web superadmin', summary: 'Vista ejecutable para revisar alcance, avance tangible y mover tarjetas de estado.', status: 'in_progress', priority: 'Alta', evidence: 'Módulo web Entregables y PATCH de estado en API.', source: 'En implementación' },
  { id: 'auth-real', title: 'Autenticación real y recuperación', area: 'Seguridad', summary: 'JWT/refresh tokens, recuperación, bloqueo, sesiones y permisos por rol.', status: 'review', priority: 'Alta', evidence: 'Hoy existe auth de prototipo; falta proveedor y persistencia segura.', source: 'Pendiente' },
  { id: 'rbac-audit', title: 'RBAC de ocho roles + auditoría', area: 'Seguridad', summary: 'Matriz contractual de permisos, cambios protegidos y bitácora trazable.', status: 'review', priority: 'Alta', evidence: 'Roles contractuales identificados; guardas y auditoría real pendientes.', source: 'Pendiente' },
  { id: 'figma-fidelity', title: 'Fidelidad visual a Figma', area: 'UX/UI', summary: 'Assets finales, estados completos y paridad de las vistas móviles y administrativas.', status: 'review', priority: 'Alta', evidence: 'La estructura existe; faltan assets del Figma y verificación visual en dispositivo.', source: 'Pendiente' },
  { id: 'flutter-platforms', title: 'Validación Flutter en Android/iOS', area: 'Apps Flutter', summary: 'Crear plataformas, ejecutar análisis, pruebas y smoke tests en dispositivos/emuladores.', status: 'review', priority: 'Alta', evidence: 'Formato Dart validado; analyze/build de dispositivo no verificados en este entorno.', source: 'Pendiente' },
  { id: 'operations-db', title: 'Persistencia operativa completa', area: 'API / Datos', summary: 'Migrar viajes, usuarios, clientes, conductores, pagos, evidencias e incidencias a PostgreSQL.', status: 'backlog', priority: 'Alta', evidence: 'El OperationsStore aún conserva datos demo en memoria.', source: 'Pendiente' },
  { id: 'maps-gps', title: 'Google Maps + GPS operativo', area: 'Tracking', summary: 'Geocodificación, rutas, ETA, posiciones y restricciones de segundo plano según contrato.', status: 'backlog', priority: 'Alta', evidence: 'Mapa actual es mock visual y tracking devuelve puntos de demostración.', source: 'Pendiente' },
  { id: 'evidence-storage', title: 'Evidencias y comprobante PDF', area: 'Operación', summary: 'Fotos, firma, documentos, S3/objeto y generación del comprobante operativo.', status: 'backlog', priority: 'Alta', evidence: 'Flujo visual parcial; almacenamiento y cierre documental no implementados.', source: 'Pendiente' },
  { id: 'payments-support', title: 'Pagos, soporte y notificaciones', area: 'Operación', summary: 'Registro/validación de pagos, casos de soporte y avisos transaccionales.', status: 'backlog', priority: 'Media', evidence: 'Incidencias demo disponibles; pagos, chat y notificaciones reales pendientes.', source: 'Pendiente' },
  { id: 'production-platform', title: 'Despliegue productivo', area: 'Infraestructura', summary: 'Docker, CI/CD, secretos, observabilidad, dominio y entorno productivo.', status: 'backlog', priority: 'Media', evidence: 'Dockerfiles base existen; AWS/DigitalOcean productivo aún no configurado.', source: 'Pendiente' },
  { id: 'requirements-matrix', title: 'Matriz de alcance y criterios de aceptación', area: 'Producto', summary: 'Descomposición del contrato en módulos, flujos, criterios y evidencia de cierre.', status: 'done', priority: 'Alta', evidence: 'Flujos y alcance base documentados en la raíz de web y apps.', source: 'Verificado' },
  { id: 'design-tokens', title: 'Sistema visual y tokens de marca', area: 'UX/UI', summary: 'Colores, tipografía Acumin, espaciado, estados, componentes y reglas de responsive.', status: 'in_progress', priority: 'Alta', evidence: 'Paleta y componentes base implementados; fuente licenciada pendiente de incorporar.', source: 'En implementación' },
  { id: 'web-responsive', title: 'Responsive del panel administrativo', area: 'Web superadmin', summary: 'Adaptación del panel para escritorio, tablet y revisión en resoluciones del cliente.', status: 'review', priority: 'Media', evidence: 'Layout responsive implementado; falta revisión visual en dispositivos objetivo.', source: 'Pendiente' },
  { id: 'web-auth-screens', title: 'Pantallas de acceso y recuperación web', area: 'Web superadmin', summary: 'Inicio de sesión, recuperación, cierre de sesión y estados de sesión expirada.', status: 'backlog', priority: 'Alta', evidence: 'El shell administrativo está disponible; las pantallas reales de identidad faltan.', source: 'Pendiente' },
  { id: 'web-loading-states', title: 'Estados de carga, vacío y error', area: 'Web superadmin', summary: 'Feedback consistente para consultas, mutaciones, errores de red y ausencia de registros.', status: 'review', priority: 'Media', evidence: 'Hay banner global de conexión y estados parciales por módulo.', source: 'Pendiente' },
  { id: 'web-pdf-report', title: 'Informe de avance imprimible / PDF', area: 'Entrega comercial', summary: 'Reporte para cliente con alcance, avance, evidencias, capturas y trazabilidad.', status: 'in_progress', priority: 'Alta', evidence: 'Vista Entregables incluye informe, referencias y salida de impresión del navegador.', source: 'En implementación' },
  { id: 'web-reference-gallery', title: 'Galería de pantallas de referencia', area: 'Entrega comercial', summary: 'Capturas ordenadas de Figma para comparar diseño, alcance y avance por módulo.', status: 'done', priority: 'Media', evidence: 'web/public/reference contiene las 10 capturas incorporadas en Entregables.', source: 'Verificado' },
  { id: 'mobile-onboarding', title: 'Onboarding móvil de tres pasos', area: 'Apps Flutter', summary: 'Bienvenida, beneficios del servicio, omitir y continuidad hacia acceso.', status: 'done', priority: 'Alta', evidence: 'Flujo de onboarding y navegación documentados en apps/FLUJO_NAVEGACION.md.', source: 'Verificado' },
  { id: 'mobile-auth-flow', title: 'Acceso y registro de empresa', area: 'Apps Flutter', summary: 'Login, registro corporativo, validaciones, sesión y salida segura.', status: 'review', priority: 'Alta', evidence: 'Cliente HTTP y pantallas base existen; identidad real y persistencia están pendientes.', source: 'Pendiente' },
  { id: 'mobile-shipment-wizard', title: 'Asistente de solicitud de envío', area: 'Apps Flutter', summary: 'Origen, destino, transporte, carga, referencias, destinatario y programación.', status: 'in_progress', priority: 'Alta', evidence: 'Modelos y endpoints de creación disponibles; falta completar paridad visual con Figma.', source: 'En implementación' },
  { id: 'mobile-driver-assignment', title: 'Asignación de conductor desde móvil', area: 'Apps Flutter', summary: 'Búsqueda de conductor disponible, espera, aceptación y estado del despacho.', status: 'backlog', priority: 'Alta', evidence: 'Flujo representado en las pantallas de referencia; backend de asignación aún es prototipo.', source: 'Pendiente' },
  { id: 'mobile-live-tracking', title: 'Seguimiento en vivo para empresa', area: 'Apps Flutter', summary: 'Guía, ubicación, ETA, estado del viaje, chat y comunicación con el conductor.', status: 'review', priority: 'Alta', evidence: 'Pantalla de seguimiento documentada; GPS y canal realtime aún faltan.', source: 'Pendiente' },
  { id: 'mobile-delivery-proof', title: 'Cierre de entrega en móvil', area: 'Apps Flutter', summary: 'Confirmación, firma/foto, calificación, recibo y regreso al historial.', status: 'backlog', priority: 'Alta', evidence: 'Pantallas de entregado y resumen referenciadas; evidencias reales no implementadas.', source: 'Pendiente' },
  { id: 'driver-app-role', title: 'Rol y experiencia de conductor', area: 'Apps Flutter', summary: 'Disponibilidad, viaje asignado, navegación, recogida, entrega e incidencias.', status: 'backlog', priority: 'Alta', evidence: 'El alcance contempla conductores; aún no existe un flujo operativo completo separado.', source: 'Pendiente' },
  { id: 'api-domain-modules', title: 'Módulos de dominio NestJS', area: 'API', summary: 'Usuarios, empresas, conductores, viajes, paquetes, incidencias y reportes separados por módulo.', status: 'review', priority: 'Alta', evidence: 'Endpoints de prototipo responden; falta consolidar módulos y persistencia productiva.', source: 'Pendiente' },
  { id: 'api-validation-errors', title: 'Validación y errores de negocio', area: 'API', summary: 'DTOs, códigos de error, reglas de transición y respuestas consistentes para los clientes.', status: 'backlog', priority: 'Alta', evidence: 'Validación base habilitada; reglas completas de negocio todavía no están cerradas.', source: 'Pendiente' },
  { id: 'api-realtime-gateway', title: 'Gateway realtime de tracking', area: 'Tracking', summary: 'Canal WebSocket, presencia, ubicación periódica, reconexión y eventos de viaje.', status: 'backlog', priority: 'Alta', evidence: 'No hay gateway realtime productivo; tracking actual entrega datos de demostración.', source: 'Pendiente' },
  { id: 'api-file-uploads', title: 'Carga segura de archivos', area: 'API / Datos', summary: 'Fotos de paquetes, documentos y comprobantes con límites, validación y almacenamiento de objetos.', status: 'backlog', priority: 'Alta', evidence: 'El formulario visual contempla imágenes; endpoint y almacenamiento seguro faltan.', source: 'Pendiente' },
  { id: 'api-notifications', title: 'Notificaciones transaccionales', area: 'API', summary: 'Avisos de solicitud, asignación, cambios de estado, entrega e incidencias.', status: 'backlog', priority: 'Media', evidence: 'Indicadores visuales existentes; proveedor y envío real no configurados.', source: 'Pendiente' },
  { id: 'api-audit-log', title: 'Bitácora de cambios y eventos', area: 'Seguridad', summary: 'Registro de actor, acción, recurso, fecha, IP y resultado para operaciones sensibles.', status: 'backlog', priority: 'Alta', evidence: 'Historial visual existe; auditoría técnica de cambios aún no implementada.', source: 'Pendiente' },
  { id: 'postgres-migrations', title: 'Esquema PostgreSQL y migraciones', area: 'API / Datos', summary: 'Modelo relacional, índices, restricciones, seed de desarrollo y migraciones reversibles.', status: 'backlog', priority: 'Alta', evidence: 'SQLite cubre el tablero local; la persistencia operativa sigue en memoria.', source: 'Pendiente' },
  { id: 'test-api', title: 'Pruebas unitarias y HTTP de API', area: 'QA', summary: 'Casos felices, errores, permisos, transiciones de viaje y persistencia.', status: 'backlog', priority: 'Alta', evidence: 'Smoke tests locales ejecutados; suite automatizada de dominio todavía falta.', source: 'Pendiente' },
  { id: 'test-web', title: 'Pruebas funcionales del panel', area: 'QA', summary: 'Recorridos de navegación, conexión, filtros, mutaciones y exportación del informe.', status: 'backlog', priority: 'Media', evidence: 'Build Vite validado; pruebas E2E del panel aún no configuradas.', source: 'Pendiente' },
  { id: 'test-mobile', title: 'Pruebas Flutter en emulador y dispositivo', area: 'QA', summary: 'Smoke tests Android/iOS, permisos, ubicación, cámara, red y estados offline.', status: 'backlog', priority: 'Alta', evidence: 'El entorno actual no tiene plataformas Flutter ni validación de dispositivo cerrada.', source: 'Pendiente' },
  { id: 'security-hardening', title: 'Endurecimiento de seguridad', area: 'Seguridad', summary: 'Secretos, CORS, rate limit, headers, validación de payloads y revisión de exposición.', status: 'backlog', priority: 'Alta', evidence: 'Base local disponible; hardening para producción no ha sido ejecutado.', source: 'Pendiente' },
  { id: 'observability', title: 'Logs, métricas y alertas', area: 'Infraestructura', summary: 'Logs estructurados, health checks, métricas de latencia y alertas operativas.', status: 'backlog', priority: 'Media', evidence: 'Health endpoint disponible; observabilidad productiva pendiente.', source: 'Pendiente' },
  { id: 'domain-ssl', title: 'Dominio, HTTPS y ambientes', area: 'Infraestructura', summary: 'DNS, certificado TLS, variables por ambiente, staging y producción.', status: 'backlog', priority: 'Media', evidence: 'incoexlogistics.com está definido en el alcance; DNS y HTTPS no están montados.', source: 'Pendiente' },
  { id: 'backup-restore', title: 'Backups y recuperación', area: 'Infraestructura', summary: 'Política de respaldos, restauración probada y retención de datos operativos.', status: 'backlog', priority: 'Media', evidence: 'SQLite local no sustituye una política de continuidad operativa.', source: 'Pendiente' },
]

@Injectable()
export class DeliverablesStore implements OnModuleDestroy {
  private readonly db: DatabaseSync

  constructor() {
    const databasePath = resolve(process.env.INCOEX_DB_PATH ?? 'data/incoex-local.sqlite')
    mkdirSync(dirname(databasePath), { recursive: true })
    this.db = new DatabaseSync(databasePath, { timeout: 5000 })
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS deliverables (
        id TEXT PRIMARY KEY,
        title TEXT NOT NULL,
        area TEXT NOT NULL,
        summary TEXT NOT NULL,
        status TEXT NOT NULL CHECK (status IN ('backlog', 'in_progress', 'review', 'done')),
        priority TEXT NOT NULL CHECK (priority IN ('Alta', 'Media', 'Baja')),
        evidence TEXT NOT NULL,
        source TEXT NOT NULL CHECK (source IN ('Verificado', 'En implementación', 'Pendiente')),
        updated_at TEXT NOT NULL
      )
    `)
    const count = Number((this.db.prepare('SELECT COUNT(*) AS count FROM deliverables').get() as { count: number }).count)
    if (count === 0) this.seed()
    else this.seedMissing()
  }

  list() {
    const rows = this.db.prepare("SELECT * FROM deliverables ORDER BY CASE status WHEN 'in_progress' THEN 1 WHEN 'review' THEN 2 WHEN 'backlog' THEN 3 ELSE 4 END, priority, title").all() as unknown as DeliverableRow[]
    return rows.map(toDeliverable)
  }

  summary() {
    const rows = this.db.prepare('SELECT status, COUNT(*) AS count FROM deliverables GROUP BY status').all() as unknown as Array<{ status: DeliverableStatus; count: number }>
    const counts = rows.reduce<Record<DeliverableStatus, number>>((result, row) => { result[row.status] = Number(row.count); return result }, { backlog: 0, in_progress: 0, review: 0, done: 0 })
    return { total: Object.values(counts).reduce((sum, count) => sum + count, 0), ...counts }
  }

  updateStatus(id: string, status: DeliverableStatus) {
    const updatedAt = new Date().toISOString()
    const result = this.db.prepare('UPDATE deliverables SET status = ?, updated_at = ? WHERE id = ?').run(status, updatedAt, id)
    if (Number(result.changes) === 0) throw new NotFoundException('Entregable no encontrado')
    const row = this.db.prepare('SELECT * FROM deliverables WHERE id = ?').get(id) as unknown as DeliverableRow
    return toDeliverable(row)
  }

  onModuleDestroy() { this.db.close() }

  private seed() {
    const insert = this.db.prepare('INSERT INTO deliverables (id, title, area, summary, status, priority, evidence, source, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)')
    const now = new Date().toISOString()
    for (const item of SEED) insert.run(item.id, item.title, item.area, item.summary, item.status, item.priority, item.evidence, item.source, now)
  }

  private seedMissing() {
    const exists = this.db.prepare('SELECT 1 AS present FROM deliverables WHERE id = ?')
    const insert = this.db.prepare('INSERT INTO deliverables (id, title, area, summary, status, priority, evidence, source, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)')
    const now = new Date().toISOString()
    for (const item of SEED) {
      if (!exists.get(item.id)) insert.run(item.id, item.title, item.area, item.summary, item.status, item.priority, item.evidence, item.source, now)
    }
  }
}

function toDeliverable(row: DeliverableRow): Deliverable {
  return { id: row.id, title: row.title, area: row.area, summary: row.summary, status: row.status, priority: row.priority, evidence: row.evidence, source: row.source, updatedAt: row.updated_at }
}
