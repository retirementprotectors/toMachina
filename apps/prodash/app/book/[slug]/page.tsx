import { BookingWizard } from './booking-wizard'

interface BookingPageProps {
  params: Promise<{ slug: string }>
}

export default async function BookingPage({ params }: BookingPageProps) {
  const { slug } = await params

  // Fetch config server-side for fast initial render
  const apiBase = process.env.NEXT_PUBLIC_API_URL || process.env.API_URL || 'http://localhost:8080'
  let configData = null
  let error = ''

  try {
    const res = await fetch(`${apiBase}/api/booking/config/${slug}`, {
      cache: 'no-store',
    })
    if (res.ok) {
      const json = await res.json()
      if (json.success) configData = json.data
      else error = json.error || 'Configuration not found'
    } else if (res.status === 404) {
      error = 'not_found'
    } else {
      error = `Unable to load booking page (${res.status})`
    }
  } catch {
    error = 'Unable to connect to booking service'
  }

  if (error === 'not_found' || (!configData && !error)) {
    return (
      <div style={{ textAlign: 'center', padding: '80px 20px' }}>
        <div style={{ fontSize: 48, marginBottom: 16, opacity: 0.3 }}>404</div>
        <h1 style={{ fontSize: '1.25rem', fontWeight: 600, marginBottom: 8 }}>Booking Page Not Found</h1>
        <p style={{ color: '#94a3b8', fontSize: '0.9rem' }}>
          The booking link you followed may be outdated or incorrect.
        </p>
      </div>
    )
  }

  if (error) {
    return (
      <div style={{ textAlign: 'center', padding: '80px 20px' }}>
        <div style={{ fontSize: 48, marginBottom: 16, opacity: 0.3 }}>
          <span className="material-icons-outlined" style={{ fontSize: 48 }}>error_outline</span>
        </div>
        <h1 style={{ fontSize: '1.25rem', fontWeight: 600, marginBottom: 8 }}>Something went wrong</h1>
        <p style={{ color: '#94a3b8', fontSize: '0.9rem' }}>{error}</p>
      </div>
    )
  }

  return <BookingWizard config={configData} slug={slug} />
}
