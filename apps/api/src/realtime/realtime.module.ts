import { Module } from '@nestjs/common';

import { RoomModule } from '../rooms/room.module';
import { RealtimeGateway } from './realtime.gateway';

@Module({
  imports: [RoomModule],
  providers: [RealtimeGateway],
})
export class RealtimeModule {}
