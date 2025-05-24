"use client"

import type React from "react"
import { useState, useRef, useEffect } from "react"
import Image from "next/image"
import {
  Upload,
  Download,
  Check,
  Copy,
  Database,
  AlertCircle,
  Search,
  AlertTriangle,
  RefreshCw,
  RotateCw,
  RotateCcw,
  Undo,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { toast } from "@/components/ui/use-toast"
import { Toaster } from "@/components/ui/toaster"
import { validateDealerNIC, type Dealer } from "@/lib/validate-dealer"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Badge } from "@/components/ui/badge"

interface ExistingImage {
  _id: string
  nic: string
  dealerName?: string
  imageUrl: string
  processedAt: string
  isManualUpload?: boolean
  isLightXProcessed?: boolean
}

export default function LightXPage() {
  const [originalImage, setOriginalImage] = useState<File | null>(null)
  const [originalImageUrl, setOriginalImageUrl] = useState<string | null>(null)
  const [processedImageUrl, setProcessedImageUrl] = useState<string | null>(null)
  const [isProcessing, setIsProcessing] = useState(false)
  const [isUploading, setIsUploading] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [nic, setNic] = useState("")
  const [cloudinaryUrl, setCloudinaryUrl] = useState<string | null>(null)
  const [isSuccess, setIsSuccess] = useState(false)
  const [resultObject, setResultObject] = useState<{
    nic: string
    imageUrl: string
    _id: string
    dealerName?: string
  } | null>(null)
  const [isValidatingNIC, setIsValidatingNIC] = useState(false)
  const [dealerInfo, setDealerInfo] = useState<Dealer | null>(null)
  const [isNICValid, setIsNICValid] = useState<boolean | null>(null)
  const [existingImage, setExistingImage] = useState<ExistingImage | null>(null)
  const [showExistingImageDialog, setShowExistingImageDialog] = useState(false)
  const [isCheckingExisting, setIsCheckingExisting] = useState(false)
  const [processingStatus, setProcessingStatus] = useState<string>("")
  const [orderId, setOrderId] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Rotation states
  const [rotation, setRotation] = useState(0)
  const [isRotating, setIsRotating] = useState(false)
  const [originalProcessedImageUrl, setOriginalProcessedImageUrl] = useState<string | null>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)

  // When processedImageUrl changes, store the original URL
  useEffect(() => {
    if (processedImageUrl && !originalProcessedImageUrl) {
      setOriginalProcessedImageUrl(processedImageUrl)
    }
  }, [processedImageUrl, originalProcessedImageUrl])

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    // Reset states
    setProcessedImageUrl(null)
    setOriginalProcessedImageUrl(null)
    setError(null)
    setCloudinaryUrl(null)
    setIsSuccess(false)
    setResultObject(null)
    setProcessingStatus("")
    setOrderId(null)
    setRotation(0)

    // Check file type
    if (!file.type.startsWith("image/")) {
      setError("Please upload an image file")
      return
    }

    // Check file size (limit to 10MB)
    if (file.size > 10 * 1024 * 1024) {
      setError("Image size should be less than 10MB")
      return
    }

    setOriginalImage(file)
    const objectUrl = URL.createObjectURL(file)
    setOriginalImageUrl(objectUrl)
  }

  // Check if an image already exists for this NIC
  const checkExistingImage = async (nicNumber: string) => {
    setIsCheckingExisting(true)
    setExistingImage(null)

    try {
      const response = await fetch(`/api/check-existing-image?nic=${encodeURIComponent(nicNumber)}`)

      if (!response.ok) {
        throw new Error("Failed to check for existing image")
      }

      const data = await response.json()

      if (data.exists) {
        setExistingImage(data.image)
        setShowExistingImageDialog(true)
        return true
      }

      return false
    } catch (err) {
      console.error("Error checking existing image:", err)
      return false
    } finally {
      setIsCheckingExisting(false)
    }
  }

  // Validate NIC when the verify button is clicked
  const handleVerifyNIC = async () => {
    if (!nic.trim()) {
      setError("Please enter a NIC number")
      return
    }

    setIsValidatingNIC(true)
    setError(null)
    setIsNICValid(null)
    setDealerInfo(null)

    try {
      const result = await validateDealerNIC(nic.trim())
      setIsNICValid(result.valid)
      setDealerInfo(result.dealer || null)

      if (!result.valid) {
        setError("Dealer not available. Please check the NIC number.")
      } else {
        // Check if this NIC already has an image
        await checkExistingImage(nic.trim())
      }
    } catch (err) {
      console.error("Error validating NIC:", err)
      setError("Failed to validate NIC. Please try again.")
      setIsNICValid(null)
      setDealerInfo(null)
    } finally {
      setIsValidatingNIC(false)
    }
  }

  // Replace the pollStatus function with this improved version
  const pollStatus = async (orderIdToCheck: string) => {
    let attempts = 0
    const maxAttempts = 30
    let timeoutId: NodeJS.Timeout | null = null

    const checkStatus = async () => {
      try {
        attempts++
        console.log(`Checking status (attempt ${attempts}/${maxAttempts})`)

        const response = await fetch("/api/lightx-status", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ orderId: orderIdToCheck }),
        })

        if (!response.ok) {
          throw new Error("Failed to check processing status")
        }

        const data = await response.json()
        console.log("Status response:", data)

        // Update status message
        setProcessingStatus(data.status || "Processing...")

        // Check if we have an output URL, regardless of status
        if (data.output) {
          console.log("Got output URL:", data.output)
          setProcessedImageUrl(data.output)
          setProcessingStatus("Processing completed! Ready to submit.")
          setIsProcessing(false)

          // Clear any pending timeout to prevent further polling
          if (timeoutId) {
            clearTimeout(timeoutId)
          }

          toast({
            title: "Processing completed",
            description: "Your image is ready! Review and click Submit to save to database.",
          })
          return // Stop polling
        }

        if (data.status === "failed") {
          throw new Error("Background removal failed")
        }

        // Continue polling if not completed and under max attempts
        if (attempts < maxAttempts) {
          timeoutId = setTimeout(checkStatus, 10000) // Check again in 10 seconds
        } else {
          throw new Error("Processing timeout - please try again")
        }
      } catch (err) {
        console.error("Status check error:", err)
        setError(err instanceof Error ? err.message : "Failed to check processing status")
        setIsProcessing(false)

        // Clear any pending timeout
        if (timeoutId) {
          clearTimeout(timeoutId)
        }
      }
    }

    // Start checking immediately
    checkStatus()
  }

  const handleRemoveBackground = async () => {
    if (!originalImage) {
      setError("Please upload an image")
      return
    }

    if (!nic.trim()) {
      setError("Please enter a NIC number")
      return
    }

    if (!isNICValid) {
      setError("Please verify the NIC number first")
      return
    }

    try {
      setError(null)

      // Step 1: Upload to Cloudinary
      setIsUploading(true)
      setProcessingStatus("Uploading to Cloudinary...")

      const formData = new FormData()
      formData.append("file", originalImage)

      const uploadResponse = await fetch("/api/upload-to-cloudinary", {
        method: "POST",
        body: formData,
      })

      if (!uploadResponse.ok) {
        const errorData = await uploadResponse.json()
        throw new Error(errorData.error || "Failed to upload image")
      }

      const uploadData = await uploadResponse.json()
      setCloudinaryUrl(uploadData.imageUrl)
      setIsUploading(false)

      // Step 2: Send to LightX API
      setIsProcessing(true)
      setProcessingStatus("Sending to LightX API...")

      const lightxResponse = await fetch("/api/lightx-remove-background", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          imageUrl: uploadData.imageUrl,
          background: "",
        }),
      })

      if (!lightxResponse.ok) {
        const errorData = await lightxResponse.json()
        throw new Error(errorData.error || "Failed to process with LightX API")
      }

      const lightxData = await lightxResponse.json()
      setOrderId(lightxData.orderId)
      setProcessingStatus("Processing with LightX...")

      console.log("Got order ID:", lightxData.orderId)

      // Step 3: Start polling for status
      pollStatus(lightxData.orderId)
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred while processing the image")
      setIsProcessing(false)
      setIsUploading(false)
      console.error(err)
    }
  }

  // Function to rotate the image
  const rotateImage = async (degrees: number) => {
    if (!processedImageUrl) return

    try {
      setIsRotating(true)
      setError(null)

      // Calculate new rotation (keep it between 0-359)
      const newRotation = (rotation + degrees + 360) % 360
      setRotation(newRotation)

      // If rotation is 0 (back to original), use the original URL
      if (newRotation === 0 && originalProcessedImageUrl) {
        setProcessedImageUrl(originalProcessedImageUrl)
        setIsRotating(false)
        return
      }

      // Create an image element to load the processed image
      const img = document.createElement("img")
      img.crossOrigin = "anonymous" // Important for CORS

      img.onload = async () => {
        // Create a canvas to draw the rotated image
        const canvas = canvasRef.current
        if (!canvas) {
          setIsRotating(false)
          return
        }

        // Set canvas dimensions based on rotation
        if (newRotation === 90 || newRotation === 270) {
          canvas.width = img.height
          canvas.height = img.width
        } else {
          canvas.width = img.width
          canvas.height = img.height
        }

        const ctx = canvas.getContext("2d")
        if (!ctx) {
          setIsRotating(false)
          return
        }

        // Clear canvas
        ctx.clearRect(0, 0, canvas.width, canvas.height)

        // Move to center of canvas
        ctx.translate(canvas.width / 2, canvas.height / 2)

        // Rotate
        ctx.rotate((newRotation * Math.PI) / 180)

        // Draw the image centered
        ctx.drawImage(img, -img.width / 2, -img.height / 2)

        // Reset transformation
        ctx.setTransform(1, 0, 0, 1, 0, 0)

        // Convert canvas to blob
        canvas.toBlob(async (blob) => {
          if (!blob) {
            setError("Failed to create image from rotation")
            setIsRotating(false)
            return
          }

          // Create a file from the blob
          const rotatedFile = new File([blob], "rotated-image.png", { type: "image/png" })

          // Upload the rotated image to Cloudinary
          const formData = new FormData()
          formData.append("file", rotatedFile)

          try {
            const uploadResponse = await fetch("/api/upload-to-cloudinary", {
              method: "POST",
              body: formData,
            })

            if (!uploadResponse.ok) {
              throw new Error("Failed to upload rotated image")
            }

            const uploadData = await uploadResponse.json()

            // Update the processed image URL with the new rotated image URL
            setProcessedImageUrl(uploadData.imageUrl)

            toast({
              title: "Image rotated",
              description: "The image has been rotated and re-uploaded.",
            })
          } catch (err) {
            setError("Failed to upload rotated image: " + (err instanceof Error ? err.message : "Unknown error"))
            console.error("Rotation upload error:", err)
          } finally {
            setIsRotating(false)
          }
        }, "image/png")
      }

      img.onerror = () => {
        setError("Failed to load image for rotation")
        setIsRotating(false)
      }

      // Start loading the image
      img.src = processedImageUrl
    } catch (err) {
      setError("Failed to rotate image: " + (err instanceof Error ? err.message : "Unknown error"))
      setIsRotating(false)
      console.error("Rotation error:", err)
    }
  }

  // Reset rotation to original
  const resetRotation = () => {
    if (originalProcessedImageUrl) {
      setRotation(0)
      setProcessedImageUrl(originalProcessedImageUrl)
    }
  }

  const handleSubmitToDatabase = async () => {
    if (!processedImageUrl || !nic.trim() || !isNICValid) {
      setError("Cannot save: missing required data")
      return
    }

    try {
      setIsSaving(true)
      setError(null)

      const saveData = {
        nic: nic.trim(),
        dealerName: dealerInfo ? dealerInfo["DEALER NAME"] : undefined,
        area: dealerInfo ? dealerInfo.AREA : undefined,
        classification: dealerInfo ? dealerInfo.CLASSIFICATION : undefined,
        originalImageUrl: cloudinaryUrl,
        processedImageUrl: processedImageUrl,
      }

      const response = await fetch("/api/save-lightx-result", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(saveData),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || "Failed to save result")
      }

      const data = await response.json()
      const result = {
        nic: data.nic,
        imageUrl: data.imageUrl,
        _id: data._id,
        dealerName: dealerInfo ? dealerInfo["DEALER NAME"] : undefined,
      }

      console.log(result)
      setResultObject(result)
      setIsSuccess(true)

      toast({
        title: "Submitted successfully",
        description: "The processed image has been saved to the database.",
      })
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save result")
      console.error(err)
    } finally {
      setIsSaving(false)
    }
  }

  const handleDownload = () => {
    if (!processedImageUrl) return

    const link = document.createElement("a")
    link.href = processedImageUrl
    link.download = `${nic}-lightx-removed-background.png`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  const handleCopyResult = () => {
    if (!resultObject) return

    navigator.clipboard.writeText(JSON.stringify(resultObject, null, 2))
    toast({
      title: "Copied to clipboard",
      description: "The result object has been copied to your clipboard.",
    })
  }

  const handleReset = () => {
    if (originalImageUrl) {
      URL.revokeObjectURL(originalImageUrl)
    }

    setOriginalImage(null)
    setOriginalImageUrl(null)
    setProcessedImageUrl(null)
    setOriginalProcessedImageUrl(null)
    setError(null)
    setCloudinaryUrl(null)
    setIsSuccess(false)
    setResultObject(null)
    setProcessingStatus("")
    setOrderId(null)
    setIsProcessing(false)
    setIsUploading(false)
    setRotation(0)

    if (fileInputRef.current) {
      fileInputRef.current.value = ""
    }
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString()
  }

  return (
    <>
      <main className="min-h-screen p-4 md:p-8 bg-gray-50">
        <div className="max-w-4xl mx-auto">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                LightX API Background Removal
                <Badge variant="outline" className="bg-blue-100 text-blue-800 border-blue-200">
                  Cloud Processing
                </Badge>
              </CardTitle>
              <CardDescription>
                Use the LightX API as a backup solution for background removal. Images are uploaded to Cloudinary first,
                then processed by LightX API.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div>
                <Label htmlFor="nic" className="text-sm font-medium">
                  NIC Number
                </Label>
                <div className="mt-1 flex gap-2">
                  <div className="relative flex-1">
                    <Input
                      id="nic"
                      value={nic}
                      onChange={(e) => setNic(e.target.value)}
                      placeholder="Enter NIC number"
                      className={`${
                        isNICValid === true
                          ? "border-green-500 focus-visible:ring-green-500"
                          : isNICValid === false
                            ? "border-red-500 focus-visible:ring-red-500"
                            : ""
                      }`}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault()
                          handleVerifyNIC()
                        }
                      }}
                    />
                    {isNICValid === true && !isValidatingNIC && (
                      <div className="absolute right-3 top-1/2 -translate-y-1/2">
                        <Check className="h-4 w-4 text-green-500" />
                      </div>
                    )}
                    {isNICValid === false && !isValidatingNIC && (
                      <div className="absolute right-3 top-1/2 -translate-y-1/2">
                        <AlertCircle className="h-4 w-4 text-red-500" />
                      </div>
                    )}
                  </div>
                  <Button
                    onClick={handleVerifyNIC}
                    disabled={isValidatingNIC || isCheckingExisting || !nic.trim()}
                    className="whitespace-nowrap"
                  >
                    {isValidatingNIC || isCheckingExisting ? (
                      <div className="flex items-center">
                        <div className="animate-spin h-4 w-4 border-2 border-white border-t-transparent rounded-full mr-2"></div>
                        {isValidatingNIC ? "Verifying..." : "Checking..."}
                      </div>
                    ) : (
                      <>
                        <Search className="h-4 w-4 mr-2" />
                        Verify NIC
                      </>
                    )}
                  </Button>
                </div>
              </div>

              {dealerInfo && (
                <div className="p-4 bg-green-50 rounded-md border border-green-200">
                  <h3 className="font-medium text-green-800">Dealer Information</h3>
                  <div className="mt-2 grid grid-cols-1 md:grid-cols-2 gap-2 text-sm">
                    <div>
                      <span className="font-medium">Name:</span> {dealerInfo["DEALER NAME"]}
                    </div>
                    <div>
                      <span className="font-medium">Area:</span> {dealerInfo.AREA}
                    </div>
                    <div>
                      <span className="font-medium">Classification:</span> {dealerInfo.CLASSIFICATION}
                    </div>
                    <div>
                      <span className="font-medium">Outlet:</span> {dealerInfo["OUTLET NAME"]}
                    </div>
                  </div>
                </div>
              )}

              {existingImage && !showExistingImageDialog && (
                <Alert className="bg-amber-50 border-amber-200">
                  <AlertTriangle className="h-4 w-4 text-amber-600" />
                  <AlertDescription className="text-amber-600 flex items-center justify-between w-full">
                    <span>This dealer already has an existing image in the database.</span>
                    <Button
                      variant="outline"
                      size="sm"
                      className="border-amber-200 text-amber-600 hover:bg-amber-100"
                      onClick={() => setShowExistingImageDialog(true)}
                    >
                      View Existing
                    </Button>
                  </AlertDescription>
                </Alert>
              )}

              <div>
                <Label className="text-sm font-medium">Upload Image</Label>
                {!originalImageUrl ? (
                  <div
                    className={`mt-1 border-2 border-dashed border-gray-300 rounded-lg p-8 text-center cursor-pointer hover:bg-gray-50 transition-colors ${
                      !isNICValid && nic.trim() ? "opacity-50 pointer-events-none" : ""
                    }`}
                    onClick={() => {
                      if (isNICValid || !nic.trim()) {
                        fileInputRef.current?.click()
                      }
                    }}
                  >
                    <div className="flex flex-col items-center justify-center gap-3">
                      <div className="bg-gray-100 p-3 rounded-full">
                        <Upload className="h-6 w-6 text-gray-500" />
                      </div>
                      <div>
                        <p className="font-medium">Click to upload an image</p>
                        <p className="text-xs text-gray-400 mt-1">PNG, JPG, WEBP up to 10MB</p>
                      </div>
                      <input
                        type="file"
                        ref={fileInputRef}
                        onChange={handleFileChange}
                        accept="image/*"
                        className="hidden"
                      />
                    </div>
                  </div>
                ) : (
                  <div className="mt-1">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {/* Original Image */}
                      <div>
                        <h3 className="text-sm font-medium mb-2">Original Image</h3>
                        <div className="relative aspect-video bg-gray-100 rounded-lg overflow-hidden">
                          <Image
                            src={originalImageUrl || "/placeholder.svg"}
                            alt="Original image"
                            fill
                            className="object-contain"
                          />
                        </div>
                      </div>

                      {/* Processed Image */}
                      <div>
                        <h3 className="text-sm font-medium mb-2">
                          Processed Image
                          {processedImageUrl && (
                            <Badge variant="outline" className="ml-2 bg-blue-100 text-blue-800 border-blue-200">
                              LightX API
                            </Badge>
                          )}
                        </h3>
                        <div className="relative aspect-video bg-[url('/checkerboard.png')] rounded-lg overflow-hidden">
                          {processedImageUrl ? (
                            <Image
                              src={processedImageUrl || "/placeholder.svg"}
                              alt="Processed image"
                              fill
                              className="object-contain"
                              style={{ transform: `rotate(${rotation}deg)` }}
                            />
                          ) : (
                            <div className="flex items-center justify-center h-full">
                              <p className="text-gray-500 text-sm">
                                {isProcessing || isUploading ? processingStatus : "No processed image yet"}
                              </p>
                            </div>
                          )}
                        </div>

                        {/* Rotation Controls */}
                        {processedImageUrl && !isSuccess && (
                          <div className="flex justify-center mt-2 gap-2">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => rotateImage(-90)}
                              disabled={isRotating}
                              title="Rotate counter-clockwise"
                            >
                              <RotateCcw className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => rotateImage(90)}
                              disabled={isRotating}
                              title="Rotate clockwise"
                            >
                              <RotateCw className="h-4 w-4" />
                            </Button>
                            {rotation !== 0 && (
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={resetRotation}
                                disabled={isRotating}
                                title="Reset rotation"
                              >
                                <Undo className="h-4 w-4" />
                              </Button>
                            )}
                            {isRotating && (
                              <span className="text-xs text-gray-500 flex items-center">
                                <RefreshCw className="h-3 w-3 animate-spin mr-1" />
                                Rotating...
                              </span>
                            )}
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="flex justify-end mt-2 gap-2">
                      <Button variant="outline" size="sm" onClick={handleReset}>
                        Change Image
                      </Button>
                    </div>
                  </div>
                )}
              </div>

              {error && (
                <Alert className="bg-red-50 border-red-200">
                  <AlertCircle className="h-4 w-4 text-red-600" />
                  <AlertDescription className="text-red-600">{error}</AlertDescription>
                </Alert>
              )}

              {/* Processing Status */}
              {(isProcessing || isUploading) && (
                <div className="flex justify-center">
                  <div className="animate-pulse flex items-center gap-2">
                    <RefreshCw className="h-4 w-4 animate-spin text-blue-500" />
                    <span className="text-sm text-gray-500">{processingStatus}</span>
                  </div>
                </div>
              )}

              {/* Ready to Submit Alert */}
              {processedImageUrl && !isSuccess && !isProcessing && !isRotating && (
                <Alert className="bg-blue-50 border-blue-200">
                  <Check className="h-4 w-4 text-blue-600" />
                  <AlertDescription className="text-blue-600">
                    Image processing completed! You can rotate the image if needed, then click Submit to save to
                    database.
                  </AlertDescription>
                </Alert>
              )}

              {isSuccess && (
                <Alert className="bg-green-50 border-green-200">
                  <Check className="h-4 w-4 text-green-600" />
                  <AlertDescription className="text-green-600 flex items-center">
                    <span>Image submitted and saved to database successfully!</span>
                    <Database className="h-4 w-4 ml-2" />
                  </AlertDescription>
                </Alert>
              )}

              {resultObject && (
                <div className="p-4 bg-gray-50 rounded-md">
                  <div className="flex justify-between items-center mb-2">
                    <p className="text-sm font-medium">Result Object:</p>
                    <Button variant="ghost" size="sm" onClick={handleCopyResult}>
                      <Copy className="h-4 w-4 mr-1" /> Copy
                    </Button>
                  </div>
                  <pre className="text-xs bg-gray-100 p-3 rounded overflow-auto max-h-32">
                    {JSON.stringify(resultObject, null, 2)}
                  </pre>
                </div>
              )}

              <div className="flex justify-end gap-3">
                <Button variant="outline" onClick={handleReset}>
                  Reset
                </Button>

                {/* Process Button - only show when no processed image */}
                {!processedImageUrl && !isProcessing && !isUploading && (
                  <Button
                    onClick={handleRemoveBackground}
                    disabled={isProcessing || isUploading || !nic.trim() || !isNICValid}
                  >
                    Process with LightX API
                  </Button>
                )}

                {/* Download Button - show when processed image is ready */}
                {processedImageUrl && (
                  <Button onClick={handleDownload} variant="outline">
                    <Download className="h-4 w-4 mr-2" />
                    Download
                  </Button>
                )}

                {/* Submit Button - show when processed image is ready but not yet saved */}
                {processedImageUrl && !isSuccess && !isRotating && (
                  <Button onClick={handleSubmitToDatabase} disabled={isSaving || isRotating}>
                    {isSaving ? (
                      <div className="flex items-center">
                        <div className="animate-spin h-4 w-4 border-2 border-white border-t-transparent rounded-full mr-2"></div>
                        Submitting...
                      </div>
                    ) : (
                      <>
                        <Database className="h-4 w-4 mr-2" />
                        Submit to Database
                      </>
                    )}
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>

          <div className="mt-4 text-sm text-gray-500 text-center">
            <p>
              This tool uses the LightX API as a backup solution for background removal. The image is first uploaded to
              Cloudinary, then processed by LightX API, and finally saved to MongoDB.
            </p>
          </div>
        </div>
        <Toaster />
      </main>

      {/* Hidden canvas for image rotation */}
      <canvas ref={canvasRef} style={{ display: "none" }} />

      {/* Dialog for showing existing image */}
      <Dialog open={showExistingImageDialog} onOpenChange={setShowExistingImageDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Existing Image Found</DialogTitle>
            <DialogDescription>
              This dealer already has an image in the database. You can view it below or proceed with uploading a new
              image.
            </DialogDescription>
          </DialogHeader>

          {existingImage && (
            <div className="space-y-4">
              <div className="relative aspect-video bg-[url('/checkerboard.png')] rounded-lg overflow-hidden">
                <Image
                  src={existingImage.imageUrl || "/placeholder.svg"}
                  alt={`Existing image for NIC ${existingImage.nic}`}
                  fill
                  className="object-contain"
                />
              </div>

              <div className="text-sm space-y-2">
                <p>
                  <span className="font-medium">NIC:</span> {existingImage.nic}
                </p>
                {existingImage.dealerName && (
                  <p>
                    <span className="font-medium">Dealer:</span> {existingImage.dealerName}
                  </p>
                )}
                <p>
                  <span className="font-medium">Uploaded:</span> {formatDate(existingImage.processedAt)}
                </p>
                {existingImage.isManualUpload && (
                  <p className="text-amber-600">
                    <span className="font-medium">Note:</span> This image was manually uploaded
                  </p>
                )}
                {existingImage.isLightXProcessed && (
                  <p className="text-blue-600">
                    <span className="font-medium">Note:</span> This image was processed with LightX API
                  </p>
                )}
              </div>
            </div>
          )}

          <DialogFooter className="flex flex-col sm:flex-row sm:justify-between gap-2">
            <Button
              variant="outline"
              onClick={() => {
                if (existingImage) {
                  window.open(existingImage.imageUrl, "_blank")
                }
              }}
            >
              Open Full Size
            </Button>
            <div className="flex gap-2">
              <Button
                variant="secondary"
                onClick={() => {
                  setShowExistingImageDialog(false)
                  window.location.href = "/history?nic=" + encodeURIComponent(nic)
                }}
              >
                View in History
              </Button>
              <Button onClick={() => setShowExistingImageDialog(false)}>Continue Anyway</Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
