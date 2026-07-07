import { capturePodcastToReader, type CaptureFailureCategory, type CaptureResult } from "@/lib/podcast-capture"
import { trackServerEvent } from "@/lib/analytics"

export const runtime = "nodejs"

type CaptureRequestBody = {
  url?: unknown
  readwiseToken?: unknown
  captureSecret?: unknown
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null
}

function readString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value.trim() : undefined
}

function readPositiveInteger(value: string | undefined): number | undefined {
  if (!value) {
    return undefined
  }

  if (!/^\d+$/.test(value)) {
    return undefined
  }

  const parsed = Number.parseInt(value, 10)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : undefined
}

function createFailureResult(
  category: CaptureFailureCategory,
  notificationTitle: string,
  notificationBody: string,
): CaptureResult {
  return {
    status: category === "timeout" ? "timeout" : "failed",
    category,
    notificationTitle,
    notificationBody,
    error: notificationBody,
  }
}

function jsonResponse(result: CaptureResult, status = 200): Response {
  return Response.json(result, { status })
}

function trackCapture(request: Request, status: string, failureType: CaptureFailureCategory | null = null): void {
  void trackServerEvent(
    "share_capture",
    {
      source: "shortcut",
      status,
      failure_type: failureType,
    },
    request,
  )
}

function trackCaptureSave(request: Request, result: CaptureResult): void {
  void trackServerEvent(
    "share_capture_save",
    {
      source: "shortcut",
      status: result.status,
      failure_type: "category" in result ? result.category : null,
      reader_url_available: "readerUrl" in result ? Boolean(result.readerUrl) : false,
    },
    request,
  )
}

async function readBody(request: Request): Promise<CaptureRequestBody | null> {
  try {
    const body = (await request.json()) as unknown
    return isRecord(body) ? body : null
  } catch {
    return null
  }
}

export async function POST(request: Request): Promise<Response> {
  const body = await readBody(request)
  if (!body) {
    trackCapture(request, "failed", "unexpected_error")
    return jsonResponse(
      createFailureResult("unexpected_error", "Invalid capture request", "Send a JSON body from the Shortcut."),
      400,
    )
  }

  const url = readString(body.url)
  if (!url) {
    trackCapture(request, "failed", "unsupported_input")
    return jsonResponse(
      createFailureResult(
        "unsupported_input",
        "Unsupported podcast link",
        "Share an Apple Podcasts episode link and try again.",
      ),
      400,
    )
  }

  const expectedCaptureSecret = process.env.CAPTURE_API_SECRET
  const captureSecret = readString(body.captureSecret) ?? readString(request.headers.get("x-capture-secret"))

  if (!expectedCaptureSecret || captureSecret !== expectedCaptureSecret) {
    trackCapture(request, "failed", "missing_capture_auth")
    return jsonResponse(
      createFailureResult(
        "missing_capture_auth",
        "Capture setup needed",
        "The Shortcut is missing or using the wrong capture secret.",
      ),
      401,
    )
  }

  const readwiseToken = readString(body.readwiseToken) ?? readString(request.headers.get("x-readwise-token"))
  if (!readwiseToken) {
    trackCapture(request, "failed", "missing_reader_token")
    return jsonResponse(
      createFailureResult(
        "missing_reader_token",
        "Readwise token needed",
        "Add your Readwise access token to the Shortcut and try again.",
      ),
    )
  }

  try {
    trackCapture(request, "accepted")
    const result = await capturePodcastToReader({
      url,
      readwiseToken,
      timeoutMs: readPositiveInteger(process.env.CAPTURE_TIMEOUT_MS),
    })

    trackCaptureSave(request, result)
    return jsonResponse(result)
  } catch {
    const result = createFailureResult("unexpected_error", "Capture failed", "Podcast Transcriber hit an unexpected error.")
    trackCaptureSave(request, result)
    return jsonResponse(result, 500)
  }
}
