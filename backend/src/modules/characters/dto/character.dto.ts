import { IsString, IsOptional, MinLength } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateCharacterDto {
  @ApiProperty({ example: 'ElViajeroSolitario' })
  @IsString()
  @MinLength(3)
  name: string;

  @ApiPropertyOptional({ example: 'Amante de la escritura y los viajes.' })
  @IsOptional()
  @IsString()
  bio?: string;
}

export class UpdateCharacterDto {
  @ApiPropertyOptional({ example: 'ElViajero' })
  @IsOptional()
  @IsString()
  @MinLength(3)
  name?: string;

  @ApiPropertyOptional({ example: 'https://s3.../avatar.png' })
  @IsOptional()
  @IsString()
  avatarUrl?: string;

  @ApiPropertyOptional({ example: 'Actualizando mi bio...' })
  @IsOptional()
  @IsString()
  bio?: string;
}
