import { Test } from '@nestjs/testing';
import { AnalysisCacheService } from './analysis-cache.service';
import { getRedisConnectionToken } from '@nestjs-modules/ioredis';

describe('AnalysisCacheService', () => {
  let svc: AnalysisCacheService;

  const mockRedis = {
    set: jest.fn().mockResolvedValue('OK'),
    get: jest.fn(),
    exists: jest.fn(),
  };

  beforeEach(async () => {
    const mod = await Test.createTestingModule({
      providers: [
        AnalysisCacheService,
        {
          provide: getRedisConnectionToken('default'),
          useValue: mockRedis,
        },
      ],
    }).compile();

    svc = mod.get(AnalysisCacheService);
    jest.clearAllMocks();
  });

  it('set() calls redis.set with the correct TTL', async () => {
    await svc.set('job-123', { projectName: 'test' } as never);

    expect(mockRedis.set).toHaveBeenCalledWith(
      'analysis:result:job-123',
      expect.any(String),
      'EX',
      3600,
    );
  });

  it('get() returns null when key does not exist', async () => {
    mockRedis.get.mockResolvedValue(null);
    expect(await svc.get('missing')).toBeNull();
  });

  it('get() parses JSON correctly', async () => {
    mockRedis.get.mockResolvedValue(JSON.stringify({ projectName: 'nestjs' }));
    const result = await svc.get('job-123');
    expect(result?.projectName).toBe('nestjs');
  });

  it('exists() returns true when key present', async () => {
    mockRedis.exists.mockResolvedValue(1);
    expect(await svc.exists('job-123')).toBe(true);
  });
});