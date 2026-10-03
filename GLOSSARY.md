# AI Job Finder

A service that scores job postings from many public sources against one person's search and CV, and helps them act on the best ones. Sold to individual job seekers on a monthly subscription.

## Language

### The search

**Posting**:
One open role published by a source. Postings are shared by every user.
_Avoid_: Job, listing, vacancy

**Source**:
A public feed or company careers page that postings are read from.
_Avoid_: Board, scraper, provider

**Search profile**:
What one user is looking for: target roles, locations, remote preference, salary and seniority. A user has one or more.
_Avoid_: Preferences, filters

**Match**:
A posting scored against a search profile and the user's CV, with an explanation.
_Avoid_: Result, recommendation

**Strong match**:
A match scoring 60% or higher, excluding wildcards.
_Avoid_: Good match, top match

**Wildcard**:
A match outside the user's exact targets but with a strong skills fit.
_Avoid_: Stretch role, surprise

**Scoring run**:
One pass that scores recent postings against a search profile. It is the main cost of the service.
_Avoid_: Refresh, search, sync

### The business

**Plan**:
A named bundle of allowances a user can be on: Free or Pro.
_Avoid_: Tier, package, license

**Subscription**:
A user's paid agreement for the Pro plan, held at the merchant of record. A user without one is on Free.
_Avoid_: Membership, account type

**Allowance**:
How many times per period a plan lets a user do one costly thing (scoring runs, CV reviews, CV tailorings).
_Avoid_: Quota, credits, limit

**Usage**:
How much of an allowance a user has spent in the current period.
_Avoid_: Consumption, balance

**Merchant of record**:
The company that sells the subscription to the customer and handles payment and VAT on our behalf.
_Avoid_: Payment processor, payment gateway

**Invite code**:
A code that lets someone register during the private beta, and grants free Pro for a set time.
_Avoid_: Promo code, referral code
