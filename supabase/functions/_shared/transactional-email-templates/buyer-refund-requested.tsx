import * as React from 'npm:react@18.3.1'
import { Body, Container, Head, Heading, Html, Preview, Text, Section, Row, Column, Button } from 'npm:@react-email/components@0.0.22'
import { main, container, card, h1, text, button, footer } from './styles.ts'
import type { TemplateEntry } from './registry.ts'

interface Props {
  orderNumber?: string
  itemTitle?: string
  reason?: string
  chatUrl?: string
}

const Email = ({ orderNumber, itemTitle, reason, chatUrl }: Props) => (
  <Html lang="en" dir="ltr">
    <Head />
    <Preview>Your refund request has been sent{itemTitle ? ` — ${itemTitle}` : ''}.</Preview>
    <Body style={main}>
      <Container style={container}>
        <Section style={card}>
          <Heading style={h1}>Refund request sent.</Heading>
          <Text style={text}>
            We've passed your refund request for order {orderNumber ? `(#${orderNumber})` : ''} to the seller.
          </Text>

          {itemTitle && (
            <Row>
              <Column>
                <Text style={{ ...text, margin: '0 0 8px', fontWeight: 700 }}>Item: {itemTitle}</Text>
              </Column>
            </Row>
          )}

          {reason && <Text style={text}><strong>Reason:</strong> {reason}</Text>}

          <Text style={text}>
            The seller has 14 days to respond. You can reply to them directly in the order chat.
          </Text>

          {chatUrl && (
            <Button style={button} href={chatUrl}>Open order chat</Button>
          )}
        </Section>
        <Text style={footer}>You received this because you requested a refund on Flea.</Text>
      </Container>
    </Body>
  </Html>
)

export const template = {
  component: Email,
  subject: 'Your Flea refund request',
  displayName: 'Buyer: Refund Requested',
  previewData: {
    orderNumber: 'FL-001234',
    itemTitle: 'Nike Dunk Low Navy',
    reason: 'Item not as described',
    chatUrl: 'https://app.finditonflea.com/order-chat/00000000-0000-0000-0000-000000000000',
  },
} satisfies TemplateEntry
