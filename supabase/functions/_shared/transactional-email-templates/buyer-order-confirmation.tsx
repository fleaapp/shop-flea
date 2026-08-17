import * as React from 'npm:react@18.3.1'
import { Body, Container, Head, Heading, Html, Preview, Text, Section, Row, Column, Hr } from 'npm:@react-email/components@0.0.22'
import { main, container, card, h1, text, footer } from './styles.ts'
import type { TemplateEntry } from './registry.ts'

interface Props {
  orderNumber?: string
  itemTitle?: string
  itemCount?: number
  total?: string
  shippingAddress?: string
  estimatedDelivery?: string
}

const Email = ({ orderNumber, itemTitle, itemCount = 1, total, shippingAddress, estimatedDelivery }: Props) => (
  <Html lang="en" dir="ltr">
    <Head />
    <Preview>Thanks for your order{itemTitle ? ` — ${itemTitle}` : ''}.</Preview>
    <Body style={main}>
      <Container style={container}>
        <Section style={card}>
          <Heading style={h1}>Order confirmed.</Heading>
          <Text style={text}>
            Thanks for shopping on Flea. Your order {orderNumber ? `(#${orderNumber})` : ''} is confirmed and the seller has been notified.
          </Text>

          {itemTitle && (
            <Row>
              <Column>
                <Text style={{ ...text, margin: '0 0 8px', fontWeight: 700 }}>
                  {itemTitle}{itemCount && itemCount > 1 ? ` + ${itemCount - 1} more` : ''}
                </Text>
                {total && <Text style={{ ...text, margin: '0 0 24px' }}>Total paid: {total}</Text>}
              </Column>
            </Row>
          )}

          {shippingAddress && (
            <>
              <Hr style={{ borderColor: 'rgba(54,59,71,0.12)', margin: '0 0 16px' }} />
              <Text style={{ ...text, margin: '0 0 8px', fontWeight: 700 }}>Shipping to</Text>
              <Text style={{ ...text, margin: '0 0 24px' }}>{shippingAddress}</Text>
            </>
          )}

          {estimatedDelivery && (
            <Text style={text}>Estimated delivery: {estimatedDelivery}</Text>
          )}

          <Text style={{ ...text, margin: '24px 0 0' }}>
            We'll let you know once it's on the way.
          </Text>
        </Section>
        <Text style={footer}>You received this because you made a purchase on Flea.</Text>
      </Container>
    </Body>
  </Html>
)

export const template = {
  component: Email,
  subject: 'Your Flea order is confirmed',
  displayName: 'Buyer: Order Confirmation',
  previewData: {
    orderNumber: 'FL-001234',
    itemTitle: 'Nike Dunk Low Navy',
    itemCount: 1,
    total: '$89.00',
    shippingAddress: '123 Smith St, Melbourne VIC 3000',
    estimatedDelivery: '3-5 business days',
  },
} satisfies TemplateEntry
