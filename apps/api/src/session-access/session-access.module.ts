import { Module } from '@nestjs/common';

import { RoomModule } from '../rooms/room.module';
import { RoomsController } from './rooms.controller';

@Module({ imports: [RoomModule], controllers: [RoomsController] })
export class SessionAccessModule {}
