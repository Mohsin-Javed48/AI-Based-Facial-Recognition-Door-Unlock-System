import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../common/prisma/prisma.service';
import { CreateMemberDto } from './dto/create-member.dto';
import { UpdateMemberDto } from './dto/update-member.dto';

@Injectable()
export class MembersService {
  constructor(private readonly prisma: PrismaService) {}

  create(dto: CreateMemberDto) {
    return this.prisma.member.create({ data: dto });
  }

  findAll() {
    return this.prisma.member.findMany({ orderBy: { createdAt: 'desc' } });
  }

  async findOne(id: string) {
    const member = await this.prisma.member.findUnique({ where: { id } });
    if (!member) {
      throw new NotFoundException(`Member ${id} not found`);
    }
    return member;
  }

  /**
   * Resolves the name the Python recognition service reports (its
   * enrollment folder name, see recognition/app/enrollment.py) to a
   * Postgres member. Used by AccessEventsService - Phase 0 has no concept
   * of Postgres member IDs, only names.
   */
  findByName(name: string) {
    return this.prisma.member.findFirst({ where: { name } });
  }

  async update(id: string, dto: UpdateMemberDto) {
    await this.findOne(id);
    return this.prisma.member.update({ where: { id }, data: dto });
  }

  async setActive(id: string, isActive: boolean) {
    await this.findOne(id);
    return this.prisma.member.update({ where: { id }, data: { isActive } });
  }

  async remove(id: string) {
    await this.findOne(id);
    await this.prisma.member.delete({ where: { id } });
  }
}
