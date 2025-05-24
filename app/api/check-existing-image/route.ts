import { type NextRequest, NextResponse } from "next/server"
import clientPromise from "@/lib/mongodb"

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const nic = searchParams.get("nic")

    if (!nic) {
      return NextResponse.json({ error: "NIC number is required" }, { status: 400 })
    }

    const client = await clientPromise
    const db = client.db(process.env.MONGODB_DB || "background-removal")
    const collection = db.collection("processed-images")

    // Find the most recent image for this NIC
    const existingImage = await collection.find({ nic }).sort({ processedAt: -1 }).limit(1).toArray()

    if (existingImage.length > 0) {
      return NextResponse.json({
        exists: true,
        image: existingImage[0],
      })
    } else {
      return NextResponse.json({
        exists: false,
      })
    }
  } catch (error) {
    console.error("Error checking existing image:", error)
    return NextResponse.json({ error: "Failed to check for existing image" }, { status: 500 })
  }
}
