import { ExecutionContext, UnauthorizedException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { createMock } from "@golevelup/ts-jest";
import { WorkerTokenGuard } from "./worker-token.guard";

describe("WorkerTokenGuard", () => {
  let guard: WorkerTokenGuard;
  let configService: jest.Mocked<ConfigService>;

  beforeEach(() => {
    configService = {
      get: jest.fn(),
    };

    guard = new WorkerTokenGuard(configService);
  });

  it("should be defined", () => {
    expect(guard).toBeDefined();
  });

  describe("canActivate", () => {
    it("should return true when WORKER_TOKEN is not set (dev mode)", () => {
      configService.get.mockReturnValueOnce(undefined);

      const context = createMock<ExecutionContext>();
      const req = { headers: {} };
      const httpArgsHost = {
        getRequest: jest.fn().mockReturnValue(req),
        getResponse: jest.fn(),
        getNext: jest.fn()
      };
      context.switchToHttp.mockReturnValue(httpArgsHost);

      const result = guard.canActivate(context);
      expect(result).toBe(true);
      expect(configService.get).toHaveBeenCalledWith("WORKER_TOKEN");
    });

    it("should return true when WORKER_TOKEN is set and matches header", () => {
      configService.get.mockReturnValueOnce("expected-token");

      const context = createMock<ExecutionContext>();
      const req = { headers: { "x-worker-token": "expected-token" } };
      const httpArgsHost = {
        getRequest: jest.fn().mockReturnValue(req),
        getResponse: jest.fn(),
        getNext: jest.fn()
      };
      context.switchToHttp.mockReturnValue(httpArgsHost);

      const result = guard.canActivate(context);
      expect(result).toBe(true);
      expect(configService.get).toHaveBeenCalledWith("WORKER_TOKEN");
    });

    it("should throw UnauthorizedException when WORKER_TOKEN is set but doesn't match header", () => {
      configService.get.mockReturnValueOnce("expected-token");

      const context = createMock<ExecutionContext>();
      const req = { headers: { "x-worker-token": "wrong-token" } };
      const httpArgsHost = {
        getRequest: jest.fn().mockReturnValue(req),
        getResponse: jest.fn(),
        getNext: jest.fn()
      };
      context.switchToHttp.mockReturnValue(httpArgsHost);

      expect(() => guard.canActivate(context)).toThrow(UnauthorizedException);
      expect(configService.get).toHaveBeenCalledWith("WORKER_TOKEN");
    });

    it("should throw UnauthorizedException when WORKER_TOKEN is set but header is missing", () => {
      configService.get.mockReturnValueOnce("expected-token");

      const context = createMock<ExecutionContext>();
      const req = { headers: {} }; // No x-worker-token header
      const httpArgsHost = {
        getRequest: jest.fn().mockReturnValue(req),
        getResponse: jest.fn(),
        getNext: jest.fn()
      };
      context.switchToHttp.mockReturnValue(httpArgsHost);

      expect(() => guard.canActivate(context)).toThrow(UnauthorizedException);
      expect(configService.get).toHaveBeenCalledWith("WORKER_TOKEN");
    });

    it("should treat empty string header as mismatch", () => {
      configService.get.mockReturnValueOnce("expected-token");

      const context = createMock<ExecutionContext>();
      const req = { headers: { "x-worker-token": "" } };
      const httpArgsHost = {
        getRequest: jest.fn().mockReturnValue(req),
        getResponse: jest.fn(),
        getNext: jest.fn()
      };
      context.switchToHttp.mockReturnValue(httpArgsHost);

      expect(() => guard.canActivate(context)).toThrow(UnauthorizedException);
    });
  });
});