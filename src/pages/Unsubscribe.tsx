import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Loader2, CheckCircle2, AlertCircle } from 'lucide-react'
import { supabase } from '@/integrations/supabase/client'
import { Button } from '@/components/ui/button'

export default function Unsubscribe() {
  const [searchParams] = useSearchParams()
  const token = searchParams.get('token')
  const [status, setStatus] = useState<'validating' | 'valid' | 'invalid' | 'confirmed' | 'error'>('validating')
  const [email, setEmail] = useState<string | null>(null)

  useEffect(() => {
    if (!token) {
      setStatus('invalid')
      return
    }

    let cancelled = false
    supabase.functions
      .invoke('handle-email-unsubscribe', {
        body: { token, validate_only: true },
      })
      .then(({ data, error }) => {
        if (cancelled) return
        if (error || !data?.valid) {
          setStatus('invalid')
          return
        }
        setEmail(data.email ?? null)
        setStatus('valid')
      })
      .catch(() => {
        if (!cancelled) setStatus('error')
      })

    return () => {
      cancelled = true
    }
  }, [token])

  const confirm = async () => {
    if (!token) return
    setStatus('validating')
    try {
      const { data, error } = await supabase.functions.invoke('handle-email-unsubscribe', {
        body: { token },
      })
      if (error || !data?.success) {
        setStatus('error')
        return
      }
      setStatus('confirmed')
    } catch {
      setStatus('error')
    }
  }

  return (
    <div className="fixed inset-0 bg-background flex flex-col items-center justify-center p-6">
      <div className="w-full max-w-sm bg-card rounded-3xl p-6 shadow-sm border text-center">
        {status === 'validating' && (
          <>
            <Loader2 className="mx-auto h-8 w-8 animate-spin text-primary mb-4" />
            <h1 className="text-lg font-semibold">Checking your link...</h1>
          </>
        )}

        {status === 'valid' && (
          <>
            <h1 className="text-xl font-bold mb-2">Unsubscribe from order emails?</h1>
            <p className="text-muted-foreground text-sm mb-6">
              {email ? `Stop sending order and sale emails to ${email}.` : 'Stop sending order and sale emails to this address.'}
            </p>
            <Button onClick={confirm} className="w-full rounded-full">
              Unsubscribe
            </Button>
          </>
        )}

        {status === 'confirmed' && (
          <>
            <CheckCircle2 className="mx-auto h-10 w-10 text-primary mb-4" />
            <h1 className="text-xl font-bold mb-2">You're unsubscribed.</h1>
            <p className="text-muted-foreground text-sm">
              You won't receive any more order or sale emails from Flea.
            </p>
          </>
        )}

        {(status === 'invalid' || status === 'error') && (
          <>
            <AlertCircle className="mx-auto h-10 w-10 text-destructive mb-4" />
            <h1 className="text-xl font-bold mb-2">Link expired or invalid</h1>
            <p className="text-muted-foreground text-sm">
              This unsubscribe link has already been used or is no longer valid.
            </p>
          </>
        )}
      </div>
    </div>
  )
}
