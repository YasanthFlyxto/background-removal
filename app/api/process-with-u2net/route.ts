import { type NextRequest, NextResponse } from "next/server"
import fs from "fs"
import path from "path"
import os from "os"
import { v4 as uuidv4 } from "uuid"
import { spawn } from "child_process"
import { v2 as cloudinary } from "cloudinary"

// Configure Cloudinary with server-side environment variables
cloudinary.config({
  cloud_name: process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME,
  api_key: process.env.NEXT_PUBLIC_CLOUDINARY_API_KEY,
  api_secret: process.env.NEXT_PUBLIC_CLOUDINARY_API_SECRET,
})

export async function POST(request: NextRequest) {
  try {
    const { imageUrl } = await request.json()

    if (!imageUrl) {
      return NextResponse.json({ error: "No image URL provided" }, { status: 400 })
    }

    // Create temporary directory
    const tempDir = path.join(os.tmpdir(), "bg-removal-" + uuidv4())
    fs.mkdirSync(tempDir, { recursive: true })

    // Download the image from the URL
    const response = await fetch(imageUrl)
    if (!response.ok) {
      throw new Error(`Failed to download image: ${response.status} ${response.statusText}`)
    }

    const buffer = Buffer.from(await response.arrayBuffer())
    const inputPath = path.join(tempDir, "input.png")
    fs.writeFileSync(inputPath, buffer)

    // Output path for the processed image
    const outputPath = path.join(tempDir, "output.png")

    // Process the image with U2Net
    const result = await processImageWithU2Net(inputPath, outputPath)

    if (result.success) {
      try {
        // Upload to Cloudinary
        const cloudinaryResult = await uploadToCloudinary(outputPath)

        // Clean up temporary files
        fs.rmSync(tempDir, { recursive: true, force: true })

        // Return the processed image URL
        return NextResponse.json({
          processedImageUrl: cloudinaryResult.secure_url,
          cloudinaryPublicId: cloudinaryResult.public_id,
        })
      } catch (uploadError) {
        console.error("Upload error:", uploadError)

        // Clean up temporary files
        fs.rmSync(tempDir, { recursive: true, force: true })

        return NextResponse.json({ error: "Failed to upload processed image" }, { status: 500 })
      }
    } else {
      // Clean up temporary files
      fs.rmSync(tempDir, { recursive: true, force: true })

      return NextResponse.json({ error: result.error || "Failed to process image" }, { status: 500 })
    }
  } catch (error) {
    console.error("Error in processWithU2Net:", error)
    return NextResponse.json({ error: "An unexpected error occurred" }, { status: 500 })
  }
}

// This function calls the Python script with the U2Net model
async function processImageWithU2Net(
  inputPath: string,
  outputPath: string,
): Promise<{ success: boolean; error?: string }> {
  return new Promise((resolve) => {
    // Path to the Python script that uses U2Net
    const pythonScript = path.join(process.cwd(), "python", "remove_bg.py")

    // Run the Python script with the U2Net model
    const pythonProcess = spawn("python", [pythonScript, inputPath, outputPath])

    let errorOutput = ""

    pythonProcess.stderr.on("data", (data) => {
      errorOutput += data.toString()
      console.error(`Python error: ${data}`)
    })

    pythonProcess.on("close", (code) => {
      if (code === 0 && fs.existsSync(outputPath)) {
        resolve({ success: true })
      } else {
        resolve({
          success: false,
          error: errorOutput || `Process exited with code ${code}`,
        })
      }
    })
  })
}

// Upload the processed image to Cloudinary
async function uploadToCloudinary(imagePath: string): Promise<any> {
  return new Promise((resolve, reject) => {
    const uploadOptions: any = {
      folder: "background-removal-preview",
      public_id: `preview-${Date.now()}`,
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
