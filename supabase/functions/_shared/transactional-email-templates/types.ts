import * as React from 'npm:react@18.3.1'

export type TemplateEntry = {
  component: React.FC<any>
  subject: string | ((data: Record<string, any>) => string)
  displayName?: string
  previewData?: Record<string, any>
  to?: string
}
