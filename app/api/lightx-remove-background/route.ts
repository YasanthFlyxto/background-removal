import { type NextRequest, NextResponse } from "next/server"

export async function POST(request: NextRequest) {
  try {
    const { imageUrl, background } = await request.json()
    const apiKey = process.env.LIGHTX_API_KEY

    if (!apiKey) {
      return NextResponse.json({ error: "LightX API key is not configured" }, { status: 500 })
    }

    console.log("Making background removal request for image:", imageUrl)

    const response = await fetch("https://api.lightxeditor.com/external/api/v1/remove-background", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
      },
      body: JSON.stringify({ imageUrl, background }),
    })

    const data = await response.json()
    console.log("LightX API response:", data)

    // Extract and return orderId from the response
    if (data.body && data.body.orderId) {
      return NextResponse.json({ orderId: data.body.orderId })
    } else {
      console.error("Invalid API response:", data)
      return NextResponse.json({ error: "Failed to get orderId from API" }, { status: 400 })
    }
  } catch (error) {
    console.error("Background removal API error:", error)
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unknown error" }, { status: 500 })
  }
}
