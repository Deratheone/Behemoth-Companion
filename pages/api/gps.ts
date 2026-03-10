import type { NextApiRequest, NextApiResponse } from 'next'

// In-memory store for the latest GPS location from ESP32
let latestLocation = {
  lat: null as number | null,
  lng: null as number | null,
  speed: 0,
  altitude: 0,
  satellites: 0,
  timestamp: null as string | null,
}

export default function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method === 'POST') {
    const { lat, lng, speed, altitude, satellites } = req.body

    if (!lat || !lng) {
      return res.status(400).json({ error: 'Missing lat/lng' })
    }

    latestLocation = {
      lat,
      lng,
      speed: speed ?? 0,
      altitude: altitude ?? 0,
      satellites: satellites ?? 0,
      timestamp: new Date().toISOString(),
    }

    return res.json({ status: 'ok' })
  }

  if (req.method === 'GET') {
    return res.json(latestLocation)
  }

  res.setHeader('Allow', ['GET', 'POST'])
  return res.status(405).json({ error: 'Method not allowed' })
}
