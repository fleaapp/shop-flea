import * as React from 'npm:react@18.3.1'
import { Body, Container, Head, Heading, Html, Preview, Text, Section, Row, Column, Button } from 'npm:@react-email/components@0.0.22'
import { main, container, card, h1, text, button, footer } from './styles.ts'
import type { TemplateEntry } from './registry.ts'

interface Props {
  status?: 'accepted' | 'declined' | 'expired'
  itemTitle?: string
  offerAmount?: string
  listingUrl?: string
}

const Email = ({ status, itemTitle, offerAmount, listingUrl }: Props) => {
  const statusText = status === 'accepted' ? 'accepted' : status === 'declined' ? 'declined' : 'expired'
  return (
    <Html lang="en" dir="ltr">
      <Head />
      <Preview>Your offer {statusText}{itemTitle ? ` — ${itemTitle}` : ''}.</Preview>
      <Body style={main}>
        <Container style={container}>
          <Section style={card}>
            <Heading style={h1}>Offer {statusText}.</Heading>
            <Text style={text}>
              Your offer {offerAmount ? `of ${offerAmount} ` : ''}for {itemTitle || 'an item'} was {statusText}.
            </Text>

            {status === 'accepted' && listingUrl && (
              <>
                <Text style={text}>The listing is reserved for you. Complete checkout before it expires.</Text>
                <Button style={button} href={listingUrl}>Complete checkout</Button>
              </>
            )}

            {status !== 'accepted' && (
              <Text style={text}>You can send a new offer any time from the listing.</Text>
            )}
          </Section>
          <Text style={footer}>You received this because you made an offer on Flea.</Text>
        </Container>
      </Body>
    </Html>
  )
}

export const template = {
  component: Email,
  subject: 'Your Flea offer update',
  displayName: 'Buyer: Offer Status',
  previewData: {
    status: 'accepted',
    itemTitle: 'Nike Dunk Low Navy',
    offerAmount: '$75.00',
    listingUrl: 'https://app.finditonflea.com/listing/00000000-0000-0000-0000-000000000000',
  },
} satisfies TemplateEntry
