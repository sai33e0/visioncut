import axios, { AxiosError, AxiosInstance, InternalAxiosRequestConfig } from "axios";
import type {
  Clip,
  ContentMix,
  FeedbackAccuracy,
  FeedbackPreferences,
  Project,
  ProjectHistoryEntry,
  PublicUser,
  QualityOverTimeEntry,
  QualityReport,
  Style,
  Timeline,
  TransitionStat,
  AnalyticsSummary,
  SegmentAlternative,
} from "./types";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";

class ApiClient {
  private http: AxiosInstance;

  constructor() {
    this.http = axios.create({
      baseURL: API_URL,
      timeout: 60_000,
    });
    this.http.interceptors.request.use((cfg: InternalAxiosRequestConfig) => {
      const token = typeof window !== "undefined" ? localStorage.getItem("vc_token") : null;
      if (token) {
        cfg.headers.set("Authorization", `Bearer ${token}`);
      }
      return cfg;
    });
    this.http.interceptors.response.use(
      (r) => r,
      (err: AxiosError) => {
        if (err.response?.status === 401 && typeof window !== "undefined") {
          const path = window.location.pathname;
          if (!path.startsWith("/login") && !path.startsWith("/register")) {
            localStorage.removeItem("vc_token");
            window.location.href = "/login";
          }
        }
        return Promise.reject(err);
      }
    );
  }

  // ----------------- Auth -----------------
  async register(email: string, password: string, displayName?: string) {
    const { data } = await this.http.post<{ accessToken: string; user: PublicUser }>(
      "/api/auth/register",
      { email, password, displayName }
    );
    return data;
  }
  async login(email: string, password: string) {
    const { data } = await this.http.post<{ accessToken: string; user: PublicUser }>(
      "/api/auth/login",
      { email, password }
    );
    return data;
  }
  async me() {
    const { data } = await this.http.get<PublicUser>("/api/auth/me");
    return data;
  }

  // ----------------- Projects -----------------
  async listProjects() {
    const { data } = await this.http.get<Project[]>("/api/projects");
    return data;
  }
  async createProject(body: { name: string; description?: string; referenceUrl?: string }) {
    const { data } = await this.http.post<Project>("/api/projects", body);
    return data;
  }
  async getProject(id: string) {
    const { data } = await this.http.get<Project>(`/api/projects/${id}`);
    return data;
  }
  async deleteProject(id: string) {
    await this.http.delete(`/api/projects/${id}`);
  }

  // ----------------- Uploads -----------------
  async uploadFile(args: {
    projectId: string;
    kind: "reference" | "clip" | "music" | "sfx" | "voiceover";
    file: File;
    onProgress?: (pct: number) => void;
  }) {
    const form = new FormData();
    form.append("file", args.file);
    form.append("projectId", args.projectId);
    form.append("kind", args.kind);
    const { data } = await this.http.post<{ clip: Clip; url: string }>(
      "/api/uploads",
      form,
      {
        headers: { "Content-Type": "multipart/form-data" },
        onUploadProgress: (e) => {
          if (args.onProgress && e.total) {
            args.onProgress(Math.round((e.loaded / e.total) * 100));
          }
        },
      }
    );
    return data;
  }
  async presignUpload(args: {
    kind: "reference" | "clip" | "music" | "sfx" | "voiceover";
    projectId: string;
    filename: string;
    contentType: string;
  }) {
    const { data } = await this.http.post<{
      key: string;
      uploadUrl: string;
      publicUrl: string;
      expiresIn: number;
    }>("/api/uploads/presign", args);
    return data;
  }

  // ----------------- Analysis -----------------
  async startAnalysis(projectId: string) {
    const { data } = await this.http.post(`/api/analysis/${projectId}/start`);
    return data;
  }
  async getAnalysisStatus(projectId: string) {
    const { data } = await this.http.get<{
      status: string;
      progress: number;
      currentStep: string | null;
      error: string | null;
    }>(`/api/analysis/${projectId}/status`);
    return data;
  }
  async getBlueprint(projectId: string) {
    const { data } = await this.http.get(`/api/analysis/${projectId}/blueprint`);
    return data;
  }

  // ----------------- Timeline -----------------
  async getTimeline(projectId: string) {
    const { data } = await this.http.get<Timeline>(`/api/timeline/${projectId}`);
    return data;
  }
  async explainSegment(projectId: string, segmentId: string) {
    const { data } = await this.http.get(
      `/api/timeline/${projectId}/segment/${segmentId}/explain`
    );
    return data;
  }
  async getAlternatives(projectId: string, segmentId: string) {
    const { data } = await this.http.get<SegmentAlternative[]>(
      `/api/timeline/${projectId}/segment/${segmentId}/alternatives`
    );
    return data;
  }
  async swapSegment(projectId: string, segmentId: string, newClipId: string) {
    const { data } = await this.http.put(
      `/api/timeline/${projectId}/segment/${segmentId}/swap`,
      { newClipId }
    );
    return data;
  }
  async buildTimeline(projectId: string) {
    const { data } = await this.http.post(`/api/timeline/${projectId}/build`);
    return data;
  }

  // ----------------- Render -----------------
  async startRender(projectId: string) {
    const { data } = await this.http.post(`/api/render/${projectId}/start`);
    return data;
  }
  async getRenderStatus(projectId: string) {
    const { data } = await this.http.get(`/api/render/${projectId}/status`);
    return data;
  }
  renderDownloadUrl(projectId: string) {
    return `${API_URL}/api/render/${projectId}/download`;
  }

  // ----------------- Quality -----------------
  async getQuality(projectId: string) {
    const { data } = await this.http.get<QualityReport>(`/api/quality/${projectId}/score`);
    return data;
  }

  // ----------------- Styles -----------------
  async listStyles() {
    const { data } = await this.http.get<Style[]>("/api/styles");
    return data;
  }
  async listPublicStyles(contentType?: string) {
    const { data } = await this.http.get<Style[]>("/api/styles/public", {
      params: contentType ? { contentType } : undefined,
    });
    return data;
  }
  async getStyle(id: string) {
    const { data } = await this.http.get<Style>(`/api/styles/${id}`);
    return data;
  }
  async matchingStyles(projectId: string) {
    const { data } = await this.http.get<Style[]>(`/api/styles/matching/${projectId}`);
    return data;
  }
  async saveStyle(body: {
    name: string;
    description?: string;
    projectId?: string;
    blueprintTemplate?: unknown;
    isPublic?: boolean;
  }) {
    const { data } = await this.http.post<Style>("/api/styles", body);
    return data;
  }
  async applyStyle(styleId: string, projectId: string) {
    const { data } = await this.http.post(`/api/styles/${styleId}/apply`, { projectId });
    return data;
  }
  async deleteStyle(id: string) {
    await this.http.delete(`/api/styles/${id}`);
  }

  // ----------------- Feedback -----------------
  async submitFeedback(body: {
    projectId: string;
    segmentId?: string;
    clipId?: string;
    rating: "up" | "down";
    comment?: string;
  }) {
    const { data } = await this.http.post("/api/feedback", body);
    return data;
  }
  async getFeedbackPreferences() {
    const { data } = await this.http.get<FeedbackPreferences>("/api/feedback/preferences");
    return data;
  }

  // ----------------- Analytics -----------------
  async getAnalyticsSummary() {
    const { data } = await this.http.get<AnalyticsSummary>("/api/analytics/summary");
    return data;
  }
  async getTransitionStats() {
    const { data } = await this.http.get<TransitionStat[]>("/api/analytics/transitions");
    return data;
  }
  async getProjectHistory(limit = 50) {
    const { data } = await this.http.get<ProjectHistoryEntry[]>("/api/analytics/projects", {
      params: { limit },
    });
    return data;
  }
  async getFeedbackAccuracy() {
    const { data } = await this.http.get<FeedbackAccuracy>("/api/analytics/feedback-accuracy");
    return data;
  }
  async getQualityOverTime() {
    const { data } = await this.http.get<QualityOverTimeEntry[]>("/api/analytics/quality-over-time");
    return data;
  }
  async getContentMix() {
    const { data } = await this.http.get<ContentMix>("/api/analytics/content-mix");
    return data;
  }

  // ----------------- Health -----------------
  async health() {
    const { data } = await this.http.get<{ status: string; services: Record<string, boolean> }>(
      "/api/health"
    );
    return data;
  }
}

export const api = new ApiClient();
export { API_URL };
