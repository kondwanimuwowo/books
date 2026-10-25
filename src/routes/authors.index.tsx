import { createFileRoute } from '@tanstack/react-router'
import { getDirectory, directorySchema } from '#/functions/catalog.functions'
import { DirectoryPage } from '#/components/directory'
import { PageShapes, Placeholder, RowShapes } from '#/components/placeholder'
import { DIRECTORY } from '#/data/directory'

export const Route = createFileRoute('/authors/')({
  validateSearch: directorySchema.pick({ zambian: true, verified: true, tier: true }),
  loaderDeps: ({ search }) => ({ zambian: search.zambian, verified: search.verified, tier: search.tier }),
  loader: ({ deps }) => getDirectory({ data: { kind: 'authors', zambian: deps.zambian, verified: deps.verified, tier: deps.tier } }),
  pendingComponent: () => (
    <Placeholder
      mode="loading"
      label="Loading authors"
      shapes={
        <PageShapes>
          <RowShapes count={6} cover={false} />
        </PageShapes>
      }
    />
  ),
  head: () => ({ meta: [{ title: 'Authors | Kuwala Books' }, { name: 'description', content: DIRECTORY.authors.description }] }),
  component: AuthorsDirectory,
})

function AuthorsDirectory() {
  const entries = Route.useLoaderData()
  const { zambian, verified, tier } = Route.useSearch()
  return <DirectoryPage kind="authors" entries={entries} zambian={!!zambian} verified={!!verified} tier={tier} />
}
