import * as React from 'npm:react@18.3.1'
import { Body, Container, Head, Heading, Html, Preview, Text, Section, Button } from 'npm:@react-email/components@0.0.22'
import { main, container, card, h1, text, button, footer } from './styles.ts'
import type { TemplateEntry } from './registry.ts'

interface Props {
  amount?: string
  dashboardUrl?: string
}

const Email = ({ amount, dashboardUrl }: Props) => (
  <Html lang="en" dir="ltr">
    <Head />
    <Preview>Your Flea payout is ready.</Preview>
    <Body style={main}>
      <Container style={container}>
        <Section style={card}>
          <Heading style={h1}>Payout available.</Heading>
          <Text style={text}>
            {amount ? `${amount} is now available` : 'Funds are now available'} in your Flea seller balance and ready to be paid out to your bank.
          </Text>

          {dashboardUrl && (
            <Button style={button} href={dashboardUrl}>Go to Seller Dashboard</Button>
          )}

          <Text style={{ ...text, margin: '24px 0 0' }}>
            Standard payouts usually land in your bank account within 1-2 business days.
          </Text>
        </Section>
        <Text style={footer}>You received this because you have a Flea seller balance.</Text>
      </Container>
    </Body>
  </Html>
)

export const template = {
  component: Email,
  subject: 'Your Flea payout is ready',
  displayName: 'Seller: Payout Available',
  previewData: {
    amount: '$82.94',
    dashboardUrl: 'https://app.finditonflea.com/seller-dashboard',
  },
} satisfies TemplateEntry
