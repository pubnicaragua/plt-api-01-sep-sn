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
  ],
  providers: [OperationsStore, DeliverablesStore],
})
export class AppModule {}
