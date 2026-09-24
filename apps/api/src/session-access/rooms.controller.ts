import {
  BadRequestException,
  Body,
  ConflictException,
  Controller,
  ForbiddenException,
  Get,
  HttpCode,
  Inject,
  NotFoundException,
  Post,
  Req,
  Res,
  UnauthorizedException,
} from '@nestjs/common';
import { ApiBody, ApiCreatedResponse, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { loadAppConfig } from '../config/app-config';
import { RoomError, RoomService } from '../rooms/room.service';
import { CreateRoomDto, JoinRoomDto } from './room.dto';

type RequestLike = { headers: { cookie?: string } };
type ResponseLike = {
  cookie: (name: string, value: string, options: Record<string, unknown>) => void;
  clearCookie: (name: string) => void;
};

function cookieValue(header: string | undefined, name: string): string | undefined {
  return header
    ?.split(';')
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${name}=`))
    ?.slice(name.length + 1);
}

@ApiTags('rooms')
@Controller('rooms')
export class RoomsController {
  private readonly config = loadAppConfig();
  constructor(@Inject(RoomService) private readonly rooms: RoomService) {}

  @Post()
  @ApiOperation({ summary: 'Create a private Poker or Bài nói dối room' })
  @ApiBody({ type: CreateRoomDto })
  @ApiCreatedResponse({
    description: 'Returns the room invitation once and starts a guest session.',
  })
  create(@Body() body: CreateRoomDto, @Res({ passthrough: true }) response: ResponseLike) {
    try {
      const created = this.rooms.create(body);
      response.cookie(this.config.sessionCookieName, created.sessionId, {
        httpOnly: true,
        sameSite: 'lax',
        secure: this.config.nodeEnv === 'production',
        path: '/',
      });
      return { roomCode: created.roomCode, password: created.password, snapshot: created.snapshot };
    } catch (error) {
      this.throw(error);
    }
  }

  @Post('join')
  @HttpCode(200)
  @ApiOperation({ summary: 'Join a private poker room' })
  @ApiBody({ type: JoinRoomDto })
  @ApiOkResponse({ description: 'Starts a guest session for the invited member.' })
  join(@Body() body: JoinRoomDto, @Res({ passthrough: true }) response: ResponseLike) {
    try {
      const joined = this.rooms.join(body);
      response.cookie(this.config.sessionCookieName, joined.sessionId, {
        httpOnly: true,
        sameSite: 'lax',
        secure: this.config.nodeEnv === 'production',
        path: '/',
      });
      return { snapshot: joined.snapshot };
    } catch (error) {
      this.throw(error);
    }
  }

  @Get('current')
  @ApiOperation({ summary: 'Restore the current room session' })
  current(@Req() request: RequestLike) {
    try {
      const session = cookieValue(request.headers.cookie, this.config.sessionCookieName);
      if (!session) throw new RoomError('NO_SESSION', 'Chưa có phiên chơi.');
      return { snapshot: this.rooms.current(session) };
    } catch (error) {
      this.throw(error);
    }
  }

  private throw(error: unknown): never {
    if (error instanceof RoomError) {
      const body = { code: error.code, message: error.message };
      if (['ROOM_NOT_FOUND'].includes(error.code)) throw new NotFoundException(body);
      if (['NO_SESSION', 'INVALID_INVITATION'].includes(error.code))
        throw new UnauthorizedException(body);
      if (['FORBIDDEN'].includes(error.code)) throw new ForbiddenException(body);
      if (['ROOM_FULL', 'DUPLICATE_NAME', 'INVALID_STATE'].includes(error.code))
        throw new ConflictException(body);
      throw new BadRequestException(body);
    }
    throw error;
  }
}
