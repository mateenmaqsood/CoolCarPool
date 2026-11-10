import { redirect } from 'next/navigation'

/** The marketing root just hands off to the (protected) feed. */
export default function RootPage() {
  redirect('/feed')
}
