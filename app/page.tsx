import DownloadForm from "./components/DownloadForm"

export default function Home() {
  return (
    <main className="min-h-screen flex items-center justify-center bg-gray-100 p-4">
      <div className="max-w-2xl w-full bg-white p-8 rounded-lg shadow-md">
        <h1 className="text-2xl font-bold mb-6 text-center">Podcast Episode Transcriber</h1>
        <DownloadForm />
      </div>
    </main>
  )
}

