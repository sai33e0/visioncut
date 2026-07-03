import { Test } from "@nestjs/testing";
import { INestApplication } from "@nestjs/common";
import * as request from "supertest";
import { HealthModule } from "../src/health/health.module";

describe("Health (e2e)", () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [HealthModule] }).compile();
    app = moduleRef.createNestApplication();
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it("/health returns ok or degraded", async () => {
    const res = await request(app.getHttpServer()).get("/health").expect(200);
    expect(res.body.status).toBeDefined();
  });
});
