import { type NextRequest, NextResponse } from "next/server"
import clientPromise from "@/lib/mongodb"

export async function POST(request: NextRequest) {
  try {
    const data = await request.json()
    const { nic, dealerName, area, classification, originalImageUrl, processedImageUrl } = data

    if (!nic || !processedImageUrl) {
      return NextResponse.json({ error: "NIC and processed image URL are required" }, { status: 400 })
    }

    // Save to MongoDB
    const dbResult = await saveToMongoDB({
      nic,
      dealerName,
      area,
      classification,
      imageUrl: processedImageUrl,
      originalImageUrl,
      cloudinaryPublicId: `u2net-${Date.now()}`, // We don't have the actual public ID
      processedAt: new Date(),
      isU2NetProcessed: true,
    })

    return NextResponse.json({
      nic: nic,
      dealerName,
      imageUrl: processedImageUrl,
      _id: dbResult.insertedId,
    })
  } catch (error) {
    console.error("Error saving to MongoDB:", error)
    return NextResponse.json({ error: "Failed to save result" }, { status: 500 })
  }
}

// Save the image data to MongoDB
async function saveToMongoDB(data: {
  nic: string
  dealerName?: string
  area?: string
  classification?: string
  imageUrl: string
  originalImageUrl?: string
  cloudinaryPublicId: string
  processedAt: Date
  isU2NetProcessed: boolean
}) {
  const client = await clientPromise
  const db = client.db(process.env.MONGODB_DB || "background-removal")
  const collection = db.collection("processed-images")

  return await collection.insertOne(data)
}
