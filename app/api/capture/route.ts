import { NextResponse } from "next/server"
import { getDownloadUrl, getEpisodeMetadata, getTranscript, saveToReadwise } from "../../actions"

// Resolving, transcribing and saving happen in one request, so allow more than the default.
export const maxDuration = 60

function errorResponse(status: number, error: string) {
  return NextResponse.json({ error }, { status })
}

function isApplePodcastsUrl(value: unknown): value is string {
  if (typeof value !== "string") return false
  try {
    const parsed = new URL(value)
    return parsed.protocol === "https:" && parsed.hostname === "podcasts.apple.com"
  } catch {
    return false
  }
}

async function isReadwiseTokenValid(token: string): Promise<boolean> {
  const response = await fetch("https://readwise.io/api/v2/auth/", {
    headers: { Authorization: `Token ${token}` },
  })
  return response.status === 204
}

/**
 * One-shot capture for use outside the web form (for example an iOS Shortcut in the
 * share sheet): takes an Apple Podcasts episode URL, transcribes it and saves the
 * transcript to Readwise Reader.
 *
 *   POST /api/capture
 *   Authorization: Bearer <Readwise access token>
 *   { "url": "https://podcasts.apple.com/..." }
 */
export async function POST(request: Request) {
  const token = request.headers.get("authorization")?.match(/^Bearer\s+(.+)$/i)?.[1]?.trim()
  if (!token) {
    return errorResponse(401, "Send your Readwise access token as 'Authorization: Bearer <token>'")
  }

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return errorResponse(400, "Request body must be JSON with a 'url' field")
  }

  const url = (body as { url?: unknown } | null)?.url
  if (!isApplePodcastsUrl(url)) {
    return errorResponse(400, "Please provide a valid Apple Podcasts episode URL")
  }

  // Check the token before spending a transcription on a save that would fail.
  try {
    if (!(await isReadwiseTokenValid(token))) {
      return errorResponse(401, "Readwise rejected the access token")
    }
  } catch (error) {
    console.error("Readwise token check failed:", error)
    return errorResponse(502, "Could not reach Readwise to check the access token")
  }

  const formData = new FormData()
  formData.append("url", url)
  const [download, metadata] = await Promise.all([getDownloadUrl(formData), getEpisodeMetadata(url)])

  if (download.error || !download.downloadUrl) {
    return errorResponse(422, download.error ?? "Could not find the episode audio")
  }
  if ("error" in metadata && metadata.error) {
    return errorResponse(422, metadata.error)
  }

  const transcript = await getTranscript(download.downloadUrl)
  if (transcript.error || !transcript.transcript) {
    return errorResponse(502, transcript.error ?? "Failed to generate transcript")
  }

  const saved = await saveToReadwise(token, metadata, transcript.transcript)
  if (saved.error) {
    return errorResponse(502, saved.error)
  }

  return NextResponse.json({
    title: "name" in metadata ? metadata.name : undefined,
    documentUrl: saved.documentUrl,
  })
}
