/**
 * Prisma seed — creates a demo user with 1 free project and a default style.
 * Run via: `npx prisma db seed`
 *
 * Idempotent: re-running upserts everything.
 */
import { PrismaClient, Plan, ClipType, ProjectStatus } from "@prisma/client";
import { hash } from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  const email = "demo@visioncut.ai";
  const passwordHash = await hash("demo1234", 10);

  const user = await prisma.user.upsert({
    where: { email },
    update: { passwordHash, displayName: "Demo User" },
    create: {
      email,
      passwordHash,
      displayName: "Demo User",
      plan: Plan.free,
      credits: 2,
    },
  });

  const defaultWeights = {
    faiss_similarity: 0.3,
    motion_match: 0.25,
    duration_match: 0.15,
    scene_type_match: 0.15,
    camera_match: 0.1,
    quality_score: 0.05,
  };

  await prisma.userPreference.upsert({
    where: { userId: user.id },
    update: { featureWeights: defaultWeights },
    create: {
      userId: user.id,
      preferredTransitions: ["zoom", "flash", "blur"],
      preferredPace: "fast",
      preferredContentTypes: ["travel_reel", "vlog"],
      featureWeights: defaultWeights,
      totalFeedback: 0,
    },
  });

  const project = await prisma.project.upsert({
    where: { id: "00000000-0000-0000-0000-000000000001" },
    update: {},
    create: {
      id: "00000000-0000-0000-0000-000000000001",
      userId: user.id,
      name: "Demo Travel Reel",
      description: "Sample project to explore VisionCut",
      status: ProjectStatus.uploading,
    },
  });

  // Only create the placeholder reference clip if the project has none
  const existing = await prisma.clip.count({ where: { projectId: project.id } });
  if (existing === 0) {
    await prisma.clip.create({
      data: {
        projectId: project.id,
        name: "Reference video (placeholder)",
        url: "https://placeholder.local/reference.mp4",
        type: ClipType.reference,
        durationSec: 60,
      },
    });
  }

  // Default private style
  await prisma.style.upsert({
    where: { id: "00000000-0000-0000-0000-000000000002" },
    update: {},
    create: {
      id: "00000000-0000-0000-0000-000000000002",
      userId: user.id,
      name: "Travel Reel v1",
      description: "Fast-paced travel edits with zoom and flash transitions",
      contentType: "travel_reel",
      pace: "fast",
      transitions: [
        { type: "zoom", frequency: 8, timestamps: [] },
        { type: "flash", frequency: 3, timestamps: [] },
        { type: "cut", frequency: 12, timestamps: [] },
      ],
      audioComponents: { has_music: true, music_type: "electronic", beat_sync: true },
      blueprintTemplate: {
        content_type: "travel_reel",
        language: "en",
        pace: "fast",
        avg_clip_duration: 1.8,
        visual_effects: ["zoom", "flash"],
        color_grade: "vibrant",
        required_clip_types: ["drone", "b_roll"],
        audio: {
          has_music: true,
          music_type: "electronic",
          has_voiceover: false,
          has_dialogue: false,
          has_sfx: false,
          beat_sync: true,
        },
      },
      isPublic: false,
      usageCount: 0,
    },
  });

  console.log(`✓ Seeded demo user: ${email} / demo1234`);
  console.log(`✓ Demo project id: ${project.id}`);
  console.log(`✓ Default style: Travel Reel v1`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
