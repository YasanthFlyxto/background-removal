import { BackgroundRemover } from "@/components/background-remover"
import { Toaster } from "@/components/ui/toaster"

export default function Home() {
  return (
    <main className="min-h-screen flex flex-col items-center justify-center p-4 md:p-8 bg-gray-50">
      <div className="w-full max-w-4xl mx-auto">
        <BackgroundRemover />
      </div>
      <Toaster />
    </main>
  )
}
