import * as React from 'npm:react@18.3.1'
import { Body, Container, Head, Heading, Html, Preview, Text, Section, Button } from 'npm:@react-email/components@0.0.22'
import { main, container, card, h1, text, button, footer } from './styles.ts'
import type { TemplateEntry } from './registry.ts'

interface Props {
  name?: string
  homeUrl?: string
}

const Email = ({ name, homeUrl }: Props) => (
  <Html lang="en" dir="ltr">
    <Head />
    <Preview>Welcome to Flea — start exploring today.</Preview>
    <Body style={main}>
      <Container style={container}>
        <Section style={card}>
          <Heading style={h1}>Welcome to Flea.</Heading>
          <Text style={text}>
            {name ? `Hi ${name},` : 'Hi,'}
          </Text>
          <Text style={text}>
            Thanks for joining Flea. We're building the best place to buy and sell pre-loved fashion in Australia.
          </Text>
          <Text style={text}>
            Start exploring listings, save your favourites, or list your first item for free.
          </Text>
          {homeUrl && (
            <Button style={button} href={homeUrl}>Start exploring</Button>
          )}
        </Section>
        <Text style={footer}>You received this because you signed up for Flea.</Text>
      </Container>
    </Body>
  </Html>
)

export const template = {
  component: Email,
  subject: 'Welcome to Flea',
  displayName: 'Welcome',
  previewData: {
    name: 'Alex',
    homeUrl: 'https://app.finditonflea.com',
  },
} satisfies TemplateEntry
