import { CameraIcon, XMarkIcon } from '@heroicons/react/16/solid'
import { useState } from 'react'
import { uploadCover } from '#/functions/covers.functions'
import { MAX_LISTING_PHOTOS } from '#/data/listing-options'
import { compress } from './cover-upload'
import { Alert, errorMessage } from './form'
import { Spinner } from './loading-line'

export interface ListingPhoto {
  key: string
  url: string
}

/** Up to three photos of the actual copy. Each uploads as soon as it's picked; the form only keeps keys. */
export function ListingPhotos({ value, onChange, onBusy }: { value: ListingPhoto[]; onChange: (photos: ListingPhoto[]) => void; onBusy?: (busy: boolean) => void }) {
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const add = async (file: File | undefined) => {
    if (!file) return
    setError(null)
    setUploading(true)
    onBusy?.(true)
    try {
      const blob = await compress(file)
      const form = new FormData()
      form.append('cover', new File([blob], blob.type === 'image/webp' ? 'photo.webp' : 'photo.jpg', { type: blob.type }))
      const { key, url } = await uploadCover({ data: form })
      onChange([...value, { key, url }])
    } catch (e) {
      setError(errorMessage(e))
    } finally {
      setUploading(false)
      onBusy?.(false)
    }
  }

  return (
    <div className="space-y-2">
      <ul className="flex flex-wrap gap-3">
        {value.map((photo, i) => (
          <li key={photo.key} className="relative">
            <img src={photo.url} alt={`Photo ${i + 1} of your copy`} className="photo-in aspect-[3/4] w-24 rounded-lg object-cover shadow-sm" />
            <button
              type="button"
              onClick={() => onChange(value.filter((p) => p.key !== photo.key))}
              className="absolute -top-2 -right-2 grid size-7 place-items-center rounded-full bg-surface text-ink shadow-md transition-transform active:scale-90"
              aria-label={`Remove photo ${i + 1}`}
            >
              <XMarkIcon className="size-4" aria-hidden />
            </button>
          </li>
        ))}
        {value.length < MAX_LISTING_PHOTOS && (
          <li>
            <label className="flex aspect-[3/4] w-24 cursor-pointer flex-col items-center justify-center gap-1.5 rounded-lg border-2 border-dashed border-line-strong text-subtle transition-colors hover:border-accent-ink hover:text-accent-ink has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-accent-ink">
              <input type="file" accept="image/*" capture="environment" className="sr-only" disabled={uploading} onChange={(e) => (void add(e.target.files?.[0]), (e.target.value = ''))} aria-label="Add a photo of your copy" />
              {uploading ? <Spinner className="size-5" /> : <CameraIcon className="size-6" aria-hidden />}
              <span className="text-xs font-medium">{uploading ? 'Adding…' : 'Add photo'}</span>
            </label>
          </li>
        )}
      </ul>
      {error && <Alert>{error}</Alert>}
    </div>
  )
}
