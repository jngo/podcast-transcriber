import { describe, expect, it } from "vitest"

import {
  canonicalizeApplePodcastUrl,
  extractStreamUrlFromSerializedData,
  isSupportedApplePodcastEpisodeUrl,
} from "@/lib/apple-podcasts"

describe("apple podcasts helpers", () => {
  it("accepts Apple Podcasts episode URLs with an episode id", () => {
    expect(
      isSupportedApplePodcastEpisodeUrl("https://podcasts.apple.com/us/podcast/show-name/id123456789?i=987654321"),
    ).toBe(true)
  })

  it("rejects non-Apple and non-episode URLs", () => {
    expect(isSupportedApplePodcastEpisodeUrl("https://example.com/us/podcast/show-name/id123?i=456")).toBe(false)
    expect(isSupportedApplePodcastEpisodeUrl("https://podcasts.apple.com/us/podcast/show-name/id123")).toBe(false)
    expect(isSupportedApplePodcastEpisodeUrl("not a url")).toBe(false)
  })

  it("canonicalizes an episode URL while preserving episode identity", () => {
    expect(
      canonicalizeApplePodcastUrl(
        "https://podcasts.apple.com/us/podcast/show-name/id123456789?i=987654321&uo=4&at=1000l&ct=share#episode",
      ),
    ).toBe("https://podcasts.apple.com/us/podcast/show-name/id123456789?i=987654321")
  })

  it("extracts the stream URL from known Apple serialized data shapes", () => {
    const payload = [
      {
        data: {
          headerButtonItems: [
            {
              $kind: "share",
              modelType: "EpisodeLockup",
              model: {
                playAction: {
                  episodeOffer: {
                    streamUrl: "https://media.example.com/episode.mp3",
                  },
                },
              },
            },
          ],
        },
      },
    ]

    expect(extractStreamUrlFromSerializedData(payload)).toBe("https://media.example.com/episode.mp3")
  })
})
