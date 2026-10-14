import { createFileRoute } from '@tanstack/react-router'
import { PageContainer } from '@/shared/ui/page-container'

export const Route = createFileRoute('/')({
  component: () => (
    <PageContainer className="py-8">
      <h1 className="text-title font-bold">Kurio</h1>
    </PageContainer>
  ),
})
