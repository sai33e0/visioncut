import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { HttpService } from "@nestjs/axios";
import { firstValueFrom } from "rxjs";

/**
 * HTTP client to call the Python workers. Each method targets a specific
 * worker service and returns a parsed JSON response. Timeouts are tuned
 * per worker: analysis can be slow (Whisper + Gemini), clip analysis is
 * fast, rendering is the longest.
 */
@Injectable()
export class WorkerClient {
  private readonly logger = new Logger(WorkerClient.name);
  private readonly token: string;
  private readonly headers: Record<string, string>;

  // Worker URLs. Defaults match docker-compose service names.
  private readonly referenceUrl: string;
  private readonly clipUrl: string;
  private readonly timelineUrl: string;
  private readonly renderUrl: string;
  private readonly styleUrl: string;
  private readonly feedbackUrl: string;

  constructor(private readonly http: HttpService, private readonly config: ConfigService) {
    this.token = this.config.get<string>("WORKER_TOKEN", "");
    this.headers = this.token ? { "X-Worker-Token": this.token } : {};

    this.referenceUrl = this.config.get<string>("WORKER_REFERENCE_URL", "http://worker-reference:8001");
    this.clipUrl = this.config.get<string>("WORKER_CLIP_URL", "http://worker-clip:8002");
    this.timelineUrl = this.config.get<string>("WORKER_TIMELINE_URL", "http://worker-timeline:8003");
    this.renderUrl = this.config.get<string>("WORKER_RENDER_URL", "http://worker-render:8004");
    this.styleUrl = this.config.get<string>("WORKER_STYLE_URL", "http://worker-style:8005");
    this.feedbackUrl = this.config.get<string>("WORKER_FEEDBACK_URL", "http://worker-feedback:8006");
  }

  // ----------------- reference analyzer -----------------

  async analyzeReference(projectId: string, referenceUrl: string) {
    return this._post(`${this.referenceUrl}/analyze`, { projectId, referenceUrl });
  }

  // ----------------- clip analyzer -----------------

  async analyzeClip(req: { clipId: string; projectId: string; url: string; precomputeEmbedding?: boolean }) {
    return this._post(`${this.clipUrl}/analyze`, req);
  }

  async analyzeClipsBatch(clips: Array<{ clipId: string; projectId: string; url: string; precomputeEmbedding?: boolean }>) {
    return this._post(`${this.clipUrl}/analyze-batch`, { clips });
  }

  async searchClips(queryEmbedding: number[], projectId: string, k = 5) {
    return this._post(`${this.clipUrl}/search`, { queryEmbedding, projectId, k });
  }

  // ----------------- timeline builder -----------------

  async buildTimelineFromProject(projectId: string, userId: string) {
    return this._post(`${this.timelineUrl}/build-from-project`, { projectId, userId });
  }

  async swapSegment(projectId: string, segmentPosition: number, newClipId: string, userId: string) {
    return this._post(`${this.timelineUrl}/swap`, { projectId, segmentPosition, newClipId, userId });
  }

  // ----------------- renderer -----------------

  async renderProject(projectId: string, audioUrl?: string) {
    return this._post(`${this.renderUrl}/render`, { projectId, audioUrl });
  }

  // ----------------- style engine -----------------

  async vectorizeBlueprint(blueprint: any) {
    return this._post(`${this.styleUrl}/styles/vectorize`, { blueprint });
  }

  async saveStyleFromProject(req: { userId: string; projectId: string; name: string; isPublic?: boolean }) {
    return this._post(`${this.styleUrl}/styles/save`, req);
  }

  async applyStyle(styleId: string, projectId: string) {
    return this._post(`${this.styleUrl}/styles/apply`, { styleId, projectId });
  }

  async matchStyles(userId: string, blueprint: any, topK = 5) {
    return this._post(`${this.styleUrl}/styles/match`, { userId, blueprint, topK });
  }

  // ----------------- feedback engine -----------------

  async recordFeedback(req: { userId: string; projectId: string; segmentPosition?: number; clipId?: string; rating: number }) {
    return this._post(`${this.feedbackUrl}/feedback`, req);
  }

  async getPreferences(userId: string) {
    return this._get(`${this.feedbackUrl}/preferences/${userId}`);
  }

  // ----------------- helpers -----------------

  private async _post(baseUrl: string, body: any): Promise<any> {
    try {
      const r$ = this.http.post(baseUrl, body, {
        headers: this.headers,
        timeout: 60_000 * 5,
      });
      const r = await firstValueFrom(r$);
      return r.data;
    } catch (e: any) {
      this.logger.error(`worker POST ${baseUrl} failed: ${e?.message ?? e}`);
      throw e;
    }
  }

  private async _get(baseUrl: string): Promise<any> {
    try {
      const r$ = this.http.get(baseUrl, { headers: this.headers, timeout: 30_000 });
      const r = await firstValueFrom(r$);
      return r.data;
    } catch (e: any) {
      this.logger.error(`worker GET ${baseUrl} failed: ${e?.message ?? e}`);
      throw e;
    }
  }
}
