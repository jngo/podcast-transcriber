---
name: Podcast Transcriber
last_updated: 2026-07-03
---

# Podcast Transcriber Strategy

## Target problem

People often hear valuable podcast moments while walking, commuting, or otherwise away from their desk, and capturing those ideas currently requires stopping, rewinding, and manually transcribing enough context before the thought disappears.

## Our approach

Podcast Transcriber reduces the friction between hearing a podcast moment and having useful source material captured in the listener's existing note-taking and review system. The current product does this through full-episode transcripts and Readwise Reader, while the broader strategy is to make podcast ideas flow into the systems where people already capture thoughts.

## Who it's for

**Primary:** Knowledge workers and personal-knowledge-management users - They're hiring Podcast Transcriber to turn podcast moments into reusable, highlightable source material so good ideas do not disappear while they're away from their desk.

## Key metrics

- **Successful episode transcriptions** - Submitted Apple Podcasts URLs that produce a usable transcript; measured with `episode_transcribe` and `episode_transcribe_success` in Vercel Analytics.
- **Readwise save rate** - Share of successful transcripts saved to Readwise Reader; measured with `transcript_save` and `transcript_save_success` in Vercel Analytics.
- **Repeat use** - Users who transcribe more than one podcast, or successful transcriptions per returning user; measurement not yet defined.
- **Capture usefulness** - Whether saved transcripts become highlights, notes, or later references in the user's knowledge workflow; measurement not yet defined.
- **Capture friction** - Time or number of steps from hearing a podcast moment to having useful source material captured; measurement not yet defined.

## Tracks

### Frictionless capture

Reduce the number of steps between hearing a podcast moment and having useful source text in the user's capture system.

_Why it serves the approach:_ Friction is the core problem: the product succeeds when capturing a moment no longer interrupts listening or movement.

### Moment retrieval

Make it easier to find the specific moment inside the transcript, instead of saving a full episode and manually searching later.

_Why it serves the approach:_ A transcript only becomes valuable when the user can quickly get back to the quote or idea that mattered.

### Source coverage

Expand beyond Apple Podcasts when the project moves past the current personal workflow, so the product works wherever the user actually listens.

_Why it serves the approach:_ The capture workflow should follow the listener's real habits rather than forcing all useful audio through one platform.

### Destination integrations

Support additional places where users keep ideas, while keeping Readwise Reader as the current workflow anchor.

_Why it serves the approach:_ The strategy depends on integrating with existing knowledge systems instead of becoming another place to manage notes.

## Not working on

- Current work stays focused on the user's own capture workflow: Apple Podcasts transcripts saved to Readwise Reader.
- Broader source support, additional save destinations, AI summaries, and transcript chat are strategic options, not current scope.
- The product should not become a general podcast research suite unless that directly reduces capture friction.

## Marketing

**One-liner:** Reduce the friction between hearing a podcast moment and capturing useful source material.

**Key message:** Podcast Transcriber is for listeners who use podcasts as part of a knowledge workflow. It turns podcast audio into text that can be highlighted, reviewed, and connected to existing notes.
