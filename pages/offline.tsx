import Head from 'next/head'
import { useRouter } from 'next/router'

export default function Offline() {
  const router = useRouter()

  return (
    <>
      <Head>
        <title>Offline - Behemoth Companion</title>
      </Head>

      <main className="flex min-h-screen flex-col items-center justify-center bg-black text-white p-4">
        <div className="text-center max-w-md">
          <div className="mb-6">
            <svg 
              className="w-24 h-24 mx-auto text-white/20" 
              fill="none" 
              stroke="currentColor" 
              viewBox="0 0 24 24"
            >
              <path 
                strokeLinecap="round" 
                strokeLinejoin="round" 
                strokeWidth={1.5} 
                d="M18.364 5.636a9 9 0 010 12.728m0 0l-2.829-2.829m2.829 2.829L21 21M15.536 8.464a5 5 0 010 7.072m0 0l-2.829-2.829m-4.243 2.829a4.978 4.978 0 01-1.414-2.83m-1.414 5.658a9 9 0 01-2.167-9.238m7.824 2.167a1 1 0 111.414 1.414m-1.414-1.414L3 3m8.293 8.293l1.414 1.414" 
              />
            </svg>
          </div>
          
          <h1 className="text-3xl font-bold mb-4">You&apos;re Offline</h1>
          
          <p className="text-white/70 mb-8">
            You&apos;re currently offline. Please check your internet connection to use Behemoth Companion.
          </p>

          <button
            onClick={() => router.push('/')}
            className="rounded-xl bg-green-600 px-6 py-3 text-white transition-colors hover:bg-green-500"
          >
            Try Again
          </button>
        </div>
      </main>
    </>
  )
}
