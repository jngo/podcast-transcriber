# Apple Podcasts To Reader Shortcut

This guide sets up an iOS Shortcut that receives an Apple Podcasts episode from the share sheet, sends it to Podcast Transcriber, and shows a notification with the Reader result.

## Requirements

- A deployed Podcast Transcriber URL.
- `DEEPGRAM_API_KEY` configured on the deployment.
- `CAPTURE_API_SECRET` configured on the deployment.
- A Readwise access token from `https://readwise.io/access_token`.

## Shortcut Setup

Create a new Shortcut and enable it for the share sheet.

1. Open Shortcut details.
2. Enable "Show in Share Sheet".
3. Set accepted input to URLs. Text is acceptable as a fallback if the share sheet sends the URL as text.
4. Add a text value or dictionary value for the deployed Podcast Transcriber base URL.
5. Add a text value for the `CAPTURE_API_SECRET`.
6. Add a text value for the Readwise access token.

Add a "Get Contents of URL" action:

- URL: `<deployed app URL>/api/capture`
- Method: `POST`
- Request Body: JSON
- JSON fields:
  - `url`: the Shortcut input.
  - `captureSecret`: the Shortcut's capture secret value.
  - `readwiseToken`: the Shortcut's Readwise token value.

Add a "Get Dictionary Value" action for these response fields:

- `status`
- `notificationTitle`
- `notificationBody`
- `readerUrl`
- `category`

Add a "Show Notification" action:

- Title: `notificationTitle`
- Body: `notificationBody`

After the notification, add an "If" action:

- If `readerUrl` has any value, run "Open URLs" with `readerUrl`.
- Otherwise, stop the Shortcut.

## Expected Outcomes

| Scenario | Expected Shortcut result |
| --- | --- |
| Supported Apple Podcasts episode | Notification says the transcript was saved to Reader, and `readerUrl` can open the document. |
| Duplicate supported episode | Reader returns the existing document when its same-URL dedupe recognizes the canonical URL. |
| Unsupported URL | Notification says the podcast link is unsupported; no Reader save is attempted. |
| Missing or invalid capture secret | Notification says capture setup is needed; no transcription or Reader save is attempted. |
| Missing Readwise token | Notification asks for the Readwise token; no transcription or Reader save is attempted. |
| Invalid Readwise token | Notification says Reader access failed. |
| Transcription failure | Notification says transcription failed. |
| Reader save failure | Notification says the transcript could not be saved to Reader. |
| Timeout | Notification says capture timed out and suggests retrying later. |

## Manual Smoke Test

1. Share a real Apple Podcasts episode into the Shortcut.
2. Confirm the notification appears.
3. Confirm Reader opens when the response includes `readerUrl`.
4. Share the same episode again and confirm Reader reuses the same document when dedupe recognizes the URL.
5. Share a non-Apple URL and confirm the unsupported-input notification appears.
6. Temporarily remove the Readwise token and confirm the token-needed notification appears.
7. Temporarily change the capture secret and confirm the capture-setup notification appears.

## Out Of Scope

This Shortcut only saves the full transcript to Reader.
It does not create Reader highlights, infer timestamps, inspect selected transcript text, or detect the specific idea around the current playback moment.
