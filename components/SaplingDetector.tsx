import { useEffect, useState, useRef, useCallback } from 'react'

interface Prediction {
  className: string
  probability: number
}

function injectScript(src: string): Promise<void> {
  return new Promise((resolve, reject) => {
    // Already loaded?
    const existing = document.querySelector(`script[src="${src}"]`) as HTMLScriptElement | null
    if (existing) {
      if (existing.getAttribute('data-loaded') === '1') return resolve()
      existing.addEventListener('load', () => resolve(), { once: true })
      existing.addEventListener('error', () => reject(new Error(src)), { once: true })
      return
    }
    const s = document.createElement('script')
    s.src = src
    s.async = true
    s.onload = () => { s.setAttribute('data-loaded', '1'); resolve() }
    s.onerror = () => reject(new Error(`Script failed: ${src}`))
    document.body.appendChild(s)
  })
}

export type LoadStage = 'tf' | 'tm' | 'model' | 'ready' | 'error'

interface Props {
  onStageChange?: (stage: LoadStage) => void
}

export default function SaplingDetector({ onStageChange }: Props) {
  const [model, setModel] = useState<any>(null)
  const [imageURL, setImageURL] = useState<string | null>(null)
  const [result, setResult] = useState('Upload an image to detect saplings')
  const [loading, setLoading] = useState(true)
  const [isDragging, setIsDragging] = useState(false)
  const [analyzing, setAnalyzing] = useState(false)
  const imgRef = useRef<HTMLImageElement>(null)

  useEffect(() => {
    let cancelled = false

    const init = async () => {
      try {
        // Step 1: Load TensorFlow.js
        onStageChange?.('tf')
        await injectScript('https://cdn.jsdelivr.net/npm/@tensorflow/tfjs@1.3.1/dist/tf.min.js')
        if (cancelled) return

        // Step 2: Load Teachable Machine (needs tf on window)
        onStageChange?.('tm')
        await injectScript('https://cdn.jsdelivr.net/npm/@teachablemachine/image@0.8.5/dist/teachablemachine-image.min.js')
        if (cancelled) return

        const tmImage = (window as any).tmImage
        if (!tmImage) throw new Error('tmImage not on window')

        // Step 3: Load the trained model
        onStageChange?.('model')
        const loadedModel = await tmImage.load('/model/model.json', '/model/metadata.json')
        if (cancelled) return

        setModel(loadedModel)
        setLoading(false)
        onStageChange?.('ready')
      } catch (err) {
        console.error('SaplingDetector init failed:', err)
        if (!cancelled) {
          setResult('Failed to load AI model — check console.')
          setLoading(false)
          onStageChange?.('error')
        }
      }
    }

    init()
    return () => { cancelled = true }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const processImage = useCallback(async (file: File) => {
    if (!model) {
      setResult('Model not loaded yet...')
      return
    }

    if (!file || !file.type.startsWith('image/')) {
      setResult('Please upload a valid image file')
      return
    }

    setAnalyzing(true)
    setResult('Analyzing...')

    const url = URL.createObjectURL(file)
    setImageURL(url)

    const img = document.createElement('img')
    img.src = url
    img.onload = async () => {
      try {
        const predictions: Prediction[] = await model.predict(img, false)

        const sapling = predictions.find(
          (p: Prediction) => p.className.toLowerCase() === 'sapling'
        )
        const noSapling = predictions.find(
          (p: Prediction) => p.className.toLowerCase().includes('no')
        )

        if (sapling && sapling.probability > 0.85) {
          setResult(`🌱 Sapling detected (${(sapling.probability * 100).toFixed(2)}%)`)
        } else if (noSapling && noSapling.probability > 0.85) {
          setResult(`❌ No sapling detected (${(noSapling.probability * 100).toFixed(2)}%)`)
        } else {
          setResult('⚠️ Uncertain result — try a clearer image')
        }
      } catch (err) {
        console.error('Prediction error:', err)
        setResult('Error analyzing image')
      } finally {
        setAnalyzing(false)
      }
    }
  }, [model])

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) await processImage(file)
  }

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(true)
  }

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(false)
  }

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(false)
    const file = e.dataTransfer.files[0]
    if (file) await processImage(file)
  }

  const resultType = result.includes('Sapling detected')
    ? 'success'
    : result.includes('No sapling')
    ? 'error'
    : result.includes('Uncertain')
    ? 'warning'
    : 'neutral'

  return (
    <div className="w-full max-w-md mx-auto">
      <div className="bg-black/60 backdrop-blur-sm rounded-2xl border border-emerald-500/30 p-6 sm:p-8 shadow-xl">
        <h3 className="text-xl font-bold text-white mb-1 text-center">Sapling Detection</h3>
        <p className="text-gray-400 text-sm text-center mb-6">
          Upload an image to check whether it contains a sapling
        </p>

        {loading && (
          <div className="mb-4 p-3 bg-blue-500/10 border border-blue-500/30 rounded-lg">
            <p className="text-blue-300 text-xs">Loading AI model...</p>
          </div>
        )}

        <label
          className={`block p-6 border-2 border-dashed rounded-xl cursor-pointer text-center transition-all ${
            isDragging
              ? 'border-emerald-400 bg-emerald-500/10 scale-[1.02]'
              : 'border-emerald-500/50 hover:border-emerald-400 hover:bg-emerald-500/5'
          } ${loading ? 'opacity-60 cursor-not-allowed' : ''}`}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
        >
          <input
            type="file"
            accept="image/*"
            onChange={handleImageUpload}
            hidden
            disabled={loading}
          />
          <span className="text-emerald-400 font-semibold text-sm">
            {isDragging ? '📥 Drop image here' : '📤 Click to upload or drag image here'}
          </span>
        </label>

        {imageURL && (
          <div className="mt-5 rounded-xl overflow-hidden border border-gray-700">
            <img
              ref={imgRef}
              src={imageURL}
              alt="Uploaded"
              className="w-full object-cover"
            />
          </div>
        )}

        <div
          className={`mt-5 p-4 rounded-xl font-semibold text-center text-sm ${
            resultType === 'success'
              ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
              : resultType === 'error'
              ? 'bg-red-500/20 text-red-400 border border-red-500/30'
              : resultType === 'warning'
              ? 'bg-yellow-500/20 text-yellow-400 border border-yellow-500/30'
              : 'bg-gray-500/20 text-gray-400 border border-gray-500/30'
          }`}
        >
          {analyzing && (
            <span className="inline-block w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin mr-2 align-middle" />
          )}
          {result}
        </div>
      </div>
    </div>
  )
}
