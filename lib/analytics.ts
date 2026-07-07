import { track } from "@vercel/analytics/server"

type AnalyticsProperty = string | number | boolean | null

export async function trackServerEvent(
  eventName: string,
  properties: Record<string, AnalyticsProperty>,
  request?: Request,
): Promise<void> {
  try {
    await track(eventName, properties, request ? { request: { headers: request.headers } } : undefined)
  } catch (error) {
    console.error("Failed to track server analytics event:", error)
  }
}
