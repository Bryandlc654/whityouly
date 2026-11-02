import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsOptional } from 'class-validator';
import {
  TREE_DECORATIONS,
  TREE_POTS,
  TREE_SPECIES,
  type TreeDecoration,
  type TreePot,
  type TreeSpecies,
} from '../tree.constants';

export class UpdateTreeCustomizationDto {
  @ApiPropertyOptional({ enum: TREE_SPECIES })
  @IsOptional()
  @IsIn([...TREE_SPECIES])
  species?: TreeSpecies;

  @ApiPropertyOptional({ enum: TREE_POTS })
  @IsOptional()
  @IsIn([...TREE_POTS])
  pot?: TreePot;

  @ApiPropertyOptional({ enum: TREE_DECORATIONS })
  @IsOptional()
  @IsIn([...TREE_DECORATIONS])
  decoration?: TreeDecoration;
}
