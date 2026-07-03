import { Module } from "@nestjs/common";
import { BullModule } from "@nestjs/bull";

export const REFERENCE_QUEUE = "reference-analysis";
export const AUDIO_QUEUE = "audio-analysis";
export const CLIP_QUEUE = "clip-analysis";
export const TIMELINE_QUEUE = "timeline-build";
export const RENDER_QUEUE = "render";
export const STYLE_QUEUE = "style-build";
export const FEEDBACK_QUEUE = "feedback-process";

@Module({
  imports: [
    BullModule.registerQueue(
      { name: REFERENCE_QUEUE },
      { name: AUDIO_QUEUE },
      { name: CLIP_QUEUE },
      { name: TIMELINE_QUEUE },
      { name: RENDER_QUEUE },
      { name: STYLE_QUEUE },
      { name: FEEDBACK_QUEUE }
    ),
  ],
  exports: [BullModule],
})
export class QueueModule {}
