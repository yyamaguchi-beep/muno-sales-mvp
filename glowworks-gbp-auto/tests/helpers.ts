import { loadConfig, resetConfigCache, type Config } from "../src/config.js";
import { PostRepository } from "../src/db/database.js";
import { logger } from "../src/utils/logger.js";

logger.setFileLogging(false);

const BASE_ENV: Record<string, string> = {
  DRY_RUN: "true",
  AUTO_PUBLISH: "false",
  AI_MOCK: "true",
  STORAGE_PROVIDER: "local",
  LOCAL_PUBLIC_DIR: "public-local-test",
  STATE_SYNC: "false",
  IMAGE_VISION_CHECK: "true",
  OPENAI_API_KEY: "",
  GOOGLE_CLIENT_ID: "",
  GOOGLE_CLIENT_SECRET: "",
  GOOGLE_REFRESH_TOKEN: "",
  GBP_ACCOUNT_ID: "",
  GBP_LOCATION_ID: "",
};

export function makeConfig(overrides: Record<string, string> = {}): Config {
  for (const [k, v] of Object.entries({ ...BASE_ENV, ...overrides })) process.env[k] = v;
  resetConfigCache();
  return loadConfig();
}

export function memoryRepo(): PostRepository {
  return new PostRepository(":memory:");
}
