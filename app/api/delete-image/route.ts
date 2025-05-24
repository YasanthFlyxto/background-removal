import { type NextRequest, NextResponse } from "next/server"
import { v2 as cloudinary } from "cloudinary"
import clientPromise from "@/lib/mongodb"
import { ObjectId } from "mongodb"

// Configure Cloudinary with server-side environment variables
cloudinary.config({
  cloud_name: process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME,
  api_key: process.env.NEXT_PUBLIC_CLOUDINARY_API_KEY,
  api_secret: process.env.NEXT_PUBLIC_CLOUDINARY_API_SECRET,
})

export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const id = searchParams.get("id")

    if (!id) {
      return NextResponse.json({ error: "Image ID is required" }, { status: 400 })
    }

    const client = await clientPromise
    const db = client.db(process.env.MONGODB_DB || "background-removal")
    const collection = db.collection("processed-images")

    // Find the image first to get the Cloudinary public ID
    const image = await collection.findOne({ _id: new ObjectId(id) })

    if (!image) {
      return NextResponse.json({ error: "Image not found" }, { status: 404 })
    }

    // Delete from Cloudinary if we have the public ID
    if (image.cloudinaryPublicId) {
      try {
        await new Promise<void>((resolve, reject) => {
          cloudinary.uploader.destroy(image.cloudinaryPublicId, (error, result) => {
            if (error) {
              console.error("Error deleting from Cloudinary:", error)
              // We'll continue even if Cloudinary deletion fails
              resolve()
            } else {
              console.log("Deleted from Cloudinary:", result)
              resolve()
            }
          })
        })
      } catch (cloudinaryError) {
        console.error("Failed to delete from Cloudinary:", cloudinaryError)
        // Continue with MongoDB deletion even if Cloudinary fails
      }
    }

    // Delete from MongoDB
    const result = await collection.deleteOne({ _id: new ObjectId(id) })

    if (result.deletedCount === 0) {
      return NextResponse.json({ error: "Failed to delete image" }, { status: 500 })
    }

    return NextResponse.json({ success: true, message: "Image deleted successfully" })
  } catch (error) {
    console.error("Error deleting image:", error)
    return NextResponse.json({ error: "An unexpected error occurred" }, { status: 500 })
  }
}
