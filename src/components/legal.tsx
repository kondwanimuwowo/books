// Placeholder legal pages until the real policies are written.
export function LegalStub({ title }: { title: string }) {
  return (
    <article className="page rise max-w-2xl py-16 sm:py-24">
      <h1 className="text-3xl sm:text-4xl">{title}</h1>
      <p className="mt-3 text-muted">Coming soon.</p>
    </article>
  )
}
