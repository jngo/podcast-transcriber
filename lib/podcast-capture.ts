import { createClient } from "@deepgram/sdk"

import type { EpisodeMetadata } from "@/app/types"
import {
  canonicalizeApplePodcastUrl,
  fetchApplePodcastEpisodeMetadata,
  resolveApplePodcastDownloadUrl,
} from "@/lib/apple-podcasts"
import { ReadwiseSaveError, saveTranscriptToReadwise, type ReaderSaveResult } from "@/lib/readwise"

export type CaptureFailureCategory =
  | "unsupported_input"
  | "missing_capture_auth"
  | "missing_reader_token"
  | "invalid_reader_token"
  | "transcription_failed"
  | "reader_save_failed"
  | "timeout"
  | "unexpected_error"

export type CaptureSuccessResult = {
  status: "saved"
  readerUrl?: string
  notificationTitle: string
  notificationBody: string
  metadata: EpisodeMetadata
}

export type CaptureFailureResult = {
  status: "failed" | "timeout"
  category: CaptureFailureCategory
  notificationTitle: string
  notificationBody: string
  error: string
}

export type CaptureResult = CaptureSuccessResult | CaptureFailureResult

export type CaptureRequest = {
  url: string
  readwiseToken: string
  timeoutMs?: number
}

export type CaptureDependencies = {
  resolveDownloadUrl?: (url: string) => Promise<string>
  fetchMetadata?: (url: string) => Promise<EpisodeMetadata>
  transcribe?: (downloadUrl: string) => Promise<string[]>
  saveToReader?: (accessToken: string, metadata: EpisodeMetadata, transcript: string[]) => Promise<ReaderSaveResult>
}

class CaptureTimeoutError extends Error {
  constructor() {
    super("Capture timed out")
    this.name = "CaptureTimeoutError"
  }
}

export async function transcribeDownloadUrl(downloadUrl: string): Promise<string[]> {
  const deepgramApiKey = process.env.DEEPGRAM_API_KEY

  if (!deepgramApiKey) {
    throw new Error("Deepgram API key is not configured")
  }

  const deepgram = createClient(deepgramApiKey)

  const { result, error } = await deepgram.listen.prerecorded.transcribeUrl(
    { url: downloadUrl },
    {
      model: "nova-2",
      smart_format: true,
      punctuate: true,
      paragraphs: true,
      utterances: true,
      filler_words: true,
    },
  )

  if (error) {
    throw new Error(error.message)
  }

  const transcript = result?.results?.channels?.[0]?.alternatives?.[0]?.paragraphs?.transcript
  if (!transcript) {
    throw new Error("No transcript generated")
  }

  return transcript.split("\n").filter(Boolean)
}

function createFailureResult(category: CaptureFailureCategory, message?: string): CaptureFailureResult {
  const copy: Record<CaptureFailureCategory, { title: string; body: string }> = {
    unsupported_input: {
      title: "Unsupported podcast link",
      body: "Share an Apple Podcasts episode link and try again.",
    },
    missing_capture_auth: {
      title: "Capture setup needed",
      body: "The Shortcut is missing or using the wrong capture secret.",
    },
    missing_reader_token: {
      title: "Readwise token needed",
      body: "Add your Readwise access token to the Shortcut and try again.",
    },
    invalid_reader_token: {
      title: "Reader access failed",
      body: "The Readwise token was rejected. Update it in the Shortcut and try again.",
    },
    transcription_failed: {
      title: "Transcription failed",
      body: "Podcast Transcriber could not generate a transcript for this episode.",
    },
    reader_save_failed: {
      title: "Reader save failed",
      body: "The transcript was generated but could not be saved to Reader.",
    },
    timeout: {
      title: "Capture timed out",
      body: "The transcript did not finish within the Shortcut wait window. Try again later.",
    },
    unexpected_error: {
      title: "Capture failed",
      body: "Podcast Transcriber hit an unexpected error.",
    },
  }

  return {
    status: category === "timeout" ? "timeout" : "failed",
    category,
    notificationTitle: copy[category].title,
    notificationBody: copy[category].body,
    error: message ?? copy[category].body,
  }
}

async function withTimeout<T>(promise: Promise<T>, timeoutMs?: number): Promise<T> {
  if (!timeoutMs || timeoutMs <= 0) {
    return promise
  }

  let timeout: ReturnType<typeof setTimeout> | undefined

  try {
    return await Promise.race([
      promise,
      new Promise<never>((_, reject) => {
        timeout = setTimeout(() => reject(new CaptureTimeoutError()), timeoutMs)
      }),
    ])
  } finally {
    if (timeout) {
      clearTimeout(timeout)
    }
  }
}

async function runCapture(
  request: CaptureRequest,
  dependencies: CaptureDependencies = {},
): Promise<CaptureResult> {
  const canonicalUrl = canonicalizeApplePodcastUrl(request.url)
  if (!canonicalUrl) {
    return createFailureResult("unsupported_input")
  }

  if (!request.readwiseToken) {
    return createFailureResult("missing_reader_token")
  }

  const resolveDownloadUrl = dependencies.resolveDownloadUrl ?? resolveApplePodcastDownloadUrl
  const fetchMetadata = dependencies.fetchMetadata ?? fetchApplePodcastEpisodeMetadata
  const transcribe = dependencies.transcribe ?? transcribeDownloadUrl
  const saveToReader = dependencies.saveToReader ?? saveTranscriptToReadwise

  let downloadUrl: string
  let metadata: EpisodeMetadata

  try {
    ;[downloadUrl, metadata] = await Promise.all([resolveDownloadUrl(canonicalUrl), fetchMetadata(canonicalUrl)])
  } catch (error) {
    const message = error instanceof Error ? error.message : undefined
    return createFailureResult("unsupported_input", message)
  }

  let transcript: string[]
  try {
    transcript = await transcribe(downloadUrl)
  } catch (error) {
    const message = error instanceof Error ? error.message : undefined
    return createFailureResult("transcription_failed", message)
  }

  const readerMetadata: EpisodeMetadata = {
    ...metadata,
    url: canonicalizeApplePodcastUrl(metadata.url ?? "") ?? canonicalUrl,
  }

  try {
    const readerResult = await saveToReader(request.readwiseToken, readerMetadata, transcript)
    return {
      status: "saved",
      readerUrl: readerResult.documentUrl,
      notificationTitle: "Saved to Reader",
      notificationBody: readerResult.documentUrl
        ? "Transcript saved to Reader. Open the document to review it."
        : "Transcript saved to Reader.",
      metadata: readerMetadata,
    }
  } catch (error) {
    if (error instanceof ReadwiseSaveError) {
      return createFailureResult(error.category, error.message)
    }

    const message = error instanceof Error ? error.message : undefined
    return createFailureResult("reader_save_failed", message)
  }
}

export async function capturePodcastToReader(
  request: CaptureRequest,
  dependencies: CaptureDependencies = {},
): Promise<CaptureResult> {
  try {
    return await withTimeout(runCapture(request, dependencies), request.timeoutMs)
  } catch (error) {
    if (error instanceof CaptureTimeoutError) {
      return createFailureResult("timeout")
    }

    const message = error instanceof Error ? error.message : undefined
    return createFailureResult("unexpected_error", message)
  }
}
