import { Module } from '@nestjs/common'
import { DashboardController } from './dashboard.controller'
import { HealthController } from './health.controller'
import { IncidentsController } from './incidents.controller'
import { OperationsStore } from './operations.store'
import { TripsController } from './trips.controller'
import { DriversController } from './drivers.controller'
import { ClientsController } from './clients.controller'
import { AuthController } from './auth.controller'
import { HistoryController } from './history.controller'
import { ReportsController } from './reports.controller'
import { TrackingController } from './tracking.controller'
import { DeliverablesController } from './deliverables.controller'
import { DeliverablesStore } from './deliverables.store'
import { VehiclesController } from './vehicles.controller'
import { VehiclesStore } from './vehicles.store'
import { UsersController } from './users.controller'
import { UsersStore } from './users.store'
import { SettingsController } from './settings.controller'
import { SettingsStore } from './settings.store'
import { UploadsController } from './uploads.controller'
import { PlacesController } from './places.controller'
import { FinanceController } from './finance.controller'
import { FinanceStore } from './finance.store'
import { CortesController } from './cortes.controller'
import { CortesStore } from './cortes.store'
import { FuelController } from './fuel.controller'
import { FuelStore } from './fuel.store'
import { WhatsAppController } from './whatsapp.controller'
import { TarifasController } from './tarifas.controller'
import { TarifasStore } from './tarifas.store'

@Module({
  controllers: [
    HealthController,
    DashboardController,
    TripsController,
    DriversController,
    ClientsController,
    IncidentsController,
    AuthController,
    HistoryController,
    ReportsController,
    TrackingController,
    DeliverablesController,
    VehiclesController,
    UsersController,
    SettingsController,
    UploadsController,
    PlacesController,
    FinanceController,
    CortesController,
    WhatsAppController,
    FuelController,
    TarifasController,
  ],
  providers: [OperationsStore, DeliverablesStore, VehiclesStore, UsersStore, SettingsStore, FinanceStore, CortesStore, FuelStore, TarifasStore],
})
export class AppModule {}
