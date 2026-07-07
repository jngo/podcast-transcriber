import type { EpisodeMetadata } from "@/app/types"
import { canonicalizeApplePodcastUrl } from "@/lib/apple-podcasts"

type FetchLike = (input: string, init?: RequestInit) => Promise<Response>

export type ReadwiseFailureCategory = "missing_reader_token" | "invalid_reader_token" | "reader_save_failed"

export type ReaderSaveResult = {
  documentUrl?: string
}

export class ReadwiseSaveError extends Error {
  category: ReadwiseFailureCategory
  status?: number

  constructor(category: ReadwiseFailureCategory, message: string, status?: number) {
    super(message)
    this.name = "ReadwiseSaveError"
    this.category = category
    this.status = status
  }
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;")
}

export function buildReadwiseHtml(transcript: string[]): string {
  return transcript.map((line) => `<p>${escapeHtml(line)}</p>`).join("")
}

function buildReadwisePayload(metadata: EpisodeMetadata, transcript: string[]) {
  return {
    title: metadata.name,
    author: metadata.partOfSeries?.name,
    url: canonicalizeApplePodcastUrl(metadata.url ?? "") ?? metadata.url,
    html: buildReadwiseHtml(transcript),
    image_url: metadata.thumbnailUrl,
    published_date: metadata.datePublished,
  }
}

export async function saveTranscriptToReadwise(
  accessToken: string,
  metadata: EpisodeMetadata,
  transcript: string[],
  fetcher: FetchLike = fetch,
): Promise<ReaderSaveResult> {
  if (!accessToken) {
    throw new ReadwiseSaveError("missing_reader_token", "Please provide a Readwise access token")
  }

  const response = await fetcher("https://readwise.io/api/v3/save/", {
    method: "POST",
    headers: {
      Authorization: `Token ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(buildReadwisePayload(metadata, transcript)),
  })

  if (!response.ok) {
    const category = response.status === 401 || response.status === 403 ? "invalid_reader_token" : "reader_save_failed"
    throw new ReadwiseSaveError(category, `Readwise save failed with HTTP ${response.status}`, response.status)
  }

  const data = (await response.json()) as { url?: unknown }
  return {
    documentUrl: typeof data.url === "string" ? data.url : undefined,
  }
}
