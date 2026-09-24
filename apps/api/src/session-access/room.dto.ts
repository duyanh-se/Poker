import { Type } from 'class-transformer';
import {
  IsIn,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateRoomDto {
  @ApiProperty({ enum: ['poker', 'liars-deck'], default: 'poker', required: false })
  @IsOptional()
  @IsIn(['poker', 'liars-deck'])
  gameType?: 'poker' | 'liars-deck';
  @ApiProperty({ type: String, example: 'Chủ phòng', minLength: 1, maxLength: 24 })
  @IsString()
  @IsNotEmpty()
  @MaxLength(24)
  displayName!: string;

  @ApiProperty({ type: Number, example: 5, minimum: 1 })
  @Type(() => Number)
  @IsOptional()
  @IsInt()
  @Min(1)
  smallBlind?: number;

  @ApiProperty({ type: Number, example: 10, minimum: 2 })
  @Type(() => Number)
  @IsOptional()
  @IsInt()
  @Min(2)
  bigBlind?: number;

  @ApiProperty({ type: Number, example: 0, minimum: 0 })
  @Type(() => Number)
  @IsOptional()
  @IsInt()
  @Min(0)
  ante?: number;

  @ApiProperty({ type: Number, example: 3, minimum: 1, maximum: 10, required: false })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(10)
  startingLives?: number;
}

export class JoinRoomDto {
  @ApiProperty({ type: String, example: 'Người chơi', minLength: 1, maxLength: 24 })
  @IsString()
  @IsNotEmpty()
  @MaxLength(24)
  displayName!: string;

  @ApiProperty({ type: String, example: 'ABCD2345', pattern: '^[A-Z2-9]{8}$' })
  @IsString()
  @IsNotEmpty()
  roomCode!: string;

  @ApiProperty({ type: String, example: 'Lời-mời-bí-mật' })
  @IsString()
  @IsNotEmpty()
  password!: string;
}
