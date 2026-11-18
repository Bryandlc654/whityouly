import { Global, Module } from '@nestjs/common';
import { AdminOverviewController } from './admin-overview.controller';
import { AdminOverviewService } from './admin-overview.service';
import { AdminAuditController } from './admin-audit.controller';
import { AdminAuditService } from './admin-audit.service';

/**
 * Global para que los controladores administrativos de otros módulos puedan
 * registrar sus acciones sin importar el módulo completo.
 */
@Global()
@Module({
  controllers: [AdminOverviewController, AdminAuditController],
  providers: [AdminOverviewService, AdminAuditService],
  exports: [AdminAuditService],
})
export class AdminModule {}
