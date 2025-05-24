import type React from "react"
import "@/app/globals.css"
import { Inter } from "next/font/google"
import { ThemeProvider } from "@/components/theme-provider"
import Link from "next/link"
import { Home, History, Upload, Zap } from "lucide-react"

const inter = Inter({ subsets: ["latin"] })

export const metadata = {
  title: "Background Removal Tool",
  description: "Remove image backgrounds with U2Net and store results in MongoDB",
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className={inter.className}>
        <ThemeProvider attribute="class" defaultTheme="light" enableSystem>
          <div className="min-h-screen flex flex-col">
            <header className="border-b bg-white">
              <div className="container mx-auto px-4 py-3 flex justify-between items-center">
                <h1 className="font-bold text-xl">Background Removal Tool</h1>
                <nav className="flex gap-4">
                  <Link href="/" className="flex items-center gap-1 text-sm hover:text-gray-600">
                    <Home className="h-4 w-4" />
                    <span>Home</span>
                  </Link>
                  <Link href="/lightx" className="flex items-center gap-1 text-sm hover:text-gray-600">
                    <Zap className="h-4 w-4" />
                    <span>LightX API</span>
                  </Link>
                  <Link href="/manual-upload" className="flex items-center gap-1 text-sm hover:text-gray-600">
                    <Upload className="h-4 w-4" />
                    <span>Manual Upload</span>
                  </Link>
                  <Link href="/history" className="flex items-center gap-1 text-sm hover:text-gray-600">
                    <History className="h-4 w-4" />
                    <span>History</span>
                  </Link>
                </nav>
              </div>
            </header>
            <main className="flex-1">{children}</main>
          </div>
        </ThemeProvider>
      </body>
    </html>
  )
}
