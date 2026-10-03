import { Module } from '@nestjs/common';
import { UsersService } from './users.service';
import { UsersController } from './users.controller';
import { AccountService } from './account.service';
import { AdminUsersService } from './admin-users.service';
import { AdminUsersController } from './admin-users.controller';
import { EmailChangeController } from './email-change.controller';
import { SecurityModule } from '../auth/security.module';

@Module({
  imports: [SecurityModule],
  controllers: [UsersController, AdminUsersController, EmailChangeController],
  providers: [UsersService, AccountService, AdminUsersService],
  // UsersService se exporta para que AuthModule lo use en el registro y el login.
  exports: [UsersService],
})
export class UsersModule {}
