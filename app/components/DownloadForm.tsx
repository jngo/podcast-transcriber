"use client"

import { useState } from "react"
import { getDownloadUrl, generateTranscript, extractWisdom, getEpisodeMetadata } from "../actions"
import type { DownloadUrlResponse, EpisodeMetadata, TranscriptResponse } from "../types"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent } from "@/components/ui/card"
import ReactMarkdown from "react-markdown"

export default function DownloadForm() {
  const [result, setResult] = useState<DownloadUrlResponse | null>(null)
  const [transcriptResult, setTranscriptResult] = useState<TranscriptResponse | null>(null)
  const [wisdom, setWisdom] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [isTranscribing, setIsTranscribing] = useState(false)
  const [metadata, setMetadata] = useState<EpisodeMetadata | null>(null)

  async function handleSubmit(url: string) {
    setIsLoading(true)
    setResult(null)
    setTranscriptResult(null)
    setMetadata(null)
    const formData = new FormData()
    formData.append('url', url)
    const res = await getDownloadUrl(formData)
    setResult(res)
    if (!res.error) {
      const meta = await getEpisodeMetadata(url)
      console.log('Fetched metadata:', meta)
      setMetadata(meta)
    }
    setIsLoading(false)
  }

  const handleUrlChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const url = e.target.value
    if (url && url.startsWith('https://podcasts.apple.com/')) {
      handleSubmit(url)
    }
  }

  async function handleTranscribe() {
    if (result?.downloadUrl) {
      setIsTranscribing(true)
      setTranscriptResult(null)
      const res = await generateTranscript(result.downloadUrl)
      setTranscriptResult(res)
      setIsTranscribing(false)
    }
  }

  async function handleExtractWisdom() {
    setIsLoading(true)
    try {
      if (!transcriptResult?.transcript) {
        throw new Error("No transcript available")
      }
      const extractedWisdom = await extractWisdom(transcriptResult.transcript)
      setWisdom(extractedWisdom)
    } catch (error) {
      console.error("Error extracting wisdom:", error)
      setWisdom("An error occurred while extracting wisdom. Please try again.")
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="space-y-6">
      <div className="space-y-4">
        <div>
          <label htmlFor="url" className="block text-sm font-medium text-gray-700 mb-1">
            Apple Podcasts Episode URL
          </label>
          <Input type="url" id="url" name="url" required placeholder="https://podcasts.apple.com/..." onChange={handleUrlChange} disabled={isLoading} />
        </div>
      </div>

      {result && (
        <Card>
          <CardContent className="pt-6">
            {result.error ? (
              <p className="text-red-600">{result.error}</p>
            ) : (
              <div className="space-y-4">
                {metadata && (
                  <div className="space-y-2">
                    {metadata.thumbnailUrl && (
                      <img src={metadata.thumbnailUrl} alt="Episode thumbnail" className="w-32 h-32 object-cover rounded" />
                    )}
                    <ul className="text-sm text-gray-600 flex items-center gap-6">
                      {metadata.datePublished && (
                        <li>{new Date(metadata.datePublished).toLocaleString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}</li>
                      )}
                      {metadata.duration && (
                        <li>{metadata.duration}</li>
                      )}
                    </ul>
                    <h2 className="text-lg font-semibold"><a href={metadata.url}>{metadata.name}</a></h2>
                    {metadata.partOfSeries?.name && (
                        <a href={metadata.partOfSeries.url}>{metadata.partOfSeries.name}</a>
                      )}
                    {metadata.description && (
                      <p className="text-sm">{metadata.description}</p>
                    )}
                  </div>
                )}
                <Button onClick={handleTranscribe} disabled={isTranscribing} variant="secondary" className="w-full">
                  {isTranscribing ? "Generating Transcript..." : "Generate Transcript"}
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {transcriptResult && (
        <Card>
          <CardContent className="pt-6">
            {transcriptResult.error ? (
              <p className="text-red-600">{transcriptResult.error}</p>
            ) : (
              <div className="space-y-4">
                <div>
                  <h2 className="text-lg font-semibold mb-2">Transcript:</h2>
                  <div className="overflow-y-auto">
                    <p className="whitespace-pre-wrap">{transcriptResult.transcript}</p>
                  </div>
                </div>
                <Button onClick={handleExtractWisdom} disabled={isLoading || !transcriptResult.transcript} variant="secondary" className="w-full">
                  {isLoading ? "Extracting Wisdom..." : "Extract Wisdom"}
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {wisdom && (
        <Card>
          <CardContent className="pt-6">
            <div className="mt-4">
              <h3 className="text-lg font-semibold mb-2">Extracted Wisdom:</h3>
              <ReactMarkdown className="markdown-content">{wisdom}</ReactMarkdown>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}