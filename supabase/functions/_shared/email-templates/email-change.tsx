/// <reference types="npm:@types/react@18.3.1" />

import * as React from 'npm:react@18.3.1'

import {
  Body,
  Button,
  Container,
  Head,
  Heading,
  Html,
  Link,
  Preview,
  Section,
  Text,
} from 'npm:@react-email/components@0.0.22'

const BRAND = 'Flea'

interface EmailChangeEmailProps {
  siteName: string
  oldEmail: string
  email: string
  newEmail: string
  confirmationUrl: string
}

export const EmailChangeEmail = ({
  oldEmail,
  newEmail,
  confirmationUrl,
}: EmailChangeEmailProps) => (
  <Html lang="en" dir="ltr">
    <Head />
    <Preview>Confirm your email change for {BRAND}</Preview>
    <Body style={main}>
      <Container style={container}>
        <Section style={card}>
          <Heading style={h1}>Confirm your email change 📧</Heading>
          <Text style={text}>
            You requested to change your {BRAND} email from{' '}
            <Link href={`mailto:${oldEmail}`} style={link}>
              {oldEmail}
            </Link>{' '}
            to{' '}
            <Link href={`mailto:${newEmail}`} style={link}>
              {newEmail}
            </Link>
            .
          </Text>
          <Button style={button} href={confirmationUrl}>
            Confirm email change
          </Button>
          <Text style={footer}>
            Didn't request this? Please secure your account immediately.
          </Text>
        </Section>
      </Container>
    </Body>
  </Html>
)

export default EmailChangeEmail

const main = {
  backgroundColor: '#ffffff',
  fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
}
const container = { padding: '32px 20px', maxWidth: '480px', margin: '0 auto' }
const card = { backgroundColor: '#F4F2EB', borderRadius: '20px', padding: '32px 28px' }
const h1 = {
  fontSize: '24px',
  fontWeight: '700' as const,
  color: '#363B47',
  margin: '0 0 16px',
  letterSpacing: '-0.01em',
}
const text = { fontSize: '15px', color: '#363B47', lineHeight: '1.55', margin: '0 0 24px' }
const link = { color: '#363B47', textDecoration: 'underline' }
const button = {
  backgroundColor: '#363B47',
  color: '#ffffff',
  fontSize: '15px',
  fontWeight: '700' as const,
  borderRadius: '999px',
  padding: '14px 28px',
  textDecoration: 'none',
  display: 'inline-block',
}
const footer = { fontSize: '12px', color: '#7A7E89', margin: '28px 0 0' }
