import { useSyncExternalStore } from 'react'
import { SignalSlashIcon } from '@heroicons/react/16/solid'
import { CONNECTION_COPY } from '#/data/connection'

function subscribe(onChange: () => void) {
  window.addEventListener('online', onChange)
  window.addEventListener('offline', onChange)
  return () => {
    window.removeEventListener('online', onChange)
    window.removeEventListener('offline', onChange)
  }
}

/** A slim notice while the phone is offline, gone the moment it's back. Online on the server, so pages render clean. */
export function OfflineBar() {
  const online = useSyncExternalStore(
    subscribe,
    () => navigator.onLine,
    () => true,
  )
  if (online) return null
  return (
    <div role="status" className="bg-warning-soft text-warning">
      <p className="page flex items-center gap-2 py-2 text-sm font-medium">
        <SignalSlashIcon className="size-4 shrink-0" aria-hidden />
        {CONNECTION_COPY.offlineBar}
      </p>
    </div>
  )
}
