import { type NextRequest, NextResponse } from "next/server"
import { v2 as cloudinary } from "cloudinary"
import fs from "fs"
import path from "path"
import os from "os"
import { v4 as uuidv4 } from "uuid"

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

    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 })
    }

    // Create temporary directory
    const tempDir = path.join(os.tmpdir(), "cloudinary-upload-" + uuidv4())
    fs.mkdirSync(tempDir, { recursive: true })

    // Save the uploaded file
    const buffer = Buffer.from(await file.arrayBuffer())
    const filePath = path.join(tempDir, "image.png")
    fs.writeFileSync(filePath, buffer)

    try {
      // Upload to Cloudinary
      const cloudinaryResult = await uploadToCloudinary(filePath)

      // Clean up temporary files
      fs.rmSync(tempDir, { recursive: true, force: true })

      return NextResponse.json({
        imageUrl: cloudinaryResult.secure_url,
        publicId: cloudinaryResult.public_id,
      })
    } catch (uploadError) {
      console.error("Upload error:", uploadError)

      // Clean up temporary files
      fs.rmSync(tempDir, { recursive: true, force: true })

      return NextResponse.json({ error: "Failed to upload image to Cloudinary" }, { status: 500 })
    }
  } catch (error) {
    console.error("Error in upload:", error)
    return NextResponse.json({ error: "An unexpected error occurred" }, { status: 500 })
  }
}

// Upload the image to Cloudinary
async function uploadToCloudinary(imagePath: string): Promise<any> {
  return new Promise((resolve, reject) => {
    const uploadOptions: any = {
      folder: "lightx-temp",
      public_id: `temp-${Date.now()}`,
      overwrite: true,
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
