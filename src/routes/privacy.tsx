import { createFileRoute } from '@tanstack/react-router'
import { LegalStub } from '#/components/legal'

export const Route = createFileRoute('/privacy')({
  head: () => ({ meta: [{ title: 'Privacy policy | Kuwala Books' }] }),
  component: () => <LegalStub title="Privacy policy" />,
})
