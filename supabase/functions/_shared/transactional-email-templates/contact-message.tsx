import * as React from 'npm:react@18.3.1'
import {
  Body,
  Container,
  Head,
  Heading,
  Hr,
  Html,
  Preview,
  Section,
  Text,
} from 'npm:@react-email/components@0.0.22'
import type { TemplateEntry } from './registry.ts'

const SITE_NAME = 'Sirvo'

interface ContactMessageProps {
  name?: string
  email?: string
  phone?: string
  subject?: string
  message?: string
}

const ContactMessageEmail = ({
  name = 'Visitante',
  email = 'não informado',
  phone = '',
  subject = 'Contato pelo site',
  message = '',
}: ContactMessageProps) => (
  <Html lang="pt-BR" dir="ltr">
    <Head />
    <Preview>{`Novo contato de ${name}: ${subject}`}</Preview>
    <Body style={main}>
      <Container style={container}>
        <Section>
          <Heading style={brand}>{SITE_NAME}</Heading>
          <Text style={tagline}>Nova mensagem do formulário de contato</Text>
        </Section>

        <Hr style={hr} />

        <Text style={label}>Nome</Text>
        <Text style={value}>{name}</Text>

        <Text style={label}>E-mail</Text>
        <Text style={value}>{email}</Text>

        {phone ? (
          <>
            <Text style={label}>Telefone</Text>
            <Text style={value}>{phone}</Text>
          </>
        ) : null}

        <Text style={label}>Assunto</Text>
        <Text style={value}>{subject}</Text>

        <Hr style={hr} />

        <Text style={label}>Mensagem</Text>
        <Text style={{ ...value, whiteSpace: 'pre-wrap' }}>{message}</Text>
      </Container>
    </Body>
  </Html>
)

export const template = {
  component: ContactMessageEmail,
  subject: (data: Record<string, any>) =>
    `[Contato Sirvo] ${data?.subject || 'Nova mensagem do site'}`,
  to: 'suporte@sirvo.app',
  displayName: 'Mensagem de contato',
  previewData: {
    name: 'Maria Silva',
    email: 'maria@exemplo.com',
    phone: '(11) 99999-9999',
    subject: 'Dúvida sobre planos',
    message: 'Olá, gostaria de saber mais sobre o Sirvo.',
  },
} satisfies TemplateEntry

const main = {
  backgroundColor: '#ffffff',
  fontFamily: "'Plus Jakarta Sans', Arial, sans-serif",
}

const container = {
  padding: '24px 28px',
  maxWidth: '600px',
  margin: '0 auto',
}

const brand = {
  fontSize: '24px',
  fontWeight: 800,
  color: '#1e3a8a',
  margin: '0',
}

const tagline = {
  fontSize: '13px',
  color: '#64748b',
  margin: '4px 0 0',
}

const hr = {
  borderColor: '#e2e8f0',
  margin: '20px 0',
}

const label = {
  fontSize: '12px',
  textTransform: 'uppercase' as const,
  letterSpacing: '0.05em',
  color: '#94a3b8',
  margin: '12px 0 2px',
}

const value = {
  fontSize: '15px',
  color: '#0f172a',
  margin: '0',
}
