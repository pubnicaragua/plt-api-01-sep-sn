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
  startDate: string
  targetDate: string
  owner: string
  phase: string
  contractRef: string
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
  start_date: string
  target_date: string
  owner: string
  phase: string
  contract_ref: string
  updated_at: string
}

type SeedDeliverable = Omit<Deliverable, 'updatedAt' | 'startDate' | 'targetDate' | 'owner' | 'phase' | 'contractRef'> & Partial<Pick<Deliverable, 'startDate' | 'targetDate' | 'owner' | 'phase' | 'contractRef'>>

const CONTRACT_VIEW_SEED: SeedDeliverable[] = [
  { id: 'view-c-01', title: 'C-01 · Acceso y recuperación', area: 'Portal empresas', summary: 'Inicio de sesión, recuperación, cierre y bloqueo de usuarios desactivados.', status: 'review', priority: 'Alta', evidence: 'Vista contractual identificada; autenticación real pendiente.', source: 'Pendiente' },
  { id: 'view-c-02', title: 'C-02 · Inicio y creación de pedido', area: 'Portal empresas', summary: 'Servicio inmediato o programado, vehículo, capacidad y solicitudes activas.', status: 'review', priority: 'Alta', evidence: 'Flujo representado en las capturas; paridad funcional pendiente.', source: 'Pendiente' },
  { id: 'view-c-03', title: 'C-03 · Dirección y contacto de retiro', area: 'Portal empresas', summary: 'Dirección, mapa, ubicación actual, contacto, instrucciones y dirección guardada.', status: 'backlog', priority: 'Alta', evidence: 'Requisito contractual; geocodificación y formulario faltantes.', source: 'Pendiente' },
  { id: 'view-c-04', title: 'C-04 · Dirección y contacto de entrega', area: 'Portal empresas', summary: 'Destino, contacto receptor, teléfono, instrucciones y área de recepción.', status: 'backlog', priority: 'Alta', evidence: 'Requisito contractual; flujo de destino pendiente.', source: 'Pendiente' },
  { id: 'view-c-05', title: 'C-05 · Resumen preliminar de carga', area: 'Portal empresas', summary: 'Descripción, bultos, tipo de carga, observaciones y foto opcional.', status: 'in_progress', priority: 'Alta', evidence: 'Campos y modelos base disponibles; validación de carga pendiente.', source: 'En implementación' },
  { id: 'view-c-06', title: 'C-06 · Revisión, ruta y cotización', area: 'Portal empresas', summary: 'Resumen, ruta, distancia, tiempo, tarifa estimada y confirmación.', status: 'backlog', priority: 'Alta', evidence: 'Cálculo de tarifa y rutas reales pendientes.', source: 'Pendiente' },
  { id: 'view-c-07', title: 'C-07 · Pago y comprobantes', area: 'Portal empresas', summary: 'Monto, saldo, método, referencia, comprobante y estado de validación.', status: 'backlog', priority: 'Alta', evidence: 'Registro de pagos y adjuntos aún no implementado.', source: 'Pendiente' },
  { id: 'view-c-08', title: 'C-08 · Tracking y seguimiento', area: 'Portal empresas', summary: 'Estado, conductor, vehículo, última ubicación, ETA, estados e incidencias.', status: 'review', priority: 'Alta', evidence: 'Pantalla de tracking referenciada; ubicación real pendiente.', source: 'Pendiente' },
  { id: 'view-c-09', title: 'C-09 · Historial de solicitudes', area: 'Portal empresas', summary: 'Historial por número, fecha, estado y tipo de vehículo.', status: 'backlog', priority: 'Media', evidence: 'Endpoint de historial base disponible; filtros del portal faltan.', source: 'Pendiente' },
  { id: 'view-c-10', title: 'C-10 · Detalle y comprobante final', area: 'Portal empresas', summary: 'Detalle autorizado, pagos, evidencias, incidencias y comprobante operativo PDF.', status: 'backlog', priority: 'Alta', evidence: 'Generación de comprobante y permisos de descarga pendientes.', source: 'Pendiente' },
  { id: 'view-c-11', title: 'C-11 · Soporte', area: 'Portal empresas', summary: 'Casos, motivos, mensajes, adjuntos, ubicación y estado de resolución.', status: 'backlog', priority: 'Media', evidence: 'Chat interno y casos vinculados aún no implementados.', source: 'Pendiente' },
  { id: 'view-d-01', title: 'D-01 · Acceso del conductor', area: 'Interfaz conductor', summary: 'Acceso, recuperación, cuenta activa y cierre de sesión.', status: 'backlog', priority: 'Alta', evidence: 'Autenticación de conductor pendiente.', source: 'Pendiente' },
  { id: 'view-d-02', title: 'D-02 · Solicitudes disponibles y asignadas', area: 'Interfaz conductor', summary: 'Servicios compatibles, tiempo de respuesta, aceptar y rechazar con motivo.', status: 'backlog', priority: 'Alta', evidence: 'Reglas de asignación y respuesta de 45 segundos pendientes.', source: 'Pendiente' },
  { id: 'view-d-03', title: 'D-03 · Detalle y ejecución del servicio', area: 'Interfaz conductor', summary: 'Rutas, contactos, carga, pagos, soporte e hitos de retiro y entrega.', status: 'backlog', priority: 'Alta', evidence: 'Flujo operativo de conductor aún no construido.', source: 'Pendiente' },
  { id: 'view-d-04', title: 'D-04 · Confirmación de entrega', area: 'Interfaz conductor', summary: 'Receptor, documento, fotografías, firma, guía, observaciones y cierre.', status: 'backlog', priority: 'Alta', evidence: 'Evidencias y firma digital pendientes.', source: 'Pendiente' },
  { id: 'view-d-05', title: 'D-05 · Historial y actividad', area: 'Interfaz conductor', summary: 'Servicios, cancelaciones, incidencias, evidencias y reasignaciones.', status: 'backlog', priority: 'Media', evidence: 'Historial específico de conductor pendiente.', source: 'Pendiente' },
  { id: 'view-t-01', title: 'T-01 · Recepciones pendientes', area: 'Tienda / recepción', summary: 'Solicitudes, fecha, vehículo, cantidad preliminar y validación.', status: 'backlog', priority: 'Alta', evidence: 'Rol y bandeja de tienda aún no implementados.', source: 'Pendiente' },
  { id: 'view-t-02', title: 'T-02 · Validación física del paquete', area: 'Tienda / recepción', summary: 'Bultos, peso, dimensiones, carga, estado, valor y observaciones.', status: 'backlog', priority: 'Alta', evidence: 'Validación física del paquete pendiente.', source: 'Pendiente' },
  { id: 'view-t-03', title: 'T-03 · Evidencia inicial', area: 'Tienda / recepción', summary: 'Fotografías, documentos, observaciones, ubicación y responsable.', status: 'backlog', priority: 'Alta', evidence: 'Captura y almacenamiento de evidencia pendiente.', source: 'Pendiente' },
  { id: 'view-t-04', title: 'T-04 · Historial de validaciones', area: 'Tienda / recepción', summary: 'Consulta de validaciones, cambios, usuarios y fechas.', status: 'backlog', priority: 'Media', evidence: 'Historial de recepción pendiente.', source: 'Pendiente' },
  { id: 'view-a-01', title: 'A-01 · Acceso administrativo', area: 'Panel administrativo', summary: 'Inicio de sesión, recuperación, cierre y permisos del personal interno.', status: 'review', priority: 'Alta', evidence: 'Shell administrativo conectado; autenticación real pendiente.', source: 'Pendiente' },
  { id: 'view-a-02', title: 'A-02 · Dashboard operativo', area: 'Panel administrativo', summary: 'Indicadores de viajes, conductores, paquetes, incidencias y mapa.', status: 'done', priority: 'Alta', evidence: 'Dashboard Vite conectado a endpoints de resumen.', source: 'Verificado' },
  { id: 'view-a-03', title: 'A-03 · Solicitudes y paquetes', area: 'Panel administrativo', summary: 'Listado, filtros, estados, cliente, conductor, fechas y paquetes.', status: 'in_progress', priority: 'Alta', evidence: 'Tablas operativas conectadas; filtros avanzados pendientes.', source: 'En implementación' },
  { id: 'view-a-04', title: 'A-04 · Detalle de solicitud', area: 'Panel administrativo', summary: 'Detalle completo, ruta, estados, asignación, pagos, evidencias e incidencias.', status: 'backlog', priority: 'Alta', evidence: 'Vista de detalle integral pendiente.', source: 'Pendiente' },
  { id: 'view-a-05', title: 'A-05 · Empresas solicitantes', area: 'Panel administrativo', summary: 'Alta, edición, estado, contactos, direcciones y solicitudes por empresa.', status: 'in_progress', priority: 'Alta', evidence: 'Listado de clientes conectado; edición y permisos pendientes.', source: 'En implementación' },
  { id: 'view-a-06', title: 'A-06 · Conductores', area: 'Panel administrativo', summary: 'Registro, disponibilidad, documentos, vehículo, actividad y estado.', status: 'in_progress', priority: 'Alta', evidence: 'Listado de conductores conectado; alta documental pendiente.', source: 'En implementación' },
  { id: 'view-a-07', title: 'A-07 · Vehículos', area: 'Panel administrativo', summary: 'Catálogo, capacidad, rendimiento, combustible, documentos y servicio.', status: 'backlog', priority: 'Alta', evidence: 'Catálogo de vehículos aún no implementado.', source: 'Pendiente' },
  { id: 'view-a-08', title: 'A-08 · Asignaciones', area: 'Panel administrativo', summary: 'Candidatos, compatibilidad, aceptación, rechazo y reasignación.', status: 'in_progress', priority: 'Alta', evidence: 'Asignación manual de prototipo disponible; reglas completas pendientes.', source: 'En implementación' },
  { id: 'view-a-09', title: 'A-09 · Pagos', area: 'Panel administrativo', summary: 'Pagos, parciales, comprobantes, saldos, aprobaciones y crédito.', status: 'backlog', priority: 'Alta', evidence: 'Módulo financiero no implementado.', source: 'Pendiente' },
  { id: 'view-a-10', title: 'A-10 · Soporte e incidencias', area: 'Panel administrativo', summary: 'Casos, mensajes, adjuntos, responsables, escalamiento y resolución.', status: 'review', priority: 'Alta', evidence: 'Listado de incidencias conectado; soporte conversacional pendiente.', source: 'Pendiente' },
  { id: 'view-a-11', title: 'A-11 · Parámetros, tarifas y zonas', area: 'Panel administrativo', summary: 'Tarifas, recargos, zonas, horarios, capacidades y reglas operativas.', status: 'backlog', priority: 'Alta', evidence: 'Configuración de tarifas y reglas pendiente.', source: 'Pendiente' },
  { id: 'view-a-12', title: 'A-12 · Reportes', area: 'Panel administrativo', summary: 'Diez reportes estándar con tablas, totales, filtros y exportación autorizada.', status: 'review', priority: 'Alta', evidence: 'Resumen analítico conectado; diez reportes contractuales pendientes.', source: 'Pendiente' },
  { id: 'view-a-13', title: 'A-13 · Usuarios', area: 'Panel administrativo', summary: 'Usuarios internos, empresas, conductores, activación y recuperación.', status: 'backlog', priority: 'Alta', evidence: 'Administración de usuarios pendiente.', source: 'Pendiente' },
  { id: 'view-a-14', title: 'A-14 · Roles y permisos', area: 'Panel administrativo', summary: 'Ocho roles, permisos por módulo y restricciones de acciones.', status: 'backlog', priority: 'Alta', evidence: 'Matriz identificada; guardas y gestión de permisos pendientes.', source: 'Pendiente' },
  { id: 'view-a-15', title: 'A-15 · Auditoría', area: 'Panel administrativo', summary: 'Usuarios responsables, fechas, cambios, excepciones y trazabilidad.', status: 'backlog', priority: 'Alta', evidence: 'Auditoría técnica pendiente.', source: 'Pendiente' },
]

const PROCESS_SEED: SeedDeliverable[] = [
  { id: 'roles-eight', title: 'Configuración de los ocho roles contractuales', area: 'Seguridad', summary: 'Administrador, Gerencia, Operaciones, Finanzas, Soporte, Conductor y usuarios autorizados.', status: 'backlog', priority: 'Alta', evidence: 'Roles descritos en el alcance; matriz ejecutable pendiente.', source: 'Pendiente' },
  { id: 'workflow-immediate', title: 'Flujo 1 · Solicitud inmediata', area: 'Flujos operativos', summary: 'Solicitud, vehículo, retiro, entrega, cotización, confirmación y asignación.', status: 'review', priority: 'Alta', evidence: 'Flujo documentado; integración completa pendiente.', source: 'Pendiente' },
  { id: 'workflow-scheduled', title: 'Flujo 2 · Solicitud programada', area: 'Flujos operativos', summary: 'Fecha, rango horario y recordatorios a dos horas, una hora y treinta minutos.', status: 'backlog', priority: 'Alta', evidence: 'Recordatorios y programación aún no implementados.', source: 'Pendiente' },
  { id: 'workflow-validation', title: 'Flujo 3 · Validación de carga', area: 'Flujos operativos', summary: 'Recepción, peso, dimensiones, estado, fotografías, compatibilidad y recálculo.', status: 'backlog', priority: 'Alta', evidence: 'Rol de tienda y reglas de recálculo pendientes.', source: 'Pendiente' },
  { id: 'workflow-assignment', title: 'Flujo 4 · Asignación y reasignación', area: 'Flujos operativos', summary: 'Compatibilidad, candidatos, respuesta de 45 segundos, rechazo y trazabilidad.', status: 'in_progress', priority: 'Alta', evidence: 'Asignación manual disponible; motor determinístico pendiente.', source: 'En implementación' },
  { id: 'workflow-execution', title: 'Flujo 5 · Ejecución y tracking', area: 'Flujos operativos', summary: 'Llegada, retiro, traslado, llegada al destino y entrega.', status: 'review', priority: 'Alta', evidence: 'Estados y tracking visual disponibles; GPS real pendiente.', source: 'Pendiente' },
  { id: 'workflow-payment-incident', title: 'Flujo 6 · Pago e incidencia', area: 'Flujos operativos', summary: 'Reporte, revisión, aprobación, diferencia, soporte y autorización de continuidad.', status: 'backlog', priority: 'Alta', evidence: 'Pagos y soporte real pendientes.', source: 'Pendiente' },
  { id: 'workflow-delivery', title: 'Flujo 7 · Confirmación de entrega', area: 'Flujos operativos', summary: 'Receptor, fotografías, firma, guía, observaciones, comprobante y finalización.', status: 'backlog', priority: 'Alta', evidence: 'Cierre documental y PDF operativo pendientes.', source: 'Pendiente' },
  { id: 'state-machine-17', title: 'Máquina de 17 estados operativos', area: 'Reglas de negocio', summary: 'Transiciones válidas desde pedido creado hasta finalizado o cancelado.', status: 'backlog', priority: 'Alta', evidence: 'Estados contractuales identificados; guardas de transición pendientes.', source: 'Pendiente' },
  { id: 'assignment-rules', title: 'Motor determinístico de asignación', area: 'Reglas de negocio', summary: 'Disponibilidad, capacidad, radio, llegada, ruta, conflictos y rechazos recientes.', status: 'backlog', priority: 'Alta', evidence: 'No incluye inteligencia artificial; reglas de selección faltan.', source: 'Pendiente' },
  { id: 'tariff-engine', title: 'Motor de tarifas y recargos', area: 'Reglas de negocio', summary: 'Mínimo, distancia, kilómetros incluidos, zona, horario, espera y carga.', status: 'backlog', priority: 'Alta', evidence: 'Cotización real pendiente de parámetros y mapas.', source: 'Pendiente' },
  { id: 'fuel-estimation', title: 'Estimación de combustible', area: 'Reglas de negocio', summary: 'Kilómetros registrados, rendimiento, tipo y precio vigente para estimación administrativa.', status: 'backlog', priority: 'Media', evidence: 'No se mide combustible real; fórmula contractual pendiente.', source: 'Pendiente' },
  { id: 'payment-states', title: 'Estados y validación de pagos', area: 'Finanzas', summary: 'Pendiente, parcial, reportado, revisión, aprobado, rechazado, crédito y contra entrega.', status: 'backlog', priority: 'Alta', evidence: 'Módulo financiero pendiente.', source: 'Pendiente' },
  { id: 'support-chat', title: 'Chat interno y casos de soporte', area: 'Soporte', summary: 'Mensajes vinculados a la solicitud, adjuntos, responsables, escalamiento y cierre.', status: 'backlog', priority: 'Alta', evidence: 'La interfaz de incidencias existe; chat interno pendiente.', source: 'Pendiente' },
  { id: 'delivery-evidence-rules', title: 'Reglas de evidencias obligatorias', area: 'Operación', summary: 'Fotos, firma, documento, ubicación y pago aprobado por tipo de servicio.', status: 'backlog', priority: 'Alta', evidence: 'Excepciones autorizadas y límites de archivos pendientes.', source: 'Pendiente' },
  { id: 'report-01-10', title: 'Diez reportes estándar contractuales', area: 'Reportes', summary: 'Solicitudes, kilómetros, vehículos, clientes, combustible, conductores, pagos e incidencias.', status: 'backlog', priority: 'Alta', evidence: 'Resumen disponible; catálogo de diez reportes pendiente.', source: 'Pendiente' },
  { id: 'notifications-contract', title: 'Notificaciones internas y correo', area: 'Notificaciones', summary: 'Eventos de solicitud, asignación, pago, incidencia, entrega y recuperación.', status: 'backlog', priority: 'Media', evidence: 'Proveedor, plantillas y recordatorios pendientes.', source: 'Pendiente' },
  { id: 'data-governance', title: 'Estructura, mantenimiento y propiedad de datos', area: 'API / Datos', summary: 'Modelo aprobado, acceso, retención, respaldos, restauración y responsabilidades.', status: 'backlog', priority: 'Alta', evidence: 'SQLite cubre el seguimiento local; gobierno productivo pendiente.', source: 'Pendiente' },
]

const SEED: SeedDeliverable[] = [
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
  ...CONTRACT_VIEW_SEED,
  ...PROCESS_SEED,
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
        start_date TEXT NOT NULL DEFAULT '2026-08-17',
        target_date TEXT NOT NULL DEFAULT '2026-09-13',
        owner TEXT NOT NULL DEFAULT 'Equipo de producto',
        phase TEXT NOT NULL DEFAULT 'Implementación',
        contract_ref TEXT NOT NULL DEFAULT 'Alcance general',
        updated_at TEXT NOT NULL
      )
    `)
    this.ensureColumn('start_date', "TEXT NOT NULL DEFAULT '2026-08-17'")
    this.ensureColumn('target_date', "TEXT NOT NULL DEFAULT '2026-09-13'")
    this.ensureColumn('owner', "TEXT NOT NULL DEFAULT 'Equipo de producto'")
    this.ensureColumn('phase', "TEXT NOT NULL DEFAULT 'Implementación'")
    this.ensureColumn('contract_ref', "TEXT NOT NULL DEFAULT 'Alcance general'")
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
    const insert = this.db.prepare('INSERT INTO deliverables (id, title, area, summary, status, priority, evidence, source, start_date, target_date, owner, phase, contract_ref, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)')
    const now = new Date().toISOString()
    SEED.forEach((item, index) => { const normalized = normalizeSeed(item, index); insert.run(normalized.id, normalized.title, normalized.area, normalized.summary, normalized.status, normalized.priority, normalized.evidence, normalized.source, normalized.startDate, normalized.targetDate, normalized.owner, normalized.phase, normalized.contractRef, now) })
  }

  private seedMissing() {
    const exists = this.db.prepare('SELECT 1 AS present FROM deliverables WHERE id = ?')
    const insert = this.db.prepare('INSERT INTO deliverables (id, title, area, summary, status, priority, evidence, source, start_date, target_date, owner, phase, contract_ref, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)')
    const now = new Date().toISOString()
    SEED.forEach((item, index) => { if (!exists.get(item.id)) { const normalized = normalizeSeed(item, index); insert.run(normalized.id, normalized.title, normalized.area, normalized.summary, normalized.status, normalized.priority, normalized.evidence, normalized.source, normalized.startDate, normalized.targetDate, normalized.owner, normalized.phase, normalized.contractRef, now) } })
  }

  private ensureColumn(name: string, definition: string) {
    const columns = this.db.prepare('PRAGMA table_info(deliverables)').all() as unknown as Array<{ name: string }>
    if (!columns.some((column) => column.name === name)) this.db.exec(`ALTER TABLE deliverables ADD COLUMN ${name} ${definition}`)
  }
}

function toDeliverable(row: DeliverableRow): Deliverable {
  return { id: row.id, title: row.title, area: row.area, summary: row.summary, status: row.status, priority: row.priority, evidence: row.evidence, source: row.source, startDate: row.start_date, targetDate: row.target_date, owner: row.owner, phase: row.phase, contractRef: row.contract_ref, updatedAt: row.updated_at }
}

function normalizeSeed(item: SeedDeliverable, index: number): Deliverable {
  const phase = item.phase ?? phaseForArea(item.area)
  return {
    ...item,
    startDate: item.startDate ?? '2026-08-17',
    targetDate: item.targetDate ?? targetDateForPhase(phase),
    owner: item.owner ?? ownerForArea(item.area),
    phase,
    contractRef: item.contractRef ?? contractRefForArea(item.area),
    updatedAt: new Date(0).toISOString(),
  }
}

function phaseForArea(area: string) {
  if (['Producto', 'UX/UI', 'Entrega comercial', 'Gestión del proyecto'].includes(area)) return 'Semana 1 · Definición'
  if (['API', 'API / Datos', 'Seguridad', 'Reglas de negocio'].includes(area)) return 'Semana 2 · Base técnica'
  if (['Web superadmin', 'Portal empresas', 'Interfaz conductor', 'Tienda / recepción', 'Panel administrativo', 'Apps Flutter', 'Tracking', 'Operación', 'Finanzas', 'Soporte', 'Notificaciones'].includes(area)) return 'Semana 3 · Flujos'
  return 'Semana 4 · QA y salida'
}

function targetDateForPhase(phase: string) {
  if (phase.startsWith('Semana 1')) return '2026-08-23'
  if (phase.startsWith('Semana 2')) return '2026-08-30'
  if (phase.startsWith('Semana 3')) return '2026-09-06'
  return '2026-09-13'
}

function ownerForArea(area: string) {
  if (area.includes('Web') || area.includes('Portal') || area.includes('Panel')) return 'Equipo web'
  if (area.includes('Flutter') || area.includes('conductor') || area.includes('recepción')) return 'Equipo móvil'
  if (area.includes('API') || area.includes('Reglas') || area.includes('Seguridad')) return 'Backend y datos'
  if (area.includes('QA')) return 'QA y validación'
  if (area.includes('Infraestructura')) return 'DevOps'
  return 'Producto y operaciones'
}

function contractRefForArea(area: string) {
  if (area === 'Portal empresas') return 'Contrato · C-01 a C-11'
  if (area === 'Interfaz conductor') return 'Contrato · D-01 a D-05'
  if (area === 'Tienda / recepción') return 'Contrato · T-01 a T-04'
  if (area === 'Panel administrativo') return 'Contrato · A-01 a A-15'
  if (area === 'Flujos operativos') return 'Contrato · Flujos 1 a 7'
  return 'Contrato · Alcance general'
}
