import { Module } from '@nestjs/common';

import { HealthModule } from './health/health.module';
import { RealtimeModule } from './realtime/realtime.module';
import { RoomModule } from './rooms/room.module';
import { SessionAccessModule } from './session-access/session-access.module';

@Module({
  imports: [HealthModule, RoomModule, RealtimeModule, SessionAccessModule],
})
export class AppModule {}
