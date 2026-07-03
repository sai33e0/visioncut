import * as Joi from "joi";

export const configValidationSchema = Joi.object({
  NODE_ENV: Joi.string()
    .valid("development", "production", "test")
    .default("development"),
  PORT: Joi.number().default(3001),
  API_PORT: Joi.number().default(3001),
  APP_URL: Joi.string().uri().default("http://localhost:3000"),

  DATABASE_URL: Joi.string().uri({ scheme: ["postgres", "postgresql"] }).required(),
  DIRECT_URL: Joi.string().uri({ scheme: ["postgres", "postgresql"] }).optional(),

  REDIS_URL: Joi.string().uri({ scheme: ["redis", "rediss"] }).optional(),

  JWT_SECRET: Joi.string().min(16).required(),
  JWT_EXPIRES_IN: Joi.string().default("7d"),

  GEMINI_API_KEY: Joi.string().optional().allow(""),

  R2_ACCOUNT_ID: Joi.string().optional().allow(""),
  R2_ACCESS_KEY_ID: Joi.string().optional().allow(""),
  R2_SECRET_ACCESS_KEY: Joi.string().optional().allow(""),
  R2_BUCKET: Joi.string().default("visioncut-media"),
  R2_PUBLIC_URL: Joi.string().uri().optional().allow(""),

  WORKER_TOKEN: Joi.string().min(8).optional().allow(""),

  WORKER_REFERENCE_URL: Joi.string().uri().optional(),
  WORKER_CLIP_URL: Joi.string().uri().optional(),
  WORKER_TIMELINE_URL: Joi.string().uri().optional(),
  WORKER_RENDER_URL: Joi.string().uri().optional(),
  WORKER_STYLE_URL: Joi.string().uri().optional(),
  WORKER_FEEDBACK_URL: Joi.string().uri().optional(),

  SENTRY_DSN: Joi.string().uri().optional().allow(""),
});
