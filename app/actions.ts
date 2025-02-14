"use server"

import { load } from "cheerio"
import { createClient } from "@deepgram/sdk";
import type { DownloadUrlResponse, TranscriptResponse } from "./types"

console.log("DEEPGRAM_API_KEY is set:", !!process.env.DEEPGRAM_API_KEY)

export async function getDownloadUrl(formData: FormData): Promise<DownloadUrlResponse> {
  const url = formData.get("url") as string

  if (!url) {
    return { error: "Please provide a valid Apple Podcasts episode URL" }
  }

  try {
    const response = await fetch(url)
    const html = await response.text()

    const $ = load(html)
    const scriptContent = $("#serialized-server-data").html()

    if (!scriptContent) {
      return { error: "Could not find the required data in the page" }
    }

    const jsonData = JSON.parse(scriptContent)
    const data = jsonData[0].data

    const headerButtonItems = data.headerButtonItems

    if (!headerButtonItems || !Array.isArray(headerButtonItems)) {
      return { error: "Could not find the header button items" }
    }

    const bookmarkItem = headerButtonItems.find(
      (item: any) => item.$kind === "bookmark" && item.modelType === "EpisodeOffer",
    )

    if (!bookmarkItem) {
      return { error: "Could not find the bookmark item" }
    }

    const streamUrl = bookmarkItem.model.streamUrl

    if (!streamUrl) {
      return { error: "Could not find the stream URL" }
    }

    return { downloadUrl: streamUrl }
  } catch (error) {
    console.error("Error:", error)
    return { error: "An error occurred while processing the URL" }
  }
}

export async function generateTranscript(downloadUrl: string): Promise<TranscriptResponse> {
  // const deepgramApiKey = process.env.DEEPGRAM_API_KEY
  const deepgramApiKey = "a6933585e6203b5ece01609872f8b22e79240be6"

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
        diarize: true,
        filler_words: true,
      },
    )

    console.log("Result:", result)

    if (error) {
      throw new Error(error.message)
    }

    // if (!result?.results?.channels?.[0]?.alternatives?.[0]?.transcript) {
      if (!result?.results?.channels?.[0]?.alternatives?.[0]?.paragraphs?.transcript) {
      throw new Error("No transcript generated")
    }

    const transcript = result.results.channels[0].alternatives[0].paragraphs.transcript

    return { transcript }
  } catch (error) {
    console.error("Transcription error:", error)
    return {
      error: "Failed to generate transcript. Please ensure the audio URL is accessible and the API key is correct.",
    }
  }
}

