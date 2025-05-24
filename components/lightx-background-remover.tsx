"use client"

import type React from "react"
import { useState, useRef } from "react"
import Image from "next/image"
import {
  Upload,
  Download,
  Trash2,
  Check,
  Copy,
  Database,
  AlertCircle,
  Search,
  AlertTriangle,
  Save,
  RefreshCw,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { toast } from "@/components/ui/use-toast"
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

export function LightXBackgroundRemover() {
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

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    // Reset states
    setProcessedImageUrl(null)
    setError(null)
    setCloudinaryUrl(null)
    setIsSuccess(false)
    setResultObject(null)
    setProcessingStatus("")
    setOrderId(null)

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

  // Poll for processing status
  const pollStatus = async (orderIdToCheck: string) => {
    const maxAttempts = 30 // Maximum 5 minutes (30 * 10 seconds)
    let attempts = 0

    const checkStatus = async (): Promise<void> => {
      try {
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
        setProcessingStatus(data.status || "Processing...")

        if (data.status === "completed" && data.output) {
          setProcessedImageUrl(data.output)
          setProcessingStatus("Completed!")
          setIsProcessing(false)
          return
        }

        if (data.status === "failed") {
          throw new Error("Background removal failed")
        }

        attempts++
        if (attempts < maxAttempts) {
          setTimeout(checkStatus, 10000) // Check every 10 seconds
        } else {
          throw new Error("Processing timeout - please try again")
        }
      } catch (err) {
        console.error("Status check error:", err)
        setError(err instanceof Error ? err.message : "Failed to check processing status")
        setIsProcessing(false)
      }
    }

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
      setIsUploading(true)
      setError(null)
      setProcessingStatus("Uploading to Cloudinary...")

      // First upload to Cloudinary
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

      // Now send to LightX API
      setIsProcessing(true)
      setProcessingStatus("Sending to LightX API...")

      const lightxResponse = await fetch("/api/lightx-remove-background", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          imageUrl: uploadData.imageUrl,
          background: "transparent",
        }),
      })

      if (!lightxResponse.ok) {
        const errorData = await lightxResponse.json()
        throw new Error(errorData.error || "Failed to process with LightX API")
      }

      const lightxData = await lightxResponse.json()
      setOrderId(lightxData.orderId)
      setProcessingStatus("Processing with LightX...")

      // Start polling for status
      pollStatus(lightxData.orderId)
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred while processing the image")
      setIsProcessing(false)
      setIsUploading(false)
      console.error(err)
    }
  }

  const handleSaveResult = async () => {
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

      // Log the NIC, image URL, and MongoDB ID as a single object
      console.log(result)

      // Store the result object
      setResultObject(result)
      setIsSuccess(true)

      toast({
        title: "Result saved successfully",
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
    setError(null)
    setCloudinaryUrl(null)
    setIsSuccess(false)
    setResultObject(null)
    setProcessingStatus("")
    setOrderId(null)

    if (fileInputRef.current) {
      fileInputRef.current.value = ""
    }
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString()
  }

  return (
    <>
      <div className="grid gap-6">
        <Card>
          <CardContent className="p-6">
            <div className="mb-6">
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
              <div className="mb-6 p-4 bg-green-50 rounded-md border border-green-200">
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
              <Alert className="mb-6 bg-amber-50 border-amber-200">
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

            {!originalImageUrl ? (
              <div
                className={`border-2 border-dashed border-gray-300 rounded-lg p-12 text-center cursor-pointer hover:bg-gray-50 transition-colors ${
                  !isNICValid && nic.trim() ? "opacity-50 pointer-events-none" : ""
                }`}
                onClick={() => {
                  if (isNICValid || !nic.trim()) {
                    fileInputRef.current?.click()
                  }
                }}
              >
                <div className="flex flex-col items-center justify-center gap-4">
                  <div className="bg-gray-100 p-4 rounded-full">
                    <Upload className="h-8 w-8 text-gray-500" />
                  </div>
                  <div>
                    <p className="font-medium text-lg">Click to upload an image</p>
                    <p className="text-sm text-gray-500 mt-1">or drag and drop</p>
                    <p className="text-xs text-gray-400 mt-2">PNG, JPG, WEBP up to 10MB</p>
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
              <div className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Original Image */}
                  <div>
                    <h3 className="text-sm font-medium mb-2">Original Image</h3>
                    <div className="relative aspect-video bg-gray-100 rounded-lg overflow-hidden">
                      {originalImageUrl && (
                        <Image
                          src={originalImageUrl || "/placeholder.svg"}
                          alt="Original image"
                          fill
                          className="object-contain"
                        />
                      )}
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
                        />
                      ) : (
                        <div className="flex items-center justify-center h-full">
                          <p className="text-gray-500 text-sm">
                            {isProcessing || isUploading ? processingStatus : "No processed image yet"}
                          </p>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Action Buttons */}
                <div className="flex justify-between items-center">
                  <div className="flex gap-2">
                    {!processedImageUrl && !isProcessing && !isUploading && (
                      <Button
                        onClick={handleRemoveBackground}
                        disabled={isProcessing || isUploading || !nic.trim() || !isNICValid}
                      >
                        Process with LightX API
                      </Button>
                    )}
                    {processedImageUrl && !isSuccess && (
                      <Button onClick={handleSaveResult} disabled={isSaving}>
                        {isSaving ? (
                          <div className="flex items-center">
                            <div className="animate-spin h-4 w-4 border-2 border-white border-t-transparent rounded-full mr-2"></div>
                            Saving...
                          </div>
                        ) : (
                          <>
                            <Save className="h-4 w-4 mr-2" />
                            Save to Database
                          </>
                        )}
                      </Button>
                    )}
                    {processedImageUrl && (
                      <Button onClick={handleDownload} variant="outline">
                        <Download className="h-4 w-4 mr-2" />
                        Download
                      </Button>
                    )}
                  </div>
                  <Button onClick={handleReset} variant="ghost" size="icon">
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>

                {/* Processing Status */}
                {(isProcessing || isUploading) && (
                  <div className="flex justify-center">
                    <div className="animate-pulse flex items-center gap-2">
                      <RefreshCw className="h-4 w-4 animate-spin text-blue-500" />
                      <span className="text-sm text-gray-500">{processingStatus}</span>
                    </div>
                  </div>
                )}

                {isSuccess && (
                  <Alert className="bg-green-50 border-green-200">
                    <Check className="h-4 w-4 text-green-600" />
                    <AlertDescription className="text-green-600 flex items-center">
                      <span>Image processed and saved to database successfully!</span>
                      <Database className="h-4 w-4 ml-2" />
                    </AlertDescription>
                  </Alert>
                )}

                {resultObject && (
                  <div className="mt-4 p-4 bg-gray-50 rounded-md">
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

                {error && (
                  <Alert className="bg-red-50 border-red-200">
                    <AlertCircle className="h-4 w-4 text-red-600" />
                    <AlertDescription className="text-red-600">{error}</AlertDescription>
                  </Alert>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        <div className="text-sm text-gray-500">
          <p>
            This tool uses the LightX API as a backup solution for background removal. The image is first uploaded to
            Cloudinary, then processed by LightX API, and finally saved to MongoDB.
          </p>
        </div>
      </div>

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
