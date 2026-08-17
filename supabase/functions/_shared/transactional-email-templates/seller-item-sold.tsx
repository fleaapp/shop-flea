import * as React from 'npm:react@18.3.1'
import { Body, Container, Head, Heading, Html, Preview, Text, Section, Row, Column, Button } from 'npm:@react-email/components@0.0.22'
import { main, container, card, h1, text, button, footer } from './styles.ts'
import type { TemplateEntry } from './registry.ts'

interface Props {
  orderNumber?: string
  itemTitle?: string
  itemCount?: number
  saleAmount?: string
  yourEarnings?: string
  shippingLabelUrl?: string
  orderUrl?: string
}

const Email = ({ orderNumber, itemTitle, itemCount = 1, saleAmount, yourEarnings, orderUrl }: Props) => (
  <Html lang="en" dir="ltr">
    <Head />
    <Preview>You made a sale{itemTitle ? ` — ${itemTitle}` : ''}.</Preview>
    <Body style={main}>
      <Container style={container}>
        <Section style={card}>
          <Heading style={h1}>You made a sale.</Heading>
          <Text style={text}>
            Someone bought your{itemTitle ? ` ${itemTitle}` : ' item'}{itemCount && itemCount > 1 ? ` and ${itemCount - 1} other item${itemCount - 1 === 1 ? '' : 's'}` : ''}.
          </Text>

          {itemTitle && (
            <Row>
              <Column>
                <Text style={{ ...text, margin: '0 0 8px', fontWeight: 700 }}>
                  {itemTitle}{itemCount && itemCount > 1 ? ` + ${itemCount - 1} more` : ''}
                </Text>
                {saleAmount && <Text style={{ ...text, margin: '0 0 8px' }}>Sale total: {saleAmount}</Text>}
                {yourEarnings && <Text style={{ ...text, margin: '0 0 24px' }}>Your earnings: {yourEarnings}</Text>}
              </Column>
            </Row>
          )}

          <Text style={text}>
            Ship within 3 days and add valid tracking to get paid.
          </Text>

          {orderUrl && (
            <Button style={button} href={orderUrl}>View order</Button>
          )}
        </Section>
        <Text style={footer}>You received this because you sold an item on Flea.</Text>
      </Container>
    </Body>
  </Html>
)

export const template = {
  component: Email,
  subject: 'You made a sale on Flea',
  displayName: 'Seller: Item Sold',
  previewData: {
    orderNumber: 'FL-001234',
    itemTitle: 'Nike Dunk Low Navy',
    itemCount: 1,
    saleAmount: '$89.00',
    yourEarnings: '$82.94',
    orderUrl: 'https://app.finditonflea.com/order-chat/00000000-0000-0000-0000-000000000000',
  },
} satisfies TemplateEntry
