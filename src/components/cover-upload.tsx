import { CameraIcon } from '@heroicons/react/24/solid'
import { useEffect, useState } from 'react'
import { uploadCover } from '#/functions/covers.functions'
import { cn } from '#/lib/utils'
import { Alert, errorMessage } from './form'

// A phone photo is 3-5 MB; this is enough for a sharp cover at a fraction of the data.
const MAX_EDGE = 1000

async function encode(canvas: HTMLCanvasElement, type: string, quality: number) {
  return new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, type, quality))
}

/** Shrink and re-encode on the phone before upload: WebP where supported, JPEG otherwise. */
async function compress(file: File): Promise<Blob> {
  const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' })
  const scale = Math.min(1, MAX_EDGE / Math.max(bitmap.width, bitmap.height))
  const canvas = document.createElement('canvas')
  canvas.width = Math.round(bitmap.width * scale)
  canvas.height = Math.round(bitmap.height * scale)
  canvas.getContext('2d')?.drawImage(bitmap, 0, 0, canvas.width, canvas.height)
  bitmap.close()
  const webp = await encode(canvas, 'image/webp', 0.8)
  if (webp?.type === 'image/webp') return webp
  const jpeg = await encode(canvas, 'image/jpeg', 0.82)
  if (!jpeg) throw new Error('Couldn’t read that photo')
  return jpeg
}

type State = { kind: 'empty' } | { kind: 'uploading'; preview: string } | { kind: 'done'; preview: string } | { kind: 'failed'; reason: string }

/** A cover-shaped tile: tap to photograph or pick the cover. Reports the stored key, or null when cleared. */
export function CoverUpload({
  onChange,
  onBusy,
  className,
}: {
  onChange: (cover: { key: string; preview: string } | null) => void
  onBusy?: (busy: boolean) => void
  className?: string
}) {
  const [state, setState] = useState<State>({ kind: 'empty' })
  const preview = state.kind === 'uploading' || state.kind === 'done' ? state.preview : null

  useEffect(() => () => (preview ? URL.revokeObjectURL(preview) : undefined), [preview])

  const pick = async (file: File | undefined) => {
    if (!file) return
    onBusy?.(true)
    try {
      const blob = await compress(file)
      const local = URL.createObjectURL(blob)
      setState({ kind: 'uploading', preview: local })
      onChange(null)
      const form = new FormData()
      form.append('cover', new File([blob], blob.type === 'image/webp' ? 'cover.webp' : 'cover.jpg', { type: blob.type }))
      const { key } = await uploadCover({ data: form })
      setState({ kind: 'done', preview: local })
      onChange({ key, preview: local })
    } catch (e) {
      setState({ kind: 'failed', reason: errorMessage(e) })
      onChange(null)
    } finally {
      onBusy?.(false)
    }
  }

  return (
    <div className={cn('space-y-2', className)}>
      <label
        className={cn(
          'relative flex aspect-[2/3] w-32 cursor-pointer flex-col items-center justify-center gap-2 overflow-hidden rounded-md text-center transition-shadow has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-accent-ink',
          preview ? 'shadow-md' : 'border-2 border-dashed border-line-strong text-subtle hover:border-accent-ink hover:text-accent-ink',
        )}
      >
        <input type="file" accept="image/*" className="sr-only" onChange={(e) => void pick(e.target.files?.[0])} aria-label="Cover photo" />
        {preview ? (
          <>
            <img src={preview} alt="" className="absolute inset-0 h-full w-full object-cover" />
            {state.kind === 'uploading' && (
              <span className="absolute inset-0 flex items-center justify-center bg-deep/50" role="status" aria-label="Uploading">
                <span aria-hidden className="block size-6 animate-spin rounded-full border-[3px] border-on-accent/30 border-t-on-accent motion-reduce:animate-none" />
              </span>
            )}
          </>
        ) : (
          <>
            <CameraIcon className="size-7" aria-hidden />
            <span className="px-2 text-xs font-medium">Add cover photo</span>
          </>
        )}
      </label>
      {state.kind === 'done' && <p className="text-xs text-subtle">Tap to change</p>}
      {state.kind === 'failed' && <Alert>{state.reason}</Alert>}
    </div>
  )
}
