import { Test } from '@nestjs/testing';
import { DiffService } from './diff.service';
import { HistoryService } from './history.service';
import { NotFoundException } from '@nestjs/common';

const makeEntity = (id: string, score: number, smells: string[]) => ({
  id,
  analyzedAt: new Date('2024-01-01'),
  overallScore: score,
  modularityScore: score,
  couplingScore: score,
  smellsScore: score,
  cycleCount: 0,
  smellCount: smells.length,
  moduleCount: 10,
  fullResult: JSON.stringify({ smells: smells.map((type) => ({ type })) }),
});

describe('DiffService', () => {
  let svc: DiffService;
  const mockHistory = { getById: jest.fn() };

  beforeEach(async () => {
    const mod = await Test.createTestingModule({
      providers: [
        DiffService,
        { provide: HistoryService, useValue: mockHistory },
      ],
    }).compile();
    svc = mod.get(DiffService);
    jest.clearAllMocks();
  });

  it('throws NotFoundException when fromId not found', async () => {
    mockHistory.getById.mockResolvedValueOnce(null);
    await expect(svc.compare('bad-id', 'other')).rejects.toThrow(
      NotFoundException,
    );
  });

  it('computes positive delta when score improved', async () => {
    mockHistory.getById
      .mockResolvedValueOnce(makeEntity('a', 60, ['god-module']))
      .mockResolvedValueOnce(makeEntity('b', 75, []));

    const diff = await svc.compare('a', 'b');
    expect(diff.delta.overallScore).toBe(15);
    expect(diff.regression).toBe(false);
    expect(diff.fixedSmells).toContain('god-module');
    expect(diff.newSmells).toHaveLength(0);
  });

  it('detects regression and new smells', async () => {
    mockHistory.getById
      .mockResolvedValueOnce(makeEntity('a', 80, []))
      .mockResolvedValueOnce(
        makeEntity('b', 65, ['circular-dependency', 'god-module']),
      );

    const diff = await svc.compare('a', 'b');
    expect(diff.regression).toBe(true);
    expect(diff.delta.overallScore).toBe(-15);
    expect(diff.newSmells).toContain('circular-dependency');
    expect(diff.newSmells).toContain('god-module');
  });
});
