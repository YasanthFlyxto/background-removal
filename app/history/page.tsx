"use client"

import type React from "react"

import { useState, useEffect } from "react"
import Image from "next/image"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Search, Copy, ExternalLink, User, MapPin, Award, Upload, Trash2, AlertCircle } from "lucide-react"
import { toast } from "@/components/ui/use-toast"
import { Toaster } from "@/components/ui/toaster"
import { Badge } from "@/components/ui/badge"
import { useSearchParams } from "next/navigation"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"

interface ProcessedImage {
  _id: string
  nic: string
  dealerName?: string
  area?: string
  classification?: string
  imageUrl: string
  cloudinaryPublicId: string
  processedAt: string
  isManualUpload?: boolean
}

export default function HistoryPage() {
  const searchParams = useSearchParams()
  const nicFromUrl = searchParams.get("nic")

  const [images, setImages] = useState<ProcessedImage[]>([])
  const [loading, setLoading] = useState(true)
  const [searchNic, setSearchNic] = useState(nicFromUrl || "")
  const [error, setError] = useState<string | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)
  const [imageToDelete, setImageToDelete] = useState<ProcessedImage | null>(null)
  const [showDeleteDialog, setShowDeleteDialog] = useState(false)

  const fetchImages = async (nic?: string) => {
    try {
      setLoading(true)
      setError(null)

      const url = new URL("/api/images", window.location.origin)
      if (nic) {
        url.searchParams.append("nic", nic)
      }

      const response = await fetch(url.toString())

      if (!response.ok) {
        throw new Error("Failed to fetch images")
      }

      const data = await response.json()
      setImages(data)
    } catch (err) {
      setError("Failed to load images. Please try again.")
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (nicFromUrl) {
      fetchImages(nicFromUrl)
    } else {
      fetchImages()
    }
  }, [nicFromUrl])

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault()
    fetchImages(searchNic.trim())

    // Update URL with search parameter without page reload
    const url = new URL(window.location.href)
    if (searchNic.trim()) {
      url.searchParams.set("nic", searchNic.trim())
    } else {
      url.searchParams.delete("nic")
    }
    window.history.pushState({}, "", url.toString())
  }

  const handleCopyData = (image: ProcessedImage) => {
    const data = {
      nic: image.nic,
      dealerName: image.dealerName,
      imageUrl: image.imageUrl,
      _id: image._id,
      isManualUpload: image.isManualUpload || false,
    }

    navigator.clipboard.writeText(JSON.stringify(data, null, 2))
    toast({
      title: "Copied to clipboard",
      description: "Image data has been copied to your clipboard.",
    })
  }

  const handleDeleteClick = (image: ProcessedImage) => {
    setImageToDelete(image)
    setShowDeleteDialog(true)
  }

  const handleDeleteConfirm = async () => {
    if (!imageToDelete) return

    setIsDeleting(true)
    try {
      const response = await fetch(`/api/delete-image?id=${imageToDelete._id}`, {
        method: "DELETE",
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || "Failed to delete image")
      }

      // Remove the deleted image from the state
      setImages((prevImages) => prevImages.filter((img) => img._id !== imageToDelete._id))

      toast({
        title: "Image deleted",
        description: "The image has been successfully deleted.",
      })
    } catch (err) {
      console.error("Error deleting image:", err)
      toast({
        title: "Error",
        description: err instanceof Error ? err.message : "Failed to delete image",
        variant: "destructive",
      })
    } finally {
      setIsDeleting(false)
      setShowDeleteDialog(false)
      setImageToDelete(null)
    }
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString()
  }

  const getClassificationColor = (classification?: string) => {
    if (!classification) return "bg-gray-100 text-gray-800"

    switch (classification.toUpperCase()) {
      case "SILVER":
        return "bg-gray-200 text-gray-800"
      case "GOLD":
        return "bg-amber-100 text-amber-800"
      case "PLATINUM":
        return "bg-blue-100 text-blue-800"
      case "SUPER PLATINUM":
        return "bg-purple-100 text-purple-800"
      default:
        return "bg-gray-100 text-gray-800"
    }
  }

  return (
    <>
      <main className="min-h-screen p-4 md:p-8 bg-gray-50">
        <div className="max-w-6xl mx-auto">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
            <div>
              <h1 className="text-3xl font-bold tracking-tight">Processed Images History</h1>
              <p className="text-gray-600 mt-1">View and search previously processed images</p>
            </div>

            <form onSubmit={handleSearch} className="flex w-full md:w-auto gap-2">
              <Input
                placeholder="Search by NIC number"
                value={searchNic}
                onChange={(e) => setSearchNic(e.target.value)}
                className="w-full md:w-64"
              />
              <Button type="submit">
                <Search className="h-4 w-4 mr-2" />
                Search
              </Button>
            </form>
          </div>

          {loading ? (
            <div className="flex justify-center items-center h-64">
              <div className="animate-pulse flex items-center gap-2">
                <div className="h-2 w-2 bg-gray-500 rounded-full"></div>
                <div className="h-2 w-2 bg-gray-500 rounded-full animation-delay-200"></div>
                <div className="h-2 w-2 bg-gray-500 rounded-full animation-delay-400"></div>
                <span className="ml-2 text-sm text-gray-500">Loading images...</span>
              </div>
            </div>
          ) : error ? (
            <div className="bg-red-50 text-red-600 p-4 rounded-md">{error}</div>
          ) : images.length === 0 ? (
            <div className="text-center py-12 bg-gray-100 rounded-lg">
              <p className="text-gray-500">No images found</p>
              {searchNic && (
                <Button
                  variant="link"
                  onClick={() => {
                    setSearchNic("")
                    fetchImages()
                    // Remove search parameter from URL
                    const url = new URL(window.location.href)
                    url.searchParams.delete("nic")
                    window.history.pushState({}, "", url.toString())
                  }}
                  className="mt-2"
                >
                  Clear search and show all images
                </Button>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {images.map((image) => (
                <Card key={image._id} className="overflow-hidden">
                  <div className="relative aspect-video bg-[url('/checkerboard.png')]">
                    <Image
                      src={image.imageUrl || "/placeholder.svg"}
                      alt={`Processed image for NIC ${image.nic}`}
                      fill
                      className="object-contain"
                    />
                  </div>
                  <CardContent className="p-4">
                    <div className="flex justify-between items-start mb-2">
                      <div className="flex items-center gap-2">
                        <h3 className="font-medium">NIC: {image.nic}</h3>
                        {image.isManualUpload && (
                          <Badge variant="outline" className="bg-orange-100 text-orange-800 border-orange-200">
                            <Upload className="h-3 w-3 mr-1" />
                            Manual
                          </Badge>
                        )}
                      </div>
                      <div className="flex gap-1">
                        <Button variant="ghost" size="icon" onClick={() => handleCopyData(image)} title="Copy data">
                          <Copy className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => window.open(image.imageUrl, "_blank")}
                          title="Open image"
                        >
                          <ExternalLink className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleDeleteClick(image)}
                          title="Delete image"
                          className="text-red-500 hover:text-red-700 hover:bg-red-50"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>

                    <p className="text-xs text-gray-500 mb-3">{formatDate(image.processedAt)}</p>

                    {image.dealerName && (
                      <div className="space-y-2">
                        <div className="flex items-center gap-1 text-sm">
                          <User className="h-3.5 w-3.5 text-gray-500" />
                          <span className="text-gray-700">{image.dealerName}</span>
                        </div>

                        {image.area && (
                          <div className="flex items-center gap-1 text-sm">
                            <MapPin className="h-3.5 w-3.5 text-gray-500" />
                            <span className="text-gray-700">{image.area}</span>
                          </div>
                        )}

                        {image.classification && (
                          <div className="flex items-center gap-1 text-sm">
                            <Award className="h-3.5 w-3.5 text-gray-500" />
                            <Badge variant="secondary" className={getClassificationColor(image.classification)}>
                              {image.classification}
                            </Badge>
                          </div>
                        )}
                      </div>
                    )}

                    <div className="mt-2">
                      <p className="text-xs text-gray-500 truncate" title={image.imageUrl}>
                        {image.imageUrl}
                      </p>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
        <Toaster />
      </main>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure you want to delete this image?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This will permanently delete the image from both Cloudinary and the
              database.
            </AlertDialogDescription>
          </AlertDialogHeader>
          {imageToDelete && (
            <div className="my-4 p-4 bg-gray-50 rounded-md">
              <div className="flex items-center gap-2 mb-2">
                <AlertCircle className="h-4 w-4 text-amber-500" />
                <p className="text-sm font-medium">Image details:</p>
              </div>
              <div className="text-sm space-y-1">
                <p>
                  <span className="font-medium">NIC:</span> {imageToDelete.nic}
                </p>
                {imageToDelete.dealerName && (
                  <p>
                    <span className="font-medium">Dealer:</span> {imageToDelete.dealerName}
                  </p>
                )}
                <p>
                  <span className="font-medium">Uploaded:</span> {formatDate(imageToDelete.processedAt)}
                </p>
              </div>
            </div>
          )}
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault()
                handleDeleteConfirm()
              }}
              disabled={isDeleting}
              className="bg-red-500 hover:bg-red-600 focus:ring-red-500"
            >
              {isDeleting ? (
                <div className="flex items-center">
                  <div className="animate-spin h-4 w-4 border-2 border-white border-t-transparent rounded-full mr-2"></div>
                  Deleting...
                </div>
              ) : (
                "Delete"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
