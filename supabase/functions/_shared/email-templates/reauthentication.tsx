/// <reference types="npm:@types/react@18.3.1" />

import * as React from 'npm:react@18.3.1'

import {
  Body,
  Container,
  Head,
  Heading,
  Html,
  Preview,
  Section,
  Text,
} from 'npm:@react-email/components@0.0.22'

interface ReauthenticationEmailProps {
  token: string
}

export const ReauthenticationEmail = ({ token }: ReauthenticationEmailProps) => (
  <Html lang="en" dir="ltr">
    <Head />
    <Preview>Your verification code</Preview>
    <Body style={main}>
      <Container style={container}>
        <Section style={card}>
          <Heading style={h1}>Confirm it's you 🔑</Heading>
          <Text style={text}>Use the code below to confirm your identity:</Text>
          <Text style={codeStyle}>{token}</Text>
          <Text style={footer}>
            This code expires shortly. Didn't request this? Safely ignore this email.
          </Text>
        </Section>
      </Container>
    </Body>
  </Html>
)

export default ReauthenticationEmail

const main = {
  backgroundColor: '#ffffff',
  fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
}
const container = { padding: '32px 20px', maxWidth: '480px', margin: '0 auto' }
const card = { backgroundColor: '#F4F2EB', borderRadius: '20px', padding: '32px 28px', textAlign: 'center' as const }
const h1 = {
  fontSize: '24px',
  fontWeight: '700' as const,
  color: '#363B47',
  margin: '0 0 16px',
  letterSpacing: '-0.01em',
}
const text = { fontSize: '15px', color: '#363B47', lineHeight: '1.55', margin: '0 0 16px' }
const codeStyle = {
  fontFamily: "'Courier New', monospace",
  fontSize: '32px',
  fontWeight: '700' as const,
  color: '#363B47',
  letterSpacing: '0.2em',
  margin: '16px 0 24px',
}
const footer = { fontSize: '12px', color: '#7A7E89', margin: '20px 0 0' }
