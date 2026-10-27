import { createFileRoute } from '@tanstack/react-router'
import { getDirectory } from '#/functions/catalog.functions'
import { directorySchema } from '#/schemas/catalog'
import { DirectoryPage } from '#/components/directory'
import { PageShapes, Placeholder, RowShapes } from '#/components/placeholder'
import { DIRECTORY } from '#/data/directory'

export const Route = createFileRoute('/publishers/')({
  validateSearch: directorySchema.pick({ zambian: true }),
  loaderDeps: ({ search }) => ({ zambian: search.zambian }),
  loader: ({ deps }) => getDirectory({ data: { kind: 'publishers', zambian: deps.zambian } }),
  pendingComponent: () => (
    <Placeholder
      mode="loading"
      label="Loading publishers"
      shapes={
        <PageShapes>
          <RowShapes count={6} cover={false} />
        </PageShapes>
      }
    />
  ),
  head: () => ({ meta: [{ title: 'Publishers | Kuwala Books' }, { name: 'description', content: DIRECTORY.publishers.description }] }),
  component: PublishersDirectory,
})

function PublishersDirectory() {
  const entries = Route.useLoaderData()
  const { zambian } = Route.useSearch()
  return <DirectoryPage kind="publishers" entries={entries} zambian={!!zambian} />
}
