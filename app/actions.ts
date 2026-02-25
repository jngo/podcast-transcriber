"use server"

import { load } from "cheerio"
import { createClient } from "@deepgram/sdk"
import { generateText } from "ai"
import { openai } from "@ai-sdk/openai"
import type { DownloadUrlResponse, TranscriptResponse, ReadwiseResponse, EpisodeMetadata } from "./types"

console.log("DEEPGRAM_API_KEY is set:", !!process.env.DEEPGRAM_API_KEY)

export async function getDownloadUrl(formData: FormData): Promise<DownloadUrlResponse> {
  const url = formData.get("url") as string

  if (!url) {
    return { error: "Please provide a valid Apple Podcasts episode URL" }
  }

  try {
    const response = await fetch(url, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/132.0.0.0 Safari/537.36",
        "Accept-Language": "en-GB,en;q=0.9",
      },
    })

    if (!response.ok) {
      return { error: `Apple Podcasts returned ${response.status} while loading this episode` }
    }

    const html = await response.text()

    const $ = load(html)
    const scriptContent = $("#serialized-server-data").html()

    if (!scriptContent) {
      return { error: "Could not find the required data in the page" }
    }

    const jsonData: unknown = JSON.parse(scriptContent)

    function findShareItemWithStreamUrl(node: unknown):
      | {
          model?: {
            playAction?: {
              episodeOffer?: {
                streamUrl?: string
              }
            }
          }
        }
      | null {
      if (Array.isArray(node)) {
        for (const item of node) {
          const result = findShareItemWithStreamUrl(item)
          if (result) return result
        }
        return null
      }

      if (typeof node !== "object" || node === null) {
        return null
      }

      const record = node as Record<string, unknown>
      const matchesShareItem = record.$kind === "share" && record.modelType === "EpisodeLockup"

      if (matchesShareItem) {
        const candidate = record as {
          model?: {
            playAction?: {
              episodeOffer?: {
                streamUrl?: string
              }
            }
          }
        }

        if (candidate.model?.playAction?.episodeOffer?.streamUrl) {
          return candidate
        }
      }

      for (const value of Object.values(record)) {
        const result = findShareItemWithStreamUrl(value)
        if (result) return result
      }

      return null
    }

    const shareItem = findShareItemWithStreamUrl(jsonData)

    if (!shareItem) {
      return { error: "Could not find the share item with episode data" }
    }

    // Navigate to the stream URL using yt-dlp's path: playAction.episodeOffer.streamUrl
    const streamUrl = (shareItem as {
      model?: {
        playAction?: {
          episodeOffer?: {
            streamUrl?: string;
          };
        };
      };
    }).model?.playAction?.episodeOffer?.streamUrl

    if (!streamUrl) {
      return { error: "Could not find the stream URL" }
    }

    return { downloadUrl: streamUrl }
  } catch (error) {
    console.error("Error:", error)
    const message = error instanceof Error ? error.message : "Unknown error"
    return { error: `An error occurred while processing the URL: ${message}` }
  }
}

export async function getTranscript(downloadUrl: string): Promise<TranscriptResponse> {
  const deepgramApiKey = process.env.DEEPGRAM_API_KEY
  console.log("Deepgram API Key:", deepgramApiKey ? "Set" : "Not set")

  if (!deepgramApiKey) {
    console.error("Deepgram API key is not configured")
    return { error: "Deepgram API key is not configured. Please check your environment variables." }
  }

  try {
    const deepgram = createClient(deepgramApiKey);

    console.log("Starting transcription for:", downloadUrl)

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

    console.log("Result:", result)

    if (error) {
      throw new Error(error.message)
    }

    if (!result?.results?.channels?.[0]?.alternatives?.[0]?.paragraphs?.transcript) {
      throw new Error("No transcript generated")
    }

    const transcript = result.results.channels[0].alternatives[0].paragraphs.transcript.split('\n').filter(Boolean)

    return { transcript }
  } catch (error) {
    console.error("Transcription error:", error)
    return {
      error: "Failed to generate transcript. Please ensure the audio URL is accessible and the API key is correct.",
    }
  }
}

export async function getSummary(transcript: string) {
  const system = `
  # IDENTITY and PURPOSE

  You extract surprising, insightful, and interesting information from text content. You are interested in insights related to the purpose and meaning of life, human flourishing, the role of technology in the future of humanity, artificial intelligence and its affect on humans, memes, learning, reading, books, continuous improvement, and similar topics.

  Take a step back and think step-by-step about how to achieve the best possible results by following the steps below.

  # STEPS

  - Extract a summary of the content in 25 words, including who is presenting and the content being discussed into a section called SUMMARY.

  - Extract 20 to 50 of the most surprising, insightful, and/or interesting ideas from the input in a section called IDEAS:. If there are less than 50 then collect all of them. Make sure you extract at least 20.

  - Extract 10 to 20 of the best insights from the input and from a combination of the raw input and the IDEAS above into a section called INSIGHTS. These INSIGHTS should be fewer, more refined, more insightful, and more abstracted versions of the best ideas in the content.

  - Extract 15 to 30 of the most surprising, insightful, and/or interesting quotes from the input into a section called QUOTES:. Use the exact quote text from the input.

  - Extract 15 to 30 of the most practical and useful personal habits of the speakers, or mentioned by the speakers, in the content into a section called HABITS. Examples include but aren't limited to: sleep schedule, reading habits, things they always do, things they always avoid, productivity tips, diet, exercise, etc.

  - Extract 15 to 30 of the most surprising, insightful, and/or interesting valid facts about the greater world that were mentioned in the content into a section called FACTS:.

  - Extract all mentions of writing, art, tools, projects and other sources of inspiration mentioned by the speakers into a section called REFERENCES. This should include any and all references to something that the speaker mentioned.

  - Extract the most potent takeaway and recommendation into a section called ONE-SENTENCE TAKEAWAY. This should be a 15-word sentence that captures the most important essence of the content.

  - Extract the 15 to 30 of the most surprising, insightful, and/or interesting recommendations that can be collected from the content into a section called RECOMMENDATIONS.

  # OUTPUT INSTRUCTIONS

  - Only output Markdown.

  - Write the IDEAS bullets as exactly 16 words.

  - Write the RECOMMENDATIONS bullets as exactly 16 words.

  - Write the HABITS bullets as exactly 16 words.

  - Write the FACTS bullets as exactly 16 words.

  - Write the INSIGHTS bullets as exactly 16 words.

  - Extract at least 25 IDEAS from the content.

  - Extract at least 10 INSIGHTS from the content.

  - Extract at least 20 items for the other output sections.

  - Do not give warnings or notes; only output the requested sections.

  - You use bulleted lists for output, not numbered lists.

  - Do not repeat ideas, quotes, facts, or resources.

  - Do not start items with the same opening words.

  - Ensure you follow ALL these instructions when creating your output.

  # INPUT

  INPUT:
  `
  const prompt = transcript

  const { text } = await generateText({
    model: openai("gpt-4-turbo"),
    system: system,
    prompt: prompt,
  })

  console.log("Text:", text)

  return text
}

export async function getEpisodeMetadata(url: string) {
  function formatDuration(isoDuration: string) {
    const matches = isoDuration.match(/P(?:T(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?)?/);
    if (!matches) return isoDuration;

    const [, hours, minutes, seconds] = matches;
    const parts = [];

    if (hours) parts.push(`${hours} ${parseInt(hours) === 1 ? 'hour' : 'hours'}`);
    if (minutes) parts.push(`${minutes} ${parseInt(minutes) === 1 ? 'minute' : 'minutes'}`);
    if (seconds) parts.push(`${seconds} ${parseInt(seconds) === 1 ? 'second' : 'seconds'}`);

    return parts.join(' ');
  }

  try {
    const response = await fetch(url)
    const html = await response.text()

    const $ = load(html)
    const scriptContent = $("#schema\\:episode").html()

    if (!scriptContent) {
      return { error: "Could not find episode metadata in the page" }
    }

    const fullMetadata = JSON.parse(scriptContent)

    return {
      productionCompany: fullMetadata.productionCompany,
      datePublished: fullMetadata.datePublished,
      description: fullMetadata.description,
      duration: formatDuration(fullMetadata.duration),
      name: fullMetadata.name,
      url: fullMetadata.url,
      partOfSeries: {
        name: fullMetadata.partOfSeries?.name,
        url: fullMetadata.partOfSeries?.url,
      },
      thumbnailUrl: fullMetadata.thumbnailUrl,
    }
  } catch (error) {
    console.error("Error fetching metadata:", error)
    return { error: "An error occurred while fetching episode metadata" }
  }
}

export async function saveToReadwise(accessToken: string, metadata: EpisodeMetadata, transcript: string[]): Promise<ReadwiseResponse> {
  if (!accessToken) {
    return { error: "Please provide a Readwise access token" }
  }

  try {
    const response = await fetch("https://readwise.io/api/v3/save/", {
      method: "POST",
      headers: {
        "Authorization": `Token ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        title: metadata.name,
        author: metadata.partOfSeries?.name,
        url: metadata.url,
        html: transcript.map(line => `<p>${line}</p>`).join(''),
        image_url: metadata.thumbnailUrl,
        published_date: metadata.datePublished,
      }),
    })

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`)
    }

    const data = await response.json()
    return { 
      success: true,
      documentUrl: data.url
    }
  } catch (error) {
    console.error("Error saving to Readwise:", error)
    return { error: "Failed to save to Readwise. Please check your access token and try again." }
  }
}
