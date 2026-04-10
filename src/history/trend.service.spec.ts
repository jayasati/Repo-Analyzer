import { Test } from '@nestjs/testing';
import { TrendService } from './trend.service';
import { getRepositoryToken } from '@nestjs/typeorm';
import { AnalysisResultEntity } from '../persistence/entities/analysis-result.entity';

describe('TrendService', () => {
  let svc: TrendService;
  const mockRepo = { find: jest.fn() };

  beforeEach(async () => {
    const mod = await Test.createTestingModule({
      providers: [
        TrendService,
        {
          provide: getRepositoryToken(AnalysisResultEntity),
          useValue: mockRepo,
        },
      ],
    }).compile();
    svc = mod.get(TrendService);
    jest.clearAllMocks();
  });

  it('returns stable for empty history', async () => {
    mockRepo.find.mockResolvedValue([]);
    const result = await svc.getTrend('https://github.com/owner/repo');
    expect(result.trend).toBe('stable');
    expect(result.points).toHaveLength(0);
  });

  it('detects improving trend', async () => {
    // Mock returns DESC order (newest first), service reverses to chronological
    mockRepo.find.mockResolvedValue([
      {
        id: '3',
        analyzedAt: new Date(),
        overallScore: 72,
        modularityScore: 72,
        couplingScore: 72,
        smellsScore: 72,
        cycleCount: 0,
        smellCount: 0,
      },
      {
        id: '2',
        analyzedAt: new Date(),
        overallScore: 65,
        modularityScore: 65,
        couplingScore: 65,
        smellsScore: 65,
        cycleCount: 0,
        smellCount: 0,
      },
      {
        id: '1',
        analyzedAt: new Date(),
        overallScore: 60,
        modularityScore: 60,
        couplingScore: 60,
        smellsScore: 60,
        cycleCount: 0,
        smellCount: 0,
      },
    ]);
    const result = await svc.getTrend('url');
    expect(result.trend).toBe('improving');
    expect(result.bestScore).toBe(72);
    expect(result.worstScore).toBe(60);
  });

  it('detects degrading trend', async () => {
    // Mock returns DESC order (newest first), service reverses to chronological
    mockRepo.find.mockResolvedValue([
      {
        id: '3',
        analyzedAt: new Date(),
        overallScore: 65,
        modularityScore: 65,
        couplingScore: 65,
        smellsScore: 65,
        cycleCount: 0,
        smellCount: 0,
      },
      {
        id: '2',
        analyzedAt: new Date(),
        overallScore: 72,
        modularityScore: 72,
        couplingScore: 72,
        smellsScore: 72,
        cycleCount: 0,
        smellCount: 0,
      },
      {
        id: '1',
        analyzedAt: new Date(),
        overallScore: 80,
        modularityScore: 80,
        couplingScore: 80,
        smellsScore: 80,
        cycleCount: 0,
        smellCount: 0,
      },
    ]);
    const result = await svc.getTrend('url');
    expect(result.trend).toBe('degrading');
  });
});
