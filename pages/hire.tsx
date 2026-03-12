import Head from 'next/head'
import { useRouter } from 'next/router'
import { useState, useMemo } from 'react'
import FloatingLines from '../components/FloatingLines'

const RATE_PER_DAY = 3500 // ₹ per day
const DELIVERY_FEE = 1500
const INSURANCE_PER_DAY = 200

function daysBetween(from: string, to: string): number {
  if (!from || !to) return 0
  const diff = new Date(to).getTime() - new Date(from).getTime()
  return Math.max(1, Math.ceil(diff / (1000 * 60 * 60 * 24)))
}

function todayStr() {
  return new Date().toISOString().split('T')[0]
}

export default function Hire() {
  const router = useRouter()

  const [fromDate, setFromDate] = useState('')
  const [toDate, setToDate] = useState('')
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [address, setAddress] = useState('')
  const [acreage, setAcreage] = useState('')
  const [cropType, setCropType] = useState('')
  const [quantity, setQuantity] = useState(1)
  const [delivery, setDelivery] = useState(true)
  const [insurance, setInsurance] = useState(false)
  const [operatorNeeded, setOperatorNeeded] = useState(false)
  const [notes, setNotes] = useState('')
  const [submitted, setSubmitted] = useState(false)

  const days = useMemo(() => daysBetween(fromDate, toDate), [fromDate, toDate])

  const pricing = useMemo(() => {
    const base = days * RATE_PER_DAY * quantity
    const deliveryCost = delivery ? DELIVERY_FEE : 0
    const insuranceCost = insurance ? days * INSURANCE_PER_DAY * quantity : 0
    const operatorCost = operatorNeeded ? days * 1500 : 0
    const discount = days >= 7 ? 0.10 : days >= 3 ? 0.05 : 0
    const subtotal = base + deliveryCost + insuranceCost + operatorCost
    const discountAmt = Math.round(base * discount)
    const total = subtotal - discountAmt
    return { base, deliveryCost, insuranceCost, operatorCost, discount, discountAmt, subtotal, total }
  }, [days, quantity, delivery, insurance, operatorNeeded])

  const canSubmit = fromDate && toDate && name.trim() && phone.trim() && address.trim() && days > 0

  const handleSubmit = () => {
    if (!canSubmit) return
    setSubmitted(true)
  }

  return (
    <>
      <Head>
        <title>Hire Transplanter - Behemoth Companion</title>
      </Head>

      <main className="min-h-screen relative overflow-hidden bg-black">
        <div className="absolute inset-0 w-full h-full opacity-40">
          <FloatingLines />
        </div>

        <div className="relative z-10 min-h-screen flex flex-col">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-white/10 bg-black/60">
            <button
              onClick={() => router.push('/')}
              className="flex items-center gap-2 text-gray-400 hover:text-white transition-colors"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
              <span className="text-sm font-medium">Home</span>
            </button>
            <div className="flex items-center gap-2">
              <div className="flex h-8 w-8 sm:h-10 sm:w-10 shrink-0 items-center justify-center rounded-full bg-white/10 overflow-hidden">
                <img src="/logo.png" alt="Behemoth Companion" className="h-full w-full scale-150 translate-y-0.5 object-cover" />
              </div>
              <h1 className="text-white font-bold text-lg">Hire Transplanter</h1>
            </div>
            <div className="w-16" />
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto px-4 py-6">
            <div className="max-w-2xl mx-auto space-y-6">

              {submitted ? (
                /* Success state */
                <div className="bg-emerald-900/40 border border-emerald-500/40 rounded-2xl p-8 text-center space-y-4">
                  <div className="text-5xl">✅</div>
                  <h2 className="text-2xl font-bold text-white">Booking Request Sent</h2>
                  <p className="text-gray-300">
                    Your transplanter hire request for <span className="text-emerald-400 font-semibold">{days} day{days > 1 ? 's' : ''}</span> has been submitted.
                    We&apos;ll contact you at <span className="text-emerald-400 font-semibold">{phone}</span> to confirm.
                  </p>
                  <div className="bg-black/40 rounded-xl p-4 text-left text-sm text-gray-300 space-y-1">
                    <p><span className="text-gray-500">Period:</span> {fromDate} → {toDate}</p>
                    <p><span className="text-gray-500">Units:</span> {quantity}</p>
                    <p><span className="text-gray-500">Estimated Total:</span> <span className="text-white font-bold">₹{pricing.total.toLocaleString('en-IN')}</span></p>
                  </div>
                  <button
                    onClick={() => { setSubmitted(false); setFromDate(''); setToDate(''); setName(''); setPhone(''); setAddress(''); setAcreage(''); setCropType(''); setQuantity(1); setDelivery(true); setInsurance(false); setOperatorNeeded(false); setNotes('') }}
                    className="mt-4 px-6 py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold rounded-xl transition-colors"
                  >
                    New Booking
                  </button>
                </div>
              ) : (
                <>
                  {/* Rate Banner */}
                  <div className="bg-gradient-to-r from-amber-900/40 to-orange-900/40 border border-amber-500/30 rounded-2xl p-5 flex items-center gap-4">
                    <div className="text-4xl">🚜</div>
                    <div>
                      <p className="text-amber-200 font-bold text-lg">Behemoth Transplanter</p>
                      <p className="text-amber-100/70 text-sm">Automated sapling transplanter with ESP32 guidance</p>
                      <p className="text-white font-bold text-xl mt-1">₹{RATE_PER_DAY.toLocaleString('en-IN')} <span className="text-sm font-normal text-gray-400">/ day</span></p>
                    </div>
                  </div>

                  {/* Rental Period */}
                  <Section title="Rental Period">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <label className="block">
                        <span className="text-gray-400 text-xs uppercase tracking-wider">From</span>
                        <input
                          type="date"
                          value={fromDate}
                          min={todayStr()}
                          onChange={e => { setFromDate(e.target.value); if (toDate && e.target.value > toDate) setToDate('') }}
                          className="mt-1 w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
                        />
                      </label>
                      <label className="block">
                        <span className="text-gray-400 text-xs uppercase tracking-wider">To</span>
                        <input
                          type="date"
                          value={toDate}
                          min={fromDate || todayStr()}
                          onChange={e => setToDate(e.target.value)}
                          className="mt-1 w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
                        />
                      </label>
                    </div>
                    {days > 0 && (
                      <p className="text-emerald-400 text-sm mt-2">
                        Duration: {days} day{days > 1 ? 's' : ''}
                        {pricing.discount > 0 && <span className="text-amber-400 ml-2">({(pricing.discount * 100)}% bulk discount applied!)</span>}
                      </p>
                    )}
                  </Section>

                  {/* Units & Options */}
                  <Section title="Options">
                    <label className="block">
                      <span className="text-gray-400 text-xs uppercase tracking-wider">Number of Transplanters</span>
                      <select
                        value={quantity}
                        onChange={e => setQuantity(Number(e.target.value))}
                        className="mt-1 w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
                      >
                        {[1, 2, 3, 4, 5].map(n => (
                          <option key={n} value={n} className="bg-gray-900">{n}</option>
                        ))}
                      </select>
                    </label>

                    <div className="space-y-3 mt-4">
                      <Toggle label="Delivery & Pickup" sublabel={`₹${DELIVERY_FEE.toLocaleString('en-IN')} flat`} checked={delivery} onChange={setDelivery} />
                      <Toggle label="Damage Insurance" sublabel={`₹${INSURANCE_PER_DAY.toLocaleString('en-IN')}/day per unit`} checked={insurance} onChange={setInsurance} />
                      <Toggle label="Include Operator" sublabel="₹1,500/day — trained operator provided" checked={operatorNeeded} onChange={setOperatorNeeded} />
                    </div>
                  </Section>

                  {/* Farm Details */}
                  <Section title="Farm Details">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <label className="block">
                        <span className="text-gray-400 text-xs uppercase tracking-wider">Farm Size (acres)</span>
                        <input
                          type="number"
                          min="0"
                          step="0.5"
                          value={acreage}
                          onChange={e => setAcreage(e.target.value)}
                          placeholder="e.g. 5"
                          className="mt-1 w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white placeholder:text-gray-600 focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
                        />
                      </label>
                      <label className="block">
                        <span className="text-gray-400 text-xs uppercase tracking-wider">Crop / Sapling Type</span>
                        <input
                          type="text"
                          value={cropType}
                          onChange={e => setCropType(e.target.value)}
                          placeholder="e.g. Paddy, Tomato"
                          className="mt-1 w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white placeholder:text-gray-600 focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
                        />
                      </label>
                    </div>
                  </Section>

                  {/* Contact Info */}
                  <Section title="Contact Information">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <label className="block">
                        <span className="text-gray-400 text-xs uppercase tracking-wider">Full Name *</span>
                        <input
                          type="text"
                          value={name}
                          onChange={e => setName(e.target.value)}
                          placeholder="Your name"
                          className="mt-1 w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white placeholder:text-gray-600 focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
                        />
                      </label>
                      <label className="block">
                        <span className="text-gray-400 text-xs uppercase tracking-wider">Phone Number *</span>
                        <input
                          type="tel"
                          value={phone}
                          onChange={e => setPhone(e.target.value)}
                          placeholder="+91 XXXXX XXXXX"
                          className="mt-1 w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white placeholder:text-gray-600 focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
                        />
                      </label>
                    </div>
                    <label className="block mt-4">
                      <span className="text-gray-400 text-xs uppercase tracking-wider">Delivery Address *</span>
                      <textarea
                        value={address}
                        onChange={e => setAddress(e.target.value)}
                        rows={2}
                        placeholder="Farm / village address for delivery"
                        className="mt-1 w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white placeholder:text-gray-600 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 resize-none"
                      />
                    </label>
                    <label className="block mt-4">
                      <span className="text-gray-400 text-xs uppercase tracking-wider">Additional Notes</span>
                      <textarea
                        value={notes}
                        onChange={e => setNotes(e.target.value)}
                        rows={2}
                        placeholder="Any special requirements..."
                        className="mt-1 w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white placeholder:text-gray-600 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 resize-none"
                      />
                    </label>
                  </Section>

                  {/* Price Summary */}
                  {days > 0 && (
                    <div className="bg-white/5 border border-white/10 rounded-2xl p-5 space-y-2 text-sm">
                      <h3 className="text-white font-bold text-base mb-3">Price Estimate</h3>
                      <Row label={`Base rent (${days}d × ${quantity} unit${quantity > 1 ? 's' : ''} × ₹${RATE_PER_DAY.toLocaleString('en-IN')})`} value={pricing.base} />
                      {delivery && <Row label="Delivery & Pickup" value={pricing.deliveryCost} />}
                      {insurance && <Row label={`Insurance (${days}d × ${quantity} × ₹${INSURANCE_PER_DAY})`} value={pricing.insuranceCost} />}
                      {operatorNeeded && <Row label={`Operator (${days}d × ₹1,500)`} value={pricing.operatorCost} />}
                      {pricing.discountAmt > 0 && <Row label={`Bulk discount (${pricing.discount * 100}%)`} value={-pricing.discountAmt} green />}
                      <div className="border-t border-white/10 pt-2 mt-2 flex justify-between text-white font-bold text-base">
                        <span>Estimated Total</span>
                        <span>₹{pricing.total.toLocaleString('en-IN')}</span>
                      </div>
                      <p className="text-gray-500 text-xs mt-1">* Final amount confirmed after inspection. GST extra if applicable.</p>
                    </div>
                  )}

                  {/* Submit */}
                  <button
                    onClick={handleSubmit}
                    disabled={!canSubmit}
                    className={`w-full py-4 rounded-2xl font-bold text-lg transition-all ${
                      canSubmit
                        ? 'bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-600 hover:to-orange-700 text-white shadow-xl hover:scale-[1.02]'
                        : 'bg-gray-800 text-gray-500 cursor-not-allowed'
                    }`}
                  >
                    Submit Hire Request
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      </main>
    </>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-white/5 border border-white/10 rounded-2xl p-5 space-y-3">
      <h2 className="text-white font-bold text-base">{title}</h2>
      {children}
    </div>
  )
}

function Toggle({ label, sublabel, checked, onChange }: { label: string; sublabel: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex items-center justify-between cursor-pointer">
      <div>
        <span className="text-white text-sm">{label}</span>
        <span className="block text-gray-500 text-xs">{sublabel}</span>
      </div>
      <div
        onClick={() => onChange(!checked)}
        className={`w-11 h-6 rounded-full relative transition-colors ${checked ? 'bg-emerald-500' : 'bg-gray-700'}`}
      >
        <div className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${checked ? 'translate-x-5' : ''}`} />
      </div>
    </label>
  )
}

function Row({ label, value, green }: { label: string; value: number; green?: boolean }) {
  const formatted = value < 0 ? `- ₹${Math.abs(value).toLocaleString('en-IN')}` : `₹${value.toLocaleString('en-IN')}`
  return (
    <div className="flex justify-between text-gray-300">
      <span>{label}</span>
      <span className={green ? 'text-emerald-400' : ''}>{formatted}</span>
    </div>
  )
}
