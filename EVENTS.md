# Event Taxonomy

The application tracks custom events using Vercel Web Analytics. Events follow the `<object>_<action>[_<modifier>]` naming pattern and avoid sensitive values such as access tokens, raw exception text, or full shared URLs from the Shortcut path.

## Browser Funnel

| Event Name | Trigger | Properties |
| --- | --- | --- |
| `episode_transcribe` | User submits a podcast URL for transcription in the browser form. | `url` - the episode URL. |
| `episode_transcribe_success` | Transcript successfully generated in the browser flow. | `url` - the episode URL. |
| `episode_transcribe_error` | Failure while fetching metadata, resolving the download URL, or transcribing in the browser flow. | `step` - stage of failure (`download_url`, `metadata`, `transcript`, `api`); `error` - error message. |
| `transcript_save` | User attempts to save a browser-generated transcript to Readwise. | `hasToken` - whether a token was already available. |
| `transcript_save_success` | Browser-generated transcript successfully saved to Readwise. | None. |
| `transcript_save_error` | Saving a browser-generated transcript to Readwise failed. | `error` - error message. |
| `token_show_dialog` | Readwise token dialog is shown. | None. |
| `token_store` | User persists the Readwise token in local storage. | None. |
| `transcript_click_link` | User clicks the "View" link in the success toast. | None. |

## Shortcut Funnel

| Event Name | Trigger | Properties |
| --- | --- | --- |
| `share_capture` | `POST /api/capture` receives or rejects a Shortcut capture request. | `source` - always `shortcut`; `status` - `accepted` or `failed`; `failure_type` - broad category or `null`. |
| `share_capture_save` | The Shortcut capture path finishes with saved, failed, or timeout status. | `source` - always `shortcut`; `status` - `saved`, `failed`, or `timeout`; `failure_type` - broad category or `null`; `reader_url_available` - whether Reader returned a document URL. |

Shortcut events intentionally do not include the Readwise token, capture secret, raw exception messages, or full URL values.
