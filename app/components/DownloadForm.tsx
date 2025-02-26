"use client"

import { useState } from "react"
import { getDownloadUrl, getTranscript, getEpisodeMetadata } from "../actions"
import type { DownloadUrlResponse, EpisodeMetadata, TranscriptResponse } from "../types"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"

export default function DownloadForm() {
  const [metadata, setMetadata] = useState<EpisodeMetadata | null>(null)
  const [result, setResult] = useState<DownloadUrlResponse | null>(null)
  const [transcriptResult, setTranscriptResult] = useState<TranscriptResponse | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [isTranscribing, setIsTranscribing] = useState(false)
  const [url, setUrl] = useState("")

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (url && url.startsWith('https://podcasts.apple.com/')) {
      setIsLoading(true)
      setResult(null)
      setTranscriptResult(null)
      setMetadata(null)

      try {
        const formData = new FormData()
        formData.append('url', url)

        // Fetch both in parallel
        const [res, meta] = await Promise.all([
          getDownloadUrl(formData),
          getEpisodeMetadata(url)
        ])

        setResult(res)
        if (!res.error && res.downloadUrl) {
          setMetadata(meta)
          // Automatically start transcription
          setIsTranscribing(true)
          const transcriptRes = await getTranscript(res.downloadUrl)
          setTranscriptResult(transcriptRes)
          setIsTranscribing(false)
        }
      } catch (error) {
        console.error("Error during submission:", error)
      } finally {
        setIsLoading(false)
      }
    }
  }

  const handleUrlChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setUrl(e.target.value)
  }

  return (
    <Card>
      {!metadata ? (
        <>
          <CardHeader>
            <CardTitle>Podcast Episode Transcriber</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="flex w-full items-center space-x-2">
              <Input
                type="url"
                id="url"
                name="url"
                required
                placeholder="https://podcasts.apple.com/..."
                onChange={handleUrlChange}
                value={url}
                disabled={isLoading}
              />
              <Button type="submit" disabled={isLoading}>Transcribe</Button>
            </form>
          </CardContent>
        </>
      ) : (
        <>
            {result?.error ? (
              <p className="text-red-600">{result.error}</p>
            ) : (
              <>
                <CardHeader>
                  <div className="flex items-start">
                    {metadata.thumbnailUrl && (
                      <img src={metadata.thumbnailUrl} alt="Episode thumbnail" className="w-24 h-24 object-cover rounded" />
                    )}

                    <div className="ml-4 space-y-1">
                      <CardTitle>
                        <a href={metadata.url}>{metadata.name}</a>
                      </CardTitle>
                      <CardDescription className="space-y-1">
                        {metadata.partOfSeries?.name && metadata.partOfSeries?.url && (
                          <p className="text-md"><a href={metadata.partOfSeries?.url}>{metadata.partOfSeries?.name}</a></p>
                        )}

                        {(metadata.datePublished || metadata.duration) && (
                          <ul className="text-sm text-muted-foreground flex items-center gap-6">
                            {metadata.datePublished && (
                              <li>{new Date(metadata.datePublished).toLocaleString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}</li>
                            )}
                            {metadata.duration && (
                              <li>{metadata.duration}</li>
                            )}
                          </ul>
                        )}
                      </CardDescription>
                    </div>
                  </div>
                </CardHeader>

                <CardContent className="space-y-4">
                  {isTranscribing && (
                    <>
                      <p className="text-sm text-muted-foreground animate-pulse">Transcribing episode…</p>
                    </>
                  )}

                  {transcriptResult?.transcript && (
                    transcriptResult.transcript.map((line, index) => (
                      <p key={index}>{line}</p>
                    ))
                  )}
                </CardContent>
              </>
            )}
        </>
      )}
    </Card>
  )
}