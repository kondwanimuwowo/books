import { createFileRoute } from '@tanstack/react-router'
import { getAuthor } from '#/functions/catalog.functions'
import { BookGrid, VerifiedMark, ZambianMark } from '#/components/book'

export const Route = createFileRoute('/authors/$slug')({
  loader: ({ params }) => getAuthor({ data: { slug: params.slug } }),
  head: ({ loaderData }) => ({ meta: loaderData ? [{ title: `${loaderData.name} | Kuwala Books` }] : [] }),
  component: AuthorPage,
})

function AuthorPage() {
  const author = Route.useLoaderData()
  return (
    <div className="page py-10">
      <div className="flex flex-col gap-6 sm:flex-row sm:items-center">
        {author.photoUrl ? (
          <img src={author.photoUrl} alt="" className="h-24 w-24 rounded-full object-cover" />
        ) : (
          <div className="flex h-24 w-24 items-center justify-center rounded-full bg-accent-100 text-3xl font-semibold text-accent-800" aria-hidden>
            {author.name.charAt(0)}
          </div>
        )}
        <div>
          <h1 className="text-3xl">{author.name}</h1>
          <div className="mt-2 flex flex-wrap items-center gap-3">
            {author.isZambian && <ZambianMark />}
            {author.verifiedSellerId && <VerifiedMark label="Verified author" />}
          </div>
        </div>
      </div>
      {author.bio && <p className="mt-6 max-w-2xl leading-relaxed whitespace-pre-line text-neutral-800">{author.bio}</p>}
      <h2 className="mt-10 mb-5 text-xl">Books</h2>
      <BookGrid books={author.books} />
    </div>
  )
}
