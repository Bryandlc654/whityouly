import { Injectable, ConflictException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateCharacterDto, UpdateCharacterDto } from './dto/character.dto';

@Injectable()
export class CharactersService {
  constructor(private prisma: PrismaService) {}

  async create(userId: string, data: CreateCharacterDto) {
    const existingUserCharacter = await this.prisma.character.findUnique({
      where: { userId },
    });
    
    if (existingUserCharacter) {
      throw new ConflictException('El usuario ya tiene un personaje creado.');
    }

    const nameTaken = await this.prisma.character.findUnique({
      where: { name: data.name },
    });

    if (nameTaken) {
      throw new ConflictException('El nombre de personaje ya está en uso.');
    }

    return this.prisma.character.create({
      data: {
        ...data,
        userId,
      },
    });
  }

  async findByUserId(userId: string) {
    const character = await this.prisma.character.findUnique({
      where: { userId },
    });

    if (!character) {
      throw new NotFoundException('Personaje no encontrado.');
    }

    return character;
  }

  async update(userId: string, data: UpdateCharacterDto) {
    const character = await this.findByUserId(userId);

    if (data.name && data.name !== character.name) {
      const nameTaken = await this.prisma.character.findUnique({
        where: { name: data.name },
      });
      if (nameTaken) {
        throw new ConflictException('El nombre de personaje ya está en uso.');
      }
    }

    return this.prisma.character.update({
      where: { id: character.id },
      data,
    });
  }
}
