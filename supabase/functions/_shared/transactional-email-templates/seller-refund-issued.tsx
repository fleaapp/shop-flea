import * as React from 'npm:react@18.3.1'
import { Body, Container, Head, Heading, Html, Preview, Text, Section, Row, Column } from 'npm:@react-email/components@0.0.22'
import { main, container, card, h1, text, footer } from './styles.ts'
import type { TemplateEntry } from './registry.ts'

interface Props {
  orderNumber?: string
  itemTitle?: string
  amount?: string
  reason?: string
}

const Email = ({ orderNumber, itemTitle, amount, reason }: Props) => (
  <Html lang="en" dir="ltr">
    <Head />
    <Preview>A refund was issued for your sale{itemTitle ? ` — ${itemTitle}` : ''}.</Preview>
    <Body style={main}>
      <Container style={container}>
        <Section style={card}>
          <Heading style={h1}>Refund issued.</Heading>
          <Text style={text}>
            A refund was issued for your sale {orderNumber ? `(#${orderNumber})` : ''}.
          </Text>

          {itemTitle && (
            <Row>
              <Column>
                <Text style={{ ...text, margin: '0 0 8px', fontWeight: 700 }}>Item: {itemTitle}</Text>
              </Column>
            </Row>
          )}

          {amount && <Text style={text}><strong>Refund amount:</strong> {amount}</Text>}
          {reason && <Text style={text}><strong>Reason:</strong> {reason}</Text>}

          <Text style={text}>
            The sale has been reversed and any held funds have been released from your balance.
          </Text>
        </Section>
        <Text style={footer}>You received this because a refund was issued for your Flea sale.</Text>
      </Container>
    </Body>
  </Html>
)

export const template = {
  component: Email,
  subject: 'Refund issued for your Flea sale',
  displayName: 'Seller: Refund Issued',
  previewData: {
    orderNumber: 'FL-001234',
    itemTitle: 'Nike Dunk Low Navy',
    amount: '$89.00',
    reason: 'Buyer requested refund',
  },
} satisfies TemplateEntry
