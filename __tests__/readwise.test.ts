import { beforeEach, describe, expect, it, vi } from "vitest"

import { buildReadwiseHtml, saveTranscriptToReadwise, ReadwiseSaveError } from "@/lib/readwise"

const metadata = {
  name: "Episode <One>",
  partOfSeries: {
    name: "The Show",
  },
  url: "https://podcasts.apple.com/us/podcast/show-name/id123456789?i=987654321&uo=4",
  thumbnailUrl: "https://example.com/image.jpg",
  datePublished: "2026-07-06",
}

describe("readwise helpers", () => {
  beforeEach(() => {
    vi.unstubAllGlobals()
  })

  it("escapes transcript text before wrapping it in paragraphs", () => {
    expect(buildReadwiseHtml(["Use <tags>", "Tom & Jerry \"quote\""])).toBe(
      "<p>Use &lt;tags&gt;</p><p>Tom &amp; Jerry &quot;quote&quot;</p>",
    )
  })

  it("saves a Reader document with escaped HTML and canonical URL", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ url: "https://readwise.io/reader/document/abc" }),
    })
    vi.stubGlobal("fetch", fetchMock)

    const result = await saveTranscriptToReadwise("readwise-token", metadata, ["Use <tags>"])

    expect(result.documentUrl).toBe("https://readwise.io/reader/document/abc")
    expect(fetchMock).toHaveBeenCalledWith(
      "https://readwise.io/api/v3/save/",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({
          Authorization: "Token readwise-token",
          "Content-Type": "application/json",
        }),
      }),
    )

    const body = JSON.parse(fetchMock.mock.calls[0][1].body)
    expect(body.url).toBe("https://podcasts.apple.com/us/podcast/show-name/id123456789?i=987654321")
    expect(body.html).toBe("<p>Use &lt;tags&gt;</p>")
  })

  it("classifies Reader authentication failures", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        status: 401,
        text: async () => "Unauthorized",
      }),
    )

    await expect(saveTranscriptToReadwise("bad-token", metadata, ["Transcript"])).rejects.toMatchObject({
      category: "invalid_reader_token",
    } satisfies Partial<ReadwiseSaveError>)
  })
})
