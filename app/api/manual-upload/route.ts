import { type NextRequest, NextResponse } from "next/server"
import fs from "fs"
import path from "path"
import os from "os"
import { v4 as uuidv4 } from "uuid"
import { v2 as cloudinary } from "cloudinary"
import clientPromise from "@/lib/mongodb"

// Configure Cloudinary with server-side environment variables
cloudinary.config({
  cloud_name: process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME,
  api_key: process.env.NEXT_PUBLIC_CLOUDINARY_API_KEY,
  api_secret: process.env.NEXT_PUBLIC_CLOUDINARY_API_SECRET,
})

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData()
    const file = formData.get("file") as File
    const nic = formData.get("nic") as string
    const dealerName = (formData.get("dealerName") as string) || undefined
    const area = (formData.get("area") as string) || undefined
    const classification = (formData.get("classification") as string) || undefined

    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 })
    }

    if (!nic) {
      return NextResponse.json({ error: "NIC number is required" }, { status: 400 })
    }

    // Validate file type - only allow PNG
    if (!file.type.includes("png")) {
      return NextResponse.json({ error: "Only PNG images with transparency are allowed" }, { status: 400 })
    }

    // Create temporary directory
    const tempDir = path.join(os.tmpdir(), "manual-upload-" + uuidv4())
    fs.mkdirSync(tempDir, { recursive: true })

    // Save the uploaded file
    const buffer = Buffer.from(await file.arrayBuffer())
    const filePath = path.join(tempDir, "image.png")
    fs.writeFileSync(filePath, buffer)

    try {
      // Upload to Cloudinary
      const cloudinaryResult = await uploadToCloudinary(filePath, nic)

      // Store in MongoDB
      const dbResult = await saveToMongoDB({
        nic,
        dealerName,
        area,
        classification,
        imageUrl: cloudinaryResult.secure_url,
        cloudinaryPublicId: cloudinaryResult.public_id,
        processedAt: new Date(),
        isManualUpload: true,
      })

      // Clean up temporary files
      fs.rmSync(tempDir, { recursive: true, force: true })

      // Return the NIC, image URL, and MongoDB ID
      return NextResponse.json({
        nic: nic,
        dealerName,
        imageUrl: cloudinaryResult.secure_url,
        _id: dbResult.insertedId,
      })
    } catch (uploadError) {
      console.error("Upload error:", uploadError)

      // Clean up temporary files
      fs.rmSync(tempDir, { recursive: true, force: true })

      return NextResponse.json({ error: "Failed to upload or save image data" }, { status: 500 })
    }
  } catch (error) {
    console.error("Error in manual upload:", error)
    return NextResponse.json({ error: "An unexpected error occurred" }, { status: 500 })
  }
}

// Upload the image to Cloudinary
async function uploadToCloudinary(imagePath: string, nic: string): Promise<any> {
  return new Promise((resolve, reject) => {
    // Use the upload preset if available
    const uploadOptions: any = {
      folder: "background-removal-manual",
      public_id: `${nic}-manual-${Date.now()}`,
      overwrite: true,
    }

    // Add upload preset if available
    if (process.env.NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET) {
      uploadOptions.upload_preset = process.env.NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET
    }

    cloudinary.uploader.upload(imagePath, uploadOptions, (error, result) => {
      if (error) {
        reject(error)
      } else {
        resolve(result)
      }
    })
  })
}

// Save the image data to MongoDB
async function saveToMongoDB(data: {
  nic: string
  dealerName?: string
  area?: string
  classification?: string
  imageUrl: string
  cloudinaryPublicId: string
  processedAt: Date
  isManualUpload: boolean
}) {
  const client = await clientPromise
  const db = client.db(process.env.MONGODB_DB || "background-removal")
  const collection = db.collection("processed-images")

  return await collection.insertOne(data)
}
