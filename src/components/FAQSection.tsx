import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';

const faqItems = [
  {
    category: '🛍️ Buying',
    questions: [
      {
        q: 'How do I buy an item?',
        a: 'Browse listings by swiping — swipe right to add to your Wishlist, or swipe up to add straight to your Cart. You can also tap a listing to view details and add to cart from there.',
      },
      {
        q: 'How do I pay for my order?',
        a: 'At checkout, you\'ll pay via the seller\'s connected payment method (Stripe or PayPal). Payments go directly to the seller — Flea does not hold your funds.',
      },
      {
        q: 'What fees do I pay as a buyer?',
        a: 'A small payment processing fee is added at checkout: 2% for Stripe payments or 3% for PayPal payments. Shipping costs are set by the seller.',
      },
      {
        q: 'Can I cancel or get a refund?',
        a: 'Since payments go directly to sellers, refunds and disputes are handled through the payment provider (Stripe or PayPal). Contact the seller first via the app, and if unresolved, open a dispute through your payment provider\'s dashboard.',
      },
      {
        q: 'How does shipping work?',
        a: 'Sellers set their own shipping prices. Some sellers use tiered shipping based on item weight/size. Shipping costs are shown at checkout before you pay.',
      },
    ],
  },
  {
    category: '👕 Selling',
    questions: [
      {
        q: 'How do I list an item for sale?',
        a: 'Tap the "+" button in the bottom navigation to create a listing. Add photos, set a title, price, category, size, condition, and description. You\'ll need a connected payment method to list.',
      },
      {
        q: 'What fees do I pay as a seller?',
        a: 'Flea charges a 7% platform fee, which is deducted from your item\'s sale price. Payment processing fees are covered by the buyer.',
      },
      {
        q: 'How do I get paid?',
        a: 'Payments go directly to your connected Stripe or PayPal account. You can access your payouts and transaction history through your payment provider\'s dashboard. Instant payouts are available via Stripe for a 1.5% fee.',
      },
      {
        q: 'What does "Pause Selling" do?',
        a: 'Pausing selling temporarily hides all your active listings from buyers. Your listings aren\'t deleted — they\'ll reappear when you resume. Find this toggle in Settings.',
      },
      {
        q: 'How long do I have to ship an order?',
        a: 'You should ship orders promptly. Orders that haven\'t been shipped within 4 days will be flagged as overdue in your Sales tab.',
      },
    ],
  },
  {
    category: '🔍 Browsing & Filters',
    questions: [
      {
        q: 'How do I filter listings?',
        a: 'Use the filter icon on the home screen to filter by gender/fit, category, size, colour, condition, style, and price range. You can also save default filter preferences in Settings → Filter Preferences.',
      },
      {
        q: 'What does swiping left do?',
        a: 'Swiping left passes on a listing. You won\'t see it again unless you refresh your passed listings in Settings → Refresh Passed Listings.',
      },
      {
        q: 'Can I search for specific items?',
        a: 'Yes! Tap the search icon to search by keyword, brand, or item name. You\'ll also see trending searches from other users.',
      },
    ],
  },
  {
    category: '💳 Payments & Stripe',
    questions: [
      {
        q: 'How do I connect a payment method to sell?',
        a: 'Go to Settings and find the Payment Methods section. Tap "Connect Stripe" to set up your seller account. You\'ll be guided through Stripe\'s onboarding process.',
      },
      {
        q: 'What is Stripe Connect?',
        a: 'Stripe Connect is the payment system Flea uses to send payments directly from buyers to sellers. It\'s secure, widely used, and handles all payment processing.',
      },
      {
        q: 'My Stripe status says "Verifying" — what does that mean?',
        a: 'This means Stripe is still reviewing your account details. You can still create listings while verification is pending. Once approved, your status will update to "Active".',
      },
    ],
  },
  {
    category: '👤 Account & Privacy',
    questions: [
      {
        q: 'How do I change my email or password?',
        a: 'Go to Settings → Edit Profile. You\'ll find options to change your email and password. Email changes require verification, and password changes require re-authentication.',
      },
      {
        q: 'Can I delete my account?',
        a: 'Yes, but there are safeguards. You can\'t delete your account if you have active orders. If you\'ve made sales, there\'s a mandatory 14-day cooldown after your last delivery. Go to Edit Profile to start the process.',
      },
      {
        q: 'What happens to my listings if I delete my account?',
        a: 'Your listings will be marked as "removed" and will no longer appear to other users. Your personal data (favourites, cart, notifications, etc.) will be permanently deleted.',
      },
      {
        q: 'How do I report a user or listing?',
        a: 'Tap the report icon on any listing or user profile. Select a reason and submit. Our team reviews all reports and may take action including warnings or account suspension.',
      },
    ],
  },
];

const FAQSection = () => {
  return (
    <div className="space-y-4 pb-2">
      {faqItems.map((section) => (
        <div key={section.category}>
          <h3 className="text-sm font-semibold text-foreground mb-1 px-1">
            {section.category}
          </h3>
          <Accordion type="single" collapsible className="space-y-1">
            {section.questions.map((item, i) => (
              <AccordionItem
                key={i}
                value={`${section.category}-${i}`}
                className="border-none rounded-2xl bg-card card-shadow px-4 overflow-hidden"
              >
                <AccordionTrigger className="text-sm font-medium text-foreground py-3 hover:no-underline">
                  {item.q}
                </AccordionTrigger>
                <AccordionContent className="text-sm text-muted-foreground leading-relaxed">
                  {item.a}
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </div>
      ))}
    </div>
  );
};

export default FAQSection;
