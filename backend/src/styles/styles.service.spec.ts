import { Test, TestingModule } from "@nestjs/testing";
import { PrismaService } from "../prisma/prisma.service";
import { AnalysisGateway } from "../websocket/analysis.gateway";
import { WorkerClient } from "../common/clients/worker.client";
import { StylesService } from "./styles.service";

// Mock PrismaService
const mockPrismaService = {
  style: {
    findMany: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
    findFirst: jest.fn(),
  },
  project: {
    findFirst: jest.fn(),
    update: jest.fn(),
  },
  analyticsEvent: {
    create: jest.fn(),
  },
};

// Mock AnalysisGateway
const mockAnalysisGateway = {
  emitLog: jest.fn(),
  emitProgress: jest.fn(),
};

// Mock WorkerClient
const mockWorkerClient = {
  vectorizeBlueprint: jest.fn(),
  matchStyles: jest.fn(),
  buildTimelineFromProject: jest.fn(),
};

describe("StylesService", () => {
  let service: StylesService;
  let prisma: PrismaService;
  let gateway: AnalysisGateway;
  let workers: WorkerClient;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        StylesService,
        { provide: PrismaService, useValue: mockPrismaService },
        { provide: AnalysisGateway, useValue: mockAnalysisGateway },
        { provide: WorkerClient, useValue: mockWorkerClient },
      ],
    }).compile();

    service = module.get<StylesService>(StylesService);
    prisma = module.get<PrismaService>(PrismaService);
    gateway = module.get<AnalysisGateway>(AnalysisGateway);
    workers = module.get<WorkerClient>(WorkerClient);
  });

  it("should be defined", () => {
    expect(service).toBeDefined();
  });

  describe("listForUser", () => {
    it("should return styles for a user", async () => {
      const mockStyles = [{ id: "1", userId: "user1", name: "Test Style" }];
      prisma.style.findMany.mockResolvedValue(mockStyles);

      const result = await service.listForUser("user1");
      expect(result).toEqual(mockStyles);
      expect(prisma.style.findMany).toHaveBeenCalledWith({
        where: { userId: "user1" },
        orderBy: { createdAt: "desc" },
      });
    });
  });

  describe("publicList", () => {
    it("should return public styles", async () => {
      const mockStyles = [{ id: "1", userId: "user1", name: "Public Style", isPublic: true }];
      prisma.style.findMany.mockResolvedValue(mockStyles);

      const result = await service.publicList();
      expect(result).toEqual(mockStyles);
      expect(prisma.style.findMany).toHaveBeenCalledWith({
        where: { isPublic: true },
        orderBy: { usageCount: "desc" },
        take: 50,
      });
    });

    it("should filter by content type when provided", async () => {
      const mockStyles = [{ id: "1", userId: "user1", name: "Video Style", contentType: "video", isPublic: true }];
      prisma.style.findMany.mockResolvedValue(mockStyles);

      const result = await service.publicList("video");
      expect(result).toEqual(mockStyles);
      expect(prisma.style.findMany).toHaveBeenCalledWith({
        where: { isPublic: true, contentType: "video" },
        orderBy: { usageCount: "desc" },
        take: 50,
      });
    });
  });

  describe("get", () => {
    it("should return a style if user owns it or it's public", async () => {
      const mockStyle = { id: "1", userId: "user1", name: "Private Style", isPublic: false };
      prisma.style.findFirst.mockResolvedValue(mockStyle);

      const result = await service.get("user1", "1");
      expect(result).toEqual(mockStyle);
      expect(prisma.style.findFirst).toHaveBeenCalledWith({
        where: { id: "1", OR: [{ userId: "user1" }, { isPublic: true }] },
      });
    });

    it("should return null if style not found or not accessible", async () => {
      prisma.style.findFirst.mockResolvedValue(null);

      const result = await service.get("user1", "nonexistent");
      expect(result).toBeNull();
    });
  });

  describe("create", () => {
    const mockDto = {
      name: "Test Style",
      description: "A test style",
      projectId: "project1",
    };

    it("should throw BadRequestException if no blueprintTemplate and no projectId", async () => {
      const dtoWithoutProject = { ...mockDto } as Record<string, unknown>;
      delete dtoWithoutProject.projectId;

      await expect(service.create("user1", dtoWithoutProject)).rejects.toThrow(
        "Provide blueprintTemplate or a projectId",
      );
    });

    it("should throw BadRequestException if project has no blueprint", async () => {
      prisma.project.findFirst.mockResolvedValue(null);

      await expect(service.create("user1", mockDto)).rejects.toThrow(
        "Project has no blueprint yet or is not yours",
      );
    });

    it("should create a style when blueprintTemplate is provided", async () => {
      const mockProject = { id: "project1", userId: "user1", blueprint: { content_type: "video" } };
      prisma.project.findFirst.mockResolvedValue(mockProject);

      const mockCreatedStyle = {
        id: "style1",
        userId: "user1",
        name: "Test Style",
        description: "A test style",
        contentType: "video",
        pace: null,
        transitions: [],
        audioComponents: [],
        blueprintTemplate: { content_type: "video" },
        isPublic: false,
        usageCount: 0,
      };
      prisma.style.create.mockResolvedValue(mockCreatedStyle);
      prisma.analyticsEvent.create.mockResolvedValue({});

      const result = await service.create("user1", mockDto);

      expect(result).toEqual(mockCreatedStyle);
      expect(prisma.style.create).toHaveBeenCalledWith({
        data: {
          userId: "user1",
          name: "Test Style",
          description: "A test style",
          contentType: null, // dto.contentType is undefined, so null
          pace: null,
          transitions: [],
          audioComponents: [],
          blueprintTemplate: { content_type: "video" },
          isPublic: false,
          usageCount: 0,
        },
      });
      expect(prisma.analyticsEvent.create).toHaveBeenCalledWith({
        data: {
          userId: "user1",
          projectId: "project1",
          eventType: "style_saved",
          payload: { styleId: "style1" },
        },
      });
    });
  });

  describe("remove", () => {
    it("should remove a style if user owns it", async () => {
      const mockStyle = { id: "1", userId: "user1", name: "Test Style" };
      prisma.style.findFirst.mockResolvedValue(mockStyle);
      prisma.style.delete.mockResolvedValue(mockStyle);

      await service.remove("user1", "1");
      expect(prisma.style.findFirst).toHaveBeenCalledWith({
        where: { id: "1", userId: "user1" },
      });
      expect(prisma.style.delete).toHaveBeenCalledWith({
        where: { id: "1" },
      });
    });

    it("should throw NotFoundException if style not found", async () => {
      prisma.style.findFirst.mockResolvedValue(null);

      await expect(service.remove("user1", "nonexistent")).rejects.toThrow(
        "Style not found",
      );
    });
  });

  describe("matchingForProject", () => {
    it("should return user/public styles when no blueprint", async () => {
      const mockProject = { id: "project1", userId: "user1", blueprint: null };
      const mockStyles = [{ id: "1", userId: "user1", name: "Style 1" }];
      prisma.project.findFirst.mockResolvedValue(mockProject);
      prisma.style.findMany.mockResolvedValue(mockStyles);

      const result = await service.matchingForProject("user1", "project1");
      expect(result).toEqual(mockStyles);
      expect(prisma.style.findMany).toHaveBeenCalledWith({
        where: { OR: [{ userId: "user1" }, { isPublic: true }] },
        orderBy: { usageCount: "desc" },
        take: 20,
      });
    });

    it("should call worker service and hydrate results when blueprint exists", async () => {
      const mockProject = { id: "project1", userId: "user1", blueprint: { content_type: "video" } };
      const mockWorkerResponse = { hits: [{ style_id: "style1", similarity: 0.95} ] };
      const mockStyles = [{ id: "style1", userId: "user1", name: "Matching Style" }];
      const mockEnhancedStyle = { ...mockStyles[0], similarity: 0.95 };

      prisma.project.findFirst.mockResolvedValue(mockProject);
      workers.matchStyles.mockResolvedValue(mockWorkerResponse);
      prisma.style.findMany.mockResolvedValue(mockStyles);

      const result = await service.matchingForProject("user1", "project1");
      expect(result).toEqual([mockEnhancedStyle]);
      expect(workers.matchStyles).toHaveBeenCalledWith("user1", { content_type: "video" }, 10);
      expect(prisma.style.findMany).toHaveBeenCalledWith({ where: { id: { in: ["style1"] } } });
    });

    it("should fall back to DB when worker service fails", async () => {
      const mockProject = { id: "project1", userId: "user1", blueprint: { content_type: "video" } };
      const mockStyles = [{ id: "style1", userId: "user1", name: "Fallback Style" }];
      prisma.project.findFirst.mockResolvedValue(mockProject);
      workers.matchStyles.mockRejectedValue(new Error("Worker service down"));
      prisma.style.findMany.mockResolvedValue(mockStyles);

      const result = await service.matchingForProject("user1", "project1");
      expect(result).toEqual(mockStyles);
      expect(workers.matchStyles).toHaveBeenCalledWith("user1", { content_type: "video" }, 10);
      expect(prisma.style.findMany).toHaveBeenCalledWith({
        where: { OR: [{ userId: "user1" }, { isPublic: true }] },
        orderBy: { usageCount: "desc" },
        take: 20,
      });
    });
  });

  describe("apply", () => {
    it("should apply a style to a project", async () => {
      const mockStyle = {
        id: "style1",
        userId: "user1",
        name: "Test Style",
        blueprintTemplate: { content_type: "video" },
        isPublic: true
      };
      const mockProject = { id: "project1", userId: "user1" };

      prisma.style.findFirst.mockResolvedValue(mockStyle);
      prisma.project.findFirst.mockResolvedValue(mockProject);
      prisma.project.update.mockResolvedValue({});
      prisma.style.update.mockResolvedValue({});
      prisma.analyticsEvent.create.mockResolvedValue({});

      workers.buildTimelineFromProject.mockResolvedValue({});

      const result = await service.apply("user1", "style1", "project1");

      expect(result).toEqual({ ok: true, styleId: "style1", projectId: "project1" });
      expect(prisma.style.findFirst).toHaveBeenCalledWith({
        where: { id: "style1", OR: [{ userId: "user1" }, { isPublic: true }] },
      });
      expect(prisma.project.findFirst).toHaveBeenCalledWith({
        where: { id: "project1", userId: "user1" },
      });
      expect(prisma.project.update).toHaveBeenCalledWith({
        where: { id: "project1" },
        data: {
          blueprint: { content_type: "video" },
          status: "analyzing",
          progress: 50,
          currentStep: "Style applied — building timeline",
        },
      });
      expect(prisma.style.update).toHaveBeenCalledWith({
        where: { id: "style1" },
        data: { usageCount: { increment: 1 } },
      });
      expect(prisma.analyticsEvent.create).toHaveBeenCalledWith({
        data: {
          userId: "user1",
          projectId: "project1",
          eventType: "style_applied",
          payload: { styleId: "style1" },
        },
      });
      expect(gateway.emitLog).toHaveBeenCalledWith("project1", "Style applied: Test Style");
      expect(workers.buildTimelineFromProject).toHaveBeenCalledWith("project1", "user1");
      expect(gateway.emitProgress).toHaveBeenCalledWith("project1", "Style applied", 75);
    });

    it("should throw NotFoundException if style not found", async () => {
      prisma.style.findFirst.mockResolvedValue(null);

      await expect(service.apply("user1", "nonexistent", "project1")).rejects.toThrow(
        "Style not found",
      );
    });

    it("should throw NotFoundException if project not found", async () => {
      const mockStyle = { id: "style1", userId: "user1", name: "Test Style", blueprintTemplate: { content_type: "video" }, isPublic: true };
      prisma.style.findFirst.mockResolvedValue(mockStyle);
      prisma.project.findFirst.mockResolvedValue(null);

      await expect(service.apply("user1", "style1", "nonexistent")).rejects.toThrow(
        "Project not found",
      );
    });

    it("should handle errors in timeline build gracefully", async () => {
      const mockStyle = { id: "style1", userId: "user1", name: "Test Style", blueprintTemplate: { content_type: "video" }, isPublic: true };
      const mockProject = { id: "project1", userId: "user1" };

      prisma.style.findFirst.mockResolvedValue(mockStyle);
      prisma.project.findFirst.mockResolvedValue(mockProject);
      prisma.project.update.mockResolvedValue({});
      prisma.style.update.mockResolvedValue({});
      prisma.analyticsEvent.create.mockResolvedValue({});

      workers.buildTimelineFromProject.mockRejectedValue(new Error("Build failed"));

      const result = await service.apply("user1", "style1", "project1");

      expect(result).toEqual({ ok: true, styleId: "style1", projectId: "project1" });
      expect(gateway.emitLog).toHaveBeenCalledWith(
        "project1",
        expect.stringContaining("Style build failed"),
        "error"
      );
      // Should still emit progress despite error
      expect(gateway.emitProgress).toHaveBeenCalledWith("project1", "Style applied", 75);
    });
  });
});