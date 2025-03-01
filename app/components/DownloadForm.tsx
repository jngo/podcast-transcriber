"use client"

import { useState, useEffect } from "react"
import { getDownloadUrl, getTranscript, getEpisodeMetadata, saveToReadwise } from "../actions"
import type { DownloadUrlResponse, EpisodeMetadata, TranscriptResponse } from "../types"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog"
import { useToast } from "@/hooks/use-toast"
import { Checkbox } from "@/components/ui/checkbox"
import { Label } from "@/components/ui/label"
import { ExternalLink } from "lucide-react"

export default function DownloadForm() {
  const [metadata, setMetadata] = useState<EpisodeMetadata | null>(null)
  const [result, setResult] = useState<DownloadUrlResponse | null>(null)
  const [transcriptResult, setTranscriptResult] = useState<TranscriptResponse | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [isTranscribing, setIsTranscribing] = useState(false)
  const [url, setUrl] = useState("")
  const [showTokenDialog, setShowTokenDialog] = useState(false)
  const [accessToken, setAccessToken] = useState("")
  const [isSaving, setIsSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [shouldSaveToken, setShouldSaveToken] = useState(false)
  const { toast } = useToast()

  const READWISE_TOKEN_KEY = "readwise_access_token"

  useEffect(() => {
    // Check for token in local storage on component mount
    const savedToken = localStorage.getItem(READWISE_TOKEN_KEY)
    if (savedToken) {
      setAccessToken(savedToken)
    }
  }, [])

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

  const handleSaveToReader = async () => {
    if (!metadata || !transcriptResult?.transcript) return
    
    setIsSaving(true)
    setSaveError(null)
    
    try {
      const response = await saveToReadwise(accessToken, metadata, transcriptResult.transcript)
      
      if (response.error) {
        // Clear token from local storage if it's invalid
        if (response.error.toLowerCase().includes("invalid token") || 
            response.error.toLowerCase().includes("unauthorized")) {
          localStorage.removeItem(READWISE_TOKEN_KEY)
          setAccessToken("")
        }
        setSaveError(response.error)
        toast({
          variant: "destructive",
          title: "Error saving to Readwise",
          description: response.error,
        })
      } else {
        // Only save token to local storage if the user opted in
        if (shouldSaveToken) {
          localStorage.setItem(READWISE_TOKEN_KEY, accessToken)
        }
        setShowTokenDialog(false)
        toast({
          title: "Success!",
          description: (
            <div className="flex items-center gap-2">
              <span>The transcript has been saved to your Readwise library.</span>
              {response.documentUrl && (
                <a
                  href={response.documentUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-primary hover:underline"
                >
                  View <ExternalLink className="h-4 w-4" />
                </a>
              )}
            </div>
          ),
        })
      }
    } catch {
      setSaveError("An unexpected error occurred")
      toast({
        variant: "destructive",
        title: "Error",
        description: "An unexpected error occurred while saving to Readwise.",
      })
    } finally {
      setIsSaving(false)
    }
  }

  const handleSaveButtonClick = () => {
    if (accessToken) {
      // If we have a token, try using it directly
      handleSaveToReader()
    } else {
      // If no token, show the dialog
      setShowTokenDialog(true)
    }
  }

  return (
    <>
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

                {transcriptResult?.transcript && (
                  <CardFooter>
                    <Button 
                      onClick={handleSaveButtonClick}
                      disabled={isSaving}
                    >
                      {isSaving ? "Saving to Reader..." : "Save to Reader"}
                    </Button>
                  </CardFooter>
                )}
              </>
            )}
          </>
        )}
      </Card>

      <Dialog open={showTokenDialog} onOpenChange={setShowTokenDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Save to Readwise</DialogTitle>
            <DialogDescription className="space-y-2">
              <p>Please enter your Readwise access token to save this transcript.</p>
              <p className="text-sm">
                You can find your access token in your{" "}
                <a
                  href="https://readwise.io/access_token"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary hover:underline inline-flex items-center gap-1"
                >
                  Readwise settings <ExternalLink className="h-3 w-3" />
                </a>
              </p>
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <Input
              type="password"
              placeholder="Enter your Readwise access token"
              value={accessToken}
              onChange={(e) => setAccessToken(e.target.value)}
            />
            <div className="flex items-center space-x-2">
              <Checkbox
                id="save-token"
                checked={shouldSaveToken}
                onCheckedChange={(checked: boolean) => setShouldSaveToken(checked)}
              />
              <Label htmlFor="save-token" className="text-sm text-muted-foreground">
                Remember this token for future use
              </Label>
            </div>
            {saveError && (
              <p className="text-sm text-red-600">{saveError}</p>
            )}
          </div>
          <div className="flex justify-end space-x-2">
            <Button variant="outline" onClick={() => setShowTokenDialog(false)}>
              Cancel
            </Button>
            <Button onClick={handleSaveToReader} disabled={!accessToken || isSaving}>
              {isSaving ? "Saving..." : "Save"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}