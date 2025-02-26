export interface DownloadUrlResponse {
  downloadUrl?: string
  error?: string
}

export interface TranscriptResponse {
  transcript?: string[]
  error?: string
}

export interface EpisodeMetadata {
  name?: string
  description?: string
  productionCompany?: string
  datePublished?: string
  url?: string
  partOfSeries?: {
    name?: string
    url?: string
  }
  thumbnailUrl?: string
  duration?: string
  error?: string
}

