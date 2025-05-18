import { type NextRequest, NextResponse } from "next/server"
import { spawn } from "child_process"
import fs from "fs"
import path from "path"
import os from "os"
import { v4 as uuidv4 } from "uuid"

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData()
    const file = formData.get("file") as File

    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 })
    }

    // Create temporary directory
    const tempDir = path.join(os.tmpdir(), "bg-removal-" + uuidv4())
    fs.mkdirSync(tempDir, { recursive: true })

    // Save the uploaded file
    const buffer = Buffer.from(await file.arrayBuffer())
    const inputPath = path.join(tempDir, "input.png")
    fs.writeFileSync(inputPath, buffer)

    // Output path for the processed image
    const outputPath = path.join(tempDir, "output.png")

    // Process the image with U2Net
    const result = await processImageWithU2Net(inputPath, outputPath)

    if (result.success) {
      // Read the processed image
      const processedImageBuffer = fs.readFileSync(outputPath)

      // Clean up temporary files
      fs.rmSync(tempDir, { recursive: true, force: true })

      // Return the processed image
      return new NextResponse(processedImageBuffer, {
        headers: {
          "Content-Type": "image/png",
          "Cache-Control": "public, max-age=31536000, immutable",
        },
      })
    } else {
      // Clean up temporary files
      fs.rmSync(tempDir, { recursive: true, force: true })

      return NextResponse.json({ error: result.error || "Failed to process image" }, { status: 500 })
    }
  } catch (error) {
    console.error("Error in removeBackground:", error)
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
