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
        a: 'Browse listings by swiping - swipe right to add to your Wishlist, or swipe up to add straight to your Cart. You can also tap a listing to view details and add to cart from there.',
      },
      {
        q: 'Where do I find my Wishlist?',
        a: 'Tap the heart icon in the bottom navigation bar to view your Wishlist. This is where all the items you\'ve swiped right on are saved.',
      },
      {
        q: 'How do I remove an item from my Cart?',
        a: 'Swipe left on an item to remove it completely - it\'ll go back into the card stack for browsing. Swipe right to move it to your Wishlist instead.',
      },
      {
        q: 'How do I pay for my order?',
        a: 'At checkout, you\'ll pay via the seller\'s connected payment method. Payments go directly to the seller - Flea does not hold your funds.',
      },
      {
        q: 'What fees do I pay as a buyer?',
        a: 'A small payment processing fee is added at checkout. Shipping costs are set by the seller.',
      },
      {
        q: 'Can I get a refund?',
        a: 'If there\'s an issue with your order, start by messaging the seller through the app. You can request a refund directly in the order chat - the seller reviews your request and, if approved, the refund is processed automatically through the original payment method.',
      },
    ],
  },
  {
    category: '👕 Selling',
    questions: [
      {
        q: 'How do I list an item for sale?',
        a: 'Tap the "+" button on your profile page to create a listing. Add photos, set a title, price, category, size, condition, and description. You\'ll need to connect a payment method before you can list.',
      },
      {
        q: 'What fees do I pay as a seller?',
        a: 'Flea charges a 7% platform fee, deducted from your item\'s total sale price including shipping. This prevents the fee being avoided by inflating shipping costs. Payment processing fees are covered by the buyer.',
      },
      {
        q: 'How do I get paid?',
        a: 'Payouts run automatically every day with the minimum delay (around 2 business days for new sales). Instant Payout to your bank is also available where eligible. You can view payouts and history through your payment provider\'s dashboard.',
      },
      {
        q: 'What does "Pause Selling" do?',
        a: 'Pausing selling temporarily hides all your active listings from buyers. Your listings aren\'t deleted - they\'ll reappear when you resume. Find this toggle in Settings.',
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
        a: 'Use the filter icon on the home screen to filter by gender/fit, category, size, colour, condition, style, and price range. You can also save default filter preferences in Settings.',
      },
      {
        q: 'What if I want to retrieve an item I passed on?',
        a: 'You can either press the undo button in the top right of the home screen, or go to Settings and tap Refresh Passed Listings to bring back all previously passed items.',
      },
      {
        q: 'Can I search for specific items?',
        a: 'Yes! Tap the search icon to search by keyword, brand, or item name. You\'ll also see trending searches from other users.',
      },
    ],
  },
  {
    category: '📦 Shipping',
    questions: [
      {
        q: 'How does shipping work?',
        a: 'Sellers set their own shipping prices. Shipping costs are shown at checkout before you pay.',
      },
      {
        q: 'How does tiered shipping work?',
        a: 'Sellers can enable tiered shipping in their settings. When turned on, all of a seller\'s items share the same shipping price tiers. This means when you buy multiple items from the same seller, you get cheaper combined shipping.',
      },
    ],
  },
  {
    category: '💳 Payments',
    questions: [
      {
        q: 'How do I connect a payment method to sell?',
        a: 'Go to Settings and find the Payment Methods section. You\'ll be guided through the onboarding process to connect your preferred payment provider.',
      },
      {
        q: 'My payment account status says "Verifying" - what does that mean?',
        a: 'This means your payment provider is still reviewing your account details. You can still create listings while verification is pending. Once approved, your status will update to "Active".',
      },
    ],
  },
  {
    category: '👤 Account & Privacy',
    questions: [
      {
        q: 'How do I change my email or password?',
        a: 'Go to Settings then Edit Profile. You\'ll find options to change your email and password. Email changes require verification, and password changes require re-authentication.',
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
