"use server"

import { generateText } from "ai"
import { openai } from "@ai-sdk/openai"

import type { DownloadUrlResponse, EpisodeMetadata, ReadwiseResponse, TranscriptResponse } from "./types"
import { fetchApplePodcastEpisodeMetadata, resolveApplePodcastDownloadUrl } from "@/lib/apple-podcasts"
import { transcribeDownloadUrl } from "@/lib/podcast-capture"
import { ReadwiseSaveError, saveTranscriptToReadwise } from "@/lib/readwise"

function getErrorMessage(error: unknown, fallback: string): string {
  return error instanceof Error ? error.message : fallback
}

export async function getDownloadUrl(formData: FormData): Promise<DownloadUrlResponse> {
  const url = formData.get("url")

  if (typeof url !== "string" || !url) {
    return { error: "Please provide a valid Apple Podcasts episode URL" }
  }

  try {
    const downloadUrl = await resolveApplePodcastDownloadUrl(url)
    return { downloadUrl }
  } catch (error) {
    console.error("Error resolving Apple Podcasts URL:", error)
    return {
      error: getErrorMessage(error, "An error occurred while processing the URL"),
    }
  }
}

export async function getTranscript(downloadUrl: string): Promise<TranscriptResponse> {
  try {
    const transcript = await transcribeDownloadUrl(downloadUrl)
    return { transcript }
  } catch (error) {
    console.error("Transcription error:", error)
    const message = getErrorMessage(
      error,
      "Failed to generate transcript. Please ensure the audio URL is accessible and the API key is correct.",
    )

    if (message.includes("Deepgram API key")) {
      return { error: "Deepgram API key is not configured. Please check your environment variables." }
    }

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
    system,
    prompt,
  })

  return text
}

export async function getEpisodeMetadata(url: string): Promise<EpisodeMetadata> {
  try {
    return await fetchApplePodcastEpisodeMetadata(url)
  } catch (error) {
    console.error("Error fetching metadata:", error)
    return { error: "An error occurred while fetching episode metadata" }
  }
}

function getReadwiseActionError(error: unknown): string {
  if (error instanceof ReadwiseSaveError) {
    if (error.category === "missing_reader_token") {
      return "Please provide a Readwise access token"
    }

    if (error.category === "invalid_reader_token") {
      return "Invalid token or unauthorized Readwise access. Please check your access token and try again."
    }
  }

  return "Failed to save to Readwise. Please check your access token and try again."
}

export async function saveToReadwise(
  accessToken: string,
  metadata: EpisodeMetadata,
  transcript: string[],
): Promise<ReadwiseResponse> {
  try {
    const result = await saveTranscriptToReadwise(accessToken, metadata, transcript)
    return {
      success: true,
      documentUrl: result.documentUrl,
    }
  } catch (error) {
    console.error("Error saving to Readwise:", error)
    return { error: getReadwiseActionError(error) }
  }
}
