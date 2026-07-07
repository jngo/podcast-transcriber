import { describe, expect, it, vi } from "vitest"

import { capturePodcastToReader } from "@/lib/podcast-capture"

const episodeUrl = "https://podcasts.apple.com/us/podcast/show-name/id123456789?i=987654321&uo=4"

function createDependencies() {
  const calls: string[] = []

  return {
    calls,
    dependencies: {
      resolveDownloadUrl: vi.fn(async () => {
        calls.push("resolve")
        return "https://media.example.com/episode.mp3"
      }),
      fetchMetadata: vi.fn(async () => {
        calls.push("metadata")
        return {
          name: "Episode One",
          url: episodeUrl,
          partOfSeries: {
            name: "The Show",
          },
        }
      }),
      transcribe: vi.fn(async () => {
        calls.push("transcribe")
        return ["Transcript paragraph"]
      }),
      saveToReader: vi.fn(async () => {
        calls.push("save")
        return {
          documentUrl: "https://readwise.io/reader/document/abc",
        }
      }),
    },
  }
}

describe("capturePodcastToReader", () => {
  it("resolves, transcribes, and saves a supported episode", async () => {
    const { calls, dependencies } = createDependencies()

    const result = await capturePodcastToReader(
      {
        url: episodeUrl,
        readwiseToken: "readwise-token",
      },
      dependencies,
    )

    expect(result.status).toBe("saved")
    expect(result.readerUrl).toBe("https://readwise.io/reader/document/abc")
    expect(result.notificationTitle).toBe("Saved to Reader")
    expect(calls).toEqual(["resolve", "metadata", "transcribe", "save"])
    expect(dependencies.saveToReader).toHaveBeenCalledWith(
      "readwise-token",
      expect.objectContaining({
        url: "https://podcasts.apple.com/us/podcast/show-name/id123456789?i=987654321",
      }),
      ["Transcript paragraph"],
    )
  })

  it("rejects unsupported input before downstream work", async () => {
    const { dependencies } = createDependencies()

    const result = await capturePodcastToReader(
      {
        url: "https://example.com/not-a-podcast",
        readwiseToken: "readwise-token",
      },
      dependencies,
    )

    expect(result).toMatchObject({
      status: "failed",
      category: "unsupported_input",
    })
    expect(dependencies.resolveDownloadUrl).not.toHaveBeenCalled()
    expect(dependencies.saveToReader).not.toHaveBeenCalled()
  })

  it("rejects missing Reader tokens before downstream work", async () => {
    const { dependencies } = createDependencies()

    const result = await capturePodcastToReader(
      {
        url: episodeUrl,
        readwiseToken: "",
      },
      dependencies,
    )

    expect(result).toMatchObject({
      status: "failed",
      category: "missing_reader_token",
    })
    expect(dependencies.resolveDownloadUrl).not.toHaveBeenCalled()
  })

  it("classifies transcription failures", async () => {
    const { dependencies } = createDependencies()
    dependencies.transcribe.mockRejectedValue(new Error("Deepgram failed"))

    const result = await capturePodcastToReader(
      {
        url: episodeUrl,
        readwiseToken: "readwise-token",
      },
      dependencies,
    )

    expect(result).toMatchObject({
      status: "failed",
      category: "transcription_failed",
    })
    expect(dependencies.saveToReader).not.toHaveBeenCalled()
  })
})
