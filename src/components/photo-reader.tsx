import { CameraIcon, XMarkIcon } from '@heroicons/react/24/solid'
import { useEffect, useRef, useState } from 'react'
import { readPhotos } from '#/functions/ai.functions'
import type { PhotoResult } from '#/functions/ai.functions'
import { PHOTO_COPY, PHOTO_SLOTS } from '#/data/ai'
import type { PhotoSlot } from '#/data/ai'
import { cn } from '#/lib/utils'
import { compress } from './cover-upload'
import { Alert, useAction } from './form'

// Larger than a cover upload: the copyright page's small print has to stay legible.
const READ_EDGE = 1600

type Picked = Partial<Record<PhotoSlot, { blob: Blob; preview: string }>>

/** Up to three photos of the book; Claude reads them and the listing form opens filled in. */
export function PhotoReader({ onRead }: { onRead: (result: PhotoResult) => void }) {
  const [picked, setPicked] = useState<Picked>({})

  const previews = useRef<string[]>([])
  useEffect(() => () => previews.current.forEach((url) => URL.revokeObjectURL(url)), [])

  const pick = async (slot: PhotoSlot, file: File | undefined) => {
    if (!file) return
    const blob = await compress(file, READ_EDGE)
    setPicked((current) => {
      if (current[slot]) URL.revokeObjectURL(current[slot].preview)
      const preview = URL.createObjectURL(blob)
      previews.current.push(preview)
      return { ...current, [slot]: { blob, preview } }
    })
  }

  const clear = (slot: PhotoSlot) =>
    setPicked((current) => {
      if (current[slot]) URL.revokeObjectURL(current[slot].preview)
      const { [slot]: _removed, ...rest } = current
      return rest
    })

  const read = useAction(async () => {
    const form = new FormData()
    for (const [slot, photo] of Object.entries(picked)) form.append(slot, new File([photo.blob], `${slot}.${photo.blob.type === 'image/webp' ? 'webp' : 'jpg'}`, { type: photo.blob.type }))
    onRead(await readPhotos({ data: form }))
  })

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted">{PHOTO_COPY.intro}</p>
      <div className="flex gap-3">
        {PHOTO_SLOTS.map(({ key, label }) => {
          const photo = picked[key]
          return (
            <div key={key} className="w-24 sm:w-28">
              <div className="relative">
                <label
                  className={cn(
                    'relative flex aspect-[2/3] cursor-pointer flex-col items-center justify-center gap-1.5 overflow-hidden rounded-md text-center has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-accent-ink',
                    photo ? 'shadow-md' : 'border-2 border-dashed border-line-strong text-subtle hover:border-accent-ink hover:text-accent-ink',
                  )}
                >
                  <input type="file" accept="image/*" capture="environment" className="sr-only" aria-label={label} onChange={(e) => void pick(key, e.target.files?.[0])} />
                  {photo ? <img src={photo.preview} alt="" className="absolute inset-0 h-full w-full object-cover" /> : <CameraIcon className="size-6" aria-hidden />}
                </label>
                {photo && (
                  <button
                    type="button"
                    onClick={() => clear(key)}
                    aria-label={`Remove ${label.toLowerCase()} photo`}
                    className="absolute -top-2 -right-2 grid size-6 place-items-center rounded-full bg-surface text-muted shadow-md hover:text-ink"
                  >
                    <XMarkIcon className="size-3.5" aria-hidden />
                  </button>
                )}
              </div>
              <p className="mt-1.5 text-xs font-medium text-muted">{label}</p>
            </div>
          )
        })}
      </div>
      {read.error && <Alert>{read.error}</Alert>}
      <button type="button" className="btn btn-primary" disabled={!picked.front || read.pending} onClick={() => void read.run()}>
        {read.pending ? PHOTO_COPY.reading : PHOTO_COPY.read}
      </button>
    </div>
  )
}
