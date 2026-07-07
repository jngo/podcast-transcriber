import { beforeEach, describe, expect, it, vi } from "vitest"

import { capturePodcastToReader } from "@/lib/podcast-capture"
import { trackServerEvent } from "@/lib/analytics"

vi.mock("@/lib/podcast-capture", () => ({
  capturePodcastToReader: vi.fn(),
}))

vi.mock("@/lib/analytics", () => ({
  trackServerEvent: vi.fn(),
}))

const mockCapturePodcastToReader = vi.mocked(capturePodcastToReader)
const mockTrackServerEvent = vi.mocked(trackServerEvent)

function createRequest(body: unknown, headers: Record<string, string> = {}) {
  return new Request("https://example.test/api/capture", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...headers,
    },
    body: JSON.stringify(body),
  })
}

async function post(body: unknown, headers?: Record<string, string>) {
  const { POST } = await import("@/app/api/capture/route")
  return POST(createRequest(body, headers))
}

describe("POST /api/capture", () => {
  beforeEach(() => {
    vi.resetModules()
    vi.clearAllMocks()
    process.env.CAPTURE_API_SECRET = "capture-secret"
    delete process.env.CAPTURE_TIMEOUT_MS
  })

  it("rejects missing capture auth before calling the capture service", async () => {
    const response = await post({
      url: "https://podcasts.apple.com/us/podcast/show-name/id123456789?i=987654321",
      readwiseToken: "readwise-token",
    })
    const json = await response.json()

    expect(response.status).toBe(401)
    expect(json).toMatchObject({
      status: "failed",
      category: "missing_capture_auth",
    })
    expect(mockCapturePodcastToReader).not.toHaveBeenCalled()
    expect(mockTrackServerEvent).toHaveBeenCalledWith(
      "share_capture",
      expect.objectContaining({
        source: "shortcut",
        status: "failed",
        failure_type: "missing_capture_auth",
      }),
      expect.any(Request),
    )
  })

  it("rejects missing Readwise tokens before calling the capture service", async () => {
    const response = await post({
      url: "https://podcasts.apple.com/us/podcast/show-name/id123456789?i=987654321",
      captureSecret: "capture-secret",
    })
    const json = await response.json()

    expect(response.status).toBe(200)
    expect(json).toMatchObject({
      status: "failed",
      category: "missing_reader_token",
    })
    expect(mockCapturePodcastToReader).not.toHaveBeenCalled()
  })

  it("returns a Shortcut-friendly saved response", async () => {
    mockCapturePodcastToReader.mockResolvedValue({
      status: "saved",
      readerUrl: "https://readwise.io/reader/document/abc",
      notificationTitle: "Saved to Reader",
      notificationBody: "Transcript saved to Reader.",
      metadata: {
        name: "Episode One",
      },
    })

    const response = await post({
      url: "https://podcasts.apple.com/us/podcast/show-name/id123456789?i=987654321&uo=4",
      captureSecret: "capture-secret",
      readwiseToken: "readwise-token",
    })
    const json = await response.json()

    expect(response.status).toBe(200)
    expect(json).toMatchObject({
      status: "saved",
      readerUrl: "https://readwise.io/reader/document/abc",
      notificationTitle: "Saved to Reader",
    })
    expect(mockCapturePodcastToReader).toHaveBeenCalledWith(
      expect.objectContaining({
        url: "https://podcasts.apple.com/us/podcast/show-name/id123456789?i=987654321&uo=4",
        readwiseToken: "readwise-token",
      }),
    )
    expect(mockTrackServerEvent).toHaveBeenCalledWith(
      "share_capture",
      expect.objectContaining({
        source: "shortcut",
        status: "accepted",
      }),
      expect.any(Request),
    )
    expect(mockTrackServerEvent).toHaveBeenCalledWith(
      "share_capture_save",
      expect.objectContaining({
        source: "shortcut",
        status: "saved",
        reader_url_available: true,
      }),
      expect.any(Request),
    )
  })

  it("returns known capture failures as displayable JSON", async () => {
    mockCapturePodcastToReader.mockResolvedValue({
      status: "failed",
      category: "unsupported_input",
      notificationTitle: "Unsupported podcast link",
      notificationBody: "Share an Apple Podcasts episode link and try again.",
      error: "Share an Apple Podcasts episode link and try again.",
    })

    const response = await post({
      url: "https://example.com/not-a-podcast",
      captureSecret: "capture-secret",
      readwiseToken: "readwise-token",
    })
    const json = await response.json()

    expect(response.status).toBe(200)
    expect(json).toMatchObject({
      status: "failed",
      category: "unsupported_input",
      notificationTitle: "Unsupported podcast link",
    })
  })

  it("returns timeout responses without converting them to unexpected errors", async () => {
    mockCapturePodcastToReader.mockResolvedValue({
      status: "timeout",
      category: "timeout",
      notificationTitle: "Capture timed out",
      notificationBody: "The transcript did not finish within the Shortcut wait window. Try again later.",
      error: "The transcript did not finish within the Shortcut wait window. Try again later.",
    })

    const response = await post({
      url: "https://podcasts.apple.com/us/podcast/show-name/id123456789?i=987654321",
      captureSecret: "capture-secret",
      readwiseToken: "readwise-token",
    })
    const json = await response.json()

    expect(response.status).toBe(200)
    expect(json).toMatchObject({
      status: "timeout",
      category: "timeout",
    })
  })
})
