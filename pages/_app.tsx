import type { AppProps } from 'next/app'
import Head from 'next/head'
import '../styles/globals.css'

export default function App({ Component, pageProps }: AppProps) {
  return (
    <>
      <Head>
        <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=5, user-scalable=yes" />
        <meta name="theme-color" content="#000000" />
        <link rel="icon" href="/logo.png" />
        {/* Preload ML scripts so they're cached before visiting /health */}
        <link rel="preload" href="https://cdn.jsdelivr.net/npm/@tensorflow/tfjs@1.3.1/dist/tf.min.js" as="script" />
        <link rel="preload" href="https://cdn.jsdelivr.net/npm/@teachablemachine/image@0.8.5/dist/teachablemachine-image.min.js" as="script" />
      </Head>
      <Component {...pageProps} />
    </>
  )
}
