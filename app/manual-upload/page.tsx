"use client"

import type React from "react"

import { useState, useRef } from "react"
import Image from "next/image"
import { Upload, Check, AlertCircle, Search, Database, Save, AlertTriangle } from "lucide-react"
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

interface ExistingImage {
  _id: string
  nic: string
  dealerName?: string
  imageUrl: string
  processedAt: string
  isManualUpload?: boolean
}

export default function ManualUploadPage() {
  const [image, setImage] = useState<File | null>(null)
  const [imageUrl, setImageUrl] = useState<string | null>(null)
  const [isUploading, setIsUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [nic, setNic] = useState("")
  const [isValidatingNIC, setIsValidatingNIC] = useState(false)
  const [dealerInfo, setDealerInfo] = useState<Dealer | null>(null)
  const [isNICValid, setIsNICValid] = useState<boolean | null>(null)
  const [isSuccess, setIsSuccess] = useState(false)
  const [resultId, setResultId] = useState<string | null>(null)
  const [existingImage, setExistingImage] = useState<ExistingImage | null>(null)
  const [showExistingImageDialog, setShowExistingImageDialog] = useState(false)
  const [isCheckingExisting, setIsCheckingExisting] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    // Reset states
    setError(null)
    setIsSuccess(false)
    setResultId(null)

    // Check file type - only allow PNG with transparency
    if (file.type !== "image/png") {
      setError("Please upload a PNG image with transparency")
      return
    }

    // Check file size (limit to 10MB)
    if (file.size > 10 * 1024 * 1024) {
      setError("Image size should be less than 10MB")
      return
    }

    setImage(file)
    const objectUrl = URL.createObjectURL(file)
    setImageUrl(objectUrl)
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

  const handleUpload = async () => {
    if (!image) {
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
      setIsSuccess(false)
      setResultId(null)

      const formData = new FormData()
      formData.append("file", image)
      formData.append("nic", nic.trim())
      formData.append("isManualUpload", "true")

      // Add dealer name if available
      if (dealerInfo) {
        formData.append("dealerName", dealerInfo["DEALER NAME"])
        formData.append("area", dealerInfo.AREA)
        formData.append("classification", dealerInfo.CLASSIFICATION)
      }

      const response = await fetch("/api/manual-upload", {
        method: "POST",
        body: formData,
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || "Failed to upload image")
      }

      const data = await response.json()

      // Log the result
      console.log({
        nic: data.nic,
        imageUrl: data.imageUrl,
        _id: data._id,
        dealerName: dealerInfo ? dealerInfo["DEALER NAME"] : undefined,
        manualUpload: true,
      })

      setResultId(data._id)
      setIsSuccess(true)

      toast({
        title: "Upload successful",
        description: "The image has been uploaded and saved to the database.",
      })
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred while uploading the image")
      console.error(err)
    } finally {
      setIsUploading(false)
    }
  }

  const handleReset = () => {
    if (imageUrl) {
      URL.revokeObjectURL(imageUrl)
    }

    setImage(null)
    setImageUrl(null)
    setError(null)
    setIsSuccess(false)
    setResultId(null)

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
        <div className="max-w-3xl mx-auto">
          <Card>
            <CardHeader>
              <CardTitle>Manual Background Removal Upload</CardTitle>
              <CardDescription>
                Upload pre-processed images with backgrounds already removed (transparent PNG) when the automated model
                fails.
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
                <Label className="text-sm font-medium">Pre-processed Image (PNG with transparency)</Label>
                {!imageUrl ? (
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
                        <p className="font-medium">Click to upload a transparent PNG</p>
                        <p className="text-xs text-gray-400 mt-1">
                          Upload images with backgrounds already removed in Photoshop
                        </p>
                      </div>
                      <input
                        type="file"
                        ref={fileInputRef}
                        onChange={handleFileChange}
                        accept="image/png"
                        className="hidden"
                      />
                    </div>
                  </div>
                ) : (
                  <div className="mt-1">
                    <div className="relative aspect-video bg-[url('/checkerboard.png')] rounded-lg overflow-hidden">
                      <Image
                        src={imageUrl || "/placeholder.svg"}
                        alt="Pre-processed image"
                        fill
                        className="object-contain"
                      />
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

              {isSuccess && (
                <Alert className="bg-green-50 border-green-200">
                  <Check className="h-4 w-4 text-green-600" />
                  <AlertDescription className="text-green-600 flex items-center">
                    <span>Image uploaded successfully and saved to database!</span>
                    <Database className="h-4 w-4 ml-2" />
                  </AlertDescription>
                </Alert>
              )}

              <div className="flex justify-end gap-3">
                <Button variant="outline" onClick={handleReset}>
                  Reset
                </Button>
                <Button
                  onClick={handleUpload}
                  disabled={isUploading || !image || !isNICValid}
                  className="min-w-[120px]"
                >
                  {isUploading ? (
                    <div className="flex items-center">
                      <div className="animate-spin h-4 w-4 border-2 border-white border-t-transparent rounded-full mr-2"></div>
                      Uploading...
                    </div>
                  ) : (
                    <>
                      <Save className="h-4 w-4 mr-2" />
                      Upload
                    </>
                  )}
                </Button>
              </div>
            </CardContent>
          </Card>

          <div className="mt-4 text-sm text-gray-500 text-center">
            <p>
              This portal is for uploading pre-processed images when the automated background removal fails.
              <br />
              Please ensure the uploaded PNG has transparency where the background was removed.
            </p>
          </div>
        </div>
        <Toaster />
      </main>

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
