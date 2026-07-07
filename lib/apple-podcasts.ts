import { load } from "cheerio"

import type { EpisodeMetadata } from "@/app/types"

const APPLE_PODCAST_BROWSER_HEADERS: HeadersInit = {
  "User-Agent":
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/132.0.0.0 Safari/537.36",
  "Accept-Language": "en-GB,en;q=0.9",
}

type FetchLike = (input: string, init?: RequestInit) => Promise<Response>

type ShareItemWithStreamUrl = {
  model?: {
    playAction?: {
      episodeOffer?: {
        streamUrl?: string
      }
    }
  }
}

type StreamUrlCandidate = {
  url: string
  path: string
  score: number
}

export class ApplePodcastError extends Error {
  constructor(message: string) {
    super(message)
    this.name = "ApplePodcastError"
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null
}

export function isSupportedApplePodcastEpisodeUrl(input: string): boolean {
  try {
    const url = new URL(input.trim())
    return url.protocol === "https:" && url.hostname === "podcasts.apple.com" && Boolean(url.searchParams.get("i"))
  } catch {
    return false
  }
}

export function canonicalizeApplePodcastUrl(input: string): string | null {
  if (!isSupportedApplePodcastEpisodeUrl(input)) {
    return null
  }

  const url = new URL(input.trim())
  const episodeId = url.searchParams.get("i")

  url.hash = ""
  url.search = ""

  if (episodeId) {
    url.searchParams.set("i", episodeId)
  }

  return url.toString()
}

function extractPageDataCandidates(parsed: unknown): Record<string, unknown>[] {
  const candidates: Record<string, unknown>[] = []

  if (Array.isArray(parsed)) {
    for (const entry of parsed) {
      if (isRecord(entry) && isRecord(entry.data)) {
        candidates.push(entry.data)
      } else if (isRecord(entry)) {
        candidates.push(entry)
      }
    }
    return candidates
  }

  if (isRecord(parsed) && Array.isArray(parsed.data)) {
    for (const entry of parsed.data) {
      if (isRecord(entry) && isRecord(entry.data)) {
        candidates.push(entry.data)
      } else if (isRecord(entry)) {
        candidates.push(entry)
      }
    }
    return candidates
  }

  if (isRecord(parsed) && isRecord(parsed.data)) {
    candidates.push(parsed.data)
  }

  return candidates
}

function findShareItemStreamUrl(node: unknown): string | null {
  const queue: unknown[] = [node]
  const seen = new Set<unknown>()

  while (queue.length > 0) {
    const current = queue.shift()
    if (!current || typeof current !== "object" || seen.has(current)) {
      continue
    }

    seen.add(current)

    if (Array.isArray(current)) {
      queue.push(...current)
      continue
    }

    const record = current as Record<string, unknown>
    const isShareItem = record.$kind === "share" && record.modelType === "EpisodeLockup"
    if (isShareItem) {
      const streamUrl = (record as ShareItemWithStreamUrl).model?.playAction?.episodeOffer?.streamUrl
      if (typeof streamUrl === "string" && streamUrl.startsWith("http")) {
        return streamUrl
      }
    }

    for (const value of Object.values(record)) {
      if (value && typeof value === "object") {
        queue.push(value)
      }
    }
  }

  return null
}

function findHeaderButtonItemsStreamUrl(pageDataCandidates: Record<string, unknown>[]): string | null {
  for (const pageData of pageDataCandidates) {
    const headerButtonItems = Array.isArray(pageData.headerButtonItems) ? pageData.headerButtonItems : null
    if (!headerButtonItems) {
      continue
    }

    const shareItem = headerButtonItems.find((item: unknown) => {
      return (
        typeof item === "object" &&
        item !== null &&
        "$kind" in item &&
        "modelType" in item &&
        (item as { $kind: unknown }).$kind === "share" &&
        (item as { modelType: unknown }).modelType === "EpisodeLockup"
      )
    })

    if (!shareItem) {
      continue
    }

    const streamUrl = (shareItem as ShareItemWithStreamUrl).model?.playAction?.episodeOffer?.streamUrl
    if (typeof streamUrl === "string" && streamUrl.startsWith("http")) {
      return streamUrl
    }
  }

  return null
}

function scoreStreamUrlCandidate(url: string, path: string): number {
  const normalizedPath = path.toLowerCase()
  let score = 0

  if (normalizedPath.includes("episodeoffer.streamurl")) score += 120
  if (normalizedPath.includes("playaction")) score += 60
  if (normalizedPath.includes("headerbuttonitems")) score += 35
  if (normalizedPath.includes("contextaction")) score += 25
  if (normalizedPath.includes("primarybuttonaction")) score += 25
  if (/\.(mp3|m4a|aac|ogg)(\?|$)/i.test(url)) score += 35
  if (url.startsWith("https://")) score += 10

  return score
}

function findBestScoredStreamUrl(node: unknown): string | null {
  const queue: Array<{ node: unknown; path: string }> = [{ node, path: "root" }]
  const seen = new Set<unknown>()
  const seenUrls = new Set<string>()
  const candidates: StreamUrlCandidate[] = []

  for (let i = 0; i < queue.length; i++) {
    const current = queue[i].node
    const path = queue[i].path

    if (!current || typeof current !== "object" || seen.has(current)) {
      continue
    }

    seen.add(current)

    if (Array.isArray(current)) {
      for (let index = 0; index < current.length; index++) {
        queue.push({ node: current[index], path: `${path}[${index}]` })
      }
      continue
    }

    const record = current as Record<string, unknown>
    for (const [key, value] of Object.entries(record)) {
      const nextPath = `${path}.${key}`

      if (key === "streamUrl" && typeof value === "string" && value.startsWith("http")) {
        const url = value.trim()
        if (!seenUrls.has(url)) {
          seenUrls.add(url)
          candidates.push({
            url,
            path: nextPath,
            score: scoreStreamUrlCandidate(url, nextPath),
          })
        }
      }

      if (value && typeof value === "object") {
        queue.push({ node: value, path: nextPath })
      }
    }
  }

  if (candidates.length === 0) {
    return null
  }

  candidates.sort((left, right) => {
    if (left.score !== right.score) {
      return right.score - left.score
    }
    return left.path.length - right.path.length
  })

  return candidates[0].url
}

export function extractStreamUrlFromSerializedData(parsedPayload: unknown): string | null {
  const strictStreamUrl = findShareItemStreamUrl(parsedPayload)
  if (strictStreamUrl) {
    return strictStreamUrl
  }

  const pageDataCandidates = extractPageDataCandidates(parsedPayload)
  const knownPathStreamUrl = findHeaderButtonItemsStreamUrl(pageDataCandidates)
  if (knownPathStreamUrl) {
    return knownPathStreamUrl
  }

  return findBestScoredStreamUrl(parsedPayload)
}

async function fetchApplePodcastHtml(url: string, fetcher: FetchLike = fetch): Promise<string> {
  let response = await fetcher(url, { headers: APPLE_PODCAST_BROWSER_HEADERS })

  if (!response.ok) {
    const fallbackResponse = await fetcher(url)
    if (!fallbackResponse.ok) {
      throw new ApplePodcastError(
        `Could not fetch Apple Podcasts page (HTTP ${response.status} with browser-like headers, HTTP ${fallbackResponse.status} with default request)`,
      )
    }
    response = fallbackResponse
  }

  return response.text()
}

export async function resolveApplePodcastDownloadUrl(url: string, fetcher: FetchLike = fetch): Promise<string> {
  const canonicalUrl = canonicalizeApplePodcastUrl(url)
  if (!canonicalUrl) {
    throw new ApplePodcastError("Please provide a valid Apple Podcasts episode URL")
  }

  const html = await fetchApplePodcastHtml(canonicalUrl, fetcher)
  const $ = load(html)
  const scriptContent = $("#serialized-server-data").html()

  if (!scriptContent) {
    throw new ApplePodcastError("Could not find Apple serialized episode data in the page")
  }

  let parsedPayload: unknown
  try {
    parsedPayload = JSON.parse(scriptContent) as unknown
  } catch {
    throw new ApplePodcastError("Could not parse Apple serialized episode data JSON")
  }

  const streamUrl = extractStreamUrlFromSerializedData(parsedPayload)
  if (!streamUrl) {
    throw new ApplePodcastError("Could not locate a usable stream URL in Apple Podcasts page data")
  }

  return streamUrl
}

function formatDuration(isoDuration: string): string {
  const matches = isoDuration.match(/P(?:T(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?)?/)
  if (!matches) return isoDuration

  const [, hours, minutes, seconds] = matches
  const parts = []

  if (hours) parts.push(`${hours} ${parseInt(hours) === 1 ? "hour" : "hours"}`)
  if (minutes) parts.push(`${minutes} ${parseInt(minutes) === 1 ? "minute" : "minutes"}`)
  if (seconds) parts.push(`${seconds} ${parseInt(seconds) === 1 ? "second" : "seconds"}`)

  return parts.join(" ")
}

export async function fetchApplePodcastEpisodeMetadata(
  url: string,
  fetcher: FetchLike = fetch,
): Promise<EpisodeMetadata> {
  const canonicalUrl = canonicalizeApplePodcastUrl(url)
  if (!canonicalUrl) {
    throw new ApplePodcastError("Please provide a valid Apple Podcasts episode URL")
  }

  const html = await fetchApplePodcastHtml(canonicalUrl, fetcher)
  const $ = load(html)
  const scriptContent = $("#schema\\:episode").html()

  if (!scriptContent) {
    throw new ApplePodcastError("Could not find episode metadata in the page")
  }

  let fullMetadata: {
    productionCompany?: string
    datePublished?: string
    description?: string
    duration?: string
    name?: string
    url?: string
    partOfSeries?: {
      name?: string
      url?: string
    }
    thumbnailUrl?: string
  }

  try {
    fullMetadata = JSON.parse(scriptContent)
  } catch {
    throw new ApplePodcastError("Could not parse episode metadata JSON")
  }

  return {
    productionCompany: fullMetadata.productionCompany,
    datePublished: fullMetadata.datePublished,
    description: fullMetadata.description,
    duration: fullMetadata.duration ? formatDuration(fullMetadata.duration) : undefined,
    name: fullMetadata.name,
    url: canonicalizeApplePodcastUrl(fullMetadata.url ?? "") ?? canonicalUrl,
    partOfSeries: {
      name: fullMetadata.partOfSeries?.name,
      url: fullMetadata.partOfSeries?.url,
    },
    thumbnailUrl: fullMetadata.thumbnailUrl,
  }
}
