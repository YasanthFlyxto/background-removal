import { type NextRequest, NextResponse } from "next/server"

export async function POST(request: NextRequest) {
  try {
    const { orderId } = await request.json()
    console.log("Received orderId:", orderId)

    const apiKey = process.env.LIGHTX_API_KEY
    if (!apiKey) {
      console.error("API key is missing")
      return NextResponse.json({ error: "API key is not configured" }, { status: 500 })
    }

    console.log("Making request to LightX API...")

    const response = await fetch("https://api.lightxeditor.com/external/api/v1/order-status", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
      },
      body: JSON.stringify({ orderId }),
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error("API Error Response:", errorText)
      return NextResponse.json(
        {
          error: `API responded with status ${response.status}`,
          details: errorText,
        },
        { status: response.status },
      )
    }

    const data = await response.json()
    console.log("LightX API Response Data:", data)

    if (data.body) {
      return NextResponse.json({
        status: data.body.status,
        output: data.body.output || null,
        message: data.message,
      })
    } else {
      console.error("Invalid response structure:", data)
      return NextResponse.json(
        {
          error: "Invalid response structure from API",
          details: data,
        },
        { status: 400 },
      )
    }
  } catch (error) {
    console.error("Background status check error:", error)
    return NextResponse.json(
      {
        error: "Internal Server Error",
        message: error instanceof Error ? error.message : "Unknown error",
        stack: process.env.NODE_ENV === "development" && error instanceof Error ? error.stack : undefined,
      },
      { status: 500 },
    )
  }
}
