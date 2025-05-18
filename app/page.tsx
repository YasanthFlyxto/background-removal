import { BackgroundRemover } from "@/components/background-remover"

export default function Home() {
  return (
    <main className="min-h-screen flex flex-col items-center justify-center p-4 md:p-8 bg-gray-50">
      <div className="w-full max-w-4xl mx-auto">
        <div className="text-center mb-8">
          <h1 className="text-3xl md:text-4xl font-bold tracking-tight mb-2">Background Removal Tool</h1>
          <p className="text-gray-600 max-w-2xl mx-auto">
            Upload an image and our AI will automatically remove the background using the U2Net model.
          </p>
        </div>
        <BackgroundRemover />
      </div>
    </main>
  )
}
