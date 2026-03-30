import { Test } from '@nestjs/testing';
import { HealthController } from './health.controller';

describe('HealthController', () => {
  let ctrl: HealthController;
  beforeEach(async () => {
    const mod = await Test.createTestingModule({
      controllers: [HealthController],
    }).compile();
    ctrl = mod.get(HealthController);
  });

  it('check() returns status ok', () => {
    const result = ctrl.check();
    expect(result.status).toBe('ok');
    expect(typeof result.uptime).toBe('number');
    expect(result.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });

  it('ready() returns status ready', () => {
    expect(ctrl.ready()).toEqual({ status: 'ready' });
  });
});