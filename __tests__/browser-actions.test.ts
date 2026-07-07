import { beforeEach, describe, expect, it, vi } from "vitest"

import { fetchApplePodcastEpisodeMetadata, resolveApplePodcastDownloadUrl } from "@/lib/apple-podcasts"
import { transcribeDownloadUrl } from "@/lib/podcast-capture"
import { ReadwiseSaveError, saveTranscriptToReadwise } from "@/lib/readwise"

vi.mock("@/lib/apple-podcasts", () => ({
  fetchApplePodcastEpisodeMetadata: vi.fn(),
  resolveApplePodcastDownloadUrl: vi.fn(),
}))

vi.mock("@/lib/podcast-capture", () => ({
  transcribeDownloadUrl: vi.fn(),
}))

vi.mock("@/lib/readwise", () => ({
  ReadwiseSaveError: class ReadwiseSaveError extends Error {
    category: string

    constructor(category: string, message: string) {
      super(message)
      this.category = category
    }
  },
  saveTranscriptToReadwise: vi.fn(),
}))

const resolveMock = vi.mocked(resolveApplePodcastDownloadUrl)
const metadataMock = vi.mocked(fetchApplePodcastEpisodeMetadata)
const transcribeMock = vi.mocked(transcribeDownloadUrl)
const saveMock = vi.mocked(saveTranscriptToReadwise)

async function loadActions() {
  return import("@/app/actions")
}

describe("browser server actions", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("keeps the getDownloadUrl response shape", async () => {
    resolveMock.mockResolvedValue("https://media.example.com/episode.mp3")
    const { getDownloadUrl } = await loadActions()
    const formData = new FormData()
    formData.set("url", "https://podcasts.apple.com/us/podcast/show/id123?i=456")

    await expect(getDownloadUrl(formData)).resolves.toEqual({
      downloadUrl: "https://media.example.com/episode.mp3",
    })
  })

  it("keeps the getTranscript response shape", async () => {
    transcribeMock.mockResolvedValue(["Transcript paragraph"])
    const { getTranscript } = await loadActions()

    await expect(getTranscript("https://media.example.com/episode.mp3")).resolves.toEqual({
      transcript: ["Transcript paragraph"],
    })
  })

  it("keeps the metadata response shape", async () => {
    metadataMock.mockResolvedValue({
      name: "Episode One",
      url: "https://podcasts.apple.com/us/podcast/show/id123?i=456",
    })
    const { getEpisodeMetadata } = await loadActions()

    await expect(getEpisodeMetadata("https://podcasts.apple.com/us/podcast/show/id123?i=456")).resolves.toEqual({
      name: "Episode One",
      url: "https://podcasts.apple.com/us/podcast/show/id123?i=456",
    })
  })

  it("keeps the saveToReadwise success response shape", async () => {
    saveMock.mockResolvedValue({
      documentUrl: "https://readwise.io/reader/document/abc",
    })
    const { saveToReadwise } = await loadActions()

    await expect(
      saveToReadwise(
        "readwise-token",
        { name: "Episode One", url: "https://podcasts.apple.com/us/podcast/show/id123?i=456" },
        ["Transcript paragraph"],
      ),
    ).resolves.toEqual({
      success: true,
      documentUrl: "https://readwise.io/reader/document/abc",
    })
  })

  it("keeps invalid Reader token errors actionable for the browser", async () => {
    saveMock.mockRejectedValue(new ReadwiseSaveError("invalid_reader_token", "Unauthorized"))
    const { saveToReadwise } = await loadActions()

    const result = await saveToReadwise(
      "bad-token",
      { name: "Episode One", url: "https://podcasts.apple.com/us/podcast/show/id123?i=456" },
      ["Transcript paragraph"],
    )

    expect(result.error).toContain("Invalid token")
  })
})
