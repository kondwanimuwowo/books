import { createFileRoute } from '@tanstack/react-router'
import { LegalStub } from '#/components/legal'

export const Route = createFileRoute('/terms')({
  head: () => ({ meta: [{ title: 'Terms of use | Kuwala Books' }] }),
  component: () => <LegalStub title="Terms of use" />,
})
