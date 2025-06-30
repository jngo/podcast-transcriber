# Event Taxonomy

The application tracks custom events using Vercel Web Analytics. All events follow the `<object>_<action>[_<modifier>]` naming pattern.

| Event Name | Trigger | Properties |
|------------|---------|------------|
| `episode_transcribe` | User submits a podcast URL for transcription. | `url` – the episode URL. |
| `episode_transcribe_success` | Transcript successfully generated. | `url` – the episode URL. |
| `episode_transcribe_error` | Failure while fetching metadata, download URL, or transcribing. | `step` – stage of failure (`download_url`, `metadata`, `transcript`, `api`); `error` – error message. |
| `transcript_save` | User attempts to save a transcript to Readwise. | `hasToken` – whether a token was already available. |
| `transcript_save_success` | Transcript successfully saved to Readwise. | – |
| `transcript_save_error` | Saving transcript to Readwise failed. | `error` – error message. |
| `token_show_dialog` | Readwise token dialog is shown. | – |
| `token_store` | User persists the Readwise token in local storage. | – |
| `transcript_click_link` | User clicks the "View" link in the success toast. | – |
