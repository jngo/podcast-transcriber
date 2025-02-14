"use client"

import { useState } from "react"
import { getDownloadUrl, generateTranscript } from "../actions"
import type { DownloadUrlResponse, TranscriptResponse } from "../types"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent } from "@/components/ui/card"

export default function DownloadForm() {
  const [result, setResult] = useState<DownloadUrlResponse | null>(null)
  const [transcriptResult, setTranscriptResult] = useState<TranscriptResponse | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [isTranscribing, setIsTranscribing] = useState(false)

  async function handleSubmit(formData: FormData) {
    setIsLoading(true)
    setResult(null)
    setTranscriptResult(null)
    const res = await getDownloadUrl(formData)
    setResult(res)
    setIsLoading(false)
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

  return (
    <div className="space-y-6">
      <form action={handleSubmit} className="space-y-4">
        <div>
          <label htmlFor="url" className="block text-sm font-medium text-gray-700 mb-1">
            Apple Podcasts Episode URL
          </label>
          <Input type="url" id="url" name="url" required placeholder="https://podcasts.apple.com/..." />
        </div>
        <Button type="submit" className="w-full" disabled={isLoading}>
          {isLoading ? "Processing..." : "Get Download URL"}
        </Button>
      </form>

      {result && (
        <Card>
          <CardContent className="pt-6">
            {result.error ? (
              <p className="text-red-600">{result.error}</p>
            ) : (
              <div className="space-y-4">
                <div>
                  <p className="text-green-600 mb-2">Download URL found:</p>
                  <a
                    href={result.downloadUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-600 hover:underline break-all"
                  >
                    {result.downloadUrl}
                  </a>
                </div>
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
              <div>
                <h2 className="text-lg font-semibold mb-2">Transcript:</h2>
                <div className="overflow-y-auto">
                  <p className="whitespace-pre-wrap">{transcriptResult.transcript}</p>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  )
}

