import * as React from 'npm:react@18.3.1'
import { Body, Container, Head, Heading, Html, Preview, Text, Section, Row, Column, Button } from 'npm:@react-email/components@0.0.22'
import { main, container, card, h1, text, button, footer } from './styles.ts'
import type { TemplateEntry } from './registry.ts'

interface Props {
  orderNumber?: string
  itemTitle?: string
  daysSinceSold?: number
  orderUrl?: string
}

const Email = ({ orderNumber, itemTitle, daysSinceSold = 6, orderUrl }: Props) => (
  <Html lang="en" dir="ltr">
    <Head />
    <Preview>Don't forget to ship your order{itemTitle ? ` — ${itemTitle}` : ''}.</Preview>
    <Body style={main}>
      <Container style={container}>
        <Section style={card}>
          <Heading style={h1}>Ship this order soon.</Heading>
          <Text style={text}>
            It's been {daysSinceSold} days since you sold {itemTitle ? itemTitle : 'an item'} on Flea.
          </Text>

          {itemTitle && (
            <Row>
              <Column>
                <Text style={{ ...text, margin: '0 0 8px', fontWeight: 700 }}>Item: {itemTitle}</Text>
                {orderNumber && <Text style={{ ...text, margin: '0 0 24px' }}>Order: #{orderNumber}</Text>}
              </Column>
            </Row>
          )}

          <Text style={text}>
            Orders that aren't shipped with valid tracking within 8 days are automatically refunded to the buyer.
          </Text>

          {orderUrl && (
            <Button style={button} href={orderUrl}>Add tracking & ship</Button>
          )}
        </Section>
        <Text style={footer}>You received this because you have an open sale on Flea.</Text>
      </Container>
    </Body>
  </Html>
)

export const template = {
  component: Email,
  subject: 'Reminder: ship your Flea order',
  displayName: 'Seller: Shipping Reminder',
  previewData: {
    orderNumber: 'FL-001234',
    itemTitle: 'Nike Dunk Low Navy',
    daysSinceSold: 6,
    orderUrl: 'https://app.finditonflea.com/order-chat/00000000-0000-0000-0000-000000000000',
  },
} satisfies TemplateEntry
