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

import { button, card, container, footer, h1, main, text } from './styles.ts'

const BRAND = 'Flea'

interface RecoveryEmailProps {
  siteName: string
  confirmationUrl: string
}

export const RecoveryEmail = ({ confirmationUrl }: RecoveryEmailProps) => (
  <Html lang="en" dir="ltr">
    <Head />
    <Preview>Reset your password for {BRAND}</Preview>
    <Body style={main}>
      <Container style={container}>
        <Section style={card}>
          <Heading style={h1}>Reset your password 🔐</Heading>
          <Text style={text}>
            We received a request to reset your password for {BRAND}. Tap below
            to choose a new one.
          </Text>
          <Button style={button} href={confirmationUrl}>
            Reset password
          </Button>
          <Text style={footer}>
            Didn't request this? You can safely ignore this email — your
            password won't change.
          </Text>
        </Section>
      </Container>
    </Body>
  </Html>
)

export default RecoveryEmail
