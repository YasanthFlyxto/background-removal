"use client"

import type React from "react"

import { useState, useRef } from "react"
import Image from "next/image"
import { Upload, Download, Trash2, ImageIcon } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Slider } from "@/components/ui/slider"

export function BackgroundRemover() {
  const [originalImage, setOriginalImage] = useState<File | null>(null)
  const [originalImageUrl, setOriginalImageUrl] = useState<string | null>(null)
  const [processedImageUrl, setProcessedImageUrl] = useState<string | null>(null)
  const [isProcessing, setIsProcessing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [sliderValue, setSliderValue] = useState(50)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [activeTab, setActiveTab] = useState("original")

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    // Reset states
    setProcessedImageUrl(null)
    setError(null)
    setActiveTab("original")

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

  const handleRemoveBackground = async () => {
    if (!originalImage) return

    try {
      setIsProcessing(true)
      setError(null)

      const formData = new FormData()
      formData.append("file", originalImage)

      const response = await fetch("/api/remove-background", {
        method: "POST",
        body: formData,
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || "Failed to process image")
      }

      const blob = await response.blob()
      const processedUrl = URL.createObjectURL(blob)
      setProcessedImageUrl(processedUrl)
      setActiveTab("processed")
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred while processing the image")
      console.error(err)
    } finally {
      setIsProcessing(false)
    }
  }

  const handleDownload = () => {
    if (!processedImageUrl) return

    const link = document.createElement("a")
    link.href = processedImageUrl
    link.download = "removed-background.png"
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  const handleReset = () => {
    if (originalImageUrl) {
      URL.revokeObjectURL(originalImageUrl)
    }
    if (processedImageUrl) {
      URL.revokeObjectURL(processedImageUrl)
    }

    setOriginalImage(null)
    setOriginalImageUrl(null)
    setProcessedImageUrl(null)
    setError(null)
    setActiveTab("original")

    if (fileInputRef.current) {
      fileInputRef.current.value = ""
    }
  }

  const renderComparisonView = () => {
    if (!originalImageUrl || !processedImageUrl) return null

    return (
      <div className="relative aspect-video bg-[url('/checkerboard.png')] rounded-lg overflow-hidden">
        <div className="absolute inset-0 flex">
          <div className="h-full bg-white overflow-hidden" style={{ width: `${sliderValue}%` }}>
            <div className="relative w-full h-full">
              <Image
                src={originalImageUrl || "/placeholder.svg"}
                alt="Original image"
                fill
                className="object-contain"
              />
            </div>
          </div>
          <div className="h-full flex-1 overflow-hidden">
            <div className="relative w-full h-full">
              <Image
                src={processedImageUrl || "/placeholder.svg"}
                alt="Processed image"
                fill
                className="object-contain"
              />
            </div>
          </div>
        </div>
        <div className="absolute inset-y-0 bg-white w-0.5" style={{ left: `${sliderValue}%` }} />
        <div
          className="absolute top-1/2 -translate-y-1/2 w-6 h-6 bg-white rounded-full shadow-md flex items-center justify-center cursor-move"
          style={{ left: `${sliderValue}%`, transform: "translate(-50%, -50%)" }}
        >
          <div className="w-4 h-4 text-gray-500">
            <ImageIcon className="w-4 h-4" />
          </div>
        </div>
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 w-3/4">
          <Slider
            value={[sliderValue]}
            min={0}
            max={100}
            step={1}
            onValueChange={(value) => setSliderValue(value[0])}
            className="z-10"
          />
        </div>
      </div>
    )
  }

  return (
    <div className="grid gap-6">
      <Card>
        <CardContent className="p-6">
          {!originalImageUrl ? (
            <div
              className="border-2 border-dashed border-gray-300 rounded-lg p-12 text-center cursor-pointer hover:bg-gray-50 transition-colors"
              onClick={() => fileInputRef.current?.click()}
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
                <input type="file" ref={fileInputRef} onChange={handleFileChange} accept="image/*" className="hidden" />
              </div>
            </div>
          ) : (
            <div className="space-y-6">
              <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
                <div className="flex justify-between items-center mb-4">
                  <TabsList>
                    <TabsTrigger value="original">Original</TabsTrigger>
                    <TabsTrigger value="processed" disabled={!processedImageUrl}>
                      Processed
                    </TabsTrigger>
                    {processedImageUrl && <TabsTrigger value="comparison">Comparison</TabsTrigger>}
                  </TabsList>
                  <div className="flex gap-2">
                    {!processedImageUrl && !isProcessing && (
                      <Button onClick={handleRemoveBackground} disabled={isProcessing}>
                        Remove Background
                      </Button>
                    )}
                    {processedImageUrl && (
                      <Button onClick={handleDownload} variant="outline">
                        <Download className="h-4 w-4 mr-2" />
                        Download
                      </Button>
                    )}
                    <Button onClick={handleReset} variant="ghost" size="icon">
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>

                <TabsContent value="original" className="mt-0">
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
                </TabsContent>

                <TabsContent value="processed" className="mt-0">
                  {processedImageUrl ? (
                    <div className="relative aspect-video bg-[url('/checkerboard.png')] rounded-lg overflow-hidden">
                      <Image
                        src={processedImageUrl || "/placeholder.svg"}
                        alt="Processed image"
                        fill
                        className="object-contain"
                      />
                    </div>
                  ) : (
                    <div className="aspect-video flex items-center justify-center bg-gray-100 rounded-lg">
                      <p className="text-gray-500">Processing image...</p>
                    </div>
                  )}
                </TabsContent>

                <TabsContent value="comparison" className="mt-0">
                  {renderComparisonView()}
                </TabsContent>
              </Tabs>

              {isProcessing && (
                <div className="flex justify-center">
                  <div className="animate-pulse flex items-center gap-2">
                    <div className="h-2 w-2 bg-gray-500 rounded-full"></div>
                    <div className="h-2 w-2 bg-gray-500 rounded-full animation-delay-200"></div>
                    <div className="h-2 w-2 bg-gray-500 rounded-full animation-delay-400"></div>
                    <span className="ml-2 text-sm text-gray-500">Processing image with U2Net...</span>
                  </div>
                </div>
              )}

              {error && <div className="bg-red-50 text-red-600 p-3 rounded-md text-sm">{error}</div>}
            </div>
          )}
        </CardContent>
      </Card>

      <div className="text-sm text-gray-500">
        <p>
          This tool uses the U2Net model to automatically remove backgrounds from images. The processing happens on the
          server and your images are not stored permanently.
        </p>
      </div>
    </div>
  )
}
