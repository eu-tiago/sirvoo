import * as React from 'npm:react@18.3.1'
import {
  Body,
  Button,
  Container,
  Head,
  Heading,
  Html,
  Preview,
  Section,
  Text,
} from 'npm:@react-email/components@0.0.22'
import type { TemplateEntry } from './registry.ts'

const SITE_NAME = 'Sirvo'

interface ChurchInvitationProps {
  churchName?: string
  inviterName?: string
  roleLabel?: string
  inviteUrl?: string
}

const ChurchInvitationEmail = ({
  churchName = 'sua igreja',
  inviterName = 'Um líder',
  roleLabel = 'Voluntário',
  inviteUrl = '#',
}: ChurchInvitationProps) => (
  <Html lang="pt-BR" dir="ltr">
    <Head />
    <Preview>{`${inviterName} convidou você para ${churchName} no ${SITE_NAME}`}</Preview>
    <Body style={main}>
      <Container style={container}>
        <Section style={brandRow}>
          <Heading style={brand}>{SITE_NAME}</Heading>
          <Text style={tagline}>Gestão de Voluntários</Text>
        </Section>

        <Heading style={h1}>Você foi convidado! 🎉</Heading>

        <Text style={text}>
          <strong>{inviterName}</strong> convidou você para fazer parte da
          equipe de voluntários da <strong>{churchName}</strong> no {SITE_NAME}.
        </Text>

        <Section style={infoBox}>
          <Text style={infoText}>
            <strong>Sua função:</strong> {roleLabel}
          </Text>
        </Section>

        <Text style={text}>
          Com o {SITE_NAME}, você poderá visualizar suas escalas, confirmar
          participação e muito mais!
        </Text>

        <Section style={{ textAlign: 'center', margin: '32px 0' }}>
          <Button href={inviteUrl} style={button}>
            Aceitar convite e criar conta
          </Button>
        </Section>

        <Text style={footer}>
          Este convite expira em 7 dias. Se você não esperava este convite,
          pode ignorar este email.
        </Text>
      </Container>
    </Body>
  </Html>
)

export const template = {
  component: ChurchInvitationEmail,
  subject: (data: Record<string, any>) =>
    `Convite para ${data?.churchName ?? SITE_NAME} - ${SITE_NAME}`,
  displayName: 'Convite para igreja',
  previewData: {
    churchName: 'Igreja Exemplo',
    inviterName: 'Pastor João',
    roleLabel: 'Voluntário',
    inviteUrl: 'https://sirvo.app/convite/exemplo',
  },
} satisfies TemplateEntry

const main = {
  backgroundColor: '#ffffff',
  fontFamily:
    '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
}
const container = {
  maxWidth: '600px',
  margin: '0 auto',
  padding: '40px 25px',
}
const brandRow = { textAlign: 'center' as const, marginBottom: '30px' }
const brand = {
  color: '#5B7BFF',
  margin: 0,
  fontSize: '28px',
  fontWeight: 'bold' as const,
}
const tagline = { color: '#666', marginTop: '8px', fontSize: '14px' }
const h1 = {
  color: '#111',
  fontSize: '22px',
  fontWeight: 'bold' as const,
  margin: '0 0 16px',
}
const text = {
  color: '#444',
  fontSize: '15px',
  lineHeight: '1.6',
  margin: '0 0 16px',
}
const infoBox = {
  backgroundColor: '#f0f4ff',
  borderRadius: '8px',
  padding: '16px',
  margin: '20px 0',
}
const infoText = { margin: 0, color: '#333', fontSize: '14px' }
const button = {
  background: '#5B7BFF',
  color: '#ffffff',
  textDecoration: 'none',
  padding: '14px 32px',
  borderRadius: '8px',
  fontWeight: 600,
  fontSize: '16px',
  display: 'inline-block',
}
const footer = {
  color: '#888',
  fontSize: '13px',
  textAlign: 'center' as const,
  marginTop: '32px',
}
