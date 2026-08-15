import { Test } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { MembersService } from './members.service';
import { PrismaService } from '../common/prisma/prisma.service';

describe('MembersService', () => {
  let service: MembersService;
  const prisma = {
    member: {
      create: jest.fn(),
      findMany: jest.fn(),
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    const moduleRef = await Test.createTestingModule({
      providers: [MembersService, { provide: PrismaService, useValue: prisma }],
    }).compile();
    service = moduleRef.get(MembersService);
  });

  it('creates a member', async () => {
    prisma.member.create.mockResolvedValue({ id: '1', name: 'Ali' });

    const result = await service.create({ name: 'Ali' });

    expect(prisma.member.create).toHaveBeenCalledWith({
      data: { name: 'Ali' },
    });
    expect(result).toEqual({ id: '1', name: 'Ali' });
  });

  it('returns all members', async () => {
    prisma.member.findMany.mockResolvedValue([{ id: '1' }]);

    const result = await service.findAll();

    expect(result).toEqual([{ id: '1' }]);
  });

  it('returns one member by id', async () => {
    prisma.member.findUnique.mockResolvedValue({ id: '1', name: 'Ali' });

    const result = await service.findOne('1');

    expect(result).toEqual({ id: '1', name: 'Ali' });
  });

  it('finds a member by name (for resolving recognition events)', async () => {
    prisma.member.findFirst.mockResolvedValue({ id: '1', name: 'Ali' });

    const result = await service.findByName('Ali');

    expect(prisma.member.findFirst).toHaveBeenCalledWith({
      where: { name: 'Ali' },
    });
    expect(result).toEqual({ id: '1', name: 'Ali' });
  });

  it('throws NotFoundException when member does not exist', async () => {
    prisma.member.findUnique.mockResolvedValue(null);

    await expect(service.findOne('missing')).rejects.toThrow(NotFoundException);
  });

  it('updates a member', async () => {
    prisma.member.findUnique.mockResolvedValue({ id: '1' });
    prisma.member.update.mockResolvedValue({ id: '1', name: 'Ali Updated' });

    const result = await service.update('1', { name: 'Ali Updated' });

    expect(result.name).toBe('Ali Updated');
  });

  it('throws NotFoundException when updating a missing member', async () => {
    prisma.member.findUnique.mockResolvedValue(null);

    await expect(service.update('missing', { name: 'X' })).rejects.toThrow(
      NotFoundException,
    );
    expect(prisma.member.update).not.toHaveBeenCalled();
  });

  it('disables a member', async () => {
    prisma.member.findUnique.mockResolvedValue({ id: '1' });
    prisma.member.update.mockResolvedValue({ id: '1', isActive: false });

    const result = await service.setActive('1', false);

    expect(prisma.member.update).toHaveBeenCalledWith({
      where: { id: '1' },
      data: { isActive: false },
    });
    expect(result.isActive).toBe(false);
  });

  it('deletes a member', async () => {
    prisma.member.findUnique.mockResolvedValue({ id: '1' });
    prisma.member.delete.mockResolvedValue({ id: '1' });

    await service.remove('1');

    expect(prisma.member.delete).toHaveBeenCalledWith({ where: { id: '1' } });
  });

  it('throws NotFoundException when deleting a missing member', async () => {
    prisma.member.findUnique.mockResolvedValue(null);

    await expect(service.remove('missing')).rejects.toThrow(NotFoundException);
    expect(prisma.member.delete).not.toHaveBeenCalled();
  });
});
