"use server"

import { load } from "cheerio"
import { createClient } from "@deepgram/sdk"
import { generateText } from "ai"
import { openai } from "@ai-sdk/openai"
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

    const bookmarkItem = headerButtonItems.find((item: unknown) => {
      if (
        typeof item === "object" &&
        item !== null &&
        "$kind" in item &&
        "modelType" in item &&
        (item as { $kind: unknown }).$kind === "bookmark" &&
        (item as { modelType: unknown }).modelType === "EpisodeOffer"
      ) {
        return true;
      }
      return false;
    });

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
        diarize: true,
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

    const transcript = result.results.channels[0].alternatives[0].paragraphs.transcript

    return { transcript }
  } catch (error) {
    console.error("Transcription error:", error)
    return {
      error: "Failed to generate transcript. Please ensure the audio URL is accessible and the API key is correct.",
    }
  }
}

export async function extractWisdom(transcript: string) {
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