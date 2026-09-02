/// <reference types="npm:@types/react@18.3.1" />
import * as React from 'npm:react@18.3.1'

export interface TemplateEntry {
  component: React.ComponentType<any>
  subject: string | ((data: Record<string, any>) => string)
  to?: string
  displayName?: string
  previewData?: Record<string, any>
}

import { template as churchInvitation } from './church-invitation.tsx'
import { template as contactMessage } from './contact-message.tsx'

export const TEMPLATES: Record<string, TemplateEntry> = {
  'church-invitation': churchInvitation,
  'contact-message': contactMessage,
}
