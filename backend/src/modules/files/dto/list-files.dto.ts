import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, IsOptional, IsString, IsUUID, MaxLength, Min } from 'class-validator';

export class ListFilesQueryDto {
  @ApiPropertyOptional({ description: 'Id del último archivo recibido; devuelve los siguientes.' })
  @IsOptional()
  @IsString()
  @MaxLength(64)
  cursor?: string;

  @ApiPropertyOptional({ default: 20, description: 'Entre 1 y 50. El servicio ajusta el tope.' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  limit?: number;
}

export class ListAllFilesQueryDto extends ListFilesQueryDto {
  @ApiPropertyOptional({ description: 'Filtra por propietario.' })
  @IsOptional()
  @IsUUID()
  userId?: string;
}
