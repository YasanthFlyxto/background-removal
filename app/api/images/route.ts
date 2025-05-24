import { type NextRequest, NextResponse } from "next/server"
import clientPromise from "@/lib/mongodb"

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const nic = searchParams.get("nic")

    const client = await clientPromise
    const db = client.db(process.env.MONGODB_DB || "background-removal")
    const collection = db.collection("processed-images")

    let query = {}
    if (nic) {
      query = { nic }
    }

    const images = await collection.find(query).sort({ processedAt: -1 }).limit(100).toArray()

    return NextResponse.json(images)
  } catch (error) {
    console.error("Error fetching images:", error)
    return NextResponse.json({ error: "Failed to fetch images" }, { status: 500 })
  }
}
