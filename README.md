# Podcast Transcriber

Podcast Transcriber turns Apple Podcasts episode links into transcripts and can save those transcripts to Readwise Reader.

## Workflows

- Browser form: paste an Apple Podcasts episode URL, transcribe it, then save the transcript to Reader.
- iOS share sheet: use an Apple Shortcut to send a shared Apple Podcasts episode URL to `POST /api/capture`, then show a notification with the Reader result.

The Shortcut setup is documented in [docs/shortcuts/apple-podcasts-to-reader.md](docs/shortcuts/apple-podcasts-to-reader.md).

## Environment

- `DEEPGRAM_API_KEY`: required for transcription.
- `CAPTURE_API_SECRET`: required by the Shortcut capture API.
- `CAPTURE_TIMEOUT_MS`: optional timeout budget for Shortcut capture requests.

## Development

```bash
npm run dev
npm run lint
npm run build
npm run test -- --run
```
