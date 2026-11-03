import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

const MAX_FILE_SIZE = 10 * 1024 * 1024;
const SUPPORTED_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);
const DEFAULT_API_URL =
  "https://afridam-backend-prod-107032494605.us-central1.run.app/api/v1/saas/scan";
const REQUEST_TIMEOUT_MS = 60_000;
const WINDOW_MS = 10 * 60 * 1000;
const MAX_REQUESTS = 10;
const rateLimitStore = new Map<string, { count: number; resetAt: number }>();

function getSkinAnalysisUrl(configuredUrl?: string) {
  const value = (configuredUrl || DEFAULT_API_URL).trim().replace(/\/+$/, "");
  if (value.endsWith("/v1/saas/scan")) return value;
  return `${value}/v1/saas/scan`;
}

function getClientId(request: NextRequest) {
  return (
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    request.headers.get("x-real-ip") ||
    "unknown"
  );
}

function isRateLimited(clientId: string) {
  const now = Date.now();
  const existing = rateLimitStore.get(clientId);
  if (!existing || existing.resetAt <= now) {
    rateLimitStore.set(clientId, { count: 1, resetAt: now + WINDOW_MS });
    return false;
  }
  if (existing.count >= MAX_REQUESTS) return true;
  existing.count += 1;
  return false;
}

export async function POST(request: NextRequest) {
  const clientId = getClientId(request);
  if (isRateLimited(clientId)) {
    return NextResponse.json(
      { error: "Too many analysis requests. Please wait a few minutes and try again." },
      { status: 429 }
    );
  }

  const apiKey = process.env.AFRIDAM_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      {
        error:
          "Live AI analysis is not activated. The event integration requires an authorised API credential.",
        integrationStatus: "BLOCKED",
      },
      { status: 503 }
    );
  }

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return NextResponse.json({ error: "Invalid multipart image request." }, { status: 400 });
  }

  const file = formData.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "Please provide an image file." }, { status: 400 });
  }
  if (!SUPPORTED_TYPES.has(file.type)) {
    return NextResponse.json(
      { error: "Unsupported image format. Use JPEG, PNG, or WebP." },
      { status: 415 }
    );
  }
  if (file.size === 0 || file.size > MAX_FILE_SIZE) {
    return NextResponse.json(
      { error: "Image must be larger than 0 bytes and no larger than 10 MB." },
      { status: 413 }
    );
  }

  const upstreamForm = new FormData();
  upstreamForm.append("file", file, file.name || "skin-capture.jpg");

  const apiUrl = getSkinAnalysisUrl(process.env.AFRIDAM_API_URL);
  let upstream: Response;
  try {
    upstream = await fetch(apiUrl, {
      method: "POST",
      headers: { "X-API-KEY": apiKey },
      body: upstreamForm,
      cache: "no-store",
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
  } catch (caught) {
    if (caught instanceof Error && caught.name === "TimeoutError") {
      return NextResponse.json(
        { error: "The analysis service took too long to respond. Please try again." },
        { status: 504 }
      );
    }
    return NextResponse.json(
      { error: "The AfriDam AI service is temporarily unavailable. Please try again." },
      { status: 502 }
    );
  }

  const data = await upstream.json().catch(() => null);
  if (!upstream.ok) {
    const safeMessage =
      typeof data?.message === "string"
        ? data.message
        : typeof data?.error === "string"
          ? data.error
          : "Analysis request failed. Please try again.";
    return NextResponse.json({ error: safeMessage }, { status: upstream.status });
  }
  if (!data || typeof data !== "object") {
    return NextResponse.json(
      { error: "The analysis service returned an unexpected response. Please try again." },
      { status: 502 }
    );
  }

  if (data.succeeded === false) {
    const message =
      typeof data.message === "string"
        ? data.message
        : "The analysis service could not process this image. Please try again.";
    return NextResponse.json({ error: message }, { status: 422 });
  }

  const response = NextResponse.json(data, {
    status: 200,
    headers: { "Cache-Control": "no-store, no-cache, max-age=0, must-revalidate" },
  });
  return response;
}
