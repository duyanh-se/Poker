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
  @ApiProperty({ enum: ['poker', 'liars-deck', 'white-hat'], default: 'poker', required: false })
  @IsOptional()
  @IsIn(['poker', 'liars-deck', 'white-hat'])
  gameType?: 'poker' | 'liars-deck' | 'white-hat';
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

  @ApiProperty({
    type: Number,
    default: 1,
    minimum: 1,
    maximum: 11,
    required: false,
    description: 'Mũ Trắng: number eliminated per round; revalidated against roster at start.',
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(11)
  eliminationsPerRound?: number;
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
