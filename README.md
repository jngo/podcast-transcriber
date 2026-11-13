This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Capture from the share sheet

`POST /api/capture` does the whole flow in one request: it takes an Apple Podcasts episode URL, transcribes it and saves the transcript to Readwise Reader. It is meant to be called from an iOS Shortcut so an episode can be captured from the Podcasts app without opening the website.

```bash
curl -X POST https://<your-deployment>/api/capture \
  -H "Authorization: Bearer <Readwise access token>" \
  -H "Content-Type: application/json" \
  -d '{"url": "https://podcasts.apple.com/..."}'
```

A successful response is `{ "title": "...", "documentUrl": "https://read.readwise.io/..." }`. Failures return `{ "error": "..." }` with a 4xx or 5xx status.

To set up the Shortcut:

1. In the Shortcuts app, create a shortcut named "Capture episode". In its details, turn on **Show in Share Sheet** and limit the accepted input to **URLs**.
2. Add **Get Contents of URL** with the URL `https://<your-deployment>/api/capture`, method **POST**, a header `Authorization` set to `Bearer <Readwise access token>`, and a JSON request body with one text field `url` set to **Shortcut Input**.
3. Add **Get Dictionary Value** for the key `documentUrl`, then **Open URLs** (or **Show Notification** if you would rather keep listening).

Then, in Apple Podcasts, share an episode and choose "Capture episode".

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
