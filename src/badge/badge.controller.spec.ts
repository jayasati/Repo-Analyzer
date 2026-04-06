import { Test } from '@nestjs/testing';
import { BadgeController } from './badge.controller';
import { getRepositoryToken } from '@nestjs/typeorm';
import { AnalysisResultEntity } from '../persistence/entities/analysis-result.entity';

describe('BadgeController', () => {
  let ctrl: BadgeController;
  const mockRepo = { findOne: jest.fn() };
  const mockRes = { setHeader: jest.fn(), send: jest.fn() };

  beforeEach(async () => {
    const mod = await Test.createTestingModule({
      controllers: [BadgeController],
      providers: [
        {
          provide: getRepositoryToken(AnalysisResultEntity),
          useValue: mockRepo,
        },
      ],
    }).compile();
    ctrl = mod.get(BadgeController);
    jest.clearAllMocks();
  });

  it('returns SVG with green color for score >= 80', async () => {
    mockRepo.findOne.mockResolvedValue({ overallScore: 85 });
    await ctrl.getBadge('owner', 'repo', mockRes as never);
    const svg = mockRes.send.mock.calls[0][0] as string;
    expect(svg).toContain('22c55e');
    expect(svg).toContain('85/100');
  });

  it('returns SVG with red color for score < 60', async () => {
    mockRepo.findOne.mockResolvedValue({ overallScore: 45 });
    await ctrl.getBadge('owner', 'repo', mockRes as never);
    const svg = mockRes.send.mock.calls[0][0] as string;
    expect(svg).toContain('ef4444');
  });

  it('returns "not analyzed" when no result exists', async () => {
    mockRepo.findOne.mockResolvedValue(null);
    await ctrl.getBadge('owner', 'repo', mockRes as never);
    const svg = mockRes.send.mock.calls[0][0] as string;
    expect(svg).toContain('not analyzed');
  });

  it('sets correct content-type header', async () => {
    mockRepo.findOne.mockResolvedValue({ overallScore: 75 });
    await ctrl.getBadge('owner', 'repo', mockRes as never);
    expect(mockRes.setHeader).toHaveBeenCalledWith(
      'Content-Type',
      'image/svg+xml',
    );
  });
});
