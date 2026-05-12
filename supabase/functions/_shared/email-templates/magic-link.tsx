/// <reference types="npm:@types/react@18.3.1" />

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

const BRAND = 'Flea'

interface MagicLinkEmailProps {
  siteName: string
  confirmationUrl: string
}

export const MagicLinkEmail = ({ confirmationUrl }: MagicLinkEmailProps) => (
  <Html lang="en" dir="ltr">
    <Head />
    <Preview>Your login link for {BRAND}</Preview>
    <Body style={main}>
      <Container style={container}>
        <Section style={card}>
          <Heading style={h1}>Your login link ✨</Heading>
          <Text style={text}>
            Tap below to log in to {BRAND}. This link expires shortly.
          </Text>
          <Button style={button} href={confirmationUrl}>
            Log in
          </Button>
          <Text style={footer}>
            Didn't request this? You can safely ignore this email.
          </Text>
        </Section>
      </Container>
    </Body>
  </Html>
)

export default MagicLinkEmail

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
