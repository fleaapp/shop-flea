import * as React from 'npm:react@18.3.1'
import { Body, Container, Head, Heading, Html, Preview, Text, Section, Row, Column } from 'npm:@react-email/components@0.0.22'
import { main, container, card, h1, text, footer } from './styles.ts'
import type { TemplateEntry } from './registry.ts'

interface Props {
  orderNumber?: string
  itemTitle?: string
  amount?: string
}

const Email = ({ orderNumber, itemTitle, amount }: Props) => (
  <Html lang="en" dir="ltr">
    <Head />
    <Preview>Your refund has been processed{itemTitle ? ` — ${itemTitle}` : ''}.</Preview>
    <Body style={main}>
      <Container style={container}>
        <Section style={card}>
          <Heading style={h1}>Refund sent.</Heading>
          <Text style={text}>
            Your refund for order {orderNumber ? `(#${orderNumber})` : ''} has been processed.
          </Text>

          {itemTitle && (
            <Row>
              <Column>
                <Text style={{ ...text, margin: '0 0 8px', fontWeight: 700 }}>Item: {itemTitle}</Text>
              </Column>
            </Row>
          )}

          {amount && <Text style={text}><strong>Refund amount:</strong> {amount}</Text>}

          <Text style={text}>
            Funds usually appear straight away, but some banks can take up to 5 business days.
          </Text>
        </Section>
        <Text style={footer}>You received this because a refund was issued for your Flea order.</Text>
      </Container>
    </Body>
  </Html>
)

export const template = {
  component: Email,
  subject: 'Your Flea refund has been sent',
  displayName: 'Buyer: Refund Sent',
  previewData: {
    orderNumber: 'FL-001234',
    itemTitle: 'Nike Dunk Low Navy',
    amount: '$89.00',
  },
} satisfies TemplateEntry
