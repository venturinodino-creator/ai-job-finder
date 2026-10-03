# Sell subscriptions through a merchant of record, not a payment processor

Subscriptions are sold by Paddle or Lemon Squeezy, which act as the seller and handle VAT and invoicing worldwide, instead of Stripe or Mollie where the owner would register for and file VAT in each EU country. The owner is a solo founder in the Netherlands, and the extra fee (about 5% plus a fixed amount per sale) is cheaper than the admin and risk of VAT compliance at this scale.

## Consequences

Customers, subscriptions and invoices live at the provider, so switching later means migrating paying customers. The app keeps only a copy of each user's subscription state, updated from the provider's webhooks.
