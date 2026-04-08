import { BookingLoader } from './booking-wizard'

interface BookingPageProps {
  params: Promise<{ slug: string }>
}

export default async function BookingPage({ params }: BookingPageProps) {
  const { slug } = await params
  return <BookingLoader slug={slug} />
}
