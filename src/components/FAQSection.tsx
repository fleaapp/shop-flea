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
        q: 'How does swiping work?',
        a: 'On the home screen you browse a stack of listings. Swipe right ❤️ to add an item to your Wishlist, swipe left ⛔ to pass, or swipe up 🛒 to add it straight to your Cart. Tap a card at any time to view the full listing details.',
      },
      {
        q: 'How do I buy an item?',
        a: 'Swipe up on a listing to add it to your Cart, or tap the card to view details and add to cart from there. When you\'re ready, open your Cart from the top right of the home screen and tap Checkout.',
      },
      {
        q: 'Where do I find my Wishlist?',
        a: 'Your Wishlist lives inside your Cart. Tap the Cart icon in the top right of the home screen, then switch to the Wishlist tab. Every item you\'ve swiped right on is saved there.',
      },

      {
        q: 'How do I remove an item from my Cart?',
        a: 'Swipe left on an item to remove it completely - it\'ll go back into the card stack for browsing. Swipe right to move it to your Wishlist instead.',
      },
      {
        q: 'How do I pay for my order?',
        a: 'At checkout you can pay by card, Apple Pay or Google Pay through the seller\'s connected payment provider. Your payment is held securely until the order is delivered and the 48-hour buyer protection window closes - only then are the funds released to the seller.',
      },
      {
        q: 'What fees do I pay as a buyer?',
        a: 'A single flat Secure Checkout Fee of 4% + $0.70 is added at checkout. It covers secure card processing, fraud protection and marketplace support. Shipping costs are set by the seller. There are no hidden fees.',
      },
      {
        q: 'Can I get a refund?',
        a: 'If there\'s an issue with your order, start by messaging the seller through the order chat. You can request a refund directly in the chat within 48 hours of the order being marked as delivered. For multi-item orders, you can choose which items to refund; shipping and fees are split fairly between the refunded items and the items you keep. Once a request is submitted, the seller has 72 hours to approve or decline. If they don\'t respond in time, the refund is issued automatically. If the seller declines, Flea reviews the request and may still issue the refund at our discretion.',
      },
      {
        q: 'How do I confirm I\'ve received an order?',
        a: 'Open the order chat and tap Mark as Delivered once your item arrives. This lets the seller know everything is fine and starts the review window.',
      },
      {
        q: 'How do I message a seller?',
        a: 'Every order has its own chat thread. Tap the message icon on an order to ask questions, share delivery updates or resolve issues with the seller.',
      },
    ],
  },
  {
    category: '👕 Selling',
    questions: [
      {
        q: 'How do I list an item for sale?',
        a: 'Tap the "+" button on your profile page to create a listing. Add photos, set a title, price, category, size, condition, and description. You\'ll need to connect a payment provider before your first listing goes live.',
      },
      {
        q: 'What fees do I pay as a seller?',
        a: 'There are no selling fees on Flea. Listing and selling is free - no selling fees, no monthly fees, no hidden fees. The only charge is a 2% + $0.50 transaction fee per sale, deducted from your payout, which covers payment processing.',
      },
      {
        q: 'How do I get paid?',
        a: 'Your first payout may take up to 7 days while your payment provider verifies your identity and bank details. This helps protect everyone from fraud. After that, payouts usually land within 24 hours. If you need funds faster, you can opt in to Instant Payout for a 1.5% fee once your account is fully verified.',
      },
      {
        q: 'What does "Pause Selling" do?',
        a: 'Pausing selling temporarily hides all your active listings from buyers. Your listings aren\'t deleted - they\'ll reappear when you resume. Find this toggle in Settings.',
      },
      {
        q: 'How long do I have to ship an order?',
        a: 'You should dispatch within 3 days. You\'ll get a friendly reminder after 3 days, an urgent one after 6 days and a final warning at 8 days. Orders unshipped after 4 days are flagged as overdue in your Sales tab, and an order still unshipped after 8 days is refunded to the buyer automatically.',
      },
      {
        q: 'How do reviews work?',
        a: 'Once an order is marked as delivered, the buyer can leave a star rating and an optional photo review. Sellers can also review buyers. Reviews help keep the community trustworthy.',
      },
      {
        q: 'What does the ⏸️ on my listing mean?',
        a: 'The pause emoji means your listing is paused and hidden from buyers. Tap it to resume selling, or use the Pause Selling toggle in Settings to unpause everything at once.',
      },
      {
        q: 'Can I mark an item as sold elsewhere?',
        a: 'Yes. Open the listing, tap the edit menu and choose Mark as Sold Elsewhere. The listing will be removed from the marketplace but stays in your Sold tab for your records.',
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
        q: 'What if I want an item I passed on?',
        a: 'You can either press the undo button in the top right of the home screen, or go to Settings and tap Refresh Passed Listings to bring back all previously passed items.',
      },
      {
        q: 'Can I search for specific items?',
        a: 'Yes! Tap the search icon to search by keyword, brand, or item name. You\'ll also see trending searches from other users.',
      },
    ],
  },

  {
    category: '✈️ Shipping',
    questions: [
      {
        q: 'How does shipping work?',
        a: 'Sellers set their own shipping prices. Shipping costs are shown at checkout before you pay.',
      },
      {
        q: 'How does tiered / combined shipping work?',
        a: 'Sellers can enable tiered shipping in their settings. When turned on, all of a seller\'s items share the same shipping price tiers. This means when you buy multiple items from the same seller, you get cheaper combined shipping.',
      },
      {
        q: 'How is tracking handled?',
        a: 'Sellers enter a tracking number and carrier when they mark an order as shipped. Every tracking number is reviewed and approved by Flea before payouts can release. You can tap Track Parcel to see the latest scan.',
      },
      {
        q: 'How does buyer protection work?',
        a: 'Once your parcel is marked delivered - either by you tapping Mark as Delivered, or by Flea confirming it - you have 48 hours to check the item and raise any issues. If nothing is reported in that window, the order auto-completes and funds release to the seller. If you tap Report Issue, funds stay held while it is reviewed.',
      },
      {
        q: 'What if my parcel never arrives?',
        a: 'If an order is never marked as shipped with valid tracking, it is refunded to you automatically 8 days after purchase. If tracking shows the parcel is still in transit with no delivery scan, you can request a refund in the order chat after 10 days from shipment. If tracking says delivered but nothing turned up, check with your neighbours and your local post office first, then request a refund in the order chat within 48 hours of the delivered scan and choose "Item never arrived". Flea reviews these with the seller and funds stay held until it is sorted.',
      },
      {
        q: 'What happens if the seller enters the wrong tracking?',
        a: 'Flea reviews every tracking number before payouts release. If it is invalid, the seller is asked to update it. Sellers who submit 3 invalid tracking numbers are flagged for extra checks.',
      },

    ],
  },
  {
    category: '💳 Payments',
    questions: [
      {
        q: 'How do I connect a payment method to sell?',
        a: 'Go to Settings and tap Become a Seller or Seller Dashboard. You\'ll be guided through onboarding with our payment provider inside the app. Once verified, you can list items and receive payouts.',
      },
      {
        q: 'My account status says "Verifying" - what does that mean?',
        a: 'This means your payment provider is still reviewing your account details. You can finish setting up in the meantime, but you can only publish listings once verification is approved. Once approved, your status updates to Active.',
      },
      {
        q: 'What do "Pending review (🔍)" and "Action required (⚠️)" mean?',
        a: 'Pending review means your provider is checking your details. Action required means they need extra information from you - tap the status to complete the missing steps inside the app.',
      },
      {
        q: 'Where do I see my payouts and history?',
        a: 'Go to Settings and tap Seller Dashboard. It opens your payment provider dashboard inside the app so you can view payouts, transactions and account settings without leaving Flea.',
      },
    ],
  },
  {
    category: '👤 Account & Privacy',
    questions: [
      {
        q: 'How do I sign in?',
        a: 'You can sign in with your email and password, or use Google Sign-In. Both options stay inside the app so you never get pushed out to a separate browser.',
      },
      {
        q: 'What is Guest Mode?',
        a: 'Guest Mode lets you browse listings without creating an account. When you try to buy, sell, wishlist or message, you\'ll be prompted to log in or sign up. Your browsing choices can be carried over when you do sign up.',
      },
      {
        q: 'I didn\'t get my verification email.',
        a: 'Check your spam or junk folder first. The verification link is set to open back in the Flea app, so make sure you tap it on the same device. You can request a new link from the verification screen.',
      },
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
        a: 'Your listings are automatically archived and removed from the marketplace in real time for every user. Your personal data - favourites, cart, notifications, etc. - is permanently deleted. We must keep transaction and payment records for 7 years to meet Australian tax and financial reporting law, as set out in our Privacy Policy.',
      },
      {
        q: 'How do I report a user or listing?',
        a: 'Tap the report icon on any listing or user profile. Select a reason and submit. Our team reviews all reports and may take action including warnings or account suspension.',
      },
    ],
  },
  {
    category: '🔔 Notifications & Alerts',
    questions: [
      {
        q: 'What notifications will I get?',
        a: 'You\'ll get alerts for sales, new messages, shipping updates, reviews, refunds and important account reminders. We only send notifications that matter to you.',
      },
      {
        q: 'How do I turn push notifications on/off?',
        a: 'You can toggle push notifications in Settings. You can also manage them in your device\'s Settings app under Notifications.',
      },
      {
        q: 'Why is there a green dot on Alerts?',
        a: 'The green dot means you have unread activity. Tap the Alerts tab to see what\'s new - the dot disappears once you\'ve caught up.',
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
