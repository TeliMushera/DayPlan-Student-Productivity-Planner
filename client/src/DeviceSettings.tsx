import { useEffect, useState } from 'react'
import { api } from './api'
import { Btn, Card } from './components'
import type { InstallPromptEvent } from './types'

function appIsInstalled() {
  return window.matchMedia('(display-mode: standalone)').matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true
}

function isAppleMobile() {
  return /iPhone|iPad|iPod/.test(navigator.userAgent) ||
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
}

function applicationServerKey(value: string) {
  const padded = value + '='.repeat((4 - value.length % 4) % 4)
  const decoded = atob(padded.replace(/-/g, '+').replace(/_/g, '/'))
  return Uint8Array.from(decoded, char => char.charCodeAt(0))
}

export function DeviceSettings({ installPrompt, onInstallPromptUsed }: {
  installPrompt: InstallPromptEvent | null
  onInstallPromptUsed: () => void
}) {
  const [installed, setInstalled] = useState(appIsInstalled())
  const [subscribed, setSubscribed] = useState(false)
  const [configured, setConfigured] = useState(false)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const iosNeedsInstall = isAppleMobile() && !installed

  useEffect(() => {
    let alive = true
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
      setError('Push notifications are not supported by this browser.')
      return
    }
    navigator.serviceWorker.ready
      .then(async registration => {
        const subscription = await registration.pushManager.getSubscription()
        const query = subscription ? `?endpoint=${encodeURIComponent(subscription.endpoint)}` : ''
        return api.get('/push/status' + query)
      })
      .then(status => {
        if (!alive) return
        setConfigured(status.configured)
        setSubscribed(Boolean(status.subscribed))
      })
      .catch(reason => {
        if (alive) setError(reason instanceof Error ? reason.message : 'Could not check push notification status.')
      })
    return () => { alive = false }
  }, [])

  const enablePush = async () => {
    setBusy(true); setError(''); setMessage('')
    try {
      if (iosNeedsInstall) throw new Error('First add DayPlan to your Home Screen, then open the installed app and enable notifications.')
      if (!('Notification' in window) || !('PushManager' in window) || !('serviceWorker' in navigator))
        throw new Error('This browser does not support push notifications.')
      const permission = await Notification.requestPermission()
      if (permission !== 'granted') throw new Error('Allow notifications in your browser to receive reminders.')
      const { configured: serverConfigured, publicKey } = await api.get('/push/public-key')
      if (!serverConfigured || !publicKey) throw new Error('Push is not configured on the server yet. Add the VAPID environment variables to your hosting service.')
      const registration = await navigator.serviceWorker.ready
      let subscription = await registration.pushManager.getSubscription()
      if (!subscription) subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: applicationServerKey(publicKey)
      })
      await api.post('/push/subscribe', {
        subscription: subscription.toJSON(),
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone
      })
      setConfigured(true)
      setSubscribed(true)
      setMessage('Reminders are enabled on this device.')
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Could not enable push notifications.')
    } finally {
      setBusy(false)
    }
  }

  const disablePush = async () => {
    setBusy(true); setError(''); setMessage('')
    try {
      const registration = await navigator.serviceWorker.ready
      const subscription = await registration.pushManager.getSubscription()
      if (subscription) {
        await api.del('/push/subscribe?endpoint=' + encodeURIComponent(subscription.endpoint))
        await subscription.unsubscribe()
      }
      setSubscribed(false)
      setMessage('Reminders are disabled on this device.')
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Could not disable push notifications.')
    } finally {
      setBusy(false)
    }
  }

  const sendTest = async () => {
    setBusy(true); setError(''); setMessage('')
    try {
      const registration = await navigator.serviceWorker.ready
      const subscription = await registration.pushManager.getSubscription()
      if (!subscription) throw new Error('Enable push notifications on this device first.')
      await api.post('/push/test', { endpoint: subscription.endpoint })
      setMessage('Test notification sent. It may take a few seconds to arrive.')
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Could not send a test notification.')
    } finally {
      setBusy(false)
    }
  }

  const installApp = async () => {
    if (!installPrompt) return
    await installPrompt.prompt()
    await installPrompt.userChoice
    onInstallPromptUsed()
    setInstalled(appIsInstalled())
  }

  return <div className="space-y-4">
    <Card className="space-y-3">
      <div><h2 className="font-semibold">Install DayPlan on your phone</h2><p className="text-sm text-mute mt-1">Add it to your Home Screen to open it like an app.</p></div>
      {installed
        ? <p className="text-sm text-emerald-300">DayPlan is installed on this device.</p>
        : installPrompt
          ? <Btn onClick={installApp}>Install DayPlan</Btn>
          : <div className="text-sm text-mute space-y-1">
            {isAppleMobile()
              ? <p>In Safari, tap <strong className="text-ink">Share</strong>, then <strong className="text-ink">Add to Home Screen</strong>. Open DayPlan from the new Home Screen icon. iPhone push notifications require iOS 16.4 or later.</p>
              : <p>In Chrome, open the menu <strong className="text-ink">⋮</strong> and choose <strong className="text-ink">Install app</strong> or <strong className="text-ink">Add to Home screen</strong>.</p>}
          </div>}
    </Card>
    <Card className="space-y-3">
      <div><h2 className="font-semibold">Reminders on this device</h2><p className="text-sm text-mute mt-1">Push reminders can arrive when DayPlan is closed, as long as your phone and browser allow notifications.</p></div>
      {iosNeedsInstall && <p className="text-sm text-amber-200">Install DayPlan from Safari’s Share menu and open the installed app before enabling iPhone notifications.</p>}
      {!configured && <p className="text-sm text-amber-200">The server must be configured with VAPID keys before reminders can be enabled.</p>}
      {error && <p className="text-sm text-red-300" role="alert">{error}</p>}
      {message && <p className="text-sm text-emerald-300" role="status">{message}</p>}
      <div className="flex flex-wrap gap-2">
        {subscribed
          ? <><Btn v="ghost" disabled={busy} onClick={sendTest}>{busy ? 'Working…' : 'Send test notification'}</Btn><Btn v="danger" disabled={busy} onClick={disablePush}>Turn off on this device</Btn></>
          : <Btn disabled={busy || !configured || iosNeedsInstall} onClick={enablePush}>{busy ? 'Enabling…' : 'Enable reminders on this device'}</Btn>}
      </div>
      {subscribed && <p className="text-xs text-mute">This device is connected. Choose which reminders to receive below.</p>}
    </Card>
  </div>
}
