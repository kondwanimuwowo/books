import { SITE_URL } from '#/data/share'

// WhatsApp, Facebook and X only fetch absolute URLs, and none of them render SVG.
const FALLBACK_IMAGE = '/icon-512.png'

/** Link-preview tags for a page. Image paths are made absolute; without one, the Kuwala mark shows. */
export function ogMeta({ title, description, path, image }: { title: string; description: string; path: string; image?: string | null }) {
  const src = image || FALLBACK_IMAGE
  return [
    { property: 'og:site_name', content: 'Kuwala Books' },
    { property: 'og:title', content: title },
    { property: 'og:description', content: description },
    { property: 'og:url', content: `${SITE_URL}${path}` },
    { property: 'og:image', content: src.startsWith('http') ? src : `${SITE_URL}${src}` },
    { name: 'twitter:card', content: image ? 'summary_large_image' : 'summary' },
  ]
}
