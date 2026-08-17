import * as React from 'npm:react@18.3.1'
import { Body, Container, Head, Heading, Html, Preview, Text, Section, Row, Column, Button } from 'npm:@react-email/components@0.0.22'
import { main, container, card, h1, text, button, footer } from './styles.ts'
import type { TemplateEntry } from './registry.ts'

interface Props {
  orderNumber?: string
  itemTitle?: string
  itemCount?: number
  carrier?: string
  trackingNumber?: string
  trackingUrl?: string
}

const Email = ({ orderNumber, itemTitle, itemCount = 1, carrier, trackingNumber, trackingUrl }: Props) => (
  <Html lang="en" dir="ltr">
    <Head />
    <Preview>Your order is on the way{itemTitle ? ` — ${itemTitle}` : ''}.</Preview>
    <Body style={main}>
      <Container style={container}>
        <Section style={card}>
          <Heading style={h1}>It's on the way.</Heading>
          <Text style={text}>
            Good news — your order {orderNumber ? `(#${orderNumber})` : ''} has been shipped by the seller.
          </Text>

          {itemTitle && (
            <Row>
              <Column>
                <Text style={{ ...text, margin: '0 0 8px', fontWeight: 700 }}>
                  {itemTitle}{itemCount && itemCount > 1 ? ` + ${itemCount - 1} more` : ''}
                </Text>
              </Column>
            </Row>
          )}

          {(carrier || trackingNumber) && (
            <Text style={text}>
              {carrier && <><strong>Carrier:</strong> {carrier}<br /></>}
              {trackingNumber && <><strong>Tracking:</strong> {trackingNumber}</>}
            </Text>
          )}

          {trackingUrl && (
            <Button style={button} href={trackingUrl}>Track your parcel</Button>
          )}

          <Text style={{ ...text, margin: '24px 0 0' }}>
            We'll update you when it arrives.
          </Text>
        </Section>
        <Text style={footer}>You received this because you made a purchase on Flea.</Text>
      </Container>
    </Body>
  </Html>
)

export const template = {
  component: Email,
  subject: 'Your Flea order has shipped',
  displayName: 'Buyer: Order Shipped',
  previewData: {
    orderNumber: 'FL-001234',
    itemTitle: 'Nike Dunk Low Navy',
    itemCount: 1,
    carrier: 'Australia Post',
    trackingNumber: 'ABC123456789',
    trackingUrl: 'https://auspost.com.au/mypost/track/#/details/ABC123456789',
  },
} satisfies TemplateEntry
