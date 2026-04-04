import "@testing-library/jest-dom/vitest";
import { vi } from "vitest";

// Mock environment variables
process.env.NEXT_PUBLIC_SUPABASE_URL = "https://test.supabase.co";
process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "test-anon-key";
process.env.SUPABASE_SERVICE_ROLE_KEY = "test-service-role-key";
process.env.STRIPE_SECRET_KEY = "sk_test_placeholder";
process.env.RUNPOD_API_KEY = "test-runpod-key";
process.env.RUNPOD_ENDPOINT_WAN22 = "ep-wan22";
process.env.RUNPOD_ENDPOINT_HUNYUAN = "ep-hunyuan";
process.env.RUNPOD_ENDPOINT_LTX = "ep-ltx";
process.env.RUNPOD_ENDPOINT_WAN21_TURBO = "ep-wan21turbo";
process.env.RUNPOD_ENDPOINT_MOCHI = "ep-mochi";
process.env.RUNPOD_ENDPOINT_COGVIDEO = "ep-cogvideo";
process.env.R2_ACCOUNT_ID = "test-r2-account";
process.env.R2_ACCESS_KEY_ID = "test-r2-key";
process.env.R2_SECRET_ACCESS_KEY = "test-r2-secret";
process.env.R2_BUCKET_NAME = "test-bucket";
process.env.R2_PUBLIC_URL = "https://test-r2.example.com";
process.env.NEXT_PUBLIC_APP_URL = "http://localhost:3000";
