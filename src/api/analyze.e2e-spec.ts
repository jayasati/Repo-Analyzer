import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../app.module';

describe('POST /analyze (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('rejects a non-GitHub URL with 400', async () => {
    await request(app.getHttpServer())
      .post('/analyze')
      .send({ source: 'http://evil.com/repo' })
      .expect(400);
  });

  it('rejects an empty body with 400', async () => {
    await request(app.getHttpServer())
      .post('/analyze')
      .send({})
      .expect(400);
  });

  it('accepts a valid GitHub URL and returns a jobId', async () => {
    const res = await request(app.getHttpServer())
      .post('/analyze')
      .send({ source: 'https://github.com/nestjs/nest' })
      .expect(202);

    expect(res.body.jobId).toMatch(
      /^[0-9a-f-]{36}$/,
    );
  });
});