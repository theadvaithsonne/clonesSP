# Database reference

Generated from the compiled Mongoose models by loading them **offline** (no database connection was opened and no data was read). It describes structure only — collections, fields, references, indexes, hooks — not the data inside.

## What kind of database this is

- **MongoDB** through **Mongoose 8**. There are no SQL tables and **no stored procedures or triggers** in the database; the equivalents live in application code:
  - schema validation and defaults — the Mongoose schemas in `server/**/models/`;
  - triggers — Mongoose `pre`/`post` hooks (listed per model below);
  - scheduled logic — the background jobs started by `server/index.ts` (see [ARCHITECTURE](ARCHITECTURE.md#background-jobs));
  - multi-document logic — services under `server/services/` (some use MongoDB transactions or conditional `updateOne` claims instead of locks).
- Connection: `MONGODB_URI` via `server/db/mongo.ts` (`connectMongo`). In this project's `.env` it points at the **production** database. `autoIndex` is on in development and **off in production** (unless `MONGO_AUTO_INDEX=true`); sync indexes deliberately with `npm run indexes:sync`.
- Redis (`REDIS_URL`) is separate: presence fan-out and BullMQ queues, not a system of record.

## Overview

- **Models / collections:** 296 (263 Core platform, 30 BAT246 game, 3 Note-Taker)
- **Fields:** 5010 top-level and nested paths; **explicit indexes:** 1305; **references (`ref`):** 646 model-to-model links
- Models that failed to load offline: 0
- References to a model that is not defined: 6 — `bat246PendingPlacements.boardId → Bat246Board`, `bat246PlacementNotifications.boardId → Bat246Board`, `bat246PositionReservations.boardId → Bat246Board`, `CollaborativeDocument.cabinet → Cabinet`, `File.cabinet → Cabinet`, `NoteSession.meetSessionId → MeetSession`

### Most connected models (by inbound references)

| Model | Referenced by | Used by (files importing it) |
|---|---|---|
| `User` | 209 models | 329 |
| `Organization` | 161 models | 124 |
| `Invoice` | 18 models | 119 |
| `GarageAdmin` | 16 models | 20 |
| `Product` | 12 models | 51 |
| `Channel` | 10 models | 42 |
| `bat246Boards` | 7 models | 36 |
| `bat246Players` | 7 models | 35 |
| `EventProgram` | 7 models | 6 |
| `JobPosting` | 7 models | 10 |
| `Post` | 7 models | 8 |
| `Workshop` | 7 models | 48 |
| `CommissionDistribution` | 5 models | 20 |
| `ContentCampaign` | 5 models | 6 |
| `Group` | 5 models | 18 |

## Collection index

| Model | Collection | Area | Fields | Indexes | Refs out → in | Defined in |
|---|---|---|---|---|---|---|
| [`Admin`](#admin) | `admins` | Core platform | 8 | 2 | 0 → 0 | `server/models/admin.model.ts` |
| [`AdminNotificationLog`](#adminnotificationlog) | `adminnotificationlogs` | Core platform | 10 | 3 | 1 → 0 | `server/models/adminNotificationLog.model.ts` |
| [`AdminNotificationRule`](#adminnotificationrule) | `adminnotificationrules` | Core platform | 18 | 4 | 2 → 1 | `server/models/adminNotificationRule.model.ts` |
| [`AffiliateClick`](#affiliateclick) | `affiliateclicks` | Core platform | 19 | 6 | 2 → 0 | `server/models/affiliateClick.model.ts` |
| [`AffiliateConversion`](#affiliateconversion) | `affiliateconversions` | Core platform | 14 | 4 | 2 → 0 | `server/models/affiliateConversion.model.ts` |
| [`AffiliateLink`](#affiliatelink) | `affiliatelinks` | Core platform | 13 | 7 | 3 → 0 | `server/models/affiliateLink.model.ts` |
| [`AffiliateWallet`](#affiliatewallet) | `affiliatewallets` | Core platform | 11 | 1 | 1 → 1 | `server/models/affiliateWallet.model.ts` |
| [`AIProviderKey`](#aiproviderkey) | `aiproviderkeys` | Core platform | 10 | 1 | 1 → 0 | `server/models/aiProviderKey.model.ts` |
| [`AivatarWallet`](#aivatarwallet) | `garage_aivatar_wallets` | Core platform | 7 | 1 | 0 → 1 | `server/models/aivatarWallet.model.ts` |
| [`AivatarWalletTransaction`](#aivatarwallettransaction) | `garage_aivatar_wallet_transactions` | Core platform | 13 | 6 | 2 → 0 | `server/models/aivatarWalletTransaction.model.ts` |
| [`Announcement`](#announcement) | `announcements` | Core platform | 21 | 3 | 1 → 0 | `server/models/announcement.model.ts` |
| [`Application`](#application) | `applications` | Core platform | 12 | 0 | 2 → 0 | `server/models/application.model.ts` |
| [`Approval`](#approval) | `approvals` | Core platform | 11 | 3 | 2 → 0 | `server/models/approval.model.ts` |
| [`AppSubscription`](#appsubscription) | `appsubscriptions` | Core platform | 10 | 4 | 2 → 0 | `server/models/appSubscription.model.ts` |
| [`Auction`](#auction) | `auctions` | Core platform | 20 | 2 | 3 → 0 | `server/models/auction.model.ts` |
| [`AuctionEscrow`](#auctionescrow) | `auctionescrows` | Core platform | 14 | 6 | 3 → 0 | `server/models/auctionEscrow.model.ts` |
| [`AuctionSettlement`](#auctionsettlement) | `auctionsettlements` | Core platform | 23 | 6 | 6 → 0 | `server/models/auctionSettlement.model.ts` |
| [`AuctionWallet`](#auctionwallet) | `auctionwallets` | Core platform | 13 | 1 | 1 → 1 | `server/models/auctionWallet.model.ts` |
| [`AuctionWalletTransaction`](#auctionwallettransaction) | `auctionwallettransactions` | Core platform | 21 | 8 | 3 → 0 | `server/models/auctionWalletTransaction.model.ts` |
| [`Availability`](#availability) | `availabilities` | Core platform | 9 | 3 | 2 → 0 | `server/models/availability.model.ts` |
| [`BankDetails`](#bankdetails) | `bankdetails` | Core platform | 13 | 1 | 1 → 0 | `server/models/bank-details.model.ts` |
| [`bat246B2CoinProductPurchases`](#bat246b2coinproductpurchases) | `bat246b2coinproductpurchases` | BAT246 game | 7 | 2 | 3 → 0 | `server/bat246/models/bat246B2CoinProductPurchase.model.ts` |
| [`bat246B2CoinTransactions`](#bat246b2cointransactions) | `bat246b2cointransactions` | BAT246 game | 8 | 4 | 3 → 0 | `server/bat246/models/bat246B2CoinTransaction.model.ts` |
| [`bat246B2CoinWallets`](#bat246b2coinwallets) | `bat246b2coinwallets` | BAT246 game | 6 | 1 | 1 → 0 | `server/bat246/models/bat246B2CoinWallet.model.ts` |
| [`bat246BoardInvites`](#bat246boardinvites) | `bat246boardinvites` | BAT246 game | 9 | 1 | 2 → 0 | `server/bat246/models/bat246BoardInvites.model.ts` |
| [`bat246Boards`](#bat246boards) | `bat246boards` | BAT246 game | 38 | 6 | 2 → 7 | `server/bat246/models/bat246Board.model.ts` |
| [`Bat246CardPermission`](#bat246cardpermission) | `bat246cardpermissions` | BAT246 game | 6 | 1 | 1 → 0 | `server/bat246/models/bat246CardPermission.model.ts` |
| [`bat246Config`](#bat246config) | `bat246configs` | BAT246 game | 8 | 0 | 0 → 0 | `server/bat246/models/bat246Config.model.ts` |
| [`bat246Distributors`](#bat246distributors) | `bat246distributors` | BAT246 game | 51 | 4 | 4 → 0 | `server/bat246/models/bat246Distributor.model.ts` |
| [`bat246FreeEntries`](#bat246freeentries) | `bat246freeentries` | BAT246 game | 13 | 1 | 2 → 0 | `server/bat246/models/bat246FreeEntry.model.ts` |
| [`bat246LayawayRequests`](#bat246layawayrequests) | `bat246layawayrequests` | BAT246 game | 11 | 4 | 2 → 2 | `server/bat246/models/bat246LayawayRequest.model.ts` |
| [`bat246LostMoneyClaims`](#bat246lostmoneyclaims) | `bat246lostmoneyclaims` | BAT246 game | 49 | 0 | 1 → 1 | `server/bat246/models/bat246LostMoneyClaim.model.ts` |
| [`bat246LostMoneyGalleryImages`](#bat246lostmoneygalleryimages) | `bat246lostmoneygalleryimages` | BAT246 game | 6 | 0 | 0 → 0 | `server/bat246/models/bat246LostMoneyGalleryImage.model.ts` |
| [`bat246LostMoneyPaid`](#bat246lostmoneypaid) | `bat246lostmoneypaids` | BAT246 game | 16 | 0 | 2 → 1 | `server/bat246/models/bat246LostMoneyPaid.model.ts` |
| [`bat246LostMoneyPayment`](#bat246lostmoneypayment) | `bat246lostmoneypayments` | BAT246 game | 8 | 1 | 1 → 0 | `server/bat246/models/bat246LostMoneyPayment.model.ts` |
| [`bat246LostMoneyPaymentSettings`](#bat246lostmoneypaymentsettings) | `bat246lostmoneypaymentsettings` | BAT246 game | 6 | 0 | 0 → 0 | `server/bat246/models/bat246LostMoneyPaymentSettings.model.ts` |
| [`bat246LostMoneyTestimonials`](#bat246lostmoneytestimonials) | `bat246lostmoneytestimonials` | BAT246 game | 9 | 0 | 0 → 0 | `server/bat246/models/bat246LostMoneyTestimonial.model.ts` |
| [`bat246Movements`](#bat246movements) | `bat246movements` | BAT246 game | 9 | 2 | 2 → 0 | `server/bat246/models/bat246Movement.model.ts` |
| [`bat246OfficeInvites`](#bat246officeinvites) | `bat246officeinvites` | BAT246 game | 6 | 1 | 2 → 0 | `server/bat246/models/bat246OfficeInvite.model.ts` |
| [`bat246PendingPlacements`](#bat246pendingplacements) | `bat246pendingplacements` | BAT246 game | 10 | 2 | 2 → 0 | `server/bat246/models/bat246PendingPlacement.model.ts` |
| [`bat246PlacementNotifications`](#bat246placementnotifications) | `bat246placementnotifications` | BAT246 game | 16 | 1 | 4 → 0 | `server/bat246/models/bat246PlacementNotifications.model.ts` |
| [`bat246PlayerBoards`](#bat246playerboards) | `bat246playerboards` | BAT246 game | 9 | 3 | 2 → 0 | `server/bat246/models/bat246PlayerBoard.model.ts` |
| [`bat246Players`](#bat246players) | `bat246players` | BAT246 game | 24 | 2 | 1 → 7 | `server/bat246/models/bat246Player.model.ts` |
| [`bat246PodInvites`](#bat246podinvites) | `bat246podinvites` | BAT246 game | 9 | 1 | 2 → 0 | `server/bat246/models/bat246PodInvites.model.ts` |
| [`bat246PositionReservations`](#bat246positionreservations) | `bat246positionreservations` | BAT246 game | 9 | 3 | 3 → 0 | `server/bat246/models/bat246PositionReservations.model.ts` |
| [`bat246Recruitments`](#bat246recruitments) | `bat246recruitments` | BAT246 game | 12 | 1 | 2 → 0 | `server/bat246/models/bat246Recruitment.model.ts` |
| [`bat246SalesCredits`](#bat246salescredits) | `bat246salescredits` | BAT246 game | 16 | 4 | 2 → 0 | `server/bat246/models/bat246SalesCredit.model.ts` |
| [`bat246SnapBackLoanRepayments`](#bat246snapbackloanrepayments) | `bat246snapbackloanrepayments` | BAT246 game | 7 | 2 | 2 → 0 | `server/bat246/models/bat246SnapBackLoanRepayment.model.ts` |
| [`bat246SnapBackLoanRequests`](#bat246snapbackloanrequests) | `bat246snapbackloanrequests` | BAT246 game | 14 | 6 | 3 → 2 | `server/bat246/models/bat246SnapBackLoanRequest.model.ts` |
| [`bat246SnapBackLoans`](#bat246snapbackloans) | `bat246snapbackloans` | BAT246 game | 13 | 4 | 4 → 2 | `server/bat246/models/bat246SnapBackLoan.model.ts` |
| [`bat246TopTen`](#bat246topten) | `bat246toptens` | BAT246 game | 5 | 1 | 0 → 0 | `server/bat246/models/bat246TopTen.model.ts` |
| [`BondHolding`](#bondholding) | `bond_holdings` | Core platform | 22 | 8 | 4 → 2 | `server/models/bondHolding.model.ts` |
| [`BondInstrument`](#bondinstrument) | `bond_instruments` | Core platform | 24 | 4 | 3 → 3 | `server/models/bondInstrument.model.ts` |
| [`BondLedgerEntry`](#bondledgerentry) | `bond_ledger_entries` | Core platform | 18 | 6 | 6 → 1 | `server/models/bondLedgerEntry.model.ts` |
| [`BondPayoutEvent`](#bondpayoutevent) | `bond_payout_events` | Core platform | 21 | 4 | 4 → 1 | `server/models/bondPayoutEvent.model.ts` |
| [`Booking`](#booking) | `bookings` | Core platform | 10 | 5 | 2 → 0 | `server/models/booking.model.ts` |
| [`CallBooking`](#callbooking) | `callbookings` | Core platform | 21 | 12 | 4 → 0 | `server/models/callBooking.model.ts` |
| [`CallOffering`](#calloffering) | `callofferings` | Core platform | 25 | 5 | 3 → 2 | `server/models/callOffering.model.ts` |
| [`CallPurchase`](#callpurchase) | `callpurchases` | Core platform | 18 | 7 | 3 → 1 | `server/models/callPurchase.model.ts` |
| [`CampaignWallet`](#campaignwallet) | `campaignwallets` | Core platform | 13 | 4 | 3 → 2 | `server/models/campaignWallet.model.ts` |
| [`CampaignWalletTransaction`](#campaignwallettransaction) | `campaignwallettransactions` | Core platform | 19 | 8 | 6 → 0 | `server/models/campaignWalletTransaction.model.ts` |
| [`CashbackCode`](#cashbackcode) | `cashbackcodes` | Core platform | 20 | 8 | 2 → 2 | `server/models/cashbackCode.model.ts` |
| [`CashbackDistribution`](#cashbackdistribution) | `cashbackdistributions` | Core platform | 23 | 9 | 5 → 0 | `server/models/cashbackDistribution.model.ts` |
| [`CatalogOutbox`](#catalogoutbox) | `catalogoutboxes` | Core platform | 11 | 3 | 0 → 0 | `server/models/catalogOutbox.model.ts` |
| [`CatalogTombstone`](#catalogtombstone) | `catalogtombstones` | Core platform | 7 | 2 | 0 → 0 | `server/models/catalogTombstone.model.ts` |
| [`Channel`](#channel) | `channels` | Core platform | 42 | 4 | 2 → 10 | `server/models/channel.model.ts` |
| [`ChannelMembership`](#channelmembership) | `channelmemberships` | Core platform | 16 | 4 | 3 → 0 | `server/models/channelMembership.model.ts` |
| [`ChannelMembershipEvent`](#channelmembershipevent) | `channelmembershipevents` | Core platform | 21 | 5 | 5 → 0 | `server/models/channelMembershipEvent.model.ts` |
| [`ChatBlock`](#chatblock) | `chatblocks` | Core platform | 5 | 3 | 1 → 0 | `server/models/chatBlock.model.ts` |
| [`ChatClear`](#chatclear) | `chatclears` | Core platform | 6 | 2 | 1 → 0 | `server/models/chatClear.model.ts` |
| [`ChatDraft`](#chatdraft) | `chatdrafts` | Core platform | 6 | 2 | 1 → 0 | `server/models/chatDraft.model.ts` |
| [`ChatMute`](#chatmute) | `chatmutes` | Core platform | 6 | 2 | 1 → 0 | `server/models/chatMute.model.ts` |
| [`ChatPin`](#chatpin) | `chatpins` | Core platform | 5 | 1 | 1 → 0 | `server/models/chatPin.model.ts` |
| [`ChatStar`](#chatstar) | `chatstars` | Core platform | 6 | 4 | 1 → 0 | `server/models/chatStar.model.ts` |
| [`CollaborativeDocument`](#collaborativedocument) | `collaborativedocuments` | Core platform | 19 | 7 | 3 → 0 | `server/models/collaborativeDocument.model.ts` |
| [`CombPlan`](#combplan) | `combplans` | Core platform | 17 | 7 | 2 → 2 | `server/models/combPlan.model.ts` |
| [`CommissionDistribution`](#commissiondistribution) | `commissiondistributions` | Core platform | 24 | 14 | 3 → 5 | `server/models/commissionDistribution.model.ts` |
| [`ConferenceRoom`](#conferenceroom) | `conferencerooms` | Core platform | 8 | 3 | 2 → 1 | `server/models/conferenceRoom.model.ts` |
| [`ContentCampaign`](#contentcampaign) | `contentcampaigns` | Core platform | 33 | 5 | 3 → 5 | `server/models/contentCampaign.model.ts` |
| [`ContentEngagement`](#contentengagement) | `contentengagements` | Core platform | 33 | 12 | 2 → 0 | `server/models/contentEngagement.model.ts` |
| [`ContentPayout`](#contentpayout) | `contentpayouts` | Core platform | 12 | 7 | 4 → 2 | `server/models/contentPayout.model.ts` |
| [`ContentRewardsWallet`](#contentrewardswallet) | `contentrewardswallets` | Core platform | 10 | 1 | 1 → 1 | `server/models/contentRewardsWallet.model.ts` |
| [`ContentRewardsWalletTransaction`](#contentrewardswallettransaction) | `contentrewardswallettransactions` | Core platform | 18 | 10 | 6 → 0 | `server/models/contentRewardsWalletTransaction.model.ts` |
| [`ContentSubmission`](#contentsubmission) | `contentsubmissions` | Core platform | 25 | 10 | 4 → 3 | `server/models/contentSubmission.model.ts` |
| [`ConversationState`](#conversationstate) | `conversationstates` | Core platform | 8 | 5 | 1 → 0 | `server/models/conversationState.model.ts` |
| [`CounterBill`](#counterbill) | `counterbills` | Core platform | 47 | 7 | 0 → 0 | `server/models/counterBill.model.ts` |
| [`CounterBillSequence`](#counterbillsequence) | `counterbillsequences` | Core platform | 3 | 1 | 0 → 0 | `server/models/counterBill.model.ts` |
| [`Coupon`](#coupon) | `coupons` | Core platform | 22 | 5 | 1 → 2 | `server/models/coupon.model.ts` |
| [`CouponAssignment`](#couponassignment) | `couponassignments` | Core platform | 21 | 5 | 4 → 3 | `server/models/couponAssignment.model.ts` |
| [`CouponRule`](#couponrule) | `couponrules` | Core platform | 16 | 7 | 3 → 1 | `server/models/couponRule.model.ts` |
| [`CouponRuleProgress`](#couponruleprogress) | `couponruleprogresses` | Core platform | 8 | 3 | 2 → 0 | `server/models/couponRuleProgress.model.ts` |
| [`CouponUsage`](#couponusage) | `couponusages` | Core platform | 17 | 5 | 4 → 1 | `server/models/couponUsage.model.ts` |
| [`Course`](#course) | `courses` | Core platform | 41 | 5 | 3 → 2 | `server/models/course.model.ts` |
| [`CourseEnrollment`](#courseenrollment) | `courseenrollments` | Core platform | 23 | 6 | 3 → 0 | `server/models/courseEnrollment.model.ts` |
| [`CoworkingSpace`](#coworkingspace) | `coworkingspaces` | Core platform | 18 | 4 | 1 → 1 | `server/models/coworkingSpace.model.ts` |
| [`CoworkingSpaceBooking`](#coworkingspacebooking) | `coworkingspacebookings` | Core platform | 22 | 5 | 4 → 0 | `server/models/coworkingSpaceBooking.model.ts` |
| [`CronLease`](#cronlease) | `cronleases` | Core platform | 6 | 1 | 0 → 0 | `server/models/cronLease.model.ts` |
| [`CryptoAddressCounter`](#cryptoaddresscounter) | `cryptoaddresscounters` | Core platform | 4 | 1 | 0 → 0 | `server/models/cryptoAddressCounter.model.ts` |
| [`CryptoPaymentRequest`](#cryptopaymentrequest) | `cryptopaymentrequests` | Core platform | 28 | 7 | 1 → 0 | `server/models/cryptoPaymentRequest.model.ts` |
| [`CryptosubBonusPayout`](#cryptosubbonuspayout) | `cryptosubbonuspayouts` | Core platform | 16 | 6 | 2 → 0 | `server/models/cryptosubBonusPayout.model.ts` |
| [`CryptosubBonusRun`](#cryptosubbonusrun) | `cryptosubbonusruns` | Core platform | 13 | 3 | 0 → 1 | `server/models/cryptosubBonusRun.model.ts` |
| [`CryptoTopupTransaction`](#cryptotopuptransaction) | `cryptotopuptransactions` | Core platform | 20 | 9 | 3 → 0 | `server/models/cryptoTopupTransaction.model.ts` |
| [`Deal`](#deal) | `deals` | Core platform | 11 | 3 | 2 → 0 | `server/models/deal.model.ts` |
| [`DealComment`](#dealcomment) | `dealcomments` | Core platform | 8 | 3 | 2 → 1 | `server/models/dealComment.model.ts` |
| [`DealReaction`](#dealreaction) | `dealreactions` | Core platform | 6 | 3 | 1 → 0 | `server/models/dealReaction.model.ts` |
| [`DeviceToken`](#devicetoken) | `devicetokens` | Core platform | 14 | 4 | 1 → 0 | `server/models/deviceToken.model.ts` |
| [`DmSettings`](#dmsettings) | `dmsettings` | Core platform | 6 | 2 | 1 → 0 | `server/models/dmSettings.model.ts` |
| [`DomainPurchaseRequest`](#domainpurchaserequest) | `domainpurchaserequests` | Core platform | 21 | 3 | 0 → 0 | `server/models/domainPurchaseRequest.model.ts` |
| [`Drop`](#drop) | `drops` | Core platform | 17 | 6 | 2 → 0 | `server/models/drop.model.ts` |
| [`Email`](#email) | `emails` | Core platform | 23 | 7 | 2 → 0 | `server/models/email.model.ts` |
| [`Event`](#event) | `events` | Core platform | 18 | 11 | 2 → 1 | `server/models/event.model.ts` |
| [`EventAgendaSession`](#eventagendasession) | `event_agenda_sessions` | Core platform | 22 | 3 | 2 → 0 | `server/models/eventAgendaSession.model.ts` |
| [`EventGuest`](#eventguest) | `eventguests` | Core platform | 10 | 7 | 1 → 0 | `server/models/eventGuest.model.ts` |
| [`EventProgram`](#eventprogram) | `event_programs` | Core platform | 31 | 6 | 3 → 7 | `server/models/eventProgram.model.ts` |
| [`EventRegistration`](#eventregistration) | `event_registrations` | Core platform | 21 | 10 | 4 → 0 | `server/models/eventRegistration.model.ts` |
| [`EventRegistrationForm`](#eventregistrationform) | `event_registration_forms` | Core platform | 7 | 1 | 1 → 0 | `server/models/eventRegistrationForm.model.ts` |
| [`EventSpeaker`](#eventspeaker) | `event_speakers` | Core platform | 15 | 2 | 1 → 1 | `server/models/eventSpeaker.model.ts` |
| [`EventSponsor`](#eventsponsor) | `event_sponsors` | Core platform | 10 | 2 | 1 → 0 | `server/models/eventSponsor.model.ts` |
| [`EventTicketTier`](#eventtickettier) | `event_ticket_tiers` | Core platform | 18 | 3 | 1 → 1 | `server/models/eventTicketTier.model.ts` |
| [`EventWebsiteConfig`](#eventwebsiteconfig) | `event_website_configs` | Core platform | 14 | 2 | 1 → 0 | `server/models/eventWebsiteConfig.model.ts` |
| [`FCMToken`](#fcmtoken) | `fcmtokens` | Core platform | 12 | 4 | 1 → 0 | `server/models/fcmToken.model.ts` |
| [`FeedActivityRead`](#feedactivityread) | `feedactivityreads` | Core platform | 6 | 3 | 2 → 0 | `server/models/feedActivityRead.model.ts` |
| [`File`](#file) | `files` | Core platform | 23 | 6 | 4 → 1 | `server/models/file.model.ts` |
| [`Floor`](#floor) | `floors` | Core platform | 7 | 2 | 1 → 3 | `server/models/floor.model.ts` |
| [`FloorCabinet`](#floorcabinet) | `floorcabinets` | Core platform | 13 | 4 | 4 → 2 | `server/models/cabinet.model.ts` |
| [`FloorFile`](#floorfile) | `floorfiles` | Core platform | 24 | 7 | 5 → 1 | `server/models/cabinet.model.ts` |
| [`FounderSubBonusPayout`](#foundersubbonuspayout) | `foundersubbonuspayouts` | Core platform | 18 | 6 | 2 → 0 | `server/models/founderSubBonusPayout.model.ts` |
| [`FounderSubBonusRun`](#foundersubbonusrun) | `foundersubbonusruns` | Core platform | 13 | 3 | 0 → 1 | `server/models/founderSubBonusRun.model.ts` |
| [`FranchiseCountry`](#franchisecountry) | `franchise_countries` | Core platform | 7 | 3 | 0 → 0 | `server/models/franchiseCountry.model.ts` |
| [`FranchiseGlobalAssignment`](#franchiseglobalassignment) | `franchise_global_assignments` | Core platform | 22 | 8 | 2 → 2 | `server/models/franchiseGlobalAssignment.model.ts` |
| [`FranchiseGlobalOffer`](#franchiseglobaloffer) | `franchise_global_offers` | Core platform | 19 | 8 | 3 → 1 | `server/models/franchiseGlobalOffer.model.ts` |
| [`FranchiseOffer`](#franchiseoffer) | `franchise_offers` | Core platform | 21 | 8 | 5 → 1 | `server/models/franchiseOffer.model.ts` |
| [`FranchiseProgram`](#franchiseprogram) | `franchise_programs` | Core platform | 9 | 3 | 2 → 4 | `server/models/franchiseProgram.model.ts` |
| [`FranchiseReassignment`](#franchisereassignment) | `franchise_reassignments` | Core platform | 21 | 11 | 5 → 2 | `server/models/franchiseReassignment.model.ts` |
| [`FranchiseSubTerritory`](#franchisesubterritory) | `franchise_sub_territories` | Core platform | 12 | 7 | 0 → 0 | `server/models/franchiseSubTerritory.model.ts` |
| [`FranchiseTerritory`](#franchiseterritory) | `franchise_territorymasters` | Core platform | 11 | 5 | 0 → 0 | `server/models/franchiseTerritory.model.ts` |
| [`FranchiseTerritoryAssignment`](#franchiseterritoryassignment) | `franchise_territory_assignments` | Core platform | 21 | 9 | 4 → 4 | `server/models/franchiseTerritoryAssignment.model.ts` |
| [`FxRateSnapshot`](#fxratesnapshot) | `fxratesnapshots` | Core platform | 9 | 2 | 0 → 0 | `server/models/fxRateSnapshot.model.ts` |
| [`GarageAdmin`](#garageadmin) | `garageadmins` | Core platform | 15 | 2 | 1 → 16 | `server/models/garageAdmin.model.ts` |
| [`GarageAdminRole`](#garageadminrole) | `garageadminroles` | Core platform | 7 | 1 | 1 → 0 | `server/models/garageAdminRole.model.ts` |
| [`GarageUniversityOnboarding`](#garageuniversityonboarding) | `garageuniversity_onboarding_profiles` | Core platform | 22 | 1 | 2 → 0 | `server/models/garageUniversityOnboarding.model.ts` |
| [`GenealogySnapshot`](#genealogysnapshot) | `genealogysnapshots` | Core platform | 8 | 1 | 1 → 0 | `server/models/genealogySnapshot.model.ts` |
| [`GenealogySnapshotRun`](#genealogysnapshotrun) | `genealogysnapshotruns` | Core platform | 7 | 1 | 0 → 0 | `server/models/genealogySnapshot.model.ts` |
| [`GlobalMessage`](#globalmessage) | `globalmessages` | Core platform | 14 | 5 | 2 → 1 | `server/models/globalMessage.model.ts` |
| [`Group`](#group) | `groups` | Core platform | 23 | 5 | 2 → 5 | `server/models/group.model.ts` |
| [`GroupAiTask`](#groupaitask) | `groupaitasks` | Core platform | 15 | 5 | 4 → 0 | `server/models/groupAiTask.model.ts` |
| [`GroupMessage`](#groupmessage) | `groupmessages` | Core platform | 29 | 4 | 3 → 4 | `server/models/groupMessage.model.ts` |
| [`IgniteCall`](#ignitecall) | `ignitecalls` | Core platform | 14 | 2 | 2 → 0 | `server/models/igniteCall.model.ts` |
| [`InstallIntent`](#installintent) | `installintents` | Core platform | 15 | 2 | 0 → 0 | `server/models/installIntent.model.ts` |
| [`Invite`](#invite) | `invites` | Core platform | 10 | 3 | 1 → 0 | `server/models/invite.model.ts` |
| [`Invoice`](#invoice) | `invoices` | Core platform | 63 | 19 | 9 → 18 | `server/models/invoice.model.ts` |
| [`ItemReserveLicense`](#itemreservelicense) | `itemreservelicenses` | Core platform | 21 | 9 | 4 → 1 | `server/models/itemReserveLicense.model.ts` |
| [`JobActivity`](#jobactivity) | `jobactivities` | Core platform | 11 | 2 | 4 → 0 | `server/models/jobActivity.model.ts` |
| [`JobAlert`](#jobalert) | `jobalerts` | Core platform | 16 | 2 | 1 → 0 | `server/models/jobAlert.model.ts` |
| [`JobApplication`](#jobapplication) | `jobapplications` | Core platform | 45 | 6 | 3 → 4 | `server/models/jobApplication.model.ts` |
| [`JobEvent`](#jobevent) | `jobevents` | Core platform | 7 | 1 | 3 → 0 | `server/models/jobEvent.model.ts` |
| [`JobInterview`](#jobinterview) | `jobinterviews` | Core platform | 22 | 3 | 4 → 0 | `server/models/jobInterview.model.ts` |
| [`JobOffer`](#joboffer) | `joboffers` | Core platform | 18 | 2 | 4 → 0 | `server/models/jobOffer.model.ts` |
| [`JobPosting`](#jobposting) | `jobpostings` | Core platform | 59 | 5 | 2 → 7 | `server/models/jobPosting.model.ts` |
| [`JobReward`](#jobreward) | `jobrewards` | Core platform | 24 | 4 | 4 → 0 | `server/models/jobReward.model.ts` |
| [`JobsSettings`](#jobssettings) | `jobssettings` | Core platform | 17 | 1 | 1 → 0 | `server/models/jobsSettings.model.ts` |
| [`JoinRequest`](#joinrequest) | `joinrequests` | Core platform | 11 | 6 | 2 → 0 | `server/models/joinRequest.model.ts` |
| [`LeaveRequest`](#leaverequest) | `leaverequests` | Core platform | 10 | 5 | 2 → 0 | `server/models/leaveRequest.model.ts` |
| [`MagicLink`](#magiclink) | `magiclinks` | Core platform | 17 | 5 | 2 → 0 | `server/models/magicLink.model.ts` |
| [`Meet`](#meet) | `meets` | Core platform | 17 | 8 | 1 → 1 | `server/models/meet.model.ts` |
| [`MeetParticipant`](#meetparticipant) | `meetparticipants` | Core platform | 10 | 7 | 1 → 0 | `server/models/meetParticipant.model.ts` |
| [`Message`](#message) | `messages` | Core platform | 17 | 6 | 3 → 1 | `server/models/message.model.ts` |
| [`MessageTranslation`](#messagetranslation) | `messagetranslations` | Core platform | 7 | 1 | 1 → 0 | `server/models/messageTranslation.model.ts` |
| [`MissedCall`](#missedcall) | `missedcalls` | Core platform | 12 | 6 | 2 → 0 | `server/models/missedCall.model.ts` |
| [`NcSubscription`](#ncsubscription) | `networkchain_subscriptions` | Core platform | 10 | 1 | 1 → 0 | `server/models/ncSubscription.model.ts` |
| [`NcWallet`](#ncwallet) | `wallets` | Core platform | 7 | 1 | 1 → 0 | `server/models/ncWallet.model.ts` |
| [`NoteSession`](#notesession) | `notesessions` | Note-Taker | 27 | 6 | 1 → 2 | `server/note-taker/models/note-session.model.ts` |
| [`NoteSummary`](#notesummary) | `notesummaries` | Note-Taker | 13 | 1 | 1 → 0 | `server/note-taker/models/note-summary.model.ts` |
| [`NoteTranscript`](#notetranscript) | `notetranscripts` | Note-Taker | 10 | 2 | 1 → 0 | `server/note-taker/models/note-transcript.model.ts` |
| [`Notification`](#notification) | `notifications` | Core platform | 14 | 7 | 2 → 0 | `server/models/notification.model.ts` |
| [`OfficeAddon`](#officeaddon) | `officeaddons` | Core platform | 16 | 3 | 0 → 2 | `server/models/officeAddon.model.ts` |
| [`OfficeAddonPayment`](#officeaddonpayment) | `officeaddonpayments` | Core platform | 26 | 13 | 5 → 0 | `server/models/officeAddonPayment.model.ts` |
| [`OfficeAddonSubscription`](#officeaddonsubscription) | `officeaddonsubscriptions` | Core platform | 24 | 12 | 3 → 1 | `server/models/officeAddonSubscription.model.ts` |
| [`OfficePlan`](#officeplan) | `officeplans` | Core platform | 20 | 3 | 0 → 1 | `server/models/officePlan.model.ts` |
| [`OfficeSubscription`](#officesubscription) | `officesubscriptions` | Core platform | 29 | 12 | 3 → 2 | `server/models/officeSubscription.model.ts` |
| [`OfficeSubscriptionPayment`](#officesubscriptionpayment) | `officesubscriptionpayments` | Core platform | 26 | 8 | 4 → 0 | `server/models/officeSubscriptionPayment.model.ts` |
| [`OfficeUpgradeHistory`](#officeupgradehistory) | `officeupgradehistories` | Core platform | 16 | 5 | 4 → 0 | `server/models/officeUpgradeHistory.model.ts` |
| [`OpenClawAgent`](#openclawagent) | `openclawagents` | Core platform | 17 | 5 | 2 → 0 | `server/models/openclawAgent.model.ts` |
| [`OpenClawMessage`](#openclawmessage) | `openclawmessages` | Core platform | 8 | 1 | 1 → 0 | `server/models/openclawMessage.model.ts` |
| [`Organization`](#organization) | `organizations` | Core platform | 92 | 8 | 3 → 161 | `server/models/organization.model.ts` |
| [`OrganizationCabinet`](#organizationcabinet) | `organizationcabinets` | Core platform | 12 | 3 | 3 → 2 | `server/models/cabinet.model.ts` |
| [`OrganizationFile`](#organizationfile) | `organizationfiles` | Core platform | 26 | 6 | 4 → 1 | `server/models/cabinet.model.ts` |
| [`OrgCategory`](#orgcategory) | `orgcategories` | Core platform | 6 | 3 | 1 → 0 | `server/models/orgCategory.model.ts` |
| [`OrgConversionFee`](#orgconversionfee) | `org_conversion_fees` | Core platform | 8 | 1 | 2 → 0 | `server/models/orgConversionFee.model.ts` |
| [`OrgKyc`](#orgkyc) | `orgkycs` | Core platform | 14 | 2 | 2 → 0 | `server/models/orgKyc.model.ts` |
| [`OrgRewardsWallet`](#orgrewardswallet) | `orgrewardswallets` | Core platform | 9 | 4 | 2 → 0 | `server/models/orgRewardsWallet.model.ts` |
| [`OtpCode`](#otpcode) | `otpcodes` | Core platform | 8 | 3 | 1 → 0 | `server/models/otpcode.model.ts` |
| [`OtpCodeAccessLog`](#otpcodeaccesslog) | `otp_code_access_logs` | Core platform | 12 | 2 | 1 → 0 | `server/models/otpCodeAccessLog.model.ts` |
| [`PendingCouponGift`](#pendingcoupongift) | `pendingcoupongifts` | Core platform | 15 | 6 | 3 → 1 | `server/models/pendingCouponGift.model.ts` |
| [`PendingInvite`](#pendinginvite) | `pendinginvites` | Core platform | 9 | 2 | 1 → 0 | `server/models/pendingInvite.model.ts` |
| [`PendingReserveAssignment`](#pendingreserveassignment) | `pendingreserveassignments` | Core platform | 18 | 6 | 3 → 2 | `server/models/pendingReserveAssignment.model.ts` |
| [`PermissionGrant`](#permissiongrant) | `permissiongrants` | Core platform | 11 | 6 | 2 → 1 | `server/models/permissionGrant.model.ts` |
| [`PhoneVerificationEvent`](#phoneverificationevent) | `phoneverificationevents` | Core platform | 15 | 2 | 2 → 0 | `server/models/phoneVerificationEvent.model.ts` |
| [`PincodeData`](#pincodedata) | `pincodedatas` | Core platform | 7 | 3 | 0 → 0 | `server/models/pincodeData.model.ts` |
| [`PlatformCoupon`](#platformcoupon) | `platformcoupons` | Core platform | 25 | 8 | 1 → 3 | `server/models/platformCoupon.model.ts` |
| [`PlatformCouponRedemption`](#platformcouponredemption) | `platformcouponredemptions` | Core platform | 16 | 5 | 3 → 0 | `server/models/platformCouponRedemption.model.ts` |
| [`Playlist`](#playlist) | `playlists` | Core platform | 13 | 4 | 2 → 0 | `server/models/playlist.model.ts` |
| [`Poll`](#poll) | `polls` | Core platform | 11 | 3 | 2 → 1 | `server/models/poll.model.ts` |
| [`PollVote`](#pollvote) | `pollvotes` | Core platform | 6 | 3 | 2 → 0 | `server/models/pollVote.model.ts` |
| [`Post`](#post) | `posts` | Core platform | 32 | 11 | 4 → 7 | `server/models/post.model.ts` |
| [`PostBookmark`](#postbookmark) | `postbookmarks` | Core platform | 6 | 6 | 3 → 0 | `server/models/postBookmark.model.ts` |
| [`PostComment`](#postcomment) | `postcomments` | Core platform | 20 | 8 | 4 → 3 | `server/models/postComment.model.ts` |
| [`PostCommentLike`](#postcommentlike) | `postcommentlikes` | Core platform | 7 | 6 | 3 → 0 | `server/models/postCommentLike.model.ts` |
| [`PostLike`](#postlike) | `postlikes` | Core platform | 7 | 7 | 3 → 0 | `server/models/postLike.model.ts` |
| [`PostRepost`](#postrepost) | `postreposts` | Core platform | 6 | 6 | 3 → 0 | `server/models/postRepost.model.ts` |
| [`Product`](#product) | `products` | Core platform | 49 | 5 | 3 → 12 | `server/models/product.model.ts` |
| [`ProductOrder`](#productorder) | `productorders` | Core platform | 29 | 9 | 2 → 1 | `server/models/productOrder.model.ts` |
| [`ProductVariant`](#productvariant) | `productvariants` | Core platform | 13 | 2 | 0 → 0 | `server/models/productVariant.model.ts` |
| [`RankPlan`](#rankplan) | `rankplans` | Core platform | 9 | 3 | 0 → 0 | `server/models/rankPlan.model.ts` |
| [`RankQualification`](#rankqualification) | `rankqualifications` | Core platform | 15 | 6 | 3 → 0 | `server/models/rankQualification.model.ts` |
| [`RankRun`](#rankrun) | `rankruns` | Core platform | 14 | 3 | 0 → 1 | `server/models/rankRun.model.ts` |
| [`RatingSummary`](#ratingsummary) | `ratingsummaries` | Core platform | 12 | 2 | 1 → 0 | `server/models/ratingSummary.model.ts` |
| [`ReferralBonusConfig`](#referralbonusconfig) | `referralbonusconfigs` | Core platform | 8 | 1 | 1 → 0 | `server/models/referralBonusConfig.model.ts` |
| [`ReferralBonusPayout`](#referralbonuspayout) | `referralbonuspayouts` | Core platform | 16 | 3 | 2 → 0 | `server/models/referralBonusPayout.model.ts` |
| [`ReserveLicense`](#reservelicense) | `reservelicenses` | Core platform | 16 | 6 | 5 → 0 | `server/models/reserveLicense.model.ts` |
| [`Review`](#review) | `reviews` | Core platform | 25 | 7 | 2 → 1 | `server/models/review.model.ts` |
| [`ReviewVote`](#reviewvote) | `reviewvotes` | Core platform | 6 | 3 | 2 → 0 | `server/models/reviewVote.model.ts` |
| [`RoomBooking`](#roombooking) | `roombookings` | Core platform | 12 | 6 | 3 → 0 | `server/models/roomBooking.model.ts` |
| [`SavedJob`](#savedjob) | `savedjobs` | Core platform | 4 | 2 | 2 → 0 | `server/models/savedJob.model.ts` |
| [`Service`](#service) | `services` | Core platform | 40 | 6 | 3 → 3 | `server/models/service.model.ts` |
| [`ServiceMilestoneMessage`](#servicemilestonemessage) | `servicemilestonemessages` | Core platform | 10 | 2 | 4 → 0 | `server/models/serviceMilestoneMessage.model.ts` |
| [`ServiceOpt`](#serviceopt) | `serviceopts` | Core platform | 19 | 9 | 3 → 2 | `server/models/serviceOpt.model.ts` |
| [`ServiceReview`](#servicereview) | `servicereviews` | Core platform | 14 | 6 | 4 → 0 | `server/models/serviceReview.model.ts` |
| [`Settings`](#settings) | `settings` | Core platform | 10 | 3 | 2 → 0 | `server/models/setting.model.ts` |
| [`ShareableLink`](#shareablelink) | `shareablelinks` | Core platform | 15 | 6 | 2 → 0 | `server/models/shareableLink.model.ts` |
| [`SharedAccessLog`](#sharedaccesslog) | `sharedaccesslogs` | Core platform | 9 | 4 | 2 → 0 | `server/models/sharing.model.ts` |
| [`SharedItem`](#shareditem) | `shareditems` | Core platform | 17 | 6 | 2 → 1 | `server/models/sharing.model.ts` |
| [`SocialAccount`](#socialaccount) | `socialaccounts` | Core platform | 16 | 3 | 1 → 1 | `server/models/socialAccount.model.ts` |
| [`StandaloneVideo`](#standalonevideo) | `standalonevideos` | Core platform | 13 | 4 | 2 → 0 | `server/models/standaloneVideo.model.ts` |
| [`Store`](#store) | `stores` | Core platform | 11 | 1 | 0 → 0 | `server/models/store.model.ts` |
| [`StoreCouponCommission`](#storecouponcommission) | `storecouponcommissions` | Core platform | 12 | 5 | 3 → 1 | `server/models/storeCouponCommission.model.ts` |
| [`StoreCouponCommissionFire`](#storecouponcommissionfire) | `storecouponcommissionfires` | Core platform | 11 | 4 | 5 → 0 | `server/models/storeCouponCommissionFire.model.ts` |
| [`StoreDrop`](#storedrop) | `storedrops` | Core platform | 5 | 0 | 0 → 0 | `server/models/storeDrop.model.ts` |
| [`StoreProduct`](#storeproduct) | `storeproducts` | Core platform | 25 | 1 | 0 → 4 | `server/models/storeProduct.model.ts` |
| [`StoreWallet`](#storewallet) | `storewallets` | Core platform | 10 | 5 | 3 → 5 | `server/models/storeWallet.model.ts` |
| [`StudySession`](#studysession) | `studysessions` | Core platform | 14 | 5 | 1 → 0 | `server/models/studySession.model.ts` |
| [`Subscription`](#subscription) | `subscriptions` | Core platform | 27 | 14 | 3 → 3 | `server/models/subscription.model.ts` |
| [`SubscriptionPayment`](#subscriptionpayment) | `subscriptionpayments` | Core platform | 33 | 12 | 4 → 0 | `server/models/subscriptionPayment.model.ts` |
| [`SubscriptionPlan`](#subscriptionplan) | `subscriptionplans` | Core platform | 16 | 6 | 2 → 1 | `server/models/subscriptionPlan.model.ts` |
| [`SupportTaskAssignment`](#supporttaskassignment) | `support_task_assignments` | Core platform | 7 | 2 | 2 → 0 | `server/models/supportTaskAssignment.model.ts` |
| [`SupportTicket`](#supportticket) | `supporttickets` | Core platform | 16 | 8 | 3 → 0 | `server/models/supportTicket.model.ts` |
| [`SupportTicketBoard`](#supportticketboard) | `support_ticket_board` | Core platform | 17 | 2 | 2 → 0 | `server/models/supportTicketBoard.model.ts` |
| [`Task`](#task) | `tasks` | Core platform | 9 | 2 | 2 → 0 | `server/models/task.model.ts` |
| [`TeamforceBranch`](#teamforcebranch) | `teamforcebranches` | Core platform | 12 | 2 | 1 → 1 | `server/models/teamforce/teamforceBranch.model.ts` |
| [`TeamforceBreakLog`](#teamforcebreaklog) | `teamforcebreaklogs` | Core platform | 13 | 4 | 3 → 0 | `server/models/teamforce/teamforceBreakLog.model.ts` |
| [`TeamforceBreakSettings`](#teamforcebreaksettings) | `teamforcebreaksettings` | Core platform | 13 | 2 | 1 → 0 | `server/models/teamforce/teamforceBreakSettings.model.ts` |
| [`TeamforceCandidate`](#teamforcecandidate) | `teamforcecandidates` | Core platform | 24 | 5 | 2 → 0 | `server/models/teamforce/teamforceCandidate.model.ts` |
| [`TeamforceDepartment`](#teamforcedepartment) | `teamforcedepartments` | Core platform | 8 | 2 | 2 → 1 | `server/models/teamforce/teamforceDepartment.model.ts` |
| [`TeamforceEmployeeProfile`](#teamforceemployeeprofile) | `teamforceemployeeprofiles` | Core platform | 53 | 2 | 7 → 0 | `server/models/teamforce/teamforceEmployeeProfile.model.ts` |
| [`TeamforceEmployeeTaxDeclaration`](#teamforceemployeetaxdeclaration) | `teamforceemployeetaxdeclarations` | Core platform | 23 | 1 | 2 → 0 | `server/models/teamforce/teamforceEmployeeTaxDeclaration.model.ts` |
| [`TeamforceLeavePolicy`](#teamforceleavepolicy) | `teamforceleavepolicies` | Core platform | 12 | 2 | 1 → 0 | `server/models/teamforce/teamforceLeavePolicy.model.ts` |
| [`TeamforceLeaveRequest`](#teamforceleaverequest) | `teamforceleaverequests` | Core platform | 18 | 7 | 2 → 0 | `server/models/teamforce/teamforceLeaveRequest.model.ts` |
| [`TeamforcePayrollConfig`](#teamforcepayrollconfig) | `teamforcepayrollconfigs` | Core platform | 9 | 1 | 1 → 0 | `server/models/teamforce/teamforcePayrollConfig.model.ts` |
| [`TeamforcePayrollRun`](#teamforcepayrollrun) | `teamforcepayrollruns` | Core platform | 21 | 3 | 2 → 1 | `server/models/teamforce/teamforcePayrollRun.model.ts` |
| [`TeamforcePayrollTransaction`](#teamforcepayrolltransaction) | `teamforcepayrolltransactions` | Core platform | 32 | 4 | 4 → 0 | `server/models/teamforce/teamforcePayrollTransaction.model.ts` |
| [`TeamforcePTSlab`](#teamforceptslab) | `teamforceptslabs` | Core platform | 10 | 1 | 0 → 0 | `server/models/teamforce/teamforcePTSlab.model.ts` |
| [`TeamforceRecruitmentRequest`](#teamforcerecruitmentrequest) | `teamforcerecruitmentrequests` | Core platform | 24 | 3 | 2 → 1 | `server/models/teamforce/teamforceRecruitmentRequest.model.ts` |
| [`TeamforceSalaryStructure`](#teamforcesalarystructure) | `teamforcesalarystructures` | Core platform | 11 | 2 | 1 → 2 | `server/models/teamforce/teamforceSalaryStructure.model.ts` |
| [`TeamforceShift`](#teamforceshift) | `teamforceshifts` | Core platform | 11 | 1 | 1 → 1 | `server/models/teamforce/teamforceShift.model.ts` |
| [`TeamforceWeeklyOffPattern`](#teamforceweeklyoffpattern) | `teamforceweeklyoffpatterns` | Core platform | 8 | 1 | 1 → 1 | `server/models/teamforce/teamforceWeeklyOffPattern.model.ts` |
| [`TerritoryWallet`](#territorywallet) | `territorywallets` | Core platform | 10 | 1 | 1 → 1 | `server/models/territoryWallet.model.ts` |
| [`TerritoryWalletTransaction`](#territorywallettransaction) | `territorywallettransactions` | Core platform | 32 | 12 | 6 → 0 | `server/models/territoryWalletTransaction.model.ts` |
| [`Testimonial`](#testimonial) | `testimonials` | Core platform | 31 | 8 | 2 → 0 | `server/models/testimonial.model.ts` |
| [`ThirdPartyClient`](#thirdpartyclient) | `thirdpartyclients` | Core platform | 15 | 6 | 1 → 2 | `server/models/thirdPartyClient.model.ts` |
| [`Ticket`](#ticket) | `tickets_garage` | Core platform | 30 | 10 | 3 → 0 | `server/models/ticket.model.ts` |
| [`TimeTracking`](#timetracking) | `timetrackings` | Core platform | 8 | 3 | 2 → 1 | `server/models/timeTracking.model.ts` |
| [`Todo`](#todo) | `todos` | Core platform | 8 | 5 | 2 → 0 | `server/models/todo.model.ts` |
| [`UnilevelPlusDistribution`](#unilevelplusdistribution) | `unilevelplusdistributions` | Core platform | 28 | 11 | 2 → 1 | `server/models/unilevelPlusDistribution.model.ts` |
| [`UnilevelPlusPlan`](#unilevelplusplan) | `unilevelplusplans` | Core platform | 23 | 3 | 2 → 3 | `server/models/unilevelPlusPlan.model.ts` |
| [`UnilevelPlusPurchase`](#unilevelpluspurchase) | `unilevelpluspurchases` | Core platform | 11 | 5 | 2 → 1 | `server/models/unilevelPlusPurchase.model.ts` |
| [`User`](#user) | `users` | Core platform | 59 | 11 | 3 → 209 | `server/models/user.model.ts` |
| [`UserActivity`](#useractivity) | `useractivities` | Core platform | 13 | 10 | 2 → 0 | `server/models/userActivity.model.ts` |
| [`UserCabinet`](#usercabinet) | `usercabinets` | Core platform | 13 | 5 | 3 → 2 | `server/models/cabinet.model.ts` |
| [`UserCryptoAddress`](#usercryptoaddress) | `usercryptoaddresses` | Core platform | 13 | 6 | 2 → 0 | `server/models/userCryptoAddress.model.ts` |
| [`UserFile`](#userfile) | `userfiles` | Core platform | 23 | 6 | 4 → 1 | `server/models/cabinet.model.ts` |
| [`UserNotification`](#usernotification) | `usernotifications` | Core platform | 75 | 4 | 14 → 0 | `server/models/userNotification.model.ts` |
| [`UserProductLink`](#userproductlink) | `userproductlinks` | Core platform | 9 | 2 | 2 → 0 | `server/models/userProductLink.model.ts` |
| [`Vacancy`](#vacancy) | `vacancies` | Core platform | 13 | 0 | 2 → 1 | `server/models/vacancy.model.ts` |
| [`VoIPToken`](#voiptoken) | `voiptokens` | Core platform | 13 | 4 | 1 → 0 | `server/models/voipToken.model.ts` |
| [`WalletAccount`](#walletaccount) | `walletaccounts` | Core platform | 21 | 2 | 2 → 1 | `server/models/walletAccount.model.ts` |
| [`WalletTransaction`](#wallettransaction) | `wallettransactions` | Core platform | 19 | 14 | 5 → 4 | `server/models/walletTransaction.model.ts` |
| [`WebinarAttendance`](#webinarattendance) | `webinarattendances` | Core platform | 15 | 3 | 3 → 0 | `server/models/webinarAttendance.model.ts` |
| [`WebinarMessage`](#webinarmessage) | `webinarmessages` | Core platform | 11 | 2 | 1 → 0 | `server/models/webinarMessage.model.ts` |
| [`WebinarProductPin`](#webinarproductpin) | `webinarproductpins` | Core platform | 14 | 2 | 2 → 0 | `server/models/webinarProductPin.model.ts` |
| [`WhitelabelBonusPayout`](#whitelabelbonuspayout) | `whitelabelbonuspayouts` | Core platform | 16 | 6 | 2 → 0 | `server/models/whitelabelBonusPayout.model.ts` |
| [`WhitelabelBonusRun`](#whitelabelbonusrun) | `whitelabelbonusruns` | Core platform | 13 | 3 | 0 → 1 | `server/models/whitelabelBonusRun.model.ts` |
| [`Withdrawal`](#withdrawal) | `withdrawals` | Core platform | 33 | 4 | 4 → 0 | `server/models/withdrawal.model.ts` |
| [`WithdrawalPreference`](#withdrawalpreference) | `withdrawalpreferences` | Core platform | 8 | 3 | 2 → 0 | `server/models/withdrawalPreference.model.ts` |
| [`Workshop`](#workshop) | `workshops` | Core platform | 82 | 10 | 3 → 7 | `server/models/workshop.model.ts` |
| [`WorkshopRegistration`](#workshopregistration) | `workshopregistrations` | Core platform | 20 | 10 | 3 → 0 | `server/models/workshopRegistration.model.ts` |
| [`WorkshopSessionOverride`](#workshopsessionoverride) | `workshopsessionoverrides` | Core platform | 31 | 3 | 2 → 0 | `server/models/workshopSessionOverride.model.ts` |

## Relationships

Arrows follow `ref` fields: `A → B` means a field in A stores B's `_id`. MongoDB enforces none of these; deleting a document does not cascade.

- `AdminNotificationLog` → `AdminNotificationRule`
- `AdminNotificationRule` → `GarageAdmin`, `Organization`
- `AffiliateClick` → `Organization`, `User`
- `AffiliateConversion` → `Organization`, `User`
- `AffiliateLink` → `Channel`, `Organization`, `User`
- `AffiliateWallet` → `User`
- `AIProviderKey` → `GarageAdmin`
- `AivatarWalletTransaction` → `AivatarWallet`, `Organization`
- `Announcement` → `GarageAdmin`
- `Application` → `Organization`, `Vacancy`
- `Approval` → `Organization`, `User`
- `AppSubscription` → `Organization`, `User`
- `Auction` → `Organization`, `Product`, `User`
- `AuctionEscrow` → `Organization`, `StoreProduct`, `User`
- `AuctionSettlement` → `CommissionDistribution`, `Invoice`, `Organization`, `ProductOrder`, `StoreProduct`, `User`
- `AuctionWallet` → `User`
- `AuctionWalletTransaction` → `AuctionWallet`, `StoreProduct`, `User`
- `Availability` → `Organization`, `User`
- `BankDetails` → `User`
- `bat246B2CoinProductPurchases` → `Invoice`, `Product`, `User`
- `bat246B2CoinTransactions` → `Product`, `User`, `bat246LayawayRequests`
- `bat246B2CoinWallets` → `User`
- `bat246BoardInvites` → `Product`, `User`
- `bat246Boards` → `bat246Boards`, `bat246Players`
- `Bat246CardPermission` → `User`
- `bat246Distributors` → `Product`, `User`, `bat246Boards`, `bat246Players`
- `bat246FreeEntries` → `bat246Boards`, `bat246Players`
- `bat246LayawayRequests` → `Product`, `User`
- `bat246LostMoneyClaims` → `User`
- `bat246LostMoneyPaid` → `User`, `bat246LostMoneyClaims`
- `bat246LostMoneyPayment` → `bat246LostMoneyPaid`
- `bat246Movements` → `bat246Boards`, `bat246Players`
- `bat246OfficeInvites` → `Product`, `User`
- `bat246PendingPlacements` → `Bat246Board`, `User`
- `bat246PlacementNotifications` → `Bat246Board`, `User`, `bat246LayawayRequests`, `bat246SnapBackLoanRequests`
- `bat246PlayerBoards` → `bat246Boards`, `bat246Players`
- `bat246Players` → `User`
- `bat246PodInvites` → `Product`, `User`
- `bat246PositionReservations` → `Bat246Board`, `Product`, `User`
- `bat246Recruitments` → `bat246Boards`, `bat246Players`
- `bat246SalesCredits` → `bat246Boards`, `bat246Players`
- `bat246SnapBackLoanRepayments` → `User`, `bat246SnapBackLoans`
- `bat246SnapBackLoanRequests` → `Product`, `User`, `bat246SnapBackLoans`
- `bat246SnapBackLoans` → `Invoice`, `Product`, `User`, `bat246SnapBackLoanRequests`
- `BondHolding` → `BondInstrument`, `Invoice`, `Organization`, `User`
- `BondInstrument` → `CombPlan`, `Organization`, `User`
- `BondLedgerEntry` → `BondHolding`, `BondInstrument`, `BondLedgerEntry`, `BondPayoutEvent`, `Organization`, `User`
- `BondPayoutEvent` → `BondHolding`, `BondInstrument`, `Organization`, `User`
- `Booking` → `Organization`, `User`
- `CallBooking` → `CallOffering`, `CallPurchase`, `Organization`, `User`
- `CallOffering` → `Channel`, `Organization`, `User`
- `CallPurchase` → `CallOffering`, `Organization`, `User`
- `CampaignWallet` → `ContentCampaign`, `Organization`, `User`
- `CampaignWalletTransaction` → `CampaignWallet`, `ContentCampaign`, `ContentPayout`, `ContentSubmission`, `Organization`, `User`
- `CashbackCode` → `Organization`, `User`
- `CashbackDistribution` → `CashbackCode`, `Invoice`, `Organization`, `User`, `WalletTransaction`
- `Channel` → `Organization`, `User`
- `ChannelMembership` → `Channel`, `Organization`, `User`
- `ChannelMembershipEvent` → `Channel`, `Invoice`, `Organization`, `User`, `Workshop`
- `ChatBlock` → `User`
- `ChatClear` → `User`
- `ChatDraft` → `User`
- `ChatMute` → `User`
- `ChatPin` → `User`
- `ChatStar` → `User`
- `CollaborativeDocument` → `Cabinet`, `Organization`, `User`
- `CombPlan` → `Organization`, `User`
- `CommissionDistribution` → `CombPlan`, `Organization`, `User`
- `ConferenceRoom` → `Organization`, `User`
- `ContentCampaign` → `CampaignWallet`, `Organization`, `User`
- `ContentEngagement` → `Organization`, `User`
- `ContentPayout` → `ContentCampaign`, `ContentSubmission`, `Organization`, `User`
- `ContentRewardsWallet` → `User`
- `ContentRewardsWalletTransaction` → `ContentCampaign`, `ContentPayout`, `ContentRewardsWallet`, `ContentSubmission`, `Organization`, `User`
- `ContentSubmission` → `ContentCampaign`, `Organization`, `SocialAccount`, `User`
- `ConversationState` → `User`
- `Coupon` → `Organization`
- `CouponAssignment` → `CouponAssignment`, `Organization`, `PendingCouponGift`, `User`
- `CouponRule` → `Organization`, `PlatformCoupon`, `User`
- `CouponRuleProgress` → `CouponRule`, `User`
- `CouponUsage` → `Coupon`, `Organization`, `Subscription`, `User`
- `Course` → `Channel`, `Organization`, `User`
- `CourseEnrollment` → `Course`, `Organization`, `User`
- `CoworkingSpace` → `GarageAdmin`
- `CoworkingSpaceBooking` → `CoworkingSpace`, `GarageAdmin`, `Organization`, `User`
- `CryptoPaymentRequest` → `Invoice`
- `CryptosubBonusPayout` → `CryptosubBonusRun`, `User`
- `CryptoTopupTransaction` → `Organization`, `StoreWallet`, `User`
- `Deal` → `Organization`, `User`
- `DealComment` → `DealComment`, `User`
- `DealReaction` → `User`
- `DeviceToken` → `User`
- `DmSettings` → `User`
- `Drop` → `Organization`, `User`
- `Email` → `Organization`, `User`
- `Event` → `Organization`, `User`
- `EventAgendaSession` → `EventProgram`, `EventSpeaker`
- `EventGuest` → `Event`
- `EventProgram` → `Organization`, `StoreWallet`, `User`
- `EventRegistration` → `EventProgram`, `EventTicketTier`, `Invoice`, `User`
- `EventRegistrationForm` → `EventProgram`
- `EventSpeaker` → `EventProgram`
- `EventSponsor` → `EventProgram`
- `EventTicketTier` → `EventProgram`
- `EventWebsiteConfig` → `EventProgram`
- `FCMToken` → `User`
- `FeedActivityRead` → `Organization`, `User`
- `File` → `Cabinet`, `File`, `Organization`, `User`
- `Floor` → `Organization`
- `FloorCabinet` → `Floor`, `FloorCabinet`, `Organization`, `User`
- `FloorFile` → `Floor`, `FloorCabinet`, `FloorFile`, `Organization`, `User`
- `FounderSubBonusPayout` → `FounderSubBonusRun`, `User`
- `FranchiseGlobalAssignment` → `FranchiseReassignment`, `User`
- `FranchiseGlobalOffer` → `FranchiseGlobalAssignment`, `Invoice`, `User`
- `FranchiseOffer` → `FranchiseProgram`, `FranchiseTerritoryAssignment`, `Invoice`, `Organization`, `User`
- `FranchiseProgram` → `Organization`, `User`
- `FranchiseReassignment` → `FranchiseProgram`, `FranchiseTerritoryAssignment`, `Invoice`, `Organization`, `User`
- `FranchiseTerritoryAssignment` → `FranchiseProgram`, `FranchiseReassignment`, `Organization`, `User`
- `GarageAdmin` → `GarageAdmin`
- `GarageAdminRole` → `GarageAdmin`
- `GarageUniversityOnboarding` → `Organization`, `User`
- `GenealogySnapshot` → `User`
- `GlobalMessage` → `GlobalMessage`, `User`
- `Group` → `Organization`, `User`
- `GroupAiTask` → `Group`, `GroupMessage`, `Organization`, `User`
- `GroupMessage` → `Group`, `GroupMessage`, `User`
- `IgniteCall` → `GarageAdmin`, `User`
- `Invite` → `Organization`
- `Invoice` → `CashbackCode`, `CommissionDistribution`, `Coupon`, `CouponUsage`, `Invoice`, `Organization`, `Subscription`, `ThirdPartyClient`, `User`
- `ItemReserveLicense` → `Invoice`, `Organization`, `PendingReserveAssignment`, `User`
- `JobActivity` → `JobApplication`, `JobPosting`, `Organization`, `User`
- `JobAlert` → `User`
- `JobApplication` → `JobPosting`, `Organization`, `User`
- `JobEvent` → `JobPosting`, `Organization`, `User`
- `JobInterview` → `JobApplication`, `JobPosting`, `Organization`, `User`
- `JobOffer` → `JobApplication`, `JobPosting`, `Organization`, `User`
- `JobPosting` → `Organization`, `User`
- `JobReward` → `JobApplication`, `JobPosting`, `Organization`, `User`
- `JobsSettings` → `Organization`
- `JoinRequest` → `Organization`, `User`
- `LeaveRequest` → `Organization`, `User`
- `MagicLink` → `Invoice`, `User`
- `Meet` → `Organization`
- `MeetParticipant` → `Meet`
- `Message` → `Message`, `Organization`, `User`
- `MessageTranslation` → `GroupMessage`
- `MissedCall` → `Organization`, `User`
- `NcSubscription` → `User`
- `NcWallet` → `User`
- `NoteSession` → `MeetSession`
- `NoteSummary` → `NoteSession`
- `NoteTranscript` → `NoteSession`
- `Notification` → `Organization`, `User`
- `OfficeAddonPayment` → `OfficeAddon`, `OfficeAddonSubscription`, `Organization`, `User`, `WalletTransaction`
- `OfficeAddonSubscription` → `OfficeAddon`, `Organization`, `User`
- `OfficeSubscription` → `OfficePlan`, `Organization`, `User`
- `OfficeSubscriptionPayment` → `CommissionDistribution`, `OfficeSubscription`, `Organization`, `User`
- `OfficeUpgradeHistory` → `OfficeSubscription`, `Organization`, `StoreWallet`, `User`
- `OpenClawAgent` → `Organization`, `User`
- `OpenClawMessage` → `User`
- `Organization` → `GarageAdmin`, `ThirdPartyClient`, `User`
- `OrganizationCabinet` → `Organization`, `OrganizationCabinet`, `User`
- `OrganizationFile` → `Organization`, `OrganizationCabinet`, `OrganizationFile`, `User`
- `OrgCategory` → `GarageAdmin`
- `OrgConversionFee` → `Organization`, `User`
- `OrgKyc` → `GarageAdmin`, `Organization`
- `OrgRewardsWallet` → `Organization`, `User`
- `OtpCode` → `Organization`
- `OtpCodeAccessLog` → `GarageAdmin`
- `PendingCouponGift` → `CouponAssignment`, `Organization`, `User`
- `PendingInvite` → `User`
- `PendingReserveAssignment` → `ItemReserveLicense`, `Organization`, `User`
- `PermissionGrant` → `Organization`, `User`
- `PhoneVerificationEvent` → `User`, `Workshop`
- `PlatformCoupon` → `Organization`
- `PlatformCouponRedemption` → `Invoice`, `PlatformCoupon`, `User`
- `Playlist` → `Organization`, `User`
- `Poll` → `Organization`, `Post`
- `PollVote` → `Poll`, `User`
- `Post` → `Channel`, `Organization`, `Post`, `User`
- `PostBookmark` → `Organization`, `Post`, `User`
- `PostComment` → `Organization`, `Post`, `PostComment`, `User`
- `PostCommentLike` → `Organization`, `PostComment`, `User`
- `PostLike` → `Organization`, `Post`, `User`
- `PostRepost` → `Organization`, `Post`, `User`
- `Product` → `Channel`, `Organization`, `User`
- `ProductOrder` → `Organization`, `User`
- `RankQualification` → `RankRun`, `User`, `WalletTransaction`
- `RatingSummary` → `Organization`
- `ReferralBonusConfig` → `GarageAdmin`
- `ReferralBonusPayout` → `Organization`, `User`
- `ReserveLicense` → `Invoice`, `UnilevelPlusDistribution`, `UnilevelPlusPlan`, `UnilevelPlusPurchase`, `User`
- `Review` → `Organization`, `User`
- `ReviewVote` → `Review`, `User`
- `RoomBooking` → `ConferenceRoom`, `Organization`, `User`
- `SavedJob` → `JobPosting`, `User`
- `Service` → `Channel`, `Organization`, `User`
- `ServiceMilestoneMessage` → `Organization`, `Service`, `ServiceOpt`, `User`
- `ServiceOpt` → `Organization`, `Service`, `User`
- `ServiceReview` → `Organization`, `Service`, `ServiceOpt`, `User`
- `Settings` → `Organization`, `User`
- `ShareableLink` → `Organization`, `User`
- `SharedAccessLog` → `SharedItem`, `User`
- `SharedItem` → `Organization`, `User`
- `SocialAccount` → `User`
- `StandaloneVideo` → `Organization`, `User`
- `StoreCouponCommission` → `Organization`, `StoreProduct`, `User`
- `StoreCouponCommissionFire` → `Invoice`, `Organization`, `PlatformCoupon`, `StoreCouponCommission`, `User`
- `StoreWallet` → `Organization`, `StoreWallet`, `User`
- `StudySession` → `Course`
- `Subscription` → `Organization`, `SubscriptionPlan`, `User`
- `SubscriptionPayment` → `CommissionDistribution`, `Organization`, `Subscription`, `User`
- `SubscriptionPlan` → `Organization`, `User`
- `SupportTaskAssignment` → `Group`, `User`
- `SupportTicket` → `Floor`, `Organization`, `User`
- `SupportTicketBoard` → `Organization`, `User`
- `Task` → `Organization`, `User`
- `TeamforceBranch` → `Organization`
- `TeamforceBreakLog` → `Organization`, `TimeTracking`, `User`
- `TeamforceBreakSettings` → `Organization`
- `TeamforceCandidate` → `Organization`, `TeamforceRecruitmentRequest`
- `TeamforceDepartment` → `Organization`, `User`
- `TeamforceEmployeeProfile` → `Organization`, `TeamforceBranch`, `TeamforceDepartment`, `TeamforceSalaryStructure`, `TeamforceShift`, `TeamforceWeeklyOffPattern`, `User`
- `TeamforceEmployeeTaxDeclaration` → `Organization`, `User`
- `TeamforceLeavePolicy` → `Organization`
- `TeamforceLeaveRequest` → `Organization`, `User`
- `TeamforcePayrollConfig` → `Organization`
- `TeamforcePayrollRun` → `Organization`, `User`
- `TeamforcePayrollTransaction` → `Organization`, `TeamforcePayrollRun`, `TeamforceSalaryStructure`, `User`
- `TeamforceRecruitmentRequest` → `Organization`, `User`
- `TeamforceSalaryStructure` → `Organization`
- `TeamforceShift` → `Organization`
- `TeamforceWeeklyOffPattern` → `Organization`
- `TerritoryWallet` → `User`
- `TerritoryWalletTransaction` → `CommissionDistribution`, `FranchiseProgram`, `FranchiseTerritoryAssignment`, `Organization`, `TerritoryWallet`, `User`
- `Testimonial` → `Organization`, `User`
- `ThirdPartyClient` → `User`
- `Ticket` → `GarageAdmin`, `Group`, `GroupMessage`
- `TimeTracking` → `Organization`, `User`
- `Todo` → `Organization`, `User`
- `UnilevelPlusDistribution` → `UnilevelPlusPlan`, `User`
- `UnilevelPlusPlan` → `Organization`, `User`
- `UnilevelPlusPurchase` → `UnilevelPlusPlan`, `User`
- `User` → `GarageAdmin`, `Organization`, `User`
- `UserActivity` → `Organization`, `User`
- `UserCabinet` → `Organization`, `User`, `UserCabinet`
- `UserCryptoAddress` → `Organization`, `User`
- `UserFile` → `Organization`, `User`, `UserCabinet`, `UserFile`
- `UserNotification` → `Channel`, `CouponAssignment`, `FranchiseGlobalAssignment`, `FranchiseGlobalOffer`, `FranchiseOffer`, `FranchiseTerritoryAssignment`, `Group`, `Invoice`, `Organization`, `PendingReserveAssignment`, `PermissionGrant`, `Post`, `PostComment`, `User`
- `UserProductLink` → `Product`, `User`
- `Vacancy` → `Organization`, `User`
- `VoIPToken` → `User`
- `WalletAccount` → `Organization`, `User`
- `WalletTransaction` → `AffiliateWallet`, `Organization`, `StoreWallet`, `User`, `WalletTransaction`
- `WebinarAttendance` → `Organization`, `User`, `Workshop`
- `WebinarMessage` → `Workshop`
- `WebinarProductPin` → `Organization`, `Workshop`
- `WhitelabelBonusPayout` → `User`, `WhitelabelBonusRun`
- `Withdrawal` → `GarageAdmin`, `Organization`, `User`, `WalletAccount`
- `WithdrawalPreference` → `Organization`, `User`
- `Workshop` → `Channel`, `Organization`, `User`
- `WorkshopRegistration` → `Organization`, `User`, `Workshop`
- `WorkshopSessionOverride` → `User`, `Workshop`

## Models

### Admin

- **Collection:** `admins` · **Area:** Core platform · **Source:** `server/models/admin.model.ts` (doc: `server/models/admin.model.ts.md`) · **Options:** timestamps=true, autoIndex=null, capped=false
- **Used by:** `server/controllers/admin.controller.ts`
- **Hooks:** pre(save) ×5, pre(findOneAndReplace) ×1, pre(findOneAndUpdate) ×1, pre(replaceOne) ×1, pre(update) ×1, pre(updateOne) ×1, pre(updateMany) ×1, pre(remove) ×1, post(save) ×3, post(init) ×1
- **Statics/methods:** `initializeTimestamps()`

| Field | Type | Ref | Flags |
|---|---|---|---|
| `email` | String |  | required, unique |
| `name` | String |  | required |
| `passwordHash` | String |  | required |
| `role` | String |  | default "admin", enum ["admin","superadmin"] |
| `isActive` | Boolean |  | default true |
| `_id` | ObjectId |  |  |
| `createdAt` | Date |  |  |
| `updatedAt` | Date |  |  |

**Indexes:** `{"email":1} {"unique":true,"background":true}`; `{"email":1} {"unique":true,"background":true}`

### AdminNotificationLog

- **Collection:** `adminnotificationlogs` · **Area:** Core platform · **Source:** `server/models/adminNotificationLog.model.ts` (doc: `server/models/adminNotificationLog.model.ts.md`) · **Options:** timestamps=true, autoIndex=null, capped=false
- **Used by:** `server/services/adminNotifications/dispatch.ts`
- **Hooks:** pre(save) ×5, pre(findOneAndReplace) ×1, pre(findOneAndUpdate) ×1, pre(replaceOne) ×1, pre(update) ×1, pre(updateOne) ×1, pre(updateMany) ×1, pre(remove) ×1, post(save) ×3, post(init) ×1
- **Statics/methods:** `initializeTimestamps()`

| Field | Type | Ref | Flags |
|---|---|---|---|
| `ruleId` | ObjectId | `AdminNotificationRule` | required |
| `ruleName` | String |  | required |
| `eventName` | String |  | required, index |
| `eventId` | String |  | required |
| `recipients` | [String] |  | default [] |
| `status` | String |  | default "queued", enum ["queued","sent","failed","sk… |
| `error` | String |  |  |
| `_id` | ObjectId |  |  |
| `createdAt` | Date |  |  |
| `updatedAt` | Date |  |  |

**Indexes:** `{"eventName":1} {"background":true}`; `{"ruleId":1,"eventId":1} {"unique":true,"background":true}`; `{"ruleId":1,"status":1,"createdAt":-1} {"background":true}`

### AdminNotificationRule

- **Collection:** `adminnotificationrules` · **Area:** Core platform · **Source:** `server/models/adminNotificationRule.model.ts` (doc: `server/models/adminNotificationRule.model.ts.md`) · **Options:** timestamps=true, autoIndex=null, capped=false
- **Referenced by:** `AdminNotificationLog`
- **Used by:** `server/routes/adminNotifications.ts`, `server/services/adminNotifications/dispatch.ts`, `server/services/adminNotifications/evaluate.ts`
- **Hooks:** pre(save) ×5, pre(findOneAndReplace) ×1, pre(findOneAndUpdate) ×1, pre(replaceOne) ×1, pre(update) ×1, pre(updateOne) ×1, pre(updateMany) ×1, pre(remove) ×1, post(save) ×3, post(init) ×1
- **Statics/methods:** `initializeTimestamps()`

| Field | Type | Ref | Flags |
|---|---|---|---|
| `name` | String |  | required |
| `description` | String |  |  |
| `enabled` | Boolean |  | index, default false |
| `event` | String |  | required, index |
| `conditions` | Mixed |  | default fn default |
| `recipients` | Mixed |  | default fn default |
| `templateId` | String |  |  |
| `templateName` | String |  |  |
| `templateHtml` | String |  |  |
| `syncedAt` | Date |  |  |
| `throttlePerHour` | Number |  | default 60 |
| `recipientCap` | Number |  | default 50 |
| `orgId` | ObjectId | `Organization` | index, default null |
| `createdBy` | ObjectId | `GarageAdmin` |  |
| `lastFiredAt` | Date |  |  |
| `_id` | ObjectId |  |  |
| `createdAt` | Date |  |  |
| `updatedAt` | Date |  |  |

**Indexes:** `{"enabled":1} {"background":true}`; `{"event":1} {"background":true}`; `{"orgId":1} {"background":true}`; `{"event":1,"enabled":1} {"background":true}`

### AffiliateClick

- **Collection:** `affiliateclicks` · **Area:** Core platform · **Source:** `server/models/affiliateClick.model.ts` (doc: `server/models/affiliateClick.model.ts.md`) · **Options:** timestamps=true, autoIndex=null, capped=false
- **Used by:** `server/routes/affiliate.ts`
- **Hooks:** pre(save) ×5, pre(findOneAndReplace) ×1, pre(findOneAndUpdate) ×1, pre(replaceOne) ×1, pre(update) ×1, pre(updateOne) ×1, pre(updateMany) ×1, pre(remove) ×1, post(save) ×3, post(init) ×1
- **Statics/methods:** `initializeTimestamps()`

| Field | Type | Ref | Flags |
|---|---|---|---|
| `sessionId` | String |  | required |
| `affiliateId` | String |  | required, index |
| `affiliateUserId` | ObjectId | `User` | default null |
| `orgId` | ObjectId | `Organization` | default null |
| `itemType` | String |  | default "unknown", enum ["channel","product","office"… |
| `itemId` | String |  | default null |
| `itemName` | String |  | default "" |
| `visitorId` | String |  | default null |
| `userId` | ObjectId | `User` | default null |
| `ipHash` | String |  | default null |
| `userAgent` | String |  | default "" |
| `deviceType` | String |  | default "" |
| `referrerUrl` | String |  | default "" |
| `isBot` | Boolean |  | default false |
| `converted` | Boolean |  | default false |
| `convertedAt` | Date |  | default null |
| `_id` | ObjectId |  |  |
| `createdAt` | Date |  |  |
| `updatedAt` | Date |  |  |

**Indexes:** `{"affiliateId":1} {"background":true}`; `{"sessionId":1,"itemId":1} {"unique":true,"name":"click_session_item_unique","background":true}`; `{"affiliateUserId":1,"createdAt":-1} {"name":"affiliate_clicks_idx","background":true}`; `{"affiliateId":1,"createdAt":-1} {"name":"affiliate_code_idx","background":true}`; `{"affiliateUserId":1,"itemType":1,"itemId":1,"createdAt":-1} {"name":"affiliate_item_idx","background":true}`; `{"orgId":1,"createdAt":-1} {"sparse":true,"name":"org_clicks_idx","background":true}`

### AffiliateConversion

- **Collection:** `affiliateconversions` · **Area:** Core platform · **Source:** `server/models/affiliateConversion.model.ts` (doc: `server/models/affiliateConversion.model.ts.md`) · **Options:** timestamps=true, autoIndex=null, capped=false
- **Used by:** `server/routes/affiliate.ts`, `server/routes/feed.ts`
- **Hooks:** pre(save) ×5, pre(findOneAndReplace) ×1, pre(findOneAndUpdate) ×1, pre(replaceOne) ×1, pre(update) ×1, pre(updateOne) ×1, pre(updateMany) ×1, pre(remove) ×1, post(save) ×3, post(init) ×1
- **Statics/methods:** `initializeTimestamps()`

| Field | Type | Ref | Flags |
|---|---|---|---|
| `affiliateId` | String |  | required, index |
| `affiliateUserId` | ObjectId | `User` | default null |
| `orgId` | ObjectId | `Organization` | default null |
| `itemType` | String |  | required, enum ["channel","product","office"… |
| `itemId` | String |  | default null |
| `itemName` | String |  | default "" |
| `sessionId` | String |  | default null |
| `visitorId` | String |  | default null |
| `orderId` | String |  | default null |
| `amount` | Number |  | default 0 |
| `currency` | String |  | default "USD" |
| `_id` | ObjectId |  |  |
| `createdAt` | Date |  |  |
| `updatedAt` | Date |  |  |

**Indexes:** `{"affiliateId":1} {"background":true}`; `{"orderId":1} {"unique":true,"sparse":true,"name":"conversion_order_unique","background":true}`; `{"affiliateUserId":1,"createdAt":-1} {"name":"affiliate_conversions_idx","background":true}`; `{"affiliateUserId":1,"itemType":1,"itemId":1,"createdAt":-1} {"name":"affiliate_conversion_item_idx","background":true}`

### AffiliateLink

- **Collection:** `affiliatelinks` · **Area:** Core platform · **Source:** `server/models/affiliateLink.model.ts` (doc: `server/models/affiliateLink.model.ts.md`) · **Options:** timestamps=true, autoIndex=null, capped=false
- **Used by:** `server/routes/affiliate.ts`
- **Hooks:** pre(save) ×5, pre(findOneAndReplace) ×1, pre(findOneAndUpdate) ×1, pre(replaceOne) ×1, pre(update) ×1, pre(updateOne) ×1, pre(updateMany) ×1, pre(remove) ×1, post(save) ×3, post(init) ×1
- **Statics/methods:** `initializeTimestamps()`

| Field | Type | Ref | Flags |
|---|---|---|---|
| `userId` | ObjectId | `User` | required, index |
| `orgId` | ObjectId | `Organization` | required, index |
| `itemType` | String |  | index, default "channel", enum ["channel","product","office"… |
| `itemId` | ObjectId |  | index |
| `channelId` | ObjectId | `Channel` | index |
| `affiliateId` | String |  | required, index |
| `affiliateUrl` | String |  | required |
| `clickCount` | Number |  | default 0 |
| `lastClickedAt` | Date |  | default null |
| `isActive` | Boolean |  | default true |
| `_id` | ObjectId |  |  |
| `createdAt` | Date |  |  |
| `updatedAt` | Date |  |  |

**Indexes:** `{"userId":1} {"background":true}`; `{"orgId":1} {"background":true}`; `{"itemType":1} {"background":true}`; `{"itemId":1} {"background":true}`; `{"channelId":1} {"background":true}`; `{"affiliateId":1} {"background":true}`; `{"userId":1,"orgId":1,"itemType":1,"itemId":1} {"unique":true,"background":true}`

### AffiliateWallet

- **Collection:** `affiliatewallets` · **Area:** Core platform · **Source:** `server/models/affiliateWallet.model.ts` (doc: `server/models/affiliateWallet.model.ts.md`) · **Options:** timestamps=true, autoIndex=null, capped=false
- **Referenced by:** `WalletTransaction`
- **Used by:** `server/controllers/garageAdmin.controller.ts`, `server/scripts/delete-yopmail-users.ts`, `server/scripts/migrate-sweep-locked-earnings.ts`, `server/scripts/migrate-wallets.ts`, `server/scripts/move-unilevel-commission.ts`, `server/scripts/reset-wallets.ts`, `server/scripts/retro-migrate-cascade-to-up.ts`, `server/scripts/retro-pool-delta.ts`, … +15 more
- **Hooks:** pre(save) ×5, pre(findOneAndReplace) ×1, pre(findOneAndUpdate) ×1, pre(replaceOne) ×1, pre(update) ×1, pre(updateOne) ×1, pre(updateMany) ×1, pre(remove) ×1, post(save) ×3, post(init) ×1
- **Statics/methods:** `initializeTimestamps()`

| Field | Type | Ref | Flags |
|---|---|---|---|
| `userId` | ObjectId | `User` | required, unique, index |
| `balance` | Number |  | required, default 0 |
| `currency` | String |  | default "USD" |
| `isActive` | Boolean |  | default true |
| `totalEarnings` | Number |  | default 0 |
| `totalWithdrawn` | Number |  | default 0 |
| `totalForfeited` | Number |  | default 0 |
| `lastTransactionAt` | Date |  |  |
| `_id` | ObjectId |  |  |
| `createdAt` | Date |  |  |
| `updatedAt` | Date |  |  |

**Indexes:** `{"userId":1} {"unique":true,"background":true}`

### AIProviderKey

- **Collection:** `aiproviderkeys` · **Area:** Core platform · **Source:** `server/models/aiProviderKey.model.ts` (doc: `server/models/aiProviderKey.model.ts.md`) · **Options:** timestamps=true, autoIndex=null, capped=false
- **Used by:** `server/controllers/aiProviderKey.controller.ts`, `server/routes/founderAiProviders.ts`
- **Hooks:** pre(save) ×5, pre(findOneAndReplace) ×1, pre(findOneAndUpdate) ×1, pre(replaceOne) ×1, pre(update) ×1, pre(updateOne) ×1, pre(updateMany) ×1, pre(remove) ×1, post(save) ×3, post(init) ×1
- **Statics/methods:** `initializeTimestamps()`

| Field | Type | Ref | Flags |
|---|---|---|---|
| `providerId` | String |  | required, enum ["openai","anthropic","replic… |
| `encryptedKey` | String |  | required |
| `maskedKey` | String |  | required |
| `organizationId` | String |  | required |
| `createdBy` | ObjectId | `GarageAdmin` | required |
| `updatedBy` | ObjectId | `GarageAdmin` |  |
| `isActive` | Boolean |  | default true |
| `_id` | ObjectId |  |  |
| `createdAt` | Date |  |  |
| `updatedAt` | Date |  |  |

**Indexes:** `{"providerId":1,"organizationId":1} {"unique":true,"background":true}`

### AivatarWallet

- **Collection:** `garage_aivatar_wallets` · **Area:** Core platform · **Source:** `server/models/aivatarWallet.model.ts` (doc: `server/models/aivatarWallet.model.ts.md`) · **Options:** timestamps=true, autoIndex=null, capped=false
- **Referenced by:** `AivatarWalletTransaction`
- **Used by:** `server/routes/garageAdminWallets.ts`, `server/scripts/backfill-shorupan-wallet-to-garage-hq.ts`, `server/services/aivatarWallet.service.ts`
- **Hooks:** pre(save) ×5, pre(findOneAndReplace) ×1, pre(findOneAndUpdate) ×1, pre(replaceOne) ×1, pre(update) ×1, pre(updateOne) ×1, pre(updateMany) ×1, pre(remove) ×1, post(save) ×3, post(init) ×1
- **Statics/methods:** `initializeTimestamps()`

| Field | Type | Ref | Flags |
|---|---|---|---|
| `orgId` | ObjectId |  | required, unique, index |
| `balance` | Number |  | required, default 0 |
| `debt` | Number |  | required, default 0 |
| `lastTransactionAt` | Date |  |  |
| `_id` | ObjectId |  |  |
| `createdAt` | Date |  |  |
| `updatedAt` | Date |  |  |

**Indexes:** `{"orgId":1} {"unique":true,"background":true}`

### AivatarWalletTransaction

- **Collection:** `garage_aivatar_wallet_transactions` · **Area:** Core platform · **Source:** `server/models/aivatarWalletTransaction.model.ts` (doc: `server/models/aivatarWalletTransaction.model.ts.md`) · **Options:** timestamps={"createdAt":true,"updatedAt"…, autoIndex=null, capped=false
- **Used by:** `server/routes/garageAdminWallets.ts`, `server/routes/wallet.ts`, `server/scripts/migrate-wallet-transactions-to-collection.ts`, `server/services/aivatarWalletTransaction.service.ts`
- **Hooks:** pre(save) ×5, pre(findOneAndReplace) ×1, pre(findOneAndUpdate) ×1, pre(replaceOne) ×1, pre(update) ×1, pre(updateOne) ×1, pre(updateMany) ×1, pre(remove) ×1, post(save) ×3, post(init) ×1
- **Statics/methods:** `initializeTimestamps()`

| Field | Type | Ref | Flags |
|---|---|---|---|
| `walletId` | ObjectId | `AivatarWallet` | required |
| `orgId` | ObjectId | `Organization` | required |
| `type` | String |  | required, enum ["credit","debit","clear_debt… |
| `amount` | Number |  | required |
| `balanceAfter` | Number |  | required |
| `debtAfter` | Number |  | required |
| `source` | String |  | required, enum ["user","admin","system"] |
| `adminEmail` | String |  |  |
| `description` | String |  | required |
| `note` | String |  |  |
| `idempotencyKey` | String |  |  |
| `_id` | ObjectId |  |  |
| `createdAt` | Date |  |  |

**Indexes:** `{"orgId":1,"createdAt":-1} {"background":true}`; `{"walletId":1,"createdAt":-1} {"background":true}`; `{"createdAt":-1} {"background":true}`; `{"source":1,"createdAt":-1} {"background":true}`; `{"adminEmail":1,"createdAt":-1} {"background":true}`; `{"idempotencyKey":1} {"unique":true,"sparse":true,"background":true}`

### Announcement

- **Collection:** `announcements` · **Area:** Core platform · **Source:** `server/models/announcement.model.ts` (doc: `server/models/announcement.model.ts.md`) · **Options:** timestamps=true, autoIndex=null, capped=false
- **Used by:** `server/routes/garageAdminAnnouncements.ts`, `server/routes/publicAnnouncements.ts`
- **Hooks:** pre(save) ×5, pre(findOneAndReplace) ×1, pre(findOneAndUpdate) ×1, pre(replaceOne) ×1, pre(update) ×1, pre(updateOne) ×1, pre(updateMany) ×1, pre(remove) ×1, post(save) ×3, post(init) ×1
- **Statics/methods:** `initializeTimestamps()`

| Field | Type | Ref | Flags |
|---|---|---|---|
| `title` | String |  | required |
| `body` | String |  | default "" |
| `eyebrow` | String |  |  |
| `surface` | String |  | index, default "post-login", enum ["pre-login","post-login","ev… |
| `size` | String |  | default "md", enum ["sm","md","lg","banner"] |
| `contentType` | String |  | default "text", enum ["text","image-text"] |
| `imageUrl` | String |  |  |
| `template` | String |  | default "solid" |
| `icon` | String |  | default "megaphone" |
| `cta` | Embedded |  | default fn default |
| `comingSoon` | Boolean |  | default false |
| `comingSoonLabel` | String |  |  |
| `enabled` | Boolean |  | index, default false |
| `startsAt` | Date |  | default null |
| `endsAt` | Date |  | default null |
| `priority` | Number |  | default 0 |
| `version` | Number |  | default 1 |
| `createdByAdminId` | ObjectId | `GarageAdmin` | default null |
| `_id` | ObjectId |  |  |
| `createdAt` | Date |  |  |
| `updatedAt` | Date |  |  |

**Indexes:** `{"surface":1} {"background":true}`; `{"enabled":1} {"background":true}`; `{"enabled":1,"surface":1,"priority":-1,"createdAt":-1} {"background":true}`

### Application

- **Collection:** `applications` · **Area:** Core platform · **Source:** `server/models/application.model.ts` (doc: `server/models/application.model.ts.md`) · **Options:** timestamps=true, autoIndex=null, capped=false
- **Used by:** `server/routes/careers.ts`
- **Hooks:** pre(save) ×5, pre(findOneAndReplace) ×1, pre(findOneAndUpdate) ×1, pre(replaceOne) ×1, pre(update) ×1, pre(updateOne) ×1, pre(updateMany) ×1, pre(remove) ×1, post(save) ×3, post(init) ×1
- **Statics/methods:** `initializeTimestamps()`

| Field | Type | Ref | Flags |
|---|---|---|---|
| `vacancyId` | ObjectId | `Vacancy` | required |
| `vacancyTitle` | String |  | required |
| `orgId` | ObjectId | `Organization` | required |
| `applicantName` | String |  | required |
| `applicantEmail` | String |  | required |
| `applicantPhone` | String |  |  |
| `resumeUrl` | String |  |  |
| `coverLetter` | String |  |  |
| `status` | String |  | default "pending", enum ["pending","reviewed","shortl… |
| `_id` | ObjectId |  |  |
| `createdAt` | Date |  |  |
| `updatedAt` | Date |  |  |

### Approval

- **Collection:** `approvals` · **Area:** Core platform · **Source:** `server/models/approval.model.ts` (doc: `server/models/approval.model.ts.md`) · **Options:** timestamps=true, autoIndex=null, capped=false
- **Used by:** `server/routes/slashApprovals.ts`
- **Hooks:** pre(save) ×5, pre(findOneAndReplace) ×1, pre(findOneAndUpdate) ×1, pre(replaceOne) ×1, pre(update) ×1, pre(updateOne) ×1, pre(updateMany) ×1, pre(remove) ×1, post(save) ×3, post(init) ×1
- **Statics/methods:** `initializeTimestamps()`

| Field | Type | Ref | Flags |
|---|---|---|---|
| `orgId` | ObjectId | `Organization` | required, index |
| `requesterId` | ObjectId | `User` | required |
| `title` | String |  | required |
| `description` | String |  |  |
| `deadline` | Date |  |  |
| `approvalType` | String |  | default "parallel", enum ["parallel","sequential"] |
| `approvers` | [subdoc] |  | default [] |
| `overallStatus` | String |  | index, default "pending", enum ["pending","approved","reject… |
| `_id` | ObjectId |  |  |
| `createdAt` | Date |  |  |
| `updatedAt` | Date |  |  |

**Indexes:** `{"orgId":1} {"background":true}`; `{"overallStatus":1} {"background":true}`; `{"approvers.userId":1,"overallStatus":1} {"background":true}`

### AppSubscription

- **Collection:** `appsubscriptions` · **Area:** Core platform · **Source:** `server/models/appSubscription.model.ts` (doc: `server/models/appSubscription.model.ts.md`) · **Options:** timestamps=true, autoIndex=null, capped=false
- **Used by:** `server/routes/apps.ts`
- **Hooks:** pre(save) ×5, pre(findOneAndReplace) ×1, pre(findOneAndUpdate) ×1, pre(replaceOne) ×1, pre(update) ×1, pre(updateOne) ×1, pre(updateMany) ×1, pre(remove) ×1, post(save) ×3, post(init) ×1
- **Statics/methods:** `initializeTimestamps()`

| Field | Type | Ref | Flags |
|---|---|---|---|
| `userId` | ObjectId | `User` | required, index |
| `appId` | String |  | required, index |
| `organizationId` | ObjectId | `Organization` | required, index |
| `name` | String |  | required |
| `url` | String |  | required |
| `icon` | String |  |  |
| `description` | String |  |  |
| `_id` | ObjectId |  |  |
| `createdAt` | Date |  |  |
| `updatedAt` | Date |  |  |

**Indexes:** `{"userId":1} {"background":true}`; `{"appId":1} {"background":true}`; `{"organizationId":1} {"background":true}`; `{"userId":1,"appId":1,"organizationId":1} {"unique":true,"background":true}`

### Auction

- **Collection:** `auctions` · **Area:** Core platform · **Source:** `server/models/auction.model.ts` (doc: `server/models/auction.model.ts.md`) · **Options:** timestamps=true, autoIndex=null, capped=false
- **Used by:** `server/routes/auction.ts`
- **Hooks:** pre(save) ×5, pre(findOneAndReplace) ×1, pre(findOneAndUpdate) ×1, pre(replaceOne) ×1, pre(update) ×1, pre(updateOne) ×1, pre(updateMany) ×1, pre(remove) ×1, post(save) ×3, post(init) ×1
- **Statics/methods:** `initializeTimestamps()`

| Field | Type | Ref | Flags |
|---|---|---|---|
| `createdBy` | ObjectId | `User` | required |
| `creatorName` | String |  | required |
| `creatorAvatar` | String |  |  |
| `creatorOrgName` | String |  | required |
| `organizationId` | ObjectId | `Organization` | required |
| `productSource` | String |  | required, enum ["garage","outside"] |
| `productId` | ObjectId | `Product` |  |
| `productName` | String |  | required |
| `productImages` | [String] |  | default [] |
| `productDescription` | String |  |  |
| `productVideoUrl` | String |  |  |
| `minPrice` | Number |  | required |
| `currency` | String |  | default "USD", enum ["INR","USD"] |
| `durationHours` | Number |  | required |
| `startTime` | Date |  | required |
| `endTime` | Date |  | required |
| `status` | String |  | default "ongoing", enum ["ongoing","ended","cancelled… |
| `_id` | ObjectId |  |  |
| `createdAt` | Date |  |  |
| `updatedAt` | Date |  |  |

**Indexes:** `{"status":1,"createdAt":-1} {"background":true}`; `{"createdBy":1,"status":1} {"background":true}`

### AuctionEscrow

- **Collection:** `auctionescrows` · **Area:** Core platform · **Source:** `server/models/auctionEscrow.model.ts` (doc: `server/models/auctionEscrow.model.ts.md`) · **Options:** timestamps=true, autoIndex=null, capped=false
- **Used by:** `server/scripts/diagnoseAuctionSettlement.ts`, `server/services/auctionWallet.ts`
- **Hooks:** pre(save) ×5, pre(findOneAndReplace) ×1, pre(findOneAndUpdate) ×1, pre(replaceOne) ×1, pre(update) ×1, pre(updateOne) ×1, pre(updateMany) ×1, pre(remove) ×1, post(save) ×3, post(init) ×1
- **Statics/methods:** `initializeTimestamps()`

| Field | Type | Ref | Flags |
|---|---|---|---|
| `userId` | ObjectId | `User` | required, index |
| `productId` | ObjectId | `StoreProduct` | required, index |
| `orgId` | ObjectId | `Organization` | required, index |
| `lockedUsd` | Number |  | required, default 0 |
| `bidAmount` | Number |  | required, default 0 |
| `bidCurrency` | String |  | default "USD" |
| `exchangeRate` | Number |  | default 1 |
| `status` | String |  | index, default "held", enum ["held","refunded","settled"] |
| `lastBidId` | ObjectId |  | default null |
| `refundedAt` | Date |  | default null |
| `settledAt` | Date |  | default null |
| `_id` | ObjectId |  |  |
| `createdAt` | Date |  |  |
| `updatedAt` | Date |  |  |

**Indexes:** `{"userId":1} {"background":true}`; `{"productId":1} {"background":true}`; `{"orgId":1} {"background":true}`; `{"status":1} {"background":true}`; `{"userId":1,"productId":1} {"unique":true,"background":true}`; `{"productId":1,"status":1} {"background":true}`

### AuctionSettlement

- **Collection:** `auctionsettlements` · **Area:** Core platform · **Source:** `server/models/auctionSettlement.model.ts` (doc: `server/models/auctionSettlement.model.ts.md`) · **Options:** timestamps=true, autoIndex=null, capped=false
- **Used by:** `server/routes/garageAdminAuctionSettlements.ts`, `server/scripts/diagnoseAuctionSettlement.ts`, `server/services/auctionSettlement.ts`, `server/services/founderStreamTable.ts`
- **Hooks:** pre(save) ×5, pre(findOneAndReplace) ×1, pre(findOneAndUpdate) ×1, pre(replaceOne) ×1, pre(update) ×1, pre(updateOne) ×1, pre(updateMany) ×1, pre(remove) ×1, post(save) ×3, post(init) ×1
- **Statics/methods:** `initializeTimestamps()`

| Field | Type | Ref | Flags |
|---|---|---|---|
| `productId` | ObjectId | `StoreProduct` | required, index |
| `orgId` | ObjectId | `Organization` | required, index |
| `bidId` | ObjectId |  | required, unique |
| `winnerUserId` | ObjectId | `User` | required, index |
| `winnerEmail` | String |  | default null |
| `winnerName` | String |  | default null |
| `amountUsd` | Number |  | required |
| `bidAmount` | Number |  | required |
| `bidCurrency` | String |  | default "USD" |
| `exchangeRate` | Number |  | default 1 |
| `status` | String |  | index, default "pending", enum ["pending","settled","failed"… |
| `invoiceId` | ObjectId | `Invoice` | default null |
| `productOrderId` | ObjectId | `ProductOrder` | default null |
| `commissionDistributionId` | ObjectId | `CommissionDistribution` | default null |
| `sellerCreditedUsd` | Number |  | default null |
| `attempts` | Number |  | default 0 |
| `lastError` | String |  | default null |
| `nextAttemptAt` | Date |  | default null |
| `needsAddress` | Boolean |  | default false |
| `settledAt` | Date |  | default null |
| `_id` | ObjectId |  |  |
| `createdAt` | Date |  |  |
| `updatedAt` | Date |  |  |

**Indexes:** `{"productId":1} {"background":true}`; `{"orgId":1} {"background":true}`; `{"bidId":1} {"unique":true,"background":true}`; `{"winnerUserId":1} {"background":true}`; `{"status":1} {"background":true}`; `{"status":1,"createdAt":1} {"background":true}`

### AuctionWallet

- **Collection:** `auctionwallets` · **Area:** Core platform · **Source:** `server/models/auctionWallet.model.ts` (doc: `server/models/auctionWallet.model.ts.md`) · **Options:** timestamps=true, autoIndex=null, capped=false
- **Referenced by:** `AuctionWalletTransaction`
- **Used by:** `server/scripts/diagnoseAuctionSettlement.ts`, `server/services/auctionWallet.ts`
- **Hooks:** pre(save) ×5, pre(findOneAndReplace) ×1, pre(findOneAndUpdate) ×1, pre(replaceOne) ×1, pre(update) ×1, pre(updateOne) ×1, pre(updateMany) ×1, pre(remove) ×1, post(save) ×3, post(init) ×1
- **Statics/methods:** `initializeTimestamps()`

| Field | Type | Ref | Flags |
|---|---|---|---|
| `userId` | ObjectId | `User` | required, unique, index |
| `balance` | Number |  | required, default 0 |
| `lockedBalance` | Number |  | required, default 0 |
| `currency` | String |  | default "USD" |
| `isActive` | Boolean |  | default true |
| `lastTransactionAt` | Date |  | default null |
| `totalToppedUp` | Number |  | default 0 |
| `totalLocked` | Number |  | default 0 |
| `totalRefunded` | Number |  | default 0 |
| `totalSpent` | Number |  | default 0 |
| `_id` | ObjectId |  |  |
| `createdAt` | Date |  |  |
| `updatedAt` | Date |  |  |

**Indexes:** `{"userId":1} {"unique":true,"background":true}`

### AuctionWalletTransaction

- **Collection:** `auctionwallettransactions` · **Area:** Core platform · **Source:** `server/models/auctionWalletTransaction.model.ts` (doc: `server/models/auctionWalletTransaction.model.ts.md`) · **Options:** timestamps=true, autoIndex=null, capped=false
- **Used by:** `server/routes/wallet.ts`, `server/scripts/diagnoseAuctionSettlement.ts`, `server/services/auctionWallet.ts`
- **Hooks:** pre(save) ×5, pre(findOneAndReplace) ×1, pre(findOneAndUpdate) ×1, pre(replaceOne) ×1, pre(update) ×1, pre(updateOne) ×1, pre(updateMany) ×1, pre(remove) ×1, post(save) ×3, post(init) ×1
- **Statics/methods:** `initializeTimestamps()`

| Field | Type | Ref | Flags |
|---|---|---|---|
| `auctionWalletId` | ObjectId | `AuctionWallet` | required, index |
| `userId` | ObjectId | `User` | required, index |
| `type` | String |  | required, index, enum ["topup","bid_lock","bid_refu… |
| `direction` | String |  | required, enum ["in","out"] |
| `amount` | Number |  | required |
| `currency` | String |  | default "USD" |
| `balanceBefore` | Number |  | required |
| `balanceAfter` | Number |  | required |
| `lockedBefore` | Number |  | required, default 0 |
| `lockedAfter` | Number |  | required, default 0 |
| `productId` | ObjectId | `StoreProduct` | default null |
| `bidId` | ObjectId |  | default null |
| `description` | String |  | required |
| `note` | String |  | default null |
| `relatedTransactionId` | ObjectId |  | default null |
| `idempotencyKey` | String |  | default null |
| `metadata` | Mixed |  |  |
| `status` | String |  | index, default "completed", enum ["completed","pending","faile… |
| `_id` | ObjectId |  |  |
| `createdAt` | Date |  |  |
| `updatedAt` | Date |  |  |

**Indexes:** `{"auctionWalletId":1} {"background":true}`; `{"userId":1} {"background":true}`; `{"type":1} {"background":true}`; `{"status":1} {"background":true}`; `{"auctionWalletId":1,"createdAt":-1} {"background":true}`; `{"userId":1,"createdAt":-1} {"background":true}`; `{"productId":1,"type":1} {"background":true}`; `{"idempotencyKey":1} {"unique":true,"sparse":true,"background":true}`

### Availability

- **Collection:** `availabilities` · **Area:** Core platform · **Source:** `server/models/availability.model.ts` (doc: `server/models/availability.model.ts.md`) · **Options:** timestamps=true, autoIndex=null, capped=false
- **Used by:** `server/routes/calendar.ts`, `server/services/call.ts`
- **Hooks:** pre(save) ×5, pre(findOneAndReplace) ×1, pre(findOneAndUpdate) ×1, pre(replaceOne) ×1, pre(update) ×1, pre(updateOne) ×1, pre(updateMany) ×1, pre(remove) ×1, post(save) ×3, post(init) ×1
- **Statics/methods:** `initializeTimestamps()`

| Field | Type | Ref | Flags |
|---|---|---|---|
| `userId` | ObjectId | `User` | required, index |
| `orgId` | ObjectId | `Organization` | required, index |
| `dayOfWeek` | Number |  | required |
| `startTime` | String |  | required |
| `endTime` | String |  | required |
| `enabled` | Boolean |  | default true |
| `_id` | ObjectId |  |  |
| `createdAt` | Date |  |  |
| `updatedAt` | Date |  |  |

**Indexes:** `{"userId":1} {"background":true}`; `{"orgId":1} {"background":true}`; `{"userId":1,"orgId":1,"dayOfWeek":1} {"unique":true,"background":true}`

### BankDetails

- **Collection:** `bankdetails` · **Area:** Core platform · **Source:** `server/models/bank-details.model.ts` (doc: `server/models/bank-details.model.ts.md`) · **Options:** timestamps=true, autoIndex=null, capped=false
- **Used by:** `server/routes/wallet.ts`, `server/scripts/migrateBankDetailsToWalletAccount.ts`
- **Hooks:** pre(save) ×5, pre(findOneAndReplace) ×1, pre(findOneAndUpdate) ×1, pre(replaceOne) ×1, pre(update) ×1, pre(updateOne) ×1, pre(updateMany) ×1, pre(remove) ×1, post(save) ×3, post(init) ×1
- **Statics/methods:** `initializeTimestamps()`

| Field | Type | Ref | Flags |
|---|---|---|---|
| `userId` | ObjectId | `User` | required, unique, index |
| `country` | String |  | required |
| `bankName` | String |  | required |
| `branchAddress` | Embedded |  | required |
| `routingNumber` | String |  | default "" |
| `accountNumber` | String |  | required |
| `swiftCode` | String |  | required |
| `ibanNumber` | String |  | default "" |
| `beneficiaryName` | String |  | required |
| `beneficiaryAddress` | Embedded |  | required |
| `_id` | ObjectId |  |  |
| `createdAt` | Date |  |  |
| `updatedAt` | Date |  |  |

**Indexes:** `{"userId":1} {"unique":true,"background":true}`

### bat246B2CoinProductPurchases

- **Collection:** `bat246b2coinproductpurchases` · **Area:** BAT246 game · **Source:** `server/bat246/models/bat246B2CoinProductPurchase.model.ts` (doc: `server/bat246/models/bat246B2CoinProductPurchase.model.ts.md`) · **Options:** timestamps=false, autoIndex=null, capped=false
- **Used by:** `server/bat246/services/bat246Layaway.service.ts`
- **Hooks:** pre(save) ×4, pre(remove) ×1, post(save) ×3, post(init) ×1

| Field | Type | Ref | Flags |
|---|---|---|---|
| `userId` | ObjectId | `User` | required, index |
| `productId` | ObjectId | `Product` | required |
| `productLabel` | String |  | required, enum ["board","pod"] |
| `amount` | Number |  | required |
| `invoiceId` | ObjectId | `Invoice` | required, unique |
| `createdAt` | Date |  | default fn default |
| `_id` | ObjectId |  |  |

**Indexes:** `{"userId":1} {"background":true}`; `{"invoiceId":1} {"unique":true,"background":true}`

### bat246B2CoinTransactions

- **Collection:** `bat246b2cointransactions` · **Area:** BAT246 game · **Source:** `server/bat246/models/bat246B2CoinTransaction.model.ts` (doc: `server/bat246/models/bat246B2CoinTransaction.model.ts.md`) · **Options:** timestamps=false, autoIndex=null, capped=false
- **Used by:** `server/bat246/services/bat246Layaway.service.ts`
- **Hooks:** pre(save) ×4, pre(remove) ×1, post(save) ×3, post(init) ×1

| Field | Type | Ref | Flags |
|---|---|---|---|
| `fromUserId` | ObjectId | `User` | required, index |
| `toUserId` | ObjectId | `User` | required, index |
| `amount` | Number |  | required |
| `productId` | ObjectId | `Product` | default null |
| `breakdown` | [subdoc] |  | required |
| `requestId` | ObjectId | `bat246LayawayRequests` | default null |
| `createdAt` | Date |  | default fn default |
| `_id` | ObjectId |  |  |

**Indexes:** `{"fromUserId":1} {"background":true}`; `{"toUserId":1} {"background":true}`; `{"fromUserId":1,"createdAt":-1} {"background":true}`; `{"toUserId":1,"createdAt":-1} {"background":true}`

### bat246B2CoinWallets

- **Collection:** `bat246b2coinwallets` · **Area:** BAT246 game · **Source:** `server/bat246/models/bat246B2CoinWallet.model.ts` (doc: `server/bat246/models/bat246B2CoinWallet.model.ts.md`) · **Options:** timestamps=true, autoIndex=null, capped=false
- **Used by:** `server/bat246/services/bat246Layaway.service.ts`
- **Hooks:** pre(save) ×5, pre(findOneAndReplace) ×1, pre(findOneAndUpdate) ×1, pre(replaceOne) ×1, pre(update) ×1, pre(updateOne) ×1, pre(updateMany) ×1, pre(remove) ×1, post(save) ×3, post(init) ×1
- **Statics/methods:** `initializeTimestamps()`

| Field | Type | Ref | Flags |
|---|---|---|---|
| `userId` | ObjectId | `User` | required, unique, index |
| `balance` | Number |  | default 0 |
| `lastTransactionAt` | Date |  | default null |
| `_id` | ObjectId |  |  |
| `createdAt` | Date |  |  |
| `updatedAt` | Date |  |  |

**Indexes:** `{"userId":1} {"unique":true,"background":true}`

### bat246BoardInvites

- **Collection:** `bat246boardinvites` · **Area:** BAT246 game · **Source:** `server/bat246/models/bat246BoardInvites.model.ts` (doc: `server/bat246/models/bat246BoardInvites.model.ts.md`) · **Options:** timestamps=false, autoIndex=null, capped=false
- **Used by:** `server/bat246/services/bat246BoardInvite.service.ts`
- **Hooks:** pre(save) ×4, pre(remove) ×1, post(save) ×3, post(init) ×1

| Field | Type | Ref | Flags |
|---|---|---|---|
| `targetUserId` | ObjectId | `User` | required |
| `targetEmail` | String |  | required |
| `invitedByUserId` | ObjectId | `User` | required |
| `invitedByEmail` | String |  | required |
| `invitedByName` | String |  | default "" |
| `productId` | ObjectId | `Product` | required |
| `type` | String |  | required, enum ["invite","remind"] |
| `sentAt` | Date |  | default fn default |
| `_id` | ObjectId |  |  |

**Indexes:** `{"targetUserId":1,"sentAt":-1} {"background":true}`

### bat246Boards

- **Collection:** `bat246boards` · **Area:** BAT246 game · **Source:** `server/bat246/models/bat246Board.model.ts` (doc: `server/bat246/models/bat246Board.model.ts.md`) · **Options:** timestamps=true, autoIndex=null, capped=false
- **Referenced by:** `bat246Boards`, `bat246Distributors`, `bat246FreeEntries`, `bat246Movements`, `bat246PlayerBoards`, `bat246Recruitments`, `bat246SalesCredits`
- **Used by:** `server/bat246/__tests__/bat246.service.test.ts`, `server/bat246/__tests__/bat246Admin.service.test.ts`, `server/bat246/controllers/bat246.controller.ts`, `server/bat246/routes/bat246.routes.ts`, `server/bat246/routes/bat246Permission.routes.ts`, `server/bat246/scripts/backupAndWipeBat246.ts`, `server/bat246/scripts/fixChildBoardInviteProductId.ts`, `server/bat246/scripts/fixDugoutPromotion.ts`, … +28 more
- **Hooks:** pre(save) ×5, pre(findOneAndReplace) ×1, pre(findOneAndUpdate) ×1, pre(replaceOne) ×1, pre(update) ×1, pre(updateOne) ×1, pre(updateMany) ×1, pre(remove) ×1, post(save) ×3, post(init) ×1
- **Statics/methods:** `initializeTimestamps()`

| Field | Type | Ref | Flags |
|---|---|---|---|
| `boardNumber` | Number |  | required, unique |
| `trackingNumber` | String |  | required, unique |
| `title` | String |  |  |
| `status` | String |  | index, default "active", enum ["pending","active","splittin… |
| `hidden` | Boolean |  | default false |
| `mode` | String |  | default "live", enum ["live","test"] |
| `inviteProductId` | String |  | default null |
| `generation` | Number |  | default 0 |
| `familyNumber` | Number |  | default null |
| `side` | String |  | default null, enum ["left","right",null] |
| `parentBoardId` | ObjectId | `bat246Boards` | default null |
| `leftChildBoardId` | ObjectId | `bat246Boards` | default null |
| `rightChildBoardId` | ObjectId | `bat246Boards` | default null |
| `splitAt` | Date |  | default null |
| `protectionPeriodEnd` | Date |  | required |
| `ppPausedRemainingMs` | Number |  | default null |
| `warpCount` | Number |  | default 0 |
| `minorLeagueAmount` | Number |  | default 650 |
| `nextHomePlatePayout` | Number |  | default 200 |
| `pod` | [subdoc] |  | default [] |
| `podTeamId` | String |  | index, default null |
| `podEarnerPlayerId` | ObjectId | `bat246Players` | default null |
| `podCompletedAt` | Date |  | default null |
| `homePlate` | Embedded |  | default null |
| `thirdBase` | Embedded |  | default null |
| `secondBaseA` | Embedded |  | default null |
| `secondBaseB` | Embedded |  | default null |
| `firstBase` | [subdoc] |  | default [null,null,null,null] |
| `atBat` | [subdoc] |  | default [null,null,null,null,null,nul… |
| `dugout` | [subdoc] |  | default [] |
| `onDeckCircle` | [subdoc] |  | default [] |
| `hotBox` | [subdoc] |  | default [] |
| `penciling` | [subdoc] |  | default [] |
| `prePick` | [subdoc] |  | default [] |
| `leaderBoard` | [subdoc] |  | default [] |
| `_id` | ObjectId |  |  |
| `createdAt` | Date |  |  |
| `updatedAt` | Date |  |  |

**Indexes:** `{"boardNumber":1} {"unique":true,"background":true}`; `{"trackingNumber":1} {"unique":true,"background":true}`; `{"status":1} {"background":true}`; `{"podTeamId":1} {"background":true}`; `{"status":1,"createdAt":1} {"background":true}`; `{"parentBoardId":1} {"background":true}`

### Bat246CardPermission

- **Collection:** `bat246cardpermissions` · **Area:** BAT246 game · **Source:** `server/bat246/models/bat246CardPermission.model.ts` (doc: `server/bat246/models/bat246CardPermission.model.ts.md`) · **Options:** timestamps=true, autoIndex=null, capped=false
- **Used by:** `server/bat246/routes/bat246Permission.routes.ts`, `server/bat246/services/bat246Permission.service.ts`
- **Hooks:** pre(save) ×5, pre(findOneAndReplace) ×1, pre(findOneAndUpdate) ×1, pre(replaceOne) ×1, pre(update) ×1, pre(updateOne) ×1, pre(updateMany) ×1, pre(remove) ×1, post(save) ×3, post(init) ×1
- **Statics/methods:** `initializeTimestamps()`

| Field | Type | Ref | Flags |
|---|---|---|---|
| `userId` | ObjectId | `User` | required |
| `cardKey` | String |  | required, enum ["boards","members","distribu… |
| `grantedByEmail` | String |  | default "" |
| `_id` | ObjectId |  |  |
| `createdAt` | Date |  |  |
| `updatedAt` | Date |  |  |

**Indexes:** `{"userId":1,"cardKey":1} {"unique":true,"background":true}`

### bat246Config

- **Collection:** `bat246configs` · **Area:** BAT246 game · **Source:** `server/bat246/models/bat246Config.model.ts` (doc: `server/bat246/models/bat246Config.model.ts.md`) · **Options:** timestamps=true, autoIndex=null, capped=false
- **Used by:** `server/bat246/scripts/backupAndWipeBat246.ts`, `server/bat246/scripts/migrateTrackingNumbers.ts`, `server/bat246/scripts/seedBat246.ts`, `server/bat246/services/bat246Admin.service.ts`, `server/bat246/services/bat246DistributorId.util.ts`, `server/bat246/services/bat246Entry.service.ts`, `server/bat246/services/bat246PodInvite.service.ts`, `server/bat246/services/bat246Split.service.ts`, … +3 more
- **Hooks:** pre(save) ×5, pre(findOneAndReplace) ×1, pre(findOneAndUpdate) ×1, pre(replaceOne) ×1, pre(update) ×1, pre(updateOne) ×1, pre(updateMany) ×1, pre(remove) ×1, post(save) ×3, post(init) ×1
- **Statics/methods:** `initializeTimestamps()`

| Field | Type | Ref | Flags |
|---|---|---|---|
| `boardCounter` | Number |  | default 0 |
| `familyCounter` | Number |  | default 0 |
| `familySequences` | Mixed |  | default fn  |
| `distributorIdCounter` | Number |  | default 1000 |
| `podTeamCounter` | Number |  | default 1000 |
| `_id` | ObjectId |  |  |
| `createdAt` | Date |  |  |
| `updatedAt` | Date |  |  |

### bat246Distributors

- **Collection:** `bat246distributors` · **Area:** BAT246 game · **Source:** `server/bat246/models/bat246Distributor.model.ts` (doc: `server/bat246/models/bat246Distributor.model.ts.md`) · **Options:** timestamps=true, autoIndex=null, capped=false
- **Used by:** `server/bat246/controllers/bat246.controller.ts`, `server/bat246/routes/bat246.routes.ts`, `server/bat246/routes/bat246Profile.routes.ts`, `server/bat246/scripts/backupAndWipeBat246.ts`, `server/bat246/scripts/revert-test-garage-affiliate-boifeyaddequeu.ts`, `server/bat246/scripts/test-activate-garage-affiliate-boifeyaddequeu.ts`, `server/bat246/services/bat246.service.ts`, `server/bat246/services/bat246Admin.service.ts`, … +24 more
- **Hooks:** pre(save) ×5, pre(findOneAndReplace) ×1, pre(findOneAndUpdate) ×1, pre(replaceOne) ×1, pre(update) ×1, pre(updateOne) ×1, pre(updateMany) ×1, pre(remove) ×1, post(save) ×3, post(init) ×1
- **Statics/methods:** `initializeTimestamps()`

| Field | Type | Ref | Flags |
|---|---|---|---|
| `userId` | ObjectId | `User` | required, unique, index |
| `playerId` | ObjectId | `bat246Players` | index |
| `firstName` | String |  | default null |
| `lastName` | String |  | default null |
| `distributorId` | String |  | unique, index, sparse, default null |
| `userSnapshot.name` | String |  | default null |
| `userSnapshot.email` | String |  | default null |
| `userSnapshot.phone` | String |  | default null |
| `userSnapshot.profilePicture` | String |  | default null |
| `userSnapshot.country` | String |  | default null |
| `userSnapshot.state` | String |  | default null |
| `userSnapshot.city` | String |  | default null |
| `userSnapshot.postalCode` | String |  | default null |
| `countryOfBirth` | String |  | default null |
| `isOfficeMember` | Boolean |  | default false |
| `isGarageAffiliate` | Boolean |  | default false |
| `garageAffiliateExpiresAt` | Date |  | default null |
| `hasBat246Membership` | Boolean |  | default false |
| `membershipExpiresAt` | Date |  | default null |
| `hasPurchasedProduct` | Boolean |  | default false |
| `bat246RefUserId` | ObjectId | `User` | default null |
| `bat246RefBoardId` | ObjectId | `bat246Boards` | default null |
| `invitedProductId` | ObjectId | `Product` | default null |
| `isApproved` | Boolean |  | default false |
| `approvedAt` | Date |  | default null |
| `podInvitedByUserId` | ObjectId | `User` | default null |
| `podInvitedByEmail` | String |  | default null |
| `podInvitedByName` | String |  | default null |
| `podInviteSentAt` | Date |  | default null |
| `podInviteCount` | Number |  | default 0 |
| `podPurchaseCompletedAt` | Date |  | default null |
| `podPurchaseCreditedToUserId` | ObjectId | `User` | default null |
| `podPlacedBoardId` | ObjectId | `bat246Boards` | default null |
| `podPlacedPositionKey` | String |  | default null |
| `podPlacedAt` | Date |  | default null |
| `podPlacedByUserId` | ObjectId | `User` | default null |
| `boardInvitedByUserId` | ObjectId | `User` | default null |
| `boardInvitedByEmail` | String |  | default null |
| `boardInvitedByName` | String |  | default null |
| `boardInviteSentAt` | Date |  | default null |
| `boardInviteCount` | Number |  | default 0 |
| `boardPlacedBoardId` | ObjectId | `bat246Boards` | default null |
| `boardPlacedPositionKey` | String |  | default null |
| `boardPlacedAt` | Date |  | default null |
| `boardPlacedByUserId` | ObjectId | `User` | default null |
| `isQualified` | Boolean |  | default false |
| `qualifiedAt` | Date |  | default null |
| `disqualifiedAt` | Date |  | default null |
| `_id` | ObjectId |  |  |
| `createdAt` | Date |  |  |
| `updatedAt` | Date |  |  |

**Indexes:** `{"userId":1} {"unique":true,"background":true}`; `{"playerId":1} {"background":true}`; `{"distributorId":1} {"unique":true,"sparse":true,"background":true}`; `{"isQualified":1,"createdAt":-1} {"background":true}`

### bat246FreeEntries

- **Collection:** `bat246freeentries` · **Area:** BAT246 game · **Source:** `server/bat246/models/bat246FreeEntry.model.ts` (doc: `server/bat246/models/bat246FreeEntry.model.ts.md`) · **Options:** timestamps=true, autoIndex=null, capped=false
- **Used by:** `server/bat246/scripts/backupAndWipeBat246.ts`
- **Hooks:** pre(save) ×5, pre(findOneAndReplace) ×1, pre(findOneAndUpdate) ×1, pre(replaceOne) ×1, pre(update) ×1, pre(updateOne) ×1, pre(updateMany) ×1, pre(remove) ×1, post(save) ×3, post(init) ×1
- **Statics/methods:** `initializeTimestamps()`

| Field | Type | Ref | Flags |
|---|---|---|---|
| `playerId` | ObjectId | `bat246Players` | required, index |
| `triggerType` | String |  | required, enum ["residualPayout","cpdSales"] |
| `triggerBoardId` | ObjectId | `bat246Boards` | required |
| `assignedToBoardId` | ObjectId | `bat246Boards` | default null |
| `status` | String |  | default "pending", enum ["pending","active","used","e… |
| `restrictionEndsAt` | Date |  | default null |
| `usedAt` | Date |  | default null |
| `grayCardTransfer.fromPlayerId` | ObjectId | `bat246Players` | default null |
| `grayCardTransfer.toPlayerId` | ObjectId | `bat246Players` | default null |
| `earnedAt` | Date |  | required |
| `_id` | ObjectId |  |  |
| `createdAt` | Date |  |  |
| `updatedAt` | Date |  |  |

**Indexes:** `{"playerId":1} {"background":true}`

### bat246LayawayRequests

- **Collection:** `bat246layawayrequests` · **Area:** BAT246 game · **Source:** `server/bat246/models/bat246LayawayRequest.model.ts` (doc: `server/bat246/models/bat246LayawayRequest.model.ts.md`) · **Options:** timestamps=true, autoIndex=null, capped=false
- **Referenced by:** `bat246B2CoinTransactions`, `bat246PlacementNotifications`
- **Used by:** `server/bat246/services/bat246Layaway.service.ts`
- **Hooks:** pre(save) ×5, pre(findOneAndReplace) ×1, pre(findOneAndUpdate) ×1, pre(replaceOne) ×1, pre(update) ×1, pre(updateOne) ×1, pre(updateMany) ×1, pre(remove) ×1, post(save) ×3, post(init) ×1
- **Statics/methods:** `initializeTimestamps()`

| Field | Type | Ref | Flags |
|---|---|---|---|
| `requestedByUserId` | ObjectId | `User` | required, index |
| `eligibleUserId` | ObjectId | `User` | required, index |
| `recipientUserId` | ObjectId | `User` | required |
| `amount` | Number |  | required |
| `productId` | ObjectId | `Product` | default null |
| `note` | String |  | default "" |
| `status` | String |  | index, default "pending", enum ["pending","approved","denied… |
| `respondedAt` | Date |  | default null |
| `_id` | ObjectId |  |  |
| `createdAt` | Date |  |  |
| `updatedAt` | Date |  |  |

**Indexes:** `{"requestedByUserId":1} {"background":true}`; `{"eligibleUserId":1} {"background":true}`; `{"status":1} {"background":true}`; `{"eligibleUserId":1,"status":1} {"background":true}`

### bat246LostMoneyClaims

- **Collection:** `bat246lostmoneyclaims` · **Area:** BAT246 game · **Source:** `server/bat246/models/bat246LostMoneyClaim.model.ts` (doc: `server/bat246/models/bat246LostMoneyClaim.model.ts.md`) · **Options:** timestamps=true, autoIndex=null, capped=false
- **Referenced by:** `bat246LostMoneyPaid`
- **Used by:** `server/bat246/routes/bat246LostMoney.routes.ts`
- **Hooks:** pre(save) ×5, pre(findOneAndReplace) ×1, pre(findOneAndUpdate) ×1, pre(replaceOne) ×1, pre(update) ×1, pre(updateOne) ×1, pre(updateMany) ×1, pre(remove) ×1, post(save) ×3, post(init) ×1
- **Statics/methods:** `initializeTimestamps()`

| Field | Type | Ref | Flags |
|---|---|---|---|
| `userId` | ObjectId | `User` | default null |
| `companyName` | String |  | required |
| `registrationFees` | String |  | default "" |
| `totalLoss` | String |  | default "" |
| `lossDescription` | String |  | default "" |
| `managementNames` | String |  | default "" |
| `shareholderNames` | String |  | default "" |
| `reasonJoined` | String |  | default "" |
| `teamsCopy` | String |  | default "" |
| `teamsCopyImages` | [String] |  | default [] |
| `timeline` | String |  | default "" |
| `firstName` | String |  | required |
| `lastName` | String |  | required |
| `mobileNumber` | String |  | required |
| `city` | String |  | default "" |
| `country` | String |  | default "" |
| `cityAtLoss` | String |  | default "" |
| `countryAtLoss` | String |  | default "" |
| `sponsorName` | String |  | default "" |
| `sponsorPhone` | String |  | default "" |
| `sponsorCity` | String |  | default "" |
| `sponsorCountry` | String |  | default "" |
| `productBought` | String |  | default "" |
| `productCost` | String |  | default "" |
| `knownPeople` | String |  | default "" |
| `productChosenOrReceived` | String |  | default "" |
| `paymentMethod` | String |  | default "" |
| `teammates` | String |  | default "" |
| `meetingsHosted` | String |  | default "" |
| `priorEarnings` | String |  | default "" |
| `reasonForLoss` | String |  | default "" |
| `localManagement` | String |  | default "" |
| `profitCentersOnCount` | String |  | default "" |
| `profitCentersCount` | String |  | default "" |
| `venuesAttended` | String |  | default "" |
| `peopleIntroducedCount` | String |  | default "" |
| `peopleIntroducedSaleCost` | String |  | default "" |
| `boardsProfitedCount` | String |  | default "" |
| `boardsProfitedAmount` | String |  | default "" |
| `boardsLostCount` | String |  | default "" |
| `bestPart` | String |  | default "" |
| `worstPart` | String |  | default "" |
| `ageAtLoss` | String |  | default "" |
| `ageNow` | String |  | default "" |
| `idNumberAtLoss` | String |  | default "" |
| `status` | String |  | default "pending", enum ["pending","approved","reject… |
| `_id` | ObjectId |  |  |
| `createdAt` | Date |  |  |
| `updatedAt` | Date |  |  |

### bat246LostMoneyGalleryImages

- **Collection:** `bat246lostmoneygalleryimages` · **Area:** BAT246 game · **Source:** `server/bat246/models/bat246LostMoneyGalleryImage.model.ts` (doc: `server/bat246/models/bat246LostMoneyGalleryImage.model.ts.md`) · **Options:** timestamps=true, autoIndex=null, capped=false
- **Used by:** `server/bat246/routes/bat246LostMoney.routes.ts`
- **Hooks:** pre(save) ×5, pre(findOneAndReplace) ×1, pre(findOneAndUpdate) ×1, pre(replaceOne) ×1, pre(update) ×1, pre(updateOne) ×1, pre(updateMany) ×1, pre(remove) ×1, post(save) ×3, post(init) ×1
- **Statics/methods:** `initializeTimestamps()`

| Field | Type | Ref | Flags |
|---|---|---|---|
| `url` | String |  | required |
| `key` | String |  | required |
| `order` | Number |  | default 0 |
| `_id` | ObjectId |  |  |
| `createdAt` | Date |  |  |
| `updatedAt` | Date |  |  |

### bat246LostMoneyPaid

- **Collection:** `bat246lostmoneypaids` · **Area:** BAT246 game · **Source:** `server/bat246/models/bat246LostMoneyPaid.model.ts` (doc: `server/bat246/models/bat246LostMoneyPaid.model.ts.md`) · **Options:** timestamps=true, autoIndex=null, capped=false
- **Referenced by:** `bat246LostMoneyPayment`
- **Used by:** `server/bat246/routes/bat246LostMoney.routes.ts`, `server/bat246/services/bat246Layaway.service.ts`, `server/bat246/services/bat246LostMoneyAutoPay.service.ts`, `server/scripts/bat246-move-lostmoney-lineup-to-waiting.ts`
- **Hooks:** pre(save) ×5, pre(findOneAndReplace) ×1, pre(findOneAndUpdate) ×1, pre(replaceOne) ×1, pre(update) ×1, pre(updateOne) ×1, pre(updateMany) ×1, pre(remove) ×1, post(save) ×3, post(init) ×1
- **Statics/methods:** `initializeTimestamps()`

| Field | Type | Ref | Flags |
|---|---|---|---|
| `name` | String |  | required |
| `userId` | ObjectId | `User` | default null |
| `email` | String |  | default "" |
| `claimId` | ObjectId | `bat246LostMoneyClaims` | default null |
| `reportedLoss` | String |  | default "" |
| `approvedAmount` | Number |  | required |
| `totalPaid` | Number |  | required, default 0 |
| `lastPaymentAmount` | Number |  | default 0 |
| `lastPaymentAt` | Date |  | default null |
| `order` | Number |  | default 0 |
| `roundAccumulated` | Number |  | default 0 |
| `fullyRepaid` | Boolean |  | default false |
| `movedToLineupAt` | Date |  |  |
| `_id` | ObjectId |  |  |
| `createdAt` | Date |  |  |
| `updatedAt` | Date |  |  |

### bat246LostMoneyPayment

- **Collection:** `bat246lostmoneypayments` · **Area:** BAT246 game · **Source:** `server/bat246/models/bat246LostMoneyPayment.model.ts` (doc: `server/bat246/models/bat246LostMoneyPayment.model.ts.md`) · **Options:** timestamps=true, autoIndex=null, capped=false
- **Used by:** `server/bat246/services/bat246Layaway.service.ts`, `server/bat246/services/bat246LostMoneyAutoPay.service.ts`
- **Hooks:** pre(save) ×5, pre(findOneAndReplace) ×1, pre(findOneAndUpdate) ×1, pre(replaceOne) ×1, pre(update) ×1, pre(updateOne) ×1, pre(updateMany) ×1, pre(remove) ×1, post(save) ×3, post(init) ×1
- **Statics/methods:** `initializeTimestamps()`

| Field | Type | Ref | Flags |
|---|---|---|---|
| `paidEntryId` | ObjectId | `bat246LostMoneyPaid` | required, index |
| `amount` | Number |  | required |
| `recordedByEmail` | String |  | default "" |
| `note` | String |  | default "" |
| `source` | String |  | default "auto", enum ["auto"] |
| `_id` | ObjectId |  |  |
| `createdAt` | Date |  |  |
| `updatedAt` | Date |  |  |

**Indexes:** `{"paidEntryId":1} {"background":true}`

### bat246LostMoneyPaymentSettings

- **Collection:** `bat246lostmoneypaymentsettings` · **Area:** BAT246 game · **Source:** `server/bat246/models/bat246LostMoneyPaymentSettings.model.ts` (doc: `server/bat246/models/bat246LostMoneyPaymentSettings.model.ts.md`) · **Options:** timestamps=true, autoIndex=null, capped=false
- **Used by:** `server/bat246/routes/bat246LostMoney.routes.ts`, `server/bat246/services/bat246LostMoneyAutoPay.service.ts`
- **Hooks:** pre(save) ×5, pre(findOneAndReplace) ×1, pre(findOneAndUpdate) ×1, pre(replaceOne) ×1, pre(update) ×1, pre(updateOne) ×1, pre(updateMany) ×1, pre(remove) ×1, post(save) ×3, post(init) ×1
- **Statics/methods:** `initializeTimestamps()`

| Field | Type | Ref | Flags |
|---|---|---|---|
| `paymentsEnabled` | Boolean |  | default true |
| `updatedByEmail` | String |  | default "" |
| `pauseHistory` | [subdoc] |  | default [] |
| `_id` | ObjectId |  |  |
| `createdAt` | Date |  |  |
| `updatedAt` | Date |  |  |

### bat246LostMoneyTestimonials

- **Collection:** `bat246lostmoneytestimonials` · **Area:** BAT246 game · **Source:** `server/bat246/models/bat246LostMoneyTestimonial.model.ts` (doc: `server/bat246/models/bat246LostMoneyTestimonial.model.ts.md`) · **Options:** timestamps=true, autoIndex=null, capped=false
- **Used by:** `server/bat246/routes/bat246LostMoney.routes.ts`, `server/scripts/update-will-wiens-testimonial.ts`
- **Hooks:** pre(save) ×5, pre(findOneAndReplace) ×1, pre(findOneAndUpdate) ×1, pre(replaceOne) ×1, pre(update) ×1, pre(updateOne) ×1, pre(updateMany) ×1, pre(remove) ×1, post(save) ×3, post(init) ×1
- **Statics/methods:** `initializeTimestamps()`

| Field | Type | Ref | Flags |
|---|---|---|---|
| `name` | String |  | required |
| `message` | String |  | required |
| `images` | [subdoc] |  | default [] |
| `approved` | Boolean |  | default false |
| `approvedAt` | Date |  | default null |
| `hidden` | Boolean |  | default false |
| `_id` | ObjectId |  |  |
| `createdAt` | Date |  |  |
| `updatedAt` | Date |  |  |

### bat246Movements

- **Collection:** `bat246movements` · **Area:** BAT246 game · **Source:** `server/bat246/models/bat246Movement.model.ts` (doc: `server/bat246/models/bat246Movement.model.ts.md`) · **Options:** timestamps=false, autoIndex=null, capped=false
- **Used by:** `server/bat246/scripts/backupAndWipeBat246.ts`, `server/bat246/scripts/runSplitPhase2.ts`, `server/bat246/services/bat246.service.ts`, `server/bat246/services/bat246Split.service.ts`
- **Hooks:** pre(save) ×4, pre(remove) ×1, post(save) ×3, post(init) ×1

| Field | Type | Ref | Flags |
|---|---|---|---|
| `fromBoardId` | ObjectId | `bat246Boards` | required |
| `toBoardId` | ObjectId | `bat246Boards` | required |
| `playerId` | ObjectId | `bat246Players` | required |
| `playerName` | String |  |  |
| `fromPosition` | String |  | required |
| `toPosition` | String |  | required |
| `reason` | String |  | required, enum ["split","warp","progression"… |
| `timestamp` | Date |  | required |
| `_id` | ObjectId |  |  |

**Indexes:** `{"fromBoardId":1,"timestamp":-1} {"background":true}`; `{"playerId":1,"timestamp":-1} {"background":true}`

### bat246OfficeInvites

- **Collection:** `bat246officeinvites` · **Area:** BAT246 game · **Source:** `server/bat246/models/bat246OfficeInvite.model.ts` (doc: `server/bat246/models/bat246OfficeInvite.model.ts.md`) · **Options:** timestamps=true, autoIndex=null, capped=false
- **Used by:** `server/bat246/routes/bat246.routes.ts`, `server/bat246/services/bat246.service.ts`
- **Hooks:** pre(save) ×5, pre(findOneAndReplace) ×1, pre(findOneAndUpdate) ×1, pre(replaceOne) ×1, pre(update) ×1, pre(updateOne) ×1, pre(updateMany) ×1, pre(remove) ×1, post(save) ×3, post(init) ×1
- **Statics/methods:** `initializeTimestamps()`

| Field | Type | Ref | Flags |
|---|---|---|---|
| `email` | String |  | required, unique |
| `inviterUserId` | ObjectId | `User` | required |
| `productId` | ObjectId | `Product` | required |
| `_id` | ObjectId |  |  |
| `createdAt` | Date |  |  |
| `updatedAt` | Date |  |  |

**Indexes:** `{"email":1} {"unique":true,"background":true}`

### bat246PendingPlacements

- **Collection:** `bat246pendingplacements` · **Area:** BAT246 game · **Source:** `server/bat246/models/bat246PendingPlacement.model.ts` (doc: `server/bat246/models/bat246PendingPlacement.model.ts.md`) · **Options:** timestamps=false, autoIndex=null, capped=false
- **Used by:** `server/bat246/routes/bat246.routes.ts`, `server/routes/invoice.ts`, `server/routes/productCheckout.ts`, `server/services/invoice.ts`
- **Hooks:** pre(save) ×4, pre(remove) ×1, post(save) ×3, post(init) ×1

| Field | Type | Ref | Flags |
|---|---|---|---|
| `userId` | ObjectId | `User` | required |
| `userName` | String |  | default "" |
| `userEmail` | String |  | required |
| `boardId` | ObjectId | `Bat246Board` | required |
| `position` | String |  | required |
| `refUserId` | ObjectId | `User` | required |
| `purchasedAt` | Date |  | default fn default |
| `expiresAt` | Date |  | required |
| `isPlaced` | Boolean |  | default false |
| `_id` | ObjectId |  |  |

**Indexes:** `{"boardId":1,"position":1,"isPlaced":1} {"background":true}`; `{"userId":1,"isPlaced":1} {"background":true}`

### bat246PlacementNotifications

- **Collection:** `bat246placementnotifications` · **Area:** BAT246 game · **Source:** `server/bat246/models/bat246PlacementNotifications.model.ts` (doc: `server/bat246/models/bat246PlacementNotifications.model.ts.md`) · **Options:** autoIndex=null, capped=false
- **Used by:** `server/bat246/controllers/bat246.controller.ts`, `server/bat246/services/bat246.service.ts`, `server/bat246/services/bat246Layaway.service.ts`, `server/bat246/services/bat246MembershipBilling.service.ts`, `server/bat246/services/bat246SnapBackLoan.service.ts`, `server/routes/invoice.ts`, `server/routes/productCheckout.ts`, `server/routes/unilevel-plus.ts`, … +1 more
- **Hooks:** pre(save) ×4, pre(remove) ×1, post(save) ×3, post(init) ×1

| Field | Type | Ref | Flags |
|---|---|---|---|
| `notificationType` | String |  | default "placement" |
| `boardId` | ObjectId | `Bat246Board` | default null |
| `boardTrackingNo` | String |  | default "" |
| `position` | String |  | default null |
| `qualifiedUserId` | ObjectId | `User` | required |
| `qualifiedUserEmail` | String |  | required |
| `qualifiedUserName` | String |  | default "" |
| `uplineUserId` | ObjectId | `User` | required |
| `uplinePosition` | String |  | default "" |
| `isRead` | Boolean |  | default false |
| `isActioned` | Boolean |  | default false |
| `createdAt` | Date |  | default fn default |
| `layawayRequestId` | ObjectId | `bat246LayawayRequests` | default null |
| `snapBackLoanRequestId` | ObjectId | `bat246SnapBackLoanRequests` | default null |
| `summary` | String |  | default "" |
| `_id` | ObjectId |  |  |

**Indexes:** `{"uplineUserId":1,"isActioned":1} {"background":true}`

### bat246PlayerBoards

- **Collection:** `bat246playerboards` · **Area:** BAT246 game · **Source:** `server/bat246/models/bat246PlayerBoard.model.ts` (doc: `server/bat246/models/bat246PlayerBoard.model.ts.md`) · **Options:** timestamps=true, autoIndex=null, capped=false
- **Used by:** `server/bat246/controllers/bat246.controller.ts`, `server/bat246/scripts/backupAndWipeBat246.ts`, `server/bat246/scripts/fixMissingAB8Entry.ts`, `server/bat246/scripts/runSplitPhase2.ts`, `server/bat246/scripts/seedBat246.ts`, `server/bat246/services/bat246.service.ts`, `server/bat246/services/bat246Admin.service.ts`, `server/bat246/services/bat246Entry.service.ts`, … +2 more
- **Hooks:** pre(save) ×5, pre(findOneAndReplace) ×1, pre(findOneAndUpdate) ×1, pre(replaceOne) ×1, pre(update) ×1, pre(updateOne) ×1, pre(updateMany) ×1, pre(remove) ×1, post(save) ×3, post(init) ×1
- **Statics/methods:** `initializeTimestamps()`

| Field | Type | Ref | Flags |
|---|---|---|---|
| `playerId` | ObjectId | `bat246Players` | required |
| `boardId` | ObjectId | `bat246Boards` | required |
| `position` | String |  | required |
| `status` | String |  | default "active", enum ["active","left"] |
| `joinedAt` | Date |  | required |
| `leftAt` | Date |  | default null |
| `_id` | ObjectId |  |  |
| `createdAt` | Date |  |  |
| `updatedAt` | Date |  |  |

**Indexes:** `{"boardId":1,"status":1} {"background":true}`; `{"playerId":1,"status":1} {"background":true}`; `{"boardId":1,"playerId":1} {"unique":true,"background":true}`

### bat246Players

- **Collection:** `bat246players` · **Area:** BAT246 game · **Source:** `server/bat246/models/bat246Player.model.ts` (doc: `server/bat246/models/bat246Player.model.ts.md`) · **Options:** timestamps=true, autoIndex=null, capped=false
- **Referenced by:** `bat246Boards`, `bat246Distributors`, `bat246FreeEntries`, `bat246Movements`, `bat246PlayerBoards`, `bat246Recruitments`, `bat246SalesCredits`
- **Used by:** `server/bat246/__tests__/bat246Admin.service.test.ts`, `server/bat246/controllers/bat246.controller.ts`, `server/bat246/routes/bat246.routes.ts`, `server/bat246/routes/bat246Permission.routes.ts`, `server/bat246/scripts/addPlayersToOrg.ts`, `server/bat246/scripts/backupAndWipeBat246.ts`, `server/bat246/scripts/fixMissingAB8Entry.ts`, `server/bat246/scripts/runSplitPhase2.ts`, … +27 more
- **Hooks:** pre(save) ×5, pre(findOneAndReplace) ×1, pre(findOneAndUpdate) ×1, pre(replaceOne) ×1, pre(update) ×1, pre(updateOne) ×1, pre(updateMany) ×1, pre(remove) ×1, post(save) ×3, post(init) ×1
- **Statics/methods:** `initializeTimestamps()`

| Field | Type | Ref | Flags |
|---|---|---|---|
| `userId` | ObjectId | `User` | index |
| `playerIdNo` | String |  | required, unique |
| `nickname` | String |  |  |
| `email` | String |  | required |
| `role` | String |  |  |
| `memberSince` | Date |  |  |
| `countryResidence` | String |  |  |
| `countryOrigin` | String |  |  |
| `membershipActive` | Boolean |  | default false |
| `membershipExpiresAt` | Date |  | default null |
| `membershipPlan` | String |  | default null, enum ["trial","monthly",null] |
| `membershipStartedAt` | Date |  | default null |
| `nextBillingAt` | Date |  | default null |
| `freeEntriesEarned` | Number |  | default 0 |
| `freeEntriesUsed` | Number |  | default 0 |
| `freeEntryInterval` | Number |  | default 3 |
| `minorLeague` | Embedded |  | default fn default |
| `majorLeague` | Embedded |  | default fn default |
| `trophies.T` | Embedded |  | default null |
| `trophies.H` | Embedded |  | default null |
| `trophies.G` | Embedded |  | default null |
| `_id` | ObjectId |  |  |
| `createdAt` | Date |  |  |
| `updatedAt` | Date |  |  |

**Indexes:** `{"userId":1} {"background":true}`; `{"playerIdNo":1} {"unique":true,"background":true}`

### bat246PodInvites

- **Collection:** `bat246podinvites` · **Area:** BAT246 game · **Source:** `server/bat246/models/bat246PodInvites.model.ts` (doc: `server/bat246/models/bat246PodInvites.model.ts.md`) · **Options:** timestamps=false, autoIndex=null, capped=false
- **Used by:** `server/bat246/services/bat246PodInvite.service.ts`
- **Hooks:** pre(save) ×4, pre(remove) ×1, post(save) ×3, post(init) ×1

| Field | Type | Ref | Flags |
|---|---|---|---|
| `targetUserId` | ObjectId | `User` | required |
| `targetEmail` | String |  | required |
| `invitedByUserId` | ObjectId | `User` | required |
| `invitedByEmail` | String |  | required |
| `invitedByName` | String |  | default "" |
| `productId` | ObjectId | `Product` | required |
| `type` | String |  | required, enum ["invite","remind"] |
| `sentAt` | Date |  | default fn default |
| `_id` | ObjectId |  |  |

**Indexes:** `{"targetUserId":1,"sentAt":-1} {"background":true}`

### bat246PositionReservations

- **Collection:** `bat246positionreservations` · **Area:** BAT246 game · **Source:** `server/bat246/models/bat246PositionReservations.model.ts` (doc: `server/bat246/models/bat246PositionReservations.model.ts.md`) · **Options:** timestamps=false, autoIndex=null, capped=false
- **Used by:** `server/bat246/routes/bat246.routes.ts`, `server/bat246/services/bat246.service.ts`, `server/routes/invoice.ts`, `server/routes/productCheckout.ts`, `server/scripts/bat246-backfill-auto-placement.ts`, `server/services/invoice.ts`
- **Hooks:** pre(save) ×4, pre(remove) ×1, post(save) ×3, post(init) ×1

| Field | Type | Ref | Flags |
|---|---|---|---|
| `boardId` | ObjectId | `Bat246Board` | required |
| `position` | String |  | required, enum ["thirdBase","secondBaseA","s… |
| `reservedByUserId` | ObjectId | `User` | required |
| `reservedByEmail` | String |  | required |
| `productId` | ObjectId | `Product` | default null |
| `reservedAt` | Date |  | default fn default |
| `expiresAt` | Date |  | required |
| `status` | String |  | default "active", enum ["active","used","expired"] |
| `_id` | ObjectId |  |  |

**Indexes:** `{"boardId":1,"position":1,"status":1} {"background":true}`; `{"boardId":1,"position":1} {"unique":true,"partialFilterExpression":{"status":"active"},"background":true}`; `{"expiresAt":1} {"expireAfterSeconds":0,"background":true}`

### bat246Recruitments

- **Collection:** `bat246recruitments` · **Area:** BAT246 game · **Source:** `server/bat246/models/bat246Recruitment.model.ts` (doc: `server/bat246/models/bat246Recruitment.model.ts.md`) · **Options:** timestamps=true, autoIndex=null, capped=false
- **Used by:** `server/bat246/scripts/backupAndWipeBat246.ts`
- **Hooks:** pre(save) ×5, pre(findOneAndReplace) ×1, pre(findOneAndUpdate) ×1, pre(replaceOne) ×1, pre(update) ×1, pre(updateOne) ×1, pre(updateMany) ×1, pre(remove) ×1, post(save) ×3, post(init) ×1
- **Statics/methods:** `initializeTimestamps()`

| Field | Type | Ref | Flags |
|---|---|---|---|
| `boardId` | ObjectId | `bat246Boards` | required, index |
| `recruiterId` | ObjectId | `bat246Players` | required |
| `buyerId` | ObjectId | `bat246Players` | required |
| `payerId` | ObjectId | `bat246Players` | required |
| `scenario` | String |  | required, enum ["A","B","C","SelfEntry"] |
| `payerRelinquished` | Boolean |  | default null |
| `tncAcceptedAt` | Date |  |  |
| `entryFeeAmount` | Number |  | default 650 |
| `atBatPosition` | String |  |  |
| `_id` | ObjectId |  |  |
| `createdAt` | Date |  |  |
| `updatedAt` | Date |  |  |

**Indexes:** `{"boardId":1} {"background":true}`

### bat246SalesCredits

- **Collection:** `bat246salescredits` · **Area:** BAT246 game · **Source:** `server/bat246/models/bat246SalesCredit.model.ts` (doc: `server/bat246/models/bat246SalesCredit.model.ts.md`) · **Options:** timestamps=false, autoIndex=null, capped=false
- **Used by:** `server/bat246/routes/bat246.routes.ts`, `server/bat246/scripts/backupAndWipeBat246.ts`, `server/bat246/scripts/seedBat246.ts`, `server/bat246/services/bat246.service.ts`, `server/bat246/services/bat246Admin.service.ts`, `server/bat246/services/bat246Entry.service.ts`, `server/scripts/bat246-test-board-create.ts`, `server/scripts/bat246-test-board-delete.ts`, … +1 more
- **Hooks:** pre(save) ×4, pre(remove) ×1, post(save) ×3, post(init) ×1

| Field | Type | Ref | Flags |
|---|---|---|---|
| `boardId` | ObjectId | `bat246Boards` | required, index |
| `playerId` | ObjectId | `bat246Players` | required |
| `playerName` | String |  |  |
| `position` | String |  |  |
| `cardType` | String |  | required, enum ["Gold","Black","Brown","Gray… |
| `countsForLB` | Boolean |  | required |
| `isPostPP` | Boolean |  | default false |
| `saleAmount` | Number |  | default 0 |
| `isLayaway` | Boolean |  | default false |
| `grayDistribution` | Embedded |  | default null |
| `cardBack` | Embedded |  | default null |
| `earnedAt` | Date |  | required |
| `referredUserId` | ObjectId | `bat246Players` | default null |
| `referredUserName` | String |  | default null |
| `boardTrackingNumber` | String |  | default null |
| `_id` | ObjectId |  |  |

**Indexes:** `{"boardId":1} {"background":true}`; `{"playerId":1,"countsForLB":1} {"background":true}`; `{"playerId":1,"cardType":1} {"background":true}`; `{"playerId":1,"earnedAt":1} {"background":true}`

### bat246SnapBackLoanRepayments

- **Collection:** `bat246snapbackloanrepayments` · **Area:** BAT246 game · **Source:** `server/bat246/models/bat246SnapBackLoanRepayment.model.ts` (doc: `server/bat246/models/bat246SnapBackLoanRepayment.model.ts.md`) · **Options:** timestamps=false, autoIndex=null, capped=false
- **Used by:** `server/bat246/services/bat246SnapBackLoan.service.ts`
- **Hooks:** pre(save) ×4, pre(remove) ×1, post(save) ×3, post(init) ×1

| Field | Type | Ref | Flags |
|---|---|---|---|
| `loanId` | ObjectId | `bat246SnapBackLoans` | required, index |
| `borrowerUserId` | ObjectId | `User` | required, index |
| `amount` | Number |  | required |
| `earningDescription` | String |  | default "" |
| `balanceAfter` | Number |  | required |
| `createdAt` | Date |  | default fn default |
| `_id` | ObjectId |  |  |

**Indexes:** `{"loanId":1} {"background":true}`; `{"borrowerUserId":1} {"background":true}`

### bat246SnapBackLoanRequests

- **Collection:** `bat246snapbackloanrequests` · **Area:** BAT246 game · **Source:** `server/bat246/models/bat246SnapBackLoanRequest.model.ts` (doc: `server/bat246/models/bat246SnapBackLoanRequest.model.ts.md`) · **Options:** timestamps=true, autoIndex=null, capped=false
- **Referenced by:** `bat246PlacementNotifications`, `bat246SnapBackLoans`
- **Used by:** `server/bat246/services/bat246SnapBackLoan.service.ts`
- **Hooks:** pre(save) ×5, pre(findOneAndReplace) ×1, pre(findOneAndUpdate) ×1, pre(replaceOne) ×1, pre(update) ×1, pre(updateOne) ×1, pre(updateMany) ×1, pre(remove) ×1, post(save) ×3, post(init) ×1
- **Statics/methods:** `initializeTimestamps()`

| Field | Type | Ref | Flags |
|---|---|---|---|
| `requestedByUserId` | ObjectId | `User` | required, index |
| `borrowerUserId` | ObjectId | `User` | required, index |
| `eligibleUserId` | ObjectId | `User` | required, index |
| `productId` | ObjectId | `Product` | required |
| `productLabel` | String |  | required, enum ["board","pod"] |
| `amount` | Number |  | required |
| `note` | String |  | default "" |
| `termsAcceptedAt` | Date |  | required |
| `status` | String |  | index, default "pending", enum ["pending","approved","denied… |
| `respondedAt` | Date |  | default null |
| `loanId` | ObjectId | `bat246SnapBackLoans` | default null |
| `_id` | ObjectId |  |  |
| `createdAt` | Date |  |  |
| `updatedAt` | Date |  |  |

**Indexes:** `{"requestedByUserId":1} {"background":true}`; `{"borrowerUserId":1} {"background":true}`; `{"eligibleUserId":1} {"background":true}`; `{"status":1} {"background":true}`; `{"eligibleUserId":1,"status":1} {"background":true}`; `{"borrowerUserId":1,"status":1} {"background":true}`

### bat246SnapBackLoans

- **Collection:** `bat246snapbackloans` · **Area:** BAT246 game · **Source:** `server/bat246/models/bat246SnapBackLoan.model.ts` (doc: `server/bat246/models/bat246SnapBackLoan.model.ts.md`) · **Options:** timestamps=true, autoIndex=null, capped=false
- **Referenced by:** `bat246SnapBackLoanRepayments`, `bat246SnapBackLoanRequests`
- **Used by:** `server/bat246/scripts/backupAndWipeBat246.ts`, `server/bat246/services/bat246SnapBackLoan.service.ts`
- **Hooks:** pre(save) ×5, pre(findOneAndReplace) ×1, pre(findOneAndUpdate) ×1, pre(replaceOne) ×1, pre(update) ×1, pre(updateOne) ×1, pre(updateMany) ×1, pre(remove) ×1, post(save) ×3, post(init) ×1
- **Statics/methods:** `initializeTimestamps()`

| Field | Type | Ref | Flags |
|---|---|---|---|
| `borrowerUserId` | ObjectId | `User` | required, index |
| `giverUserId` | ObjectId | `User` | required |
| `requestId` | ObjectId | `bat246SnapBackLoanRequests` | required, unique |
| `productId` | ObjectId | `Product` | required |
| `productLabel` | String |  | required, enum ["board","pod"] |
| `principal` | Number |  | required |
| `outstandingBalance` | Number |  | required |
| `status` | String |  | index, default "active", enum ["active","repaid"] |
| `invoiceId` | ObjectId | `Invoice` | default null |
| `repaidAt` | Date |  | default null |
| `_id` | ObjectId |  |  |
| `createdAt` | Date |  |  |
| `updatedAt` | Date |  |  |

**Indexes:** `{"borrowerUserId":1} {"background":true}`; `{"requestId":1} {"unique":true,"background":true}`; `{"status":1} {"background":true}`; `{"borrowerUserId":1,"status":1} {"background":true}`

### bat246TopTen

- **Collection:** `bat246toptens` · **Area:** BAT246 game · **Source:** `server/bat246/models/bat246TopTen.model.ts` (doc: `server/bat246/models/bat246TopTen.model.ts.md`) · **Options:** timestamps=false, autoIndex=null, capped=false
- **Used by:** `server/bat246/scripts/backupAndWipeBat246.ts`
- **Hooks:** pre(save) ×4, pre(remove) ×1, post(save) ×3, post(init) ×1

| Field | Type | Ref | Flags |
|---|---|---|---|
| `category` | Number |  | required |
| `period` | String |  | required, enum ["A","B","C","D","E","F","G",… |
| `rankings` | [subdoc] |  | default [] |
| `computedAt` | Date |  | required |
| `_id` | ObjectId |  |  |

**Indexes:** `{"category":1,"period":1} {"unique":true,"background":true}`

### BondHolding

- **Collection:** `bond_holdings` · **Area:** Core platform · **Source:** `server/models/bondHolding.model.ts` (doc: `server/models/bondHolding.model.ts.md`) · **Options:** timestamps=true, autoIndex=null, capped=false
- **Referenced by:** `BondLedgerEntry`, `BondPayoutEvent`
- **Used by:** `server/routes/bond.ts`, `server/routes/publicBond.ts`, `server/services/__tests__/bondModels.test.ts`, `server/services/bondInvoiceFulfillment.ts`, `server/services/bondPayoutEngine.ts`
- **Hooks:** pre(save) ×5, pre(findOneAndReplace) ×1, pre(findOneAndUpdate) ×1, pre(replaceOne) ×1, pre(update) ×1, pre(updateOne) ×1, pre(updateMany) ×1, pre(remove) ×1, post(save) ×3, post(init) ×1
- **Statics/methods:** `initializeTimestamps()`

| Field | Type | Ref | Flags |
|---|---|---|---|
| `instrumentId` | ObjectId | `BondInstrument` | required, index |
| `bondHash` | String |  | default fn generateBondHash |
| `buyerUserId` | ObjectId | `User` | required, index |
| `orgId` | ObjectId | `Organization` | required, index |
| `units` | Number |  | required |
| `currency` | String |  | required, enum ["INR","USD","USDT","BTC","ET… |
| `principalAtomic` | String |  | required |
| `payoutAmountPerUnitAtomic` | String |  | required |
| `payoutCount` | Number |  | required |
| `invoiceId` | ObjectId | `Invoice` | default null |
| `status` | String |  | index, default "pending_payment", enum ["pending_payment","active","… |
| `purchasedAt` | Date |  | default null |
| `maturesAt` | Date |  | default null |
| `nextPayoutAt` | Date |  | default null |
| `payoutsCompleted` | Number |  | default 0 |
| `redeemedAt` | Date |  | default null |
| `redemptionTxId` | ObjectId |  | default null |
| `autoRedeemed` | Boolean |  | default false |
| `lastPayoutError` | String |  | default null |
| `_id` | ObjectId |  |  |
| `createdAt` | Date |  |  |
| `updatedAt` | Date |  |  |

**Indexes:** `{"instrumentId":1} {"background":true}`; `{"buyerUserId":1} {"background":true}`; `{"orgId":1} {"background":true}`; `{"status":1} {"background":true}`; `{"invoiceId":1} {"unique":true,"partialFilterExpression":{"invoiceId":{"$type":"objectId"}},"background":true}`; `{"bondHash":1} {"unique":true,"partialFilterExpression":{"bondHash":{"$type":"string"}},"background":true}`; `{"buyerUserId":1,"orgId":1,"createdAt":-1} {"background":true}`; `{"status":1,"maturesAt":1} {"background":true}`

### BondInstrument

- **Collection:** `bond_instruments` · **Area:** Core platform · **Source:** `server/models/bondInstrument.model.ts` (doc: `server/models/bondInstrument.model.ts.md`) · **Options:** timestamps=true, autoIndex=null, capped=false
- **Referenced by:** `BondHolding`, `BondLedgerEntry`, `BondPayoutEvent`
- **Used by:** `server/routes/bond.ts`, `server/services/__tests__/bondModels.test.ts`, `server/services/bondInvoiceFulfillment.ts`, `server/services/bondPayoutEngine.ts`, `server/services/bondView.ts`
- **Hooks:** pre(save) ×5, pre(findOneAndReplace) ×1, pre(findOneAndUpdate) ×1, pre(replaceOne) ×1, pre(update) ×1, pre(updateOne) ×1, pre(updateMany) ×1, pre(remove) ×1, post(save) ×3, post(init) ×1
- **Statics/methods:** `initializeTimestamps()`

| Field | Type | Ref | Flags |
|---|---|---|---|
| `orgId` | ObjectId | `Organization` | required, index |
| `createdBy` | ObjectId | `User` | required |
| `name` | String |  | required |
| `description` | String |  | default "" |
| `status` | String |  | index, default "draft", enum ["draft","published","fully_s… |
| `unitPriceAtomic` | String |  | required, default "0" |
| `currency` | String |  | required, enum ["INR","USD","USDT","BTC","ET… |
| `durationDays` | Number |  | required |
| `payoutFrequency` | String |  | required, enum ["daily","monthly","quarterly… |
| `ratePerPayoutPeriod` | String |  | required |
| `totalUnits` | Number |  | required |
| `minUnits` | Number |  | required, default 1 |
| `unitsSold` | Number |  | default 0 |
| `commissionBasis` | String |  | default "none", enum ["principal","payout","both",… |
| `principalCommissionRate` | String |  | default "0" |
| `payoutCommissionRate` | String |  | default "0" |
| `combPlanId` | ObjectId | `CombPlan` | default null |
| `derived` | Embedded |  | required |
| `acknowledgedOutflowAtomic` | String |  | default null |
| `publishedAt` | Date |  | default null |
| `closedAt` | Date |  | default null |
| `_id` | ObjectId |  |  |
| `createdAt` | Date |  |  |
| `updatedAt` | Date |  |  |

**Indexes:** `{"orgId":1} {"background":true}`; `{"status":1} {"background":true}`; `{"orgId":1,"status":1,"createdAt":-1} {"background":true}`; `{"status":1,"currency":1} {"background":true}`

### BondLedgerEntry

- **Collection:** `bond_ledger_entries` · **Area:** Core platform · **Source:** `server/models/bondLedgerEntry.model.ts` (doc: `server/models/bondLedgerEntry.model.ts.md`) · **Options:** timestamps=true, autoIndex=null, capped=false
- **Referenced by:** `BondLedgerEntry`
- **Used by:** `server/routes/bond.ts`, `server/services/__tests__/bondModels.test.ts`, `server/services/bondCommission.ts`, `server/services/bondInvoiceFulfillment.ts`, `server/services/bondPayoutEngine.ts`
- **Hooks:** pre(save) ×5, pre(findOneAndReplace) ×1, pre(findOneAndUpdate) ×1, pre(replaceOne) ×1, pre(update) ×1, pre(updateOne) ×1, pre(updateMany) ×1, pre(remove) ×1, post(save) ×3, post(init) ×1
- **Statics/methods:** `initializeTimestamps()`

| Field | Type | Ref | Flags |
|---|---|---|---|
| `kind` | String |  | required, index, enum ["purchase_debit","purchase_c… |
| `instrumentId` | ObjectId | `BondInstrument` | required, index |
| `holdingId` | ObjectId | `BondHolding` | index, default null |
| `payoutEventId` | ObjectId | `BondPayoutEvent` | default null |
| `orgId` | ObjectId | `Organization` | required, index |
| `fromUserId` | ObjectId | `User` | default null |
| `toUserId` | ObjectId | `User` | default null |
| `currency` | String |  | required, enum ["INR","USD","USDT","BTC","ET… |
| `amountAtomic` | String |  | required |
| `walletAmount` | Number |  | default null |
| `poolUsd` | Number |  | default null |
| `fxRateToUsd` | Number |  | default null |
| `walletTransactionId` | ObjectId |  | default null |
| `reversesEntryId` | ObjectId | `BondLedgerEntry` | default null |
| `note` | String |  | default null |
| `_id` | ObjectId |  |  |
| `createdAt` | Date |  |  |
| `updatedAt` | Date |  |  |

**Indexes:** `{"kind":1} {"background":true}`; `{"instrumentId":1} {"background":true}`; `{"holdingId":1} {"background":true}`; `{"orgId":1} {"background":true}`; `{"orgId":1,"createdAt":-1} {"background":true}`; `{"holdingId":1,"createdAt":1} {"background":true}`

### BondPayoutEvent

- **Collection:** `bond_payout_events` · **Area:** Core platform · **Source:** `server/models/bondPayoutEvent.model.ts` (doc: `server/models/bondPayoutEvent.model.ts.md`) · **Options:** timestamps=true, autoIndex=null, capped=false
- **Referenced by:** `BondLedgerEntry`
- **Used by:** `server/routes/bond.ts`, `server/services/__tests__/bondModels.test.ts`, `server/services/bondInvoiceFulfillment.ts`, `server/services/bondPayoutEngine.ts`, `server/services/bondView.ts`
- **Hooks:** pre(save) ×5, pre(findOneAndReplace) ×1, pre(findOneAndUpdate) ×1, pre(replaceOne) ×1, pre(update) ×1, pre(updateOne) ×1, pre(updateMany) ×1, pre(remove) ×1, post(save) ×3, post(init) ×1
- **Statics/methods:** `initializeTimestamps()`

| Field | Type | Ref | Flags |
|---|---|---|---|
| `holdingId` | ObjectId | `BondHolding` | required, index |
| `instrumentId` | ObjectId | `BondInstrument` | required, index |
| `orgId` | ObjectId | `Organization` | required |
| `buyerUserId` | ObjectId | `User` | required |
| `sequenceNo` | Number |  | required |
| `dueAt` | Date |  | required |
| `currency` | String |  | required, enum ["INR","USD","USDT","BTC","ET… |
| `interestAtomic` | String |  | required |
| `commissionAtomic` | String |  | default "0" |
| `status` | String |  | default "scheduled", enum ["scheduled","paid","failed",… |
| `attempts` | Number |  | default 0 |
| `lastError` | String |  | default null |
| `paidAt` | Date |  | default null |
| `walletTransactionId` | ObjectId |  | default null |
| `usdAtPayment` | Number |  | default null |
| `usdRateAtPayment` | Number |  | default null |
| `commissionDistributionId` | ObjectId |  | default null |
| `dedupeKey` | String |  | required |
| `_id` | ObjectId |  |  |
| `createdAt` | Date |  |  |
| `updatedAt` | Date |  |  |

**Indexes:** `{"holdingId":1} {"background":true}`; `{"instrumentId":1} {"background":true}`; `{"dedupeKey":1} {"unique":true,"background":true}`; `{"status":1,"dueAt":1} {"background":true}`

### Booking

- **Collection:** `bookings` · **Area:** Core platform · **Source:** `server/models/booking.model.ts` (doc: `server/models/booking.model.ts.md`) · **Options:** timestamps=true, autoIndex=null, capped=false
- **Used by:** `server/routes/calendar.ts`, `server/services/memberCleanup.service.ts`
- **Hooks:** pre(save) ×5, pre(findOneAndReplace) ×1, pre(findOneAndUpdate) ×1, pre(replaceOne) ×1, pre(update) ×1, pre(updateOne) ×1, pre(updateMany) ×1, pre(remove) ×1, post(save) ×3, post(init) ×1
- **Statics/methods:** `initializeTimestamps()`

| Field | Type | Ref | Flags |
|---|---|---|---|
| `orgId` | ObjectId | `Organization` | required, index |
| `bookerId` | ObjectId | `User` | required, index |
| `bookedWithId` | ObjectId | `User` | required, index |
| `startTime` | Date |  | required |
| `endTime` | Date |  | required |
| `title` | String |  | required |
| `status` | String |  | default "confirmed", enum ["confirmed","cancelled"] |
| `_id` | ObjectId |  |  |
| `createdAt` | Date |  |  |
| `updatedAt` | Date |  |  |

**Indexes:** `{"orgId":1} {"background":true}`; `{"bookerId":1} {"background":true}`; `{"bookedWithId":1} {"background":true}`; `{"orgId":1,"bookerId":1,"startTime":1} {"background":true}`; `{"orgId":1,"bookedWithId":1,"startTime":1} {"background":true}`

### CallBooking

- **Collection:** `callbookings` · **Area:** Core platform · **Source:** `server/models/callBooking.model.ts` (doc: `server/models/callBooking.model.ts.md`) · **Options:** timestamps=true, autoIndex=null, capped=false
- **Used by:** `server/realtime/socket.ts`, `server/routes/calendar.ts`, `server/routes/callBooking.ts`, `server/routes/public.ts`, `server/routes/unifiedOrders.ts`, `server/services/call.ts`
- **Hooks:** pre(save) ×6, pre(findOneAndReplace) ×1, pre(findOneAndUpdate) ×1, pre(replaceOne) ×1, pre(update) ×1, pre(updateOne) ×1, pre(updateMany) ×1, pre(remove) ×1, post(save) ×3, post(init) ×1
- **Statics/methods:** `initializeTimestamps()`

| Field | Type | Ref | Flags |
|---|---|---|---|
| `callOfferingId` | ObjectId | `CallOffering` | required, index |
| `callPurchaseId` | ObjectId | `CallPurchase` | required, index |
| `organizationId` | ObjectId | `Organization` | required, index |
| `founderId` | ObjectId | `User` | required, index |
| `bookerId` | ObjectId | `User` | required, index |
| `startTime` | Date |  | required, index |
| `endTime` | Date |  | required |
| `status` | String |  | index, default "scheduled", enum ["scheduled","completed","can… |
| `founderNotes` | String |  |  |
| `bookingNotes` | String |  |  |
| `cancelledAt` | Date |  |  |
| `cancelledBy` | ObjectId | `User` |  |
| `cancellationReason` | String |  |  |
| `completedAt` | Date |  |  |
| `completedBy` | ObjectId | `User` |  |
| `rating` | Number |  |  |
| `review` | String |  |  |
| `ratedAt` | Date |  |  |
| `_id` | ObjectId |  |  |
| `createdAt` | Date |  |  |
| `updatedAt` | Date |  |  |

**Indexes:** `{"callOfferingId":1} {"background":true}`; `{"callPurchaseId":1} {"background":true}`; `{"organizationId":1} {"background":true}`; `{"founderId":1} {"background":true}`; `{"bookerId":1} {"background":true}`; `{"startTime":1} {"background":true}`; `{"status":1} {"background":true}`; `{"founderId":1,"startTime":1,"status":1} {"background":true}`; `{"bookerId":1,"startTime":1} {"background":true}`; `{"callPurchaseId":1} {"background":true}`; `{"organizationId":1,"startTime":1} {"background":true}`; `{"founderId":1,"startTime":1,"endTime":1,"status":1} {"background":true}`

### CallOffering

- **Collection:** `callofferings` · **Area:** Core platform · **Source:** `server/models/callOffering.model.ts` (doc: `server/models/callOffering.model.ts.md`) · **Options:** timestamps=true, autoIndex=null, capped=false
- **Referenced by:** `CallBooking`, `CallPurchase`
- **Used by:** `server/controllers/garageAdmin.controller.ts`, `server/routes/affiliate.ts`, `server/routes/call.ts`, `server/routes/callBooking.ts`, `server/routes/callCheckout.ts`, `server/routes/founderCouponItems.ts`, `server/routes/founderCouponRules.ts`, `server/routes/internal-catalog.ts`, … +11 more
- **Hooks:** pre(save) ×6, pre(findOneAndReplace) ×1, pre(findOneAndUpdate) ×1, pre(replaceOne) ×1, pre(update) ×1, pre(updateOne) ×1, pre(updateMany) ×1, pre(remove) ×1, post(save) ×4, post(findOneAndUpdate) ×1, post(findOneAndDelete) ×1, post(deleteOne) ×1, post(init) ×1
- **Statics/methods:** `initializeTimestamps()`

| Field | Type | Ref | Flags |
|---|---|---|---|
| `title` | String |  | required |
| `description` | String |  |  |
| `coverImage` | String |  |  |
| `pricePerCall` | Number |  | default 0 |
| `currency` | String |  | default "USD", enum ["INR","USD"] |
| `isFree` | Boolean |  | default true |
| `duration` | Number |  | required, default 30 |
| `organizationId` | ObjectId | `Organization` | required, index |
| `createdBy` | ObjectId | `User` | required, index |
| `channelIds` | [ObjectId] | `Channel` |  |
| `intakeQuestions` | [subdoc] |  |  |
| `status` | String |  | default "draft", enum ["draft","published","archive… |
| `totalPurchased` | Number |  | default 0 |
| `totalUsed` | Number |  | default 0 |
| `totalScheduled` | Number |  | default 0 |
| `purchaseCount` | Number |  | default 0 |
| `averageRating` | Number |  |  |
| `reviewCount` | Number |  | default 0 |
| `whatsIncluded` | [String] |  |  |
| `topicsWeCover` | [subdoc] |  |  |
| `howItWorks` | [subdoc] |  |  |
| `faqs` | [subdoc] |  |  |
| `_id` | ObjectId |  |  |
| `createdAt` | Date |  |  |
| `updatedAt` | Date |  |  |

**Indexes:** `{"organizationId":1} {"background":true}`; `{"createdBy":1} {"background":true}`; `{"organizationId":1,"status":1} {"background":true}`; `{"createdBy":1,"status":1} {"background":true}`; `{"channelIds":1} {"background":true}`

### CallPurchase

- **Collection:** `callpurchases` · **Area:** Core platform · **Source:** `server/models/callPurchase.model.ts` (doc: `server/models/callPurchase.model.ts.md`) · **Options:** timestamps=true, autoIndex=null, capped=false
- **Referenced by:** `CallBooking`
- **Used by:** `server/routes/call.ts`, `server/routes/callBooking.ts`, `server/routes/public.ts`, `server/routes/unifiedOrders.ts`, `server/services/call.ts`, `server/services/review.ts`, `server/services/wallet.ts`
- **Hooks:** pre(save) ×6, pre(findOneAndReplace) ×1, pre(findOneAndUpdate) ×1, pre(replaceOne) ×1, pre(update) ×1, pre(updateOne) ×1, pre(updateMany) ×1, pre(remove) ×1, post(save) ×3, post(init) ×1
- **Statics/methods:** `initializeTimestamps()`

| Field | Type | Ref | Flags |
|---|---|---|---|
| `callOfferingId` | ObjectId | `CallOffering` | required, index |
| `userId` | ObjectId | `User` | required, index |
| `organizationId` | ObjectId | `Organization` | required, index |
| `quantityPurchased` | Number |  | required |
| `quantityUsed` | Number |  | default 0 |
| `quantityScheduled` | Number |  | default 0 |
| `quantityRemaining` | Number |  | default 0 |
| `intakeAnswers` | [subdoc] |  |  |
| `isPaid` | Boolean |  | default false |
| `totalAmount` | Number |  | required |
| `currency` | String |  | default "INR" |
| `paymentId` | String |  |  |
| `paymentStatus` | String |  | default "pending", enum ["pending","completed","faile… |
| `invoiceShortUrl` | String |  |  |
| `purchasedAt` | Date |  | default fn now |
| `_id` | ObjectId |  |  |
| `createdAt` | Date |  |  |
| `updatedAt` | Date |  |  |

**Indexes:** `{"callOfferingId":1} {"background":true}`; `{"userId":1} {"background":true}`; `{"organizationId":1} {"background":true}`; `{"callOfferingId":1,"userId":1} {"background":true}`; `{"userId":1,"organizationId":1,"purchasedAt":-1} {"background":true}`; `{"callOfferingId":1,"paymentStatus":1} {"background":true}`; `{"organizationId":1,"createdAt":-1} {"background":true}`

### CampaignWallet

- **Collection:** `campaignwallets` · **Area:** Core platform · **Source:** `server/models/campaignWallet.model.ts` (doc: `server/models/campaignWallet.model.ts.md`) · **Options:** timestamps=true, autoIndex=null, capped=false
- **Referenced by:** `CampaignWalletTransaction`, `ContentCampaign`
- **Used by:** `server/services/campaignWallet.ts`, `server/services/contentPayoutSweeper.ts`
- **Hooks:** pre(save) ×5, pre(findOneAndReplace) ×1, pre(findOneAndUpdate) ×1, pre(replaceOne) ×1, pre(update) ×1, pre(updateOne) ×1, pre(updateMany) ×1, pre(remove) ×1, post(save) ×3, post(init) ×1
- **Statics/methods:** `initializeTimestamps()`

| Field | Type | Ref | Flags |
|---|---|---|---|
| `campaignId` | ObjectId | `ContentCampaign` | required, unique, index |
| `orgId` | ObjectId | `Organization` | required, index |
| `founderId` | ObjectId | `User` | required, index |
| `balance` | Number |  | required, default 0 |
| `currency` | String |  | default "USD" |
| `totalLocked` | Number |  | default 0 |
| `totalPaidOut` | Number |  | default 0 |
| `totalRefunded` | Number |  | default 0 |
| `status` | String |  | index, default "active", enum ["active","closed"] |
| `lastTransactionAt` | Date |  | default null |
| `_id` | ObjectId |  |  |
| `createdAt` | Date |  |  |
| `updatedAt` | Date |  |  |

**Indexes:** `{"campaignId":1} {"unique":true,"background":true}`; `{"orgId":1} {"background":true}`; `{"founderId":1} {"background":true}`; `{"status":1} {"background":true}`

### CampaignWalletTransaction

- **Collection:** `campaignwallettransactions` · **Area:** Core platform · **Source:** `server/models/campaignWalletTransaction.model.ts` (doc: `server/models/campaignWalletTransaction.model.ts.md`) · **Options:** timestamps=true, autoIndex=null, capped=false
- **Used by:** `server/controllers/garageAdmin.controller.ts`, `server/scripts/migrate-content-rewards-to-org-rewards.ts`, `server/services/campaignWallet.ts`
- **Hooks:** pre(save) ×5, pre(findOneAndReplace) ×1, pre(findOneAndUpdate) ×1, pre(replaceOne) ×1, pre(update) ×1, pre(updateOne) ×1, pre(updateMany) ×1, pre(remove) ×1, post(save) ×3, post(init) ×1
- **Statics/methods:** `initializeTimestamps()`

| Field | Type | Ref | Flags |
|---|---|---|---|
| `campaignWalletId` | ObjectId | `CampaignWallet` | required, index |
| `campaignId` | ObjectId | `ContentCampaign` | required, index |
| `orgId` | ObjectId | `Organization` | required, index |
| `type` | String |  | required, index, enum ["credit","debit","refund"] |
| `direction` | String |  | required, enum ["in","out"] |
| `amount` | Number |  | required |
| `currency` | String |  | default "USD" |
| `balanceBefore` | Number |  | required |
| `balanceAfter` | Number |  | required |
| `description` | String |  | required |
| `relatedUserId` | ObjectId | `User` | default null |
| `relatedSubmissionId` | ObjectId | `ContentSubmission` | default null |
| `relatedPayoutId` | ObjectId | `ContentPayout` | default null |
| `relatedTransactionId` | ObjectId |  | default null |
| `metadata` | Mixed |  |  |
| `status` | String |  | index, default "completed", enum ["completed","pending","faile… |
| `_id` | ObjectId |  |  |
| `createdAt` | Date |  |  |
| `updatedAt` | Date |  |  |

**Indexes:** `{"campaignWalletId":1} {"background":true}`; `{"campaignId":1} {"background":true}`; `{"orgId":1} {"background":true}`; `{"type":1} {"background":true}`; `{"status":1} {"background":true}`; `{"campaignWalletId":1,"createdAt":-1} {"background":true}`; `{"campaignId":1,"createdAt":-1} {"background":true}`; `{"orgId":1,"type":1,"createdAt":-1} {"background":true}`

### CashbackCode

- **Collection:** `cashbackcodes` · **Area:** Core platform · **Source:** `server/models/cashbackCode.model.ts` (doc: `server/models/cashbackCode.model.ts.md`) · **Options:** timestamps=true, autoIndex=null, capped=false
- **Referenced by:** `CashbackDistribution`, `Invoice`
- **Used by:** `server/models/cashbackDistribution.model.ts`, `server/routes/cashbackCodes.ts`, `server/services/cashbackCode.ts`, `server/services/invoice.ts`
- **Hooks:** pre(save) ×5, pre(findOneAndReplace) ×1, pre(findOneAndUpdate) ×1, pre(replaceOne) ×1, pre(update) ×1, pre(updateOne) ×1, pre(updateMany) ×1, pre(remove) ×1, post(save) ×3, post(init) ×1
- **Statics/methods:** `initializeTimestamps()`

| Field | Type | Ref | Flags |
|---|---|---|---|
| `code` | String |  | required, unique |
| `name` | String |  | required |
| `description` | String |  |  |
| `creatorId` | ObjectId | `User` | required, index |
| `status` | String |  | index, default "active", enum ["active","inactive","expired… |
| `productType` | String |  | required, index, enum ["product","channel","course"… |
| `itemId` | ObjectId |  | required, index |
| `orgId` | ObjectId | `Organization` | required, index |
| `ratePct` | Number |  | required |
| `allowedBuyerIds` | [ObjectId] | `User` | default [] |
| `cycleCount` | Number |  | default 1 |
| `validFrom` | Date |  | default fn now |
| `validUntil` | Date |  |  |
| `maxUsageCount` | Number |  |  |
| `maxUsagePerUser` | Number |  |  |
| `currentUsageCount` | Number |  | default 0 |
| `minOrderAmountCents` | Number |  |  |
| `_id` | ObjectId |  |  |
| `createdAt` | Date |  |  |
| `updatedAt` | Date |  |  |

**Indexes:** `{"code":1} {"unique":true,"background":true}`; `{"creatorId":1} {"background":true}`; `{"status":1} {"background":true}`; `{"productType":1} {"background":true}`; `{"itemId":1} {"background":true}`; `{"orgId":1} {"background":true}`; `{"creatorId":1,"status":1,"createdAt":-1} {"background":true}`; `{"productType":1,"itemId":1,"status":1} {"background":true}`

### CashbackDistribution

- **Collection:** `cashbackdistributions` · **Area:** Core platform · **Source:** `server/models/cashbackDistribution.model.ts` (doc: `server/models/cashbackDistribution.model.ts.md`) · **Options:** timestamps=true, autoIndex=null, capped=false
- **Used by:** `server/routes/ecommerceWallet.ts`, `server/services/cashbackCode.ts`
- **Hooks:** pre(save) ×5, pre(findOneAndReplace) ×1, pre(findOneAndUpdate) ×1, pre(replaceOne) ×1, pre(update) ×1, pre(updateOne) ×1, pre(updateMany) ×1, pre(remove) ×1, post(save) ×3, post(init) ×1
- **Statics/methods:** `initializeTimestamps()`

| Field | Type | Ref | Flags |
|---|---|---|---|
| `codeId` | ObjectId | `CashbackCode` | required, index |
| `invoiceId` | ObjectId | `Invoice` | required, index |
| `invoiceLineItemIndex` | Number |  | required |
| `subscriptionRootId` | ObjectId | `Invoice` | required, index |
| `creatorId` | ObjectId | `User` | required, index |
| `buyerId` | ObjectId | `User` | required, index |
| `sellerOrgId` | ObjectId | `Organization` | required, index |
| `productType` | String |  | required, enum ["product","channel","course"… |
| `itemId` | ObjectId |  |  |
| `saleAmountCents` | Number |  | required |
| `saleCurrency` | String |  | default "USD" |
| `level1RatePct` | Number |  | required |
| `configuredRatePct` | Number |  | required |
| `appliedRatePct` | Number |  | required |
| `cashbackAmount` | Number |  | required |
| `cycleNumber` | Number |  | required, default 1 |
| `affiliateTxId` | ObjectId | `WalletTransaction` |  |
| `storeTxId` | ObjectId | `WalletTransaction` |  |
| `status` | String |  | required, enum ["completed","skipped","faile… |
| `failureReason` | String |  |  |
| `_id` | ObjectId |  |  |
| `createdAt` | Date |  |  |
| `updatedAt` | Date |  |  |

**Indexes:** `{"codeId":1} {"background":true}`; `{"invoiceId":1} {"background":true}`; `{"subscriptionRootId":1} {"background":true}`; `{"creatorId":1} {"background":true}`; `{"buyerId":1} {"background":true}`; `{"sellerOrgId":1} {"background":true}`; `{"codeId":1,"buyerId":1,"subscriptionRootId":1} {"background":true}`; `{"creatorId":1,"createdAt":-1} {"background":true}`; `{"buyerId":1,"createdAt":-1} {"background":true}`

### CatalogOutbox

- **Collection:** `catalogoutboxes` · **Area:** Core platform · **Source:** `server/models/catalogOutbox.model.ts` (doc: `server/models/catalogOutbox.model.ts.md`) · **Options:** timestamps=true, autoIndex=null, capped=false
- **Used by:** `server/models/_catalogHooks.ts`, `server/routes/internal-catalog.ts`, `server/scripts/backfill-catalog-outbox.ts`, `server/services/catalogOutbox.dispatcher.ts`, `server/services/catalogOutbox.service.ts`
- **Hooks:** pre(save) ×5, pre(findOneAndReplace) ×1, pre(findOneAndUpdate) ×1, pre(replaceOne) ×1, pre(update) ×1, pre(updateOne) ×1, pre(updateMany) ×1, pre(remove) ×1, post(save) ×3, post(init) ×1
- **Statics/methods:** `initializeTimestamps()`

| Field | Type | Ref | Flags |
|---|---|---|---|
| `itemType` | String |  | required, enum ["product","storeproduct","co… |
| `itemId` | String |  | required |
| `op` | String |  | required, default "upsert", enum ["upsert","delete"] |
| `attemptCount` | Number |  | default 0 |
| `nextAttemptAt` | Date |  | default fn default |
| `status` | String |  | required, default "pending", enum ["pending","in_flight","sent"… |
| `lastError` | String |  |  |
| `sentAt` | Date |  |  |
| `_id` | ObjectId |  |  |
| `createdAt` | Date |  |  |
| `updatedAt` | Date |  |  |

**Indexes:** `{"itemType":1,"itemId":1} {"unique":true,"name":"catalog_outbox_item_unique","background":true}`; `{"status":1,"nextAttemptAt":1} {"background":true}`; `{"sentAt":1} {"expireAfterSeconds":86400,"partialFilterExpression":{"status":"sent"},"name":"catalog_outbox_sent_ttl","background":true}`

### CatalogTombstone

- **Collection:** `catalogtombstones` · **Area:** Core platform · **Source:** `server/models/catalogTombstone.model.ts` (doc: `server/models/catalogTombstone.model.ts.md`) · **Options:** timestamps=true, autoIndex=null, capped=false
- **Used by:** `server/services/catalogOutbox.service.ts`
- **Hooks:** pre(save) ×5, pre(findOneAndReplace) ×1, pre(findOneAndUpdate) ×1, pre(replaceOne) ×1, pre(update) ×1, pre(updateOne) ×1, pre(updateMany) ×1, pre(remove) ×1, post(save) ×3, post(init) ×1
- **Statics/methods:** `initializeTimestamps()`

| Field | Type | Ref | Flags |
|---|---|---|---|
| `itemType` | String |  | required, enum ["product","storeproduct","co… |
| `itemId` | String |  | required |
| `deletedAt` | Date |  | default fn default |
| `reason` | String |  |  |
| `_id` | ObjectId |  |  |
| `createdAt` | Date |  |  |
| `updatedAt` | Date |  |  |

**Indexes:** `{"itemType":1,"itemId":1,"deletedAt":-1} {"name":"catalog_tombstone_item_recent","background":true}`; `{"deletedAt":1} {"expireAfterSeconds":2592000,"name":"catalog_tombstone_ttl_30d","background":true}`

### Channel

- **Collection:** `channels` · **Area:** Core platform · **Source:** `server/models/channel.model.ts` (doc: `server/models/channel.model.ts.md`) · **Options:** timestamps=true, autoIndex=null, capped=false
- **Referenced by:** `AffiliateLink`, `CallOffering`, `ChannelMembership`, `ChannelMembershipEvent`, `Course`, `Post`, `Product`, `Service`, `UserNotification`, `Workshop`
- **Used by:** `server/controllers/garageAdmin.controller.ts`, `server/routes/affiliate.ts`, `server/routes/callCheckout.ts`, `server/routes/channelCheckout.ts`, `server/routes/courseCheckout.ts`, `server/routes/feed.ts`, `server/routes/founderCouponItems.ts`, `server/routes/founderCouponRules.ts`, … +34 more
- **Hooks:** pre(save) ×5, pre(findOneAndReplace) ×1, pre(findOneAndUpdate) ×1, pre(replaceOne) ×1, pre(update) ×1, pre(updateOne) ×1, pre(updateMany) ×1, pre(remove) ×1, post(save) ×4, post(findOneAndUpdate) ×1, post(findOneAndDelete) ×1, post(deleteOne) ×1, post(init) ×1
- **Statics/methods:** `initializeTimestamps()`

| Field | Type | Ref | Flags |
|---|---|---|---|
| `title` | String |  | required |
| `description` | String |  |  |
| `price` | Number |  | required, default 0 |
| `currency` | String |  | default "USD" |
| `coverImage` | String |  |  |
| `galleryImages` | [String] |  |  |
| `videoUrl` | String |  |  |
| `videoFile` | String |  |  |
| `shareLink` | String |  |  |
| `whoCanPost` | String |  | default "everyone", enum ["everyone","admins_only"] |
| `gstInclusive` | Boolean |  | default true |
| `requireIosPayment` | Boolean |  | default false |
| `appleFeeInclusive` | Boolean |  | default false |
| `isActive` | Boolean |  | default true |
| `isFree` | Boolean |  | default true |
| `isSubscription` | Boolean |  | default false |
| `subscriptionPeriod` | String |  | enum ["weekly","monthly","quarterl… |
| `subscriptionInterval` | Number |  |  |
| `allowPayWhatYouWant` | Boolean |  | default false |
| `isDefault` | Boolean |  | default false |
| `mandatoryOnJoin` | Boolean |  | index, default false |
| `combPlanId` | ObjectId |  |  |
| `storeId` | ObjectId | `Organization` | required |
| `createdBy` | ObjectId | `User` | required |
| `emailAlerts.enabled` | Boolean |  | default false |
| `emailAlerts.templateId` | String |  |  |
| `emailAlerts.templateName` | String |  |  |
| `emailAlerts.templateHtml` | String |  |  |
| `emailAlerts.syncedAt` | Date |  |  |
| `founderAlerts.enabled` | Boolean |  | default false |
| `founderAlerts.recipients` | [String] |  |  |
| `thankYouPage` | Embedded |  |  |
| `rating` | Number |  |  |
| `ratingCount` | Number |  | default 0 |
| `aboutText` | String |  |  |
| `whatsIncluded` | [String] |  |  |
| `benefits` | [subdoc] |  |  |
| `reviews` | [subdoc] |  |  |
| `faqs` | [subdoc] |  |  |
| `_id` | ObjectId |  |  |
| `createdAt` | Date |  |  |
| `updatedAt` | Date |  |  |

**Indexes:** `{"mandatoryOnJoin":1} {"background":true}`; `{"storeId":1,"title":1} {"background":true}`; `{"storeId":1,"isActive":1} {"background":true}`; `{"storeId":1,"isDefault":1} {"unique":true,"partialFilterExpression":{"isDefault":true},"background":true}`

### ChannelMembership

- **Collection:** `channelmemberships` · **Area:** Core platform · **Source:** `server/models/channelMembership.model.ts` (doc: `server/models/channelMembership.model.ts.md`) · **Options:** timestamps=true, autoIndex=null, capped=false
- **Used by:** `server/index.ts`, `server/routes/callCheckout.ts`, `server/routes/channelCheckout.ts`, `server/routes/course.ts`, `server/routes/courseCheckout.ts`, `server/routes/feed.ts`, `server/routes/learnInit.ts`, `server/routes/product.ts`, … +17 more
- **Hooks:** pre(save) ×5, pre(findOneAndReplace) ×1, pre(findOneAndUpdate) ×1, pre(replaceOne) ×1, pre(update) ×1, pre(updateOne) ×1, pre(updateMany) ×1, pre(remove) ×1, post(save) ×3, post(init) ×1
- **Statics/methods:** `initializeTimestamps()`

| Field | Type | Ref | Flags |
|---|---|---|---|
| `userId` | ObjectId | `User` | required |
| `channelId` | ObjectId | `Channel` | required |
| `orgId` | ObjectId | `Organization` | required |
| `joinedAt` | Date |  | default fn now |
| `role` | String |  | default "member", enum ["member","admin"] |
| `status` | String |  | default "active", enum ["active","inactive","suspend… |
| `subscriptionId` | String |  |  |
| `subscriptionStatus` | String |  | enum ["active","cancelled","expire… |
| `lastPaymentDate` | Date |  |  |
| `nextPaymentDate` | Date |  |  |
| `cancelledAt` | Date |  |  |
| `lastActivityAt` | Date |  |  |
| `canPost` | Boolean |  | default true |
| `_id` | ObjectId |  |  |
| `createdAt` | Date |  |  |
| `updatedAt` | Date |  |  |

**Indexes:** `{"userId":1,"orgId":1} {"background":true}`; `{"channelId":1,"status":1} {"background":true}`; `{"userId":1,"channelId":1} {"unique":true,"background":true}`; `{"subscriptionStatus":1,"nextPaymentDate":1} {"background":true}`

### ChannelMembershipEvent

- **Collection:** `channelmembershipevents` · **Area:** Core platform · **Source:** `server/models/channelMembershipEvent.model.ts` (doc: `server/models/channelMembershipEvent.model.ts.md`) · **Options:** timestamps=true, autoIndex=null, capped=false
- **Used by:** `server/routes/feed.ts`, `server/services/channelMembershipEvent.ts`, `server/services/downlineMemberPurchases.ts`
- **Hooks:** pre(save) ×5, pre(findOneAndReplace) ×1, pre(findOneAndUpdate) ×1, pre(replaceOne) ×1, pre(update) ×1, pre(updateOne) ×1, pre(updateMany) ×1, pre(remove) ×1, post(save) ×3, post(init) ×1
- **Statics/methods:** `initializeTimestamps()`

| Field | Type | Ref | Flags |
|---|---|---|---|
| `userId` | ObjectId | `User` | required |
| `channelId` | ObjectId | `Channel` | default null |
| `orgId` | ObjectId | `Organization` | required |
| `eventType` | String |  | required, enum ["unsubscribed","expired","pa… |
| `itemKind` | String |  | default "channel", enum ["channel","workshop"] |
| `workshopId` | ObjectId | `Workshop` | default null |
| `sessionDate` | Date |  | default null |
| `occurredAt` | Date |  | required, default fn now |
| `channelKind` | String |  | required, enum ["free","one_time","recurring… |
| `subscriptionPeriod` | String |  | default null, enum ["weekly","monthly","quarterl… |
| `accessUntil` | Date |  | default null |
| `activeDaysUsed` | Number |  | default null |
| `activeDaysLeftAtCancel` | Number |  | default null |
| `lifetimeValueUsdSnapshot` | Number |  | default 0 |
| `parentInvoiceId` | ObjectId | `Invoice` | default null |
| `membershipId` | ObjectId |  | required |
| `customerEmailSnapshot` | String |  | default null |
| `customerNameSnapshot` | String |  | default null |
| `_id` | ObjectId |  |  |
| `createdAt` | Date |  |  |
| `updatedAt` | Date |  |  |

**Indexes:** `{"orgId":1,"occurredAt":-1} {"background":true}`; `{"channelId":1,"occurredAt":-1} {"background":true}`; `{"membershipId":1,"eventType":1} {"background":true}`; `{"orgId":1,"itemKind":1,"occurredAt":-1} {"background":true}`; `{"workshopId":1,"occurredAt":-1} {"background":true}`

### ChatBlock

- **Collection:** `chatblocks` · **Area:** Core platform · **Source:** `server/models/chatBlock.model.ts` (doc: `server/models/chatBlock.model.ts.md`) · **Options:** timestamps=true, autoIndex=null, capped=false
- **Used by:** `server/realtime/idempotentSend.ts`, `server/realtime/socket.ts`, `server/routes/chat.ts`, `server/services/pushNotification.ts`
- **Hooks:** pre(save) ×5, pre(findOneAndReplace) ×1, pre(findOneAndUpdate) ×1, pre(replaceOne) ×1, pre(update) ×1, pre(updateOne) ×1, pre(updateMany) ×1, pre(remove) ×1, post(save) ×3, post(init) ×1
- **Statics/methods:** `initializeTimestamps()`

| Field | Type | Ref | Flags |
|---|---|---|---|
| `userId` | ObjectId | `User` | required, index |
| `blockedUserId` | ObjectId | `User` | required, index |
| `_id` | ObjectId |  |  |
| `createdAt` | Date |  |  |
| `updatedAt` | Date |  |  |

**Indexes:** `{"userId":1} {"background":true}`; `{"blockedUserId":1} {"background":true}`; `{"userId":1,"blockedUserId":1} {"unique":true,"background":true}`

### ChatClear

- **Collection:** `chatclears` · **Area:** Core platform · **Source:** `server/models/chatClear.model.ts` (doc: `server/models/chatClear.model.ts.md`) · **Options:** timestamps=true, autoIndex=null, capped=false
- **Used by:** `server/routes/chat.ts`, `server/routes/dm.ts`, `server/routes/groups.ts`
- **Hooks:** pre(save) ×5, pre(findOneAndReplace) ×1, pre(findOneAndUpdate) ×1, pre(replaceOne) ×1, pre(update) ×1, pre(updateOne) ×1, pre(updateMany) ×1, pre(remove) ×1, post(save) ×3, post(init) ×1
- **Statics/methods:** `initializeTimestamps()`

| Field | Type | Ref | Flags |
|---|---|---|---|
| `userId` | ObjectId | `User` | required, index |
| `convKey` | String |  | required |
| `clearedAt` | Date |  | required |
| `_id` | ObjectId |  |  |
| `createdAt` | Date |  |  |
| `updatedAt` | Date |  |  |

**Indexes:** `{"userId":1} {"background":true}`; `{"userId":1,"convKey":1} {"unique":true,"background":true}`

### ChatDraft

- **Collection:** `chatdrafts` · **Area:** Core platform · **Source:** `server/models/chatDraft.model.ts` (doc: `server/models/chatDraft.model.ts.md`) · **Options:** timestamps=true, autoIndex=null, capped=false
- **Used by:** `server/routes/chat.ts`
- **Hooks:** pre(save) ×5, pre(findOneAndReplace) ×1, pre(findOneAndUpdate) ×1, pre(replaceOne) ×1, pre(update) ×1, pre(updateOne) ×1, pre(updateMany) ×1, pre(remove) ×1, post(save) ×3, post(init) ×1
- **Statics/methods:** `initializeTimestamps()`

| Field | Type | Ref | Flags |
|---|---|---|---|
| `userId` | ObjectId | `User` | required, index |
| `convKey` | String |  | required |
| `text` | String |  | default "" |
| `_id` | ObjectId |  |  |
| `createdAt` | Date |  |  |
| `updatedAt` | Date |  |  |

**Indexes:** `{"userId":1} {"background":true}`; `{"userId":1,"convKey":1} {"unique":true,"background":true}`

### ChatMute

- **Collection:** `chatmutes` · **Area:** Core platform · **Source:** `server/models/chatMute.model.ts` (doc: `server/models/chatMute.model.ts.md`) · **Options:** timestamps=true, autoIndex=null, capped=false
- **Used by:** `server/routes/chat.ts`, `server/services/pushNotification.ts`
- **Hooks:** pre(save) ×5, pre(findOneAndReplace) ×1, pre(findOneAndUpdate) ×1, pre(replaceOne) ×1, pre(update) ×1, pre(updateOne) ×1, pre(updateMany) ×1, pre(remove) ×1, post(save) ×3, post(init) ×1
- **Statics/methods:** `initializeTimestamps()`

| Field | Type | Ref | Flags |
|---|---|---|---|
| `userId` | ObjectId | `User` | required, index |
| `convKey` | String |  | required |
| `until` | Date |  | default null |
| `_id` | ObjectId |  |  |
| `createdAt` | Date |  |  |
| `updatedAt` | Date |  |  |

**Indexes:** `{"userId":1} {"background":true}`; `{"userId":1,"convKey":1} {"unique":true,"background":true}`

### ChatPin

- **Collection:** `chatpins` · **Area:** Core platform · **Source:** `server/models/chatPin.model.ts` (doc: `server/models/chatPin.model.ts.md`) · **Options:** timestamps=true, autoIndex=null, capped=false
- **Used by:** `server/routes/chat.ts`
- **Hooks:** pre(save) ×5, pre(findOneAndReplace) ×1, pre(findOneAndUpdate) ×1, pre(replaceOne) ×1, pre(update) ×1, pre(updateOne) ×1, pre(updateMany) ×1, pre(remove) ×1, post(save) ×3, post(init) ×1
- **Statics/methods:** `initializeTimestamps()`

| Field | Type | Ref | Flags |
|---|---|---|---|
| `userId` | ObjectId | `User` | required, unique |
| `pins` | [String] |  | default [] |
| `_id` | ObjectId |  |  |
| `createdAt` | Date |  |  |
| `updatedAt` | Date |  |  |

**Indexes:** `{"userId":1} {"unique":true,"background":true}`

### ChatStar

- **Collection:** `chatstars` · **Area:** Core platform · **Source:** `server/models/chatStar.model.ts` (doc: `server/models/chatStar.model.ts.md`) · **Options:** timestamps=true, autoIndex=null, capped=false
- **Used by:** `server/routes/chat.ts`
- **Hooks:** pre(save) ×5, pre(findOneAndReplace) ×1, pre(findOneAndUpdate) ×1, pre(replaceOne) ×1, pre(update) ×1, pre(updateOne) ×1, pre(updateMany) ×1, pre(remove) ×1, post(save) ×3, post(init) ×1
- **Statics/methods:** `initializeTimestamps()`

| Field | Type | Ref | Flags |
|---|---|---|---|
| `userId` | ObjectId | `User` | required, index |
| `convKey` | String |  | required |
| `messageId` | ObjectId |  | required |
| `_id` | ObjectId |  |  |
| `createdAt` | Date |  |  |
| `updatedAt` | Date |  |  |

**Indexes:** `{"userId":1} {"background":true}`; `{"userId":1,"messageId":1} {"unique":true,"background":true}`; `{"userId":1,"createdAt":-1} {"background":true}`; `{"userId":1,"convKey":1,"createdAt":-1} {"background":true}`

### CollaborativeDocument

- **Collection:** `collaborativedocuments` · **Area:** Core platform · **Source:** `server/models/collaborativeDocument.model.ts` (doc: `server/models/collaborativeDocument.model.ts.md`) · **Options:** timestamps=true, autoIndex=null, capped=false
- **Used by:** `server/controllers/cabinet.controller.ts`, `server/controllers/collaborativeDocument.controller.ts`
- **Hooks:** pre(save) ×5, pre(findOneAndReplace) ×1, pre(findOneAndUpdate) ×1, pre(replaceOne) ×1, pre(update) ×1, pre(updateOne) ×1, pre(updateMany) ×1, pre(remove) ×1, post(save) ×3, post(init) ×1
- **Statics/methods:** static `generateDocumentKey`, `initializeTimestamps()`, `getFileExtension()`, `getMimeType()`

| Field | Type | Ref | Flags |
|---|---|---|---|
| `title` | String |  | required |
| `type` | String |  | required, enum ["word","cell","slide"] |
| `organization` | ObjectId | `Organization` | required, index |
| `cabinet` | ObjectId | `Cabinet` | index |
| `createdBy` | ObjectId | `User` | required, index |
| `collaborators` | [ObjectId] | `User` |  |
| `fileKey` | String |  | required, unique |
| `filePath` | String |  | required |
| `fileUrl` | String |  |  |
| `version` | Number |  | default 1 |
| `lastModifiedBy` | ObjectId | `User` |  |
| `isLocked` | Boolean |  | default false |
| `lockedBy` | ObjectId | `User` |  |
| `lockedAt` | Date |  |  |
| `size` | Number |  | default 0 |
| `mimeType` | String |  | default "application/vnd.openxmlforma… |
| `_id` | ObjectId |  |  |
| `createdAt` | Date |  |  |
| `updatedAt` | Date |  |  |

**Indexes:** `{"organization":1} {"background":true}`; `{"cabinet":1} {"background":true}`; `{"createdBy":1} {"background":true}`; `{"fileKey":1} {"unique":true,"background":true}`; `{"organization":1,"createdBy":1} {"background":true}`; `{"organization":1,"collaborators":1} {"background":true}`; `{"fileKey":1} {"background":true}`

### CombPlan

- **Collection:** `combplans` · **Area:** Core platform · **Source:** `server/models/combPlan.model.ts` (doc: `server/models/combPlan.model.ts.md`) · **Options:** timestamps=true, autoIndex=null, capped=false
- **Referenced by:** `BondInstrument`, `CommissionDistribution`
- **Used by:** `server/routes/affiliate.ts`, `server/routes/bond.ts`, `server/routes/internal-catalog.ts`, `server/routes/public.ts`, `server/services/affiliateTransactionDetail.ts`, `server/services/bondCommission.ts`, `server/services/cashbackCode.ts`, `server/services/commission.ts`, … +4 more
- **Hooks:** pre(save) ×6, pre(findOneAndReplace) ×1, pre(findOneAndUpdate) ×1, pre(replaceOne) ×1, pre(update) ×1, pre(updateOne) ×1, pre(updateMany) ×1, pre(remove) ×1, post(save) ×3, post(init) ×1
- **Statics/methods:** `initializeTimestamps()`

| Field | Type | Ref | Flags |
|---|---|---|---|
| `name` | String |  | required |
| `description` | String |  |  |
| `itemType` | String |  | required, index, enum ["course","product","channel"… |
| `itemId` | ObjectId |  | required, index |
| `orgId` | ObjectId | `Organization` | required, index |
| `createdBy` | ObjectId | `User` | required |
| `levels` | [subdoc] |  | required |
| `totalPercentage` | Number |  | required, default 0 |
| `platformPercentage` | Number |  | required, default 5 |
| `isActive` | Boolean |  | index, default true |
| `planKind` | String |  | index, default "levels", enum ["levels","unilevel_plus"] |
| `unilevelPlusPercentage` | Number |  |  |
| `capType` | String |  | default "perpetual", enum ["perpetual","per_pair_capped… |
| `capCount` | Number |  |  |
| `_id` | ObjectId |  |  |
| `createdAt` | Date |  |  |
| `updatedAt` | Date |  |  |

**Indexes:** `{"itemType":1} {"background":true}`; `{"itemId":1} {"background":true}`; `{"orgId":1} {"background":true}`; `{"isActive":1} {"background":true}`; `{"planKind":1} {"background":true}`; `{"itemType":1,"itemId":1,"isActive":1} {"unique":true,"partialFilterExpression":{"isActive":true},"background":true}`; `{"orgId":1,"itemType":1,"isActive":1} {"background":true}`

### CommissionDistribution

- **Collection:** `commissiondistributions` · **Area:** Core platform · **Source:** `server/models/commissionDistribution.model.ts` (doc: `server/models/commissionDistribution.model.ts.md`) · **Options:** timestamps=true, autoIndex=null, capped=false
- **Referenced by:** `AuctionSettlement`, `Invoice`, `OfficeSubscriptionPayment`, `SubscriptionPayment`, `TerritoryWalletTransaction`
- **Used by:** `server/controllers/garageAdmin.controller.ts`, `server/routes/affiliate.ts`, `server/routes/franchiseApi.ts`, `server/routes/franchiseEntity.ts`, `server/routes/garageAdminAuctionSettlements.ts`, `server/scripts/audit-partial-fanout.ts`, `server/scripts/diagnoseAuctionSettlement.ts`, `server/scripts/find-coupon-ecommerce-overcredits.ts`, … +12 more
- **Hooks:** pre(save) ×5, pre(findOneAndReplace) ×1, pre(findOneAndUpdate) ×1, pre(replaceOne) ×1, pre(update) ×1, pre(updateOne) ×1, pre(updateMany) ×1, pre(remove) ×1, post(save) ×3, post(init) ×1
- **Statics/methods:** `initializeTimestamps()`

| Field | Type | Ref | Flags |
|---|---|---|---|
| `combPlanId` | ObjectId | `CombPlan` | index |
| `orgId` | ObjectId | `Organization` | required, index |
| `sellerId` | ObjectId | `User` | required, index |
| `customerId` | ObjectId | `User` | required, index |
| `itemType` | String |  | required, index, enum ["course","product","channel"… |
| `itemId` | ObjectId |  | required, index |
| `itemName` | String |  | required |
| `saleAmount` | Number |  | required |
| `currency` | String |  | default "USD" |
| `platformFeePercentage` | Number |  | required, default 5 |
| `platformFeeAmount` | Number |  | required |
| `netAmount` | Number |  | required |
| `sellerAmount` | Number |  | required |
| `commissions` | [subdoc] |  | default [] |
| `totalCommissionAmount` | Number |  | required, default 0 |
| `paymentId` | String |  | index |
| `status` | String |  | index, default "pending", enum ["pending","completed","faile… |
| `failureReason` | String |  |  |
| `isRecurringPayment` | Boolean |  | default false |
| `recurringPaymentNumber` | Number |  |  |
| `metadata` | Mixed |  |  |
| `_id` | ObjectId |  |  |
| `createdAt` | Date |  |  |
| `updatedAt` | Date |  |  |

**Indexes:** `{"combPlanId":1} {"background":true}`; `{"orgId":1} {"background":true}`; `{"sellerId":1} {"background":true}`; `{"customerId":1} {"background":true}`; `{"itemType":1} {"background":true}`; `{"itemId":1} {"background":true}`; `{"paymentId":1} {"background":true}`; `{"status":1} {"background":true}`; `{"sellerId":1,"status":1,"createdAt":-1} {"background":true}`; `{"customerId":1,"createdAt":-1} {"background":true}`; `{"orgId":1,"itemType":1,"createdAt":-1} {"background":true}`; `{"commissions.userId":1,"createdAt":-1} {"background":true}`; `{"itemType":1,"itemId":1,"createdAt":-1} {"background":true}`; `{"paymentId":1,"itemType":1,"itemId":1} {"unique":true,"sparse":true,"background":true}`

### ConferenceRoom

- **Collection:** `conferencerooms` · **Area:** Core platform · **Source:** `server/models/conferenceRoom.model.ts` (doc: `server/models/conferenceRoom.model.ts.md`) · **Options:** timestamps=true, autoIndex=null, capped=false
- **Referenced by:** `RoomBooking`
- **Used by:** `server/realtime/socket.ts`, `server/routes/conferenceRoom.ts`, `server/routes/officeCheckout.ts`, `server/routes/org.ts`, `server/services/conferenceRoomBilling.ts`
- **Hooks:** pre(save) ×5, pre(findOneAndReplace) ×1, pre(findOneAndUpdate) ×1, pre(replaceOne) ×1, pre(update) ×1, pre(updateOne) ×1, pre(updateMany) ×1, pre(remove) ×1, post(save) ×3, post(init) ×1
- **Statics/methods:** `initializeTimestamps()`

| Field | Type | Ref | Flags |
|---|---|---|---|
| `orgId` | ObjectId | `Organization` | required, index |
| `name` | String |  | required |
| `createdBy` | ObjectId | `User` | required |
| `isActive` | Boolean |  | default true |
| `scheduledDeactivationAt` | Date |  |  |
| `_id` | ObjectId |  |  |
| `createdAt` | Date |  |  |
| `updatedAt` | Date |  |  |

**Indexes:** `{"orgId":1} {"background":true}`; `{"orgId":1,"name":1} {"unique":true,"background":true}`; `{"orgId":1,"isActive":1} {"background":true}`

### ContentCampaign

- **Collection:** `contentcampaigns` · **Area:** Core platform · **Source:** `server/models/contentCampaign.model.ts` (doc: `server/models/contentCampaign.model.ts.md`) · **Options:** timestamps=true, autoIndex=null, capped=false
- **Referenced by:** `CampaignWallet`, `CampaignWalletTransaction`, `ContentPayout`, `ContentRewardsWalletTransaction`, `ContentSubmission`
- **Used by:** `server/models/socialAccount.model.ts`, `server/routes/contentCampaign.ts`, `server/routes/contentSubmission.ts`, `server/routes/socialAccount.ts`, `server/services/campaignWallet.ts`, `server/services/contentPayoutSweeper.ts`
- **Hooks:** pre(save) ×5, pre(findOneAndReplace) ×1, pre(findOneAndUpdate) ×1, pre(replaceOne) ×1, pre(update) ×1, pre(updateOne) ×1, pre(updateMany) ×1, pre(remove) ×1, post(save) ×3, post(init) ×1
- **Statics/methods:** `initializeTimestamps()`

| Field | Type | Ref | Flags |
|---|---|---|---|
| `orgId` | ObjectId | `Organization` | required, index |
| `founderId` | ObjectId | `User` | required, index |
| `title` | String |  | required |
| `description` | String |  | default "" |
| `thumbnailUrl` | String |  | default "" |
| `campaignType` | String |  | required, default "ugc", enum ["clipping","ugc"] |
| `status` | String |  | index, default "draft", enum ["draft","active","paused","c… |
| `currency` | String |  | default "USD", enum ["USD","INR"] |
| `budget` | Number |  | required |
| `budgetSpent` | Number |  | default 0 |
| `ratePerThousand` | Number |  | required |
| `minPayout` | Number |  | default 0 |
| `maxPayout` | Number |  | default 0 |
| `platforms` | [String] |  | default ["youtube"] |
| `requirements.minDuration` | Number |  | default 0 |
| `requirements.maxDuration` | Number |  | default 0 |
| `requirements.hashtags` | [String] |  | default [] |
| `requirements.mentions` | [String] |  | default [] |
| `requirements.guidelines` | String |  | default "" |
| `assets` | [subdoc] |  |  |
| `resourceLinks` | [subdoc] |  |  |
| `autoApprove` | Boolean |  | default false |
| `totalSubmissions` | Number |  | default 0 |
| `approvedSubmissions` | Number |  | default 0 |
| `totalViews` | Number |  | default 0 |
| `participants` | [ObjectId] | `User` |  |
| `totalParticipants` | Number |  | default 0 |
| `campaignWalletId` | ObjectId | `CampaignWallet` | default null |
| `lockedAmount` | Number |  | default 0 |
| `completedAt` | Date |  | default null |
| `_id` | ObjectId |  |  |
| `createdAt` | Date |  |  |
| `updatedAt` | Date |  |  |

**Indexes:** `{"orgId":1} {"background":true}`; `{"founderId":1} {"background":true}`; `{"status":1} {"background":true}`; `{"orgId":1,"status":1,"createdAt":-1} {"name":"org_campaigns_idx","background":true}`; `{"status":1,"createdAt":-1} {"name":"active_campaigns_idx","background":true}`

### ContentEngagement

- **Collection:** `contentengagements` · **Area:** Core platform · **Source:** `server/models/contentEngagement.model.ts` (doc: `server/models/contentEngagement.model.ts.md`) · **Options:** timestamps=true, autoIndex=null, capped=false
- **Used by:** `server/routes/contentEngagement.ts`
- **Hooks:** pre(save) ×5, pre(findOneAndReplace) ×1, pre(findOneAndUpdate) ×1, pre(replaceOne) ×1, pre(update) ×1, pre(updateOne) ×1, pre(updateMany) ×1, pre(remove) ×1, post(save) ×3, post(init) ×1
- **Statics/methods:** `initializeTimestamps()`

| Field | Type | Ref | Flags |
|---|---|---|---|
| `sessionId` | String |  | required, index |
| `contentId` | ObjectId |  | required, index |
| `contentType` | String |  | required, enum ["video","drop","article","re… |
| `orgId` | ObjectId | `Organization` | required, index |
| `affiliateId` | String |  | index, default null |
| `affiliateUserId` | ObjectId | `User` | index, default null |
| `userId` | ObjectId | `User` | default null |
| `guestId` | String |  | default null |
| `totalWatchTime` | Number |  | default 0 |
| `watchedRanges` | [Array] |  | default [] |
| `completionPercent` | Number |  | default 0 |
| `maxPlaybackRate` | Number |  | default 1 |
| `totalReadTime` | Number |  | default 0 |
| `scrollDepthMax` | Number |  | default 0 |
| `interactions.plays` | Number |  | default 0 |
| `interactions.pauses` | Number |  | default 0 |
| `interactions.seeks` | Number |  | default 0 |
| `interactions.replays` | Number |  | default 0 |
| `interactions.mutes` | Number |  | default 0 |
| `interactions.unmutes` | Number |  | default 0 |
| `interactions.fullscreens` | Number |  | default 0 |
| `interactions.linkClicks` | Number |  | default 0 |
| `deviceType` | String |  | default "unknown", enum ["mobile","tablet","desktop",… |
| `userAgent` | String |  | default "" |
| `referrerUrl` | String |  | default "" |
| `contentTitle` | String |  | default "" |
| `sessionStart` | Date |  | default fn now |
| `lastUpdate` | Date |  | default fn now |
| `heartbeatCount` | Number |  | default 0 |
| `isComplete` | Boolean |  | default false |
| `_id` | ObjectId |  |  |
| `createdAt` | Date |  |  |
| `updatedAt` | Date |  |  |

**Indexes:** `{"sessionId":1} {"background":true}`; `{"contentId":1} {"background":true}`; `{"orgId":1} {"background":true}`; `{"affiliateId":1} {"background":true}`; `{"affiliateUserId":1} {"background":true}`; `{"sessionId":1,"contentId":1} {"unique":true,"name":"session_content_unique","background":true}`; `{"orgId":1,"contentType":1,"contentId":1,"sessionStart":-1} {"name":"content_analytics_idx","background":true}`; `{"orgId":1,"affiliateId":1,"sessionStart":-1} {"name":"affiliate_perf_idx","background":true}`; `{"orgId":1,"affiliateId":1,"contentType":1,"sessionStart":-1} {"name":"affiliate_type_idx","background":true}`; `{"orgId":1,"sessionStart":-1} {"name":"org_timeline_idx","background":true}`; `{"userId":1,"sessionStart":-1} {"name":"user_history_idx","sparse":true,"background":true}`; `{"guestId":1,"sessionStart":-1} {"name":"guest_history_idx","sparse":true,"background":true}`

### ContentPayout

- **Collection:** `contentpayouts` · **Area:** Core platform · **Source:** `server/models/contentPayout.model.ts` (doc: `server/models/contentPayout.model.ts.md`) · **Options:** timestamps=true, autoIndex=null, capped=false
- **Referenced by:** `CampaignWalletTransaction`, `ContentRewardsWalletTransaction`
- **Used by:** `server/services/campaignWallet.ts`
- **Hooks:** pre(save) ×5, pre(findOneAndReplace) ×1, pre(findOneAndUpdate) ×1, pre(replaceOne) ×1, pre(update) ×1, pre(updateOne) ×1, pre(updateMany) ×1, pre(remove) ×1, post(save) ×3, post(init) ×1
- **Statics/methods:** `initializeTimestamps()`

| Field | Type | Ref | Flags |
|---|---|---|---|
| `userId` | ObjectId | `User` | required, index |
| `campaignId` | ObjectId | `ContentCampaign` | required, index |
| `submissionId` | ObjectId | `ContentSubmission` | required, index |
| `orgId` | ObjectId | `Organization` | required, index |
| `amount` | Number |  | required |
| `viewsRewarded` | Number |  | required |
| `status` | String |  | index, default "pending", enum ["pending","processing","comp… |
| `processedAt` | Date |  | default null |
| `transactionRef` | String |  | default "" |
| `_id` | ObjectId |  |  |
| `createdAt` | Date |  |  |
| `updatedAt` | Date |  |  |

**Indexes:** `{"userId":1} {"background":true}`; `{"campaignId":1} {"background":true}`; `{"submissionId":1} {"background":true}`; `{"orgId":1} {"background":true}`; `{"status":1} {"background":true}`; `{"userId":1,"createdAt":-1} {"name":"user_payouts_idx","background":true}`; `{"campaignId":1,"createdAt":-1} {"name":"campaign_payouts_idx","background":true}`

### ContentRewardsWallet

- **Collection:** `contentrewardswallets` · **Area:** Core platform · **Source:** `server/models/contentRewardsWallet.model.ts` (doc: `server/models/contentRewardsWallet.model.ts.md`) · **Options:** timestamps=true, autoIndex=null, capped=false
- **Referenced by:** `ContentRewardsWalletTransaction`
- **Hooks:** pre(save) ×5, pre(findOneAndReplace) ×1, pre(findOneAndUpdate) ×1, pre(replaceOne) ×1, pre(update) ×1, pre(updateOne) ×1, pre(updateMany) ×1, pre(remove) ×1, post(save) ×3, post(init) ×1
- **Statics/methods:** `initializeTimestamps()`

| Field | Type | Ref | Flags |
|---|---|---|---|
| `userId` | ObjectId | `User` | required, unique, index |
| `balance` | Number |  | required, default 0 |
| `currency` | String |  | default "USD" |
| `totalEarnings` | Number |  | default 0 |
| `totalWithdrawn` | Number |  | default 0 |
| `isActive` | Boolean |  | default true |
| `lastTransactionAt` | Date |  | default null |
| `_id` | ObjectId |  |  |
| `createdAt` | Date |  |  |
| `updatedAt` | Date |  |  |

**Indexes:** `{"userId":1} {"unique":true,"background":true}`

### ContentRewardsWalletTransaction

- **Collection:** `contentrewardswallettransactions` · **Area:** Core platform · **Source:** `server/models/contentRewardsWalletTransaction.model.ts` (doc: `server/models/contentRewardsWalletTransaction.model.ts.md`) · **Options:** timestamps=true, autoIndex=null, capped=false
- **Hooks:** pre(save) ×5, pre(findOneAndReplace) ×1, pre(findOneAndUpdate) ×1, pre(replaceOne) ×1, pre(update) ×1, pre(updateOne) ×1, pre(updateMany) ×1, pre(remove) ×1, post(save) ×3, post(init) ×1
- **Statics/methods:** `initializeTimestamps()`

| Field | Type | Ref | Flags |
|---|---|---|---|
| `contentRewardsWalletId` | ObjectId | `ContentRewardsWallet` | required, index |
| `userId` | ObjectId | `User` | required, index |
| `campaignId` | ObjectId | `ContentCampaign` | index, default null |
| `submissionId` | ObjectId | `ContentSubmission` | index, default null |
| `orgId` | ObjectId | `Organization` | index, default null |
| `type` | String |  | required, index, enum ["credit","debit","withdrawal… |
| `amount` | Number |  | required |
| `currency` | String |  | default "USD" |
| `balanceBefore` | Number |  | required |
| `balanceAfter` | Number |  | required |
| `description` | String |  | required |
| `relatedPayoutId` | ObjectId | `ContentPayout` | default null |
| `relatedTransactionId` | ObjectId |  | default null |
| `metadata` | Mixed |  |  |
| `status` | String |  | index, default "completed", enum ["completed","pending","faile… |
| `_id` | ObjectId |  |  |
| `createdAt` | Date |  |  |
| `updatedAt` | Date |  |  |

**Indexes:** `{"contentRewardsWalletId":1} {"background":true}`; `{"userId":1} {"background":true}`; `{"campaignId":1} {"background":true}`; `{"submissionId":1} {"background":true}`; `{"orgId":1} {"background":true}`; `{"type":1} {"background":true}`; `{"status":1} {"background":true}`; `{"contentRewardsWalletId":1,"createdAt":-1} {"background":true}`; `{"userId":1,"createdAt":-1} {"background":true}`; `{"campaignId":1,"createdAt":-1} {"background":true}`

### ContentSubmission

- **Collection:** `contentsubmissions` · **Area:** Core platform · **Source:** `server/models/contentSubmission.model.ts` (doc: `server/models/contentSubmission.model.ts.md`) · **Options:** timestamps=true, autoIndex=null, capped=false
- **Referenced by:** `CampaignWalletTransaction`, `ContentPayout`, `ContentRewardsWalletTransaction`
- **Used by:** `server/routes/contentCampaign.ts`, `server/routes/contentSubmission.ts`, `server/services/campaignWallet.ts`, `server/services/contentPayoutSweeper.ts`
- **Hooks:** pre(save) ×5, pre(findOneAndReplace) ×1, pre(findOneAndUpdate) ×1, pre(replaceOne) ×1, pre(update) ×1, pre(updateOne) ×1, pre(updateMany) ×1, pre(remove) ×1, post(save) ×3, post(init) ×1
- **Statics/methods:** `initializeTimestamps()`

| Field | Type | Ref | Flags |
|---|---|---|---|
| `campaignId` | ObjectId | `ContentCampaign` | required, index |
| `userId` | ObjectId | `User` | required, index |
| `socialAccountId` | ObjectId | `SocialAccount` | default null |
| `orgId` | ObjectId | `Organization` | required, index |
| `postUrl` | String |  | required |
| `platform` | String |  | required, index |
| `status` | String |  | index, default "pending", enum ["pending","approved","reject… |
| `reviewedBy` | ObjectId | `User` | default null |
| `reviewedAt` | Date |  | default null |
| `rejectionReason` | String |  | default "" |
| `viewsAtApproval` | Number |  | default 0 |
| `currentViews` | Number |  | default 0 |
| `viewSnapshots` | [subdoc] |  |  |
| `lastTrackedAt` | Date |  | default null |
| `viewSource` | String |  | default "oauth_api", enum ["oauth_api"] |
| `platformPostId` | String |  | default "" |
| `lastFetchedAt` | Date |  | default null |
| `earnedAmount` | Number |  | default 0 |
| `paidOutAmount` | Number |  | default 0 |
| `isPaidOut` | Boolean |  | default false |
| `paidOutAt` | Date |  | default null |
| `payoutBasis` | String |  | default "net", enum ["total","net"] |
| `_id` | ObjectId |  |  |
| `createdAt` | Date |  |  |
| `updatedAt` | Date |  |  |

**Indexes:** `{"campaignId":1} {"background":true}`; `{"userId":1} {"background":true}`; `{"orgId":1} {"background":true}`; `{"platform":1} {"background":true}`; `{"status":1} {"background":true}`; `{"campaignId":1,"status":1,"createdAt":-1} {"name":"campaign_submissions_idx","background":true}`; `{"userId":1,"createdAt":-1} {"name":"user_submissions_idx","background":true}`; `{"status":1,"lastTrackedAt":1} {"name":"tracking_queue_idx","background":true}`; `{"campaignId":1,"postUrl":1} {"unique":true,"name":"campaign_post_unique","background":true}`; `{"orgId":1,"status":1,"createdAt":-1} {"name":"org_submissions_idx","background":true}`

### ConversationState

- **Collection:** `conversationstates` · **Area:** Core platform · **Source:** `server/models/conversationState.model.ts` (doc: `server/models/conversationState.model.ts.md`) · **Options:** timestamps=true, autoIndex=null, capped=false
- **Used by:** `server/routes/conversationState.ts`, `server/routes/dm.ts`, `server/routes/groups.ts`
- **Hooks:** pre(save) ×5, pre(findOneAndReplace) ×1, pre(findOneAndUpdate) ×1, pre(replaceOne) ×1, pre(update) ×1, pre(updateOne) ×1, pre(updateMany) ×1, pre(remove) ×1, post(save) ×3, post(init) ×1
- **Statics/methods:** `initializeTimestamps()`

| Field | Type | Ref | Flags |
|---|---|---|---|
| `userId` | ObjectId | `User` | required, index |
| `convId` | String |  | required, index |
| `kind` | String |  | required, enum ["dm","group"] |
| `archivedAt` | Date |  | default null |
| `markedUnreadAt` | Date |  | default null |
| `_id` | ObjectId |  |  |
| `createdAt` | Date |  |  |
| `updatedAt` | Date |  |  |

**Indexes:** `{"userId":1} {"background":true}`; `{"convId":1} {"background":true}`; `{"userId":1,"convId":1} {"unique":true,"background":true}`; `{"userId":1,"archivedAt":-1} {"background":true}`; `{"userId":1,"markedUnreadAt":1} {"background":true}`

### CounterBill

- **Collection:** `counterbills` · **Area:** Core platform · **Source:** `server/models/counterBill.model.ts` (doc: `server/models/counterBill.model.ts.md`) · **Options:** timestamps=true, autoIndex=null, capped=false
- **Used by:** `server/routes/counterBills.ts`, `server/services/counterBill.ts`
- **Hooks:** pre(save) ×5, pre(findOneAndReplace) ×1, pre(findOneAndUpdate) ×1, pre(replaceOne) ×1, pre(update) ×1, pre(updateOne) ×1, pre(updateMany) ×1, pre(remove) ×1, post(save) ×3, post(init) ×1
- **Statics/methods:** `initializeTimestamps()`

| Field | Type | Ref | Flags |
|---|---|---|---|
| `orgId` | ObjectId |  | required |
| `storeId` | ObjectId |  |  |
| `branchId` | ObjectId |  |  |
| `branchName` | String |  |  |
| `createdBy` | ObjectId |  | required |
| `billNumber` | Number |  | required |
| `mode` | String |  | default "itemised", enum ["itemised","amount"] |
| `table` | String |  |  |
| `guests` | Number |  |  |
| `lines` | [subdoc] |  | default [] |
| `amount` | Number |  |  |
| `amountLabel` | String |  |  |
| `serviceChargePct` | Number |  | default 0 |
| `packaging` | Number |  | default 0 |
| `couponCode` | String |  |  |
| `note` | String |  |  |
| `status` | String |  | default "draft", enum ["draft","sent","paid","cance… |
| `attachCode` | String |  |  |
| `customer.userId` | ObjectId |  |  |
| `customer.name` | String |  |  |
| `customer.phone` | String |  |  |
| `customer.email` | String |  |  |
| `customer.attachedAt` | Date |  |  |
| `customer.via` | String |  | enum ["qr","manual"] |
| `invoiceId` | ObjectId |  |  |
| `invoiceNumber` | String |  |  |
| `payUrl` | String |  |  |
| `expiresAt` | Date |  |  |
| `totals.itemTotal` | Number |  | default 0 |
| `totals.serviceCharge` | Number |  | default 0 |
| `totals.packaging` | Number |  | default 0 |
| `totals.tax` | Number |  | default 0 |
| `totals.discount` | Number |  | default 0 |
| `totals.total` | Number |  | default 0 |
| `split.ways` | Number |  |  |
| `split.shares` | [subdoc] |  |  |
| `correction.status` | String |  | enum ["requested","resolved"] |
| `correction.note` | String |  |  |
| `correction.requestedAt` | Date |  |  |
| `correction.requestedBy` | ObjectId |  |  |
| `correction.resolvedAt` | Date |  |  |
| `sentAt` | Date |  |  |
| `paidAt` | Date |  |  |
| `cancelledAt` | Date |  |  |
| `_id` | ObjectId |  |  |
| `createdAt` | Date |  |  |
| `updatedAt` | Date |  |  |

**Indexes:** `{"orgId":1,"createdAt":-1} {"background":true}`; `{"orgId":1,"status":1,"createdAt":-1} {"background":true}`; `{"orgId":1,"billNumber":1} {"unique":true,"background":true}`; `{"attachCode":1} {"unique":true,"sparse":true,"background":true}`; `{"customer.userId":1,"createdAt":-1} {"background":true}`; `{"invoiceId":1} {"sparse":true,"background":true}`; `{"split.shares.invoiceId":1} {"sparse":true,"background":true}`

### CounterBillSequence

- **Collection:** `counterbillsequences` · **Area:** Core platform · **Source:** `server/models/counterBill.model.ts` (doc: `server/models/counterBill.model.ts.md`) · **Options:** autoIndex=null, capped=false
- **Used by:** `server/routes/counterBills.ts`, `server/services/counterBill.ts`
- **Hooks:** pre(save) ×4, pre(remove) ×1, post(save) ×3, post(init) ×1

| Field | Type | Ref | Flags |
|---|---|---|---|
| `orgId` | ObjectId |  | required, unique |
| `seq` | Number |  | default 0 |
| `_id` | ObjectId |  |  |

**Indexes:** `{"orgId":1} {"unique":true,"background":true}`

### Coupon

- **Collection:** `coupons` · **Area:** Core platform · **Source:** `server/models/coupon.model.ts` (doc: `server/models/coupon.model.ts.md`) · **Options:** timestamps=true, autoIndex=null, capped=false
- **Referenced by:** `CouponUsage`, `Invoice`
- **Used by:** `server/bat246/scripts/createAlanKFreeCoupon.ts`, `server/routes/couponValidation.ts`, `server/routes/founderCoupons.ts`, `server/routes/garageAdminCoupons.ts`, `server/routes/internal-catalog.ts`, `server/routes/rewards.ts`, `server/services/coupon.ts`, `server/services/couponAssignment.ts`
- **Hooks:** pre(save) ×5, pre(findOneAndReplace) ×1, pre(findOneAndUpdate) ×1, pre(replaceOne) ×1, pre(update) ×1, pre(updateOne) ×1, pre(updateMany) ×1, pre(validate) ×1, pre(remove) ×1, post(save) ×3, post(init) ×1
- **Virtuals:** `isValid`
- **Statics/methods:** `initializeTimestamps()`

| Field | Type | Ref | Flags |
|---|---|---|---|
| `code` | String |  | required, unique |
| `name` | String |  | required |
| `description` | String |  |  |
| `discountValue` | Number |  | required |
| `maxDiscountAmount` | Number |  |  |
| `scope` | String |  | required, default "global", enum ["global","organization"] |
| `orgId` | ObjectId | `Organization` |  |
| `createdBy` | ObjectId |  | required |
| `createdByType` | String |  | required, enum ["garage_admin","founder"] |
| `razorpayOfferId` | String |  |  |
| `applicableTo` | [String] |  | required |
| `specificItemIds` | [ObjectId] |  |  |
| `validFrom` | Date |  | required, default fn now |
| `validUntil` | Date |  |  |
| `status` | String |  | default "active", enum ["active","inactive","expired… |
| `maxUsageCount` | Number |  |  |
| `maxUsagePerUser` | Number |  |  |
| `currentUsageCount` | Number |  | default 0 |
| `minOrderAmount` | Number |  |  |
| `_id` | ObjectId |  |  |
| `createdAt` | Date |  |  |
| `updatedAt` | Date |  |  |

**Indexes:** `{"code":1} {"unique":true,"background":true}`; `{"code":1} {"unique":true,"background":true}`; `{"scope":1,"orgId":1} {"background":true}`; `{"status":1,"validFrom":1,"validUntil":1} {"background":true}`; `{"createdBy":1,"createdByType":1} {"background":true}`

### CouponAssignment

- **Collection:** `couponassignments` · **Area:** Core platform · **Source:** `server/models/couponAssignment.model.ts` (doc: `server/models/couponAssignment.model.ts.md`) · **Options:** timestamps=true, autoIndex=null, capped=false
- **Referenced by:** `CouponAssignment`, `PendingCouponGift`, `UserNotification`
- **Used by:** `server/routes/rewards.ts`, `server/routes/userRewards.ts`, `server/services/couponAssignment.ts`, `server/services/pendingCouponGift.ts`, `server/services/platformCoupon.ts`
- **Hooks:** pre(save) ×5, pre(findOneAndReplace) ×1, pre(findOneAndUpdate) ×1, pre(replaceOne) ×1, pre(update) ×1, pre(updateOne) ×1, pre(updateMany) ×1, pre(remove) ×1, post(save) ×3, post(init) ×1
- **Statics/methods:** `initializeTimestamps()`

| Field | Type | Ref | Flags |
|---|---|---|---|
| `userId` | ObjectId | `User` | required, index |
| `couponId` | ObjectId |  | required, index |
| `couponSource` | String |  | required, enum ["platform","legacy"] |
| `couponCode` | String |  | required |
| `status` | String |  | index, default "active", enum ["active","used","revoked","e… |
| `assignedBy` | ObjectId | `User` | required |
| `assignedByType` | String |  | required, enum ["garage_admin","founder","sy… |
| `assignerOrgId` | ObjectId | `Organization` |  |
| `giftedFromUserId` | ObjectId | `User` |  |
| `parentAssignmentId` | ObjectId | `CouponAssignment` |  |
| `giftMessage` | String |  |  |
| `reason` | String |  |  |
| `availableUses` | Number |  | default 1 |
| `expiresAt` | Date |  |  |
| `redemptionRef` | ObjectId |  |  |
| `redeemedAt` | Date |  |  |
| `revokedAt` | Date |  |  |
| `pendingGiftId` | ObjectId | `PendingCouponGift` |  |
| `_id` | ObjectId |  |  |
| `createdAt` | Date |  |  |
| `updatedAt` | Date |  |  |

**Indexes:** `{"userId":1} {"background":true}`; `{"couponId":1} {"background":true}`; `{"status":1} {"background":true}`; `{"userId":1,"couponId":1,"couponSource":1} {"unique":true,"background":true}`; `{"userId":1,"status":1,"createdAt":-1} {"background":true}`

### CouponRule

- **Collection:** `couponrules` · **Area:** Core platform · **Source:** `server/models/couponRule.model.ts` (doc: `server/models/couponRule.model.ts.md`) · **Options:** timestamps=true, autoIndex=null, capped=false
- **Referenced by:** `CouponRuleProgress`
- **Used by:** `server/services/couponRule.ts`
- **Hooks:** pre(save) ×5, pre(findOneAndReplace) ×1, pre(findOneAndUpdate) ×1, pre(replaceOne) ×1, pre(update) ×1, pre(updateOne) ×1, pre(updateMany) ×1, pre(remove) ×1, post(save) ×3, post(init) ×1
- **Statics/methods:** `initializeTimestamps()`

| Field | Type | Ref | Flags |
|---|---|---|---|
| `scope` | String |  | required, index, default "organization", enum ["platform","organization"] |
| `orgId` | ObjectId | `Organization` | index |
| `name` | String |  | required |
| `type` | String |  | required, default "purchase_based", enum ["purchase_based"] |
| `triggerProductType` | String |  | required, enum ["channel","course","workshop… |
| `triggerItemId` | ObjectId |  | index |
| `triggerQuantity` | Number |  | required, default 1 |
| `rewardCouponId` | ObjectId | `PlatformCoupon` | required |
| `rewardQuantity` | Number |  | required, default 1 |
| `recurrence` | String |  | required, default "once", enum ["once","every"] |
| `isActive` | Boolean |  | index, default true |
| `effectiveFrom` | Date |  | required, default fn default |
| `createdBy` | ObjectId | `User` | required |
| `_id` | ObjectId |  |  |
| `createdAt` | Date |  |  |
| `updatedAt` | Date |  |  |

**Indexes:** `{"scope":1} {"background":true}`; `{"orgId":1} {"background":true}`; `{"triggerItemId":1} {"background":true}`; `{"isActive":1} {"background":true}`; `{"orgId":1,"isActive":1} {"background":true}`; `{"scope":1,"isActive":1} {"background":true}`; `{"triggerItemId":1,"isActive":1} {"background":true}`

### CouponRuleProgress

- **Collection:** `couponruleprogresses` · **Area:** Core platform · **Source:** `server/models/couponRuleProgress.model.ts` (doc: `server/models/couponRuleProgress.model.ts.md`) · **Options:** timestamps=true, autoIndex=null, capped=false
- **Used by:** `server/services/couponRule.ts`
- **Hooks:** pre(save) ×5, pre(findOneAndReplace) ×1, pre(findOneAndUpdate) ×1, pre(replaceOne) ×1, pre(update) ×1, pre(updateOne) ×1, pre(updateMany) ×1, pre(remove) ×1, post(save) ×3, post(init) ×1
- **Statics/methods:** `initializeTimestamps()`

| Field | Type | Ref | Flags |
|---|---|---|---|
| `userId` | ObjectId | `User` | required, index |
| `ruleId` | ObjectId | `CouponRule` | required, index |
| `purchaseCount` | Number |  | default 0 |
| `firedTimes` | Number |  | default 0 |
| `lastFiredAt` | Date |  |  |
| `_id` | ObjectId |  |  |
| `createdAt` | Date |  |  |
| `updatedAt` | Date |  |  |

**Indexes:** `{"userId":1} {"background":true}`; `{"ruleId":1} {"background":true}`; `{"userId":1,"ruleId":1} {"unique":true,"background":true}`

### CouponUsage

- **Collection:** `couponusages` · **Area:** Core platform · **Source:** `server/models/couponUsage.model.ts` (doc: `server/models/couponUsage.model.ts.md`) · **Options:** timestamps=true, autoIndex=null, capped=false
- **Referenced by:** `Invoice`
- **Used by:** `server/routes/officeCheckout.ts`, `server/services/coupon.ts`
- **Hooks:** pre(save) ×5, pre(findOneAndReplace) ×1, pre(findOneAndUpdate) ×1, pre(replaceOne) ×1, pre(update) ×1, pre(updateOne) ×1, pre(updateMany) ×1, pre(remove) ×1, post(save) ×3, post(init) ×1
- **Statics/methods:** `initializeTimestamps()`

| Field | Type | Ref | Flags |
|---|---|---|---|
| `couponId` | ObjectId | `Coupon` | required |
| `userId` | ObjectId | `User` | required |
| `orgId` | ObjectId | `Organization` |  |
| `transactionType` | String |  | required, enum ["one_time","subscription"] |
| `transactionId` | String |  | required |
| `itemType` | String |  | required |
| `itemId` | ObjectId |  | required |
| `originalAmount` | Number |  | required |
| `discountAmount` | Number |  | required |
| `finalAmount` | Number |  | required |
| `subscriptionId` | ObjectId | `Subscription` |  |
| `paymentNumber` | Number |  |  |
| `status` | String |  | default "pending", enum ["pending","applied","refunde… |
| `appliedAt` | Date |  |  |
| `_id` | ObjectId |  |  |
| `createdAt` | Date |  |  |
| `updatedAt` | Date |  |  |

**Indexes:** `{"couponId":1,"userId":1} {"background":true}`; `{"userId":1,"itemType":1,"itemId":1} {"background":true}`; `{"transactionId":1} {"background":true}`; `{"status":1} {"background":true}`; `{"createdAt":-1} {"background":true}`

### Course

- **Collection:** `courses` · **Area:** Core platform · **Source:** `server/models/course.model.ts` (doc: `server/models/course.model.ts.md`) · **Options:** timestamps=true, autoIndex=null, capped=false
- **Referenced by:** `CourseEnrollment`, `StudySession`
- **Used by:** `server/controllers/garageAdmin.controller.ts`, `server/routes/affiliate.ts`, `server/routes/course.ts`, `server/routes/courseCheckout.ts`, `server/routes/courseVideo.ts`, `server/routes/feed.ts`, `server/routes/founderCouponItems.ts`, `server/routes/founderCouponRules.ts`, … +23 more
- **Hooks:** pre(save) ×6, pre(findOneAndReplace) ×1, pre(findOneAndUpdate) ×1, pre(replaceOne) ×1, pre(update) ×1, pre(updateOne) ×1, pre(updateMany) ×1, pre(remove) ×1, post(save) ×4, post(findOneAndUpdate) ×1, post(findOneAndDelete) ×1, post(deleteOne) ×1, post(init) ×1
- **Statics/methods:** `initializeTimestamps()`

| Field | Type | Ref | Flags |
|---|---|---|---|
| `title` | String |  | required |
| `description` | String |  |  |
| `coverImage` | String |  |  |
| `galleryImages` | [String] |  | default [] |
| `videoUrl` | String |  |  |
| `videoFile` | String |  |  |
| `status` | String |  | default "draft", enum ["draft","published","archive… |
| `organizationId` | ObjectId | `Organization` | required, index |
| `createdBy` | ObjectId | `User` | required, index |
| `channelIds` | [ObjectId] | `Channel` |  |
| `isPaid` | Boolean |  | default false |
| `isFree` | Boolean |  | default true |
| `price` | Number |  | default 0 |
| `currency` | String |  | default "USD", enum ["INR","USD"] |
| `gstInclusive` | Boolean |  | default true |
| `requireIosPayment` | Boolean |  | default false |
| `appleFeeInclusive` | Boolean |  | default false |
| `isSubscription` | Boolean |  | default false |
| `subscriptionPeriod` | String |  | enum ["weekly","monthly","quarterl… |
| `emailAlerts.enabled` | Boolean |  | default false |
| `emailAlerts.templateId` | String |  |  |
| `emailAlerts.templateName` | String |  |  |
| `emailAlerts.templateHtml` | String |  |  |
| `emailAlerts.syncedAt` | Date |  |  |
| `founderAlerts.enabled` | Boolean |  | default false |
| `founderAlerts.recipients` | [String] |  |  |
| `sections` | [subdoc] |  |  |
| `digitalAssets` | [subdoc] |  |  |
| `totalDuration` | Number |  | default 0 |
| `totalChapters` | Number |  | default 0 |
| `enrolledStudents` | Number |  | default 0 |
| `rating` | Number |  |  |
| `ratingCount` | Number |  | default 0 |
| `whatYouWillLearn` | [String] |  |  |
| `requirements` | [String] |  |  |
| `courseIncludes` | [subdoc] |  |  |
| `reviews` | [subdoc] |  |  |
| `thankYouPage` | Embedded |  |  |
| `_id` | ObjectId |  |  |
| `createdAt` | Date |  |  |
| `updatedAt` | Date |  |  |

**Indexes:** `{"organizationId":1} {"background":true}`; `{"createdBy":1} {"background":true}`; `{"organizationId":1,"status":1} {"background":true}`; `{"createdBy":1,"status":1} {"background":true}`; `{"channelIds":1} {"background":true}`

### CourseEnrollment

- **Collection:** `courseenrollments` · **Area:** Core platform · **Source:** `server/models/courseEnrollment.model.ts` (doc: `server/models/courseEnrollment.model.ts.md`) · **Options:** timestamps=true, autoIndex=null, capped=false
- **Used by:** `server/routes/course.ts`, `server/routes/learnInit.ts`, `server/routes/public.ts`, `server/routes/unifiedOrders.ts`, `server/services/course.ts`, `server/services/downlineMemberPurchases.ts`, `server/services/itemReserveLicense.ts`, `server/services/playlist.ts`, … +2 more
- **Hooks:** pre(save) ×6, pre(findOneAndReplace) ×1, pre(findOneAndUpdate) ×1, pre(replaceOne) ×1, pre(update) ×1, pre(updateOne) ×1, pre(updateMany) ×1, pre(remove) ×1, post(save) ×3, post(init) ×1
- **Statics/methods:** `initializeTimestamps()`

| Field | Type | Ref | Flags |
|---|---|---|---|
| `courseId` | ObjectId | `Course` | required, index |
| `userId` | ObjectId | `User` | required, index |
| `organizationId` | ObjectId | `Organization` | required, index |
| `status` | String |  | default "enrolled", enum ["enrolled","completed","drop… |
| `enrolledAt` | Date |  | default fn now |
| `completedAt` | Date |  |  |
| `isPaid` | Boolean |  | default false |
| `amountPaid` | Number |  |  |
| `currency` | String |  |  |
| `paymentId` | String |  |  |
| `paymentStatus` | String |  | enum ["pending","completed","faile… |
| `invoiceShortUrl` | String |  |  |
| `chaptersProgress` | [subdoc] |  |  |
| `completedChapters` | Number |  | default 0 |
| `totalChapters` | Number |  | default 0 |
| `progressPercentage` | Number |  | default 0 |
| `lastAccessedAt` | Date |  | default fn now |
| `lastChapterId` | ObjectId |  |  |
| `lastSectionId` | ObjectId |  |  |
| `quizAttempts` | [subdoc] |  | default [] |
| `_id` | ObjectId |  |  |
| `createdAt` | Date |  |  |
| `updatedAt` | Date |  |  |

**Indexes:** `{"courseId":1} {"background":true}`; `{"userId":1} {"background":true}`; `{"organizationId":1} {"background":true}`; `{"courseId":1,"userId":1} {"unique":true,"background":true}`; `{"userId":1,"organizationId":1,"status":1} {"background":true}`; `{"courseId":1,"status":1} {"background":true}`

### CoworkingSpace

- **Collection:** `coworkingspaces` · **Area:** Core platform · **Source:** `server/models/coworkingSpace.model.ts` (doc: `server/models/coworkingSpace.model.ts.md`) · **Options:** timestamps=true, autoIndex=null, capped=false
- **Referenced by:** `CoworkingSpaceBooking`
- **Used by:** `server/controllers/coworkingSpace.controller.ts`, `server/controllers/coworkingSpaceBooking.controller.ts`
- **Hooks:** pre(save) ×5, pre(findOneAndReplace) ×1, pre(findOneAndUpdate) ×1, pre(replaceOne) ×1, pre(update) ×1, pre(updateOne) ×1, pre(updateMany) ×1, pre(remove) ×1, post(save) ×3, post(init) ×1
- **Statics/methods:** `initializeTimestamps()`

| Field | Type | Ref | Flags |
|---|---|---|---|
| `name` | String |  | required |
| `description` | String |  |  |
| `location` | String |  |  |
| `city` | String |  |  |
| `state` | String |  |  |
| `country` | String |  |  |
| `latitude` | Number |  |  |
| `longitude` | Number |  |  |
| `images` | [String] |  |  |
| `amenities` | [String] |  |  |
| `officeTypes` | [subdoc] |  |  |
| `rating` | Number |  | default 0 |
| `ratingCount` | Number |  | default 0 |
| `isActive` | Boolean |  | default true |
| `createdBy` | ObjectId | `GarageAdmin` | required |
| `_id` | ObjectId |  |  |
| `createdAt` | Date |  |  |
| `updatedAt` | Date |  |  |

**Indexes:** `{"name":1} {"background":true}`; `{"city":1,"state":1,"country":1} {"background":true}`; `{"isActive":1} {"background":true}`; `{"officeTypes.name":1} {"background":true}`

### CoworkingSpaceBooking

- **Collection:** `coworkingspacebookings` · **Area:** Core platform · **Source:** `server/models/coworkingSpaceBooking.model.ts` (doc: `server/models/coworkingSpaceBooking.model.ts.md`) · **Options:** timestamps=true, autoIndex=null, capped=false
- **Used by:** `server/controllers/coworkingSpaceBooking.controller.ts`
- **Hooks:** pre(save) ×5, pre(findOneAndReplace) ×1, pre(findOneAndUpdate) ×1, pre(replaceOne) ×1, pre(update) ×1, pre(updateOne) ×1, pre(updateMany) ×1, pre(remove) ×1, post(save) ×3, post(init) ×1
- **Statics/methods:** `initializeTimestamps()`

| Field | Type | Ref | Flags |
|---|---|---|---|
| `founderId` | ObjectId | `User` | required |
| `founderName` | String |  | required |
| `founderEmail` | String |  | required |
| `organizationId` | ObjectId | `Organization` | required |
| `organizationName` | String |  | required |
| `coworkingSpaceId` | ObjectId | `CoworkingSpace` | required |
| `coworkingSpaceName` | String |  | required |
| `officeTypeId` | ObjectId |  | required |
| `officeTypeName` | String |  | required |
| `pricePerSeat` | Number |  | required |
| `bookingType` | String |  | required, enum ["single","range"] |
| `startDate` | Date |  | required |
| `endDate` | Date |  | required |
| `numberOfSeats` | Number |  | required |
| `totalAmount` | Number |  | required |
| `status` | String |  | default "pending", enum ["pending","approved","reject… |
| `statusNote` | String |  |  |
| `reviewedBy` | ObjectId | `GarageAdmin` |  |
| `reviewedAt` | Date |  |  |
| `_id` | ObjectId |  |  |
| `createdAt` | Date |  |  |
| `updatedAt` | Date |  |  |

**Indexes:** `{"founderId":1,"status":1} {"background":true}`; `{"organizationId":1,"status":1} {"background":true}`; `{"coworkingSpaceId":1,"status":1} {"background":true}`; `{"status":1,"createdAt":-1} {"background":true}`; `{"startDate":1,"endDate":1} {"background":true}`

### CronLease

- **Collection:** `cronleases` · **Area:** Core platform · **Source:** `server/models/cronLease.model.ts` (doc: `server/models/cronLease.model.ts.md`) · **Options:** timestamps=true, autoIndex=null, capped=false
- **Used by:** `server/services/cronLease.ts`
- **Hooks:** pre(save) ×5, pre(findOneAndReplace) ×1, pre(findOneAndUpdate) ×1, pre(replaceOne) ×1, pre(update) ×1, pre(updateOne) ×1, pre(updateMany) ×1, pre(remove) ×1, post(save) ×3, post(init) ×1
- **Statics/methods:** `initializeTimestamps()`

| Field | Type | Ref | Flags |
|---|---|---|---|
| `jobName` | String |  | required, unique, index |
| `leaseHolder` | String |  | default "" |
| `leaseExpiresAt` | Date |  | default null |
| `_id` | ObjectId |  |  |
| `createdAt` | Date |  |  |
| `updatedAt` | Date |  |  |

**Indexes:** `{"jobName":1} {"unique":true,"background":true}`

### CryptoAddressCounter

- **Collection:** `cryptoaddresscounters` · **Area:** Core platform · **Source:** `server/models/cryptoAddressCounter.model.ts` (doc: `server/models/cryptoAddressCounter.model.ts.md`) · **Options:** timestamps={"createdAt":false,"updatedAt…, autoIndex=null, capped=false
- **Used by:** `server/services/cryptoAddressAllocator.ts`
- **Hooks:** pre(save) ×5, pre(findOneAndReplace) ×1, pre(findOneAndUpdate) ×1, pre(replaceOne) ×1, pre(update) ×1, pre(updateOne) ×1, pre(updateMany) ×1, pre(remove) ×1, post(save) ×3, post(init) ×1
- **Statics/methods:** `initializeTimestamps()`

| Field | Type | Ref | Flags |
|---|---|---|---|
| `chain` | String |  | required, unique, index, enum ["polygon","bsc","tron","ethe… |
| `nextIndex` | Number |  | required, default 0 |
| `_id` | ObjectId |  |  |
| `updatedAt` | Date |  |  |

**Indexes:** `{"chain":1} {"unique":true,"background":true}`

### CryptoPaymentRequest

- **Collection:** `cryptopaymentrequests` · **Area:** Core platform · **Source:** `server/models/cryptoPaymentRequest.model.ts` (doc: `server/models/cryptoPaymentRequest.model.ts.md`) · **Options:** timestamps=true, autoIndex=null, capped=false
- **Used by:** `server/config/cryptoWallets.ts`, `server/scripts/diagnose-crypto-invoice.ts`, `server/services/cryptoPaymentRequest.ts`
- **Hooks:** pre(save) ×5, pre(findOneAndReplace) ×1, pre(findOneAndUpdate) ×1, pre(replaceOne) ×1, pre(update) ×1, pre(updateOne) ×1, pre(updateMany) ×1, pre(remove) ×1, post(save) ×3, post(init) ×1
- **Statics/methods:** `initializeTimestamps()`

| Field | Type | Ref | Flags |
|---|---|---|---|
| `invoiceId` | ObjectId | `Invoice` | required, index |
| `chain` | String |  | required, enum ["tron","polygon","bsc","ethe… |
| `coin` | String |  | required, enum ["USDT","USDC","ETH","BTC","P… |
| `platformAddress` | String |  | required |
| `expectedAmountAtomic` | String |  | required |
| `expectedAmountDisplay` | String |  | required |
| `expiresAt` | Date |  | required |
| `status` | String |  | required, default "pending", enum ["pending","matched","expired… |
| `matchedTxHash` | String |  |  |
| `matchedAt` | Date |  |  |
| `matchedFromAddress` | String |  |  |
| `derivationIndex` | Number |  |  |
| `isHdDerived` | Boolean |  |  |
| `addressExpiresAt` | Date |  |  |
| `swept` | Boolean |  |  |
| `sweptAt` | Date |  |  |
| `sweepTxHash` | String |  |  |
| `fundsReceivedAt` | Date |  |  |
| `fundsReceivedTxHash` | String |  |  |
| `fundsReceivedAtomic` | Number |  |  |
| `nativeRecoveryTxHash` | String |  |  |
| `nativeRecoveredAmount` | Number |  |  |
| `nativeRecoveryFailedReason` | String |  |  |
| `nativeRecoveryAttemptedAt` | Date |  |  |
| `usdPerCoinAtMint` | Number |  |  |
| `_id` | ObjectId |  |  |
| `createdAt` | Date |  |  |
| `updatedAt` | Date |  |  |

**Indexes:** `{"invoiceId":1} {"background":true}`; `{"chain":1,"expectedAmountAtomic":1,"status":1} {"background":true}`; `{"expiresAt":1,"status":1} {"background":true}`; `{"platformAddress":1} {"partialFilterExpression":{"status":{"$in":["pending","needs_review"]}},"background":true}`; `{"addressExpiresAt":1,"status":1} {"background":true}`; `{"status":1,"swept":1,"chain":1} {"background":true}`; `{"fundsReceivedAt":1,"swept":1,"chain":1} {"background":true}`

### CryptosubBonusPayout

- **Collection:** `cryptosubbonuspayouts` · **Area:** Core platform · **Source:** `server/models/cryptosubBonusPayout.model.ts` (doc: `server/models/cryptosubBonusPayout.model.ts.md`) · **Options:** timestamps=true, autoIndex=null, capped=false
- **Used by:** `server/routes/garageAdminCryptosubMonthlyBonus.ts`, `server/services/cryptosubMonthlyBonus/payout.ts`, `server/services/cryptosubMonthlyBonus/qualify.ts`, `server/services/cryptosubMonthlyBonus/run.ts`
- **Hooks:** pre(save) ×5, pre(findOneAndReplace) ×1, pre(findOneAndUpdate) ×1, pre(replaceOne) ×1, pre(update) ×1, pre(updateOne) ×1, pre(updateMany) ×1, pre(remove) ×1, post(save) ×3, post(init) ×1
- **Statics/methods:** `initializeTimestamps()`

| Field | Type | Ref | Flags |
|---|---|---|---|
| `runId` | ObjectId | `CryptosubBonusRun` | required, index |
| `periodKey` | String |  | required, index |
| `userId` | ObjectId | `User` | required, index |
| `qualifyingSales` | Number |  | required |
| `bonusUsd` | Number |  | required |
| `payoutStatus` | String |  | index, default "pending", enum ["pending","paid","failed"] |
| `routedToPlatform` | Boolean |  | default false |
| `walletTransactionId` | ObjectId |  |  |
| `paidAt` | Date |  |  |
| `attempts` | Number |  | default 0 |
| `lastError` | String |  |  |
| `saleInvoiceIds` | [ObjectId] |  |  |
| `saleInvoiceIdsTruncated` | Boolean |  | default false |
| `_id` | ObjectId |  |  |
| `createdAt` | Date |  |  |
| `updatedAt` | Date |  |  |

**Indexes:** `{"runId":1} {"background":true}`; `{"periodKey":1} {"background":true}`; `{"userId":1} {"background":true}`; `{"payoutStatus":1} {"background":true}`; `{"periodKey":1,"userId":1} {"unique":true,"background":true}`; `{"runId":1,"bonusUsd":-1} {"background":true}`

### CryptosubBonusRun

- **Collection:** `cryptosubbonusruns` · **Area:** Core platform · **Source:** `server/models/cryptosubBonusRun.model.ts` (doc: `server/models/cryptosubBonusRun.model.ts.md`) · **Options:** timestamps=true, autoIndex=null, capped=false
- **Referenced by:** `CryptosubBonusPayout`
- **Used by:** `server/routes/garageAdminCryptosubMonthlyBonus.ts`, `server/services/cryptosubMonthlyBonus/qualify.ts`, `server/services/cryptosubMonthlyBonus/run.ts`
- **Hooks:** pre(save) ×5, pre(findOneAndReplace) ×1, pre(findOneAndUpdate) ×1, pre(replaceOne) ×1, pre(update) ×1, pre(updateOne) ×1, pre(updateMany) ×1, pre(remove) ×1, post(save) ×3, post(init) ×1
- **Statics/methods:** `initializeTimestamps()`

| Field | Type | Ref | Flags |
|---|---|---|---|
| `periodKey` | String |  | required, unique |
| `status` | String |  | index, default "computing", enum ["computing","computed","payi… |
| `dryRun` | Boolean |  | required |
| `snapshotAt` | Date |  | required |
| `startedAt` | Date |  | required |
| `computedAt` | Date |  |  |
| `paidAt` | Date |  |  |
| `totals` | Embedded |  | default fn default |
| `error` | String |  |  |
| `triggeredBy` | String |  |  |
| `_id` | ObjectId |  |  |
| `createdAt` | Date |  |  |
| `updatedAt` | Date |  |  |

**Indexes:** `{"periodKey":1} {"unique":true,"background":true}`; `{"status":1} {"background":true}`; `{"createdAt":-1} {"background":true}`

### CryptoTopupTransaction

- **Collection:** `cryptotopuptransactions` · **Area:** Core platform · **Source:** `server/models/cryptoTopupTransaction.model.ts` (doc: `server/models/cryptoTopupTransaction.model.ts.md`) · **Options:** timestamps=true, autoIndex=null, capped=false
- **Used by:** `server/routes/wallet.ts`
- **Hooks:** pre(save) ×5, pre(findOneAndReplace) ×1, pre(findOneAndUpdate) ×1, pre(replaceOne) ×1, pre(update) ×1, pre(updateOne) ×1, pre(updateMany) ×1, pre(remove) ×1, post(save) ×3, post(init) ×1
- **Statics/methods:** `initializeTimestamps()`

| Field | Type | Ref | Flags |
|---|---|---|---|
| `userId` | ObjectId | `User` | required, index |
| `orgId` | ObjectId | `Organization` | required, index |
| `walletId` | ObjectId | `StoreWallet` | required, index |
| `currency` | String |  | required, enum ["BTC","ETH","USDT"] |
| `chain` | String |  | required, enum ["bitcoin","ethereum","polygo… |
| `coin` | String |  | required, enum ["BTC","ETH","USDT"] |
| `address` | String |  | required, index |
| `amountAtomic` | String |  | required |
| `amount` | Number |  | required |
| `amountUsdAtDeposit` | Number |  | default 0 |
| `txHash` | String |  | required, index |
| `fromAddress` | String |  | default "" |
| `blockNumber` | Number |  | default 0 |
| `receivedAt` | Date |  | required, default fn default |
| `status` | String |  | index, default "credited", enum ["credited","failed"] |
| `failureReason` | String |  | default "" |
| `metadata.dedupeKey` | String |  | required |
| `_id` | ObjectId |  |  |
| `createdAt` | Date |  |  |
| `updatedAt` | Date |  |  |

**Indexes:** `{"userId":1} {"background":true}`; `{"orgId":1} {"background":true}`; `{"walletId":1} {"background":true}`; `{"address":1} {"background":true}`; `{"txHash":1} {"background":true}`; `{"status":1} {"background":true}`; `{"metadata.dedupeKey":1} {"unique":true,"partialFilterExpression":{"metadata.dedupeKey":{"$exists":true}},"background":true}`; `{"userId":1,"orgId":1,"receivedAt":-1} {"background":true}`; `{"walletId":1,"receivedAt":-1} {"background":true}`

### Deal

- **Collection:** `deals` · **Area:** Core platform · **Source:** `server/models/deal.model.ts` (doc: `server/models/deal.model.ts.md`) · **Options:** timestamps=true, autoIndex=null, capped=false
- **Used by:** `server/routes/slashDeals.ts`
- **Hooks:** pre(save) ×5, pre(findOneAndReplace) ×1, pre(findOneAndUpdate) ×1, pre(replaceOne) ×1, pre(update) ×1, pre(updateOne) ×1, pre(updateMany) ×1, pre(remove) ×1, post(save) ×3, post(init) ×1
- **Statics/methods:** `initializeTimestamps()`

| Field | Type | Ref | Flags |
|---|---|---|---|
| `orgId` | ObjectId | `Organization` | required, index |
| `name` | String |  | required |
| `stage` | String |  | index, default "lead", enum ["lead","qualified","proposal… |
| `value` | Number |  | default 0 |
| `currency` | String |  | default "USD" |
| `ownerId` | ObjectId | `User` |  |
| `createdBy` | ObjectId | `User` | required |
| `nextFollowUp` | Date |  |  |
| `_id` | ObjectId |  |  |
| `createdAt` | Date |  |  |
| `updatedAt` | Date |  |  |

**Indexes:** `{"orgId":1} {"background":true}`; `{"stage":1} {"background":true}`; `{"name":"text"} {"background":true}`

### DealComment

- **Collection:** `dealcomments` · **Area:** Core platform · **Source:** `server/models/dealComment.model.ts` (doc: `server/models/dealComment.model.ts.md`) · **Options:** timestamps=true, autoIndex=null, capped=false
- **Referenced by:** `DealComment`
- **Used by:** `server/routes/deals.ts`, `server/services/deals.ts`
- **Hooks:** pre(save) ×5, pre(findOneAndReplace) ×1, pre(findOneAndUpdate) ×1, pre(replaceOne) ×1, pre(update) ×1, pre(updateOne) ×1, pre(updateMany) ×1, pre(remove) ×1, post(save) ×3, post(init) ×1
- **Statics/methods:** `initializeTimestamps()`

| Field | Type | Ref | Flags |
|---|---|---|---|
| `dealId` | String |  | required, index |
| `userId` | ObjectId | `User` | required, index |
| `body` | String |  | required |
| `parentId` | ObjectId | `DealComment` | default null |
| `deletedAt` | Date |  | default null |
| `_id` | ObjectId |  |  |
| `createdAt` | Date |  |  |
| `updatedAt` | Date |  |  |

**Indexes:** `{"dealId":1} {"background":true}`; `{"userId":1} {"background":true}`; `{"dealId":1,"createdAt":-1} {"background":true}`

### DealReaction

- **Collection:** `dealreactions` · **Area:** Core platform · **Source:** `server/models/dealReaction.model.ts` (doc: `server/models/dealReaction.model.ts.md`) · **Options:** timestamps=true, autoIndex=null, capped=false
- **Used by:** `server/routes/deals.ts`, `server/services/deals.ts`
- **Hooks:** pre(save) ×5, pre(findOneAndReplace) ×1, pre(findOneAndUpdate) ×1, pre(replaceOne) ×1, pre(update) ×1, pre(updateOne) ×1, pre(updateMany) ×1, pre(remove) ×1, post(save) ×3, post(init) ×1
- **Statics/methods:** `initializeTimestamps()`

| Field | Type | Ref | Flags |
|---|---|---|---|
| `dealId` | String |  | required, index |
| `userId` | ObjectId | `User` | required, index |
| `type` | String |  | required, default "like" |
| `_id` | ObjectId |  |  |
| `createdAt` | Date |  |  |
| `updatedAt` | Date |  |  |

**Indexes:** `{"dealId":1} {"background":true}`; `{"userId":1} {"background":true}`; `{"dealId":1,"userId":1} {"unique":true,"background":true}`

### DeviceToken

- **Collection:** `devicetokens` · **Area:** Core platform · **Source:** `server/models/deviceToken.model.ts` (doc: `server/models/deviceToken.model.ts.md`) · **Options:** timestamps=true, autoIndex=null, capped=false
- **Used by:** `scripts/inspect-push-tokens.ts`, `scripts/test-commission-push.ts`, `scripts/test-knock-push.ts`, `scripts/test-transfer-push.ts`, `server/realtime/socket.ts`, `server/routes/devices.ts`, `server/services/pushNotification.ts`, `server/services/socket.ts`
- **Hooks:** pre(save) ×5, pre(findOneAndReplace) ×1, pre(findOneAndUpdate) ×1, pre(replaceOne) ×1, pre(update) ×1, pre(updateOne) ×1, pre(updateMany) ×1, pre(remove) ×1, post(save) ×3, post(init) ×1
- **Statics/methods:** `initializeTimestamps()`

| Field | Type | Ref | Flags |
|---|---|---|---|
| `userId` | ObjectId | `User` | required, index |
| `token` | String |  | required, unique |
| `platform` | String |  | required, enum ["ios","android","web"] |
| `deviceId` | String |  |  |
| `appVersion` | String |  |  |
| `app` | String |  | enum ["garage-chat","networkchain"] |
| `features` | [String] |  |  |
| `isActive` | Boolean |  | default true |
| `lastUsedAt` | Date |  | default fn now |
| `failedAttempts` | Number |  | default 0 |
| `lastFailedAt` | Date |  |  |
| `_id` | ObjectId |  |  |
| `createdAt` | Date |  |  |
| `updatedAt` | Date |  |  |

**Indexes:** `{"userId":1} {"background":true}`; `{"token":1} {"unique":true,"background":true}`; `{"userId":1,"isActive":1} {"background":true}`; `{"lastUsedAt":1} {"expireAfterSeconds":7776000,"background":true}`

### DmSettings

- **Collection:** `dmsettings` · **Area:** Core platform · **Source:** `server/models/dmSettings.model.ts` (doc: `server/models/dmSettings.model.ts.md`) · **Options:** timestamps=true, autoIndex=null, capped=false
- **Used by:** `server/index.ts`, `server/routes/dm.ts`
- **Hooks:** pre(save) ×5, pre(findOneAndReplace) ×1, pre(findOneAndUpdate) ×1, pre(replaceOne) ×1, pre(update) ×1, pre(updateOne) ×1, pre(updateMany) ×1, pre(remove) ×1, post(save) ×3, post(init) ×1
- **Statics/methods:** `initializeTimestamps()`

| Field | Type | Ref | Flags |
|---|---|---|---|
| `convId` | String |  | required, unique |
| `messageRetentionDays` | Number |  | default 0 |
| `updatedBy` | ObjectId | `User` | default null |
| `_id` | ObjectId |  |  |
| `createdAt` | Date |  |  |
| `updatedAt` | Date |  |  |

**Indexes:** `{"convId":1} {"unique":true,"background":true}`; `{"messageRetentionDays":1} {"background":true}`

### DomainPurchaseRequest

- **Collection:** `domainpurchaserequests` · **Area:** Core platform · **Source:** `server/models/domainPurchaseRequest.model.ts` (doc: `server/models/domainPurchaseRequest.model.ts.md`) · **Options:** timestamps={"createdAt":true,"updatedAt"…, autoIndex=null, capped=false
- **Used by:** `server/routes/initialSetup.ts`
- **Hooks:** pre(save) ×5, pre(findOneAndReplace) ×1, pre(findOneAndUpdate) ×1, pre(replaceOne) ×1, pre(update) ×1, pre(updateOne) ×1, pre(updateMany) ×1, pre(remove) ×1, post(save) ×3, post(init) ×1
- **Statics/methods:** `initializeTimestamps()`

| Field | Type | Ref | Flags |
|---|---|---|---|
| `orgId` | ObjectId |  | required, index |
| `requestedBy` | String |  | required |
| `domain` | String |  | required |
| `priceUsd` | Number |  | default 0 |
| `renewalUsd` | Number |  | default 0 |
| `kind` | String |  | default "app", enum ["app","shop"] |
| `contact.firstName` | String |  | required |
| `contact.lastName` | String |  | required |
| `contact.email` | String |  | required |
| `contact.phone` | String |  | required |
| `contact.address1` | String |  | required |
| `contact.address2` | String |  |  |
| `contact.city` | String |  | required |
| `contact.state` | String |  | required |
| `contact.zip` | String |  | required |
| `contact.country` | String |  | required |
| `status` | String |  | index, default "pending", enum ["pending","registered","reje… |
| `note` | String |  |  |
| `_id` | ObjectId |  |  |
| `createdAt` | Date |  |  |
| `updatedAt` | Date |  |  |

**Indexes:** `{"orgId":1} {"background":true}`; `{"status":1} {"background":true}`; `{"domain":1,"status":1} {"unique":true,"partialFilterExpression":{"status":"pending"},"background":true}`

### Drop

- **Collection:** `drops` · **Area:** Core platform · **Source:** `server/models/drop.model.ts` (doc: `server/models/drop.model.ts.md`) · **Options:** timestamps=true, autoIndex=null, capped=false
- **Used by:** `server/routes/contentEngagement.ts`, `server/routes/drops.ts`
- **Hooks:** pre(save) ×5, pre(findOneAndReplace) ×1, pre(findOneAndUpdate) ×1, pre(replaceOne) ×1, pre(update) ×1, pre(updateOne) ×1, pre(updateMany) ×1, pre(remove) ×1, post(save) ×3, post(init) ×1
- **Statics/methods:** `initializeTimestamps()`

| Field | Type | Ref | Flags |
|---|---|---|---|
| `caption` | String |  | default "" |
| `authorId` | ObjectId | `User` | required, index |
| `orgId` | ObjectId | `Organization` | required, index |
| `videoUrl` | String |  |  |
| `videoS3Key` | String |  |  |
| `sourceType` | String |  | required, default "upload", enum ["upload","link"] |
| `thumbnailUrl` | String |  |  |
| `duration` | Number |  | default 0 |
| `viewsCount` | Number |  | default 0 |
| `likesCount` | Number |  | default 0 |
| `sharesCount` | Number |  | default 0 |
| `likedBy` | [ObjectId] | `User` | default [] |
| `isPublished` | Boolean |  | default true |
| `isActive` | Boolean |  | default true |
| `_id` | ObjectId |  |  |
| `createdAt` | Date |  |  |
| `updatedAt` | Date |  |  |

**Indexes:** `{"authorId":1} {"background":true}`; `{"orgId":1} {"background":true}`; `{"orgId":1,"isActive":1,"isPublished":1,"createdAt":-1,"_id":-1} {"name":"feed_cursor_idx","background":true}`; `{"authorId":1,"createdAt":-1} {"background":true}`; `{"orgId":1,"viewsCount":-1} {"background":true}`; `{"likedBy":1} {"background":true}`

### Email

- **Collection:** `emails` · **Area:** Core platform · **Source:** `server/models/email.model.ts` (doc: `server/models/email.model.ts.md`) · **Options:** timestamps=true, autoIndex=null, capped=false
- **Used by:** `server/routes/initialSetup.ts`
- **Hooks:** pre(save) ×5, pre(findOneAndReplace) ×1, pre(findOneAndUpdate) ×1, pre(replaceOne) ×1, pre(update) ×1, pre(updateOne) ×1, pre(updateMany) ×1, pre(remove) ×1, post(save) ×3, post(init) ×1
- **Statics/methods:** `initializeTimestamps()`

| Field | Type | Ref | Flags |
|---|---|---|---|
| `organization` | ObjectId | `Organization` | required, index |
| `user` | ObjectId | `User` | required, index |
| `mailbox` | String |  | required, index |
| `folder` | String |  | required, index, default "INBOX" |
| `messageId` | String |  | index |
| `uid` | Number |  | required |
| `seqno` | Number |  |  |
| `subject` | String |  | default "" |
| `from` | String |  | default "" |
| `to` | String |  | default "" |
| `cc` | String |  |  |
| `bcc` | String |  |  |
| `date` | Date |  |  |
| `text` | String |  |  |
| `html` | String |  |  |
| `hasHtml` | Boolean |  | default false |
| `attachments` | Number |  | default 0 |
| `flags` | [String] |  | default [] |
| `isRead` | Boolean |  | default false |
| `isStarred` | Boolean |  | default false |
| `_id` | ObjectId |  |  |
| `createdAt` | Date |  |  |
| `updatedAt` | Date |  |  |

**Indexes:** `{"organization":1} {"background":true}`; `{"user":1} {"background":true}`; `{"mailbox":1} {"background":true}`; `{"folder":1} {"background":true}`; `{"messageId":1} {"background":true}`; `{"user":1,"organization":1,"folder":1,"date":-1} {"background":true}`; `{"user":1,"organization":1,"folder":1,"uid":1} {"unique":true,"background":true}`

### Event

- **Collection:** `events` · **Area:** Core platform · **Source:** `server/models/event.model.ts` (doc: `server/models/event.model.ts.md`) · **Options:** timestamps=true, autoIndex=null, capped=false
- **Referenced by:** `EventGuest`
- **Used by:** `server/realtime/socket.ts`, `server/routes/calendar.ts`, `server/routes/events.ts`, `server/routes/publicEvents.ts`, `server/utils/guestToken.ts`
- **Hooks:** pre(save) ×6, pre(findOneAndReplace) ×1, pre(findOneAndUpdate) ×1, pre(replaceOne) ×1, pre(update) ×1, pre(updateOne) ×1, pre(updateMany) ×1, pre(remove) ×1, post(save) ×3, post(init) ×1
- **Statics/methods:** `initializeTimestamps()`

| Field | Type | Ref | Flags |
|---|---|---|---|
| `orgId` | ObjectId | `Organization` | required, index |
| `creatorId` | ObjectId | `User` | required, index |
| `title` | String |  | required |
| `description` | String |  |  |
| `startTime` | Date |  | required, index |
| `endTime` | Date |  | required |
| `invitedUserIds` | [ObjectId] | `User` |  |
| `guestInvitations` | [subdoc] |  |  |
| `publicJoinCode` | String |  | index |
| `videoCallInfo.agoraChannel` | String |  |  |
| `videoCallInfo.createdAt` | Date |  | default fn now |
| `status` | String |  | index, default "scheduled", enum ["scheduled","cancelled","com… |
| `isRepeating` | Boolean |  | default false |
| `isLive` | Boolean |  | index, default false |
| `liveStartedAt` | Date |  |  |
| `_id` | ObjectId |  |  |
| `createdAt` | Date |  |  |
| `updatedAt` | Date |  |  |

**Indexes:** `{"orgId":1} {"background":true}`; `{"creatorId":1} {"background":true}`; `{"startTime":1} {"background":true}`; `{"publicJoinCode":1} {"background":true}`; `{"status":1} {"background":true}`; `{"isLive":1} {"background":true}`; `{"orgId":1,"startTime":1,"status":1} {"background":true}`; `{"orgId":1,"invitedUserIds":1,"startTime":1} {"background":true}`; `{"orgId":1,"creatorId":1,"startTime":1} {"background":true}`; `{"guestInvitations.token":1} {"sparse":true,"background":true}`; `{"publicJoinCode":1} {"sparse":true,"unique":true,"background":true}`

### EventAgendaSession

- **Collection:** `event_agenda_sessions` · **Area:** Core platform · **Source:** `server/models/eventAgendaSession.model.ts` (doc: `server/models/eventAgendaSession.model.ts.md`) · **Options:** timestamps=true, autoIndex=null, capped=false
- **Used by:** `server/routes/eventManagement.ts`, `server/routes/publicEventManagement.ts`
- **Hooks:** pre(save) ×5, pre(findOneAndReplace) ×1, pre(findOneAndUpdate) ×1, pre(replaceOne) ×1, pre(update) ×1, pre(updateOne) ×1, pre(updateMany) ×1, pre(remove) ×1, post(save) ×3, post(init) ×1
- **Statics/methods:** `initializeTimestamps()`

| Field | Type | Ref | Flags |
|---|---|---|---|
| `eventId` | ObjectId | `EventProgram` | required, index |
| `title` | String |  | required |
| `description` | String |  |  |
| `stageName` | String |  | default "Main Stage" |
| `room` | String |  |  |
| `sessionType` | String |  | index, default "session", enum ["session","break"] |
| `trackColor` | String |  |  |
| `isLimitedSeats` | Boolean |  | default false |
| `format` | String |  | default "in_person", enum ["in_person","virtual","hybri… |
| `requiresRegistration` | Boolean |  | default false |
| `seatsAvailable` | Number |  | default 0 |
| `isRecorded` | Boolean |  | default false |
| `enableQa` | Boolean |  | default false |
| `enablePolls` | Boolean |  | default false |
| `startTime` | Date |  | required |
| `endTime` | Date |  | required |
| `speakerIds` | [ObjectId] | `EventSpeaker` |  |
| `isLivestreamed` | Boolean |  | default false |
| `sortOrder` | Number |  | default 0 |
| `_id` | ObjectId |  |  |
| `createdAt` | Date |  |  |
| `updatedAt` | Date |  |  |

**Indexes:** `{"eventId":1} {"background":true}`; `{"sessionType":1} {"background":true}`; `{"eventId":1,"startTime":1} {"background":true}`

### EventGuest

- **Collection:** `eventguests` · **Area:** Core platform · **Source:** `server/models/eventGuest.model.ts` (doc: `server/models/eventGuest.model.ts.md`) · **Options:** timestamps=true, autoIndex=null, capped=false
- **Used by:** `server/realtime/socket.ts`, `server/routes/events.ts`, `server/routes/publicEvents.ts`
- **Hooks:** pre(save) ×5, pre(findOneAndReplace) ×1, pre(findOneAndUpdate) ×1, pre(replaceOne) ×1, pre(update) ×1, pre(updateOne) ×1, pre(updateMany) ×1, pre(remove) ×1, post(save) ×3, post(init) ×1
- **Statics/methods:** `initializeTimestamps()`

| Field | Type | Ref | Flags |
|---|---|---|---|
| `eventId` | ObjectId | `Event` | required, index |
| `email` | String |  | required, index |
| `displayName` | String |  | required |
| `token` | String |  | index, sparse |
| `agoraUid` | Number |  | index, default fn default |
| `joinedAt` | Date |  | required, default fn now |
| `leftAt` | Date |  |  |
| `_id` | ObjectId |  |  |
| `createdAt` | Date |  |  |
| `updatedAt` | Date |  |  |

**Indexes:** `{"eventId":1} {"background":true}`; `{"email":1} {"background":true}`; `{"token":1} {"sparse":true,"background":true}`; `{"agoraUid":1} {"background":true}`; `{"eventId":1,"email":1} {"background":true}`; `{"eventId":1,"joinedAt":1} {"background":true}`; `{"token":1,"eventId":1} {"sparse":true,"background":true}`

### EventProgram

- **Collection:** `event_programs` · **Area:** Core platform · **Source:** `server/models/eventProgram.model.ts` (doc: `server/models/eventProgram.model.ts.md`) · **Options:** timestamps=true, autoIndex=null, capped=false
- **Referenced by:** `EventAgendaSession`, `EventRegistration`, `EventRegistrationForm`, `EventSpeaker`, `EventSponsor`, `EventTicketTier`, `EventWebsiteConfig`
- **Used by:** `server/routes/eventManagement.ts`, `server/routes/publicEventManagement.ts`, `server/services/coupon.ts`, `server/services/eventManagement.ts`, `server/services/founderAlertEmail.ts`, `server/services/invoice.ts`
- **Hooks:** pre(save) ×5, pre(findOneAndReplace) ×1, pre(findOneAndUpdate) ×1, pre(replaceOne) ×1, pre(update) ×1, pre(updateOne) ×1, pre(updateMany) ×1, pre(remove) ×1, post(save) ×3, post(init) ×1
- **Statics/methods:** `initializeTimestamps()`

| Field | Type | Ref | Flags |
|---|---|---|---|
| `orgId` | ObjectId | `Organization` | required, index |
| `creatorId` | ObjectId | `User` | required, index |
| `name` | String |  | required |
| `slug` | String |  | required, unique, index |
| `shortDescription` | String |  |  |
| `description` | String |  |  |
| `startsAt` | Date |  | required |
| `endsAt` | Date |  | required |
| `timezone` | String |  |  |
| `isRepeating` | Boolean |  | default false |
| `repeatRule` | String |  |  |
| `category` | String |  |  |
| `language` | String |  | default "English" |
| `bannerUrl` | String |  |  |
| `format` | String |  | default "in_person", enum ["in_person","hybrid","virtua… |
| `venue` | Embedded |  | default fn default |
| `streaming` | Embedded |  | default fn default |
| `totalCapacity` | Number |  | required |
| `requireApproval` | Boolean |  | default false |
| `isPrivate` | Boolean |  | default false |
| `payoutWalletId` | ObjectId | `StoreWallet` |  |
| `addGstForIndianBuyers` | Boolean |  | default false |
| `gstInclusive` | Boolean |  | default false |
| `status` | String |  | index, default "draft", enum ["draft","published","ongoing… |
| `founderAlerts.enabled` | Boolean |  | default false |
| `founderAlerts.recipients` | [String] |  |  |
| `publishedAt` | Date |  |  |
| `deletedAt` | Date |  | default null |
| `_id` | ObjectId |  |  |
| `createdAt` | Date |  |  |
| `updatedAt` | Date |  |  |

**Indexes:** `{"orgId":1} {"background":true}`; `{"creatorId":1} {"background":true}`; `{"slug":1} {"unique":true,"background":true}`; `{"status":1} {"background":true}`; `{"orgId":1,"status":1,"startsAt":-1} {"background":true}`; `{"orgId":1,"deletedAt":1} {"background":true}`

### EventRegistration

- **Collection:** `event_registrations` · **Area:** Core platform · **Source:** `server/models/eventRegistration.model.ts` (doc: `server/models/eventRegistration.model.ts.md`) · **Options:** timestamps=true, autoIndex=null, capped=false
- **Used by:** `server/routes/eventManagement.ts`, `server/routes/publicEventManagement.ts`, `server/services/eventManagement.ts`, `server/services/founderAlertEmail.ts`, `server/services/invoice.ts`
- **Hooks:** pre(save) ×5, pre(findOneAndReplace) ×1, pre(findOneAndUpdate) ×1, pre(replaceOne) ×1, pre(update) ×1, pre(updateOne) ×1, pre(updateMany) ×1, pre(remove) ×1, post(save) ×3, post(init) ×1
- **Statics/methods:** `initializeTimestamps()`

| Field | Type | Ref | Flags |
|---|---|---|---|
| `eventId` | ObjectId | `EventProgram` | required, index |
| `ticketTierId` | ObjectId | `EventTicketTier` | required, index |
| `userId` | ObjectId | `User` | index |
| `attendee` | Embedded |  | required |
| `quantity` | Number |  | default 1 |
| `addons` | [subdoc] |  | default [] |
| `answers` | Mixed |  | default fn  |
| `status` | String |  | index, default "pending_approval", enum ["pending_approval","approved… |
| `paymentStatus` | String |  | index, default "free", enum ["free","paid","pending","ref… |
| `amountPaid` | Number |  | default 0 |
| `currency` | String |  | default "USD" |
| `invoiceId` | ObjectId | `Invoice` | index |
| `promoCode` | String |  |  |
| `qrCodeToken` | String |  | required, unique, index |
| `holdExpiresAt` | Date |  | default null |
| `checkedInAt` | Date |  |  |
| `rejectedReason` | String |  |  |
| `needsRefund` | Boolean |  | default false |
| `_id` | ObjectId |  |  |
| `createdAt` | Date |  |  |
| `updatedAt` | Date |  |  |

**Indexes:** `{"eventId":1} {"background":true}`; `{"ticketTierId":1} {"background":true}`; `{"userId":1} {"background":true}`; `{"status":1} {"background":true}`; `{"paymentStatus":1} {"background":true}`; `{"invoiceId":1} {"background":true}`; `{"qrCodeToken":1} {"unique":true,"background":true}`; `{"eventId":1,"status":1,"createdAt":-1} {"background":true}`; `{"eventId":1,"attendee.email":1} {"background":true}`; `{"paymentStatus":1,"holdExpiresAt":1} {"background":true}`

### EventRegistrationForm

- **Collection:** `event_registration_forms` · **Area:** Core platform · **Source:** `server/models/eventRegistrationForm.model.ts` (doc: `server/models/eventRegistrationForm.model.ts.md`) · **Options:** timestamps=true, autoIndex=null, capped=false
- **Used by:** `server/routes/eventManagement.ts`, `server/routes/publicEventManagement.ts`
- **Hooks:** pre(save) ×5, pre(findOneAndReplace) ×1, pre(findOneAndUpdate) ×1, pre(replaceOne) ×1, pre(update) ×1, pre(updateOne) ×1, pre(updateMany) ×1, pre(remove) ×1, post(save) ×3, post(init) ×1
- **Statics/methods:** `initializeTimestamps()`

| Field | Type | Ref | Flags |
|---|---|---|---|
| `eventId` | ObjectId | `EventProgram` | required, unique, index |
| `title` | String |  | default "" |
| `description` | String |  |  |
| `fields` | [subdoc] |  | default [] |
| `_id` | ObjectId |  |  |
| `createdAt` | Date |  |  |
| `updatedAt` | Date |  |  |

**Indexes:** `{"eventId":1} {"unique":true,"background":true}`

### EventSpeaker

- **Collection:** `event_speakers` · **Area:** Core platform · **Source:** `server/models/eventSpeaker.model.ts` (doc: `server/models/eventSpeaker.model.ts.md`) · **Options:** timestamps=true, autoIndex=null, capped=false
- **Referenced by:** `EventAgendaSession`
- **Used by:** `server/routes/eventManagement.ts`, `server/routes/publicEventManagement.ts`
- **Hooks:** pre(save) ×5, pre(findOneAndReplace) ×1, pre(findOneAndUpdate) ×1, pre(replaceOne) ×1, pre(update) ×1, pre(updateOne) ×1, pre(updateMany) ×1, pre(remove) ×1, post(save) ×3, post(init) ×1
- **Statics/methods:** `initializeTimestamps()`

| Field | Type | Ref | Flags |
|---|---|---|---|
| `eventId` | ObjectId | `EventProgram` | required, index |
| `name` | String |  | required |
| `role` | String |  |  |
| `company` | String |  |  |
| `bio` | String |  |  |
| `avatarUrl` | String |  |  |
| `socials.twitter` | String |  |  |
| `socials.linkedin` | String |  |  |
| `socials.website` | String |  |  |
| `socials.instagram` | String |  |  |
| `isKeynote` | Boolean |  | default false |
| `sortOrder` | Number |  | default 0 |
| `_id` | ObjectId |  |  |
| `createdAt` | Date |  |  |
| `updatedAt` | Date |  |  |

**Indexes:** `{"eventId":1} {"background":true}`; `{"eventId":1,"sortOrder":1} {"background":true}`

### EventSponsor

- **Collection:** `event_sponsors` · **Area:** Core platform · **Source:** `server/models/eventSponsor.model.ts` (doc: `server/models/eventSponsor.model.ts.md`) · **Options:** timestamps=true, autoIndex=null, capped=false
- **Used by:** `server/routes/eventManagement.ts`, `server/routes/publicEventManagement.ts`
- **Hooks:** pre(save) ×5, pre(findOneAndReplace) ×1, pre(findOneAndUpdate) ×1, pre(replaceOne) ×1, pre(update) ×1, pre(updateOne) ×1, pre(updateMany) ×1, pre(remove) ×1, post(save) ×3, post(init) ×1
- **Statics/methods:** `initializeTimestamps()`

| Field | Type | Ref | Flags |
|---|---|---|---|
| `eventId` | ObjectId | `EventProgram` | required, index |
| `name` | String |  | required |
| `tier` | String |  | default "community", enum ["platinum","gold","silver","… |
| `logoUrl` | String |  |  |
| `boothNumber` | String |  |  |
| `websiteUrl` | String |  |  |
| `sortOrder` | Number |  | default 0 |
| `_id` | ObjectId |  |  |
| `createdAt` | Date |  |  |
| `updatedAt` | Date |  |  |

**Indexes:** `{"eventId":1} {"background":true}`; `{"eventId":1,"tier":1,"sortOrder":1} {"background":true}`

### EventTicketTier

- **Collection:** `event_ticket_tiers` · **Area:** Core platform · **Source:** `server/models/eventTicketTier.model.ts` (doc: `server/models/eventTicketTier.model.ts.md`) · **Options:** timestamps=true, autoIndex=null, capped=false
- **Referenced by:** `EventRegistration`
- **Used by:** `server/routes/eventManagement.ts`, `server/routes/publicEventManagement.ts`, `server/services/eventManagement.ts`, `server/services/invoice.ts`
- **Hooks:** pre(save) ×5, pre(findOneAndReplace) ×1, pre(findOneAndUpdate) ×1, pre(replaceOne) ×1, pre(update) ×1, pre(updateOne) ×1, pre(updateMany) ×1, pre(remove) ×1, post(save) ×3, post(init) ×1
- **Statics/methods:** `initializeTimestamps()`

| Field | Type | Ref | Flags |
|---|---|---|---|
| `eventId` | ObjectId | `EventProgram` | required, index |
| `kind` | String |  | index, default "ticket", enum ["ticket","addon"] |
| `name` | String |  | required |
| `description` | String |  |  |
| `perks` | [String] |  |  |
| `price` | Number |  | required, default 0 |
| `currency` | String |  | default "USD" |
| `quantity` | Number |  | required, default 1 |
| `soldCount` | Number |  | default 0 |
| `salesStart` | Date |  |  |
| `salesEnd` | Date |  |  |
| `isVisible` | Boolean |  | default true |
| `isPaused` | Boolean |  | default false |
| `sortOrder` | Number |  | default 0 |
| `archivedAt` | Date |  | default null |
| `_id` | ObjectId |  |  |
| `createdAt` | Date |  |  |
| `updatedAt` | Date |  |  |

**Indexes:** `{"eventId":1} {"background":true}`; `{"kind":1} {"background":true}`; `{"eventId":1,"sortOrder":1} {"background":true}`

### EventWebsiteConfig

- **Collection:** `event_website_configs` · **Area:** Core platform · **Source:** `server/models/eventWebsiteConfig.model.ts` (doc: `server/models/eventWebsiteConfig.model.ts.md`) · **Options:** timestamps=true, autoIndex=null, capped=false
- **Used by:** `server/routes/eventManagement.ts`, `server/routes/publicEventManagement.ts`, `server/services/eventManagement.ts`
- **Hooks:** pre(save) ×5, pre(findOneAndReplace) ×1, pre(findOneAndUpdate) ×1, pre(replaceOne) ×1, pre(update) ×1, pre(updateOne) ×1, pre(updateMany) ×1, pre(remove) ×1, post(save) ×3, post(init) ×1
- **Statics/methods:** `initializeTimestamps()`

| Field | Type | Ref | Flags |
|---|---|---|---|
| `eventId` | ObjectId | `EventProgram` | required, unique, index |
| `isPublished` | Boolean |  | default false |
| `theme` | Embedded |  | default fn default |
| `blocks` | [subdoc] |  | default [] |
| `publishedTheme` | Embedded |  |  |
| `publishedBlocks` | [subdoc] |  |  |
| `publishedAt` | Date |  |  |
| `domain` | Embedded |  |  |
| `branding` | Embedded |  | default fn default |
| `seo` | Embedded |  | default fn default |
| `social` | Embedded |  | default fn default |
| `_id` | ObjectId |  |  |
| `createdAt` | Date |  |  |
| `updatedAt` | Date |  |  |

**Indexes:** `{"eventId":1} {"unique":true,"background":true}`; `{"domain.host":1} {"unique":true,"sparse":true,"background":true}`

### FCMToken

- **Collection:** `fcmtokens` · **Area:** Core platform · **Source:** `server/models/fcmToken.model.ts` (doc: `server/models/fcmToken.model.ts.md`) · **Options:** timestamps=true, autoIndex=null, capped=false
- **Used by:** `server/realtime/socket.ts`, `server/routes/devices.ts`, `server/services/fcmPushNotification.ts`
- **Hooks:** pre(save) ×5, pre(findOneAndReplace) ×1, pre(findOneAndUpdate) ×1, pre(replaceOne) ×1, pre(update) ×1, pre(updateOne) ×1, pre(updateMany) ×1, pre(remove) ×1, post(save) ×3, post(init) ×1
- **Statics/methods:** `initializeTimestamps()`

| Field | Type | Ref | Flags |
|---|---|---|---|
| `userId` | ObjectId | `User` | required, index |
| `token` | String |  | required, unique |
| `platform` | String |  | required, default "android", enum ["android"] |
| `deviceId` | String |  |  |
| `appVersion` | String |  |  |
| `isActive` | Boolean |  | default true |
| `lastUsedAt` | Date |  | default fn now |
| `failedAttempts` | Number |  | default 0 |
| `lastFailedAt` | Date |  |  |
| `_id` | ObjectId |  |  |
| `createdAt` | Date |  |  |
| `updatedAt` | Date |  |  |

**Indexes:** `{"userId":1} {"background":true}`; `{"token":1} {"unique":true,"background":true}`; `{"userId":1,"isActive":1} {"background":true}`; `{"lastUsedAt":1} {"expireAfterSeconds":7776000,"background":true}`

### FeedActivityRead

- **Collection:** `feedactivityreads` · **Area:** Core platform · **Source:** `server/models/feedActivityRead.model.ts` (doc: `server/models/feedActivityRead.model.ts.md`) · **Options:** timestamps=true, autoIndex=null, capped=false
- **Used by:** `server/services/feedActivity.ts`
- **Hooks:** pre(save) ×5, pre(findOneAndReplace) ×1, pre(findOneAndUpdate) ×1, pre(replaceOne) ×1, pre(update) ×1, pre(updateOne) ×1, pre(updateMany) ×1, pre(remove) ×1, post(save) ×3, post(init) ×1
- **Statics/methods:** `initializeTimestamps()`

| Field | Type | Ref | Flags |
|---|---|---|---|
| `userId` | ObjectId | `User` | required, index |
| `orgId` | ObjectId | `Organization` | required, index |
| `lastReadAt` | Date |  | required, default fn default |
| `_id` | ObjectId |  |  |
| `createdAt` | Date |  |  |
| `updatedAt` | Date |  |  |

**Indexes:** `{"userId":1} {"background":true}`; `{"orgId":1} {"background":true}`; `{"userId":1,"orgId":1} {"unique":true,"background":true}`

### File

- **Collection:** `files` · **Area:** Core platform · **Source:** `server/models/file.model.ts` (doc: `server/models/file.model.ts.md`) · **Options:** timestamps=true, autoIndex=null, capped=false
- **Referenced by:** `File`
- **Hooks:** pre(save) ×5, pre(findOneAndReplace) ×1, pre(findOneAndUpdate) ×1, pre(replaceOne) ×1, pre(update) ×1, pre(updateOne) ×1, pre(updateMany) ×1, pre(remove) ×1, post(save) ×3, post(init) ×1
- **Statics/methods:** `initializeTimestamps()`

| Field | Type | Ref | Flags |
|---|---|---|---|
| `name` | String |  | required |
| `originalName` | String |  | required |
| `description` | String |  |  |
| `owner` | ObjectId | `User` | required |
| `organization` | ObjectId | `Organization` | required |
| `cabinet` | ObjectId | `Cabinet` | required |
| `s3Key` | String |  | required |
| `s3Bucket` | String |  | required |
| `s3Region` | String |  | required |
| `mimeType` | String |  | required |
| `size` | Number |  | required |
| `extension` | String |  |  |
| `path` | String |  | required |
| `isPublic` | Boolean |  | default false |
| `permissions` | Mixed |  | default fn  |
| `tags` | [String] |  |  |
| `metadata` | Mixed |  | default fn  |
| `status` | String |  | default "uploading", enum ["uploading","uploaded","proc… |
| `version` | Number |  | default 1 |
| `parentFile` | ObjectId | `File` | default null |
| `_id` | ObjectId |  |  |
| `createdAt` | Date |  |  |
| `updatedAt` | Date |  |  |

**Indexes:** `{"owner":1,"organization":1} {"background":true}`; `{"cabinet":1} {"background":true}`; `{"path":1,"owner":1} {"background":true}`; `{"s3Key":1} {"background":true}`; `{"mimeType":1} {"background":true}`; `{"tags":1} {"background":true}`

### Floor

- **Collection:** `floors` · **Area:** Core platform · **Source:** `server/models/floor.model.ts` (doc: `server/models/floor.model.ts.md`) · **Options:** timestamps=true, autoIndex=null, capped=false
- **Referenced by:** `FloorCabinet`, `FloorFile`, `SupportTicket`
- **Used by:** `server/controllers/cabinet.controller.ts`, `server/controllers/garageAdmin.controller.ts`, `server/controllers/shareableLink.controller.ts`, `server/routes/affiliate.ts`, `server/routes/callCheckout.ts`, `server/routes/channelCheckout.ts`, `server/routes/courseCheckout.ts`, `server/routes/downlines.ts`, … +11 more
- **Hooks:** pre(save) ×5, pre(findOneAndReplace) ×1, pre(findOneAndUpdate) ×1, pre(replaceOne) ×1, pre(update) ×1, pre(updateOne) ×1, pre(updateMany) ×1, pre(remove) ×1, post(save) ×3, post(init) ×1
- **Statics/methods:** `initializeTimestamps()`

| Field | Type | Ref | Flags |
|---|---|---|---|
| `orgId` | ObjectId | `Organization` | required, index |
| `level` | Number |  | required |
| `name` | String |  | required |
| `departments` | [subdoc] |  | default [] |
| `_id` | ObjectId |  |  |
| `createdAt` | Date |  |  |
| `updatedAt` | Date |  |  |

**Indexes:** `{"orgId":1} {"background":true}`; `{"orgId":1,"level":1} {"unique":true,"background":true}`

### FloorCabinet

- **Collection:** `floorcabinets` · **Area:** Core platform · **Source:** `server/models/cabinet.model.ts` (doc: `server/models/cabinet.model.ts.md`) · **Options:** timestamps=true, autoIndex=null, capped=false
- **Referenced by:** `FloorCabinet`, `FloorFile`
- **Used by:** `server/controllers/cabinet.controller.ts`, `server/controllers/collaborativeDocument.controller.ts`, `server/controllers/shareableLink.controller.ts`, `server/routes/dailyWebhook.ts`, `server/routes/evergreen.ts`, `server/routes/learnInit.ts`, `server/routes/livekitRecording.ts`, `server/routes/public.ts`, … +6 more
- **Hooks:** pre(save) ×5, pre(findOneAndReplace) ×1, pre(findOneAndUpdate) ×1, pre(replaceOne) ×1, pre(update) ×1, pre(updateOne) ×1, pre(updateMany) ×1, pre(remove) ×1, post(save) ×3, post(init) ×1
- **Statics/methods:** `initializeTimestamps()`

| Field | Type | Ref | Flags |
|---|---|---|---|
| `name` | String |  | required |
| `description` | String |  |  |
| `owner` | ObjectId | `User` | required |
| `organization` | ObjectId | `Organization` | required |
| `floorId` | ObjectId | `Floor` | required |
| `parentCabinet` | ObjectId | `FloorCabinet` | default null |
| `path` | String |  | required |
| `isRoot` | Boolean |  | default true |
| `permissions` | Mixed |  | default fn  |
| `metadata` | Mixed |  | default fn  |
| `_id` | ObjectId |  |  |
| `createdAt` | Date |  |  |
| `updatedAt` | Date |  |  |

**Indexes:** `{"floorId":1,"organization":1} {"background":true}`; `{"parentCabinet":1} {"background":true}`; `{"organization":1} {"background":true}`; `{"floorId":1,"organization":1} {"unique":true,"background":true}`

### FloorFile

- **Collection:** `floorfiles` · **Area:** Core platform · **Source:** `server/models/cabinet.model.ts` (doc: `server/models/cabinet.model.ts.md`) · **Options:** timestamps=true, autoIndex=null, capped=false
- **Referenced by:** `FloorFile`
- **Used by:** `server/controllers/cabinet.controller.ts`, `server/controllers/collaborativeDocument.controller.ts`, `server/controllers/shareableLink.controller.ts`, `server/routes/dailyWebhook.ts`, `server/routes/evergreen.ts`, `server/routes/learnInit.ts`, `server/routes/livekitRecording.ts`, `server/routes/public.ts`, … +6 more
- **Hooks:** pre(save) ×5, pre(findOneAndReplace) ×1, pre(findOneAndUpdate) ×1, pre(replaceOne) ×1, pre(update) ×1, pre(updateOne) ×1, pre(updateMany) ×1, pre(remove) ×1, post(save) ×3, post(init) ×1
- **Statics/methods:** `initializeTimestamps()`

| Field | Type | Ref | Flags |
|---|---|---|---|
| `name` | String |  | required |
| `originalName` | String |  | required |
| `description` | String |  |  |
| `owner` | ObjectId | `User` | required |
| `organization` | ObjectId | `Organization` | required |
| `cabinet` | ObjectId | `FloorCabinet` | required |
| `floorId` | ObjectId | `Floor` | required |
| `s3Key` | String |  | required |
| `s3Bucket` | String |  | required |
| `s3Region` | String |  | required |
| `mimeType` | String |  | required |
| `size` | Number |  | required |
| `extension` | String |  |  |
| `path` | String |  | required |
| `isPublic` | Boolean |  | default false |
| `permissions` | Mixed |  | default fn  |
| `tags` | [String] |  |  |
| `metadata` | Mixed |  | default fn  |
| `status` | String |  | default "uploading", enum ["uploading","uploaded","proc… |
| `version` | Number |  | default 1 |
| `parentFile` | ObjectId | `FloorFile` | default null |
| `_id` | ObjectId |  |  |
| `createdAt` | Date |  |  |
| `updatedAt` | Date |  |  |

**Indexes:** `{"organization":1} {"background":true}`; `{"cabinet":1} {"background":true}`; `{"floorId":1} {"background":true}`; `{"path":1} {"background":true}`; `{"s3Key":1} {"background":true}`; `{"mimeType":1} {"background":true}`; `{"tags":1} {"background":true}`

### FounderSubBonusPayout

- **Collection:** `foundersubbonuspayouts` · **Area:** Core platform · **Source:** `server/models/founderSubBonusPayout.model.ts` (doc: `server/models/founderSubBonusPayout.model.ts.md`) · **Options:** timestamps=true, autoIndex=null, capped=false
- **Used by:** `server/routes/garageAdminFounderSubMonthlyBonus.ts`, `server/services/founderSubMonthlyBonus/payout.ts`, `server/services/founderSubMonthlyBonus/qualify.ts`, `server/services/founderSubMonthlyBonus/run.ts`
- **Hooks:** pre(save) ×5, pre(findOneAndReplace) ×1, pre(findOneAndUpdate) ×1, pre(replaceOne) ×1, pre(update) ×1, pre(updateOne) ×1, pre(updateMany) ×1, pre(remove) ×1, post(save) ×3, post(init) ×1
- **Statics/methods:** `initializeTimestamps()`

| Field | Type | Ref | Flags |
|---|---|---|---|
| `runId` | ObjectId | `FounderSubBonusRun` | required, index |
| `periodKey` | String |  | required, index |
| `userId` | ObjectId | `User` | required, index |
| `qualifyingSales` | Number |  | required |
| `tier` | String |  | required, enum ["lower","upper"] |
| `countedSales` | Number |  | required |
| `bonusUsd` | Number |  | required |
| `payoutStatus` | String |  | index, default "pending", enum ["pending","paid","failed"] |
| `routedToPlatform` | Boolean |  | default false |
| `walletTransactionId` | ObjectId |  |  |
| `paidAt` | Date |  |  |
| `attempts` | Number |  | default 0 |
| `lastError` | String |  |  |
| `saleInvoiceIds` | [ObjectId] |  |  |
| `saleInvoiceIdsTruncated` | Boolean |  | default false |
| `_id` | ObjectId |  |  |
| `createdAt` | Date |  |  |
| `updatedAt` | Date |  |  |

**Indexes:** `{"runId":1} {"background":true}`; `{"periodKey":1} {"background":true}`; `{"userId":1} {"background":true}`; `{"payoutStatus":1} {"background":true}`; `{"periodKey":1,"userId":1} {"unique":true,"background":true}`; `{"runId":1,"bonusUsd":-1} {"background":true}`

### FounderSubBonusRun

- **Collection:** `foundersubbonusruns` · **Area:** Core platform · **Source:** `server/models/founderSubBonusRun.model.ts` (doc: `server/models/founderSubBonusRun.model.ts.md`) · **Options:** timestamps=true, autoIndex=null, capped=false
- **Referenced by:** `FounderSubBonusPayout`
- **Used by:** `server/routes/garageAdminFounderSubMonthlyBonus.ts`, `server/services/founderSubMonthlyBonus/qualify.ts`, `server/services/founderSubMonthlyBonus/run.ts`
- **Hooks:** pre(save) ×5, pre(findOneAndReplace) ×1, pre(findOneAndUpdate) ×1, pre(replaceOne) ×1, pre(update) ×1, pre(updateOne) ×1, pre(updateMany) ×1, pre(remove) ×1, post(save) ×3, post(init) ×1
- **Statics/methods:** `initializeTimestamps()`

| Field | Type | Ref | Flags |
|---|---|---|---|
| `periodKey` | String |  | required, unique |
| `status` | String |  | index, default "computing", enum ["computing","computed","payi… |
| `dryRun` | Boolean |  | required |
| `snapshotAt` | Date |  | required |
| `startedAt` | Date |  | required |
| `computedAt` | Date |  |  |
| `paidAt` | Date |  |  |
| `totals` | Embedded |  | default fn default |
| `error` | String |  |  |
| `triggeredBy` | String |  |  |
| `_id` | ObjectId |  |  |
| `createdAt` | Date |  |  |
| `updatedAt` | Date |  |  |

**Indexes:** `{"periodKey":1} {"unique":true,"background":true}`; `{"status":1} {"background":true}`; `{"createdAt":-1} {"background":true}`

### FranchiseCountry

- **Collection:** `franchise_countries` · **Area:** Core platform · **Source:** `server/models/franchiseCountry.model.ts` (doc: `server/models/franchiseCountry.model.ts.md`) · **Options:** timestamps=false, strict=false, autoIndex=null, capped=false
- **Used by:** `scripts/test-franchise-e2e.ts`, `server/routes/franchiseApi.ts`, `server/routes/franchiseEntity.ts`, `server/routes/franchiseGlobal.ts`, `server/routes/franchiseProgram.ts`, `server/scripts/backfill-catalog-ownership.ts`, `server/services/franchiseCatalogSync.ts`, `server/utils/entityAccess.ts`, … +2 more
- **Hooks:** pre(save) ×4, pre(remove) ×1, post(save) ×3, post(init) ×1

| Field | Type | Ref | Flags |
|---|---|---|---|
| `_id` | String |  |  |
| `id` | String |  |  |
| `name` | String |  | index |
| `region` | String |  |  |
| `status` | String |  | index |
| `ownerEmail` | String |  |  |
| `territoryIds` | [String] |  |  |

**Indexes:** `{"name":1} {"background":true}`; `{"status":1} {"background":true}`; `{"name":1,"status":1} {"background":true}`

### FranchiseGlobalAssignment

- **Collection:** `franchise_global_assignments` · **Area:** Core platform · **Source:** `server/models/franchiseGlobalAssignment.model.ts` (doc: `server/models/franchiseGlobalAssignment.model.ts.md`) · **Options:** timestamps=true, autoIndex=null, capped=false
- **Referenced by:** `FranchiseGlobalOffer`, `UserNotification`
- **Used by:** `server/routes/franchiseApi.ts`, `server/routes/franchiseGlobal.ts`, `server/routes/franchiseGlobalPublic.ts`, `server/scripts/audit-partial-fanout.ts`, `server/scripts/backfill-catalog-ownership.ts`, `server/scripts/smoke-test-franchise-global.ts`, `server/services/franchiseGlobalOffer.ts`, `server/services/franchiseSubscriptions.ts`, … +4 more
- **Hooks:** pre(save) ×5, pre(findOneAndReplace) ×1, pre(findOneAndUpdate) ×1, pre(replaceOne) ×1, pre(update) ×1, pre(updateOne) ×1, pre(updateMany) ×1, pre(remove) ×1, post(save) ×3, post(init) ×1
- **Statics/methods:** `initializeTimestamps()`

| Field | Type | Ref | Flags |
|---|---|---|---|
| `geoLevel` | String |  | required, enum ["country","territory","subTe… |
| `geoEntityId` | String |  | required, index |
| `geoEntityName` | String |  |  |
| `geoCountry` | String |  |  |
| `geoParentTerritory` | String |  |  |
| `zipCodes` | [String] |  |  |
| `ownerUserId` | ObjectId | `User` | index |
| `ownerEmail` | String |  |  |
| `priceUSD` | Number |  | required |
| `soldByUserId` | ObjectId | `User` |  |
| `listedPriceUSD` | Number |  | default null |
| `listedByUserId` | ObjectId | `User` | index |
| `status` | String |  | index, default "pending_payment", enum ["listed","pending_payment","… |
| `subscription` | Embedded |  | default fn default |
| `pendingReassignment` | Embedded |  | default null |
| `acquisitionType` | String |  | index, default "original", enum ["original","resale"] |
| `acquiredReassignmentId` | ObjectId | `FranchiseReassignment` |  |
| `pendingResaleOffer` | Embedded |  | default null |
| `pendingDirectedSale` | Embedded |  | default null |
| `_id` | ObjectId |  |  |
| `createdAt` | Date |  |  |
| `updatedAt` | Date |  |  |

**Indexes:** `{"geoEntityId":1} {"background":true}`; `{"ownerUserId":1} {"background":true}`; `{"listedByUserId":1} {"background":true}`; `{"status":1} {"background":true}`; `{"acquisitionType":1} {"background":true}`; `{"geoLevel":1,"geoEntityId":1} {"unique":true,"background":true}`; `{"ownerUserId":1,"status":1} {"background":true}`; `{"status":1,"subscription.expiresAt":1} {"background":true}`

### FranchiseGlobalOffer

- **Collection:** `franchise_global_offers` · **Area:** Core platform · **Source:** `server/models/franchiseGlobalOffer.model.ts` (doc: `server/models/franchiseGlobalOffer.model.ts.md`) · **Options:** timestamps=true, autoIndex=null, capped=false
- **Referenced by:** `UserNotification`
- **Used by:** `server/routes/franchiseGlobal.ts`, `server/services/franchiseGlobalOffer.ts`, `server/services/invoice.ts`
- **Hooks:** pre(save) ×5, pre(findOneAndReplace) ×1, pre(findOneAndUpdate) ×1, pre(replaceOne) ×1, pre(update) ×1, pre(updateOne) ×1, pre(updateMany) ×1, pre(remove) ×1, post(save) ×3, post(init) ×1
- **Statics/methods:** `initializeTimestamps()`

| Field | Type | Ref | Flags |
|---|---|---|---|
| `assignmentId` | ObjectId | `FranchiseGlobalAssignment` | required, index |
| `geoLevel` | String |  | required, enum ["country","territory","subTe… |
| `geoEntityId` | String |  | required |
| `geoEntityName` | String |  |  |
| `fromUserId` | ObjectId | `User` | required |
| `fromEmail` | String |  | required |
| `toUserId` | ObjectId | `User` | required |
| `toEmail` | String |  | required |
| `currentPriceUSD` | Number |  | required |
| `offerPriceUSD` | Number |  | required |
| `message` | String |  |  |
| `status` | String |  | index, default "pending", enum ["pending","accepted","reject… |
| `respondedAt` | Date |  |  |
| `expiresAt` | Date |  | required, index |
| `invoiceId` | ObjectId | `Invoice` |  |
| `resolutionTxRefs` | Embedded |  |  |
| `_id` | ObjectId |  |  |
| `createdAt` | Date |  |  |
| `updatedAt` | Date |  |  |

**Indexes:** `{"assignmentId":1} {"background":true}`; `{"status":1} {"background":true}`; `{"expiresAt":1} {"background":true}`; `{"assignmentId":1,"fromUserId":1} {"unique":true,"partialFilterExpression":{"status":"pending"},"background":true}`; `{"toUserId":1,"status":1,"createdAt":-1} {"background":true}`; `{"fromUserId":1,"status":1,"createdAt":-1} {"background":true}`; `{"status":1,"expiresAt":1} {"background":true}`; `{"assignmentId":1,"status":1,"offerPriceUSD":-1} {"background":true}`

### FranchiseOffer

- **Collection:** `franchise_offers` · **Area:** Core platform · **Source:** `server/models/franchiseOffer.model.ts` (doc: `server/models/franchiseOffer.model.ts.md`) · **Options:** timestamps=true, autoIndex=null, capped=false
- **Referenced by:** `UserNotification`
- **Used by:** `server/routes/franchiseProgram.ts`, `server/services/franchiseOffer.ts`, `server/services/invoice.ts`
- **Hooks:** pre(save) ×5, pre(findOneAndReplace) ×1, pre(findOneAndUpdate) ×1, pre(replaceOne) ×1, pre(update) ×1, pre(updateOne) ×1, pre(updateMany) ×1, pre(remove) ×1, post(save) ×3, post(init) ×1
- **Statics/methods:** `initializeTimestamps()`

| Field | Type | Ref | Flags |
|---|---|---|---|
| `assignmentId` | ObjectId | `FranchiseTerritoryAssignment` | required, index |
| `programId` | ObjectId | `FranchiseProgram` | required |
| `officeId` | ObjectId | `Organization` | required |
| `geoLevel` | String |  | required, enum ["country","territory","subTe… |
| `geoEntityId` | String |  | required |
| `geoEntityName` | String |  |  |
| `fromUserId` | ObjectId | `User` | required |
| `fromEmail` | String |  | required |
| `toUserId` | ObjectId | `User` | required |
| `toEmail` | String |  | required |
| `currentPriceUSD` | Number |  | required |
| `offerPriceUSD` | Number |  | required |
| `message` | String |  |  |
| `status` | String |  | index, default "pending", enum ["pending","accepted","reject… |
| `respondedAt` | Date |  |  |
| `expiresAt` | Date |  | required, index |
| `invoiceId` | ObjectId | `Invoice` |  |
| `resolutionTxRefs` | Embedded |  |  |
| `_id` | ObjectId |  |  |
| `createdAt` | Date |  |  |
| `updatedAt` | Date |  |  |

**Indexes:** `{"assignmentId":1} {"background":true}`; `{"status":1} {"background":true}`; `{"expiresAt":1} {"background":true}`; `{"assignmentId":1,"fromUserId":1} {"unique":true,"partialFilterExpression":{"status":"pending"},"background":true}`; `{"toUserId":1,"status":1,"createdAt":-1} {"background":true}`; `{"fromUserId":1,"status":1,"createdAt":-1} {"background":true}`; `{"status":1,"expiresAt":1} {"background":true}`; `{"assignmentId":1,"status":1,"offerPriceUSD":-1} {"background":true}`

### FranchiseProgram

- **Collection:** `franchise_programs` · **Area:** Core platform · **Source:** `server/models/franchiseProgram.model.ts` (doc: `server/models/franchiseProgram.model.ts.md`) · **Options:** timestamps=true, autoIndex=null, capped=false
- **Referenced by:** `FranchiseOffer`, `FranchiseReassignment`, `FranchiseTerritoryAssignment`, `TerritoryWalletTransaction`
- **Used by:** `scripts/test-franchise-e2e.ts`, `server/routes/franchiseGlobal.ts`, `server/routes/franchiseProgram.ts`, `server/routes/orgCustomers.ts`, `server/scripts/reconcile-franchise-floor-credits.ts`, `server/services/franchiseGlobalOffer.ts`, `server/services/franchiseOffer.ts`, `server/services/franchiseProgramCommission.ts`, … +2 more
- **Hooks:** pre(save) ×5, pre(findOneAndReplace) ×1, pre(findOneAndUpdate) ×1, pre(replaceOne) ×1, pre(update) ×1, pre(updateOne) ×1, pre(updateMany) ×1, pre(remove) ×1, post(save) ×3, post(init) ×1
- **Statics/methods:** `initializeTimestamps()`

| Field | Type | Ref | Flags |
|---|---|---|---|
| `officeId` | ObjectId | `Organization` | required, unique, index |
| `founderUserId` | ObjectId | `User` | required, index |
| `currency` | String |  | default "USD" |
| `status` | String |  | index, default "pending_payment", enum ["pending_payment","active","… |
| `commissionConfig` | Embedded |  | default fn default |
| `subscription` | Embedded |  | default fn default |
| `_id` | ObjectId |  |  |
| `createdAt` | Date |  |  |
| `updatedAt` | Date |  |  |

**Indexes:** `{"officeId":1} {"unique":true,"background":true}`; `{"founderUserId":1} {"background":true}`; `{"status":1} {"background":true}`

### FranchiseReassignment

- **Collection:** `franchise_reassignments` · **Area:** Core platform · **Source:** `server/models/franchiseReassignment.model.ts` (doc: `server/models/franchiseReassignment.model.ts.md`) · **Options:** timestamps=true, autoIndex=null, capped=false
- **Referenced by:** `FranchiseGlobalAssignment`, `FranchiseTerritoryAssignment`
- **Used by:** `server/routes/franchiseProgram.ts`, `server/services/invoice.ts`
- **Hooks:** pre(save) ×5, pre(findOneAndReplace) ×1, pre(findOneAndUpdate) ×1, pre(replaceOne) ×1, pre(update) ×1, pre(updateOne) ×1, pre(updateMany) ×1, pre(remove) ×1, post(save) ×3, post(init) ×1
- **Statics/methods:** `initializeTimestamps()`

| Field | Type | Ref | Flags |
|---|---|---|---|
| `programId` | ObjectId | `FranchiseProgram` | required, index |
| `officeId` | ObjectId | `Organization` | required, index |
| `assignmentId` | ObjectId | `FranchiseTerritoryAssignment` | required, index |
| `geoLevel` | String |  | required |
| `geoEntityId` | String |  | required, index |
| `geoEntityName` | String |  |  |
| `resellerUserId` | ObjectId | `User` | required, index |
| `resellerEmail` | String |  |  |
| `fromOwnerUserId` | ObjectId | `User` | required |
| `fromOwnerEmail` | String |  |  |
| `newOwnerUserId` | ObjectId | `User` | required, index |
| `newOwnerEmail` | String |  | required |
| `resalePriceUSD` | Number |  | required |
| `status` | String |  | required, index, default "pending_approval", enum ["pending_approval","approved… |
| `invoiceId` | ObjectId | `Invoice` |  |
| `requestedAt` | Date |  | required |
| `decidedAt` | Date |  |  |
| `completedAt` | Date |  |  |
| `_id` | ObjectId |  |  |
| `createdAt` | Date |  |  |
| `updatedAt` | Date |  |  |

**Indexes:** `{"programId":1} {"background":true}`; `{"officeId":1} {"background":true}`; `{"assignmentId":1} {"background":true}`; `{"geoEntityId":1} {"background":true}`; `{"resellerUserId":1} {"background":true}`; `{"newOwnerUserId":1} {"background":true}`; `{"status":1} {"background":true}`; `{"programId":1,"createdAt":-1} {"background":true}`; `{"programId":1,"status":1,"createdAt":-1} {"background":true}`; `{"resellerUserId":1,"createdAt":-1} {"background":true}`; `{"newOwnerUserId":1,"createdAt":-1} {"background":true}`

### FranchiseSubTerritory

- **Collection:** `franchise_sub_territories` · **Area:** Core platform · **Source:** `server/models/franchiseSubTerritory.model.ts` (doc: `server/models/franchiseSubTerritory.model.ts.md`) · **Options:** timestamps=false, strict=false, autoIndex=null, capped=false
- **Used by:** `scripts/test-franchise-e2e.ts`, `server/routes/franchiseApi.ts`, `server/routes/franchiseEntity.ts`, `server/routes/franchiseGlobal.ts`, `server/routes/franchiseProgram.ts`, `server/scripts/backfill-catalog-ownership.ts`, `server/scripts/smoke-test-franchise-global.ts`, `server/services/franchiseCatalogSync.ts`, … +3 more
- **Hooks:** pre(save) ×4, pre(remove) ×1, post(save) ×3, post(init) ×1

| Field | Type | Ref | Flags |
|---|---|---|---|
| `_id` | String |  |  |
| `externalKey` | String |  |  |
| `id` | String |  |  |
| `country` | String |  | index |
| `parentTerritory` | String |  | index |
| `name` | String |  | index |
| `region` | String |  |  |
| `status` | String |  | index |
| `ownerEmail` | String |  |  |
| `parentId` | String |  |  |
| `parentTerritoryId` | String |  |  |
| `zipCodes` | [String] |  | index |

**Indexes:** `{"country":1} {"background":true}`; `{"parentTerritory":1} {"background":true}`; `{"name":1} {"background":true}`; `{"status":1} {"background":true}`; `{"zipCodes":1} {"background":true}`; `{"zipCodes":1,"status":1} {"background":true}`; `{"country":1,"parentTerritory":1,"name":1} {"background":true}`

### FranchiseTerritory

- **Collection:** `franchise_territorymasters` · **Area:** Core platform · **Source:** `server/models/franchiseTerritory.model.ts` (doc: `server/models/franchiseTerritory.model.ts.md`) · **Options:** timestamps=false, strict=false, autoIndex=null, capped=false
- **Used by:** `scripts/test-franchise-e2e.ts`, `server/routes/franchiseApi.ts`, `server/routes/franchiseEntity.ts`, `server/routes/franchiseGlobal.ts`, `server/routes/franchiseProgram.ts`, `server/scripts/backfill-catalog-ownership.ts`, `server/services/franchiseCatalogSync.ts`, `server/utils/entityAccess.ts`, … +2 more
- **Hooks:** pre(save) ×4, pre(remove) ×1, post(save) ×3, post(init) ×1

| Field | Type | Ref | Flags |
|---|---|---|---|
| `_id` | String |  |  |
| `externalKey` | String |  |  |
| `id` | String |  |  |
| `country` | String |  | index |
| `name` | String |  | index |
| `region` | String |  |  |
| `status` | String |  | index |
| `ownerEmail` | String |  |  |
| `parentId` | String |  |  |
| `hasSubTerritories` | Boolean |  |  |
| `subTerritoryIds` | [String] |  |  |

**Indexes:** `{"country":1} {"background":true}`; `{"name":1} {"background":true}`; `{"status":1} {"background":true}`; `{"country":1,"name":1} {"background":true}`; `{"country":1,"status":1} {"background":true}`

### FranchiseTerritoryAssignment

- **Collection:** `franchise_territory_assignments` · **Area:** Core platform · **Source:** `server/models/franchiseTerritoryAssignment.model.ts` (doc: `server/models/franchiseTerritoryAssignment.model.ts.md`) · **Options:** timestamps=true, autoIndex=null, capped=false
- **Referenced by:** `FranchiseOffer`, `FranchiseReassignment`, `TerritoryWalletTransaction`, `UserNotification`
- **Used by:** `scripts/test-franchise-e2e.ts`, `server/routes/franchiseApi.ts`, `server/routes/franchiseProgram.ts`, `server/services/franchiseChainPlan.ts`, `server/services/franchiseOffer.ts`, `server/services/franchiseProgramCommission.ts`, `server/services/franchiseSubscriptions.ts`, `server/services/invoice.ts`, … +2 more
- **Hooks:** pre(save) ×5, pre(findOneAndReplace) ×1, pre(findOneAndUpdate) ×1, pre(replaceOne) ×1, pre(update) ×1, pre(updateOne) ×1, pre(updateMany) ×1, pre(remove) ×1, post(save) ×3, post(init) ×1
- **Statics/methods:** `initializeTimestamps()`

| Field | Type | Ref | Flags |
|---|---|---|---|
| `programId` | ObjectId | `FranchiseProgram` | required, index |
| `officeId` | ObjectId | `Organization` | required, index |
| `geoLevel` | String |  | required, enum ["country","territory","subTe… |
| `geoEntityId` | String |  | required, index |
| `geoEntityName` | String |  |  |
| `geoCountry` | String |  |  |
| `geoParentTerritory` | String |  |  |
| `zipCodes` | [String] |  |  |
| `ownerUserId` | ObjectId | `User` | index |
| `ownerEmail` | String |  |  |
| `priceUSD` | Number |  | required |
| `assignedByUserId` | ObjectId | `User` | required |
| `status` | String |  | index, default "pending_payment", enum ["listed","pending_payment","… |
| `subscription` | Embedded |  | default fn default |
| `pendingReassignment` | Embedded |  | default null |
| `acquisitionType` | String |  | index, default "original", enum ["original","resale"] |
| `acquiredReassignmentId` | ObjectId | `FranchiseReassignment` |  |
| `pendingResaleOffer` | Embedded |  | default null |
| `_id` | ObjectId |  |  |
| `createdAt` | Date |  |  |
| `updatedAt` | Date |  |  |

**Indexes:** `{"programId":1} {"background":true}`; `{"officeId":1} {"background":true}`; `{"geoEntityId":1} {"background":true}`; `{"ownerUserId":1} {"background":true}`; `{"status":1} {"background":true}`; `{"acquisitionType":1} {"background":true}`; `{"programId":1,"geoLevel":1,"geoEntityId":1} {"unique":true,"background":true}`; `{"programId":1,"status":1} {"background":true}`; `{"ownerUserId":1,"status":1} {"background":true}`

### FxRateSnapshot

- **Collection:** `fxratesnapshots` · **Area:** Core platform · **Source:** `server/models/fxRateSnapshot.model.ts` (doc: `server/models/fxRateSnapshot.model.ts.md`) · **Options:** timestamps=true, autoIndex=null, capped=false
- **Used by:** `server/fx/fxService.ts`
- **Hooks:** pre(save) ×5, pre(findOneAndReplace) ×1, pre(findOneAndUpdate) ×1, pre(replaceOne) ×1, pre(update) ×1, pre(updateOne) ×1, pre(updateMany) ×1, pre(remove) ×1, post(save) ×3, post(init) ×1
- **Statics/methods:** `initializeTimestamps()`

| Field | Type | Ref | Flags |
|---|---|---|---|
| `base` | String |  | required, default "USD" |
| `rates` | Map |  | required |
| `rates.$*` | Number |  |  |
| `fetchedAt` | Date |  | required, index |
| `source` | String |  | required, enum ["live","cached-alt","fallbac… |
| `provider` | String |  | required |
| `_id` | ObjectId |  |  |
| `createdAt` | Date |  |  |
| `updatedAt` | Date |  |  |

**Indexes:** `{"fetchedAt":1} {"background":true}`; `{"fetchedAt":-1} {"background":true}`

### GarageAdmin

- **Collection:** `garageadmins` · **Area:** Core platform · **Source:** `server/models/garageAdmin.model.ts` (doc: `server/models/garageAdmin.model.ts.md`) · **Options:** timestamps=true, autoIndex=null, capped=false
- **Referenced by:** `AIProviderKey`, `AdminNotificationRule`, `Announcement`, `CoworkingSpace`, `CoworkingSpaceBooking`, `GarageAdmin`, `GarageAdminRole`, `IgniteCall`, `OrgCategory`, `OrgKyc`, `Organization`, `OtpCodeAccessLog`, `ReferralBonusConfig`, `Ticket`, `User`, `Withdrawal`
- **Used by:** `server/controllers/garageAdmin.controller.ts`, `server/middleware/garageAdminAuth.ts`, `server/middleware/userOrGarageAdmin.ts`, `server/routes/auth.ts`, `server/routes/garageAdmin.ts`, `server/routes/garageAdminIgniteCall.ts`, `server/routes/garageAdminNetworkChainSubs.ts`, `server/routes/garageAdminOneTimeAffiliates.ts`, … +12 more
- **Hooks:** pre(save) ×5, pre(findOneAndReplace) ×1, pre(findOneAndUpdate) ×1, pre(replaceOne) ×1, pre(update) ×1, pre(updateOne) ×1, pre(updateMany) ×1, pre(remove) ×1, post(save) ×3, post(init) ×1
- **Statics/methods:** `initializeTimestamps()`

| Field | Type | Ref | Flags |
|---|---|---|---|
| `email` | String |  | required, unique |
| `name` | String |  | required |
| `role` | String |  | default "garage-admin" |
| `pagePermissions` | Embedded |  | default fn default |
| `pagePermissionsSet` | Boolean |  | default false |
| `isActive` | Boolean |  | default true |
| `profilePicture` | String |  |  |
| `invitedBy` | ObjectId | `GarageAdmin` |  |
| `invitedAt` | Date |  | default fn now |
| `lastLoginAt` | Date |  |  |
| `sessionsInvalidatedAt` | Date |  |  |
| `verification` | Embedded |  |  |
| `_id` | ObjectId |  |  |
| `createdAt` | Date |  |  |
| `updatedAt` | Date |  |  |

**Indexes:** `{"email":1} {"unique":true,"background":true}`; `{"email":1} {"unique":true,"background":true}`

### GarageAdminRole

- **Collection:** `garageadminroles` · **Area:** Core platform · **Source:** `server/models/garageAdminRole.model.ts` (doc: `server/models/garageAdminRole.model.ts.md`) · **Options:** timestamps=true, autoIndex=null, capped=false
- **Used by:** `server/controllers/garageAdmin.controller.ts`
- **Hooks:** pre(save) ×5, pre(findOneAndReplace) ×1, pre(findOneAndUpdate) ×1, pre(replaceOne) ×1, pre(update) ×1, pre(updateOne) ×1, pre(updateMany) ×1, pre(remove) ×1, post(save) ×3, post(init) ×1
- **Statics/methods:** `initializeTimestamps()`

| Field | Type | Ref | Flags |
|---|---|---|---|
| `name` | String |  | required |
| `nameLower` | String |  | required |
| `permissions` | Embedded |  | default fn default |
| `createdBy` | ObjectId | `GarageAdmin` |  |
| `_id` | ObjectId |  |  |
| `createdAt` | Date |  |  |
| `updatedAt` | Date |  |  |

**Indexes:** `{"nameLower":1} {"unique":true,"background":true}`

### GarageUniversityOnboarding

- **Collection:** `garageuniversity_onboarding_profiles` · **Area:** Core platform · **Source:** `server/models/garageUniversityOnboarding.model.ts` (doc: `server/models/garageUniversityOnboarding.model.ts.md`) · **Options:** timestamps=true, autoIndex=null, capped=false
- **Used by:** `server/services/garageUniversityOnboarding.service.ts`
- **Hooks:** pre(save) ×5, pre(findOneAndReplace) ×1, pre(findOneAndUpdate) ×1, pre(replaceOne) ×1, pre(update) ×1, pre(updateOne) ×1, pre(updateMany) ×1, pre(remove) ×1, post(save) ×3, post(init) ×1
- **Statics/methods:** `initializeTimestamps()`

| Field | Type | Ref | Flags |
|---|---|---|---|
| `userId` | ObjectId | `User` | required |
| `orgId` | ObjectId | `Organization` | default null |
| `email` | String |  | default "" |
| `name` | String |  | default "" |
| `step` | Number |  | default 0 |
| `interests` | [String] |  | default [] |
| `goal` | String |  | default "" |
| `topics` | [String] |  | default [] |
| `status` | String |  | default null |
| `details` | Map |  | default {} |
| `details.$*` | String |  |  |
| `idCard` | Embedded |  | default null |
| `photo` | String |  | default null |
| `headline` | String |  | default "" |
| `location` | String |  | default "" |
| `workModes` | [String] |  | default [] |
| `resume` | Embedded |  | default null |
| `completed` | Boolean |  | default false |
| `completedAt` | Date |  | default null |
| `_id` | ObjectId |  |  |
| `createdAt` | Date |  |  |
| `updatedAt` | Date |  |  |

**Indexes:** `{"userId":1} {"unique":true,"name":"userId_unique","background":true}`

### GenealogySnapshot

- **Collection:** `genealogysnapshots` · **Area:** Core platform · **Source:** `server/models/genealogySnapshot.model.ts` (doc: `server/models/genealogySnapshot.model.ts.md`) · **Options:** timestamps=true, autoIndex=null, capped=false
- **Used by:** `server/routes/genealogy.ts`, `server/services/genealogy/snapshot.ts`
- **Hooks:** pre(save) ×5, pre(findOneAndReplace) ×1, pre(findOneAndUpdate) ×1, pre(replaceOne) ×1, pre(update) ×1, pre(updateOne) ×1, pre(updateMany) ×1, pre(remove) ×1, post(save) ×3, post(init) ×1
- **Statics/methods:** `initializeTimestamps()`

| Field | Type | Ref | Flags |
|---|---|---|---|
| `periodKey` | String |  | required |
| `userId` | ObjectId | `User` | required |
| `nc` | String |  | required, enum ["active","lapsed","never"] |
| `qualified` | Boolean |  | default false |
| `volumeUsd` | Number |  | default 0 |
| `_id` | ObjectId |  |  |
| `createdAt` | Date |  |  |
| `updatedAt` | Date |  |  |

**Indexes:** `{"periodKey":1,"userId":1} {"unique":true,"background":true}`

### GenealogySnapshotRun

- **Collection:** `genealogysnapshotruns` · **Area:** Core platform · **Source:** `server/models/genealogySnapshot.model.ts` (doc: `server/models/genealogySnapshot.model.ts.md`) · **Options:** timestamps=true, autoIndex=null, capped=false
- **Used by:** `server/routes/genealogy.ts`, `server/services/genealogy/snapshot.ts`
- **Hooks:** pre(save) ×5, pre(findOneAndReplace) ×1, pre(findOneAndUpdate) ×1, pre(replaceOne) ×1, pre(update) ×1, pre(updateOne) ×1, pre(updateMany) ×1, pre(remove) ×1, post(save) ×3, post(init) ×1
- **Statics/methods:** `initializeTimestamps()`

| Field | Type | Ref | Flags |
|---|---|---|---|
| `periodKey` | String |  | required, unique |
| `status` | String |  | default "running", enum ["running","completed"] |
| `users` | Number |  | default 0 |
| `completedAt` | Date |  | default null |
| `_id` | ObjectId |  |  |
| `createdAt` | Date |  |  |
| `updatedAt` | Date |  |  |

**Indexes:** `{"periodKey":1} {"unique":true,"background":true}`

### GlobalMessage

- **Collection:** `globalmessages` · **Area:** Core platform · **Source:** `server/models/globalMessage.model.ts` (doc: `server/models/globalMessage.model.ts.md`) · **Options:** timestamps=true, autoIndex=null, capped=false
- **Referenced by:** `GlobalMessage`
- **Used by:** `server/realtime/socket.ts`, `server/routes/globalDm.ts`
- **Hooks:** pre(save) ×5, pre(findOneAndReplace) ×1, pre(findOneAndUpdate) ×1, pre(replaceOne) ×1, pre(update) ×1, pre(updateOne) ×1, pre(updateMany) ×1, pre(remove) ×1, post(save) ×3, post(init) ×1
- **Statics/methods:** `initializeTimestamps()`

| Field | Type | Ref | Flags |
|---|---|---|---|
| `convId` | String |  | index |
| `from` | ObjectId | `User` | required, index |
| `to` | ObjectId | `User` | required, index |
| `text` | String |  |  |
| `attachments` | [subdoc] |  |  |
| `replyTo` | ObjectId | `GlobalMessage` | default null |
| `editedAt` | Date |  | default null |
| `readAt` | Date |  | default null |
| `reactions` | Map |  | default fn default |
| `reactions.$*` | [String] |  |  |
| `clientMsgId` | String |  |  |
| `_id` | ObjectId |  |  |
| `createdAt` | Date |  |  |
| `updatedAt` | Date |  |  |

**Indexes:** `{"convId":1} {"background":true}`; `{"from":1} {"background":true}`; `{"to":1} {"background":true}`; `{"convId":1,"createdAt":-1} {"background":true}`; `{"from":1,"clientMsgId":1} {"unique":true,"partialFilterExpression":{"clientMsgId":{"$type":"string"}},"background":true}`

### Group

- **Collection:** `groups` · **Area:** Core platform · **Source:** `server/models/group.model.ts` (doc: `server/models/group.model.ts.md`) · **Options:** timestamps=true, autoIndex=null, capped=false
- **Referenced by:** `GroupAiTask`, `GroupMessage`, `SupportTaskAssignment`, `Ticket`, `UserNotification`
- **Used by:** `server/index.ts`, `server/realtime/socket.ts`, `server/routes/chat.ts`, `server/routes/garageAdminSupportChats.ts`, `server/routes/groups.ts`, `server/scripts/backfill-support-chats.ts`, `server/scripts/fix-groups-invite-index.ts`, `server/services/__tests__/groupTaskroom.test.ts`, … +10 more
- **Hooks:** pre(save) ×5, pre(findOneAndReplace) ×1, pre(findOneAndUpdate) ×1, pre(replaceOne) ×1, pre(update) ×1, pre(updateOne) ×1, pre(updateMany) ×1, pre(remove) ×1, post(save) ×3, post(init) ×1
- **Statics/methods:** `initializeTimestamps()`

| Field | Type | Ref | Flags |
|---|---|---|---|
| `name` | String |  | required |
| `description` | String |  | default null |
| `createdBy` | ObjectId | `User` | required |
| `members` | [subdoc] |  | default [] |
| `agentMembers` | [String] |  | default [] |
| `picture` | String |  | default null |
| `orgId` | ObjectId | `Organization` | required |
| `broadcastOnly` | Boolean |  | default false |
| `adminOnlyFiles` | Boolean |  | default false |
| `messageRetentionDays` | Number |  | default 0 |
| `inviteCode` | String |  |  |
| `inviteExpiry` | Date |  |  |
| `kind` | String |  | enum ["support"] |
| `supportUserId` | ObjectId | `User` |  |
| `supportUplineId` | ObjectId | `User` |  |
| `supportAgentUserId` | ObjectId | `User` |  |
| `supportLastMessage` | Embedded |  |  |
| `supportActivityAt` | Date |  |  |
| `taskroom` | Embedded |  |  |
| `supportTaskroomOwn` | Boolean |  |  |
| `_id` | ObjectId |  |  |
| `createdAt` | Date |  |  |
| `updatedAt` | Date |  |  |

**Indexes:** `{"members.userId":1} {"background":true}`; `{"orgId":1} {"background":true}`; `{"supportUserId":1} {"unique":true,"partialFilterExpression":{"kind":"support"},"background":true}`; `{"kind":1,"supportActivityAt":-1} {"background":true}`; `{"inviteCode":1} {"unique":true,"partialFilterExpression":{"inviteCode":{"$type":"string"}},"background":true}`

### GroupAiTask

- **Collection:** `groupaitasks` · **Area:** Core platform · **Source:** `server/models/groupAiTask.model.ts` (doc: `server/models/groupAiTask.model.ts.md`) · **Options:** timestamps={"createdAt":true,"updatedAt"…, autoIndex=null, capped=false
- **Used by:** `server/services/groupTaskAuto.ts`, `server/services/groupTaskManual.ts`, `server/services/groupTaskRemoval.ts`, `server/services/supportChatTaskroom.ts`, `server/services/supportTicketSuggest.ts`
- **Hooks:** pre(save) ×5, pre(findOneAndReplace) ×1, pre(findOneAndUpdate) ×1, pre(replaceOne) ×1, pre(update) ×1, pre(updateOne) ×1, pre(updateMany) ×1, pre(remove) ×1, post(save) ×3, post(init) ×1
- **Statics/methods:** `initializeTimestamps()`

| Field | Type | Ref | Flags |
|---|---|---|---|
| `groupId` | ObjectId | `Group` | required |
| `orgId` | ObjectId | `Organization` |  |
| `messageId` | ObjectId | `GroupMessage` | required |
| `itemIndex` | Number |  | default 0 |
| `sourceMessageIds` | [ObjectId] | `GroupMessage` |  |
| `fromUserId` | ObjectId | `User` |  |
| `taskroomTaskId` | String |  | required |
| `roomId` | String |  |  |
| `priority` | String |  |  |
| `confidence` | Number |  |  |
| `title` | String |  |  |
| `attachmentCount` | Number |  | default 0 |
| `source` | String |  | default "ai" |
| `_id` | ObjectId |  |  |
| `createdAt` | Date |  |  |

**Indexes:** `{"messageId":1,"itemIndex":1} {"unique":true,"background":true}`; `{"groupId":1,"createdAt":-1} {"background":true}`; `{"groupId":1,"fromUserId":1,"createdAt":-1} {"background":true}`; `{"taskroomTaskId":1} {"background":true}`; `{"sourceMessageIds":1} {"background":true}`

### GroupMessage

- **Collection:** `groupmessages` · **Area:** Core platform · **Source:** `server/models/groupMessage.model.ts` (doc: `server/models/groupMessage.model.ts.md`) · **Options:** timestamps={"createdAt":true,"updatedAt"…, autoIndex=null, capped=false
- **Referenced by:** `GroupAiTask`, `GroupMessage`, `MessageTranslation`, `Ticket`
- **Used by:** `server/index.ts`, `server/realtime/socket.ts`, `server/routes/chat.ts`, `server/routes/garageAdminSupportChats.ts`, `server/routes/groups.ts`, `server/scripts/migrate-to-public-urls.ts`, `server/services/groupSystemMessage.ts`, `server/services/groupTaskAuto.ts`, … +5 more
- **Hooks:** pre(save) ×5, pre(findOneAndReplace) ×1, pre(findOneAndUpdate) ×1, pre(replaceOne) ×1, pre(update) ×1, pre(updateOne) ×1, pre(updateMany) ×1, pre(remove) ×1, post(save) ×3, post(init) ×1
- **Statics/methods:** `initializeTimestamps()`

| Field | Type | Ref | Flags |
|---|---|---|---|
| `groupId` | ObjectId | `Group` | required, index |
| `from` | ObjectId | `User` |  |
| `text` | String |  |  |
| `type` | String |  | enum ["system"] |
| `event` | String |  | enum ["group_created","member_adde… |
| `actorId` | ObjectId | `User` |  |
| `targetIds` | [ObjectId] | `User` |  |
| `taskroom` | Embedded |  |  |
| `aiTasks` | [subdoc] |  |  |
| `attachments` | [subdoc] |  |  |
| `mentions` | [ObjectId] | `User` |  |
| `replyTo` | ObjectId | `GroupMessage` | default null |
| `agentMeta.agentId` | String |  |  |
| `agentMeta.agentName` | String |  |  |
| `editedAt` | Date |  | default null |
| `readAt` | Date |  | default null |
| `deletedAt` | Date |  | default null |
| `reactions` | Map |  | default fn default |
| `reactions.$*` | [String] |  |  |
| `threadId` | ObjectId | `GroupMessage` | index, default null |
| `threadResolved` | Boolean |  | default false |
| `replyCount` | Number |  | default 0 |
| `lastThreadReply.text` | String |  | default null |
| `lastThreadReply.from` | ObjectId | `User` | default null |
| `lastThreadReply.createdAt` | Date |  | default null |
| `threadParticipants` | [ObjectId] | `User` |  |
| `clientMsgId` | String |  |  |
| `_id` | ObjectId |  |  |
| `createdAt` | Date |  |  |

**Indexes:** `{"groupId":1} {"background":true}`; `{"threadId":1} {"background":true}`; `{"groupId":1,"createdAt":-1} {"background":true}`; `{"from":1,"clientMsgId":1} {"unique":true,"partialFilterExpression":{"clientMsgId":{"$type":"string"}},"background":true}`

### IgniteCall

- **Collection:** `ignitecalls` · **Area:** Core platform · **Source:** `server/models/igniteCall.model.ts` (doc: `server/models/igniteCall.model.ts.md`) · **Options:** timestamps=true, autoIndex=null, capped=false
- **Used by:** `server/routes/garageAdminIgniteCall.ts`, `server/routes/garageAdminOneTimeAffiliates.ts`
- **Hooks:** pre(save) ×5, pre(findOneAndReplace) ×1, pre(findOneAndUpdate) ×1, pre(replaceOne) ×1, pre(update) ×1, pre(updateOne) ×1, pre(updateMany) ×1, pre(remove) ×1, post(save) ×3, post(init) ×1
- **Statics/methods:** `initializeTimestamps()`

| Field | Type | Ref | Flags |
|---|---|---|---|
| `userId` | ObjectId | `User` | required |
| `adminId` | ObjectId | `GarageAdmin` | required |
| `ncHostUserId` | String |  | required |
| `ncScheduleId` | String |  | required |
| `ncRoomId` | String |  | required |
| `title` | String |  | required |
| `scheduledAt` | Date |  | required |
| `detachedAt` | Date |  | default null |
| `manuallyCompletedAt` | Date |  | default null |
| `manuallyCompletedBy` | ObjectId | `GarageAdmin` |  |
| `createdBy` | ObjectId | `GarageAdmin` |  |
| `_id` | ObjectId |  |  |
| `createdAt` | Date |  |  |
| `updatedAt` | Date |  |  |

**Indexes:** `{"userId":1,"detachedAt":1,"scheduledAt":-1} {"background":true}`; `{"userId":1,"ncScheduleId":1} {"unique":true,"background":true}`

### InstallIntent

- **Collection:** `installintents` · **Area:** Core platform · **Source:** `server/models/installIntent.model.ts` (doc: `server/models/installIntent.model.ts.md`) · **Options:** timestamps=true, autoIndex=null, capped=false
- **Used by:** `server/routes/public.ts`, `server/services/__tests__/installIntent.test.ts`, `server/services/installIntent.ts`
- **Hooks:** pre(save) ×5, pre(findOneAndReplace) ×1, pre(findOneAndUpdate) ×1, pre(replaceOne) ×1, pre(update) ×1, pre(updateOne) ×1, pre(updateMany) ×1, pre(remove) ×1, post(save) ×3, post(init) ×1
- **Statics/methods:** `initializeTimestamps()`

| Field | Type | Ref | Flags |
|---|---|---|---|
| `link` | String |  | required |
| `affiliateId` | String |  | default null |
| `app` | String |  | default "store", enum ["store","hq","nc","pay"] |
| `platform` | String |  | required, enum ["ios","android"] |
| `ipHash` | String |  | required |
| `userAgent` | String |  | default "" |
| `osVersion` | String |  | default null |
| `screen` | String |  | default null |
| `timezone` | String |  | default null |
| `locale` | String |  | default null |
| `claimedAt` | Date |  | default null |
| `claimerKey` | String |  | default null |
| `_id` | ObjectId |  |  |
| `createdAt` | Date |  |  |
| `updatedAt` | Date |  |  |

**Indexes:** `{"ipHash":1,"platform":1,"app":1,"claimedAt":1,"createdAt":-1} {"name":"install_intent_claim_lookup_v2","background":true}`; `{"createdAt":1} {"expireAfterSeconds":10800,"name":"install_intent_ttl_3h","background":true}`

### Invite

- **Collection:** `invites` · **Area:** Core platform · **Source:** `server/models/invite.model.ts` (doc: `server/models/invite.model.ts.md`) · **Options:** timestamps=true, autoIndex=null, capped=false
- **Used by:** `server/routes/floor.ts`, `server/routes/invites.ts`, `server/routes/joinRequests.ts`, `server/routes/teamforce/employees.ts`
- **Hooks:** pre(save) ×5, pre(findOneAndReplace) ×1, pre(findOneAndUpdate) ×1, pre(replaceOne) ×1, pre(update) ×1, pre(updateOne) ×1, pre(updateMany) ×1, pre(remove) ×1, post(save) ×3, post(init) ×1
- **Statics/methods:** `initializeTimestamps()`

| Field | Type | Ref | Flags |
|---|---|---|---|
| `orgId` | ObjectId | `Organization` | required |
| `email` | String |  | required, index |
| `role` | String |  | default "stakeholder", enum ["admin","user","founder","st… |
| `name` | String |  |  |
| `floorId` | ObjectId |  |  |
| `department` | String |  |  |
| `status` | String |  | index, default "pending", enum ["pending","accepted","revoke… |
| `_id` | ObjectId |  |  |
| `createdAt` | Date |  |  |
| `updatedAt` | Date |  |  |

**Indexes:** `{"email":1} {"background":true}`; `{"status":1} {"background":true}`; `{"orgId":1,"email":1} {"unique":true,"background":true}`

### Invoice

- **Collection:** `invoices` · **Area:** Core platform · **Source:** `server/models/invoice.model.ts` (doc: `server/models/invoice.model.ts.md`) · **Options:** timestamps=true, autoIndex=null, capped=false
- **Referenced by:** `AuctionSettlement`, `BondHolding`, `CashbackDistribution`, `ChannelMembershipEvent`, `CryptoPaymentRequest`, `EventRegistration`, `FranchiseGlobalOffer`, `FranchiseOffer`, `FranchiseReassignment`, `Invoice`, `ItemReserveLicense`, `MagicLink`, `PlatformCouponRedemption`, `ReserveLicense`, `StoreCouponCommissionFire`, `UserNotification`, `bat246B2CoinProductPurchases`, `bat246SnapBackLoans`
- **Used by:** `scripts/mint-synthetic-combo.ts`, `server/bat246/controllers/bat246.controller.ts`, `server/bat246/routes/bat246.routes.ts`, `server/bat246/services/bat246.service.ts`, `server/bat246/services/bat246PodInvite.service.ts`, `server/controllers/garageAdmin.controller.ts`, `server/index.ts`, `server/realtime/mediasoupHandlers.ts`, … +111 more
- **Hooks:** pre(save) ×5, pre(findOneAndReplace) ×1, pre(findOneAndUpdate) ×1, pre(replaceOne) ×1, pre(update) ×1, pre(updateOne) ×1, pre(updateMany) ×1, pre(remove) ×1, post(save) ×3, post(init) ×1
- **Statics/methods:** `initializeTimestamps()`

| Field | Type | Ref | Flags |
|---|---|---|---|
| `invoiceNumber` | String |  | unique, default fn default |
| `invoiceType` | String |  | required, enum ["one_time","recurring"] |
| `status` | String |  | index, default "draft", enum ["draft","pending","paid","fa… |
| `organizationId` | ObjectId | `Organization` | required, index |
| `sellerId` | ObjectId | `User` | required, index |
| `userId` | ObjectId | `User` | required, index |
| `customerEmail` | String |  | required |
| `customerName` | String |  |  |
| `lineItems` | [subdoc] |  | required |
| `subtotal` | Number |  | required |
| `discount` | Number |  | default 0 |
| `tax` | Number |  | default 0 |
| `shippingCost` | Number |  | default 0 |
| `totalAmount` | Number |  | required |
| `itemCurrency` | String |  | required, enum ["USD","INR"] |
| `paymentCurrency` | String |  | enum ["USD","INR","CAD","EUR","GBP… |
| `currencyConversion` | Embedded |  |  |
| `paymentMethodCategory` | String |  | enum ["card","upi","crypto","walle… |
| `paymentPlatform` | String |  | enum ["razorpay","stripe","openmon… |
| `paymentSource` | String |  | default "web", enum ["web","ios","android"] |
| `razorpayOrderId` | String |  |  |
| `razorpayPaymentId` | String |  |  |
| `razorpaySubscriptionId` | String |  |  |
| `razorpayInvoiceId` | String |  |  |
| `invoiceShortUrl` | String |  |  |
| `paidAt` | Date |  |  |
| `failedAt` | Date |  |  |
| `cancelledAt` | Date |  |  |
| `refundedAt` | Date |  |  |
| `expiresAt` | Date |  |  |
| `isRecurring` | Boolean |  | default false |
| `recurringPeriod` | String |  | enum ["weekly","monthly","quarterl… |
| `recurringIntervalMonths` | Number |  |  |
| `recurringPaymentNumber` | Number |  |  |
| `parentInvoiceId` | ObjectId | `Invoice` |  |
| `subscriptionRef` | ObjectId | `Subscription` |  |
| `nextDueDate` | Date |  |  |
| `couponId` | ObjectId | `Coupon` |  |
| `couponCode` | String |  |  |
| `couponUsageId` | ObjectId | `CouponUsage` |  |
| `cashbackCodeId` | ObjectId | `CashbackCode` | index |
| `shippingAddress` | Embedded |  |  |
| `billingAddress` | Embedded |  |  |
| `paymentMode` | String |  | enum ["Prepaid","COD"] |
| `gstin` | String |  |  |
| `companyName` | String |  |  |
| `customerNote` | String |  |  |
| `referralId` | String |  |  |
| `metadata` | Mixed |  |  |
| `notes` | String |  |  |
| `commissionDistributed` | Boolean |  | default false |
| `commissionDistributionId` | ObjectId | `CommissionDistribution` |  |
| `errorCode` | String |  |  |
| `errorDescription` | String |  |  |
| `thirdPartyClientId` | ObjectId | `ThirdPartyClient` |  |
| `thirdPartyExternalId` | String |  |  |
| `webhookDelivery.attempts` | Number |  | default 0 |
| `webhookDelivery.lastAttemptAt` | Date |  |  |
| `webhookDelivery.lastStatus` | Number |  |  |
| `webhookDelivery.deliveredAt` | Date |  |  |
| `_id` | ObjectId |  |  |
| `createdAt` | Date |  |  |
| `updatedAt` | Date |  |  |

**Indexes:** `{"invoiceNumber":1} {"unique":true,"background":true}`; `{"status":1} {"background":true}`; `{"organizationId":1} {"background":true}`; `{"sellerId":1} {"background":true}`; `{"userId":1} {"background":true}`; `{"cashbackCodeId":1} {"background":true}`; `{"userId":1,"createdAt":-1} {"background":true}`; `{"organizationId":1,"status":1,"createdAt":-1} {"background":true}`; `{"sellerId":1,"status":1,"createdAt":-1} {"background":true}`; `{"razorpayOrderId":1} {"unique":true,"sparse":true,"background":true}`; `{"razorpayPaymentId":1} {"unique":true,"sparse":true,"background":true}`; `{"parentInvoiceId":1} {"background":true}`; `{"razorpaySubscriptionId":1,"recurringPaymentNumber":1} {"background":true}`; `{"status":1,"expiresAt":1} {"background":true}`; `{"status":1,"commissionDistributed":1} {"background":true}`; `{"isRecurring":1,"status":1,"nextDueDate":1} {"background":true}`; `{"status":1,"lineItems.itemType":1,"paidAt":-1} {"background":true}`; `{"thirdPartyClientId":1,"createdAt":-1} {"background":true}`; `{"thirdPartyClientId":1,"thirdPartyExternalId":1} {"unique":true,"sparse":true,"background":true}`

### ItemReserveLicense

- **Collection:** `itemreservelicenses` · **Area:** Core platform · **Source:** `server/models/itemReserveLicense.model.ts` (doc: `server/models/itemReserveLicense.model.ts.md`) · **Options:** timestamps=true, autoIndex=null, capped=false
- **Referenced by:** `PendingReserveAssignment`
- **Used by:** `server/services/itemReserveLicense.ts`, `server/services/pendingReserveAssignment.ts`
- **Hooks:** pre(save) ×5, pre(findOneAndReplace) ×1, pre(findOneAndUpdate) ×1, pre(replaceOne) ×1, pre(update) ×1, pre(updateOne) ×1, pre(updateMany) ×1, pre(remove) ×1, post(save) ×3, post(init) ×1
- **Statics/methods:** `initializeTimestamps()`

| Field | Type | Ref | Flags |
|---|---|---|---|
| `buyerId` | ObjectId | `User` | required, index |
| `itemType` | String |  | required, index, enum ["course","channel","workshop… |
| `itemId` | ObjectId |  | required, index |
| `itemName` | String |  | required |
| `itemImage` | String |  |  |
| `organizationId` | ObjectId | `Organization` | required, index |
| `invoiceId` | ObjectId | `Invoice` | required, index |
| `invoiceNumber` | String |  | required |
| `paymentId` | String |  | required |
| `seq` | Number |  | required |
| `status` | String |  | index, default "available", enum ["available","assigned","expi… |
| `assignedTo` | ObjectId | `User` |  |
| `assignedAt` | Date |  |  |
| `assignedArtifactRef` | Embedded |  |  |
| `pendingAssignmentId` | ObjectId | `PendingReserveAssignment` |  |
| `unitPrice` | Number |  | required |
| `currency` | String |  | default "USD" |
| `metadata` | Mixed |  |  |
| `_id` | ObjectId |  |  |
| `createdAt` | Date |  |  |
| `updatedAt` | Date |  |  |

**Indexes:** `{"buyerId":1} {"background":true}`; `{"itemType":1} {"background":true}`; `{"itemId":1} {"background":true}`; `{"organizationId":1} {"background":true}`; `{"invoiceId":1} {"background":true}`; `{"status":1} {"background":true}`; `{"buyerId":1,"status":1,"createdAt":-1} {"background":true}`; `{"assignedTo":1,"createdAt":-1} {"background":true}`; `{"paymentId":1,"seq":1} {"unique":true,"background":true}`

### JobActivity

- **Collection:** `jobactivities` · **Area:** Core platform · **Source:** `server/models/jobActivity.model.ts` (doc: `server/models/jobActivity.model.ts.md`) · **Options:** timestamps=true, autoIndex=null, capped=false
- **Used by:** `server/routes/jobsFounder.ts`, `server/services/jobs.ts`
- **Hooks:** pre(save) ×5, pre(findOneAndReplace) ×1, pre(findOneAndUpdate) ×1, pre(replaceOne) ×1, pre(update) ×1, pre(updateOne) ×1, pre(updateMany) ×1, pre(remove) ×1, post(save) ×3, post(init) ×1
- **Statics/methods:** `initializeTimestamps()`

| Field | Type | Ref | Flags |
|---|---|---|---|
| `orgId` | ObjectId | `Organization` | required |
| `jobId` | ObjectId | `JobPosting` | required |
| `applicationId` | ObjectId | `JobApplication` | required |
| `actorId` | ObjectId | `User` |  |
| `type` | String |  | required, enum ["applied","auto_scored","kno… |
| `text` | String |  | default "" |
| `mentions` | [ObjectId] | `User` |  |
| `data` | Mixed |  |  |
| `_id` | ObjectId |  |  |
| `createdAt` | Date |  |  |
| `updatedAt` | Date |  |  |

**Indexes:** `{"applicationId":1,"createdAt":-1} {"background":true}`; `{"orgId":1,"createdAt":-1} {"background":true}`

### JobAlert

- **Collection:** `jobalerts` · **Area:** Core platform · **Source:** `server/models/jobAlert.model.ts` (doc: `server/models/jobAlert.model.ts.md`) · **Options:** timestamps=true, autoIndex=null, capped=false
- **Used by:** `server/routes/jobsCandidate.ts`, `server/services/jobSearch.ts`, `server/services/jobsSweeper.ts`
- **Hooks:** pre(save) ×5, pre(findOneAndReplace) ×1, pre(findOneAndUpdate) ×1, pre(replaceOne) ×1, pre(update) ×1, pre(updateOne) ×1, pre(updateMany) ×1, pre(remove) ×1, post(save) ×3, post(init) ×1
- **Statics/methods:** `initializeTimestamps()`

| Field | Type | Ref | Flags |
|---|---|---|---|
| `userId` | ObjectId | `User` | required |
| `name` | String |  | required |
| `criteria.q` | String |  |  |
| `criteria.location` | String |  |  |
| `criteria.workplace` | [String] |  |  |
| `criteria.employmentType` | [String] |  |  |
| `criteria.experience` | Number |  |  |
| `criteria.salaryMin` | Number |  |  |
| `criteria.department` | String |  |  |
| `frequency` | String |  | default "daily", enum ["instant","daily","weekly"] |
| `weekday` | Number |  |  |
| `active` | Boolean |  | default true |
| `lastSentAt` | Date |  |  |
| `_id` | ObjectId |  |  |
| `createdAt` | Date |  |  |
| `updatedAt` | Date |  |  |

**Indexes:** `{"active":1,"frequency":1} {"background":true}`; `{"userId":1,"createdAt":-1} {"background":true}`

### JobApplication

- **Collection:** `jobapplications` · **Area:** Core platform · **Source:** `server/models/jobApplication.model.ts` (doc: `server/models/jobApplication.model.ts.md`) · **Options:** timestamps=true, autoIndex=null, capped=false
- **Referenced by:** `JobActivity`, `JobInterview`, `JobOffer`, `JobReward`
- **Used by:** `server/routes/jobsCandidate.ts`, `server/routes/jobsFounder.ts`, `server/services/jobRewards.ts`, `server/services/jobs.ts`, `server/services/jobsSweeper.ts`
- **Hooks:** pre(save) ×5, pre(findOneAndReplace) ×1, pre(findOneAndUpdate) ×1, pre(replaceOne) ×1, pre(update) ×1, pre(updateOne) ×1, pre(updateMany) ×1, pre(remove) ×1, post(save) ×3, post(init) ×1
- **Statics/methods:** `initializeTimestamps()`

| Field | Type | Ref | Flags |
|---|---|---|---|
| `jobId` | ObjectId | `JobPosting` | required |
| `orgId` | ObjectId | `Organization` | required |
| `candidateId` | ObjectId | `User` | required |
| `reference` | String |  | required |
| `isDraft` | Boolean |  | default true |
| `furthestPage` | Number |  | default 0 |
| `stageId` | String |  | default "" |
| `stageCategory` | String |  | default "applied", enum ["applied","screening","asses… |
| `maxStageRank` | Number |  | default 0 |
| `status` | String |  | default "active", enum ["active","rejected","withdra… |
| `answers` | [subdoc] |  | default [] |
| `profile.fullName` | String |  |  |
| `profile.title` | String |  |  |
| `profile.email` | String |  |  |
| `profile.phone` | String |  |  |
| `profile.location` | String |  |  |
| `profile.company` | String |  |  |
| `profile.experienceYears` | Number |  |  |
| `profile.currentCtc` | String |  |  |
| `profile.expectedCtc` | String |  |  |
| `profile.noticePeriod` | String |  |  |
| `profile.linkedin` | String |  |  |
| `resume` | Embedded |  |  |
| `source` | String |  | default "garage_hq", enum ["garage_hq","university","pu… |
| `referral` | Embedded |  |  |
| `matchScore` | Number |  | default 0 |
| `matchedSkills` | [String] |  | default [] |
| `quiz` | Embedded |  |  |
| `knockout` | Embedded |  |  |
| `rejection` | Embedded |  |  |
| `tags` | [String] |  | default [] |
| `starred` | Boolean |  | default false |
| `reviewedAt` | Date |  |  |
| `talentPoolConsent` | Boolean |  | default false |
| `consentUntil` | Date |  |  |
| `joiningDate` | Date |  |  |
| `hiredAt` | Date |  |  |
| `appliedAt` | Date |  |  |
| `stageEnteredAt` | Date |  |  |
| `lastActivityAt` | Date |  | default fn default |
| `lastActivity` | String |  |  |
| `idleRemindedAt` | Date |  |  |
| `_id` | ObjectId |  |  |
| `createdAt` | Date |  |  |
| `updatedAt` | Date |  |  |

**Indexes:** `{"jobId":1,"candidateId":1} {"unique":true,"background":true}`; `{"orgId":1,"isDraft":1,"appliedAt":-1} {"background":true}`; `{"jobId":1,"isDraft":1,"stageId":1} {"background":true}`; `{"candidateId":1,"updatedAt":-1} {"background":true}`; `{"orgId":1,"talentPoolConsent":1} {"background":true}`; `{"rejection.emailDueAt":1} {"sparse":true,"background":true}`

### JobEvent

- **Collection:** `jobevents` · **Area:** Core platform · **Source:** `server/models/jobEvent.model.ts` (doc: `server/models/jobEvent.model.ts.md`) · **Options:** timestamps={"createdAt":true,"updatedAt"…, autoIndex=null, capped=false
- **Used by:** `server/routes/jobsCandidate.ts`, `server/routes/jobsFounder.ts`
- **Hooks:** pre(save) ×5, pre(findOneAndReplace) ×1, pre(findOneAndUpdate) ×1, pre(replaceOne) ×1, pre(update) ×1, pre(updateOne) ×1, pre(updateMany) ×1, pre(remove) ×1, post(save) ×3, post(init) ×1
- **Statics/methods:** `initializeTimestamps()`

| Field | Type | Ref | Flags |
|---|---|---|---|
| `orgId` | ObjectId | `Organization` | required |
| `jobId` | ObjectId | `JobPosting` | required |
| `type` | String |  | required, enum ["view","apply_start"] |
| `userId` | ObjectId | `User` |  |
| `source` | String |  |  |
| `_id` | ObjectId |  |  |
| `createdAt` | Date |  |  |

**Indexes:** `{"jobId":1,"type":1,"createdAt":-1} {"background":true}`

### JobInterview

- **Collection:** `jobinterviews` · **Area:** Core platform · **Source:** `server/models/jobInterview.model.ts` (doc: `server/models/jobInterview.model.ts.md`) · **Options:** timestamps=true, autoIndex=null, capped=false
- **Used by:** `server/routes/jobsCandidate.ts`, `server/routes/jobsFounder.ts`, `server/utils/meetCode.ts`
- **Hooks:** pre(save) ×5, pre(findOneAndReplace) ×1, pre(findOneAndUpdate) ×1, pre(replaceOne) ×1, pre(update) ×1, pre(updateOne) ×1, pre(updateMany) ×1, pre(remove) ×1, post(save) ×3, post(init) ×1
- **Statics/methods:** `initializeTimestamps()`

| Field | Type | Ref | Flags |
|---|---|---|---|
| `orgId` | ObjectId | `Organization` | required |
| `jobId` | ObjectId | `JobPosting` | required |
| `applicationId` | ObjectId | `JobApplication` | required |
| `candidateId` | ObjectId | `User` | required |
| `stageId` | String |  | default "" |
| `roundLabel` | String |  | default "Interview" |
| `interviewerIds` | [ObjectId] | `User` |  |
| `mode` | String |  | default "video", enum ["video","in_person","phone"] |
| `durationMin` | Number |  | default 45 |
| `timezone` | String |  |  |
| `slots` | [Date] |  | default [] |
| `candidatePicks` | Boolean |  | default false |
| `scheduledAt` | Date |  |  |
| `meetingUrl` | String |  |  |
| `location` | String |  |  |
| `message` | String |  |  |
| `status` | String |  | default "scheduled", enum ["awaiting_candidate","schedu… |
| `scorecards` | [subdoc] |  | default [] |
| `createdBy` | ObjectId | `User` | required |
| `_id` | ObjectId |  |  |
| `createdAt` | Date |  |  |
| `updatedAt` | Date |  |  |

**Indexes:** `{"applicationId":1,"createdAt":-1} {"background":true}`; `{"orgId":1,"status":1,"scheduledAt":1} {"background":true}`; `{"candidateId":1,"status":1} {"background":true}`

### JobOffer

- **Collection:** `joboffers` · **Area:** Core platform · **Source:** `server/models/jobOffer.model.ts` (doc: `server/models/jobOffer.model.ts.md`) · **Options:** timestamps=true, autoIndex=null, capped=false
- **Used by:** `server/routes/jobsCandidate.ts`, `server/routes/jobsFounder.ts`, `server/services/jobsSweeper.ts`
- **Hooks:** pre(save) ×5, pre(findOneAndReplace) ×1, pre(findOneAndUpdate) ×1, pre(replaceOne) ×1, pre(update) ×1, pre(updateOne) ×1, pre(updateMany) ×1, pre(remove) ×1, post(save) ×3, post(init) ×1
- **Statics/methods:** `initializeTimestamps()`

| Field | Type | Ref | Flags |
|---|---|---|---|
| `orgId` | ObjectId | `Organization` | required |
| `jobId` | ObjectId | `JobPosting` | required |
| `applicationId` | ObjectId | `JobApplication` | required |
| `candidateId` | ObjectId | `User` | required |
| `role` | String |  | required |
| `ctc` | Number |  | required |
| `currency` | String |  | default "USD" |
| `joiningDate` | Date |  |  |
| `expiresAt` | Date |  |  |
| `letter` | Embedded |  |  |
| `message` | String |  |  |
| `status` | String |  | default "sent", enum ["sent","accepted","declined"… |
| `respondedAt` | Date |  |  |
| `declineReason` | String |  |  |
| `createdBy` | ObjectId | `User` | required |
| `_id` | ObjectId |  |  |
| `createdAt` | Date |  |  |
| `updatedAt` | Date |  |  |

**Indexes:** `{"applicationId":1,"createdAt":-1} {"background":true}`; `{"candidateId":1,"status":1} {"background":true}`

### JobPosting

- **Collection:** `jobpostings` · **Area:** Core platform · **Source:** `server/models/jobPosting.model.ts` (doc: `server/models/jobPosting.model.ts.md`) · **Options:** timestamps=true, autoIndex=null, capped=false
- **Referenced by:** `JobActivity`, `JobApplication`, `JobEvent`, `JobInterview`, `JobOffer`, `JobReward`, `SavedJob`
- **Used by:** `server/models/jobAlert.model.ts`, `server/models/jobApplication.model.ts`, `server/routes/internal-catalog.ts`, `server/routes/jobsCandidate.ts`, `server/routes/jobsFounder.ts`, `server/scripts/backfill-catalog-outbox.ts`, `server/services/jobRewards.ts`, `server/services/jobSearch.ts`, … +2 more
- **Hooks:** pre(save) ×5, pre(findOneAndReplace) ×1, pre(findOneAndUpdate) ×1, pre(replaceOne) ×1, pre(update) ×1, pre(updateOne) ×1, pre(updateMany) ×1, pre(remove) ×1, post(save) ×4, post(findOneAndUpdate) ×1, post(findOneAndDelete) ×1, post(deleteOne) ×1, post(init) ×1
- **Statics/methods:** `initializeTimestamps()`

| Field | Type | Ref | Flags |
|---|---|---|---|
| `orgId` | ObjectId | `Organization` | required |
| `createdBy` | ObjectId | `User` | required |
| `status` | String |  | default "draft", enum ["draft","scheduled","live","… |
| `slug` | String |  | required |
| `title` | String |  | default "" |
| `department` | String |  |  |
| `openings` | Number |  | default 1 |
| `employmentType` | String |  | default "full_time", enum ["full_time","part_time","con… |
| `workplace` | String |  | default "onsite", enum ["hybrid","remote","onsite"] |
| `officeDays` | Number |  |  |
| `locations` | [String] |  | default [] |
| `experienceMin` | Number |  |  |
| `experienceMax` | Number |  |  |
| `joining` | String |  |  |
| `salary.show` | Boolean |  | default true |
| `salary.currency` | String |  | default "USD" |
| `salary.min` | Number |  |  |
| `salary.max` | Number |  |  |
| `salary.period` | String |  | default "year", enum ["year","month","hour"] |
| `description.aboutRole` | String |  | default "" |
| `description.responsibilities` | String |  | default "" |
| `description.requirements` | String |  | default "" |
| `description.niceToHave` | String |  | default "" |
| `description.offer` | String |  | default "" |
| `skills` | [String] |  | default [] |
| `education.required` | Boolean |  | default false |
| `education.qualification` | String |  |  |
| `perks` | [String] |  | default [] |
| `form.pages` | [subdoc] |  | default [] |
| `stages` | [subdoc] |  | default [] |
| `team` | [subdoc] |  | default [] |
| `candidateEmails.applicationReceived` | Boolean |  | default true |
| `candidateEmails.movedToInterview` | Boolean |  | default true |
| `candidateEmails.rejection` | Boolean |  | default true |
| `candidateEmails.rejectionDelayHours` | Number |  | default 24 |
| `candidateEmails.offer` | Boolean |  | default false |
| `reward.enabled` | Boolean |  | default false |
| `reward.amount` | Number |  | default 0 |
| `reward.guaranteeDays` | Number |  | default 90 |
| `reward.funding` | String |  | default "hold", enum ["hold","on_hire"] |
| `reward.heldAmount` | Number |  | default 0 |
| `reward.totalHeld` | Number |  | default 0 |
| `reward.payerId` | ObjectId | `User` |  |
| `channels.garageHq` | Boolean |  | default true |
| `channels.university` | Boolean |  | default false |
| `channels.publicLink` | Boolean |  | default true |
| `publishMode` | String |  | default "now", enum ["now","scheduled"] |
| `publishAt` | Date |  |  |
| `closesAt` | Date |  |  |
| `autoCloseOnHires` | Boolean |  | default true |
| `completedStep` | Number |  | default 0 |
| `stats.views` | Number |  | default 0 |
| `stats.applyStarts` | Number |  | default 0 |
| `publishedAt` | Date |  |  |
| `closedAt` | Date |  |  |
| `deletedAt` | Date |  |  |
| `_id` | ObjectId |  |  |
| `createdAt` | Date |  |  |
| `updatedAt` | Date |  |  |

**Indexes:** `{"orgId":1,"status":1,"updatedAt":-1} {"background":true}`; `{"orgId":1,"slug":1} {"unique":true,"background":true}`; `{"status":1,"channels.garageHq":1,"publishedAt":-1} {"background":true}`; `{"status":1,"publishAt":1} {"background":true}`; `{"status":1,"closesAt":1} {"background":true}`

### JobReward

- **Collection:** `jobrewards` · **Area:** Core platform · **Source:** `server/models/jobReward.model.ts` (doc: `server/models/jobReward.model.ts.md`) · **Options:** timestamps=true, autoIndex=null, capped=false
- **Used by:** `server/routes/jobsFounder.ts`, `server/services/jobRewards.ts`
- **Hooks:** pre(save) ×5, pre(findOneAndReplace) ×1, pre(findOneAndUpdate) ×1, pre(replaceOne) ×1, pre(update) ×1, pre(updateOne) ×1, pre(updateMany) ×1, pre(remove) ×1, post(save) ×3, post(init) ×1
- **Statics/methods:** `initializeTimestamps()`

| Field | Type | Ref | Flags |
|---|---|---|---|
| `orgId` | ObjectId | `Organization` | required |
| `jobId` | ObjectId | `JobPosting` | required |
| `applicationId` | ObjectId | `JobApplication` | required |
| `candidateId` | ObjectId | `User` | required |
| `payerId` | ObjectId | `User` | required |
| `referrerId` | ObjectId | `User` | required |
| `amount` | Number |  | required |
| `currency` | String |  | default "USD" |
| `funding` | String |  | required, enum ["hold","on_hire"] |
| `status` | String |  | default "in_guarantee", enum ["in_guarantee","processing",… |
| `joinedAt` | Date |  | required |
| `guaranteeDays` | Number |  | required |
| `guaranteeEndsAt` | Date |  | required |
| `paidAt` | Date |  |  |
| `paidAmount` | Number |  |  |
| `returnedAmount` | Number |  |  |
| `distributionId` | String |  |  |
| `cancelledAt` | Date |  |  |
| `cancelReason` | String |  |  |
| `lastError` | String |  |  |
| `attempts` | Number |  | default 0 |
| `_id` | ObjectId |  |  |
| `createdAt` | Date |  |  |
| `updatedAt` | Date |  |  |

**Indexes:** `{"applicationId":1} {"unique":true,"background":true}`; `{"orgId":1,"status":1,"createdAt":-1} {"background":true}`; `{"status":1,"guaranteeEndsAt":1} {"background":true}`; `{"referrerId":1,"createdAt":-1} {"background":true}`

### JobsSettings

- **Collection:** `jobssettings` · **Area:** Core platform · **Source:** `server/models/jobsSettings.model.ts` (doc: `server/models/jobsSettings.model.ts.md`) · **Options:** timestamps=true, autoIndex=null, capped=false
- **Used by:** `server/routes/jobsFounder.ts`, `server/services/jobs.ts`
- **Hooks:** pre(save) ×5, pre(findOneAndReplace) ×1, pre(findOneAndUpdate) ×1, pre(replaceOne) ×1, pre(update) ×1, pre(updateOne) ×1, pre(updateMany) ×1, pre(remove) ×1, post(save) ×3, post(init) ×1
- **Statics/methods:** `initializeTimestamps()`

| Field | Type | Ref | Flags |
|---|---|---|---|
| `orgId` | ObjectId | `Organization` | required, unique |
| `careersPage.coverImage` | String |  |  |
| `careersPage.headline` | String |  |  |
| `careersPage.about` | String |  |  |
| `careersPage.culturePhotos` | [String] |  | default [] |
| `careersPage.perks` | [String] |  | default [] |
| `careersPage.showRewards` | Boolean |  | default false |
| `emailTemplates` | [subdoc] |  | default [] |
| `rejectionReasons` | [subdoc] |  | default [] |
| `savedForms` | [subdoc] |  | default [] |
| `defaultPipeline.stages` | [Mixed] |  | default [] |
| `privacy.retentionMonths` | Number |  | default 12 |
| `privacy.allowDeletionRequests` | Boolean |  | default true |
| `privacy.consentAddition` | String |  | default "" |
| `_id` | ObjectId |  |  |
| `createdAt` | Date |  |  |
| `updatedAt` | Date |  |  |

**Indexes:** `{"orgId":1} {"unique":true,"background":true}`

### JoinRequest

- **Collection:** `joinrequests` · **Area:** Core platform · **Source:** `server/models/joinRequest.model.ts` (doc: `server/models/joinRequest.model.ts.md`) · **Options:** timestamps=true, autoIndex=null, capped=false
- **Used by:** `server/routes/guestAuth.ts`, `server/routes/joinRequests.ts`
- **Hooks:** pre(save) ×5, pre(findOneAndReplace) ×1, pre(findOneAndUpdate) ×1, pre(replaceOne) ×1, pre(update) ×1, pre(updateOne) ×1, pre(updateMany) ×1, pre(remove) ×1, post(save) ×3, post(init) ×1
- **Statics/methods:** `initializeTimestamps()`

| Field | Type | Ref | Flags |
|---|---|---|---|
| `guestUserId` | ObjectId | `User` | required, index |
| `orgId` | ObjectId | `Organization` | required, index |
| `email` | String |  | required, index |
| `name` | String |  |  |
| `message` | String |  |  |
| `status` | String |  | index, default "pending", enum ["pending","approved","reject… |
| `respondedBy` | ObjectId | `User` |  |
| `respondedAt` | Date |  |  |
| `_id` | ObjectId |  |  |
| `createdAt` | Date |  |  |
| `updatedAt` | Date |  |  |

**Indexes:** `{"guestUserId":1} {"background":true}`; `{"orgId":1} {"background":true}`; `{"email":1} {"background":true}`; `{"status":1} {"background":true}`; `{"guestUserId":1,"orgId":1} {"unique":true,"background":true}`; `{"orgId":1,"status":1,"createdAt":-1} {"background":true}`

### LeaveRequest

- **Collection:** `leaverequests` · **Area:** Core platform · **Source:** `server/models/leaveRequest.model.ts` (doc: `server/models/leaveRequest.model.ts.md`) · **Options:** timestamps=true, autoIndex=null, capped=false
- **Used by:** `server/routes/betty.ts`
- **Hooks:** pre(save) ×5, pre(findOneAndReplace) ×1, pre(findOneAndUpdate) ×1, pre(replaceOne) ×1, pre(update) ×1, pre(updateOne) ×1, pre(updateMany) ×1, pre(remove) ×1, post(save) ×3, post(init) ×1
- **Statics/methods:** `initializeTimestamps()`

| Field | Type | Ref | Flags |
|---|---|---|---|
| `userId` | ObjectId | `User` | required, index |
| `orgId` | ObjectId | `Organization` | required, index |
| `startDate` | Date |  | required |
| `endDate` | Date |  | required |
| `reason` | String |  | required |
| `status` | String |  | index, default "pending", enum ["pending","approved","reject… |
| `approverId` | ObjectId | `User` |  |
| `_id` | ObjectId |  |  |
| `createdAt` | Date |  |  |
| `updatedAt` | Date |  |  |

**Indexes:** `{"userId":1} {"background":true}`; `{"orgId":1} {"background":true}`; `{"status":1} {"background":true}`; `{"userId":1,"orgId":1} {"background":true}`; `{"orgId":1,"status":1} {"background":true}`

### MagicLink

- **Collection:** `magiclinks` · **Area:** Core platform · **Source:** `server/models/magicLink.model.ts` (doc: `server/models/magicLink.model.ts.md`) · **Options:** timestamps=true, autoIndex=null, capped=false
- **Used by:** `server/routes/magicLink.ts`, `server/routes/platformOffices.ts`, `server/services/magicLinkReminders.ts`, `server/services/signupOffer.ts`
- **Hooks:** pre(save) ×5, pre(findOneAndReplace) ×1, pre(findOneAndUpdate) ×1, pre(replaceOne) ×1, pre(update) ×1, pre(updateOne) ×1, pre(updateMany) ×1, pre(remove) ×1, post(save) ×3, post(init) ×1
- **Statics/methods:** `initializeTimestamps()`

| Field | Type | Ref | Flags |
|---|---|---|---|
| `token` | String |  | required, unique |
| `userId` | ObjectId | `User` | required |
| `thirdPartyClientId` | ObjectId |  | required |
| `termMonths` | Number |  |  |
| `createdByUserId` | ObjectId | `User` | required |
| `status` | String |  | index, default "active", enum ["active","consumed","revoked… |
| `consumedInvoiceId` | ObjectId | `Invoice` |  |
| `consumedAt` | Date |  |  |
| `accessCount` | Number |  | default 0 |
| `lastAccessedAt` | Date |  |  |
| `emailSentAt` | Date |  |  |
| `whatsappSentAt` | Date |  |  |
| `remindersSent` | [Number] |  | default [] |
| `remindersSentWhatsapp` | [Number] |  | default [] |
| `_id` | ObjectId |  |  |
| `createdAt` | Date |  |  |
| `updatedAt` | Date |  |  |

**Indexes:** `{"token":1} {"unique":true,"background":true}`; `{"status":1} {"background":true}`; `{"userId":1,"thirdPartyClientId":1,"termMonths":1} {"background":true}`; `{"createdByUserId":1,"createdAt":-1} {"background":true}`; `{"status":1,"emailSentAt":1} {"background":true}`

### Meet

- **Collection:** `meets` · **Area:** Core platform · **Source:** `server/models/meet.model.ts` (doc: `server/models/meet.model.ts.md`) · **Options:** timestamps=true, autoIndex=null, capped=false
- **Referenced by:** `MeetParticipant`
- **Used by:** `server/index.ts`, `server/realtime/mediasoupHandlers.ts`, `server/realtime/webinarEnd.ts`, `server/routes/meet.ts`, `server/routes/publicMeet.ts`, `server/routes/publicWebinar.ts`, `server/routes/webinarRoutes.ts`, `server/routes/workshop.ts`, … +4 more
- **Hooks:** pre(save) ×6, pre(findOneAndReplace) ×1, pre(findOneAndUpdate) ×1, pre(replaceOne) ×1, pre(update) ×1, pre(updateOne) ×1, pre(updateMany) ×1, pre(remove) ×1, post(save) ×3, post(init) ×1
- **Statics/methods:** `initializeTimestamps()`

| Field | Type | Ref | Flags |
|---|---|---|---|
| `orgId` | ObjectId | `Organization` | required, index |
| `hostEmail` | String |  | required, index |
| `hostName` | String |  |  |
| `title` | String |  | required |
| `description` | String |  |  |
| `startTime` | Date |  | required, index |
| `endTime` | Date |  | required |
| `joinCode` | String |  | required, unique, index |
| `status` | String |  | index, default "scheduled", enum ["scheduled","live","ended","… |
| `isHostVerified` | Boolean |  | default false |
| `agoraChannel` | String |  | required |
| `startedAt` | Date |  |  |
| `endedAt` | Date |  |  |
| `screenSharingByUid` | Number |  | default null |
| `_id` | ObjectId |  |  |
| `createdAt` | Date |  |  |
| `updatedAt` | Date |  |  |

**Indexes:** `{"orgId":1} {"background":true}`; `{"hostEmail":1} {"background":true}`; `{"startTime":1} {"background":true}`; `{"joinCode":1} {"unique":true,"background":true}`; `{"status":1} {"background":true}`; `{"orgId":1,"startTime":1,"status":1} {"background":true}`; `{"hostEmail":1,"startTime":1} {"background":true}`; `{"joinCode":1,"status":1} {"background":true}`

### MeetParticipant

- **Collection:** `meetparticipants` · **Area:** Core platform · **Source:** `server/models/meetParticipant.model.ts` (doc: `server/models/meetParticipant.model.ts.md`) · **Options:** timestamps=true, autoIndex=null, capped=false
- **Used by:** `server/routes/meet.ts`, `server/routes/publicMeet.ts`, `server/routes/workshopPreview.ts`, `server/services/founderStreamTable.ts`, `server/services/workshop.ts`
- **Hooks:** pre(save) ×5, pre(findOneAndReplace) ×1, pre(findOneAndUpdate) ×1, pre(replaceOne) ×1, pre(update) ×1, pre(updateOne) ×1, pre(updateMany) ×1, pre(remove) ×1, post(save) ×3, post(init) ×1
- **Statics/methods:** `initializeTimestamps()`

| Field | Type | Ref | Flags |
|---|---|---|---|
| `meetId` | ObjectId | `Meet` | required, index |
| `email` | String |  | required, index |
| `displayName` | String |  | required |
| `isHost` | Boolean |  | index, default false |
| `agoraUid` | Number |  | index, default fn default |
| `joinedAt` | Date |  | required, default fn now |
| `leftAt` | Date |  |  |
| `_id` | ObjectId |  |  |
| `createdAt` | Date |  |  |
| `updatedAt` | Date |  |  |

**Indexes:** `{"meetId":1} {"background":true}`; `{"email":1} {"background":true}`; `{"isHost":1} {"background":true}`; `{"agoraUid":1} {"background":true}`; `{"meetId":1,"email":1} {"background":true}`; `{"meetId":1,"isHost":1} {"background":true}`; `{"meetId":1,"joinedAt":1} {"background":true}`

### Message

- **Collection:** `messages` · **Area:** Core platform · **Source:** `server/models/message.model.ts` (doc: `server/models/message.model.ts.md`) · **Options:** timestamps=true, autoIndex=null, capped=false
- **Referenced by:** `Message`
- **Used by:** `server/index.ts`, `server/realtime/idempotentSend.ts`, `server/realtime/socket.ts`, `server/routes/chat.ts`, `server/routes/dm.ts`, `server/scripts/migrate-dm-to-org.ts`, `server/scripts/migrate-to-public-urls.ts`, `server/services/memberCleanup.service.ts`
- **Hooks:** pre(save) ×5, pre(findOneAndReplace) ×1, pre(findOneAndUpdate) ×1, pre(replaceOne) ×1, pre(update) ×1, pre(updateOne) ×1, pre(updateMany) ×1, pre(remove) ×1, post(save) ×3, post(init) ×1
- **Statics/methods:** `initializeTimestamps()`

| Field | Type | Ref | Flags |
|---|---|---|---|
| `convId` | String |  | index |
| `orgId` | ObjectId | `Organization` | index |
| `from` | ObjectId | `User` | required, index |
| `to` | ObjectId | `User` | required, index |
| `text` | String |  |  |
| `attachments` | [subdoc] |  |  |
| `replyTo` | ObjectId | `Message` | default null |
| `editedAt` | Date |  | default null |
| `readAt` | Date |  | default null |
| `deliveredAt` | Date |  | default null |
| `deletedAt` | Date |  | default null |
| `reactions` | Map |  | default fn default |
| `reactions.$*` | [String] |  |  |
| `clientMsgId` | String |  |  |
| `_id` | ObjectId |  |  |
| `createdAt` | Date |  |  |
| `updatedAt` | Date |  |  |

**Indexes:** `{"convId":1} {"background":true}`; `{"orgId":1} {"background":true}`; `{"from":1} {"background":true}`; `{"to":1} {"background":true}`; `{"convId":1,"createdAt":-1} {"background":true}`; `{"from":1,"clientMsgId":1} {"unique":true,"partialFilterExpression":{"clientMsgId":{"$type":"string"}},"background":true}`

### MessageTranslation

- **Collection:** `messagetranslations` · **Area:** Core platform · **Source:** `server/models/messageTranslation.model.ts` (doc: `server/models/messageTranslation.model.ts.md`) · **Options:** timestamps=true, autoIndex=null, capped=false
- **Used by:** `server/services/messageTranslation.ts`
- **Hooks:** pre(save) ×5, pre(findOneAndReplace) ×1, pre(findOneAndUpdate) ×1, pre(replaceOne) ×1, pre(update) ×1, pre(updateOne) ×1, pre(updateMany) ×1, pre(remove) ×1, post(save) ×3, post(init) ×1
- **Statics/methods:** `initializeTimestamps()`

| Field | Type | Ref | Flags |
|---|---|---|---|
| `messageId` | ObjectId | `GroupMessage` | required |
| `lang` | String |  | required |
| `srcHash` | String |  | required |
| `text` | String |  | default "" |
| `_id` | ObjectId |  |  |
| `createdAt` | Date |  |  |
| `updatedAt` | Date |  |  |

**Indexes:** `{"messageId":1,"lang":1} {"unique":true,"background":true}`

### MissedCall

- **Collection:** `missedcalls` · **Area:** Core platform · **Source:** `server/models/missedCall.model.ts` (doc: `server/models/missedCall.model.ts.md`) · **Options:** timestamps=true, autoIndex=null, capped=false
- **Used by:** `server/realtime/socket.ts`, `server/routes/missedCall.ts`
- **Hooks:** pre(save) ×5, pre(findOneAndReplace) ×1, pre(findOneAndUpdate) ×1, pre(replaceOne) ×1, pre(update) ×1, pre(updateOne) ×1, pre(updateMany) ×1, pre(remove) ×1, post(save) ×3, post(init) ×1
- **Statics/methods:** `initializeTimestamps()`

| Field | Type | Ref | Flags |
|---|---|---|---|
| `toUserId` | ObjectId | `User` | required, index |
| `fromUserId` | ObjectId | `User` | required, index |
| `orgId` | ObjectId | `Organization` | index |
| `kind` | String |  | required, default "knock", enum ["knock"] |
| `fromName` | String |  |  |
| `fromAvatar` | String |  |  |
| `occurredAt` | Date |  | required, default fn now |
| `viewedAt` | Date |  | default null |
| `dismissedAt` | Date |  | index, default null |
| `_id` | ObjectId |  |  |
| `createdAt` | Date |  |  |
| `updatedAt` | Date |  |  |

**Indexes:** `{"toUserId":1} {"background":true}`; `{"fromUserId":1} {"background":true}`; `{"orgId":1} {"sparse":true,"background":true}`; `{"dismissedAt":1} {"sparse":true,"background":true}`; `{"toUserId":1,"viewedAt":1,"dismissedAt":1} {"background":true}`; `{"toUserId":1,"occurredAt":-1} {"background":true}`

### NcSubscription

- **Collection:** `networkchain_subscriptions` · **Area:** Core platform · **Source:** `server/models/ncSubscription.model.ts` (doc: `server/models/ncSubscription.model.ts.md`) · **Options:** timestamps=true, autoIndex=null, capped=false
- **Used by:** `server/routes/garageAdminNetworkChainSubs.ts`, `server/scripts/setup-test-account.ts`, `server/services/downlineTypeFlags.ts`
- **Hooks:** pre(save) ×5, pre(findOneAndReplace) ×1, pre(findOneAndUpdate) ×1, pre(replaceOne) ×1, pre(update) ×1, pre(updateOne) ×1, pre(updateMany) ×1, pre(remove) ×1, post(save) ×3, post(init) ×1
- **Statics/methods:** `initializeTimestamps()`

| Field | Type | Ref | Flags |
|---|---|---|---|
| `userId` | ObjectId | `User` | required, unique, index |
| `orgId` | ObjectId |  | required |
| `status` | String |  | default "expired", enum ["active","expired","canceled… |
| `priceCents` | Number |  | default 4248 |
| `currentPeriodStart` | Date |  | default fn now |
| `currentPeriodEnd` | Date |  | default fn now |
| `payments` | [subdoc] |  | default [] |
| `_id` | ObjectId |  |  |
| `createdAt` | Date |  |  |
| `updatedAt` | Date |  |  |

**Indexes:** `{"userId":1} {"unique":true,"background":true}`

### NcWallet

- **Collection:** `wallets` · **Area:** Core platform · **Source:** `server/models/ncWallet.model.ts` (doc: `server/models/ncWallet.model.ts.md`) · **Options:** timestamps=true, autoIndex=null, capped=false
- **Used by:** `server/controllers/garageAdmin.controller.ts`, `server/scripts/migrate-content-rewards-to-org-rewards.ts`, `server/services/campaignWallet.ts`, `server/services/contentRewardsWallet.ts`, `server/services/wallet.ts`, `server/services/withdrawal.ts`
- **Hooks:** pre(save) ×5, pre(findOneAndReplace) ×1, pre(findOneAndUpdate) ×1, pre(replaceOne) ×1, pre(update) ×1, pre(updateOne) ×1, pre(updateMany) ×1, pre(remove) ×1, post(save) ×3, post(init) ×1
- **Statics/methods:** `initializeTimestamps()`

| Field | Type | Ref | Flags |
|---|---|---|---|
| `userId` | ObjectId | `User` | required, unique, index |
| `balance` | Number |  | required, default 0 |
| `debt` | Number |  | required, default 0 |
| `transactions` | [subdoc] |  | default [] |
| `_id` | ObjectId |  |  |
| `createdAt` | Date |  |  |
| `updatedAt` | Date |  |  |

**Indexes:** `{"userId":1} {"unique":true,"background":true}`

### NoteSession

- **Collection:** `notesessions` · **Area:** Note-Taker · **Source:** `server/note-taker/models/note-session.model.ts` (doc: `server/note-taker/models/note-session.model.ts.md`) · **Options:** timestamps=true, autoIndex=null, capped=false
- **Referenced by:** `NoteSummary`, `NoteTranscript`
- **Used by:** `server/note-taker/jobs/distribute.worker.ts`, `server/note-taker/jobs/summarize.worker.ts`, `server/note-taker/routes/sessions.ts`, `server/note-taker/routes/summaries.ts`, `server/note-taker/routes/transcripts.ts`, `server/note-taker/summarization/summarizer.ts`, `server/note-taker/transcription/transcript-builder.ts`, `server/note-taker/transcription/transcription-manager.ts`, … +3 more
- **Hooks:** pre(save) ×5, pre(findOneAndReplace) ×1, pre(findOneAndUpdate) ×1, pre(replaceOne) ×1, pre(update) ×1, pre(updateOne) ×1, pre(updateMany) ×1, pre(remove) ×1, post(save) ×3, post(init) ×1
- **Statics/methods:** `initializeTimestamps()`

| Field | Type | Ref | Flags |
|---|---|---|---|
| `roomName` | String |  | required, index |
| `roomId` | String |  | required, index |
| `source` | String |  | index, default "manual", enum ["meet","webinar","office","c… |
| `meetSessionId` | ObjectId | `MeetSession` |  |
| `orgId` | ObjectId |  | required, index |
| `botIdentity` | String |  |  |
| `botJoinedAt` | Date |  |  |
| `botLeftAt` | Date |  |  |
| `title` | String |  |  |
| `startedAt` | Date |  | required |
| `endedAt` | Date |  |  |
| `durationSeconds` | Number |  |  |
| `participants` | [subdoc] |  |  |
| `status` | String |  | default "recording", enum ["recording","transcribing","… |
| `error` | String |  |  |
| `transcriptId` | ObjectId |  |  |
| `summaryId` | ObjectId |  |  |
| `audioFileKey` | String |  |  |
| `emailsSentAt` | Date |  |  |
| `emailRecipients` | [String] |  |  |
| `settings.autoJoin` | Boolean |  | default true |
| `settings.language` | String |  | default "en" |
| `settings.enableSummary` | Boolean |  | default true |
| `settings.enableEmailDistribution` | Boolean |  | default true |
| `_id` | ObjectId |  |  |
| `createdAt` | Date |  |  |
| `updatedAt` | Date |  |  |

**Indexes:** `{"roomName":1} {"background":true}`; `{"roomId":1} {"background":true}`; `{"source":1} {"background":true}`; `{"orgId":1} {"background":true}`; `{"orgId":1,"startedAt":-1} {"background":true}`; `{"roomName":1,"startedAt":-1} {"background":true}`

### NoteSummary

- **Collection:** `notesummaries` · **Area:** Note-Taker · **Source:** `server/note-taker/models/note-summary.model.ts` (doc: `server/note-taker/models/note-summary.model.ts.md`) · **Options:** timestamps=true, autoIndex=null, capped=false
- **Used by:** `server/note-taker/distribution/email-template.ts`, `server/note-taker/jobs/distribute.worker.ts`, `server/note-taker/routes/sessions.ts`, `server/note-taker/routes/summaries.ts`, `server/note-taker/summarization/summarizer.ts`
- **Hooks:** pre(save) ×5, pre(findOneAndReplace) ×1, pre(findOneAndUpdate) ×1, pre(replaceOne) ×1, pre(update) ×1, pre(updateOne) ×1, pre(updateMany) ×1, pre(remove) ×1, post(save) ×3, post(init) ×1
- **Statics/methods:** `initializeTimestamps()`

| Field | Type | Ref | Flags |
|---|---|---|---|
| `sessionId` | ObjectId | `NoteSession` | required, index |
| `overview` | String |  | default "" |
| `keyTopics` | [String] |  |  |
| `actionItems` | [subdoc] |  |  |
| `decisions` | [String] |  |  |
| `questions` | [String] |  |  |
| `markdownSummary` | String |  | default "" |
| `aiModel` | String |  | default "gpt-4o" |
| `promptTokens` | Number |  | default 0 |
| `completionTokens` | Number |  | default 0 |
| `_id` | ObjectId |  |  |
| `createdAt` | Date |  |  |
| `updatedAt` | Date |  |  |

**Indexes:** `{"sessionId":1} {"background":true}`

### NoteTranscript

- **Collection:** `notetranscripts` · **Area:** Note-Taker · **Source:** `server/note-taker/models/note-transcript.model.ts` (doc: `server/note-taker/models/note-transcript.model.ts.md`) · **Options:** timestamps=true, autoIndex=null, capped=false
- **Used by:** `server/note-taker/distribution/email-template.ts`, `server/note-taker/jobs/distribute.worker.ts`, `server/note-taker/routes/sessions.ts`, `server/note-taker/routes/transcripts.ts`, `server/note-taker/summarization/summarizer.ts`, `server/note-taker/transcription/transcript-builder.ts`
- **Hooks:** pre(save) ×5, pre(findOneAndReplace) ×1, pre(findOneAndUpdate) ×1, pre(replaceOne) ×1, pre(update) ×1, pre(updateOne) ×1, pre(updateMany) ×1, pre(remove) ×1, post(save) ×3, post(init) ×1
- **Statics/methods:** `initializeTimestamps()`

| Field | Type | Ref | Flags |
|---|---|---|---|
| `sessionId` | ObjectId | `NoteSession` | required, index |
| `fullText` | String |  | default "" |
| `segments` | [subdoc] |  |  |
| `language` | String |  | default "en" |
| `wordCount` | Number |  | default 0 |
| `speakerCount` | Number |  | default 0 |
| `sttProvider` | String |  | default "deepgram" |
| `_id` | ObjectId |  |  |
| `createdAt` | Date |  |  |
| `updatedAt` | Date |  |  |

**Indexes:** `{"sessionId":1} {"background":true}`; `{"fullText":"text"} {"background":true}`

### Notification

- **Collection:** `notifications` · **Area:** Core platform · **Source:** `server/models/notification.model.ts` (doc: `server/models/notification.model.ts.md`) · **Options:** timestamps=true, autoIndex=null, capped=false
- **Used by:** `server/realtime/socket.ts`, `server/routes/betty.ts`, `server/routes/guestAuth.ts`, `server/services/feed.ts`, `server/services/memberCleanup.service.ts`, `server/services/supportChat.ts`
- **Hooks:** pre(save) ×5, pre(findOneAndReplace) ×1, pre(findOneAndUpdate) ×1, pre(replaceOne) ×1, pre(update) ×1, pre(updateOne) ×1, pre(updateMany) ×1, pre(remove) ×1, post(save) ×3, post(init) ×1
- **Statics/methods:** `initializeTimestamps()`

| Field | Type | Ref | Flags |
|---|---|---|---|
| `userId` | ObjectId | `User` | required, index |
| `orgId` | ObjectId | `Organization` | required, index |
| `type` | String |  | required, index, enum ["betty_chat","leave_request"… |
| `priority` | String |  | default "normal", enum ["low","normal","high"] |
| `title` | String |  | required |
| `message` | String |  | required |
| `data` | Mixed |  |  |
| `isRead` | Boolean |  | index, default false |
| `readAt` | Date |  |  |
| `chatMessageId` | String |  |  |
| `senderType` | String |  | default "system", enum ["user","betty","system"] |
| `_id` | ObjectId |  |  |
| `createdAt` | Date |  |  |
| `updatedAt` | Date |  |  |

**Indexes:** `{"userId":1} {"background":true}`; `{"orgId":1} {"background":true}`; `{"type":1} {"background":true}`; `{"isRead":1} {"background":true}`; `{"userId":1,"orgId":1,"createdAt":-1} {"background":true}`; `{"userId":1,"isRead":1} {"background":true}`; `{"orgId":1,"type":1} {"background":true}`

### OfficeAddon

- **Collection:** `officeaddons` · **Area:** Core platform · **Source:** `server/models/officeAddon.model.ts` (doc: `server/models/officeAddon.model.ts.md`) · **Options:** timestamps=true, autoIndex=null, capped=false
- **Referenced by:** `OfficeAddonPayment`, `OfficeAddonSubscription`
- **Used by:** `server/routes/internal-catalog.ts`, `server/routes/officeAddonCheckout.ts`, `server/routes/officeAddonStatus.ts`, `server/scripts/activate-whitelabel-manual.ts`, `server/scripts/audit-whitelabel-state.ts`, `server/scripts/deactivate-whitelabel-manual.ts`, `server/scripts/diagnose-whitelabel-commission.ts`, `server/scripts/latest-whitelabel-purchase.ts`, … +5 more
- **Hooks:** pre(save) ×5, pre(findOneAndReplace) ×1, pre(findOneAndUpdate) ×1, pre(replaceOne) ×1, pre(update) ×1, pre(updateOne) ×1, pre(updateMany) ×1, pre(remove) ×1, post(save) ×3, post(init) ×1
- **Statics/methods:** `initializeTimestamps()`

| Field | Type | Ref | Flags |
|---|---|---|---|
| `name` | String |  | required |
| `slug` | String |  | required, unique |
| `description` | String |  |  |
| `amount` | Number |  | required |
| `currency` | String |  | default "USD" |
| `period` | String |  | default "yearly", enum ["monthly","yearly"] |
| `interval` | Number |  | default 12 |
| `features` | [String] |  | default [] |
| `razorpayPlanId` | String |  | index |
| `isActive` | Boolean |  | default true |
| `taxRate` | Number |  | default 18 |
| `taxInclusive` | Boolean |  | default false |
| `sacCode` | String |  | default "998314" |
| `_id` | ObjectId |  |  |
| `createdAt` | Date |  |  |
| `updatedAt` | Date |  |  |

**Indexes:** `{"slug":1} {"unique":true,"background":true}`; `{"razorpayPlanId":1} {"background":true}`; `{"isActive":1,"slug":1} {"background":true}`

### OfficeAddonPayment

- **Collection:** `officeaddonpayments` · **Area:** Core platform · **Source:** `server/models/officeAddonPayment.model.ts` (doc: `server/models/officeAddonPayment.model.ts.md`) · **Options:** timestamps=true, autoIndex=null, capped=false
- **Used by:** `server/services/officeAddonSubscription.ts`
- **Hooks:** pre(save) ×5, pre(findOneAndReplace) ×1, pre(findOneAndUpdate) ×1, pre(replaceOne) ×1, pre(update) ×1, pre(updateOne) ×1, pre(updateMany) ×1, pre(remove) ×1, post(save) ×3, post(init) ×1
- **Statics/methods:** `initializeTimestamps()`

| Field | Type | Ref | Flags |
|---|---|---|---|
| `subscriptionId` | ObjectId | `OfficeAddonSubscription` | required, index |
| `addonId` | ObjectId | `OfficeAddon` | required, index |
| `orgId` | ObjectId | `Organization` | required, index |
| `founderId` | ObjectId | `User` | required, index |
| `razorpayPaymentId` | String |  | required, unique, index |
| `razorpaySubscriptionId` | String |  | required, index |
| `razorpayOrderId` | String |  | index |
| `razorpayInvoiceId` | String |  | index |
| `invoiceShortUrl` | String |  |  |
| `amount` | Number |  | required |
| `currency` | String |  | default "INR" |
| `status` | String |  | index, default "created", enum ["created","authorized","capt… |
| `paymentNumber` | Number |  | required |
| `method` | String |  |  |
| `cardId` | String |  |  |
| `bank` | String |  |  |
| `wallet` | String |  |  |
| `vpa` | String |  |  |
| `fee` | Number |  |  |
| `tax` | Number |  |  |
| `paidAt` | Date |  |  |
| `commissionDistributed` | Boolean |  | default false |
| `commissionDistributionId` | ObjectId | `WalletTransaction` |  |
| `_id` | ObjectId |  |  |
| `createdAt` | Date |  |  |
| `updatedAt` | Date |  |  |

**Indexes:** `{"subscriptionId":1} {"background":true}`; `{"addonId":1} {"background":true}`; `{"orgId":1} {"background":true}`; `{"founderId":1} {"background":true}`; `{"razorpayPaymentId":1} {"unique":true,"background":true}`; `{"razorpaySubscriptionId":1} {"background":true}`; `{"razorpayOrderId":1} {"background":true}`; `{"razorpayInvoiceId":1} {"background":true}`; `{"status":1} {"background":true}`; `{"razorpaySubscriptionId":1,"paymentNumber":1} {"unique":true,"background":true}`; `{"subscriptionId":1,"createdAt":-1} {"background":true}`; `{"orgId":1,"createdAt":-1} {"background":true}`; `{"commissionDistributed":1,"status":1} {"background":true}`

### OfficeAddonSubscription

- **Collection:** `officeaddonsubscriptions` · **Area:** Core platform · **Source:** `server/models/officeAddonSubscription.model.ts` (doc: `server/models/officeAddonSubscription.model.ts.md`) · **Options:** timestamps=true, autoIndex=null, capped=false
- **Referenced by:** `OfficeAddonPayment`
- **Used by:** `server/routes/officeAddonCheckout.ts`, `server/scripts/activate-whitelabel-manual.ts`, `server/scripts/audit-whitelabel-state.ts`, `server/scripts/deactivate-whitelabel-manual.ts`, `server/scripts/delete-yopmail-users.ts`, `server/scripts/diagnose-whitelabel-commission.ts`, `server/scripts/latest-whitelabel-purchase.ts`, `server/scripts/migrate-office-addon-sub-razorpay-index.ts`, … +4 more
- **Hooks:** pre(save) ×5, pre(findOneAndReplace) ×1, pre(findOneAndUpdate) ×1, pre(replaceOne) ×1, pre(update) ×1, pre(updateOne) ×1, pre(updateMany) ×1, pre(remove) ×1, post(save) ×3, post(init) ×1
- **Statics/methods:** `initializeTimestamps()`

| Field | Type | Ref | Flags |
|---|---|---|---|
| `orgId` | ObjectId | `Organization` | required, index |
| `founderId` | ObjectId | `User` | required, index |
| `addonId` | ObjectId | `OfficeAddon` | required, index |
| `razorpaySubscriptionId` | String |  | unique, index, sparse |
| `razorpayPlanId` | String |  |  |
| `razorpayCustomerId` | String |  | index |
| `status` | String |  | index, default "created", enum ["created","authenticated","a… |
| `currentStart` | Date |  |  |
| `currentEnd` | Date |  | index |
| `chargeAt` | Date |  | index |
| `startedAt` | Date |  |  |
| `endedAt` | Date |  |  |
| `cancelledAt` | Date |  |  |
| `pausedAt` | Date |  |  |
| `totalCount` | Number |  |  |
| `paidCount` | Number |  | default 0 |
| `remainingCount` | Number |  |  |
| `shortUrl` | String |  |  |
| `paymentMethod` | String |  | enum ["card","upi","emandate","nac… |
| `offerId` | String |  |  |
| `metadata` | Mixed |  |  |
| `_id` | ObjectId |  |  |
| `createdAt` | Date |  |  |
| `updatedAt` | Date |  |  |

**Indexes:** `{"orgId":1} {"background":true}`; `{"founderId":1} {"background":true}`; `{"addonId":1} {"background":true}`; `{"razorpaySubscriptionId":1} {"unique":true,"sparse":true,"background":true}`; `{"razorpayCustomerId":1} {"background":true}`; `{"status":1} {"background":true}`; `{"currentEnd":1} {"background":true}`; `{"chargeAt":1} {"background":true}`; `{"orgId":1,"addonId":1} {"unique":true,"background":true}`; `{"orgId":1,"status":1} {"background":true}`; `{"currentEnd":1,"status":1} {"background":true}`; `{"founderId":1,"status":1} {"background":true}`

### OfficePlan

- **Collection:** `officeplans` · **Area:** Core platform · **Source:** `server/models/officePlan.model.ts` (doc: `server/models/officePlan.model.ts.md`) · **Options:** timestamps=true, autoIndex=null, capped=false
- **Referenced by:** `OfficeSubscription`
- **Used by:** `server/controllers/garageAdmin.controller.ts`, `server/routes/adminCouponRules.ts`, `server/routes/affiliate.ts`, `server/routes/garageAdminDailyReports.ts`, `server/routes/garageAdminSavedCards.ts`, `server/routes/guestAuth.ts`, `server/routes/internal-catalog.ts`, `server/routes/joinRequests.ts`, … +15 more
- **Hooks:** pre(save) ×5, pre(findOneAndReplace) ×1, pre(findOneAndUpdate) ×1, pre(replaceOne) ×1, pre(update) ×1, pre(updateOne) ×1, pre(updateMany) ×1, pre(remove) ×1, post(save) ×3, post(init) ×1
- **Statics/methods:** `initializeTimestamps()`

| Field | Type | Ref | Flags |
|---|---|---|---|
| `name` | String |  | required |
| `slug` | String |  | required, unique |
| `description` | String |  |  |
| `amount` | Number |  | required |
| `currency` | String |  | default "USD" |
| `period` | String |  | default "monthly", enum ["monthly","yearly"] |
| `interval` | Number |  | default 1 |
| `features` | [String] |  | default [] |
| `canInviteStakeholders` | Boolean |  | required, default false |
| `maxStakeholders` | Number |  | default null |
| `razorpayPlanId` | String |  | index |
| `isActive` | Boolean |  | default true |
| `isDefault` | Boolean |  | default false |
| `taxRate` | Number |  | default 18 |
| `taxInclusive` | Boolean |  | default false |
| `sacCode` | String |  | default "998314" |
| `platformFeeOverride` | Number |  | default null |
| `_id` | ObjectId |  |  |
| `createdAt` | Date |  |  |
| `updatedAt` | Date |  |  |

**Indexes:** `{"slug":1} {"unique":true,"background":true}`; `{"razorpayPlanId":1} {"background":true}`; `{"isActive":1,"slug":1} {"background":true}`

### OfficeSubscription

- **Collection:** `officesubscriptions` · **Area:** Core platform · **Source:** `server/models/officeSubscription.model.ts` (doc: `server/models/officeSubscription.model.ts.md`) · **Options:** timestamps=true, autoIndex=null, capped=false
- **Referenced by:** `OfficeSubscriptionPayment`, `OfficeUpgradeHistory`
- **Used by:** `server/controllers/garageAdmin.controller.ts`, `server/routes/affiliate.ts`, `server/routes/auth.ts`, `server/routes/garageAdminSavedCards.ts`, `server/routes/officeCheckout.ts`, `server/routes/officeSubscriptionAdmin.ts`, `server/scripts/delete-yopmail-users.ts`, `server/scripts/repair-foundersoffice-activation.ts`, … +6 more
- **Hooks:** pre(save) ×5, pre(findOneAndReplace) ×1, pre(findOneAndUpdate) ×1, pre(replaceOne) ×1, pre(update) ×1, pre(updateOne) ×1, pre(updateMany) ×1, pre(remove) ×1, post(save) ×3, post(init) ×1
- **Statics/methods:** `initializeTimestamps()`

| Field | Type | Ref | Flags |
|---|---|---|---|
| `orgId` | ObjectId | `Organization` | required, unique, index |
| `founderId` | ObjectId | `User` | required, index |
| `planId` | ObjectId | `OfficePlan` | required |
| `razorpaySubscriptionId` | String |  | unique, index, sparse |
| `razorpayPlanId` | String |  |  |
| `razorpayCustomerId` | String |  | index |
| `status` | String |  | index, default "created", enum ["created","authenticated","a… |
| `currentStart` | Date |  |  |
| `currentEnd` | Date |  | index |
| `chargeAt` | Date |  | index |
| `startedAt` | Date |  |  |
| `endedAt` | Date |  |  |
| `cancelledAt` | Date |  |  |
| `pausedAt` | Date |  |  |
| `totalCount` | Number |  |  |
| `paidCount` | Number |  | default 0 |
| `remainingCount` | Number |  |  |
| `shortUrl` | String |  |  |
| `paymentMethod` | String |  | enum ["card","upi","emandate","nac… |
| `offerId` | String |  |  |
| `metadata` | Mixed |  |  |
| `isTrial` | Boolean |  | index, default false |
| `trialStartedAt` | Date |  |  |
| `trialEndsAt` | Date |  | index |
| `trialExpired` | Boolean |  | default false |
| `convertedFromTrial` | Boolean |  | default false |
| `_id` | ObjectId |  |  |
| `createdAt` | Date |  |  |
| `updatedAt` | Date |  |  |

**Indexes:** `{"orgId":1} {"unique":true,"background":true}`; `{"founderId":1} {"background":true}`; `{"razorpaySubscriptionId":1} {"unique":true,"sparse":true,"background":true}`; `{"razorpayCustomerId":1} {"background":true}`; `{"status":1} {"background":true}`; `{"currentEnd":1} {"background":true}`; `{"chargeAt":1} {"background":true}`; `{"isTrial":1} {"background":true}`; `{"trialEndsAt":1} {"background":true}`; `{"orgId":1,"status":1} {"background":true}`; `{"currentEnd":1,"status":1} {"background":true}`; `{"founderId":1,"status":1} {"background":true}`

### OfficeSubscriptionPayment

- **Collection:** `officesubscriptionpayments` · **Area:** Core platform · **Source:** `server/models/officeSubscriptionPayment.model.ts` (doc: `server/models/officeSubscriptionPayment.model.ts.md`) · **Options:** timestamps=true, autoIndex=null, capped=false
- **Used by:** `server/routes/officeSubscriptionAdmin.ts`, `server/services/officeSubscription.ts`
- **Hooks:** pre(save) ×5, pre(findOneAndReplace) ×1, pre(findOneAndUpdate) ×1, pre(replaceOne) ×1, pre(update) ×1, pre(updateOne) ×1, pre(updateMany) ×1, pre(remove) ×1, post(save) ×3, post(init) ×1
- **Statics/methods:** `initializeTimestamps()`

| Field | Type | Ref | Flags |
|---|---|---|---|
| `subscriptionId` | ObjectId | `OfficeSubscription` | required, index |
| `orgId` | ObjectId | `Organization` | required, index |
| `founderId` | ObjectId | `User` | required, index |
| `razorpayPaymentId` | String |  | required, unique, index |
| `razorpaySubscriptionId` | String |  | required, index |
| `razorpayOrderId` | String |  |  |
| `razorpayInvoiceId` | String |  |  |
| `invoiceShortUrl` | String |  |  |
| `amount` | Number |  | required |
| `currency` | String |  | default "INR" |
| `status` | String |  | default "created", enum ["created","authorized","capt… |
| `paymentNumber` | Number |  | required |
| `method` | String |  |  |
| `cardId` | String |  |  |
| `bank` | String |  |  |
| `wallet` | String |  |  |
| `vpa` | String |  |  |
| `fee` | Number |  |  |
| `tax` | Number |  |  |
| `notes` | Mixed |  |  |
| `commissionDistributed` | Boolean |  | default false |
| `commissionDistributionId` | ObjectId | `CommissionDistribution` |  |
| `paidAt` | Date |  | required |
| `_id` | ObjectId |  |  |
| `createdAt` | Date |  |  |
| `updatedAt` | Date |  |  |

**Indexes:** `{"subscriptionId":1} {"background":true}`; `{"orgId":1} {"background":true}`; `{"founderId":1} {"background":true}`; `{"razorpayPaymentId":1} {"unique":true,"background":true}`; `{"razorpaySubscriptionId":1} {"background":true}`; `{"subscriptionId":1,"paymentNumber":1} {"unique":true,"background":true}`; `{"status":1,"createdAt":-1} {"background":true}`; `{"commissionDistributed":1,"status":1} {"background":true}`

### OfficeUpgradeHistory

- **Collection:** `officeupgradehistories` · **Area:** Core platform · **Source:** `server/models/officeUpgradeHistory.model.ts` (doc: `server/models/officeUpgradeHistory.model.ts.md`) · **Options:** timestamps=true, autoIndex=null, capped=false
- **Used by:** `server/routes/officeSubscriptionAdmin.ts`, `server/services/officeSubscription.ts`
- **Hooks:** pre(save) ×5, pre(findOneAndReplace) ×1, pre(findOneAndUpdate) ×1, pre(replaceOne) ×1, pre(update) ×1, pre(updateOne) ×1, pre(updateMany) ×1, pre(remove) ×1, post(save) ×3, post(init) ×1
- **Statics/methods:** `initializeTimestamps()`

| Field | Type | Ref | Flags |
|---|---|---|---|
| `orgId` | ObjectId | `Organization` | required, index |
| `founderId` | ObjectId | `User` | required, index |
| `previousSubscriptionId` | ObjectId | `OfficeSubscription` | required |
| `previousRazorpaySubscriptionId` | String |  | required |
| `previousPlanSlug` | String |  | required |
| `newSubscriptionId` | ObjectId | `OfficeSubscription` | required |
| `newRazorpaySubscriptionId` | String |  | required |
| `newPlanSlug` | String |  | required |
| `creditCalculation` | Embedded |  | required |
| `walletTransactionId` | ObjectId | `StoreWallet` | required |
| `status` | String |  | index, default "completed", enum ["completed","failed"] |
| `completedAt` | Date |  | required |
| `errorMessage` | String |  |  |
| `_id` | ObjectId |  |  |
| `createdAt` | Date |  |  |
| `updatedAt` | Date |  |  |

**Indexes:** `{"orgId":1} {"background":true}`; `{"founderId":1} {"background":true}`; `{"status":1} {"background":true}`; `{"orgId":1,"status":1} {"background":true}`; `{"createdAt":-1} {"background":true}`

### OpenClawAgent

- **Collection:** `openclawagents` · **Area:** Core platform · **Source:** `server/models/openclawAgent.model.ts` (doc: `server/models/openclawAgent.model.ts.md`) · **Options:** timestamps=true, autoIndex=null, capped=false
- **Used by:** `server/realtime/openclawWs.ts`, `server/routes/openclawAgent.ts`, `server/routes/wallet.ts`, `server/scripts/migrate-openclaw-agents.ts`, `server/utils/billingUser.ts`, `server/utils/openclawAccess.ts`
- **Hooks:** pre(save) ×5, pre(findOneAndReplace) ×1, pre(findOneAndUpdate) ×1, pre(replaceOne) ×1, pre(update) ×1, pre(updateOne) ×1, pre(updateMany) ×1, pre(remove) ×1, post(save) ×3, post(init) ×1
- **Statics/methods:** `initializeTimestamps()`

| Field | Type | Ref | Flags |
|---|---|---|---|
| `agentId` | String |  | required, unique |
| `name` | String |  | required |
| `role` | String |  | default "" |
| `emoji` | String |  | default "" |
| `agentType` | String |  | default "default", enum ["default","qa","voice"] |
| `qaWelcomeMessage` | String |  | default "" |
| `qaPersonaInstructions` | String |  | default "" |
| `qaPageTitle` | String |  | default "" |
| `qaPageSubtitle` | String |  | default "" |
| `llmModel` | String |  | default null, enum ["openai/gpt-5.1","openai/gpt… |
| `orgId` | ObjectId | `Organization` | required |
| `createdBy` | ObjectId | `User` | required |
| `deletedAt` | Date |  | index, default null |
| `assignedUserIds` | [ObjectId] | `User` | default [] |
| `_id` | ObjectId |  |  |
| `createdAt` | Date |  |  |
| `updatedAt` | Date |  |  |

**Indexes:** `{"agentId":1} {"unique":true,"background":true}`; `{"deletedAt":1} {"background":true}`; `{"orgId":1} {"background":true}`; `{"createdBy":1} {"background":true}`; `{"orgId":1,"deletedAt":1} {"background":true}`

### OpenClawMessage

- **Collection:** `openclawmessages` · **Area:** Core platform · **Source:** `server/models/openclawMessage.model.ts` (doc: `server/models/openclawMessage.model.ts.md`) · **Options:** timestamps=true, autoIndex=null, capped=false
- **Used by:** `server/routes/internalChat.ts`, `server/routes/openclawMessages.ts`
- **Hooks:** pre(save) ×5, pre(findOneAndReplace) ×1, pre(findOneAndUpdate) ×1, pre(replaceOne) ×1, pre(update) ×1, pre(updateOne) ×1, pre(updateMany) ×1, pre(remove) ×1, post(save) ×3, post(init) ×1
- **Statics/methods:** `initializeTimestamps()`

| Field | Type | Ref | Flags |
|---|---|---|---|
| `userId` | ObjectId | `User` | required |
| `agentId` | String |  | required |
| `sessionId` | String |  | required |
| `role` | String |  | required, enum ["user","assistant"] |
| `content` | String |  | required |
| `_id` | ObjectId |  |  |
| `createdAt` | Date |  |  |
| `updatedAt` | Date |  |  |

**Indexes:** `{"userId":1,"agentId":1,"createdAt":1} {"background":true}`

### Organization

- **Collection:** `organizations` · **Area:** Core platform · **Source:** `server/models/organization.model.ts` (doc: `server/models/organization.model.ts.md`) · **Options:** timestamps=true, autoIndex=null, capped=false
- **Referenced by:** `AdminNotificationRule`, `AffiliateClick`, `AffiliateConversion`, `AffiliateLink`, `AivatarWalletTransaction`, `AppSubscription`, `Application`, `Approval`, `Auction`, `AuctionEscrow`, `AuctionSettlement`, `Availability`, `BondHolding`, `BondInstrument`, `BondLedgerEntry`, `BondPayoutEvent`, `Booking`, `CallBooking`, `CallOffering`, `CallPurchase`, `CampaignWallet`, `CampaignWalletTransaction`, `CashbackCode`, `CashbackDistribution`, `Channel`, `ChannelMembership`, `ChannelMembershipEvent`, `CollaborativeDocument`, `CombPlan`, `CommissionDistribution`, `ConferenceRoom`, `ContentCampaign`, `ContentEngagement`, `ContentPayout`, `ContentRewardsWalletTransaction`, `ContentSubmission`, `Coupon`, `CouponAssignment`, `CouponRule`, `CouponUsage`, `Course`, `CourseEnrollment`, `CoworkingSpaceBooking`, `CryptoTopupTransaction`, `Deal`, `Drop`, `Email`, `Event`, `EventProgram`, `FeedActivityRead`, `File`, `Floor`, `FloorCabinet`, `FloorFile`, `FranchiseOffer`, `FranchiseProgram`, `FranchiseReassignment`, `FranchiseTerritoryAssignment`, `GarageUniversityOnboarding`, `Group`, `GroupAiTask`, `Invite`, `Invoice`, `ItemReserveLicense`, `JobActivity`, `JobApplication`, `JobEvent`, `JobInterview`, `JobOffer`, `JobPosting`, `JobReward`, `JobsSettings`, `JoinRequest`, `LeaveRequest`, `Meet`, `Message`, `MissedCall`, `Notification`, `OfficeAddonPayment`, `OfficeAddonSubscription`, `OfficeSubscription`, `OfficeSubscriptionPayment`, `OfficeUpgradeHistory`, `OpenClawAgent`, `OrgConversionFee`, `OrgKyc`, `OrgRewardsWallet`, `OrganizationCabinet`, `OrganizationFile`, `OtpCode`, `PendingCouponGift`, `PendingReserveAssignment`, `PermissionGrant`, `PlatformCoupon`, `Playlist`, `Poll`, `Post`, `PostBookmark`, `PostComment`, `PostCommentLike`, `PostLike`, `PostRepost`, `Product`, `ProductOrder`, `RatingSummary`, `ReferralBonusPayout`, `Review`, `RoomBooking`, `Service`, `ServiceMilestoneMessage`, `ServiceOpt`, `ServiceReview`, `Settings`, `ShareableLink`, `SharedItem`, `StandaloneVideo`, `StoreCouponCommission`, `StoreCouponCommissionFire`, `StoreWallet`, `Subscription`, `SubscriptionPayment`, `SubscriptionPlan`, `SupportTicket`, `SupportTicketBoard`, `Task`, `TeamforceBranch`, `TeamforceBreakLog`, `TeamforceBreakSettings`, `TeamforceCandidate`, `TeamforceDepartment`, `TeamforceEmployeeProfile`, `TeamforceEmployeeTaxDeclaration`, `TeamforceLeavePolicy`, `TeamforceLeaveRequest`, `TeamforcePayrollConfig`, `TeamforcePayrollRun`, `TeamforcePayrollTransaction`, `TeamforceRecruitmentRequest`, `TeamforceSalaryStructure`, `TeamforceShift`, `TeamforceWeeklyOffPattern`, `TerritoryWalletTransaction`, `Testimonial`, `TimeTracking`, `Todo`, `UnilevelPlusPlan`, `User`, `UserActivity`, `UserCabinet`, `UserCryptoAddress`, `UserFile`, `UserNotification`, `Vacancy`, `WalletAccount`, `WalletTransaction`, `WebinarAttendance`, `WebinarProductPin`, `Withdrawal`, `WithdrawalPreference`, `Workshop`, `WorkshopRegistration`
- **Used by:** `scripts/test-franchise-e2e.ts`, `server/bat246/scripts/seedBat246.ts`, `server/bat246/scripts/seedBat246Product.ts`, `server/bat246/scripts/seedBat246ProductForOrg.ts`, `server/bat246/scripts/set-bat246-org-icon.ts`, `server/bat246/services/bat246Entry.service.ts`, `server/controllers/coworkingSpaceBooking.controller.ts`, `server/controllers/garageAdmin.controller.ts`, … +116 more
- **Hooks:** pre(save) ×6, pre(findOneAndReplace) ×1, pre(findOneAndUpdate) ×1, pre(replaceOne) ×1, pre(update) ×1, pre(updateOne) ×1, pre(updateMany) ×1, pre(remove) ×1, post(save) ×4, post(findOneAndUpdate) ×1, post(findOneAndDelete) ×1, post(deleteOne) ×1, post(init) ×1
- **Statics/methods:** `initializeTimestamps()`

| Field | Type | Ref | Flags |
|---|---|---|---|
| `name` | String |  | required |
| `slug` | String |  | unique, sparse |
| `size` | String |  |  |
| `location` | String |  |  |
| `city` | String |  |  |
| `state` | String |  |  |
| `country` | String |  |  |
| `postalCode` | String |  |  |
| `latitude` | Number |  |  |
| `longitude` | Number |  |  |
| `parent` | Boolean |  | default false |
| `description` | String |  |  |
| `headingText` | String |  |  |
| `subHeadingText` | String |  |  |
| `icon` | String |  |  |
| `coverPhoto` | String |  |  |
| `promoVideoLink` | String |  |  |
| `colored_logo` | String |  |  |
| `white_logo` | String |  |  |
| `colored_icon` | String |  |  |
| `white_icon` | String |  |  |
| `website_meta_title` | String |  |  |
| `website_meta_description` | String |  |  |
| `font` | String |  | default "" |
| `kycStatus` | String |  | index, enum ["not_requested","pending","s… |
| `kycVerifiedAt` | Date |  |  |
| `office_public` | Boolean |  | default false |
| `category` | String |  | default "" |
| `officeCreatedFromCryptobrand` | Boolean |  | index, default false |
| `whitelabelRequested` | Boolean |  | index, default false |
| `store.name` | String |  |  |
| `store.slug` | String |  |  |
| `store.description` | String |  |  |
| `store.headingText` | String |  |  |
| `store.subHeadingText` | String |  |  |
| `store.icon` | String |  |  |
| `store.coverPhoto` | String |  |  |
| `store.promoVideoLink` | String |  |  |
| `store.isActive` | Boolean |  | default true |
| `store.createdAt` | Date |  |  |
| `store.updatedAt` | Date |  |  |
| `domainConfig.type` | String |  | default "default", enum ["default","custom"] |
| `domainConfig.customDomain` | String |  |  |
| `domainConfig.verified` | Boolean |  | default false |
| `domainConfig.domainAddedToMailcow` | Boolean |  | default false |
| `domainConfig.dnsRecords` | [subdoc] |  |  |
| `domainConfig.verifiedAt` | Date |  |  |
| `mailboxConfig.created` | Boolean |  | default false |
| `mailboxConfig.email` | String |  |  |
| `mailboxConfig.localPart` | String |  |  |
| `mailboxConfig.domain` | String |  |  |
| `mailboxConfig.credentials` | String |  |  |
| `mailboxConfig.createdAt` | Date |  |  |
| `mailboxConfig.founderUserId` | ObjectId | `User` |  |
| `mailboxConfig.lastFetchedAt` | Date |  |  |
| `billingDetails.gstin` | String |  |  |
| `billingDetails.legalName` | String |  |  |
| `billingDetails.billingAddress.line1` | String |  |  |
| `billingDetails.billingAddress.line2` | String |  |  |
| `billingDetails.billingAddress.city` | String |  |  |
| `billingDetails.billingAddress.state` | String |  |  |
| `billingDetails.billingAddress.pincode` | String |  |  |
| `branding.primaryColor` | String |  | default "#FBD10D" |
| `branding.secondaryColor` | String |  |  |
| `emailSender.domain` | String |  |  |
| `emailSender.resendDomainId` | String |  |  |
| `emailSender.status` | String |  | default "not_started" |
| `emailSender.fromEmail` | String |  |  |
| `emailSender.fromName` | String |  |  |
| `emailSender.dnsRecords` | [subdoc] |  |  |
| `emailSender.lastCheckedAt` | Date |  |  |
| `emailSender.verifiedAt` | Date |  |  |
| `welcomeEmail.templateId` | String |  |  |
| `welcomeEmail.templateName` | String |  |  |
| `welcomeEmail.templateHtml` | String |  |  |
| `welcomeEmail.syncedAt` | Date |  |  |
| `source` | String |  | index |
| `graceProgram.platformId` | ObjectId | `ThirdPartyClient` |  |
| `graceProgram.platformName` | String |  |  |
| `graceProgram.startedAt` | Date |  |  |
| `graceProgram.expiresAt` | Date |  | index |
| `graceProgram.createdByUserId` | ObjectId | `User` |  |
| `paymentConfig.platformFeePercentage` | Number |  |  |
| `paymentConfig.platformFeeUpdatedAt` | Date |  |  |
| `paymentConfig.platformFeeUpdatedBy` | ObjectId | `GarageAdmin` |  |
| `assignedAdminId` | ObjectId | `GarageAdmin` | index |
| `assignedAt` | Date |  |  |
| `assignedBy` | ObjectId | `GarageAdmin` |  |
| `customAppDomains` | [subdoc] |  |  |
| `_id` | ObjectId |  |  |
| `createdAt` | Date |  |  |
| `updatedAt` | Date |  |  |

**Indexes:** `{"slug":1} {"unique":true,"sparse":true,"background":true}`; `{"kycStatus":1} {"background":true}`; `{"officeCreatedFromCryptobrand":1} {"background":true}`; `{"whitelabelRequested":1} {"background":true}`; `{"source":1} {"background":true}`; `{"graceProgram.expiresAt":1} {"background":true}`; `{"assignedAdminId":1} {"background":true}`; `{"store.slug":1} {"sparse":true,"background":true}`

### OrganizationCabinet

- **Collection:** `organizationcabinets` · **Area:** Core platform · **Source:** `server/models/cabinet.model.ts` (doc: `server/models/cabinet.model.ts.md`) · **Options:** timestamps=true, autoIndex=null, capped=false
- **Referenced by:** `OrganizationCabinet`, `OrganizationFile`
- **Used by:** `server/controllers/cabinet.controller.ts`, `server/controllers/collaborativeDocument.controller.ts`, `server/controllers/shareableLink.controller.ts`, `server/routes/dailyWebhook.ts`, `server/routes/evergreen.ts`, `server/routes/learnInit.ts`, `server/routes/livekitRecording.ts`, `server/routes/public.ts`, … +6 more
- **Hooks:** pre(save) ×5, pre(findOneAndReplace) ×1, pre(findOneAndUpdate) ×1, pre(replaceOne) ×1, pre(update) ×1, pre(updateOne) ×1, pre(updateMany) ×1, pre(remove) ×1, post(save) ×3, post(init) ×1
- **Statics/methods:** `initializeTimestamps()`

| Field | Type | Ref | Flags |
|---|---|---|---|
| `name` | String |  | required |
| `description` | String |  |  |
| `owner` | ObjectId | `User` | required |
| `organization` | ObjectId | `Organization` | required |
| `parentCabinet` | ObjectId | `OrganizationCabinet` | default null |
| `path` | String |  | required |
| `isRoot` | Boolean |  | default true |
| `permissions` | Mixed |  | default fn  |
| `metadata` | Mixed |  | default fn  |
| `_id` | ObjectId |  |  |
| `createdAt` | Date |  |  |
| `updatedAt` | Date |  |  |

**Indexes:** `{"organization":1} {"background":true}`; `{"parentCabinet":1} {"background":true}`; `{"path":1} {"background":true}`

### OrganizationFile

- **Collection:** `organizationfiles` · **Area:** Core platform · **Source:** `server/models/cabinet.model.ts` (doc: `server/models/cabinet.model.ts.md`) · **Options:** timestamps=true, autoIndex=null, capped=false
- **Referenced by:** `OrganizationFile`
- **Used by:** `server/controllers/cabinet.controller.ts`, `server/controllers/collaborativeDocument.controller.ts`, `server/controllers/shareableLink.controller.ts`, `server/routes/dailyWebhook.ts`, `server/routes/evergreen.ts`, `server/routes/learnInit.ts`, `server/routes/livekitRecording.ts`, `server/routes/public.ts`, … +6 more
- **Hooks:** pre(save) ×5, pre(findOneAndReplace) ×1, pre(findOneAndUpdate) ×1, pre(replaceOne) ×1, pre(update) ×1, pre(updateOne) ×1, pre(updateMany) ×1, pre(remove) ×1, post(save) ×3, post(init) ×1
- **Statics/methods:** `initializeTimestamps()`

| Field | Type | Ref | Flags |
|---|---|---|---|
| `name` | String |  | required |
| `originalName` | String |  | required |
| `description` | String |  |  |
| `owner` | ObjectId | `User` | required |
| `organization` | ObjectId | `Organization` | required |
| `cabinet` | ObjectId | `OrganizationCabinet` | required |
| `s3Key` | String |  | required |
| `s3Bucket` | String |  | required |
| `s3Region` | String |  | required |
| `mimeType` | String |  | required |
| `size` | Number |  | required |
| `extension` | String |  |  |
| `path` | String |  | required |
| `isPublic` | Boolean |  | default false |
| `sharing.access` | String |  | default "office", enum ["office","public"] |
| `sharing.updatedAt` | Date |  | default null |
| `sharing.updatedBy` | ObjectId | `User` | default null |
| `permissions` | Mixed |  | default fn  |
| `tags` | [String] |  |  |
| `metadata` | Mixed |  | default fn  |
| `status` | String |  | default "uploading", enum ["uploading","uploaded","proc… |
| `version` | Number |  | default 1 |
| `parentFile` | ObjectId | `OrganizationFile` | default null |
| `_id` | ObjectId |  |  |
| `createdAt` | Date |  |  |
| `updatedAt` | Date |  |  |

**Indexes:** `{"organization":1} {"background":true}`; `{"cabinet":1} {"background":true}`; `{"path":1} {"background":true}`; `{"s3Key":1} {"background":true}`; `{"mimeType":1} {"background":true}`; `{"tags":1} {"background":true}`

### OrgCategory

- **Collection:** `orgcategories` · **Area:** Core platform · **Source:** `server/models/orgCategory.model.ts` (doc: `server/models/orgCategory.model.ts.md`) · **Options:** timestamps=true, autoIndex=null, capped=false
- **Used by:** `server/scripts/seed-org-categories.ts`, `server/services/orgCategory.ts`
- **Hooks:** pre(save) ×5, pre(findOneAndReplace) ×1, pre(findOneAndUpdate) ×1, pre(replaceOne) ×1, pre(update) ×1, pre(updateOne) ×1, pre(updateMany) ×1, pre(remove) ×1, post(save) ×3, post(init) ×1
- **Statics/methods:** `initializeTimestamps()`

| Field | Type | Ref | Flags |
|---|---|---|---|
| `name` | String |  | required, unique |
| `slug` | String |  | required, unique |
| `createdByAdminId` | ObjectId | `GarageAdmin` | default null |
| `_id` | ObjectId |  |  |
| `createdAt` | Date |  |  |
| `updatedAt` | Date |  |  |

**Indexes:** `{"name":1} {"unique":true,"background":true}`; `{"slug":1} {"unique":true,"background":true}`; `{"name":1} {"unique":true,"collation":{"locale":"en","strength":2},"background":true}`

### OrgConversionFee

- **Collection:** `org_conversion_fees` · **Area:** Core platform · **Source:** `server/models/orgConversionFee.model.ts` (doc: `server/models/orgConversionFee.model.ts.md`) · **Options:** timestamps=true, autoIndex=null, capped=false
- **Used by:** `server/routes/wallet.ts`, `server/services/conversionFee.ts`
- **Hooks:** pre(save) ×5, pre(findOneAndReplace) ×1, pre(findOneAndUpdate) ×1, pre(replaceOne) ×1, pre(update) ×1, pre(updateOne) ×1, pre(updateMany) ×1, pre(remove) ×1, post(save) ×3, post(init) ×1
- **Statics/methods:** `initializeTimestamps()`

| Field | Type | Ref | Flags |
|---|---|---|---|
| `orgId` | ObjectId | `Organization` | required, unique, index |
| `defaultFeeBps` | Number |  | default 0 |
| `compPlanPercentage` | Number |  | default 0 |
| `pairs` | [subdoc] |  | default [] |
| `updatedBy` | ObjectId | `User` | default null |
| `_id` | ObjectId |  |  |
| `createdAt` | Date |  |  |
| `updatedAt` | Date |  |  |

**Indexes:** `{"orgId":1} {"unique":true,"background":true}`

### OrgKyc

- **Collection:** `orgkycs` · **Area:** Core platform · **Source:** `server/models/orgKyc.model.ts` (doc: `server/models/orgKyc.model.ts.md`) · **Options:** timestamps=true, autoIndex=null, capped=false
- **Used by:** `server/routes/garageAdminOrgKyc.ts`, `server/routes/orgKyc.ts`, `server/services/orgKyc.service.ts`
- **Hooks:** pre(save) ×5, pre(findOneAndReplace) ×1, pre(findOneAndUpdate) ×1, pre(replaceOne) ×1, pre(update) ×1, pre(updateOne) ×1, pre(updateMany) ×1, pre(remove) ×1, post(save) ×3, post(init) ×1
- **Statics/methods:** `initializeTimestamps()`

| Field | Type | Ref | Flags |
|---|---|---|---|
| `orgId` | ObjectId | `Organization` | required, unique, index |
| `status` | String |  | index, default "not_requested", enum ["not_requested","pending","s… |
| `requirements` | [subdoc] |  | default [] |
| `submissions` | [subdoc] |  | default [] |
| `reviewNote` | String |  |  |
| `requestedAt` | Date |  |  |
| `requestedBy` | ObjectId | `GarageAdmin` |  |
| `submittedAt` | Date |  |  |
| `reviewedAt` | Date |  |  |
| `reviewedBy` | ObjectId | `GarageAdmin` |  |
| `verifiedAt` | Date |  |  |
| `_id` | ObjectId |  |  |
| `createdAt` | Date |  |  |
| `updatedAt` | Date |  |  |

**Indexes:** `{"orgId":1} {"unique":true,"background":true}`; `{"status":1} {"background":true}`

### OrgRewardsWallet

- **Collection:** `orgrewardswallets` · **Area:** Core platform · **Source:** `server/models/orgRewardsWallet.model.ts` (doc: `server/models/orgRewardsWallet.model.ts.md`) · **Options:** timestamps=true, autoIndex=null, capped=false
- **Used by:** `server/controllers/garageAdmin.controller.ts`, `server/scripts/migrate-content-rewards-to-org-rewards.ts`, `server/services/campaignWallet.ts`, `server/services/contentRewardsWallet.ts`, `server/services/wallet.ts`, `server/services/withdrawal.ts`
- **Hooks:** pre(save) ×5, pre(findOneAndReplace) ×1, pre(findOneAndUpdate) ×1, pre(replaceOne) ×1, pre(update) ×1, pre(updateOne) ×1, pre(updateMany) ×1, pre(remove) ×1, post(save) ×3, post(init) ×1
- **Statics/methods:** `initializeTimestamps()`

| Field | Type | Ref | Flags |
|---|---|---|---|
| `userId` | ObjectId | `User` | required, index |
| `orgId` | ObjectId | `Organization` | required, index |
| `balance` | Number |  | required, default 0 |
| `totalEarnings` | Number |  | required, default 0 |
| `totalWithdrawn` | Number |  | required, default 0 |
| `transactions` | [subdoc] |  | default [] |
| `_id` | ObjectId |  |  |
| `createdAt` | Date |  |  |
| `updatedAt` | Date |  |  |

**Indexes:** `{"userId":1} {"background":true}`; `{"orgId":1} {"background":true}`; `{"userId":1,"orgId":1} {"unique":true,"background":true}`; `{"orgId":1,"balance":-1} {"background":true}`

### OtpCode

- **Collection:** `otpcodes` · **Area:** Core platform · **Source:** `server/models/otpcode.model.ts` (doc: `server/models/otpcode.model.ts.md`) · **Options:** timestamps=true, autoIndex=null, capped=false
- **Used by:** `server/routes/affiliate.ts`, `server/routes/auth.ts`, `server/scripts/test-auth-identifier-contract.ts`, `server/services/otp.ts`
- **Hooks:** pre(save) ×5, pre(findOneAndReplace) ×1, pre(findOneAndUpdate) ×1, pre(replaceOne) ×1, pre(update) ×1, pre(updateOne) ×1, pre(updateMany) ×1, pre(remove) ×1, post(save) ×3, post(init) ×1
- **Statics/methods:** `initializeTimestamps()`

| Field | Type | Ref | Flags |
|---|---|---|---|
| `email` | String |  | required, index |
| `code` | String |  | required |
| `purpose` | String |  | required, index, enum ["login","invite","guest-logi… |
| `orgId` | ObjectId | `Organization` |  |
| `expiresAt` | Date |  | required |
| `_id` | ObjectId |  |  |
| `createdAt` | Date |  |  |
| `updatedAt` | Date |  |  |

**Indexes:** `{"email":1} {"background":true}`; `{"purpose":1} {"background":true}`; `{"expiresAt":1} {"expireAfterSeconds":0,"background":true}`

### OtpCodeAccessLog

- **Collection:** `otp_code_access_logs` · **Area:** Core platform · **Source:** `server/models/otpCodeAccessLog.model.ts` (doc: `server/models/otpCodeAccessLog.model.ts.md`) · **Options:** timestamps=true, autoIndex=null, capped=false
- **Used by:** `server/routes/auth.ts`
- **Hooks:** pre(save) ×5, pre(findOneAndReplace) ×1, pre(findOneAndUpdate) ×1, pre(replaceOne) ×1, pre(update) ×1, pre(updateOne) ×1, pre(updateMany) ×1, pre(remove) ×1, post(save) ×3, post(init) ×1
- **Statics/methods:** `initializeTimestamps()`

| Field | Type | Ref | Flags |
|---|---|---|---|
| `adminId` | ObjectId | `GarageAdmin` | required |
| `adminEmail` | String |  | required |
| `isSuperAdmin` | Boolean |  | default false |
| `page` | String |  | required, enum ["otp_codes","phone_otp_codes… |
| `bucket` | Date |  | required |
| `views` | Number |  | default 0 |
| `codesShown` | Number |  | default 0 |
| `ip` | String |  | default null |
| `lastViewedAt` | Date |  |  |
| `_id` | ObjectId |  |  |
| `createdAt` | Date |  |  |
| `updatedAt` | Date |  |  |

**Indexes:** `{"adminId":1,"page":1,"bucket":1} {"unique":true,"background":true}`; `{"createdAt":-1} {"background":true}`

### PendingCouponGift

- **Collection:** `pendingcoupongifts` · **Area:** Core platform · **Source:** `server/models/pendingCouponGift.model.ts` (doc: `server/models/pendingCouponGift.model.ts.md`) · **Options:** timestamps=true, autoIndex=null, capped=false
- **Referenced by:** `CouponAssignment`
- **Used by:** `server/services/pendingCouponGift.ts`
- **Hooks:** pre(save) ×5, pre(findOneAndReplace) ×1, pre(findOneAndUpdate) ×1, pre(replaceOne) ×1, pre(update) ×1, pre(updateOne) ×1, pre(updateMany) ×1, pre(remove) ×1, post(save) ×3, post(init) ×1
- **Statics/methods:** `initializeTimestamps()`

| Field | Type | Ref | Flags |
|---|---|---|---|
| `fromUserId` | ObjectId | `User` | required, index |
| `toUserId` | ObjectId | `User` | required, index |
| `fromAssignmentId` | ObjectId | `CouponAssignment` | required |
| `couponId` | ObjectId |  | required |
| `couponSource` | String |  | required, enum ["platform","legacy"] |
| `couponCode` | String |  | required |
| `orgId` | ObjectId | `Organization` | required |
| `priceUsd` | Number |  | required |
| `message` | String |  |  |
| `status` | String |  | index, default "pending", enum ["pending","approved","reject… |
| `respondedAt` | Date |  |  |
| `resolutionTxRefs` | Embedded |  |  |
| `_id` | ObjectId |  |  |
| `createdAt` | Date |  |  |
| `updatedAt` | Date |  |  |

**Indexes:** `{"fromUserId":1} {"background":true}`; `{"toUserId":1} {"background":true}`; `{"status":1} {"background":true}`; `{"fromAssignmentId":1} {"unique":true,"partialFilterExpression":{"status":"pending"},"background":true}`; `{"toUserId":1,"status":1,"createdAt":-1} {"background":true}`; `{"fromUserId":1,"status":1,"createdAt":-1} {"background":true}`

### PendingInvite

- **Collection:** `pendinginvites` · **Area:** Core platform · **Source:** `server/models/pendingInvite.model.ts` (doc: `server/models/pendingInvite.model.ts.md`) · **Options:** timestamps=true, autoIndex=null, capped=false
- **Used by:** `server/services/pendingInvite.ts`
- **Hooks:** pre(save) ×5, pre(findOneAndReplace) ×1, pre(findOneAndUpdate) ×1, pre(replaceOne) ×1, pre(update) ×1, pre(updateOne) ×1, pre(updateMany) ×1, pre(remove) ×1, post(save) ×3, post(init) ×1
- **Statics/methods:** `initializeTimestamps()`

| Field | Type | Ref | Flags |
|---|---|---|---|
| `identifier` | String |  | required |
| `kind` | String |  | required, enum ["email","phone"] |
| `affiliateId` | String |  | required |
| `savedAt` | Date |  | required |
| `consumedAt` | Date |  | default null |
| `consumedBy` | ObjectId | `User` | default null |
| `_id` | ObjectId |  |  |
| `createdAt` | Date |  |  |
| `updatedAt` | Date |  |  |

**Indexes:** `{"identifier":1,"consumedAt":1,"savedAt":-1} {"name":"pending_invite_lookup","background":true}`; `{"savedAt":1} {"expireAfterSeconds":3888000,"name":"pending_invite_ttl_45d","background":true}`

### PendingReserveAssignment

- **Collection:** `pendingreserveassignments` · **Area:** Core platform · **Source:** `server/models/pendingReserveAssignment.model.ts` (doc: `server/models/pendingReserveAssignment.model.ts.md`) · **Options:** timestamps=true, autoIndex=null, capped=false
- **Referenced by:** `ItemReserveLicense`, `UserNotification`
- **Used by:** `server/services/pendingReserveAssignment.ts`
- **Hooks:** pre(save) ×5, pre(findOneAndReplace) ×1, pre(findOneAndUpdate) ×1, pre(replaceOne) ×1, pre(update) ×1, pre(updateOne) ×1, pre(updateMany) ×1, pre(remove) ×1, post(save) ×3, post(init) ×1
- **Statics/methods:** `initializeTimestamps()`

| Field | Type | Ref | Flags |
|---|---|---|---|
| `fromUserId` | ObjectId | `User` | required, index |
| `toUserId` | ObjectId | `User` | required, index |
| `fromLicenseId` | ObjectId | `ItemReserveLicense` | required |
| `itemType` | String |  | required, enum ["course","channel","workshop… |
| `itemId` | ObjectId |  | required |
| `itemName` | String |  | required |
| `itemImage` | String |  |  |
| `unitPrice` | Number |  | required |
| `orgId` | ObjectId | `Organization` | required |
| `priceUsd` | Number |  | required |
| `currency` | String |  | default "USD" |
| `message` | String |  |  |
| `status` | String |  | index, default "pending", enum ["pending","approved","reject… |
| `respondedAt` | Date |  |  |
| `resolutionTxRefs` | Embedded |  |  |
| `_id` | ObjectId |  |  |
| `createdAt` | Date |  |  |
| `updatedAt` | Date |  |  |

**Indexes:** `{"fromUserId":1} {"background":true}`; `{"toUserId":1} {"background":true}`; `{"status":1} {"background":true}`; `{"fromLicenseId":1} {"unique":true,"partialFilterExpression":{"status":"pending"},"background":true}`; `{"toUserId":1,"status":1,"createdAt":-1} {"background":true}`; `{"fromUserId":1,"status":1,"createdAt":-1} {"background":true}`

### PermissionGrant

- **Collection:** `permissiongrants` · **Area:** Core platform · **Source:** `server/models/permissionGrant.model.ts` (doc: `server/models/permissionGrant.model.ts.md`) · **Options:** timestamps=true, autoIndex=null, capped=false
- **Referenced by:** `UserNotification`
- **Used by:** `server/index.ts`, `server/routes/rbac.ts`, `server/services/permissionGrant.ts`
- **Hooks:** pre(save) ×5, pre(findOneAndReplace) ×1, pre(findOneAndUpdate) ×1, pre(replaceOne) ×1, pre(update) ×1, pre(updateOne) ×1, pre(updateMany) ×1, pre(remove) ×1, post(save) ×3, post(init) ×1
- **Statics/methods:** `initializeTimestamps()`

| Field | Type | Ref | Flags |
|---|---|---|---|
| `orgId` | ObjectId | `Organization` | required, index |
| `userId` | ObjectId | `User` | required, index |
| `module` | String |  | required, enum ["community","courses","live_… |
| `action` | String |  | required, enum ["grant","revoke"] |
| `status` | String |  | required, enum ["pending","accepted","declin… |
| `grantedBy` | ObjectId | `User` | required |
| `expiresAt` | Date |  |  |
| `respondedAt` | Date |  |  |
| `_id` | ObjectId |  |  |
| `createdAt` | Date |  |  |
| `updatedAt` | Date |  |  |

**Indexes:** `{"orgId":1} {"background":true}`; `{"userId":1} {"background":true}`; `{"orgId":1,"userId":1,"module":1} {"unique":true,"partialFilterExpression":{"status":"pending"},"background":true}`; `{"orgId":1,"status":1,"createdAt":-1} {"background":true}`; `{"userId":1,"status":1,"createdAt":-1} {"background":true}`; `{"status":1,"expiresAt":1} {"background":true}`

### PhoneVerificationEvent

- **Collection:** `phoneverificationevents` · **Area:** Core platform · **Source:** `server/models/phoneVerificationEvent.model.ts` (doc: `server/models/phoneVerificationEvent.model.ts.md`) · **Options:** timestamps=true, autoIndex=null, capped=false
- **Used by:** `server/routes/auth.ts`, `server/routes/webinarRoutes.ts`
- **Hooks:** pre(save) ×5, pre(findOneAndReplace) ×1, pre(findOneAndUpdate) ×1, pre(replaceOne) ×1, pre(update) ×1, pre(updateOne) ×1, pre(updateMany) ×1, pre(remove) ×1, post(save) ×3, post(init) ×1
- **Statics/methods:** `initializeTimestamps()`

| Field | Type | Ref | Flags |
|---|---|---|---|
| `userId` | ObjectId | `User` | required, index |
| `phone` | String |  | required |
| `email` | String |  |  |
| `name` | String |  |  |
| `workshopId` | ObjectId | `Workshop` | index |
| `sessionDate` | Date |  |  |
| `itemType` | String |  |  |
| `itemId` | String |  |  |
| `itemName` | String |  |  |
| `source` | String |  | default "profile" |
| `startedComboWindow` | Boolean |  | default false |
| `verifiedAt` | Date |  | required |
| `_id` | ObjectId |  |  |
| `createdAt` | Date |  |  |
| `updatedAt` | Date |  |  |

**Indexes:** `{"userId":1} {"background":true}`; `{"workshopId":1} {"background":true}`

### PincodeData

- **Collection:** `pincodedatas` · **Area:** Core platform · **Source:** `server/models/pincodeData.model.ts` (doc: `server/models/pincodeData.model.ts.md`) · **Options:** timestamps=false, autoIndex=null, capped=false
- **Used by:** `server/scripts/seedPincodes.ts`, `server/utils/geocoding.ts`
- **Hooks:** pre(save) ×4, pre(remove) ×1, post(save) ×3, post(init) ×1

| Field | Type | Ref | Flags |
|---|---|---|---|
| `code` | String |  | required |
| `prefix4` | String |  | required |
| `prefix3` | String |  | required |
| `city` | String |  | required |
| `state` | String |  | required |
| `country` | String |  | required, default "India" |
| `_id` | ObjectId |  |  |

**Indexes:** `{"code":1} {"unique":true,"background":true}`; `{"prefix4":1} {"background":true}`; `{"prefix3":1} {"background":true}`

### PlatformCoupon

- **Collection:** `platformcoupons` · **Area:** Core platform · **Source:** `server/models/platformCoupon.model.ts` (doc: `server/models/platformCoupon.model.ts.md`) · **Options:** timestamps=true, autoIndex=null, capped=false
- **Referenced by:** `CouponRule`, `PlatformCouponRedemption`, `StoreCouponCommissionFire`
- **Used by:** `server/models/platformCouponRedemption.model.ts`, `server/routes/adminCouponRules.ts`, `server/routes/founderCouponRules.ts`, `server/routes/founderPlatformCoupons.ts`, `server/routes/founderStoreCommissions.ts`, `server/routes/rewards.ts`, `server/routes/userRewards.ts`, `server/scripts/grant-networkchain-coupon-hiren.ts`, … +6 more
- **Hooks:** pre(save) ×5, pre(findOneAndReplace) ×1, pre(findOneAndUpdate) ×1, pre(replaceOne) ×1, pre(update) ×1, pre(updateOne) ×1, pre(updateMany) ×1, pre(validate) ×1, pre(remove) ×1, post(save) ×3, post(init) ×1
- **Statics/methods:** `initializeTimestamps()`

| Field | Type | Ref | Flags |
|---|---|---|---|
| `code` | String |  | required, unique |
| `name` | String |  | required |
| `description` | String |  |  |
| `media` | String |  |  |
| `productType` | String |  | required, index, enum ["office_plan","unilevel_plus… |
| `discountType` | String |  | required, enum ["fixed","percent"] |
| `discountValue` | Number |  | required |
| `currency` | String |  | required, default "USD", enum ["USD","INR"] |
| `maxDiscountAmount` | Number |  |  |
| `cycleCount` | Number |  |  |
| `status` | String |  | index, default "active", enum ["active","inactive","expired… |
| `validFrom` | Date |  | required, default fn now |
| `validUntil` | Date |  |  |
| `maxUsageCount` | Number |  |  |
| `maxUsagePerUser` | Number |  |  |
| `currentUsageCount` | Number |  | default 0 |
| `minOrderAmount` | Number |  |  |
| `createdBy` | ObjectId |  | required |
| `createdByType` | String |  | required, enum ["garage_admin","founder"] |
| `scope` | String |  | required, index, default "platform", enum ["platform","organization"] |
| `orgId` | ObjectId | `Organization` | index |
| `specificItemIds` | [ObjectId] |  |  |
| `_id` | ObjectId |  |  |
| `createdAt` | Date |  |  |
| `updatedAt` | Date |  |  |

**Indexes:** `{"code":1} {"unique":true,"background":true}`; `{"productType":1} {"background":true}`; `{"status":1} {"background":true}`; `{"scope":1} {"background":true}`; `{"orgId":1} {"background":true}`; `{"productType":1,"status":1} {"background":true}`; `{"status":1,"validFrom":1,"validUntil":1} {"background":true}`; `{"scope":1,"orgId":1,"status":1} {"background":true}`

### PlatformCouponRedemption

- **Collection:** `platformcouponredemptions` · **Area:** Core platform · **Source:** `server/models/platformCouponRedemption.model.ts` (doc: `server/models/platformCouponRedemption.model.ts.md`) · **Options:** timestamps=true, autoIndex=null, capped=false
- **Used by:** `server/scripts/grant-networkchain-coupon-hiren.ts`, `server/services/couponAssignment.ts`, `server/services/invoice.ts`, `server/services/platformCoupon.ts`, `server/services/thirdPartyTerms.ts`
- **Hooks:** pre(save) ×5, pre(findOneAndReplace) ×1, pre(findOneAndUpdate) ×1, pre(replaceOne) ×1, pre(update) ×1, pre(updateOne) ×1, pre(updateMany) ×1, pre(remove) ×1, post(save) ×3, post(init) ×1
- **Statics/methods:** `initializeTimestamps()`

| Field | Type | Ref | Flags |
|---|---|---|---|
| `couponId` | ObjectId | `PlatformCoupon` | required, index |
| `couponCode` | String |  | required |
| `userId` | ObjectId | `User` | required |
| `productType` | String |  | required, enum ["office_plan","unilevel_plus… |
| `parentInvoiceId` | ObjectId | `Invoice` | index |
| `invoiceId` | ObjectId | `Invoice` |  |
| `cycleCount` | Number |  | required, default 1 |
| `cyclesApplied` | Number |  | required, default 0 |
| `discountType` | String |  | required, enum ["fixed","percent"] |
| `discountValue` | Number |  | required |
| `maxDiscountAmount` | Number |  |  |
| `currency` | String |  | required, default "USD", enum ["USD","INR"] |
| `status` | String |  | index, default "active", enum ["active","exhausted","cancel… |
| `_id` | ObjectId |  |  |
| `createdAt` | Date |  |  |
| `updatedAt` | Date |  |  |

**Indexes:** `{"couponId":1} {"background":true}`; `{"parentInvoiceId":1} {"background":true}`; `{"status":1} {"background":true}`; `{"invoiceId":1} {"unique":true,"sparse":true,"background":true}`; `{"userId":1,"couponId":1} {"background":true}`

### Playlist

- **Collection:** `playlists` · **Area:** Core platform · **Source:** `server/models/playlist.model.ts` (doc: `server/models/playlist.model.ts.md`) · **Options:** timestamps=true, autoIndex=null, capped=false
- **Used by:** `server/routes/feed.ts`, `server/routes/public.ts`, `server/services/playlist.ts`
- **Hooks:** pre(save) ×6, pre(findOneAndReplace) ×1, pre(findOneAndUpdate) ×1, pre(replaceOne) ×1, pre(update) ×1, pre(updateOne) ×1, pre(updateMany) ×1, pre(remove) ×1, post(save) ×3, post(init) ×1
- **Statics/methods:** `initializeTimestamps()`

| Field | Type | Ref | Flags |
|---|---|---|---|
| `title` | String |  | required |
| `description` | String |  |  |
| `coverImage` | String |  |  |
| `organizationId` | ObjectId | `Organization` | required, index |
| `createdBy` | ObjectId | `User` | required, index |
| `type` | String |  | required, default "learner", enum ["founder","learner"] |
| `isPublished` | Boolean |  | default false |
| `videoEntries` | [subdoc] |  | default [] |
| `videoIds` | [ObjectId] |  |  |
| `videoCount` | Number |  | default 0 |
| `_id` | ObjectId |  |  |
| `createdAt` | Date |  |  |
| `updatedAt` | Date |  |  |

**Indexes:** `{"organizationId":1} {"background":true}`; `{"createdBy":1} {"background":true}`; `{"organizationId":1,"type":1,"isPublished":1} {"background":true}`; `{"createdBy":1,"type":1} {"background":true}`

### Poll

- **Collection:** `polls` · **Area:** Core platform · **Source:** `server/models/poll.model.ts` (doc: `server/models/poll.model.ts.md`) · **Options:** timestamps=true, autoIndex=null, capped=false
- **Referenced by:** `PollVote`
- **Used by:** `server/routes/public.ts`, `server/services/feed.ts`
- **Hooks:** pre(save) ×5, pre(findOneAndReplace) ×1, pre(findOneAndUpdate) ×1, pre(replaceOne) ×1, pre(update) ×1, pre(updateOne) ×1, pre(updateMany) ×1, pre(remove) ×1, post(save) ×3, post(init) ×1
- **Statics/methods:** `initializeTimestamps()`

| Field | Type | Ref | Flags |
|---|---|---|---|
| `postId` | ObjectId | `Post` | required, unique, index |
| `orgId` | ObjectId | `Organization` | required, index |
| `question` | String |  | required |
| `options` | [subdoc] |  |  |
| `totalVotes` | Number |  | default 0 |
| `endsAt` | Date |  | required |
| `isMultipleChoice` | Boolean |  | default false |
| `isActive` | Boolean |  | default true |
| `_id` | ObjectId |  |  |
| `createdAt` | Date |  |  |
| `updatedAt` | Date |  |  |

**Indexes:** `{"postId":1} {"unique":true,"background":true}`; `{"orgId":1} {"background":true}`; `{"orgId":1,"isActive":1,"endsAt":1} {"background":true}`

### PollVote

- **Collection:** `pollvotes` · **Area:** Core platform · **Source:** `server/models/pollVote.model.ts` (doc: `server/models/pollVote.model.ts.md`) · **Options:** timestamps=true, autoIndex=null, capped=false
- **Used by:** `server/services/feed.ts`, `server/services/memberCleanup.service.ts`
- **Hooks:** pre(save) ×5, pre(findOneAndReplace) ×1, pre(findOneAndUpdate) ×1, pre(replaceOne) ×1, pre(update) ×1, pre(updateOne) ×1, pre(updateMany) ×1, pre(remove) ×1, post(save) ×3, post(init) ×1
- **Statics/methods:** `initializeTimestamps()`

| Field | Type | Ref | Flags |
|---|---|---|---|
| `pollId` | ObjectId | `Poll` | required, index |
| `userId` | ObjectId | `User` | required, index |
| `optionIds` | [ObjectId] |  |  |
| `_id` | ObjectId |  |  |
| `createdAt` | Date |  |  |
| `updatedAt` | Date |  |  |

**Indexes:** `{"pollId":1} {"background":true}`; `{"userId":1} {"background":true}`; `{"pollId":1,"userId":1} {"unique":true,"background":true}`

### Post

- **Collection:** `posts` · **Area:** Core platform · **Source:** `server/models/post.model.ts` (doc: `server/models/post.model.ts.md`) · **Options:** timestamps=true, autoIndex=null, capped=false
- **Referenced by:** `Poll`, `Post`, `PostBookmark`, `PostComment`, `PostLike`, `PostRepost`, `UserNotification`
- **Used by:** `server/models/postComment.model.ts`, `server/routes/contentEngagement.ts`, `server/routes/feed.ts`, `server/routes/public.ts`, `server/services/downlineMemberPurchases.ts`, `server/services/feed.ts`, `server/services/feedActivity.ts`, `server/services/memberCleanup.service.ts`
- **Hooks:** pre(save) ×5, pre(findOneAndReplace) ×1, pre(findOneAndUpdate) ×1, pre(replaceOne) ×1, pre(update) ×1, pre(updateOne) ×1, pre(updateMany) ×1, pre(remove) ×1, post(save) ×3, post(init) ×1
- **Statics/methods:** `initializeTimestamps()`

| Field | Type | Ref | Flags |
|---|---|---|---|
| `content` | String |  | required |
| `authorId` | ObjectId | `User` | required, index |
| `orgId` | ObjectId | `Organization` | required, index |
| `channelIds` | [ObjectId] | `Channel` |  |
| `tags` | [String] |  |  |
| `mentions` | [ObjectId] | `User` |  |
| `attachments` | [subdoc] |  |  |
| `linkPreviews` | [subdoc] |  |  |
| `likesCount` | Number |  | default 0 |
| `reactionsCount.like` | Number |  | default 0 |
| `reactionsCount.love` | Number |  | default 0 |
| `reactionsCount.haha` | Number |  | default 0 |
| `reactionsCount.wow` | Number |  | default 0 |
| `reactionsCount.sad` | Number |  | default 0 |
| `reactionsCount.angry` | Number |  | default 0 |
| `reactionsCount.fire` | Number |  | default 0 |
| `reactionsCount.money` | Number |  | default 0 |
| `reactionsCount.total` | Number |  | default 0 |
| `commentsCount` | Number |  | default 0 |
| `repostsCount` | Number |  | default 0 |
| `quotedPostId` | ObjectId | `Post` | default null |
| `hasPoll` | Boolean |  | default false |
| `postType` | String |  | default "post", enum ["post","article"] |
| `title` | String |  |  |
| `coverImage` | String |  |  |
| `slug` | String |  |  |
| `readingTimeMinutes` | Number |  |  |
| `isPinned` | Boolean |  | index, default false |
| `isActive` | Boolean |  | default true |
| `_id` | ObjectId |  |  |
| `createdAt` | Date |  |  |
| `updatedAt` | Date |  |  |

**Indexes:** `{"authorId":1} {"background":true}`; `{"orgId":1} {"background":true}`; `{"isPinned":1} {"background":true}`; `{"orgId":1,"createdAt":-1} {"background":true}`; `{"channelIds":1,"createdAt":-1} {"background":true}`; `{"authorId":1,"createdAt":-1} {"background":true}`; `{"tags":1} {"background":true}`; `{"orgId":1,"channelIds":1,"createdAt":-1} {"background":true}`; `{"orgId":1,"isPinned":1} {"sparse":true,"background":true}`; `{"orgId":1,"slug":1} {"unique":true,"sparse":true,"background":true}`; `{"mentions":1,"createdAt":-1} {"background":true}`

### PostBookmark

- **Collection:** `postbookmarks` · **Area:** Core platform · **Source:** `server/models/postBookmark.model.ts` (doc: `server/models/postBookmark.model.ts.md`) · **Options:** timestamps=true, autoIndex=null, capped=false
- **Used by:** `server/services/feed.ts`, `server/services/feedActivity.ts`, `server/services/memberCleanup.service.ts`
- **Hooks:** pre(save) ×5, pre(findOneAndReplace) ×1, pre(findOneAndUpdate) ×1, pre(replaceOne) ×1, pre(update) ×1, pre(updateOne) ×1, pre(updateMany) ×1, pre(remove) ×1, post(save) ×3, post(init) ×1
- **Statics/methods:** `initializeTimestamps()`

| Field | Type | Ref | Flags |
|---|---|---|---|
| `postId` | ObjectId | `Post` | required, index |
| `userId` | ObjectId | `User` | required, index |
| `orgId` | ObjectId | `Organization` | required, index |
| `_id` | ObjectId |  |  |
| `createdAt` | Date |  |  |
| `updatedAt` | Date |  |  |

**Indexes:** `{"postId":1} {"background":true}`; `{"userId":1} {"background":true}`; `{"orgId":1} {"background":true}`; `{"postId":1,"userId":1} {"unique":true,"background":true}`; `{"userId":1,"orgId":1,"createdAt":-1} {"background":true}`; `{"postId":1,"createdAt":-1} {"background":true}`

### PostComment

- **Collection:** `postcomments` · **Area:** Core platform · **Source:** `server/models/postComment.model.ts` (doc: `server/models/postComment.model.ts.md`) · **Options:** timestamps=true, autoIndex=null, capped=false
- **Referenced by:** `PostComment`, `PostCommentLike`, `UserNotification`
- **Used by:** `server/routes/feed.ts`, `server/services/downlineMemberPurchases.ts`, `server/services/feed.ts`, `server/services/feedActivity.ts`, `server/services/memberCleanup.service.ts`
- **Hooks:** pre(save) ×5, pre(findOneAndReplace) ×1, pre(findOneAndUpdate) ×1, pre(replaceOne) ×1, pre(update) ×1, pre(updateOne) ×1, pre(updateMany) ×1, pre(remove) ×1, post(save) ×3, post(init) ×1
- **Statics/methods:** `initializeTimestamps()`

| Field | Type | Ref | Flags |
|---|---|---|---|
| `postId` | ObjectId | `Post` | required, index |
| `userId` | ObjectId | `User` | required, index |
| `orgId` | ObjectId | `Organization` | required, index |
| `content` | String |  | default "" |
| `mentions` | [ObjectId] | `User` |  |
| `attachments` | [subdoc] |  |  |
| `parentCommentId` | ObjectId | `PostComment` | default null |
| `reactionsCount.like` | Number |  | default 0 |
| `reactionsCount.love` | Number |  | default 0 |
| `reactionsCount.haha` | Number |  | default 0 |
| `reactionsCount.wow` | Number |  | default 0 |
| `reactionsCount.sad` | Number |  | default 0 |
| `reactionsCount.angry` | Number |  | default 0 |
| `reactionsCount.fire` | Number |  | default 0 |
| `reactionsCount.money` | Number |  | default 0 |
| `reactionsCount.total` | Number |  | default 0 |
| `isActive` | Boolean |  | default true |
| `_id` | ObjectId |  |  |
| `createdAt` | Date |  |  |
| `updatedAt` | Date |  |  |

**Indexes:** `{"postId":1} {"background":true}`; `{"userId":1} {"background":true}`; `{"orgId":1} {"background":true}`; `{"postId":1,"createdAt":1} {"background":true}`; `{"postId":1,"parentCommentId":1} {"background":true}`; `{"userId":1,"createdAt":-1} {"background":true}`; `{"parentCommentId":1,"createdAt":-1} {"background":true}`; `{"mentions":1,"orgId":1,"createdAt":-1} {"background":true}`

### PostCommentLike

- **Collection:** `postcommentlikes` · **Area:** Core platform · **Source:** `server/models/postCommentLike.model.ts` (doc: `server/models/postCommentLike.model.ts.md`) · **Options:** timestamps=true, autoIndex=null, capped=false
- **Used by:** `server/routes/feed.ts`, `server/services/downlineMemberPurchases.ts`, `server/services/feed.ts`, `server/services/feedActivity.ts`
- **Hooks:** pre(save) ×5, pre(findOneAndReplace) ×1, pre(findOneAndUpdate) ×1, pre(replaceOne) ×1, pre(update) ×1, pre(updateOne) ×1, pre(updateMany) ×1, pre(remove) ×1, post(save) ×3, post(init) ×1
- **Statics/methods:** `initializeTimestamps()`

| Field | Type | Ref | Flags |
|---|---|---|---|
| `commentId` | ObjectId | `PostComment` | required, index |
| `userId` | ObjectId | `User` | required, index |
| `orgId` | ObjectId | `Organization` | required, index |
| `reactionType` | String |  | required, default "like", enum ["like","love","haha","wow","… |
| `_id` | ObjectId |  |  |
| `createdAt` | Date |  |  |
| `updatedAt` | Date |  |  |

**Indexes:** `{"commentId":1} {"background":true}`; `{"userId":1} {"background":true}`; `{"orgId":1} {"background":true}`; `{"commentId":1,"userId":1} {"unique":true,"background":true}`; `{"commentId":1,"createdAt":-1} {"background":true}`; `{"commentId":1,"reactionType":1} {"background":true}`

### PostLike

- **Collection:** `postlikes` · **Area:** Core platform · **Source:** `server/models/postLike.model.ts` (doc: `server/models/postLike.model.ts.md`) · **Options:** timestamps=true, autoIndex=null, capped=false
- **Used by:** `server/models/postCommentLike.model.ts`, `server/routes/feed.ts`, `server/services/downlineMemberPurchases.ts`, `server/services/feed.ts`, `server/services/feedActivity.ts`, `server/services/memberCleanup.service.ts`
- **Hooks:** pre(save) ×5, pre(findOneAndReplace) ×1, pre(findOneAndUpdate) ×1, pre(replaceOne) ×1, pre(update) ×1, pre(updateOne) ×1, pre(updateMany) ×1, pre(remove) ×1, post(save) ×3, post(init) ×1
- **Statics/methods:** `initializeTimestamps()`

| Field | Type | Ref | Flags |
|---|---|---|---|
| `postId` | ObjectId | `Post` | required, index |
| `userId` | ObjectId | `User` | required, index |
| `orgId` | ObjectId | `Organization` | required, index |
| `reactionType` | String |  | required, default "like", enum ["like","love","haha","wow","… |
| `_id` | ObjectId |  |  |
| `createdAt` | Date |  |  |
| `updatedAt` | Date |  |  |

**Indexes:** `{"postId":1} {"background":true}`; `{"userId":1} {"background":true}`; `{"orgId":1} {"background":true}`; `{"postId":1,"userId":1} {"unique":true,"background":true}`; `{"postId":1} {"background":true}`; `{"postId":1,"reactionType":1} {"background":true}`; `{"postId":1,"createdAt":-1} {"background":true}`

### PostRepost

- **Collection:** `postreposts` · **Area:** Core platform · **Source:** `server/models/postRepost.model.ts` (doc: `server/models/postRepost.model.ts.md`) · **Options:** timestamps=true, autoIndex=null, capped=false
- **Used by:** `server/services/feed.ts`, `server/services/feedActivity.ts`, `server/services/memberCleanup.service.ts`
- **Hooks:** pre(save) ×5, pre(findOneAndReplace) ×1, pre(findOneAndUpdate) ×1, pre(replaceOne) ×1, pre(update) ×1, pre(updateOne) ×1, pre(updateMany) ×1, pre(remove) ×1, post(save) ×3, post(init) ×1
- **Statics/methods:** `initializeTimestamps()`

| Field | Type | Ref | Flags |
|---|---|---|---|
| `postId` | ObjectId | `Post` | required, index |
| `userId` | ObjectId | `User` | required, index |
| `orgId` | ObjectId | `Organization` | required, index |
| `_id` | ObjectId |  |  |
| `createdAt` | Date |  |  |
| `updatedAt` | Date |  |  |

**Indexes:** `{"postId":1} {"background":true}`; `{"userId":1} {"background":true}`; `{"orgId":1} {"background":true}`; `{"postId":1,"userId":1} {"unique":true,"background":true}`; `{"userId":1,"createdAt":-1} {"background":true}`; `{"postId":1,"createdAt":-1} {"background":true}`

### Product

- **Collection:** `products` · **Area:** Core platform · **Source:** `server/models/product.model.ts` (doc: `server/models/product.model.ts.md`) · **Options:** timestamps=true, autoIndex=null, capped=false
- **Referenced by:** `Auction`, `UserProductLink`, `bat246B2CoinProductPurchases`, `bat246B2CoinTransactions`, `bat246BoardInvites`, `bat246Distributors`, `bat246LayawayRequests`, `bat246OfficeInvites`, `bat246PodInvites`, `bat246PositionReservations`, `bat246SnapBackLoanRequests`, `bat246SnapBackLoans`
- **Used by:** `server/bat246/__tests__/bat246Admin.service.test.ts`, `server/bat246/routes/bat246.routes.ts`, `server/bat246/scripts/addPlayersToOrg.ts`, `server/bat246/scripts/addTestUsers10to19.ts`, `server/bat246/scripts/createAlanKFreeCoupon.ts`, `server/bat246/scripts/fix-bat246-product-description.ts`, `server/bat246/scripts/seedBat246.ts`, `server/bat246/scripts/seedBat246Product.ts`, … +43 more
- **Hooks:** pre(save) ×5, pre(findOneAndReplace) ×1, pre(findOneAndUpdate) ×1, pre(replaceOne) ×1, pre(update) ×1, pre(updateOne) ×1, pre(updateMany) ×1, pre(remove) ×1, post(save) ×4, post(findOneAndUpdate) ×1, post(findOneAndDelete) ×1, post(deleteOne) ×1, post(init) ×1
- **Statics/methods:** `initializeTimestamps()`

| Field | Type | Ref | Flags |
|---|---|---|---|
| `organizationId` | ObjectId | `Organization` | required, index |
| `createdBy` | ObjectId | `User` | required |
| `name` | String |  | required |
| `slug` | String |  | required |
| `description` | String |  |  |
| `sku` | String |  | required |
| `price` | Number |  | required |
| `currency` | String |  | default "USD", enum ["INR","USD"] |
| `trackQuantity` | Boolean |  | default false |
| `quantity` | Number |  |  |
| `lowStockThreshold` | Number |  |  |
| `images` | [String] |  | default [] |
| `videos` | [String] |  | default [] |
| `youtubeLink` | String |  |  |
| `categoryName` | String |  |  |
| `tags` | [String] |  | default [] |
| `isDigital` | Boolean |  | default false |
| `requiresShipping` | Boolean |  | default true |
| `deliveryMethod` | String |  | default "physical", enum ["physical","digital","both"] |
| `digitalAssets` | [subdoc] |  | default [] |
| `digitalLinks` | [subdoc] |  | default [] |
| `channelIds` | [ObjectId] | `Channel` | default [] |
| `allowedUserIds` | [ObjectId] | `User` | default [] |
| `status` | String |  | default "draft", enum ["active","draft","archived"] |
| `gstInclusive` | Boolean |  | default true |
| `requireIosPayment` | Boolean |  | default false |
| `appleFeeInclusive` | Boolean |  | default false |
| `isSubscription` | Boolean |  | default false |
| `subscriptionPeriod` | String |  | enum ["weekly","monthly","quarterl… |
| `emailAlerts.enabled` | Boolean |  | default false |
| `emailAlerts.templateId` | String |  |  |
| `emailAlerts.templateName` | String |  |  |
| `emailAlerts.templateHtml` | String |  |  |
| `emailAlerts.syncedAt` | Date |  |  |
| `founderAlerts.enabled` | Boolean |  | default false |
| `founderAlerts.recipients` | [String] |  |  |
| `rating` | Number |  |  |
| `ratingCount` | Number |  | default 0 |
| `downloadCount` | Number |  | default 0 |
| `whatsIncluded` | [String] |  |  |
| `keyFeatures` | [subdoc] |  |  |
| `whatsInside` | [subdoc] |  |  |
| `reviews` | [subdoc] |  |  |
| `faqs` | [subdoc] |  |  |
| `productDetails` | [subdoc] |  |  |
| `thankYouPage` | Embedded |  |  |
| `_id` | ObjectId |  |  |
| `createdAt` | Date |  |  |
| `updatedAt` | Date |  |  |

**Indexes:** `{"organizationId":1} {"background":true}`; `{"organizationId":1,"slug":1} {"unique":true,"background":true}`; `{"organizationId":1,"sku":1} {"unique":true,"background":true}`; `{"organizationId":1,"status":1} {"background":true}`; `{"organizationId":1,"allowedUserIds":1} {"background":true}`

### ProductOrder

- **Collection:** `productorders` · **Area:** Core platform · **Source:** `server/models/productOrder.model.ts` (doc: `server/models/productOrder.model.ts.md`) · **Options:** timestamps=true, autoIndex=null, capped=false
- **Referenced by:** `AuctionSettlement`
- **Used by:** `server/controllers/garageAdmin.controller.ts`, `server/routes/feed.ts`, `server/routes/product.ts`, `server/routes/productCheckout.ts`, `server/routes/unifiedOrders.ts`, `server/scripts/diagnoseAuctionSettlement.ts`, `server/services/commission.ts`, `server/services/downlineMemberLiveStreams.ts`, … +7 more
- **Hooks:** pre(save) ×5, pre(findOneAndReplace) ×1, pre(findOneAndUpdate) ×1, pre(replaceOne) ×1, pre(update) ×1, pre(updateOne) ×1, pre(updateMany) ×1, pre(remove) ×1, post(save) ×3, post(init) ×1
- **Statics/methods:** `initializeTimestamps()`

| Field | Type | Ref | Flags |
|---|---|---|---|
| `orderNumber` | String |  | unique, default fn default |
| `organizationId` | ObjectId | `Organization` | required, index |
| `userId` | ObjectId | `User` | required, index |
| `items` | [subdoc] |  | required |
| `subtotal` | Number |  | required |
| `discount` | Number |  | default 0 |
| `tax` | Number |  | default 0 |
| `shippingCost` | Number |  | default 0 |
| `total` | Number |  | required |
| `currency` | String |  | default "INR" |
| `status` | String |  | default "pending", enum ["pending","confirmed","proce… |
| `paymentStatus` | String |  | default "pending", enum ["pending","paid","failed","r… |
| `paymentMethod` | String |  |  |
| `paymentId` | String |  |  |
| `invoiceShortUrl` | String |  |  |
| `shippingAddress` | Embedded |  |  |
| `billingAddress` | Embedded |  |  |
| `paymentMode` | String |  | enum ["Prepaid","COD"] |
| `gstin` | String |  |  |
| `companyName` | String |  |  |
| `customerNote` | String |  |  |
| `requiresShipping` | Boolean |  | default false |
| `trackingNumber` | String |  |  |
| `trackingUrl` | String |  |  |
| `notes` | String |  |  |
| `metadata` | Mixed |  |  |
| `_id` | ObjectId |  |  |
| `createdAt` | Date |  |  |
| `updatedAt` | Date |  |  |

**Indexes:** `{"orderNumber":1} {"unique":true,"background":true}`; `{"organizationId":1} {"background":true}`; `{"userId":1} {"background":true}`; `{"orderNumber":1} {"background":true}`; `{"userId":1,"createdAt":-1} {"background":true}`; `{"organizationId":1,"status":1,"createdAt":-1} {"background":true}`; `{"paymentId":1} {"unique":true,"sparse":true,"background":true}`; `{"userId":1,"items.productId":1,"paymentStatus":1} {"background":true}`; `{"userId":1,"organizationId":1,"paymentStatus":1} {"background":true}`

### ProductVariant

- **Collection:** `productvariants` · **Area:** Core platform · **Source:** `server/models/productVariant.model.ts` (doc: `server/models/productVariant.model.ts.md`) · **Options:** timestamps=true, strict=false, autoIndex=null, capped=false
- **Used by:** `server/services/downlineMemberPurchases.ts`, `server/services/ecommerceInvoice.ts`, `server/services/invoice.ts`
- **Hooks:** pre(save) ×5, pre(findOneAndReplace) ×1, pre(findOneAndUpdate) ×1, pre(replaceOne) ×1, pre(update) ×1, pre(updateOne) ×1, pre(updateMany) ×1, pre(remove) ×1, post(save) ×3, post(init) ×1
- **Statics/methods:** `initializeTimestamps()`

| Field | Type | Ref | Flags |
|---|---|---|---|
| `productId` | ObjectId |  | required, index |
| `orgId` | ObjectId |  | index |
| `title` | String |  |  |
| `sku` | String |  |  |
| `price` | Number |  | required |
| `compareAtPrice` | Number |  |  |
| `trackInventory` | Boolean |  |  |
| `quantity` | Number |  |  |
| `image` | String |  |  |
| `isActive` | Boolean |  |  |
| `_id` | ObjectId |  |  |
| `createdAt` | Date |  |  |
| `updatedAt` | Date |  |  |

**Indexes:** `{"productId":1} {"background":true}`; `{"orgId":1} {"background":true}`

### RankPlan

- **Collection:** `rankplans` · **Area:** Core platform · **Source:** `server/models/rankPlan.model.ts` (doc: `server/models/rankPlan.model.ts.md`) · **Options:** timestamps=true, autoIndex=null, capped=false
- **Used by:** `server/models/rankQualification.model.ts`, `server/models/rankRun.model.ts`, `server/routes/garageAdminRankBonus.ts`, `server/routes/genealogy.ts`, `server/routes/publicRankBonus.ts`, `server/routes/rankBonus.ts`, `server/scripts/preview-rank-bonus.ts`, `server/scripts/seed-rank-plan.ts`, … +6 more
- **Hooks:** pre(save) ×5, pre(findOneAndReplace) ×1, pre(findOneAndUpdate) ×1, pre(replaceOne) ×1, pre(update) ×1, pre(updateOne) ×1, pre(updateMany) ×1, pre(remove) ×1, post(save) ×3, post(init) ×1
- **Statics/methods:** `initializeTimestamps()`

| Field | Type | Ref | Flags |
|---|---|---|---|
| `version` | Number |  | required, unique |
| `isActive` | Boolean |  | index, default false |
| `thirdPartyClientId` | ObjectId |  | required |
| `tiers` | [subdoc] |  | required |
| `bronzeStacks` | Boolean |  | default true |
| `note` | String |  |  |
| `_id` | ObjectId |  |  |
| `createdAt` | Date |  |  |
| `updatedAt` | Date |  |  |

**Indexes:** `{"version":1} {"unique":true,"background":true}`; `{"isActive":1} {"background":true}`; `{"isActive":1} {"unique":true,"partialFilterExpression":{"isActive":true},"background":true}`

### RankQualification

- **Collection:** `rankqualifications` · **Area:** Core platform · **Source:** `server/models/rankQualification.model.ts` (doc: `server/models/rankQualification.model.ts.md`) · **Options:** timestamps=true, autoIndex=null, capped=false
- **Used by:** `server/routes/garageAdminRankBonus.ts`, `server/routes/rankBonus.ts`, `server/services/rankBonus/detail.ts`, `server/services/rankBonus/payout.ts`, `server/services/rankBonus/run.ts`
- **Hooks:** pre(save) ×5, pre(findOneAndReplace) ×1, pre(findOneAndUpdate) ×1, pre(replaceOne) ×1, pre(update) ×1, pre(updateOne) ×1, pre(updateMany) ×1, pre(remove) ×1, post(save) ×3, post(init) ×1
- **Statics/methods:** `initializeTimestamps()`

| Field | Type | Ref | Flags |
|---|---|---|---|
| `runId` | ObjectId | `RankRun` | required, index |
| `periodKey` | String |  | required |
| `userId` | ObjectId | `User` | required, index |
| `rank` | String |  | required, index, enum ["Bronze","Silver","Gold","Di… |
| `bonusUsd` | Number |  | required |
| `basis` | Embedded |  | required |
| `payoutStatus` | String |  | index, default "pending", enum ["pending","paid","skipped_dr… |
| `routedToPlatform` | Boolean |  | default false |
| `walletTransactionId` | ObjectId | `WalletTransaction` |  |
| `paidAt` | Date |  |  |
| `attempts` | Number |  | default 0 |
| `lastError` | String |  |  |
| `_id` | ObjectId |  |  |
| `createdAt` | Date |  |  |
| `updatedAt` | Date |  |  |

**Indexes:** `{"runId":1} {"background":true}`; `{"userId":1} {"background":true}`; `{"rank":1} {"background":true}`; `{"payoutStatus":1} {"background":true}`; `{"periodKey":1,"userId":1} {"unique":true,"background":true}`; `{"runId":1,"payoutStatus":1} {"background":true}`

### RankRun

- **Collection:** `rankruns` · **Area:** Core platform · **Source:** `server/models/rankRun.model.ts` (doc: `server/models/rankRun.model.ts.md`) · **Options:** timestamps=true, autoIndex=null, capped=false
- **Referenced by:** `RankQualification`
- **Used by:** `server/routes/garageAdminRankBonus.ts`, `server/routes/genealogy.ts`, `server/routes/rankBonus.ts`, `server/services/genealogy/snapshot.ts`, `server/services/rankBonus/run.ts`
- **Hooks:** pre(save) ×5, pre(findOneAndReplace) ×1, pre(findOneAndUpdate) ×1, pre(replaceOne) ×1, pre(update) ×1, pre(updateOne) ×1, pre(updateMany) ×1, pre(remove) ×1, post(save) ×3, post(init) ×1
- **Statics/methods:** `initializeTimestamps()`

| Field | Type | Ref | Flags |
|---|---|---|---|
| `periodKey` | String |  | required, unique |
| `planVersion` | Number |  | required |
| `status` | String |  | index, default "computing", enum ["computing","computed","payi… |
| `dryRun` | Boolean |  | required |
| `snapshotAt` | Date |  | required |
| `startedAt` | Date |  | required |
| `computedAt` | Date |  |  |
| `paidAt` | Date |  |  |
| `totals` | Embedded |  | default fn default |
| `error` | String |  |  |
| `triggeredBy` | String |  |  |
| `_id` | ObjectId |  |  |
| `createdAt` | Date |  |  |
| `updatedAt` | Date |  |  |

**Indexes:** `{"periodKey":1} {"unique":true,"background":true}`; `{"status":1} {"background":true}`; `{"createdAt":-1} {"background":true}`

### RatingSummary

- **Collection:** `ratingsummaries` · **Area:** Core platform · **Source:** `server/models/ratingSummary.model.ts` (doc: `server/models/ratingSummary.model.ts.md`) · **Options:** timestamps=true, autoIndex=null, capped=false
- **Used by:** `server/scripts/rebuild-rating-summaries.ts`, `server/services/review.ts`
- **Hooks:** pre(save) ×5, pre(findOneAndReplace) ×1, pre(findOneAndUpdate) ×1, pre(replaceOne) ×1, pre(update) ×1, pre(updateOne) ×1, pre(updateMany) ×1, pre(remove) ×1, post(save) ×3, post(init) ×1
- **Statics/methods:** `initializeTimestamps()`

| Field | Type | Ref | Flags |
|---|---|---|---|
| `targetType` | String |  | required, enum ["channel","course","product"… |
| `targetId` | ObjectId |  | required |
| `organizationId` | ObjectId | `Organization` | required |
| `average` | Number |  | default 0 |
| `count` | Number |  | default 0 |
| `distribution` | Embedded |  | default fn default |
| `verifiedCount` | Number |  | default 0 |
| `ownerReviewCount` | Number |  | default 0 |
| `lastReviewAt` | Date |  |  |
| `_id` | ObjectId |  |  |
| `createdAt` | Date |  |  |
| `updatedAt` | Date |  |  |

**Indexes:** `{"targetType":1,"targetId":1} {"unique":true,"background":true}`; `{"organizationId":1,"targetType":1,"average":-1} {"background":true}`

### ReferralBonusConfig

- **Collection:** `referralbonusconfigs` · **Area:** Core platform · **Source:** `server/models/referralBonusConfig.model.ts` (doc: `server/models/referralBonusConfig.model.ts.md`) · **Options:** timestamps=true, autoIndex=null, capped=false
- **Used by:** `server/routes/garageAdminReferralBonus.ts`, `server/services/referralSignupBonus.ts`
- **Hooks:** pre(save) ×5, pre(findOneAndReplace) ×1, pre(findOneAndUpdate) ×1, pre(replaceOne) ×1, pre(update) ×1, pre(updateOne) ×1, pre(updateMany) ×1, pre(remove) ×1, post(save) ×3, post(init) ×1
- **Statics/methods:** `initializeTimestamps()`

| Field | Type | Ref | Flags |
|---|---|---|---|
| `key` | String |  | required, unique, default "global", enum ["global"] |
| `amountUsd` | Number |  | required, default 0 |
| `isActive` | Boolean |  | default false |
| `updatedBy` | ObjectId | `GarageAdmin` |  |
| `updatedByEmail` | String |  |  |
| `_id` | ObjectId |  |  |
| `createdAt` | Date |  |  |
| `updatedAt` | Date |  |  |

**Indexes:** `{"key":1} {"unique":true,"background":true}`

### ReferralBonusPayout

- **Collection:** `referralbonuspayouts` · **Area:** Core platform · **Source:** `server/models/referralBonusPayout.model.ts` (doc: `server/models/referralBonusPayout.model.ts.md`) · **Options:** timestamps=true, autoIndex=null, capped=false
- **Used by:** `server/routes/garageAdminReferralBonus.ts`, `server/services/accountMerge.ts`, `server/services/referralSignupBonus.ts`
- **Hooks:** pre(save) ×5, pre(findOneAndReplace) ×1, pre(findOneAndUpdate) ×1, pre(replaceOne) ×1, pre(update) ×1, pre(updateOne) ×1, pre(updateMany) ×1, pre(remove) ×1, post(save) ×3, post(init) ×1
- **Statics/methods:** `initializeTimestamps()`

| Field | Type | Ref | Flags |
|---|---|---|---|
| `refereeUserId` | ObjectId | `User` | required, unique |
| `referrerUserId` | ObjectId | `User` | required, index |
| `amountUsd` | Number |  | required |
| `totalDebitedUsd` | Number |  | required |
| `refereeOrgId` | ObjectId | `Organization` |  |
| `referrerOrgId` | ObjectId | `Organization` |  |
| `refereeTransactionId` | ObjectId |  |  |
| `referrerTransactionId` | ObjectId |  |  |
| `platformTransactionId` | ObjectId |  |  |
| `referrerEmailedAt` | Date |  |  |
| `refereeEmailedAt` | Date |  |  |
| `reversedAt` | Date |  |  |
| `reversedReason` | String |  |  |
| `_id` | ObjectId |  |  |
| `createdAt` | Date |  |  |
| `updatedAt` | Date |  |  |

**Indexes:** `{"refereeUserId":1} {"unique":true,"background":true}`; `{"referrerUserId":1} {"background":true}`; `{"createdAt":-1} {"background":true}`

### ReserveLicense

- **Collection:** `reservelicenses` · **Area:** Core platform · **Source:** `server/models/reserveLicense.model.ts` (doc: `server/models/reserveLicense.model.ts.md`) · **Options:** timestamps=true, autoIndex=null, capped=false
- **Used by:** `server/controllers/garageAdmin.controller.ts`, `server/routes/garageAdminOneTimeAffiliates.ts`, `server/services/reserveLicense.ts`
- **Hooks:** pre(save) ×5, pre(findOneAndReplace) ×1, pre(findOneAndUpdate) ×1, pre(replaceOne) ×1, pre(update) ×1, pre(updateOne) ×1, pre(updateMany) ×1, pre(remove) ×1, post(save) ×3, post(init) ×1
- **Statics/methods:** `initializeTimestamps()`

| Field | Type | Ref | Flags |
|---|---|---|---|
| `userId` | ObjectId | `User` | required, index |
| `invoiceId` | ObjectId | `Invoice` | required, index |
| `invoiceNumber` | String |  | required |
| `planId` | ObjectId | `UnilevelPlusPlan` | required |
| `distributionId` | ObjectId | `UnilevelPlusDistribution` | required |
| `purchasePaymentId` | String |  | required, unique |
| `status` | String |  | index, default "available", enum ["available","assigned","expi… |
| `assignedTo` | ObjectId | `User` |  |
| `assignedAt` | Date |  |  |
| `purchaseId` | ObjectId | `UnilevelPlusPurchase` |  |
| `amount` | Number |  | required |
| `currency` | String |  | default "USD" |
| `metadata` | Mixed |  |  |
| `_id` | ObjectId |  |  |
| `createdAt` | Date |  |  |
| `updatedAt` | Date |  |  |

**Indexes:** `{"userId":1} {"background":true}`; `{"invoiceId":1} {"background":true}`; `{"purchasePaymentId":1} {"unique":true,"background":true}`; `{"status":1} {"background":true}`; `{"userId":1,"status":1} {"background":true}`; `{"assignedTo":1} {"background":true}`

### Review

- **Collection:** `reviews` · **Area:** Core platform · **Source:** `server/models/review.model.ts` (doc: `server/models/review.model.ts.md`) · **Options:** timestamps=true, autoIndex=null, capped=false
- **Referenced by:** `ReviewVote`
- **Used by:** `server/models/ratingSummary.model.ts`, `server/routes/review.ts`, `server/scripts/rebuild-rating-summaries.ts`, `server/services/downlineMemberLiveStreams.ts`, `server/services/downlineMemberPurchases.ts`, `server/services/review.ts`
- **Hooks:** pre(save) ×5, pre(findOneAndReplace) ×1, pre(findOneAndUpdate) ×1, pre(replaceOne) ×1, pre(update) ×1, pre(updateOne) ×1, pre(updateMany) ×1, pre(remove) ×1, post(save) ×3, post(init) ×1
- **Statics/methods:** `initializeTimestamps()`

| Field | Type | Ref | Flags |
|---|---|---|---|
| `targetType` | String |  | required, enum ["channel","course","product"… |
| `targetId` | ObjectId |  | required |
| `organizationId` | ObjectId | `Organization` | required, index |
| `userId` | ObjectId | `User` | required |
| `rating` | Number |  | required |
| `title` | String |  |  |
| `body` | String |  | default "" |
| `images` | [String] |  | default [] |
| `reviewerName` | String |  | required |
| `reviewerRole` | String |  |  |
| `reviewerAvatar` | String |  |  |
| `isVerifiedPurchase` | Boolean |  | default false |
| `isOwnerReview` | Boolean |  | default false |
| `helpfulCount` | Number |  | default 0 |
| `notHelpfulCount` | Number |  | default 0 |
| `status` | String |  | default "published", enum ["published","pending","hidde… |
| `moderatedBy` | ObjectId | `User` |  |
| `moderatedAt` | Date |  |  |
| `moderationNote` | String |  |  |
| `commentRemovedAt` | Date |  |  |
| `commentRemovedBy` | ObjectId | `User` |  |
| `editedAt` | Date |  |  |
| `_id` | ObjectId |  |  |
| `createdAt` | Date |  |  |
| `updatedAt` | Date |  |  |

**Indexes:** `{"organizationId":1} {"background":true}`; `{"targetType":1,"targetId":1,"userId":1} {"unique":true,"background":true}`; `{"targetType":1,"targetId":1,"status":1,"createdAt":-1} {"background":true}`; `{"targetType":1,"targetId":1,"status":1,"helpfulCount":-1} {"background":true}`; `{"targetType":1,"targetId":1,"status":1,"rating":1} {"background":true}`; `{"organizationId":1,"status":1,"createdAt":-1} {"background":true}`; `{"userId":1,"createdAt":-1} {"background":true}`

### ReviewVote

- **Collection:** `reviewvotes` · **Area:** Core platform · **Source:** `server/models/reviewVote.model.ts` (doc: `server/models/reviewVote.model.ts.md`) · **Options:** timestamps=true, autoIndex=null, capped=false
- **Used by:** `server/routes/review.ts`, `server/services/review.ts`
- **Hooks:** pre(save) ×5, pre(findOneAndReplace) ×1, pre(findOneAndUpdate) ×1, pre(replaceOne) ×1, pre(update) ×1, pre(updateOne) ×1, pre(updateMany) ×1, pre(remove) ×1, post(save) ×3, post(init) ×1
- **Statics/methods:** `initializeTimestamps()`

| Field | Type | Ref | Flags |
|---|---|---|---|
| `reviewId` | ObjectId | `Review` | required |
| `userId` | ObjectId | `User` | required |
| `vote` | String |  | required, enum ["helpful","unhelpful"] |
| `_id` | ObjectId |  |  |
| `createdAt` | Date |  |  |
| `updatedAt` | Date |  |  |

**Indexes:** `{"reviewId":1,"userId":1} {"unique":true,"background":true}`; `{"userId":1,"reviewId":1} {"background":true}`; `{"reviewId":1,"vote":1} {"background":true}`

### RoomBooking

- **Collection:** `roombookings` · **Area:** Core platform · **Source:** `server/models/roomBooking.model.ts` (doc: `server/models/roomBooking.model.ts.md`) · **Options:** timestamps=true, autoIndex=null, capped=false
- **Used by:** `server/realtime/socket.ts`, `server/routes/roomBooking.ts`
- **Hooks:** pre(save) ×6, pre(findOneAndReplace) ×1, pre(findOneAndUpdate) ×1, pre(replaceOne) ×1, pre(update) ×1, pre(updateOne) ×1, pre(updateMany) ×1, pre(remove) ×1, post(save) ×3, post(init) ×1
- **Statics/methods:** `initializeTimestamps()`

| Field | Type | Ref | Flags |
|---|---|---|---|
| `orgId` | ObjectId | `Organization` | required, index |
| `conferenceRoomId` | ObjectId | `ConferenceRoom` | index |
| `creatorId` | ObjectId | `User` | required |
| `title` | String |  | required |
| `description` | String |  |  |
| `startTime` | Date |  | required |
| `endTime` | Date |  | required |
| `invitedUserIds` | [ObjectId] | `User` |  |
| `status` | String |  | index, default "active", enum ["active","cancelled","comple… |
| `_id` | ObjectId |  |  |
| `createdAt` | Date |  |  |
| `updatedAt` | Date |  |  |

**Indexes:** `{"orgId":1} {"background":true}`; `{"conferenceRoomId":1} {"sparse":true,"background":true}`; `{"status":1} {"background":true}`; `{"orgId":1,"startTime":1,"status":1} {"background":true}`; `{"orgId":1,"endTime":1,"status":1} {"background":true}`; `{"conferenceRoomId":1,"startTime":1,"status":1} {"sparse":true,"background":true}`

### SavedJob

- **Collection:** `savedjobs` · **Area:** Core platform · **Source:** `server/models/savedJob.model.ts` (doc: `server/models/savedJob.model.ts.md`) · **Options:** timestamps={"createdAt":true,"updatedAt"…, autoIndex=null, capped=false
- **Used by:** `server/routes/jobsCandidate.ts`
- **Hooks:** pre(save) ×5, pre(findOneAndReplace) ×1, pre(findOneAndUpdate) ×1, pre(replaceOne) ×1, pre(update) ×1, pre(updateOne) ×1, pre(updateMany) ×1, pre(remove) ×1, post(save) ×3, post(init) ×1
- **Statics/methods:** `initializeTimestamps()`

| Field | Type | Ref | Flags |
|---|---|---|---|
| `userId` | ObjectId | `User` | required |
| `jobId` | ObjectId | `JobPosting` | required |
| `_id` | ObjectId |  |  |
| `createdAt` | Date |  |  |

**Indexes:** `{"userId":1,"jobId":1} {"unique":true,"background":true}`; `{"userId":1,"createdAt":-1} {"background":true}`

### Service

- **Collection:** `services` · **Area:** Core platform · **Source:** `server/models/service.model.ts` (doc: `server/models/service.model.ts.md`) · **Options:** timestamps=true, autoIndex=null, capped=false
- **Referenced by:** `ServiceMilestoneMessage`, `ServiceOpt`, `ServiceReview`
- **Used by:** `server/controllers/garageAdmin.controller.ts`, `server/routes/affiliate.ts`, `server/routes/founderCouponItems.ts`, `server/routes/founderCouponRules.ts`, `server/routes/guestAuth.ts`, `server/routes/internal-catalog.ts`, `server/routes/public.ts`, `server/routes/service.ts`, … +13 more
- **Hooks:** pre(save) ×6, pre(findOneAndReplace) ×1, pre(findOneAndUpdate) ×1, pre(replaceOne) ×1, pre(update) ×1, pre(updateOne) ×1, pre(updateMany) ×1, pre(remove) ×1, post(save) ×4, post(findOneAndUpdate) ×1, post(findOneAndDelete) ×1, post(deleteOne) ×1, post(init) ×1
- **Statics/methods:** `initializeTimestamps()`

| Field | Type | Ref | Flags |
|---|---|---|---|
| `title` | String |  | required |
| `slug` | String |  | required |
| `description` | String |  |  |
| `longDescription` | String |  |  |
| `icon` | String |  |  |
| `iconBgColor` | String |  |  |
| `coverImage` | String |  |  |
| `tags` | [String] |  | default [] |
| `features` | [String] |  | default [] |
| `deliverables` | [String] |  | default [] |
| `images` | [String] |  | default [] |
| `videos` | [String] |  | default [] |
| `youtubeUrl` | String |  |  |
| `category` | String |  |  |
| `duration` | String |  |  |
| `pricingModel` | String |  | default "milestone", enum ["milestone","billable"] |
| `paymentTiming` | String |  | default "free", enum ["free","pay_before_milestone… |
| `currency` | String |  | default "USD", enum ["INR","USD"] |
| `totalPrice` | Number |  | default 0 |
| `taxMode` | String |  | default "inclusive", enum ["inclusive","exclusive"] |
| `bookingAdvanceFeeEnabled` | Boolean |  | default false |
| `bookingAdvanceFee` | Number |  | default 0 |
| `cancellationPolicy` | String |  |  |
| `milestones` | [subdoc] |  | default [] |
| `organizationId` | ObjectId | `Organization` | required, index |
| `createdBy` | ObjectId | `User` | required |
| `founderAlerts.enabled` | Boolean |  | default false |
| `founderAlerts.recipients` | [String] |  |  |
| `channelIds` | [ObjectId] | `Channel` | default [] |
| `allowedUserIds` | [ObjectId] | `User` | default [] |
| `status` | String |  | default "draft", enum ["draft","active","archived"] |
| `projectsCompleted` | Number |  | default 0 |
| `activeOptIns` | Number |  | default 0 |
| `whyChooseUs` | [subdoc] |  |  |
| `contactInfo` | Embedded |  |  |
| `hourlyConfig` | Embedded |  |  |
| `taskroomConfig` | Embedded |  |  |
| `_id` | ObjectId |  |  |
| `createdAt` | Date |  |  |
| `updatedAt` | Date |  |  |

**Indexes:** `{"organizationId":1} {"background":true}`; `{"organizationId":1,"slug":1} {"unique":true,"background":true}`; `{"organizationId":1,"status":1} {"background":true}`; `{"createdBy":1,"status":1} {"background":true}`; `{"channelIds":1} {"background":true}`; `{"allowedUserIds":1} {"background":true}`

### ServiceMilestoneMessage

- **Collection:** `servicemilestonemessages` · **Area:** Core platform · **Source:** `server/models/serviceMilestoneMessage.model.ts` (doc: `server/models/serviceMilestoneMessage.model.ts.md`) · **Options:** timestamps=true, autoIndex=null, capped=false
- **Used by:** `server/routes/service.ts`
- **Hooks:** pre(save) ×5, pre(findOneAndReplace) ×1, pre(findOneAndUpdate) ×1, pre(replaceOne) ×1, pre(update) ×1, pre(updateOne) ×1, pre(updateMany) ×1, pre(remove) ×1, post(save) ×3, post(init) ×1
- **Statics/methods:** `initializeTimestamps()`

| Field | Type | Ref | Flags |
|---|---|---|---|
| `serviceOptId` | ObjectId | `ServiceOpt` | required, index |
| `serviceId` | ObjectId | `Service` | required |
| `milestoneId` | ObjectId |  | required |
| `organizationId` | ObjectId | `Organization` | required |
| `userId` | ObjectId | `User` | required |
| `authorRole` | String |  | required, enum ["client","founder"] |
| `message` | String |  | required |
| `_id` | ObjectId |  |  |
| `createdAt` | Date |  |  |
| `updatedAt` | Date |  |  |

**Indexes:** `{"serviceOptId":1} {"background":true}`; `{"serviceOptId":1,"milestoneId":1,"createdAt":1} {"background":true}`

### ServiceOpt

- **Collection:** `serviceopts` · **Area:** Core platform · **Source:** `server/models/serviceOpt.model.ts` (doc: `server/models/serviceOpt.model.ts.md`) · **Options:** timestamps=true, autoIndex=null, capped=false
- **Referenced by:** `ServiceMilestoneMessage`, `ServiceReview`
- **Used by:** `server/routes/service.ts`, `server/routes/serviceCheckout.ts`, `server/routes/unifiedOrders.ts`, `server/services/review.ts`, `server/services/service.ts`, `server/services/taskroomProvision.ts`
- **Hooks:** pre(save) ×6, pre(findOneAndReplace) ×1, pre(findOneAndUpdate) ×1, pre(replaceOne) ×1, pre(update) ×1, pre(updateOne) ×1, pre(updateMany) ×1, pre(remove) ×1, post(save) ×3, post(init) ×1
- **Statics/methods:** `initializeTimestamps()`

| Field | Type | Ref | Flags |
|---|---|---|---|
| `serviceId` | ObjectId | `Service` | required, index |
| `userId` | ObjectId | `User` | required, index |
| `organizationId` | ObjectId | `Organization` | required, index |
| `status` | String |  | default "opted", enum ["opted","in_progress","compl… |
| `optedAt` | Date |  | default fn now |
| `completedAt` | Date |  |  |
| `cancelledAt` | Date |  |  |
| `totalAmount` | Number |  | default 0 |
| `amountPaid` | Number |  | default 0 |
| `amountPending` | Number |  | default 0 |
| `currency` | String |  | default "USD" |
| `milestonesProgress` | [subdoc] |  | default [] |
| `completedMilestones` | Number |  | default 0 |
| `totalMilestones` | Number |  | default 0 |
| `progressPercentage` | Number |  | default 0 |
| `taskroom` | Embedded |  |  |
| `_id` | ObjectId |  |  |
| `createdAt` | Date |  |  |
| `updatedAt` | Date |  |  |

**Indexes:** `{"serviceId":1} {"background":true}`; `{"userId":1} {"background":true}`; `{"organizationId":1} {"background":true}`; `{"serviceId":1,"userId":1} {"unique":true,"background":true}`; `{"userId":1,"organizationId":1,"status":1} {"background":true}`; `{"serviceId":1,"status":1} {"background":true}`; `{"taskroom.status":1,"taskroom.attempts":1} {"background":true}`; `{"taskroom.roomId":1} {"background":true}`; `{"organizationId":1,"milestonesProgress.paymentStatus":1} {"background":true}`

### ServiceReview

- **Collection:** `servicereviews` · **Area:** Core platform · **Source:** `server/models/serviceReview.model.ts` (doc: `server/models/serviceReview.model.ts.md`) · **Options:** timestamps=true, autoIndex=null, capped=false
- **Used by:** `server/services/service.ts`
- **Hooks:** pre(save) ×5, pre(findOneAndReplace) ×1, pre(findOneAndUpdate) ×1, pre(replaceOne) ×1, pre(update) ×1, pre(updateOne) ×1, pre(updateMany) ×1, pre(remove) ×1, post(save) ×3, post(init) ×1
- **Statics/methods:** `initializeTimestamps()`

| Field | Type | Ref | Flags |
|---|---|---|---|
| `serviceId` | ObjectId | `Service` | required, index |
| `serviceOptId` | ObjectId | `ServiceOpt` | required |
| `userId` | ObjectId | `User` | required, index |
| `organizationId` | ObjectId | `Organization` | required, index |
| `rating` | Number |  | required |
| `comment` | String |  | required |
| `reviewerName` | String |  | required |
| `reviewerRole` | String |  |  |
| `reviewerAvatar` | String |  |  |
| `isApproved` | Boolean |  | default true |
| `isPublic` | Boolean |  | default true |
| `_id` | ObjectId |  |  |
| `createdAt` | Date |  |  |
| `updatedAt` | Date |  |  |

**Indexes:** `{"serviceId":1} {"background":true}`; `{"userId":1} {"background":true}`; `{"organizationId":1} {"background":true}`; `{"serviceId":1,"userId":1} {"unique":true,"background":true}`; `{"serviceId":1,"isApproved":1,"isPublic":1} {"background":true}`; `{"serviceId":1,"isPublic":1,"createdAt":-1} {"background":true}`

### Settings

- **Collection:** `settings` · **Area:** Core platform · **Source:** `server/models/setting.model.ts` (doc: `server/models/setting.model.ts.md`) · **Options:** timestamps=true, autoIndex=null, capped=false
- **Used by:** `server/services/settings.service.ts`
- **Hooks:** pre(save) ×5, pre(findOneAndReplace) ×1, pre(findOneAndUpdate) ×1, pre(replaceOne) ×1, pre(update) ×1, pre(updateOne) ×1, pre(updateMany) ×1, pre(remove) ×1, post(save) ×3, post(init) ×1
- **Statics/methods:** `initializeTimestamps()`

| Field | Type | Ref | Flags |
|---|---|---|---|
| `userId` | ObjectId | `User` | required, index |
| `orgId` | ObjectId | `Organization` | required, index |
| `language` | String |  |  |
| `currency` | String |  |  |
| `emailPreferences` | Map |  | default {} |
| `emailPreferences.$*` | Boolean |  |  |
| `officeDynamicEmails` | [subdoc] |  | default [] |
| `_id` | ObjectId |  |  |
| `createdAt` | Date |  |  |
| `updatedAt` | Date |  |  |

**Indexes:** `{"userId":1} {"background":true}`; `{"orgId":1} {"background":true}`; `{"userId":1,"orgId":1} {"unique":true,"background":true}`

### ShareableLink

- **Collection:** `shareablelinks` · **Area:** Core platform · **Source:** `server/models/shareableLink.model.ts` (doc: `server/models/shareableLink.model.ts.md`) · **Options:** timestamps=true, autoIndex=null, capped=false
- **Used by:** `server/controllers/shareableLink.controller.ts`
- **Hooks:** pre(save) ×5, pre(findOneAndReplace) ×1, pre(findOneAndUpdate) ×1, pre(replaceOne) ×1, pre(update) ×1, pre(updateOne) ×1, pre(updateMany) ×1, pre(remove) ×1, post(save) ×3, post(init) ×1
- **Statics/methods:** `initializeTimestamps()`

| Field | Type | Ref | Flags |
|---|---|---|---|
| `token` | String |  | required, unique |
| `linkType` | String |  | required, enum ["internal","external"] |
| `accessLevel` | String |  | default "restricted", enum ["public","restricted"] |
| `file` | ObjectId |  | required |
| `fileModel` | String |  | default "UserFile", enum ["UserFile","OrganizationFile… |
| `owner` | ObjectId | `User` | required |
| `organization` | ObjectId | `Organization` | required |
| `expiresAt` | Date |  | required |
| `maxAccessCount` | Number |  | default 100 |
| `accessCount` | Number |  | default 0 |
| `status` | String |  | default "active", enum ["active","expired","limit_re… |
| `lastAccessedAt` | Date |  | default null |
| `_id` | ObjectId |  |  |
| `createdAt` | Date |  |  |
| `updatedAt` | Date |  |  |

**Indexes:** `{"token":1} {"unique":true,"background":true}`; `{"token":1} {"unique":true,"background":true}`; `{"file":1,"linkType":1} {"unique":true,"background":true}`; `{"owner":1,"organization":1} {"background":true}`; `{"expiresAt":1} {"background":true}`; `{"status":1} {"background":true}`

### SharedAccessLog

- **Collection:** `sharedaccesslogs` · **Area:** Core platform · **Source:** `server/models/sharing.model.ts` (doc: `server/models/sharing.model.ts.md`) · **Options:** timestamps=true, autoIndex=null, capped=false
- **Used by:** `server/controllers/cabinet.controller.ts`
- **Hooks:** pre(save) ×5, pre(findOneAndReplace) ×1, pre(findOneAndUpdate) ×1, pre(replaceOne) ×1, pre(update) ×1, pre(updateOne) ×1, pre(updateMany) ×1, pre(remove) ×1, post(save) ×3, post(init) ×1
- **Statics/methods:** `initializeTimestamps()`

| Field | Type | Ref | Flags |
|---|---|---|---|
| `sharedItem` | ObjectId | `SharedItem` | required |
| `accessedBy` | ObjectId | `User` | required |
| `action` | String |  | required, enum ["view","download","edit","de… |
| `ipAddress` | String |  |  |
| `userAgent` | String |  |  |
| `metadata` | Mixed |  | default fn  |
| `_id` | ObjectId |  |  |
| `createdAt` | Date |  |  |
| `updatedAt` | Date |  |  |

**Indexes:** `{"sharedItem":1} {"background":true}`; `{"accessedBy":1} {"background":true}`; `{"action":1} {"background":true}`; `{"createdAt":1} {"background":true}`

### SharedItem

- **Collection:** `shareditems` · **Area:** Core platform · **Source:** `server/models/sharing.model.ts` (doc: `server/models/sharing.model.ts.md`) · **Options:** timestamps=true, autoIndex=null, capped=false
- **Referenced by:** `SharedAccessLog`
- **Used by:** `server/controllers/cabinet.controller.ts`
- **Hooks:** pre(save) ×5, pre(findOneAndReplace) ×1, pre(findOneAndUpdate) ×1, pre(replaceOne) ×1, pre(update) ×1, pre(updateOne) ×1, pre(updateMany) ×1, pre(remove) ×1, post(save) ×3, post(init) ×1
- **Statics/methods:** `initializeTimestamps()`

| Field | Type | Ref | Flags |
|---|---|---|---|
| `itemId` | ObjectId |  | required |
| `itemType` | String |  | required, enum ["file","cabinet"] |
| `owner` | ObjectId | `User` | required |
| `sharedWith` | ObjectId | `User` | required |
| `organization` | ObjectId | `Organization` | required |
| `permissions.canView` | Boolean |  | default true |
| `permissions.canDownload` | Boolean |  | default true |
| `permissions.canEdit` | Boolean |  | default false |
| `permissions.canDelete` | Boolean |  | default false |
| `message` | String |  |  |
| `status` | String |  | default "pending", enum ["pending","accepted","declin… |
| `respondedAt` | Date |  |  |
| `expiresAt` | Date |  |  |
| `metadata` | Mixed |  | default fn  |
| `_id` | ObjectId |  |  |
| `createdAt` | Date |  |  |
| `updatedAt` | Date |  |  |

**Indexes:** `{"owner":1,"organization":1} {"background":true}`; `{"sharedWith":1,"organization":1} {"background":true}`; `{"itemId":1,"itemType":1} {"background":true}`; `{"status":1} {"background":true}`; `{"expiresAt":1} {"background":true}`; `{"itemId":1,"itemType":1,"sharedWith":1} {"unique":true,"background":true}`

### SocialAccount

- **Collection:** `socialaccounts` · **Area:** Core platform · **Source:** `server/models/socialAccount.model.ts` (doc: `server/models/socialAccount.model.ts.md`) · **Options:** timestamps=true, autoIndex=null, capped=false
- **Referenced by:** `ContentSubmission`
- **Used by:** `server/routes/contentSubmission.ts`, `server/routes/linkPreview.ts`, `server/routes/socialAccount.ts`, `server/routes/socialOAuth.ts`, `server/services/contentPayoutSweeper.ts`
- **Hooks:** pre(save) ×5, pre(findOneAndReplace) ×1, pre(findOneAndUpdate) ×1, pre(replaceOne) ×1, pre(update) ×1, pre(updateOne) ×1, pre(updateMany) ×1, pre(remove) ×1, post(save) ×3, post(init) ×1
- **Statics/methods:** `initializeTimestamps()`

| Field | Type | Ref | Flags |
|---|---|---|---|
| `userId` | ObjectId | `User` | required, index |
| `platform` | String |  | required, enum ["instagram","youtube"] |
| `profileUrl` | String |  | required |
| `username` | String |  | required |
| `verificationCode` | String |  | default "" |
| `isVerified` | Boolean |  | default false |
| `verifiedAt` | Date |  | default null |
| `oauthConnected` | Boolean |  | default false |
| `accessToken` | String |  | default null |
| `refreshToken` | String |  | default null |
| `tokenExpiresAt` | Date |  | default null |
| `platformUserId` | String |  | default null |
| `followerCount` | Number |  | default 0 |
| `_id` | ObjectId |  |  |
| `createdAt` | Date |  |  |
| `updatedAt` | Date |  |  |

**Indexes:** `{"userId":1} {"background":true}`; `{"userId":1,"platform":1} {"unique":true,"name":"user_platform_unique","background":true}`; `{"platform":1,"username":1} {"name":"platform_username_idx","background":true}`

### StandaloneVideo

- **Collection:** `standalonevideos` · **Area:** Core platform · **Source:** `server/models/standaloneVideo.model.ts` (doc: `server/models/standaloneVideo.model.ts.md`) · **Options:** timestamps=true, autoIndex=null, capped=false
- **Used by:** `server/routes/contentEngagement.ts`, `server/routes/feed.ts`, `server/routes/public.ts`, `server/routes/standaloneVideo.ts`, `server/services/playlist.ts`
- **Hooks:** pre(save) ×5, pre(findOneAndReplace) ×1, pre(findOneAndUpdate) ×1, pre(replaceOne) ×1, pre(update) ×1, pre(updateOne) ×1, pre(updateMany) ×1, pre(remove) ×1, post(save) ×3, post(init) ×1
- **Statics/methods:** `initializeTimestamps()`

| Field | Type | Ref | Flags |
|---|---|---|---|
| `title` | String |  | required |
| `description` | String |  |  |
| `thumbnail` | String |  |  |
| `videoUrl` | String |  |  |
| `videoS3Key` | String |  |  |
| `sourceType` | String |  | required, default "upload", enum ["upload","link"] |
| `duration` | Number |  | default 0 |
| `orgId` | ObjectId | `Organization` | required, index |
| `createdBy` | ObjectId | `User` | required, index |
| `isPublished` | Boolean |  | default true |
| `_id` | ObjectId |  |  |
| `createdAt` | Date |  |  |
| `updatedAt` | Date |  |  |

**Indexes:** `{"orgId":1} {"background":true}`; `{"createdBy":1} {"background":true}`; `{"orgId":1,"isPublished":1,"createdAt":-1} {"background":true}`; `{"createdBy":1,"createdAt":-1} {"background":true}`

### Store

- **Collection:** `stores` · **Area:** Core platform · **Source:** `server/models/store.model.ts` (doc: `server/models/store.model.ts.md`) · **Options:** timestamps=true, strict=false, autoIndex=null, capped=false
- **Used by:** `server/realtime/mediasoupHandlers.ts`, `server/routes/counterBills.ts`, `server/services/auctionSettlement.ts`, `server/services/commission.ts`, `server/services/counterBill.ts`, `server/services/ecommerceInvoice.ts`
- **Hooks:** pre(save) ×5, pre(findOneAndReplace) ×1, pre(findOneAndUpdate) ×1, pre(replaceOne) ×1, pre(update) ×1, pre(updateOne) ×1, pre(updateMany) ×1, pre(remove) ×1, post(save) ×3, post(init) ×1
- **Statics/methods:** `initializeTimestamps()`

| Field | Type | Ref | Flags |
|---|---|---|---|
| `orgId` | ObjectId |  | required, index |
| `name` | String |  | required |
| `slug` | String |  |  |
| `currency` | String |  | required |
| `timezone` | String |  |  |
| `isActive` | Boolean |  |  |
| `storeKind` | String |  | enum ["online","offline"] |
| `branding` | Mixed |  |  |
| `_id` | ObjectId |  |  |
| `createdAt` | Date |  |  |
| `updatedAt` | Date |  |  |

**Indexes:** `{"orgId":1} {"background":true}`

### StoreCouponCommission

- **Collection:** `storecouponcommissions` · **Area:** Core platform · **Source:** `server/models/storeCouponCommission.model.ts` (doc: `server/models/storeCouponCommission.model.ts.md`) · **Options:** timestamps=true, autoIndex=null, capped=false
- **Referenced by:** `StoreCouponCommissionFire`
- **Used by:** `server/routes/founderStoreCommissions.ts`, `server/services/storeCouponCommission.ts`
- **Hooks:** pre(save) ×6, pre(findOneAndReplace) ×1, pre(findOneAndUpdate) ×1, pre(replaceOne) ×1, pre(update) ×1, pre(updateOne) ×1, pre(updateMany) ×1, pre(remove) ×1, post(save) ×3, post(init) ×1
- **Statics/methods:** `initializeTimestamps()`

| Field | Type | Ref | Flags |
|---|---|---|---|
| `orgId` | ObjectId | `Organization` | required, index |
| `name` | String |  | required |
| `triggerItemId` | ObjectId | `StoreProduct` | index |
| `levels` | [subdoc] |  | required |
| `isActive` | Boolean |  | index, default true |
| `effectiveFrom` | Date |  | required, default fn default |
| `capType` | String |  | default "perpetual", enum ["perpetual","per_pair_capped… |
| `capCount` | Number |  |  |
| `createdBy` | ObjectId | `User` | required |
| `_id` | ObjectId |  |  |
| `createdAt` | Date |  |  |
| `updatedAt` | Date |  |  |

**Indexes:** `{"orgId":1} {"background":true}`; `{"triggerItemId":1} {"background":true}`; `{"isActive":1} {"background":true}`; `{"orgId":1,"isActive":1} {"background":true}`; `{"triggerItemId":1,"isActive":1} {"background":true}`

### StoreCouponCommissionFire

- **Collection:** `storecouponcommissionfires` · **Area:** Core platform · **Source:** `server/models/storeCouponCommissionFire.model.ts` (doc: `server/models/storeCouponCommissionFire.model.ts.md`) · **Options:** timestamps=true, autoIndex=null, capped=false
- **Used by:** `server/services/storeCouponCommission.ts`
- **Hooks:** pre(save) ×5, pre(findOneAndReplace) ×1, pre(findOneAndUpdate) ×1, pre(replaceOne) ×1, pre(update) ×1, pre(updateOne) ×1, pre(updateMany) ×1, pre(remove) ×1, post(save) ×3, post(init) ×1
- **Statics/methods:** `initializeTimestamps()`

| Field | Type | Ref | Flags |
|---|---|---|---|
| `ruleId` | ObjectId | `StoreCouponCommission` | required, index |
| `orgId` | ObjectId | `Organization` | required |
| `level` | Number |  | required |
| `recipientId` | ObjectId | `User` | required |
| `buyerId` | ObjectId | `User` | required |
| `invoiceId` | ObjectId | `Invoice` | required |
| `couponId` | ObjectId | `PlatformCoupon` | required |
| `quantity` | Number |  | required |
| `_id` | ObjectId |  |  |
| `createdAt` | Date |  |  |
| `updatedAt` | Date |  |  |

**Indexes:** `{"ruleId":1} {"background":true}`; `{"ruleId":1,"recipientId":1,"buyerId":1} {"background":true}`; `{"ruleId":1,"invoiceId":1,"recipientId":1} {"unique":true,"background":true}`; `{"orgId":1,"createdAt":-1} {"background":true}`

### StoreDrop

- **Collection:** `storedrops` · **Area:** Core platform · **Source:** `server/models/storeDrop.model.ts` (doc: `server/models/storeDrop.model.ts.md`) · **Options:** strict=false, autoIndex=null, capped=false
- **Used by:** `server/services/invoice.ts`
- **Hooks:** pre(save) ×4, pre(remove) ×1, post(save) ×3, post(init) ×1

| Field | Type | Ref | Flags |
|---|---|---|---|
| `authorId` | ObjectId |  |  |
| `authorName` | String |  |  |
| `productId` | ObjectId |  |  |
| `status` | String |  |  |
| `_id` | ObjectId |  |  |

### StoreProduct

- **Collection:** `storeproducts` · **Area:** Core platform · **Source:** `server/models/storeProduct.model.ts` (doc: `server/models/storeProduct.model.ts.md`) · **Options:** timestamps=true, strict=false, autoIndex=null, capped=false
- **Referenced by:** `AuctionEscrow`, `AuctionSettlement`, `AuctionWalletTransaction`, `StoreCouponCommission`
- **Used by:** `server/realtime/mediasoupHandlers.ts`, `server/routes/affiliate.ts`, `server/routes/founderCouponItems.ts`, `server/routes/founderCouponRules.ts`, `server/routes/founderStoreCommissions.ts`, `server/routes/garageAdminAuctionSettlements.ts`, `server/routes/internal-catalog.ts`, `server/scripts/diagnoseAuctionSettlement.ts`, … +7 more
- **Hooks:** pre(save) ×5, pre(findOneAndReplace) ×1, pre(findOneAndUpdate) ×1, pre(replaceOne) ×1, pre(update) ×1, pre(updateOne) ×1, pre(updateMany) ×1, pre(remove) ×1, post(save) ×4, post(findOneAndUpdate) ×1, post(findOneAndDelete) ×1, post(deleteOne) ×1, post(init) ×1
- **Statics/methods:** `initializeTimestamps()`

| Field | Type | Ref | Flags |
|---|---|---|---|
| `orgId` | ObjectId |  | required, index |
| `title` | String |  | required |
| `slug` | String |  |  |
| `description` | String |  |  |
| `vendor` | String |  |  |
| `productType` | String |  |  |
| `status` | String |  | default "active" |
| `tags` | [String] |  |  |
| `price` | Number |  | required |
| `compareAtPrice` | Number |  |  |
| `sku` | String |  |  |
| `trackInventory` | Boolean |  |  |
| `quantity` | Number |  |  |
| `requiresShipping` | Boolean |  |  |
| `isPhysicalProduct` | Boolean |  |  |
| `hasVariants` | Boolean |  |  |
| `images` | [subdoc] |  |  |
| `featuredImage` | String |  |  |
| `category` | ObjectId |  |  |
| `publishedAt` | Date |  |  |
| `gstInclusive` | Boolean |  |  |
| `taxable` | Boolean |  |  |
| `_id` | ObjectId |  |  |
| `createdAt` | Date |  |  |
| `updatedAt` | Date |  |  |

**Indexes:** `{"orgId":1} {"background":true}`

### StoreWallet

- **Collection:** `storewallets` · **Area:** Core platform · **Source:** `server/models/storeWallet.model.ts` (doc: `server/models/storeWallet.model.ts.md`) · **Options:** timestamps=true, autoIndex=null, capped=false
- **Referenced by:** `CryptoTopupTransaction`, `EventProgram`, `OfficeUpgradeHistory`, `StoreWallet`, `WalletTransaction`
- **Used by:** `scripts/test-franchise-e2e.ts`, `server/bat246/services/bat246LostMoneyAutoPay.service.ts`, `server/bat246/services/bat246Wallet.util.ts`, `server/controllers/garageAdmin.controller.ts`, `server/routes/bond.ts`, `server/routes/ecommerceWallet.ts`, `server/routes/garageAdminReferralBonus.ts`, `server/routes/garageAdminStoreWallets.ts`, … +55 more
- **Hooks:** pre(save) ×5, pre(findOneAndReplace) ×1, pre(findOneAndUpdate) ×2, pre(replaceOne) ×1, pre(update) ×1, pre(updateOne) ×1, pre(updateMany) ×1, pre(findOne) ×1, pre(remove) ×1, post(save) ×3, post(init) ×1
- **Statics/methods:** `initializeTimestamps()`

| Field | Type | Ref | Flags |
|---|---|---|---|
| `userId` | ObjectId | `User` | required, index |
| `orgId` | ObjectId | `Organization` | required, index |
| `balance` | Number |  | required, default 0 |
| `currency` | String |  | default "USD" |
| `parentWalletId` | ObjectId | `StoreWallet` | index |
| `isActive` | Boolean |  | default true |
| `lastTransactionAt` | Date |  |  |
| `_id` | ObjectId |  |  |
| `createdAt` | Date |  |  |
| `updatedAt` | Date |  |  |

**Indexes:** `{"userId":1} {"background":true}`; `{"orgId":1} {"background":true}`; `{"parentWalletId":1} {"background":true}`; `{"userId":1,"orgId":1,"currency":1} {"unique":true,"background":true}`; `{"orgId":1,"balance":-1} {"background":true}`

### StudySession

- **Collection:** `studysessions` · **Area:** Core platform · **Source:** `server/models/studySession.model.ts` (doc: `server/models/studySession.model.ts.md`) · **Options:** timestamps=true, autoIndex=null, capped=false
- **Used by:** `server/services/studySession.ts`
- **Hooks:** pre(save) ×5, pre(findOneAndReplace) ×1, pre(findOneAndUpdate) ×1, pre(replaceOne) ×1, pre(update) ×1, pre(updateOne) ×1, pre(updateMany) ×1, pre(remove) ×1, post(save) ×3, post(init) ×1
- **Statics/methods:** `initializeTimestamps()`

| Field | Type | Ref | Flags |
|---|---|---|---|
| `userId` | ObjectId |  | required, index |
| `organizationId` | ObjectId |  | required, index |
| `courseId` | ObjectId | `Course` | required |
| `chapterId` | ObjectId |  |  |
| `sectionId` | ObjectId |  |  |
| `startedAt` | Date |  | required, default fn now |
| `endedAt` | Date |  |  |
| `duration` | Number |  | default 0 |
| `lastHeartbeat` | Date |  | required, default fn now |
| `courseTitle` | String |  | default "" |
| `chapterTitle` | String |  | default "" |
| `_id` | ObjectId |  |  |
| `createdAt` | Date |  |  |
| `updatedAt` | Date |  |  |

**Indexes:** `{"userId":1} {"background":true}`; `{"organizationId":1} {"background":true}`; `{"userId":1,"startedAt":-1} {"background":true}`; `{"userId":1,"organizationId":1,"startedAt":-1} {"background":true}`; `{"userId":1,"organizationId":1,"endedAt":1} {"background":true}`

### Subscription

- **Collection:** `subscriptions` · **Area:** Core platform · **Source:** `server/models/subscription.model.ts` (doc: `server/models/subscription.model.ts.md`) · **Options:** timestamps=true, autoIndex=null, capped=false
- **Referenced by:** `CouponUsage`, `Invoice`, `SubscriptionPayment`
- **Used by:** `server/middleware/subscriptionAccess.ts`, `server/routes/feed.ts`, `server/routes/subscriptionAdmin.ts`, `server/routes/subscriptions.ts`, `server/routes/unifiedOrders.ts`, `server/services/subscription.ts`
- **Hooks:** pre(save) ×5, pre(findOneAndReplace) ×1, pre(findOneAndUpdate) ×1, pre(replaceOne) ×1, pre(update) ×1, pre(updateOne) ×1, pre(updateMany) ×1, pre(remove) ×1, post(save) ×3, post(init) ×1
- **Statics/methods:** `initializeTimestamps()`

| Field | Type | Ref | Flags |
|---|---|---|---|
| `razorpaySubscriptionId` | String |  | required, unique, index |
| `razorpayPlanId` | String |  | required |
| `razorpayCustomerId` | String |  | index |
| `planId` | ObjectId | `SubscriptionPlan` | required |
| `userId` | ObjectId | `User` | required, index |
| `orgId` | ObjectId | `Organization` | required, index |
| `itemType` | String |  | required, enum ["channel","course","workshop… |
| `itemId` | ObjectId |  | required |
| `sellerId` | ObjectId | `User` | required, index |
| `status` | String |  | index, default "created", enum ["created","authenticated","a… |
| `currentStart` | Date |  |  |
| `currentEnd` | Date |  | index |
| `chargeAt` | Date |  | index |
| `startedAt` | Date |  |  |
| `endedAt` | Date |  |  |
| `cancelledAt` | Date |  |  |
| `pausedAt` | Date |  |  |
| `totalCount` | Number |  |  |
| `paidCount` | Number |  | default 0 |
| `remainingCount` | Number |  |  |
| `shortUrl` | String |  |  |
| `paymentMethod` | String |  | enum ["card","upi","emandate","nac… |
| `offerId` | String |  |  |
| `metadata` | Mixed |  |  |
| `_id` | ObjectId |  |  |
| `createdAt` | Date |  |  |
| `updatedAt` | Date |  |  |

**Indexes:** `{"razorpaySubscriptionId":1} {"unique":true,"background":true}`; `{"razorpayCustomerId":1} {"background":true}`; `{"userId":1} {"background":true}`; `{"orgId":1} {"background":true}`; `{"sellerId":1} {"background":true}`; `{"status":1} {"background":true}`; `{"currentEnd":1} {"background":true}`; `{"chargeAt":1} {"background":true}`; `{"userId":1,"itemType":1,"itemId":1} {"background":true}`; `{"userId":1,"status":1} {"background":true}`; `{"currentEnd":1,"status":1} {"background":true}`; `{"chargeAt":1,"status":1} {"background":true}`; `{"sellerId":1,"status":1,"createdAt":-1} {"background":true}`; `{"orgId":1,"status":1,"createdAt":-1} {"background":true}`

### SubscriptionPayment

- **Collection:** `subscriptionpayments` · **Area:** Core platform · **Source:** `server/models/subscriptionPayment.model.ts` (doc: `server/models/subscriptionPayment.model.ts.md`) · **Options:** timestamps=true, autoIndex=null, capped=false
- **Used by:** `server/routes/officeSubscriptionAdmin.ts`, `server/routes/subscriptionAdmin.ts`, `server/routes/subscriptions.ts`, `server/routes/unifiedOrders.ts`, `server/services/subscription.ts`
- **Hooks:** pre(save) ×5, pre(findOneAndReplace) ×1, pre(findOneAndUpdate) ×1, pre(replaceOne) ×1, pre(update) ×1, pre(updateOne) ×1, pre(updateMany) ×1, pre(remove) ×1, post(save) ×3, post(init) ×1
- **Statics/methods:** `initializeTimestamps()`

| Field | Type | Ref | Flags |
|---|---|---|---|
| `subscriptionId` | ObjectId | `Subscription` | required, index |
| `razorpayPaymentId` | String |  | required, unique, index |
| `razorpaySubscriptionId` | String |  | required, index |
| `razorpayOrderId` | String |  |  |
| `razorpayInvoiceId` | String |  |  |
| `invoiceShortUrl` | String |  |  |
| `userId` | ObjectId | `User` | required, index |
| `orgId` | ObjectId | `Organization` | required, index |
| `sellerId` | ObjectId | `User` | required, index |
| `amount` | Number |  | required |
| `currency` | String |  | default "INR" |
| `status` | String |  | index, default "created", enum ["created","authorized","capt… |
| `paymentNumber` | Number |  | required |
| `method` | String |  |  |
| `cardId` | String |  |  |
| `bank` | String |  |  |
| `wallet` | String |  |  |
| `vpa` | String |  |  |
| `fee` | Number |  |  |
| `tax` | Number |  |  |
| `errorCode` | String |  |  |
| `errorDescription` | String |  |  |
| `errorSource` | String |  |  |
| `errorStep` | String |  |  |
| `errorReason` | String |  |  |
| `notes` | Mixed |  |  |
| `commissionDistributed` | Boolean |  | default false |
| `commissionDistributionId` | ObjectId | `CommissionDistribution` |  |
| `paidAt` | Date |  |  |
| `refundedAt` | Date |  |  |
| `_id` | ObjectId |  |  |
| `createdAt` | Date |  |  |
| `updatedAt` | Date |  |  |

**Indexes:** `{"subscriptionId":1} {"background":true}`; `{"razorpayPaymentId":1} {"unique":true,"background":true}`; `{"razorpaySubscriptionId":1} {"background":true}`; `{"userId":1} {"background":true}`; `{"orgId":1} {"background":true}`; `{"sellerId":1} {"background":true}`; `{"status":1} {"background":true}`; `{"subscriptionId":1,"paymentNumber":1} {"background":true}`; `{"userId":1,"status":1,"createdAt":-1} {"background":true}`; `{"sellerId":1,"status":1,"createdAt":-1} {"background":true}`; `{"orgId":1,"status":1,"createdAt":-1} {"background":true}`; `{"status":1,"commissionDistributed":1} {"background":true}`

### SubscriptionPlan

- **Collection:** `subscriptionplans` · **Area:** Core platform · **Source:** `server/models/subscriptionPlan.model.ts` (doc: `server/models/subscriptionPlan.model.ts.md`) · **Options:** timestamps=true, autoIndex=null, capped=false
- **Referenced by:** `Subscription`
- **Used by:** `server/middleware/subscriptionAccess.ts`, `server/models/subscription.model.ts`, `server/routes/feed.ts`, `server/routes/subscriptionAdmin.ts`, `server/routes/subscriptions.ts`, `server/services/subscription.ts`
- **Hooks:** pre(save) ×5, pre(findOneAndReplace) ×1, pre(findOneAndUpdate) ×1, pre(replaceOne) ×1, pre(update) ×1, pre(updateOne) ×1, pre(updateMany) ×1, pre(remove) ×1, post(save) ×3, post(init) ×1
- **Statics/methods:** `initializeTimestamps()`

| Field | Type | Ref | Flags |
|---|---|---|---|
| `razorpayPlanId` | String |  | required, unique, index |
| `itemType` | String |  | required, enum ["channel","course","workshop… |
| `itemId` | ObjectId |  | required |
| `orgId` | ObjectId | `Organization` | required, index |
| `sellerId` | ObjectId | `User` | required, index |
| `name` | String |  | required |
| `description` | String |  |  |
| `amount` | Number |  | required |
| `currency` | String |  | default "USD", enum ["INR","USD"] |
| `period` | String |  | required, enum ["weekly","monthly","quarterl… |
| `interval` | Number |  | default 1 |
| `trialDays` | Number |  | default 0 |
| `isActive` | Boolean |  | default true |
| `_id` | ObjectId |  |  |
| `createdAt` | Date |  |  |
| `updatedAt` | Date |  |  |

**Indexes:** `{"razorpayPlanId":1} {"unique":true,"background":true}`; `{"orgId":1} {"background":true}`; `{"sellerId":1} {"background":true}`; `{"itemType":1,"itemId":1,"isActive":1} {"background":true}`; `{"orgId":1,"isActive":1} {"background":true}`; `{"sellerId":1,"isActive":1} {"background":true}`

### SupportTaskAssignment

- **Collection:** `support_task_assignments` · **Area:** Core platform · **Source:** `server/models/supportTaskAssignment.model.ts` (doc: `server/models/supportTaskAssignment.model.ts.md`) · **Options:** timestamps={"createdAt":true,"updatedAt"…, autoIndex=null, capped=false
- **Used by:** `server/services/supportChatTaskroom.ts`
- **Hooks:** pre(save) ×5, pre(findOneAndReplace) ×1, pre(findOneAndUpdate) ×1, pre(replaceOne) ×1, pre(update) ×1, pre(updateOne) ×1, pre(updateMany) ×1, pre(remove) ×1, post(save) ×3, post(init) ×1
- **Statics/methods:** `initializeTimestamps()`

| Field | Type | Ref | Flags |
|---|---|---|---|
| `groupId` | ObjectId | `Group` | required, index |
| `taskId` | String |  | required |
| `userId` | ObjectId | `User` | required |
| `name` | String |  | required |
| `assignedBy` | String |  | default null |
| `_id` | ObjectId |  |  |
| `createdAt` | Date |  |  |

**Indexes:** `{"groupId":1} {"background":true}`; `{"groupId":1,"taskId":1,"userId":1} {"unique":true,"background":true}`

### SupportTicket

- **Collection:** `supporttickets` · **Area:** Core platform · **Source:** `server/models/supportTicket.model.ts` (doc: `server/models/supportTicket.model.ts.md`) · **Options:** timestamps=true, autoIndex=null, capped=false
- **Used by:** `server/routes/supportTickets.ts`, `server/scripts/migrate-support-tickets.ts`
- **Hooks:** pre(save) ×5, pre(findOneAndReplace) ×1, pre(findOneAndUpdate) ×1, pre(replaceOne) ×1, pre(update) ×1, pre(updateOne) ×1, pre(updateMany) ×1, pre(remove) ×1, post(save) ×3, post(init) ×1
- **Statics/methods:** `initializeTimestamps()`

| Field | Type | Ref | Flags |
|---|---|---|---|
| `orgId` | ObjectId | `Organization` | required, index |
| `createdBy` | ObjectId | `User` | required, index |
| `subject` | String |  | required |
| `description` | String |  | required |
| `module` | String |  | required, default "General" |
| `priority` | String |  | default "medium", enum ["low","medium","high","urgen… |
| `status` | String |  | index, default "open", enum ["open","in_progress","resolv… |
| `attachments` | [String] |  | default [] |
| `assignedTo` | ObjectId | `User` | index |
| `assignedToFloor` | ObjectId | `Floor` | index |
| `assignedAt` | Date |  |  |
| `assignedBy` | ObjectId | `User` |  |
| `responses` | [subdoc] |  |  |
| `_id` | ObjectId |  |  |
| `createdAt` | Date |  |  |
| `updatedAt` | Date |  |  |

**Indexes:** `{"orgId":1} {"background":true}`; `{"createdBy":1} {"background":true}`; `{"status":1} {"background":true}`; `{"assignedTo":1} {"background":true}`; `{"assignedToFloor":1} {"background":true}`; `{"orgId":1,"status":1} {"background":true}`; `{"orgId":1,"createdBy":1} {"background":true}`; `{"orgId":1,"createdAt":-1} {"background":true}`

### SupportTicketBoard

- **Collection:** `support_ticket_board` · **Area:** Core platform · **Source:** `server/models/supportTicketBoard.model.ts` (doc: `server/models/supportTicketBoard.model.ts.md`) · **Options:** timestamps=true, autoIndex=null, capped=false
- **Used by:** `server/services/supportTicketTaskroom.ts`
- **Hooks:** pre(save) ×5, pre(findOneAndReplace) ×1, pre(findOneAndUpdate) ×1, pre(replaceOne) ×1, pre(update) ×1, pre(updateOne) ×1, pre(updateMany) ×1, pre(remove) ×1, post(save) ×3, post(init) ×1
- **Statics/methods:** `initializeTimestamps()`

| Field | Type | Ref | Flags |
|---|---|---|---|
| `key` | String |  | required, unique, default "support" |
| `ownerUserId` | ObjectId | `User` |  |
| `orgId` | ObjectId | `Organization` |  |
| `workspaceId` | String |  |  |
| `workspaceName` | String |  | default null |
| `spaceId` | String |  |  |
| `roomId` | String |  |  |
| `roomName` | String |  | default null |
| `selectedBy` | String |  | default null |
| `selectedAt` | Date |  | default null |
| `stageId` | String |  |  |
| `status` | String |  | index, default "provisioning", enum ["provisioning","ready","fail… |
| `lastError` | String |  | default null |
| `provisionedAt` | Date |  | default null |
| `_id` | ObjectId |  |  |
| `createdAt` | Date |  |  |
| `updatedAt` | Date |  |  |

**Indexes:** `{"key":1} {"unique":true,"background":true}`; `{"status":1} {"background":true}`

### Task

- **Collection:** `tasks` · **Area:** Core platform · **Source:** `server/models/task.model.ts` (doc: `server/models/task.model.ts.md`) · **Options:** timestamps=true, autoIndex=null, capped=false
- **Used by:** `server/routes/tasks.ts`, `server/services/memberCleanup.service.ts`
- **Hooks:** pre(save) ×5, pre(findOneAndReplace) ×1, pre(findOneAndUpdate) ×1, pre(replaceOne) ×1, pre(update) ×1, pre(updateOne) ×1, pre(updateMany) ×1, pre(remove) ×1, post(save) ×3, post(init) ×1
- **Statics/methods:** `initializeTimestamps()`

| Field | Type | Ref | Flags |
|---|---|---|---|
| `orgId` | ObjectId | `Organization` | required, index |
| `title` | String |  | required |
| `status` | String |  | index, default "todo", enum ["todo","inprogress","done"] |
| `assignedTo` | ObjectId | `User` |  |
| `createdBy` | ObjectId | `User` | required |
| `dueDate` | Date |  |  |
| `_id` | ObjectId |  |  |
| `createdAt` | Date |  |  |
| `updatedAt` | Date |  |  |

**Indexes:** `{"orgId":1} {"background":true}`; `{"status":1} {"background":true}`

### TeamforceBranch

- **Collection:** `teamforcebranches` · **Area:** Core platform · **Source:** `server/models/teamforce/teamforceBranch.model.ts` (doc: `server/models/teamforce/teamforceBranch.model.ts.md`) · **Options:** timestamps=true, autoIndex=null, capped=false
- **Referenced by:** `TeamforceEmployeeProfile`
- **Used by:** `server/routes/teamforce/branches.ts`
- **Hooks:** pre(save) ×5, pre(findOneAndReplace) ×1, pre(findOneAndUpdate) ×1, pre(replaceOne) ×1, pre(update) ×1, pre(updateOne) ×1, pre(updateMany) ×1, pre(remove) ×1, post(save) ×3, post(init) ×1
- **Statics/methods:** `initializeTimestamps()`

| Field | Type | Ref | Flags |
|---|---|---|---|
| `orgId` | ObjectId | `Organization` | required |
| `name` | String |  | required |
| `code` | String |  |  |
| `address` | String |  |  |
| `city` | String |  |  |
| `state` | String |  |  |
| `country` | String |  |  |
| `postalCode` | String |  |  |
| `isActive` | Boolean |  | default true |
| `_id` | ObjectId |  |  |
| `createdAt` | Date |  |  |
| `updatedAt` | Date |  |  |

**Indexes:** `{"orgId":1,"name":1} {"unique":true,"background":true}`; `{"orgId":1} {"background":true}`

### TeamforceBreakLog

- **Collection:** `teamforcebreaklogs` · **Area:** Core platform · **Source:** `server/models/teamforce/teamforceBreakLog.model.ts` (doc: `server/models/teamforce/teamforceBreakLog.model.ts.md`) · **Options:** timestamps=true, autoIndex=null, capped=false
- **Used by:** `server/routes/betty.ts`, `server/routes/teamforce/breakSettings.ts`
- **Hooks:** pre(save) ×5, pre(findOneAndReplace) ×1, pre(findOneAndUpdate) ×1, pre(replaceOne) ×1, pre(update) ×1, pre(updateOne) ×1, pre(updateMany) ×1, pre(remove) ×1, post(save) ×3, post(init) ×1
- **Statics/methods:** `initializeTimestamps()`

| Field | Type | Ref | Flags |
|---|---|---|---|
| `userId` | ObjectId | `User` | required, index |
| `orgId` | ObjectId | `Organization` | required, index |
| `timeTrackingId` | ObjectId | `TimeTracking` |  |
| `breakStartTime` | Date |  | required |
| `breakStopTime` | Date |  |  |
| `durationInSeconds` | Number |  |  |
| `withinBudgetSeconds` | Number |  | default 0 |
| `overBudgetSeconds` | Number |  | default 0 |
| `isBreach` | Boolean |  | default false |
| `triggeredBreach` | Boolean |  | default false |
| `_id` | ObjectId |  |  |
| `createdAt` | Date |  |  |
| `updatedAt` | Date |  |  |

**Indexes:** `{"userId":1} {"background":true}`; `{"orgId":1} {"background":true}`; `{"userId":1,"orgId":1} {"background":true}`; `{"timeTrackingId":1} {"background":true}`

### TeamforceBreakSettings

- **Collection:** `teamforcebreaksettings` · **Area:** Core platform · **Source:** `server/models/teamforce/teamforceBreakSettings.model.ts` (doc: `server/models/teamforce/teamforceBreakSettings.model.ts.md`) · **Options:** timestamps=true, autoIndex=null, capped=false
- **Used by:** `server/routes/teamforce/breakSettings.ts`
- **Hooks:** pre(save) ×5, pre(findOneAndReplace) ×1, pre(findOneAndUpdate) ×1, pre(replaceOne) ×1, pre(update) ×1, pre(updateOne) ×1, pre(updateMany) ×1, pre(remove) ×1, post(save) ×3, post(init) ×1
- **Statics/methods:** `initializeTimestamps()`

| Field | Type | Ref | Flags |
|---|---|---|---|
| `orgId` | ObjectId | `Organization` | required, index |
| `name` | String |  | required |
| `activateBreaks` | Boolean |  | default false |
| `scopeType` | String |  | default "Universal", enum ["Universal","By Department",… |
| `scopeTargets` | [String] |  | default [] |
| `breakMinutesPerDay` | Number |  | default 60 |
| `breachAffectsPayroll` | Boolean |  | default false |
| `maxBreachMinutesAllowed` | Number |  | default 0 |
| `maxBreachesAllowed` | Number |  | default 0 |
| `payrollImpact` | Embedded |  | default fn default |
| `_id` | ObjectId |  |  |
| `createdAt` | Date |  |  |
| `updatedAt` | Date |  |  |

**Indexes:** `{"orgId":1} {"background":true}`; `{"orgId":1,"name":1} {"unique":true,"background":true}`

### TeamforceCandidate

- **Collection:** `teamforcecandidates` · **Area:** Core platform · **Source:** `server/models/teamforce/teamforceCandidate.model.ts` (doc: `server/models/teamforce/teamforceCandidate.model.ts.md`) · **Options:** timestamps=true, autoIndex=null, capped=false
- **Used by:** `server/routes/teamforce/candidates.ts`
- **Hooks:** pre(save) ×5, pre(findOneAndReplace) ×1, pre(findOneAndUpdate) ×1, pre(replaceOne) ×1, pre(update) ×1, pre(updateOne) ×1, pre(updateMany) ×1, pre(remove) ×1, post(save) ×3, post(init) ×1
- **Statics/methods:** `initializeTimestamps()`

| Field | Type | Ref | Flags |
|---|---|---|---|
| `orgId` | ObjectId | `Organization` | required, index |
| `recruitmentRequestId` | ObjectId | `TeamforceRecruitmentRequest` | required, index |
| `positionName` | String |  | required |
| `department` | String |  | default "" |
| `jobLocation` | String |  | default "" |
| `fullName` | String |  | required |
| `mobileNumber` | String |  | required |
| `email` | String |  | required, index |
| `yearsOfExperience` | Number |  | required, default 0 |
| `experienceDetails` | String |  | default "" |
| `currentCtc` | String |  | default "" |
| `expectedCtc` | String |  | default "" |
| `noticePeriod` | String |  | default "" |
| `resumeKey` | String |  | required |
| `resumeFileName` | String |  | required |
| `resumeContentType` | String |  | default "application/octet-stream" |
| `resumeSize` | Number |  | default 0 |
| `customFieldValues` | [subdoc] |  | default [] |
| `stage` | String |  | index, default "applied", enum ["applied","reviewing","short… |
| `notes` | String |  | default "" |
| `isActive` | Boolean |  | default true |
| `_id` | ObjectId |  |  |
| `createdAt` | Date |  |  |
| `updatedAt` | Date |  |  |

**Indexes:** `{"orgId":1} {"background":true}`; `{"recruitmentRequestId":1} {"background":true}`; `{"email":1} {"background":true}`; `{"stage":1} {"background":true}`; `{"orgId":1,"recruitmentRequestId":1,"createdAt":-1} {"background":true}`

### TeamforceDepartment

- **Collection:** `teamforcedepartments` · **Area:** Core platform · **Source:** `server/models/teamforce/teamforceDepartment.model.ts` (doc: `server/models/teamforce/teamforceDepartment.model.ts.md`) · **Options:** timestamps=true, autoIndex=null, capped=false
- **Referenced by:** `TeamforceEmployeeProfile`
- **Used by:** `server/routes/teamforce/departments.ts`
- **Hooks:** pre(save) ×5, pre(findOneAndReplace) ×1, pre(findOneAndUpdate) ×1, pre(replaceOne) ×1, pre(update) ×1, pre(updateOne) ×1, pre(updateMany) ×1, pre(remove) ×1, post(save) ×3, post(init) ×1
- **Statics/methods:** `initializeTimestamps()`

| Field | Type | Ref | Flags |
|---|---|---|---|
| `orgId` | ObjectId | `Organization` | required |
| `name` | String |  | required |
| `description` | String |  |  |
| `headId` | ObjectId | `User` |  |
| `isActive` | Boolean |  | default true |
| `_id` | ObjectId |  |  |
| `createdAt` | Date |  |  |
| `updatedAt` | Date |  |  |

**Indexes:** `{"orgId":1,"name":1} {"unique":true,"background":true}`; `{"orgId":1} {"background":true}`

### TeamforceEmployeeProfile

- **Collection:** `teamforceemployeeprofiles` · **Area:** Core platform · **Source:** `server/models/teamforce/teamforceEmployeeProfile.model.ts` (doc: `server/models/teamforce/teamforceEmployeeProfile.model.ts.md`) · **Options:** timestamps=true, autoIndex=null, capped=false
- **Used by:** `server/routes/betty.ts`, `server/routes/teamforce/_helpers.ts`, `server/routes/teamforce/breakSettings.ts`, `server/routes/teamforce/employees.ts`, `server/routes/teamforce/leaveRequests.ts`, `server/routes/teamforce/payrollRuns.ts`, `server/routes/teamforce/taxDeclaration.ts`, `server/services/teamforce/payroll/attendanceLoader.ts`
- **Hooks:** pre(save) ×5, pre(findOneAndReplace) ×1, pre(findOneAndUpdate) ×1, pre(replaceOne) ×1, pre(update) ×1, pre(updateOne) ×1, pre(updateMany) ×1, pre(remove) ×1, post(save) ×3, post(init) ×1
- **Statics/methods:** `initializeTimestamps()`

| Field | Type | Ref | Flags |
|---|---|---|---|
| `userId` | ObjectId | `User` | required |
| `orgId` | ObjectId | `Organization` | required |
| `teamforceRole` | String |  | default "member", enum ["admin","member"] |
| `mobileNumber` | String |  |  |
| `pan` | String |  |  |
| `dateOfBirth` | Date |  |  |
| `permanentAddress` | String |  |  |
| `currentAddress` | String |  |  |
| `sameAsPermanent` | Boolean |  | default false |
| `dateOfJoining` | Date |  |  |
| `placeOfJoining` | String |  |  |
| `branchId` | ObjectId | `TeamforceBranch` |  |
| `departmentId` | ObjectId | `TeamforceDepartment` |  |
| `designation` | String |  |  |
| `employmentType` | String |  | enum ["full-time","part-time","con… |
| `state` | String |  |  |
| `cityType` | String |  | enum ["METRO","NON_METRO"] |
| `reportingManagerId` | ObjectId | `User` |  |
| `secondaryReviewerId` | ObjectId | `User` |  |
| `managesTeam` | Boolean |  | default false |
| `education` | [subdoc] |  |  |
| `workExperience` | [subdoc] |  |  |
| `salaryStructureId` | ObjectId | `TeamforceSalaryStructure` |  |
| `monthlyCtc` | Number |  | default 0 |
| `basicSalary` | Number |  | default 0 |
| `hra` | Number |  | default 0 |
| `transportAllowance` | Number |  | default 0 |
| `providentFund` | Number |  | default 0 |
| `professionalTax` | Number |  | default 0 |
| `variablePay` | Number |  | default 0 |
| `customAllowances` | [subdoc] |  |  |
| `customDeductions` | [subdoc] |  |  |
| `pfOption` | String |  | default "CEILING", enum ["CEILING","ACTUAL"] |
| `esiApplicable` | Boolean |  | default false |
| `tdsRegime` | String |  | enum ["new","old"] |
| `estimatedAnnualTds` | Number |  | default 0 |
| `autoCalculateTds` | Boolean |  | default false |
| `shiftId` | ObjectId | `TeamforceShift` |  |
| `weeklyOffPatternId` | ObjectId | `TeamforceWeeklyOffPattern` |  |
| `deferredLopDays` | Number |  | default 0 |
| `exitedAt` | Date |  | default null |
| `exitReason` | String |  | default "" |
| `offerLetterUrl` | String |  |  |
| `idProofUrl` | String |  |  |
| `educationCertificatesUrl` | String |  |  |
| `experienceLettersUrl` | String |  |  |
| `bankAccountHolderName` | String |  |  |
| `bankAccountType` | String |  | enum ["savings","current"] |
| `bankAccountNumber` | String |  |  |
| `bankIfscCode` | String |  |  |
| `_id` | ObjectId |  |  |
| `createdAt` | Date |  |  |
| `updatedAt` | Date |  |  |

**Indexes:** `{"userId":1,"orgId":1} {"unique":true,"background":true}`; `{"orgId":1} {"background":true}`

### TeamforceEmployeeTaxDeclaration

- **Collection:** `teamforceemployeetaxdeclarations` · **Area:** Core platform · **Source:** `server/models/teamforce/teamforceEmployeeTaxDeclaration.model.ts` (doc: `server/models/teamforce/teamforceEmployeeTaxDeclaration.model.ts.md`) · **Options:** timestamps=true, autoIndex=null, capped=false
- **Used by:** `server/routes/teamforce/payrollRuns.ts`, `server/routes/teamforce/taxDeclaration.ts`
- **Hooks:** pre(save) ×5, pre(findOneAndReplace) ×1, pre(findOneAndUpdate) ×1, pre(replaceOne) ×1, pre(update) ×1, pre(updateOne) ×1, pre(updateMany) ×1, pre(remove) ×1, post(save) ×3, post(init) ×1
- **Statics/methods:** `initializeTimestamps()`

| Field | Type | Ref | Flags |
|---|---|---|---|
| `userId` | ObjectId | `User` | required |
| `orgId` | ObjectId | `Organization` | required |
| `fy` | String |  | required |
| `regime` | String |  | default "NEW", enum ["OLD","NEW"] |
| `hraDeclaration` | Embedded |  | default fn default |
| `ltaClaimAmount` | Number |  | default 0 |
| `numChildren` | Number |  | default 0 |
| `declared80C` | Number |  | default 0 |
| `declaredNpsSelf` | Number |  | default 0 |
| `declared80DSelf` | Number |  | default 0 |
| `declared80DParent` | Number |  | default 0 |
| `parentSeniorCitizen` | Boolean |  | default false |
| `savingsInterest` | Number |  | default 0 |
| `fdInterest` | Number |  | default 0 |
| `declared80E` | Number |  | default 0 |
| `declared80EEA` | Number |  | default 0 |
| `declared80G` | Number |  | default 0 |
| `previousEmployer` | Embedded |  | default fn default |
| `locked` | Boolean |  | default false |
| `lockedAt` | Date |  | default null |
| `_id` | ObjectId |  |  |
| `createdAt` | Date |  |  |
| `updatedAt` | Date |  |  |

**Indexes:** `{"userId":1,"orgId":1,"fy":1} {"unique":true,"background":true}`

### TeamforceLeavePolicy

- **Collection:** `teamforceleavepolicies` · **Area:** Core platform · **Source:** `server/models/teamforce/teamforceLeavePolicy.model.ts` (doc: `server/models/teamforce/teamforceLeavePolicy.model.ts.md`) · **Options:** timestamps=true, autoIndex=null, capped=false
- **Used by:** `server/routes/teamforce/leavePolicies.ts`
- **Hooks:** pre(save) ×5, pre(findOneAndReplace) ×1, pre(findOneAndUpdate) ×1, pre(replaceOne) ×1, pre(update) ×1, pre(updateOne) ×1, pre(updateMany) ×1, pre(remove) ×1, post(save) ×3, post(init) ×1
- **Statics/methods:** `initializeTimestamps()`

| Field | Type | Ref | Flags |
|---|---|---|---|
| `orgId` | ObjectId | `Organization` | required, index |
| `name` | String |  | required |
| `leaveType` | String |  | required, enum ["Paid","Unpaid"] |
| `annualQuota` | Number |  | default 0 |
| `maxConsecutiveDays` | Number |  | default 0 |
| `applicableFor` | String |  | default "All Employees", enum ["All Employees","Full-Time O… |
| `allowCarryForward` | Boolean |  | default false |
| `allowEncashment` | Boolean |  | default false |
| `isActive` | Boolean |  | default true |
| `_id` | ObjectId |  |  |
| `createdAt` | Date |  |  |
| `updatedAt` | Date |  |  |

**Indexes:** `{"orgId":1} {"background":true}`; `{"orgId":1,"isActive":1,"name":1} {"background":true}`

### TeamforceLeaveRequest

- **Collection:** `teamforceleaverequests` · **Area:** Core platform · **Source:** `server/models/teamforce/teamforceLeaveRequest.model.ts` (doc: `server/models/teamforce/teamforceLeaveRequest.model.ts.md`) · **Options:** timestamps=true, autoIndex=null, capped=false
- **Used by:** `server/routes/betty.ts`, `server/routes/teamforce/leaveRequests.ts`, `server/services/teamforce/payroll/attendanceLoader.ts`
- **Hooks:** pre(save) ×5, pre(findOneAndReplace) ×1, pre(findOneAndUpdate) ×1, pre(replaceOne) ×1, pre(update) ×1, pre(updateOne) ×1, pre(updateMany) ×1, pre(remove) ×1, post(save) ×3, post(init) ×1
- **Statics/methods:** `initializeTimestamps()`

| Field | Type | Ref | Flags |
|---|---|---|---|
| `userId` | ObjectId | `User` | required, index |
| `orgId` | ObjectId | `Organization` | required, index |
| `leaveType` | String |  | required, enum ["Casual Leave","Sick Leave",… |
| `startDate` | Date |  | required |
| `endDate` | Date |  | required |
| `isHalfDay` | Boolean |  | default false |
| `reason` | String |  | required |
| `attachmentUrl` | String |  |  |
| `status` | String |  | index, default "Pending", enum ["Pending","Approved","Reject… |
| `approverUserId` | ObjectId | `User` |  |
| `approverName` | String |  |  |
| `decisionNote` | String |  |  |
| `decidedAt` | Date |  |  |
| `approverScope` | String |  | index, enum ["user","admin_or_founder","f… |
| `assignedApproverUserId` | ObjectId | `User` | index |
| `_id` | ObjectId |  |  |
| `createdAt` | Date |  |  |
| `updatedAt` | Date |  |  |

**Indexes:** `{"userId":1} {"background":true}`; `{"orgId":1} {"background":true}`; `{"status":1} {"background":true}`; `{"approverScope":1} {"background":true}`; `{"assignedApproverUserId":1} {"background":true}`; `{"orgId":1,"status":1,"createdAt":-1} {"background":true}`; `{"userId":1,"orgId":1,"createdAt":-1} {"background":true}`

### TeamforcePayrollConfig

- **Collection:** `teamforcepayrollconfigs` · **Area:** Core platform · **Source:** `server/models/teamforce/teamforcePayrollConfig.model.ts` (doc: `server/models/teamforce/teamforcePayrollConfig.model.ts.md`) · **Options:** timestamps=true, autoIndex=null, capped=false
- **Used by:** `server/routes/teamforce/payrollConfig.ts`, `server/routes/teamforce/payrollRuns.ts`
- **Hooks:** pre(save) ×5, pre(findOneAndReplace) ×1, pre(findOneAndUpdate) ×1, pre(replaceOne) ×1, pre(update) ×1, pre(updateOne) ×1, pre(updateMany) ×1, pre(remove) ×1, post(save) ×3, post(init) ×1
- **Statics/methods:** `initializeTimestamps()`

| Field | Type | Ref | Flags |
|---|---|---|---|
| `orgId` | ObjectId | `Organization` | required, unique |
| `attendanceCutoffDay` | Number |  | required, default 1 |
| `defaultState` | String |  | default "Karnataka" |
| `fyStartMonth` | Number |  | default 4 |
| `locked` | Boolean |  | default false |
| `lockedSince` | Date |  | default null |
| `_id` | ObjectId |  |  |
| `createdAt` | Date |  |  |
| `updatedAt` | Date |  |  |

**Indexes:** `{"orgId":1} {"unique":true,"background":true}`

### TeamforcePayrollRun

- **Collection:** `teamforcepayrollruns` · **Area:** Core platform · **Source:** `server/models/teamforce/teamforcePayrollRun.model.ts` (doc: `server/models/teamforce/teamforcePayrollRun.model.ts.md`) · **Options:** timestamps=true, autoIndex=null, capped=false
- **Referenced by:** `TeamforcePayrollTransaction`
- **Used by:** `server/routes/teamforce/payrollRuns.ts`
- **Hooks:** pre(save) ×5, pre(findOneAndReplace) ×1, pre(findOneAndUpdate) ×1, pre(replaceOne) ×1, pre(update) ×1, pre(updateOne) ×1, pre(updateMany) ×1, pre(remove) ×1, post(save) ×3, post(init) ×1
- **Statics/methods:** `initializeTimestamps()`

| Field | Type | Ref | Flags |
|---|---|---|---|
| `orgId` | ObjectId | `Organization` | required, index |
| `fyMonth` | Number |  | required |
| `fyYear` | Number |  | required |
| `calendarMonth` | Number |  | required |
| `calendarYear` | Number |  | required |
| `runType` | String |  | default "FULL", enum ["FULL","PARTIAL"] |
| `scope` | Embedded |  | default null |
| `includedUserIds` | [ObjectId] | `User` |  |
| `status` | String |  | index, default "DRAFT", enum ["DRAFT","APPROVED","PAID"] |
| `windowStart` | Date |  | required |
| `windowEnd` | Date |  | required |
| `cutoffDayUsed` | Number |  | required |
| `totals` | Embedded |  | default fn default |
| `createdBy` | ObjectId | `User` |  |
| `approvedBy` | ObjectId | `User` |  |
| `approvedAt` | Date |  | default null |
| `paidAt` | Date |  | default null |
| `notes` | String |  | default "" |
| `_id` | ObjectId |  |  |
| `createdAt` | Date |  |  |
| `updatedAt` | Date |  |  |

**Indexes:** `{"orgId":1} {"background":true}`; `{"status":1} {"background":true}`; `{"orgId":1,"fyYear":1,"fyMonth":1} {"unique":true,"background":true}`

### TeamforcePayrollTransaction

- **Collection:** `teamforcepayrolltransactions` · **Area:** Core platform · **Source:** `server/models/teamforce/teamforcePayrollTransaction.model.ts` (doc: `server/models/teamforce/teamforcePayrollTransaction.model.ts.md`) · **Options:** timestamps=true, autoIndex=null, capped=false
- **Used by:** `server/routes/teamforce/payrollRuns.ts`
- **Hooks:** pre(save) ×5, pre(findOneAndReplace) ×1, pre(findOneAndUpdate) ×1, pre(replaceOne) ×1, pre(update) ×1, pre(updateOne) ×1, pre(updateMany) ×1, pre(remove) ×1, post(save) ×3, post(init) ×1
- **Statics/methods:** `initializeTimestamps()`

| Field | Type | Ref | Flags |
|---|---|---|---|
| `runId` | ObjectId | `TeamforcePayrollRun` | required, index |
| `orgId` | ObjectId | `Organization` | required, index |
| `userId` | ObjectId | `User` | required, index |
| `salaryStructureId` | ObjectId | `TeamforceSalaryStructure` |  |
| `monthlyCtcAnchor` | Number |  | default 0 |
| `earnings` | [subdoc] |  | default [] |
| `deductions` | [subdoc] |  | default [] |
| `attendance` | Embedded |  | required |
| `regimeUsed` | String |  | required, enum ["OLD","NEW"] |
| `projectedAnnualGross` | Number |  | default 0 |
| `totalExemptions` | Number |  | default 0 |
| `standardDeduction` | Number |  | default 0 |
| `chapterVIA` | Embedded |  | default fn default |
| `netTaxableIncome` | Number |  | default 0 |
| `annualTaxLiability` | Number |  | default 0 |
| `monthlyTDS` | Number |  | default 0 |
| `overDeducted` | Boolean |  | default false |
| `pfEmployee` | Number |  | default 0 |
| `pfEmployer` | Number |  | default 0 |
| `esiEmployee` | Number |  | default 0 |
| `esiEmployer` | Number |  | default 0 |
| `professionalTax` | Number |  | default 0 |
| `grossSalary` | Number |  | default 0 |
| `joiningPartialPay` | Number |  | default 0 |
| `netPay` | Number |  | default 0 |
| `warnings` | [String] |  | default [] |
| `overrideNotes` | String |  | default "" |
| `overriddenBy` | ObjectId | `User` |  |
| `overriddenAt` | Date |  |  |
| `_id` | ObjectId |  |  |
| `createdAt` | Date |  |  |
| `updatedAt` | Date |  |  |

**Indexes:** `{"runId":1} {"background":true}`; `{"orgId":1} {"background":true}`; `{"userId":1} {"background":true}`; `{"runId":1,"userId":1} {"unique":true,"background":true}`

### TeamforcePTSlab

- **Collection:** `teamforceptslabs` · **Area:** Core platform · **Source:** `server/models/teamforce/teamforcePTSlab.model.ts` (doc: `server/models/teamforce/teamforcePTSlab.model.ts.md`) · **Options:** timestamps=true, autoIndex=null, capped=false
- **Used by:** `server/routes/teamforce/payrollRuns.ts`, `server/routes/teamforce/ptSlabs.ts`, `server/routes/teamforce/taxDeclaration.ts`
- **Hooks:** pre(save) ×5, pre(findOneAndReplace) ×1, pre(findOneAndUpdate) ×1, pre(replaceOne) ×1, pre(update) ×1, pre(updateOne) ×1, pre(updateMany) ×1, pre(remove) ×1, post(save) ×3, post(init) ×1
- **Statics/methods:** `initializeTimestamps()`

| Field | Type | Ref | Flags |
|---|---|---|---|
| `state` | String |  | required |
| `grossFrom` | Number |  | required, default 0 |
| `grossTo` | Number |  | default null |
| `monthlyPT` | Number |  | required, default 0 |
| `monthOverride` | Number |  | default null |
| `effectiveDate` | Date |  | required, default fn default |
| `isActive` | Boolean |  | default true |
| `_id` | ObjectId |  |  |
| `createdAt` | Date |  |  |
| `updatedAt` | Date |  |  |

**Indexes:** `{"state":1,"effectiveDate":-1} {"background":true}`

### TeamforceRecruitmentRequest

- **Collection:** `teamforcerecruitmentrequests` · **Area:** Core platform · **Source:** `server/models/teamforce/teamforceRecruitmentRequest.model.ts` (doc: `server/models/teamforce/teamforceRecruitmentRequest.model.ts.md`) · **Options:** timestamps=true, autoIndex=null, capped=false
- **Referenced by:** `TeamforceCandidate`
- **Used by:** `server/routes/teamforce/candidates.ts`, `server/routes/teamforce/recruitmentRequests.ts`
- **Hooks:** pre(save) ×5, pre(findOneAndReplace) ×1, pre(findOneAndUpdate) ×1, pre(replaceOne) ×1, pre(update) ×1, pre(updateOne) ×1, pre(updateMany) ×1, pre(remove) ×1, post(save) ×3, post(init) ×1
- **Statics/methods:** `initializeTimestamps()`

| Field | Type | Ref | Flags |
|---|---|---|---|
| `orgId` | ObjectId | `Organization` | required, index |
| `positionName` | String |  | required |
| `department` | String |  | required |
| `branch` | String |  | required |
| `reportingManager` | String |  | required |
| `employmentType` | String |  | default "Full-Time", enum ["Full-Time","Part-Time","Con… |
| `numberOfOpenings` | Number |  | required, default 1 |
| `experienceRequired` | String |  | required, enum ["0-2","2-5","5-8","8+"] |
| `jobLocation` | String |  | required |
| `expectedJoiningDate` | Date |  | required |
| `roleSummary` | String |  | default "" |
| `keyResponsibilities` | String |  | default "" |
| `requiredSkills` | String |  | default "" |
| `preferredSkills` | String |  | default "" |
| `approver` | String |  | default "" |
| `approvers` | [String] |  | default [] |
| `status` | String |  | index, default "draft", enum ["draft","approval_pending","… |
| `customFieldsDraft` | [subdoc] |  | default [] |
| `customFieldsPublished` | [subdoc] |  | default [] |
| `createdBy` | ObjectId | `User` | required |
| `isActive` | Boolean |  | default true |
| `_id` | ObjectId |  |  |
| `createdAt` | Date |  |  |
| `updatedAt` | Date |  |  |

**Indexes:** `{"orgId":1} {"background":true}`; `{"status":1} {"background":true}`; `{"orgId":1,"isActive":1,"createdAt":-1} {"background":true}`

### TeamforceSalaryStructure

- **Collection:** `teamforcesalarystructures` · **Area:** Core platform · **Source:** `server/models/teamforce/teamforceSalaryStructure.model.ts` (doc: `server/models/teamforce/teamforceSalaryStructure.model.ts.md`) · **Options:** timestamps=true, autoIndex=null, capped=false
- **Referenced by:** `TeamforceEmployeeProfile`, `TeamforcePayrollTransaction`
- **Used by:** `server/routes/teamforce/payrollRuns.ts`, `server/routes/teamforce/salaryStructures.ts`, `server/routes/teamforce/taxDeclaration.ts`
- **Hooks:** pre(save) ×5, pre(findOneAndReplace) ×1, pre(findOneAndUpdate) ×1, pre(replaceOne) ×1, pre(update) ×1, pre(updateOne) ×1, pre(updateMany) ×1, pre(remove) ×1, post(save) ×3, post(init) ×1
- **Statics/methods:** `initializeTimestamps()`

| Field | Type | Ref | Flags |
|---|---|---|---|
| `orgId` | ObjectId | `Organization` | required, index |
| `name` | String |  | required |
| `earnings` | [subdoc] |  | default [] |
| `deductions` | [subdoc] |  | default [] |
| `taxRegime` | String |  | default "new", enum ["old","new"] |
| `autoTds` | Boolean |  | default true |
| `estimatedAnnualTds` | Number |  | default 0 |
| `isActive` | Boolean |  | default true |
| `_id` | ObjectId |  |  |
| `createdAt` | Date |  |  |
| `updatedAt` | Date |  |  |

**Indexes:** `{"orgId":1} {"background":true}`; `{"orgId":1,"name":1} {"unique":true,"partialFilterExpression":{"isActive":true},"background":true}`

### TeamforceShift

- **Collection:** `teamforceshifts` · **Area:** Core platform · **Source:** `server/models/teamforce/teamforceShift.model.ts` (doc: `server/models/teamforce/teamforceShift.model.ts.md`) · **Options:** timestamps=true, autoIndex=null, capped=false
- **Referenced by:** `TeamforceEmployeeProfile`
- **Used by:** `server/routes/teamforce/shifts.ts`
- **Hooks:** pre(save) ×5, pre(findOneAndReplace) ×1, pre(findOneAndUpdate) ×1, pre(replaceOne) ×1, pre(update) ×1, pre(updateOne) ×1, pre(updateMany) ×1, pre(remove) ×1, post(save) ×3, post(init) ×1
- **Statics/methods:** `initializeTimestamps()`

| Field | Type | Ref | Flags |
|---|---|---|---|
| `orgId` | ObjectId | `Organization` | required |
| `name` | String |  | required |
| `startTime` | String |  | required |
| `endTime` | String |  | required |
| `workingHours` | Number |  | default 0 |
| `graceMinutes` | Number |  | default 0 |
| `breakMinutes` | Number |  | default 0 |
| `isActive` | Boolean |  | default true |
| `_id` | ObjectId |  |  |
| `createdAt` | Date |  |  |
| `updatedAt` | Date |  |  |

**Indexes:** `{"orgId":1} {"background":true}`

### TeamforceWeeklyOffPattern

- **Collection:** `teamforceweeklyoffpatterns` · **Area:** Core platform · **Source:** `server/models/teamforce/teamforceWeeklyOffPattern.model.ts` (doc: `server/models/teamforce/teamforceWeeklyOffPattern.model.ts.md`) · **Options:** timestamps=true, autoIndex=null, capped=false
- **Referenced by:** `TeamforceEmployeeProfile`
- **Used by:** `server/routes/teamforce/weeklyOffPatterns.ts`, `server/services/teamforce/payroll/attendanceLoader.ts`
- **Hooks:** pre(save) ×5, pre(findOneAndReplace) ×1, pre(findOneAndUpdate) ×1, pre(replaceOne) ×1, pre(update) ×1, pre(updateOne) ×1, pre(updateMany) ×1, pre(remove) ×1, post(save) ×3, post(init) ×1
- **Statics/methods:** `initializeTimestamps()`

| Field | Type | Ref | Flags |
|---|---|---|---|
| `orgId` | ObjectId | `Organization` | required |
| `name` | String |  | required |
| `patternType` | String |  | default "Fixed", enum ["Fixed","Rotating"] |
| `offDays` | [Number] |  | default [] |
| `isActive` | Boolean |  | default true |
| `_id` | ObjectId |  |  |
| `createdAt` | Date |  |  |
| `updatedAt` | Date |  |  |

**Indexes:** `{"orgId":1} {"background":true}`

### TerritoryWallet

- **Collection:** `territorywallets` · **Area:** Core platform · **Source:** `server/models/territoryWallet.model.ts` (doc: `server/models/territoryWallet.model.ts.md`) · **Options:** timestamps=true, autoIndex=null, capped=false
- **Referenced by:** `TerritoryWalletTransaction`
- **Used by:** `scripts/test-franchise-e2e.ts`, `server/routes/franchise.ts`, `server/routes/franchiseApi.ts`, `server/routes/territoryWallet.ts`, `server/services/franchiseProgramCommission.ts`, `server/services/territoryCommission.ts`, `server/services/territoryWalletTransfer.ts`
- **Hooks:** pre(save) ×5, pre(findOneAndReplace) ×1, pre(findOneAndUpdate) ×1, pre(replaceOne) ×1, pre(update) ×1, pre(updateOne) ×1, pre(updateMany) ×1, pre(remove) ×1, post(save) ×3, post(init) ×1
- **Statics/methods:** `initializeTimestamps()`

| Field | Type | Ref | Flags |
|---|---|---|---|
| `userId` | ObjectId | `User` | required, unique, index |
| `balance` | Number |  | required, default 0 |
| `currency` | String |  | default "USD" |
| `isActive` | Boolean |  | default true |
| `totalEarnings` | Number |  | default 0 |
| `totalWithdrawn` | Number |  | default 0 |
| `lastTransactionAt` | Date |  |  |
| `_id` | ObjectId |  |  |
| `createdAt` | Date |  |  |
| `updatedAt` | Date |  |  |

**Indexes:** `{"userId":1} {"unique":true,"background":true}`

### TerritoryWalletTransaction

- **Collection:** `territorywallettransactions` · **Area:** Core platform · **Source:** `server/models/territoryWalletTransaction.model.ts` (doc: `server/models/territoryWalletTransaction.model.ts.md`) · **Options:** timestamps=true, autoIndex=null, capped=false
- **Used by:** `server/routes/franchise.ts`, `server/routes/franchiseApi.ts`, `server/routes/franchiseProgram.ts`, `server/scripts/audit-partial-fanout.ts`, `server/scripts/find-coupon-ecommerce-overcredits.ts`, `server/services/franchiseProgramCommission.ts`, `server/services/territoryCommission.ts`, `server/services/territoryWalletTransfer.ts`
- **Hooks:** pre(save) ×5, pre(findOneAndReplace) ×1, pre(findOneAndUpdate) ×1, pre(replaceOne) ×1, pre(update) ×1, pre(updateOne) ×1, pre(updateMany) ×1, pre(remove) ×1, post(save) ×3, post(init) ×1
- **Statics/methods:** `initializeTimestamps()`

| Field | Type | Ref | Flags |
|---|---|---|---|
| `territoryWalletId` | ObjectId | `TerritoryWallet` | required, index |
| `userId` | ObjectId | `User` | required, index |
| `type` | String |  | required, index, enum ["credit","debit","withdrawal… |
| `amount` | Number |  | required |
| `currency` | String |  | default "USD" |
| `description` | String |  | required |
| `balanceBefore` | Number |  | required |
| `balanceAfter` | Number |  | required |
| `status` | String |  | index, default "completed", enum ["completed","pending","faile… |
| `source` | String |  | index, default "global", enum ["global","founder_program"] |
| `franchiseProgramId` | ObjectId | `FranchiseProgram` | index |
| `franchiseAssignmentId` | ObjectId | `FranchiseTerritoryAssignment` |  |
| `franchiseOfficeId` | ObjectId | `Organization` |  |
| `buyerUserId` | ObjectId | `User` |  |
| `entityType` | String |  | required, index, enum ["country","territory","subTe… |
| `entityId` | String |  | required, index |
| `entityName` | String |  |  |
| `originalSliceLevel` | String |  | required, enum ["country","territory","subTe… |
| `relatedSplitPercentage` | Number |  | required |
| `relatedCommissionDistributionId` | ObjectId | `CommissionDistribution` | index |
| `relatedPaymentId` | String |  |  |
| `relatedItemType` | String |  |  |
| `relatedItemId` | ObjectId |  |  |
| `relatedItemName` | String |  |  |
| `relatedSaleAmount` | Number |  |  |
| `relatedPlatformFeeAmount` | Number |  |  |
| `relatedPlatformFeePercentage` | Number |  |  |
| `relatedOrgId` | ObjectId | `Organization` |  |
| `metadata` | Mixed |  |  |
| `_id` | ObjectId |  |  |
| `createdAt` | Date |  |  |
| `updatedAt` | Date |  |  |

**Indexes:** `{"territoryWalletId":1} {"background":true}`; `{"userId":1} {"background":true}`; `{"type":1} {"background":true}`; `{"status":1} {"background":true}`; `{"source":1} {"background":true}`; `{"franchiseProgramId":1} {"background":true}`; `{"entityType":1} {"background":true}`; `{"entityId":1} {"background":true}`; `{"relatedCommissionDistributionId":1} {"background":true}`; `{"userId":1,"createdAt":-1} {"background":true}`; `{"entityType":1,"entityId":1,"createdAt":-1} {"background":true}`; `{"relatedOrgId":1,"createdAt":-1} {"background":true}`

### Testimonial

- **Collection:** `testimonials` · **Area:** Core platform · **Source:** `server/models/testimonial.model.ts` (doc: `server/models/testimonial.model.ts.md`) · **Options:** timestamps=true, autoIndex=null, capped=false
- **Used by:** `server/routes/contentEngagement.ts`, `server/routes/public.ts`, `server/routes/testimonials.ts`
- **Hooks:** pre(save) ×5, pre(findOneAndReplace) ×1, pre(findOneAndUpdate) ×1, pre(replaceOne) ×1, pre(update) ×1, pre(updateOne) ×1, pre(updateMany) ×1, pre(remove) ×1, post(save) ×3, post(init) ×1
- **Statics/methods:** `initializeTimestamps()`

| Field | Type | Ref | Flags |
|---|---|---|---|
| `organizationId` | ObjectId | `Organization` | required, index |
| `createdBy` | ObjectId | `User` | required |
| `clientName` | String |  | required |
| `clientLogo` | String |  |  |
| `clientWebsite` | String |  |  |
| `clientIndustry` | String |  |  |
| `title` | String |  | required |
| `slug` | String |  | required |
| `shortDescription` | String |  | required |
| `coverImage` | String |  |  |
| `featuredImage` | String |  |  |
| `categories` | [String] |  | default [] |
| `tags` | [String] |  | default [] |
| `contentBlocks` | [subdoc] |  | default [] |
| `primaryQuote` | String |  |  |
| `primaryQuoteAuthor` | String |  |  |
| `primaryQuoteAuthorRole` | String |  |  |
| `primaryQuoteAuthorImage` | String |  |  |
| `metrics` | [subdoc] |  | default [] |
| `artifactUrl` | String |  |  |
| `artifactLabel` | String |  |  |
| `isFeatured` | Boolean |  | default false |
| `displayOrder` | Number |  | default 0 |
| `status` | String |  | default "draft", enum ["draft","published","archive… |
| `isPublic` | Boolean |  | default false |
| `metaTitle` | String |  |  |
| `metaDescription` | String |  |  |
| `publishedAt` | Date |  |  |
| `_id` | ObjectId |  |  |
| `createdAt` | Date |  |  |
| `updatedAt` | Date |  |  |

**Indexes:** `{"organizationId":1} {"background":true}`; `{"organizationId":1,"slug":1} {"unique":true,"background":true}`; `{"organizationId":1,"status":1} {"background":true}`; `{"organizationId":1,"categories":1,"status":1} {"background":true}`; `{"organizationId":1,"isFeatured":1,"displayOrder":1} {"background":true}`; `{"organizationId":1,"isPublic":1,"status":1} {"background":true}`; `{"tags":1} {"background":true}`; `{"createdBy":1,"status":1} {"background":true}`

### ThirdPartyClient

- **Collection:** `thirdpartyclients` · **Area:** Core platform · **Source:** `server/models/thirdPartyClient.model.ts` (doc: `server/models/thirdPartyClient.model.ts.md`) · **Options:** timestamps=true, autoIndex=null, capped=false
- **Referenced by:** `Invoice`, `Organization`
- **Used by:** `scripts/mint-synthetic-combo.ts`, `server/middleware/platformKey.ts`, `server/middleware/thirdPartyAuth.ts`, `server/routes/adminCouponRules.ts`, `server/routes/garageAdminSavedCards.ts`, `server/routes/magicLink.ts`, `server/routes/platformOffices.ts`, `server/routes/publicRankBonus.ts`, … +25 more
- **Hooks:** pre(save) ×5, pre(findOneAndReplace) ×1, pre(findOneAndUpdate) ×1, pre(replaceOne) ×1, pre(update) ×1, pre(updateOne) ×1, pre(updateMany) ×1, pre(remove) ×1, post(save) ×3, post(init) ×1
- **Statics/methods:** `initializeTimestamps()`

| Field | Type | Ref | Flags |
|---|---|---|---|
| `name` | String |  | required, index |
| `apiKeyHash` | String |  | required, unique, index |
| `apiKeyPrefix` | String |  | required, index |
| `webhookUrl` | String |  |  |
| `webhookSecret` | String |  | required |
| `scopes` | [String] |  | default ["invoices:read","invoices:wr… |
| `isActive` | Boolean |  | index, default true |
| `isComboDefault` | Boolean |  | index, default false |
| `rateLimits` | Embedded |  | default fn default |
| `productConfig` | Embedded |  |  |
| `createdBy` | ObjectId | `User` |  |
| `lastUsedAt` | Date |  |  |
| `_id` | ObjectId |  |  |
| `createdAt` | Date |  |  |
| `updatedAt` | Date |  |  |

**Indexes:** `{"name":1} {"background":true}`; `{"apiKeyHash":1} {"unique":true,"background":true}`; `{"apiKeyPrefix":1} {"background":true}`; `{"isActive":1} {"background":true}`; `{"isComboDefault":1} {"background":true}`; `{"apiKeyPrefix":1,"isActive":1} {"background":true}`

### Ticket

- **Collection:** `tickets_garage` · **Area:** Core platform · **Source:** `server/models/ticket.model.ts` (doc: `server/models/ticket.model.ts.md`) · **Options:** timestamps=true, autoIndex=null, capped=false
- **Used by:** `server/routes/garageAdminSupportChats.ts`, `server/routes/garageAdminTickets.ts`, `server/routes/tickets.ts`, `server/scripts/migrate-support-tickets.ts`, `server/services/supportChatTaskroom.ts`, `server/services/supportTicketAuto.ts`, `server/services/supportTicketSuggest.ts`, `server/services/supportTicketTaskroom.ts`, … +2 more
- **Hooks:** pre(save) ×6, pre(findOneAndReplace) ×1, pre(findOneAndUpdate) ×1, pre(replaceOne) ×1, pre(update) ×1, pre(updateOne) ×1, pre(updateMany) ×1, pre(remove) ×1, post(save) ×4, post(init) ×1
- **Statics/methods:** `initializeTimestamps()`

| Field | Type | Ref | Flags |
|---|---|---|---|
| `userId` | ObjectId |  | index, default null |
| `userEmail` | String |  | required, index |
| `userName` | String |  | required |
| `orgId` | ObjectId |  | index, default null |
| `isGuest` | Boolean |  | index, default false |
| `title` | String |  | required |
| `description` | String |  | required |
| `status` | String |  | index, default "open", enum ["open","in_progress","resolv… |
| `priority` | String |  | default "medium", enum ["low","medium","high","urgen… |
| `category` | String |  |  |
| `source` | String |  | enum ["chat","manual"] |
| `groupId` | ObjectId | `Group` | index, default null |
| `sourceMessageId` | ObjectId | `GroupMessage` | default null |
| `aiGenerated` | Boolean |  | default false |
| `assignedToId` | ObjectId | `GarageAdmin` | index, default null |
| `assignedToName` | String |  | default null |
| `assignedToEmail` | String |  | default null |
| `assignedBy` | String |  | default null, enum ["ai","admin"] |
| `assignedAt` | Date |  | default null |
| `assignReason` | String |  | default null |
| `taskroomTaskId` | String |  | default null |
| `taskroomRoomId` | String |  | default null |
| `attachments` | [subdoc] |  | default [] |
| `messages` | [subdoc] |  | default [] |
| `lastActivityAt` | Date |  | index, default fn default |
| `hasUnreadForUser` | Boolean |  | default false |
| `hasUnreadForAdmin` | Boolean |  | default true |
| `_id` | ObjectId |  |  |
| `createdAt` | Date |  |  |
| `updatedAt` | Date |  |  |

**Indexes:** `{"userId":1} {"background":true}`; `{"userEmail":1} {"background":true}`; `{"orgId":1} {"background":true}`; `{"isGuest":1} {"background":true}`; `{"status":1} {"background":true}`; `{"groupId":1} {"background":true}`; `{"assignedToId":1} {"background":true}`; `{"lastActivityAt":1} {"background":true}`; `{"status":1,"lastActivityAt":-1} {"background":true}`; `{"userId":1,"lastActivityAt":-1} {"background":true}`

### TimeTracking

- **Collection:** `timetrackings` · **Area:** Core platform · **Source:** `server/models/timeTracking.model.ts` (doc: `server/models/timeTracking.model.ts.md`) · **Options:** timestamps=true, autoIndex=null, capped=false
- **Referenced by:** `TeamforceBreakLog`
- **Used by:** `server/routes/betty.ts`, `server/routes/public.ts`, `server/scripts/teamforce-backfill-clock.ts`, `server/services/teamforce/payroll/attendanceLoader.ts`
- **Hooks:** pre(save) ×5, pre(findOneAndReplace) ×1, pre(findOneAndUpdate) ×1, pre(replaceOne) ×1, pre(update) ×1, pre(updateOne) ×1, pre(updateMany) ×1, pre(remove) ×1, post(save) ×3, post(init) ×1
- **Statics/methods:** `initializeTimestamps()`

| Field | Type | Ref | Flags |
|---|---|---|---|
| `userId` | ObjectId | `User` | required, index |
| `orgId` | ObjectId | `Organization` | required, index |
| `clockInTime` | Date |  | required |
| `clockOutTime` | Date |  |  |
| `durationInSeconds` | Number |  |  |
| `_id` | ObjectId |  |  |
| `createdAt` | Date |  |  |
| `updatedAt` | Date |  |  |

**Indexes:** `{"userId":1} {"background":true}`; `{"orgId":1} {"background":true}`; `{"userId":1,"orgId":1} {"background":true}`

### Todo

- **Collection:** `todos` · **Area:** Core platform · **Source:** `server/models/todo.model.ts` (doc: `server/models/todo.model.ts.md`) · **Options:** timestamps=true, autoIndex=null, capped=false
- **Used by:** `server/routes/todos.ts`, `server/services/memberCleanup.service.ts`
- **Hooks:** pre(save) ×5, pre(findOneAndReplace) ×1, pre(findOneAndUpdate) ×1, pre(replaceOne) ×1, pre(update) ×1, pre(updateOne) ×1, pre(updateMany) ×1, pre(remove) ×1, post(save) ×3, post(init) ×1
- **Statics/methods:** `initializeTimestamps()`

| Field | Type | Ref | Flags |
|---|---|---|---|
| `orgId` | ObjectId | `Organization` | required, index |
| `userId` | ObjectId | `User` | required, index |
| `task` | String |  | required |
| `createdBy` | ObjectId | `User` | required, index |
| `isPersonal` | Boolean |  | index, default true |
| `_id` | ObjectId |  |  |
| `createdAt` | Date |  |  |
| `updatedAt` | Date |  |  |

**Indexes:** `{"orgId":1} {"background":true}`; `{"userId":1} {"background":true}`; `{"createdBy":1} {"background":true}`; `{"isPersonal":1} {"background":true}`; `{"orgId":1,"userId":1} {"background":true}`

### UnilevelPlusDistribution

- **Collection:** `unilevelplusdistributions` · **Area:** Core platform · **Source:** `server/models/unilevelPlusDistribution.model.ts` (doc: `server/models/unilevelPlusDistribution.model.ts.md`) · **Options:** timestamps=true, autoIndex=null, capped=false
- **Referenced by:** `ReserveLicense`
- **Used by:** `server/routes/unilevel-plus.ts`, `server/scripts/audit-cryptobrand-bootstrap.ts`, `server/scripts/move-unilevel-commission.ts`, `server/scripts/reset-wallets.ts`, `server/scripts/retro-migrate-cascade-to-up.ts`, `server/scripts/retro-up-single-to-six-units.ts`, `server/scripts/verify-split-stats.ts`, `server/services/affiliateTransactionDetail.ts`, … +4 more
- **Hooks:** pre(save) ×5, pre(findOneAndReplace) ×1, pre(findOneAndUpdate) ×1, pre(replaceOne) ×1, pre(update) ×1, pre(updateOne) ×1, pre(updateMany) ×1, pre(remove) ×1, post(save) ×3, post(init) ×1
- **Statics/methods:** `initializeTimestamps()`

| Field | Type | Ref | Flags |
|---|---|---|---|
| `planId` | ObjectId | `UnilevelPlusPlan` | required, index |
| `buyerId` | ObjectId | `User` | required, index |
| `saleAmount` | Number |  | required |
| `currency` | String |  | default "USD" |
| `paymentId` | String |  | index |
| `companyAmount` | Number |  | required |
| `directBonusAmount` | Number |  | required |
| `directBonusRecipientId` | ObjectId | `User` |  |
| `directBonusCreditedAmount` | Number |  |  |
| `directBonusForfeitedAmount` | Number |  |  |
| `directBonusForfeitedToUserId` | ObjectId | `User` |  |
| `levelBonusBudget` | Number |  | required |
| `levelBonusDistributed` | Number |  | required, default 0 |
| `levelBonusRecipients` | [subdoc] |  | default [] |
| `infinityTier1Amount` | Number |  | required, default 0 |
| `infinityTier1Recipients` | [subdoc] |  | default [] |
| `infinityTier1Distributed` | Number |  | default 0 |
| `infinityTier2Amount` | Number |  | required, default 0 |
| `infinityTier2Recipients` | [subdoc] |  | default [] |
| `infinityTier2Distributed` | Number |  | default 0 |
| `managerBonusAmount` | Number |  | required, default 0 |
| `unallocatedAmount` | Number |  | required, default 0 |
| `status` | String |  | index, default "pending", enum ["pending","completed","faile… |
| `failureReason` | String |  |  |
| `metadata` | Mixed |  |  |
| `_id` | ObjectId |  |  |
| `createdAt` | Date |  |  |
| `updatedAt` | Date |  |  |

**Indexes:** `{"planId":1} {"background":true}`; `{"buyerId":1} {"background":true}`; `{"paymentId":1} {"background":true}`; `{"status":1} {"background":true}`; `{"buyerId":1,"createdAt":-1} {"background":true}`; `{"directBonusRecipientId":1,"createdAt":-1} {"background":true}`; `{"levelBonusRecipients.userId":1,"createdAt":-1} {"background":true}`; `{"planId":1,"status":1} {"background":true}`; `{"infinityTier1Recipients.userId":1,"createdAt":-1} {"background":true}`; `{"infinityTier2Recipients.userId":1,"createdAt":-1} {"background":true}`; `{"paymentId":1} {"unique":true,"sparse":true,"background":true}`

### UnilevelPlusPlan

- **Collection:** `unilevelplusplans` · **Area:** Core platform · **Source:** `server/models/unilevelPlusPlan.model.ts` (doc: `server/models/unilevelPlusPlan.model.ts.md`) · **Options:** timestamps=true, autoIndex=null, capped=false
- **Referenced by:** `ReserveLicense`, `UnilevelPlusDistribution`, `UnilevelPlusPurchase`
- **Used by:** `server/bat246/scripts/test-create-up-purchase-boifeyaddequeu.ts`, `server/routes/adminCouponRules.ts`, `server/routes/garageAdminSavedCards.ts`, `server/scripts/check-up-plan.ts`, `server/scripts/retro-migrate-cascade-to-up.ts`, `server/scripts/retro-up-single-to-six-units.ts`, `server/scripts/setup-test-account.ts`, `server/services/adminPlatformBilling.ts`, … +9 more
- **Hooks:** pre(save) ×6, pre(findOneAndReplace) ×1, pre(findOneAndUpdate) ×1, pre(replaceOne) ×1, pre(update) ×1, pre(updateOne) ×1, pre(updateMany) ×1, pre(remove) ×1, post(save) ×3, post(init) ×1
- **Statics/methods:** `initializeTimestamps()`

| Field | Type | Ref | Flags |
|---|---|---|---|
| `name` | String |  | required |
| `description` | String |  |  |
| `productPrice` | Number |  | required |
| `currency` | String |  | required, default "USD" |
| `gstInclusive` | Boolean |  | default true |
| `companyPercentage` | Number |  | required |
| `directBonusPercentage` | Number |  | required |
| `levelBonusPercentage` | Number |  | required |
| `infinityTier1Percentage` | Number |  | required, default 0 |
| `infinityTier2Percentage` | Number |  | required, default 0 |
| `managerBonusPercentage` | Number |  | required, default 0 |
| `maxLevels` | Number |  | required, default 15 |
| `pointValue` | Number |  | required, default 0.03 |
| `legMultipliers` | [Number] |  | required, default [1,2,3] |
| `infinityTier1Enabled` | Boolean |  | default false |
| `infinityTier2Enabled` | Boolean |  | default false |
| `managerBonusEnabled` | Boolean |  | default false |
| `orgId` | ObjectId | `Organization` | index |
| `createdBy` | ObjectId | `User` |  |
| `isActive` | Boolean |  | index, default true |
| `_id` | ObjectId |  |  |
| `createdAt` | Date |  |  |
| `updatedAt` | Date |  |  |

**Indexes:** `{"orgId":1} {"background":true}`; `{"isActive":1} {"background":true}`; `{"isActive":1} {"unique":true,"partialFilterExpression":{"isActive":true},"background":true}`

### UnilevelPlusPurchase

- **Collection:** `unilevelpluspurchases` · **Area:** Core platform · **Source:** `server/models/unilevelPlusPurchase.model.ts` (doc: `server/models/unilevelPlusPurchase.model.ts.md`) · **Options:** timestamps=true, autoIndex=null, capped=false
- **Referenced by:** `ReserveLicense`
- **Used by:** `scripts/mint-synthetic-combo.ts`, `server/bat246/scripts/revert-test-garage-affiliate-boifeyaddequeu.ts`, `server/bat246/scripts/test-create-up-purchase-boifeyaddequeu.ts`, `server/controllers/garageAdmin.controller.ts`, `server/routes/affiliate.ts`, `server/routes/downlineTable.ts`, `server/routes/franchiseApi.ts`, `server/routes/garageAdminOneTimeAffiliates.ts`, … +17 more
- **Hooks:** pre(save) ×6, pre(findOneAndReplace) ×1, pre(findOneAndUpdate) ×1, pre(replaceOne) ×1, pre(update) ×1, pre(updateOne) ×1, pre(updateMany) ×1, pre(remove) ×1, post(save) ×4, post(init) ×1
- **Statics/methods:** `initializeTimestamps()`

| Field | Type | Ref | Flags |
|---|---|---|---|
| `userId` | ObjectId | `User` | required, unique |
| `planId` | ObjectId | `UnilevelPlusPlan` | required |
| `paymentId` | String |  | required, unique |
| `amount` | Number |  | required |
| `currency` | String |  | default "USD" |
| `status` | String |  | index, default "active", enum ["active","expired","refunded… |
| `purchasedAt` | Date |  | default fn now |
| `metadata` | Mixed |  |  |
| `_id` | ObjectId |  |  |
| `createdAt` | Date |  |  |
| `updatedAt` | Date |  |  |

**Indexes:** `{"userId":1} {"unique":true,"background":true}`; `{"paymentId":1} {"unique":true,"background":true}`; `{"status":1} {"background":true}`; `{"userId":1,"status":1} {"background":true}`; `{"planId":1,"createdAt":-1} {"background":true}`

### User

- **Collection:** `users` · **Area:** Core platform · **Source:** `server/models/user.model.ts` (doc: `server/models/user.model.ts.md`) · **Options:** timestamps=true, autoIndex=null, capped=false
- **Referenced by:** `AffiliateClick`, `AffiliateConversion`, `AffiliateLink`, `AffiliateWallet`, `AppSubscription`, `Approval`, `Auction`, `AuctionEscrow`, `AuctionSettlement`, `AuctionWallet`, `AuctionWalletTransaction`, `Availability`, `BankDetails`, `Bat246CardPermission`, `BondHolding`, `BondInstrument`, `BondLedgerEntry`, `BondPayoutEvent`, `Booking`, `CallBooking`, `CallOffering`, `CallPurchase`, `CampaignWallet`, `CampaignWalletTransaction`, `CashbackCode`, `CashbackDistribution`, `Channel`, `ChannelMembership`, `ChannelMembershipEvent`, `ChatBlock`, `ChatClear`, `ChatDraft`, `ChatMute`, `ChatPin`, `ChatStar`, `CollaborativeDocument`, `CombPlan`, `CommissionDistribution`, `ConferenceRoom`, `ContentCampaign`, `ContentEngagement`, `ContentPayout`, `ContentRewardsWallet`, `ContentRewardsWalletTransaction`, `ContentSubmission`, `ConversationState`, `CouponAssignment`, `CouponRule`, `CouponRuleProgress`, `CouponUsage`, `Course`, `CourseEnrollment`, `CoworkingSpaceBooking`, `CryptoTopupTransaction`, `CryptosubBonusPayout`, `Deal`, `DealComment`, `DealReaction`, `DeviceToken`, `DmSettings`, `Drop`, `Email`, `Event`, `EventProgram`, `EventRegistration`, `FCMToken`, `FeedActivityRead`, `File`, `FloorCabinet`, `FloorFile`, `FounderSubBonusPayout`, `FranchiseGlobalAssignment`, `FranchiseGlobalOffer`, `FranchiseOffer`, `FranchiseProgram`, `FranchiseReassignment`, `FranchiseTerritoryAssignment`, `GarageUniversityOnboarding`, `GenealogySnapshot`, `GlobalMessage`, `Group`, `GroupAiTask`, `GroupMessage`, `IgniteCall`, `Invoice`, `ItemReserveLicense`, `JobActivity`, `JobAlert`, `JobApplication`, `JobEvent`, `JobInterview`, `JobOffer`, `JobPosting`, `JobReward`, `JoinRequest`, `LeaveRequest`, `MagicLink`, `Message`, `MissedCall`, `NcSubscription`, `NcWallet`, `Notification`, `OfficeAddonPayment`, `OfficeAddonSubscription`, `OfficeSubscription`, `OfficeSubscriptionPayment`, `OfficeUpgradeHistory`, `OpenClawAgent`, `OpenClawMessage`, `OrgConversionFee`, `OrgRewardsWallet`, `Organization`, `OrganizationCabinet`, `OrganizationFile`, `PendingCouponGift`, `PendingInvite`, `PendingReserveAssignment`, `PermissionGrant`, `PhoneVerificationEvent`, `PlatformCouponRedemption`, `Playlist`, `PollVote`, `Post`, `PostBookmark`, `PostComment`, `PostCommentLike`, `PostLike`, `PostRepost`, `Product`, `ProductOrder`, `RankQualification`, `ReferralBonusPayout`, `ReserveLicense`, `Review`, `ReviewVote`, `RoomBooking`, `SavedJob`, `Service`, `ServiceMilestoneMessage`, `ServiceOpt`, `ServiceReview`, `Settings`, `ShareableLink`, `SharedAccessLog`, `SharedItem`, `SocialAccount`, `StandaloneVideo`, `StoreCouponCommission`, `StoreCouponCommissionFire`, `StoreWallet`, `Subscription`, `SubscriptionPayment`, `SubscriptionPlan`, `SupportTaskAssignment`, `SupportTicket`, `SupportTicketBoard`, `Task`, `TeamforceBreakLog`, `TeamforceDepartment`, `TeamforceEmployeeProfile`, `TeamforceEmployeeTaxDeclaration`, `TeamforceLeaveRequest`, `TeamforcePayrollRun`, `TeamforcePayrollTransaction`, `TeamforceRecruitmentRequest`, `TerritoryWallet`, `TerritoryWalletTransaction`, `Testimonial`, `ThirdPartyClient`, `TimeTracking`, `Todo`, `UnilevelPlusDistribution`, `UnilevelPlusPlan`, `UnilevelPlusPurchase`, `User`, `UserActivity`, `UserCabinet`, `UserCryptoAddress`, `UserFile`, `UserNotification`, `UserProductLink`, `Vacancy`, `VoIPToken`, `WalletAccount`, `WalletTransaction`, `WebinarAttendance`, `WhitelabelBonusPayout`, `Withdrawal`, `WithdrawalPreference`, `Workshop`, `WorkshopRegistration`, `WorkshopSessionOverride`, `bat246B2CoinProductPurchases`, `bat246B2CoinTransactions`, `bat246B2CoinWallets`, `bat246BoardInvites`, `bat246Distributors`, `bat246LayawayRequests`, `bat246LostMoneyClaims`, `bat246LostMoneyPaid`, `bat246OfficeInvites`, `bat246PendingPlacements`, `bat246PlacementNotifications`, `bat246Players`, `bat246PodInvites`, `bat246PositionReservations`, `bat246SnapBackLoanRepayments`, `bat246SnapBackLoanRequests`, `bat246SnapBackLoans`
- **Used by:** `scripts/inspect-push-tokens.ts`, `scripts/mint-synthetic-combo.ts`, `scripts/test-commission-push.ts`, `scripts/test-franchise-e2e.ts`, `scripts/test-knock-push.ts`, `scripts/test-transfer-push.ts`, `server/bat246/__tests__/bat246.controller.test.ts`, `server/bat246/__tests__/bat246Admin.service.test.ts`, … +321 more
- **Hooks:** pre(save) ×6, pre(findOneAndReplace) ×1, pre(findOneAndUpdate) ×1, pre(replaceOne) ×1, pre(update) ×1, pre(updateOne) ×1, pre(updateMany) ×1, pre(remove) ×1, post(save) ×5, post(findOneAndUpdate) ×1, post(init) ×1
- **Statics/methods:** `initializeTimestamps()`

| Field | Type | Ref | Flags |
|---|---|---|---|
| `email` | String |  |  |
| `name` | String |  |  |
| `organization` | ObjectId | `Organization` |  |
| `role` | String |  | default "user", enum ["admin","user","founder","st… |
| `organizations` | [subdoc] |  |  |
| `isVerified` | Boolean |  | default false |
| `department` | String |  |  |
| `country` | String |  |  |
| `state` | String |  |  |
| `city` | String |  |  |
| `postalCode` | String |  |  |
| `phone` | String |  |  |
| `phoneVerified` | Boolean |  | default false |
| `latitude` | Number |  |  |
| `longitude` | Number |  |  |
| `level2Field1` | String |  |  |
| `level2Field2` | String |  |  |
| `profileComplete` | Boolean |  | default false |
| `profileCompletedAt` | Date |  | default fn now |
| `offerExpiresAtOverride` | Date |  |  |
| `offerExtendedAt` | Date |  |  |
| `offerExtendedByAdminId` | ObjectId | `GarageAdmin` |  |
| `offerExtendedByUserId` | ObjectId | `User` |  |
| `paymentProfile.stripe.customerId` | String |  | default null |
| `paymentProfile.stripe.methods` | [subdoc] |  |  |
| `paymentProfile.razorpay.customerId` | String |  | default null |
| `paymentProfile.razorpay.tokens` | [subdoc] |  |  |
| `paymentProfile.removedInstruments` | [subdoc] |  |  |
| `profilePicture` | String |  |  |
| `designation` | String |  |  |
| `isFirstTimeUser` | Boolean |  | default false |
| `affiliateId` | String |  | unique, sparse |
| `referredBy` | ObjectId | `User` |  |
| `referredBySource` | String |  | enum ["affiliate","founder_default… |
| `ancestors` | [ObjectId] | `User` | default [] |
| `depth` | Number |  | default 0 |
| `legNumber` | Number |  | default null |
| `directsCount` | Number |  | default 0 |
| `downlineCount` | Number |  | default 0 |
| `typeFlags.oneNetworkActivated` | Boolean |  | default false |
| `typeFlags.networkChainsSub` | Boolean |  | default false |
| `typeFlags.founderSub` | Boolean |  | default false |
| `rank1` | String |  | default null |
| `rank2` | String |  | default null |
| `ncRank.current` | String |  | default null |
| `ncRank.periodKey` | String |  | default null |
| `ncRank.updatedAt` | Date |  | default null |
| `assignedSupportAgentId` | ObjectId | `GarageAdmin` | index |
| `assignedSupportAgentAt` | Date |  |  |
| `assignedSupportAgentBy` | ObjectId | `GarageAdmin` |  |
| `nvcChatCreatedAt` | Date |  |  |
| `nvcChatCreatedBy` | ObjectId | `GarageAdmin` |  |
| `guest` | Boolean |  | default false |
| `openclawAgents` | [subdoc] |  |  |
| `mailboxes` | [subdoc] |  |  |
| `lastSeenAt` | Date |  |  |
| `_id` | ObjectId |  |  |
| `createdAt` | Date |  |  |
| `updatedAt` | Date |  |  |

**Indexes:** `{"affiliateId":1} {"unique":true,"sparse":true,"background":true}`; `{"assignedSupportAgentId":1} {"sparse":true,"background":true}`; `{"email":1} {"unique":true,"partialFilterExpression":{"email":{"$type":"string"}},"background":true}`; `{"phone":1} {"unique":true,"partialFilterExpression":{"phone":{"$type":"string"}},"background":true}`; `{"organizations.organization":1} {"background":true}`; `{"affiliateId":1} {"background":true}`; `{"referredBy":1} {"background":true}`; `{"ancestors":1} {"background":true}`; `{"ancestors":1,"depth":1} {"background":true}`; `{"openclawAgents.orgId":1} {"background":true}`; `{"lastSeenAt":-1} {"background":true}`

### UserActivity

- **Collection:** `useractivities` · **Area:** Core platform · **Source:** `server/models/userActivity.model.ts` (doc: `server/models/userActivity.model.ts.md`) · **Options:** timestamps=true, autoIndex=null, capped=false
- **Used by:** `server/realtime/socket.ts`, `server/routes/betty.ts`, `server/routes/userActivity.ts`, `server/services/memberCleanup.service.ts`
- **Hooks:** pre(save) ×5, pre(findOneAndReplace) ×1, pre(findOneAndUpdate) ×1, pre(replaceOne) ×1, pre(update) ×1, pre(updateOne) ×1, pre(updateMany) ×1, pre(remove) ×1, post(save) ×3, post(init) ×1
- **Statics/methods:** `initializeTimestamps()`

| Field | Type | Ref | Flags |
|---|---|---|---|
| `userId` | ObjectId | `User` | required, index |
| `orgId` | ObjectId | `Organization` | required, index |
| `type` | String |  | required, index, enum ["login","logout","online","o… |
| `title` | String |  | required |
| `description` | String |  | required |
| `metadata` | Mixed |  | default fn  |
| `isRead` | Boolean |  | index, default false |
| `readAt` | Date |  |  |
| `category` | String |  | required, index, enum ["auth","task","booking","com… |
| `priority` | String |  | index, default "medium", enum ["low","medium","high"] |
| `_id` | ObjectId |  |  |
| `createdAt` | Date |  |  |
| `updatedAt` | Date |  |  |

**Indexes:** `{"userId":1} {"background":true}`; `{"orgId":1} {"background":true}`; `{"type":1} {"background":true}`; `{"isRead":1} {"background":true}`; `{"category":1} {"background":true}`; `{"priority":1} {"background":true}`; `{"userId":1,"orgId":1,"createdAt":-1} {"background":true}`; `{"userId":1,"isRead":1} {"background":true}`; `{"orgId":1,"type":1,"createdAt":-1} {"background":true}`; `{"userId":1,"category":1,"createdAt":-1} {"background":true}`

### UserCabinet

- **Collection:** `usercabinets` · **Area:** Core platform · **Source:** `server/models/cabinet.model.ts` (doc: `server/models/cabinet.model.ts.md`) · **Options:** timestamps=true, autoIndex=null, capped=false
- **Referenced by:** `UserCabinet`, `UserFile`
- **Used by:** `server/controllers/cabinet.controller.ts`, `server/controllers/collaborativeDocument.controller.ts`, `server/controllers/shareableLink.controller.ts`, `server/routes/dailyWebhook.ts`, `server/routes/evergreen.ts`, `server/routes/learnInit.ts`, `server/routes/livekitRecording.ts`, `server/routes/public.ts`, … +6 more
- **Hooks:** pre(save) ×5, pre(findOneAndReplace) ×1, pre(findOneAndUpdate) ×1, pre(replaceOne) ×1, pre(update) ×1, pre(updateOne) ×1, pre(updateMany) ×1, pre(remove) ×1, post(save) ×3, post(init) ×1
- **Statics/methods:** `initializeTimestamps()`

| Field | Type | Ref | Flags |
|---|---|---|---|
| `name` | String |  | required |
| `description` | String |  |  |
| `owner` | ObjectId | `User` | required |
| `organization` | ObjectId | `Organization` | required |
| `parentCabinet` | ObjectId | `UserCabinet` | default null |
| `path` | String |  | required |
| `isRoot` | Boolean |  | default false |
| `isDefault` | Boolean |  | default false |
| `permissions` | Mixed |  | default fn  |
| `metadata` | Mixed |  | default fn  |
| `_id` | ObjectId |  |  |
| `createdAt` | Date |  |  |
| `updatedAt` | Date |  |  |

**Indexes:** `{"owner":1,"organization":1} {"background":true}`; `{"path":1,"owner":1} {"background":true}`; `{"parentCabinet":1} {"background":true}`; `{"isDefault":1,"owner":1,"organization":1} {"background":true}`; `{"owner":1,"organization":1,"isDefault":1} {"unique":true,"partialFilterExpression":{"isDefault":true},"background":true}`

### UserCryptoAddress

- **Collection:** `usercryptoaddresses` · **Area:** Core platform · **Source:** `server/models/userCryptoAddress.model.ts` (doc: `server/models/userCryptoAddress.model.ts.md`) · **Options:** timestamps=true, autoIndex=null, capped=false
- **Used by:** `server/routes/wallet.ts`, `server/services/userCryptoAddress.ts`
- **Hooks:** pre(save) ×5, pre(findOneAndReplace) ×1, pre(findOneAndUpdate) ×1, pre(replaceOne) ×1, pre(update) ×1, pre(updateOne) ×1, pre(updateMany) ×1, pre(remove) ×1, post(save) ×3, post(init) ×1
- **Statics/methods:** `initializeTimestamps()`

| Field | Type | Ref | Flags |
|---|---|---|---|
| `userId` | ObjectId | `User` | required, index |
| `orgId` | ObjectId | `Organization` | required, index |
| `currency` | String |  | required, enum ["BTC","ETH","USDT"] |
| `chain` | String |  | required, enum ["bitcoin","ethereum","polygo… |
| `coin` | String |  | required, enum ["BTC","ETH","USDT"] |
| `address` | String |  | required |
| `hdIndex` | Number |  | required |
| `derivationPath` | String |  | required |
| `isActive` | Boolean |  | index, default true |
| `activePollUntil` | Date |  | index, default null |
| `_id` | ObjectId |  |  |
| `createdAt` | Date |  |  |
| `updatedAt` | Date |  |  |

**Indexes:** `{"userId":1} {"background":true}`; `{"orgId":1} {"background":true}`; `{"isActive":1} {"background":true}`; `{"activePollUntil":1} {"background":true}`; `{"userId":1,"orgId":1,"currency":1,"chain":1} {"unique":true,"background":true}`; `{"address":1,"chain":1} {"unique":true,"background":true}`

### UserFile

- **Collection:** `userfiles` · **Area:** Core platform · **Source:** `server/models/cabinet.model.ts` (doc: `server/models/cabinet.model.ts.md`) · **Options:** timestamps=true, autoIndex=null, capped=false
- **Referenced by:** `UserFile`
- **Used by:** `server/controllers/cabinet.controller.ts`, `server/controllers/collaborativeDocument.controller.ts`, `server/controllers/shareableLink.controller.ts`, `server/routes/dailyWebhook.ts`, `server/routes/evergreen.ts`, `server/routes/learnInit.ts`, `server/routes/livekitRecording.ts`, `server/routes/public.ts`, … +6 more
- **Hooks:** pre(save) ×5, pre(findOneAndReplace) ×1, pre(findOneAndUpdate) ×1, pre(replaceOne) ×1, pre(update) ×1, pre(updateOne) ×1, pre(updateMany) ×1, pre(remove) ×1, post(save) ×3, post(init) ×1
- **Statics/methods:** `initializeTimestamps()`

| Field | Type | Ref | Flags |
|---|---|---|---|
| `name` | String |  | required |
| `originalName` | String |  | required |
| `description` | String |  |  |
| `owner` | ObjectId | `User` | required |
| `organization` | ObjectId | `Organization` | required |
| `cabinet` | ObjectId | `UserCabinet` | required |
| `s3Key` | String |  | required |
| `s3Bucket` | String |  | required |
| `s3Region` | String |  | required |
| `mimeType` | String |  | required |
| `size` | Number |  | required |
| `extension` | String |  |  |
| `path` | String |  | required |
| `isPublic` | Boolean |  | default false |
| `permissions` | Mixed |  | default fn  |
| `tags` | [String] |  |  |
| `metadata` | Mixed |  | default fn  |
| `status` | String |  | default "uploading", enum ["uploading","uploaded","proc… |
| `version` | Number |  | default 1 |
| `parentFile` | ObjectId | `UserFile` | default null |
| `_id` | ObjectId |  |  |
| `createdAt` | Date |  |  |
| `updatedAt` | Date |  |  |

**Indexes:** `{"owner":1,"organization":1} {"background":true}`; `{"cabinet":1} {"background":true}`; `{"path":1,"owner":1} {"background":true}`; `{"s3Key":1} {"background":true}`; `{"mimeType":1} {"background":true}`; `{"tags":1} {"background":true}`

### UserNotification

- **Collection:** `usernotifications` · **Area:** Core platform · **Source:** `server/models/userNotification.model.ts` (doc: `server/models/userNotification.model.ts.md`) · **Options:** timestamps=true, autoIndex=null, capped=false
- **Used by:** `server/realtime/socket.ts`, `server/routes/userNotifications.ts`, `server/scripts/grant-licence-coupons.ts`, `server/services/couponAssignment.ts`, `server/services/feed.ts`, `server/services/franchiseGlobalOffer.ts`, `server/services/franchiseOffer.ts`, `server/services/pendingCouponGift.ts`, … +3 more
- **Hooks:** pre(save) ×5, pre(findOneAndReplace) ×1, pre(findOneAndUpdate) ×1, pre(replaceOne) ×1, pre(update) ×1, pre(updateOne) ×1, pre(updateMany) ×1, pre(remove) ×1, post(save) ×3, post(init) ×1
- **Statics/methods:** `initializeTimestamps()`

| Field | Type | Ref | Flags |
|---|---|---|---|
| `userId` | ObjectId | `User` | required |
| `orgId` | ObjectId | `Organization` |  |
| `type` | String |  | required, enum ["dm","group_message","knock"… |
| `dmFrom` | ObjectId | `User` |  |
| `dmFromName` | String |  |  |
| `dmFromEmail` | String |  |  |
| `dmFromPicture` | String |  |  |
| `dmText` | String |  |  |
| `dmConvId` | String |  |  |
| `dmMessageId` | ObjectId |  |  |
| `groupId` | ObjectId | `Group` |  |
| `groupName` | String |  |  |
| `groupFrom` | ObjectId | `User` |  |
| `groupFromName` | String |  |  |
| `groupFromEmail` | String |  |  |
| `groupFromPicture` | String |  |  |
| `groupText` | String |  |  |
| `groupMessageId` | ObjectId |  |  |
| `knockFrom` | ObjectId | `User` |  |
| `knockFromName` | String |  |  |
| `knockFromEmail` | String |  |  |
| `knockFromPicture` | String |  |  |
| `knockSpaceId` | String |  |  |
| `globalDmFrom` | ObjectId | `User` |  |
| `globalDmFromName` | String |  |  |
| `globalDmFromEmail` | String |  |  |
| `globalDmFromPicture` | String |  |  |
| `globalDmText` | String |  |  |
| `globalDmConvId` | String |  |  |
| `globalDmMessageId` | ObjectId |  |  |
| `postId` | ObjectId | `Post` |  |
| `postAuthorId` | ObjectId | `User` |  |
| `postAuthorName` | String |  |  |
| `postAuthorEmail` | String |  |  |
| `postAuthorPicture` | String |  |  |
| `postContent` | String |  |  |
| `channelId` | ObjectId | `Channel` |  |
| `channelName` | String |  |  |
| `commentId` | ObjectId | `PostComment` |  |
| `commentAuthorId` | ObjectId | `User` |  |
| `commentAuthorName` | String |  |  |
| `commentAuthorEmail` | String |  |  |
| `commentAuthorPicture` | String |  |  |
| `commentContent` | String |  |  |
| `couponCode` | String |  |  |
| `couponName` | String |  |  |
| `assignmentId` | ObjectId | `CouponAssignment` |  |
| `giftFromUserId` | ObjectId | `User` |  |
| `giftFromName` | String |  |  |
| `giftFromPicture` | String |  |  |
| `giftFromType` | String |  | enum ["garage_admin","founder","us… |
| `giftOrgName` | String |  |  |
| `giftMessage` | String |  |  |
| `reserveOfferId` | ObjectId | `PendingReserveAssignment` |  |
| `reserveItemType` | String |  | enum ["course","channel","workshop… |
| `reserveItemName` | String |  |  |
| `reservePriceUsd` | Number |  |  |
| `franchiseOfferId` | ObjectId | `FranchiseOffer` |  |
| `franchiseAssignmentId` | ObjectId | `FranchiseTerritoryAssignment` |  |
| `franchiseTerritoryName` | String |  |  |
| `franchiseOfferPriceUsd` | Number |  |  |
| `franchiseOfferEvent` | String |  | enum ["created","accepted","reject… |
| `franchiseInvoiceId` | ObjectId | `Invoice` |  |
| `franchiseGlobalOfferId` | ObjectId | `FranchiseGlobalOffer` |  |
| `franchiseGlobalAssignmentId` | ObjectId | `FranchiseGlobalAssignment` |  |
| `grantId` | ObjectId | `PermissionGrant` |  |
| `grantModule` | String |  |  |
| `grantModuleLabel` | String |  |  |
| `grantExpiresAt` | Date |  |  |
| `grantedByName` | String |  |  |
| `read` | Boolean |  | default false |
| `cleared` | Boolean |  | default false |
| `_id` | ObjectId |  |  |
| `createdAt` | Date |  |  |
| `updatedAt` | Date |  |  |

**Indexes:** `{"userId":1,"cleared":1,"createdAt":-1} {"background":true}`; `{"userId":1,"orgId":1,"cleared":1} {"background":true}`; `{"userId":1,"read":1} {"background":true}`; `{"userId":1,"type":1,"cleared":1,"createdAt":-1} {"background":true}`

### UserProductLink

- **Collection:** `userproductlinks` · **Area:** Core platform · **Source:** `server/models/userProductLink.model.ts` (doc: `server/models/userProductLink.model.ts.md`) · **Options:** timestamps=true, autoIndex=null, capped=false
- **Used by:** `server/routes/product.ts`, `server/services/product.ts`
- **Hooks:** pre(save) ×5, pre(findOneAndReplace) ×1, pre(findOneAndUpdate) ×1, pre(replaceOne) ×1, pre(update) ×1, pre(updateOne) ×1, pre(updateMany) ×1, pre(remove) ×1, post(save) ×3, post(init) ×1
- **Statics/methods:** `initializeTimestamps()`

| Field | Type | Ref | Flags |
|---|---|---|---|
| `userId` | ObjectId | `User` | required |
| `productId` | ObjectId | `Product` | required |
| `digitalLinkLabel` | String |  | required |
| `url` | String |  | required |
| `label` | String |  |  |
| `description` | String |  |  |
| `_id` | ObjectId |  |  |
| `createdAt` | Date |  |  |
| `updatedAt` | Date |  |  |

**Indexes:** `{"userId":1,"productId":1,"digitalLinkLabel":1} {"unique":true,"background":true}`; `{"productId":1,"digitalLinkLabel":1} {"background":true}`

### Vacancy

- **Collection:** `vacancies` · **Area:** Core platform · **Source:** `server/models/vacancy.model.ts` (doc: `server/models/vacancy.model.ts.md`) · **Options:** timestamps=true, autoIndex=null, capped=false
- **Referenced by:** `Application`
- **Used by:** `server/routes/careers.ts`
- **Hooks:** pre(save) ×5, pre(findOneAndReplace) ×1, pre(findOneAndUpdate) ×1, pre(replaceOne) ×1, pre(update) ×1, pre(updateOne) ×1, pre(updateMany) ×1, pre(remove) ×1, post(save) ×3, post(init) ×1
- **Statics/methods:** `initializeTimestamps()`

| Field | Type | Ref | Flags |
|---|---|---|---|
| `orgId` | ObjectId | `Organization` | required |
| `title` | String |  | required |
| `department` | String |  | required |
| `location` | String |  | required |
| `employmentType` | String |  | default "full-time", enum ["full-time","part-time","con… |
| `description` | String |  | required |
| `requirements` | String |  |  |
| `salary` | String |  |  |
| `status` | String |  | default "open", enum ["open","closed","draft"] |
| `createdBy` | ObjectId | `User` |  |
| `_id` | ObjectId |  |  |
| `createdAt` | Date |  |  |
| `updatedAt` | Date |  |  |

### VoIPToken

- **Collection:** `voiptokens` · **Area:** Core platform · **Source:** `server/models/voipToken.model.ts` (doc: `server/models/voipToken.model.ts.md`) · **Options:** timestamps=true, autoIndex=null, capped=false
- **Used by:** `scripts/test-knock-push.ts`, `server/realtime/socket.ts`, `server/routes/devices.ts`, `server/services/socket.ts`, `server/services/voipPushNotification.ts`
- **Hooks:** pre(save) ×5, pre(findOneAndReplace) ×1, pre(findOneAndUpdate) ×1, pre(replaceOne) ×1, pre(update) ×1, pre(updateOne) ×1, pre(updateMany) ×1, pre(remove) ×1, post(save) ×3, post(init) ×1
- **Statics/methods:** `initializeTimestamps()`

| Field | Type | Ref | Flags |
|---|---|---|---|
| `userId` | ObjectId | `User` | required, index |
| `token` | String |  | required, unique |
| `platform` | String |  | required, default "ios", enum ["ios"] |
| `deviceId` | String |  |  |
| `appVersion` | String |  |  |
| `app` | String |  | enum ["garage-chat","networkchain"] |
| `isActive` | Boolean |  | default true |
| `lastUsedAt` | Date |  | default fn now |
| `failedAttempts` | Number |  | default 0 |
| `lastFailedAt` | Date |  |  |
| `_id` | ObjectId |  |  |
| `createdAt` | Date |  |  |
| `updatedAt` | Date |  |  |

**Indexes:** `{"userId":1} {"background":true}`; `{"token":1} {"unique":true,"background":true}`; `{"userId":1,"isActive":1} {"background":true}`; `{"lastUsedAt":1} {"expireAfterSeconds":7776000,"background":true}`

### WalletAccount

- **Collection:** `walletaccounts` · **Area:** Core platform · **Source:** `server/models/walletAccount.model.ts` (doc: `server/models/walletAccount.model.ts.md`) · **Options:** timestamps=true, autoIndex=null, capped=false
- **Referenced by:** `Withdrawal`
- **Used by:** `server/controllers/garageAdmin.controller.ts`, `server/routes/wallet.ts`, `server/scripts/migrateBankDetailsToWalletAccount.ts`, `server/services/walletAccount.ts`, `server/services/withdrawal.ts`
- **Hooks:** pre(save) ×5, pre(findOneAndReplace) ×1, pre(findOneAndUpdate) ×1, pre(replaceOne) ×1, pre(update) ×1, pre(updateOne) ×1, pre(updateMany) ×1, pre(remove) ×1, post(save) ×3, post(init) ×1
- **Statics/methods:** `initializeTimestamps()`

| Field | Type | Ref | Flags |
|---|---|---|---|
| `userId` | ObjectId | `User` | required, index |
| `walletType` | String |  | required, enum ["store","affiliate","content… |
| `orgId` | ObjectId | `Organization` | default null |
| `accountType` | String |  | required, enum ["bank","crypto"] |
| `label` | String |  | default "" |
| `country` | String |  | default "" |
| `bankName` | String |  | default "" |
| `branchAddress` | Embedded |  | default fn default |
| `routingNumber` | String |  | default "" |
| `accountNumber` | String |  | default "" |
| `swiftCode` | String |  | default "" |
| `ibanNumber` | String |  | default "" |
| `beneficiaryName` | String |  | default "" |
| `beneficiaryAddress` | Embedded |  | default fn default |
| `cryptoNetwork` | String |  | default "" |
| `cryptoAddress` | String |  | default "" |
| `cryptoMemo` | String |  | default "" |
| `isActive` | Boolean |  | default true |
| `_id` | ObjectId |  |  |
| `createdAt` | Date |  |  |
| `updatedAt` | Date |  |  |

**Indexes:** `{"userId":1} {"background":true}`; `{"userId":1,"walletType":1,"orgId":1,"accountType":1} {"unique":true,"name":"wallet_account_slot_unique","background":true}`

### WalletTransaction

- **Collection:** `wallettransactions` · **Area:** Core platform · **Source:** `server/models/walletTransaction.model.ts` (doc: `server/models/walletTransaction.model.ts.md`) · **Options:** timestamps=true, autoIndex=null, capped=false
- **Referenced by:** `CashbackDistribution`, `OfficeAddonPayment`, `RankQualification`, `WalletTransaction`
- **Used by:** `server/bat246/services/bat246LostMoneyAutoPay.service.ts`, `server/bat246/services/bat246Wallet.util.ts`, `server/routes/franchiseApi.ts`, `server/routes/garageAdminStoreWallets.ts`, `server/routes/hifiInvoice.ts`, `server/routes/invoice.ts`, `server/routes/wallet.ts`, `server/routes/walletHq.ts`, … +61 more
- **Hooks:** pre(save) ×5, pre(findOneAndReplace) ×1, pre(findOneAndUpdate) ×1, pre(replaceOne) ×1, pre(update) ×1, pre(updateOne) ×1, pre(updateMany) ×1, pre(validate) ×1, pre(remove) ×1, post(save) ×3, post(init) ×1
- **Statics/methods:** `initializeTimestamps()`

| Field | Type | Ref | Flags |
|---|---|---|---|
| `storeWalletId` | ObjectId | `StoreWallet` | index |
| `affiliateWalletId` | ObjectId | `AffiliateWallet` | index |
| `walletType` | String |  | required, index, enum ["store","affiliate"] |
| `userId` | ObjectId | `User` | required, index |
| `orgId` | ObjectId | `Organization` | index |
| `type` | String |  | required, index, enum ["credit","debit","transfer",… |
| `amount` | Number |  | required |
| `currency` | String |  | default "USD" |
| `balanceBefore` | Number |  | required |
| `balanceAfter` | Number |  | required |
| `description` | String |  | required |
| `note` | String |  |  |
| `relatedUserId` | ObjectId | `User` |  |
| `relatedTransactionId` | ObjectId | `WalletTransaction` |  |
| `metadata` | Mixed |  |  |
| `status` | String |  | index, default "completed", enum ["completed","pending","faile… |
| `_id` | ObjectId |  |  |
| `createdAt` | Date |  |  |
| `updatedAt` | Date |  |  |

**Indexes:** `{"storeWalletId":1} {"background":true}`; `{"affiliateWalletId":1} {"background":true}`; `{"walletType":1} {"background":true}`; `{"userId":1} {"background":true}`; `{"orgId":1} {"background":true}`; `{"type":1} {"background":true}`; `{"status":1} {"background":true}`; `{"userId":1,"walletType":1,"createdAt":-1} {"background":true}`; `{"storeWalletId":1,"createdAt":-1} {"background":true}`; `{"affiliateWalletId":1,"createdAt":-1} {"background":true}`; `{"orgId":1,"type":1,"createdAt":-1} {"background":true}`; `{"relatedUserId":1,"createdAt":-1} {"background":true}`; `{"metadata.dedupeKey":1} {"unique":true,"partialFilterExpression":{"metadata.dedupeKey":{"$exists":true}},"background":true}`; `{"metadata.transferGroupId":1} {"partialFilterExpression":{"metadata.transferGroupId":{"$exists":true}},"background":true}`

### WebinarAttendance

- **Collection:** `webinarattendances` · **Area:** Core platform · **Source:** `server/models/webinarAttendance.model.ts` (doc: `server/models/webinarAttendance.model.ts.md`) · **Options:** timestamps=true, autoIndex=null, capped=false
- **Used by:** `server/realtime/mediasoupHandlers.ts`, `server/routes/publicWebinar.ts`, `server/routes/webinarRoutes.ts`, `server/services/downlineMemberLiveStreams.ts`
- **Hooks:** pre(save) ×5, pre(findOneAndReplace) ×1, pre(findOneAndUpdate) ×1, pre(replaceOne) ×1, pre(update) ×1, pre(updateOne) ×1, pre(updateMany) ×1, pre(remove) ×1, post(save) ×3, post(init) ×1
- **Statics/methods:** `initializeTimestamps()`

| Field | Type | Ref | Flags |
|---|---|---|---|
| `workshopId` | ObjectId | `Workshop` | required, index |
| `orgId` | ObjectId | `Organization` | required |
| `sessionDate` | Date |  | required |
| `userId` | ObjectId | `User` | required, index |
| `name` | String |  |  |
| `email` | String |  |  |
| `role` | String |  | default "attendee", enum ["host","panelist","attendee"] |
| `firstJoinedAt` | Date |  | required |
| `lastJoinedAt` | Date |  | required |
| `lastLeftAt` | Date |  |  |
| `totalSeconds` | Number |  | default 0 |
| `joinCount` | Number |  | default 1 |
| `_id` | ObjectId |  |  |
| `createdAt` | Date |  |  |
| `updatedAt` | Date |  |  |

**Indexes:** `{"workshopId":1} {"background":true}`; `{"userId":1} {"background":true}`; `{"workshopId":1,"sessionDate":1,"userId":1} {"unique":true,"background":true}`

### WebinarMessage

- **Collection:** `webinarmessages` · **Area:** Core platform · **Source:** `server/models/webinarMessage.model.ts` (doc: `server/models/webinarMessage.model.ts.md`) · **Options:** autoIndex=null, capped=false
- **Used by:** `server/realtime/mediasoupHandlers.ts`, `server/routes/publicWebinar.ts`, `server/routes/webinarRoutes.ts`
- **Hooks:** pre(save) ×4, pre(remove) ×1, post(save) ×3, post(init) ×1

| Field | Type | Ref | Flags |
|---|---|---|---|
| `workshopId` | ObjectId | `Workshop` | required |
| `userId` | String |  | required |
| `userName` | String |  | required |
| `text` | String |  | default "" |
| `replyTo` | Embedded |  |  |
| `attachments` | [subdoc] |  |  |
| `reactions` | Mixed |  |  |
| `mentions` | [String] |  |  |
| `sessionDate` | Date |  |  |
| `timestamp` | Date |  | default fn now |
| `_id` | ObjectId |  |  |

**Indexes:** `{"workshopId":1,"timestamp":1} {"background":true}`; `{"workshopId":1,"sessionDate":1,"timestamp":1} {"background":true}`

### WebinarProductPin

- **Collection:** `webinarproductpins` · **Area:** Core platform · **Source:** `server/models/webinarProductPin.model.ts` (doc: `server/models/webinarProductPin.model.ts.md`) · **Options:** timestamps=true, autoIndex=null, capped=false
- **Used by:** `server/realtime/mediasoupHandlers.ts`, `server/routes/publicWebinar.ts`, `server/routes/webinarRoutes.ts`, `server/services/founderStreamTable.ts`, `server/services/invoice.ts`, `server/services/workshop.ts`
- **Hooks:** pre(save) ×5, pre(findOneAndReplace) ×1, pre(findOneAndUpdate) ×1, pre(replaceOne) ×1, pre(update) ×1, pre(updateOne) ×1, pre(updateMany) ×1, pre(remove) ×1, post(save) ×3, post(init) ×1
- **Statics/methods:** `initializeTimestamps()`

| Field | Type | Ref | Flags |
|---|---|---|---|
| `workshopId` | ObjectId | `Workshop` | required, index |
| `orgId` | ObjectId | `Organization` | required |
| `sessionDate` | Date |  | required |
| `itemType` | String |  | required |
| `itemId` | ObjectId |  | required |
| `itemName` | String |  |  |
| `price` | Number |  |  |
| `currency` | String |  |  |
| `firstPinnedAt` | Date |  | required |
| `lastPinnedAt` | Date |  | required |
| `pinCount` | Number |  | default 1 |
| `_id` | ObjectId |  |  |
| `createdAt` | Date |  |  |
| `updatedAt` | Date |  |  |

**Indexes:** `{"workshopId":1} {"background":true}`; `{"workshopId":1,"sessionDate":1,"itemType":1,"itemId":1} {"unique":true,"background":true}`

### WhitelabelBonusPayout

- **Collection:** `whitelabelbonuspayouts` · **Area:** Core platform · **Source:** `server/models/whitelabelBonusPayout.model.ts` (doc: `server/models/whitelabelBonusPayout.model.ts.md`) · **Options:** timestamps=true, autoIndex=null, capped=false
- **Used by:** `server/routes/garageAdminWhitelabelMonthlyBonus.ts`, `server/services/whitelabelMonthlyBonus/payout.ts`, `server/services/whitelabelMonthlyBonus/qualify.ts`, `server/services/whitelabelMonthlyBonus/run.ts`
- **Hooks:** pre(save) ×5, pre(findOneAndReplace) ×1, pre(findOneAndUpdate) ×1, pre(replaceOne) ×1, pre(update) ×1, pre(updateOne) ×1, pre(updateMany) ×1, pre(remove) ×1, post(save) ×3, post(init) ×1
- **Statics/methods:** `initializeTimestamps()`

| Field | Type | Ref | Flags |
|---|---|---|---|
| `runId` | ObjectId | `WhitelabelBonusRun` | required, index |
| `periodKey` | String |  | required, index |
| `userId` | ObjectId | `User` | required, index |
| `qualifyingSales` | Number |  | required |
| `bonusUsd` | Number |  | required |
| `payoutStatus` | String |  | index, default "pending", enum ["pending","paid","failed"] |
| `routedToPlatform` | Boolean |  | default false |
| `walletTransactionId` | ObjectId |  |  |
| `paidAt` | Date |  |  |
| `attempts` | Number |  | default 0 |
| `lastError` | String |  |  |
| `saleInvoiceIds` | [ObjectId] |  |  |
| `saleInvoiceIdsTruncated` | Boolean |  | default false |
| `_id` | ObjectId |  |  |
| `createdAt` | Date |  |  |
| `updatedAt` | Date |  |  |

**Indexes:** `{"runId":1} {"background":true}`; `{"periodKey":1} {"background":true}`; `{"userId":1} {"background":true}`; `{"payoutStatus":1} {"background":true}`; `{"periodKey":1,"userId":1} {"unique":true,"background":true}`; `{"runId":1,"bonusUsd":-1} {"background":true}`

### WhitelabelBonusRun

- **Collection:** `whitelabelbonusruns` · **Area:** Core platform · **Source:** `server/models/whitelabelBonusRun.model.ts` (doc: `server/models/whitelabelBonusRun.model.ts.md`) · **Options:** timestamps=true, autoIndex=null, capped=false
- **Referenced by:** `WhitelabelBonusPayout`
- **Used by:** `server/routes/garageAdminWhitelabelMonthlyBonus.ts`, `server/services/whitelabelMonthlyBonus/qualify.ts`, `server/services/whitelabelMonthlyBonus/run.ts`
- **Hooks:** pre(save) ×5, pre(findOneAndReplace) ×1, pre(findOneAndUpdate) ×1, pre(replaceOne) ×1, pre(update) ×1, pre(updateOne) ×1, pre(updateMany) ×1, pre(remove) ×1, post(save) ×3, post(init) ×1
- **Statics/methods:** `initializeTimestamps()`

| Field | Type | Ref | Flags |
|---|---|---|---|
| `periodKey` | String |  | required, unique |
| `status` | String |  | index, default "computing", enum ["computing","computed","payi… |
| `dryRun` | Boolean |  | required |
| `snapshotAt` | Date |  | required |
| `startedAt` | Date |  | required |
| `computedAt` | Date |  |  |
| `paidAt` | Date |  |  |
| `totals` | Embedded |  | default fn default |
| `error` | String |  |  |
| `triggeredBy` | String |  |  |
| `_id` | ObjectId |  |  |
| `createdAt` | Date |  |  |
| `updatedAt` | Date |  |  |

**Indexes:** `{"periodKey":1} {"unique":true,"background":true}`; `{"status":1} {"background":true}`; `{"createdAt":-1} {"background":true}`

### Withdrawal

- **Collection:** `withdrawals` · **Area:** Core platform · **Source:** `server/models/withdrawal.model.ts` (doc: `server/models/withdrawal.model.ts.md`) · **Options:** timestamps=true, autoIndex=null, capped=false
- **Used by:** `server/controllers/garageAdmin.controller.ts`, `server/models/withdrawalPreference.model.ts`, `server/routes/wallet.ts`, `server/services/withdrawal.ts`
- **Hooks:** pre(save) ×5, pre(findOneAndReplace) ×1, pre(findOneAndUpdate) ×1, pre(replaceOne) ×1, pre(update) ×1, pre(updateOne) ×1, pre(updateMany) ×1, pre(remove) ×1, post(save) ×3, post(init) ×1
- **Statics/methods:** `initializeTimestamps()`

| Field | Type | Ref | Flags |
|---|---|---|---|
| `userId` | ObjectId | `User` | required, index |
| `walletType` | String |  | required, enum ["store","affiliate","content… |
| `orgId` | ObjectId | `Organization` | default null |
| `accountId` | ObjectId | `WalletAccount` | required |
| `accountType` | String |  | required, enum ["bank","crypto"] |
| `accountSnapshot` | Mixed |  |  |
| `withdrawalType` | String |  | default "manual", enum ["manual"] |
| `currency` | String |  | default "USD" |
| `grossAmount` | Number |  | required |
| `feePercent` | Number |  | required, default 5 |
| `feeAmount` | Number |  | required |
| `bankTransferFee` | Number |  | default 0 |
| `feeTier.frequency` | String |  |  |
| `feeTier.keepAmountCents` | Number |  |  |
| `feeTier.meetsKeepThreshold` | Boolean |  |  |
| `feeTier.configured` | Boolean |  |  |
| `feeTier.payoutMethod` | String |  |  |
| `taxes` | [subdoc] |  | default [] |
| `taxTotal` | Number |  | required, default 0 |
| `netAmount` | Number |  | required |
| `status` | String |  | index, default "initiated", enum ["initiated","completed","rej… |
| `initiatedByAdmin` | ObjectId | `GarageAdmin` | required |
| `adminOverride` | Embedded |  |  |
| `processedByAdmin` | ObjectId | `GarageAdmin` | default null |
| `processedAt` | Date |  | default null |
| `receiptUrl` | String |  | default "" |
| `txHash` | String |  | default "" |
| `proofs` | [subdoc] |  | default [] |
| `rejectionReason` | String |  | default "" |
| `feeTransactionRef` | String |  | default "" |
| `_id` | ObjectId |  |  |
| `createdAt` | Date |  |  |
| `updatedAt` | Date |  |  |

**Indexes:** `{"userId":1} {"background":true}`; `{"status":1} {"background":true}`; `{"status":1,"createdAt":-1} {"background":true}`; `{"userId":1,"walletType":1,"orgId":1,"createdAt":-1} {"background":true}`

### WithdrawalPreference

- **Collection:** `withdrawalpreferences` · **Area:** Core platform · **Source:** `server/models/withdrawalPreference.model.ts` (doc: `server/models/withdrawalPreference.model.ts.md`) · **Options:** timestamps=true, autoIndex=null, capped=false
- **Used by:** `server/config/affiliateWithdrawalFees.ts`, `server/routes/garageAdminWithdrawalPreferences.ts`, `server/routes/wallet.ts`, `server/services/withdrawal.ts`
- **Hooks:** pre(save) ×5, pre(findOneAndReplace) ×1, pre(findOneAndUpdate) ×1, pre(replaceOne) ×1, pre(update) ×1, pre(updateOne) ×1, pre(updateMany) ×1, pre(remove) ×1, post(save) ×3, post(init) ×1
- **Statics/methods:** `initializeTimestamps()`

| Field | Type | Ref | Flags |
|---|---|---|---|
| `userId` | ObjectId | `User` | required, index |
| `walletType` | String |  | required, enum ["store","affiliate","content… |
| `orgId` | ObjectId | `Organization` | default null |
| `frequency` | String |  | index, default "weekly", enum ["weekly","daily"] |
| `keepAmountCents` | Number |  | default null |
| `_id` | ObjectId |  |  |
| `createdAt` | Date |  |  |
| `updatedAt` | Date |  |  |

**Indexes:** `{"userId":1} {"background":true}`; `{"frequency":1} {"background":true}`; `{"userId":1,"walletType":1,"orgId":1} {"unique":true,"background":true}`

### Workshop

- **Collection:** `workshops` · **Area:** Core platform · **Source:** `server/models/workshop.model.ts` (doc: `server/models/workshop.model.ts.md`) · **Options:** timestamps=true, autoIndex=null, capped=false
- **Referenced by:** `ChannelMembershipEvent`, `PhoneVerificationEvent`, `WebinarAttendance`, `WebinarMessage`, `WebinarProductPin`, `WorkshopRegistration`, `WorkshopSessionOverride`
- **Used by:** `server/controllers/garageAdmin.controller.ts`, `server/realtime/mediasoupHandlers.ts`, `server/realtime/socket.ts`, `server/realtime/webinarEnd.ts`, `server/routes/affiliate.ts`, `server/routes/evergreen.ts`, `server/routes/feed.ts`, `server/routes/founderCouponItems.ts`, … +40 more
- **Hooks:** pre(save) ×5, pre(findOneAndReplace) ×1, pre(findOneAndUpdate) ×1, pre(replaceOne) ×1, pre(update) ×1, pre(updateOne) ×1, pre(updateMany) ×1, pre(remove) ×1, post(save) ×4, post(findOneAndUpdate) ×1, post(findOneAndDelete) ×1, post(deleteOne) ×1, post(init) ×1
- **Statics/methods:** `initializeTimestamps()`

| Field | Type | Ref | Flags |
|---|---|---|---|
| `title` | String |  | required |
| `description` | String |  |  |
| `thumbnail` | String |  |  |
| `totalViews` | Number |  | default 0 |
| `galleryImages` | [String] |  |  |
| `videoUrl` | String |  |  |
| `videoFile` | String |  |  |
| `date` | Date |  | required, index |
| `startTime` | String |  | required |
| `endTime` | String |  | required |
| `timezone` | String |  | default "Asia/Kolkata" |
| `meetingUrl` | String |  |  |
| `meetingId` | String |  |  |
| `meetingPassword` | String |  |  |
| `maxParticipants` | Number |  | default 300 |
| `channelIds` | [ObjectId] | `Channel` |  |
| `orgId` | ObjectId | `Organization` | required, index |
| `createdBy` | ObjectId | `User` | required |
| `isFree` | Boolean |  | default true |
| `price` | Number |  | default 0 |
| `currency` | String |  | default "USD", enum ["INR","USD"] |
| `emailAlerts.enabled` | Boolean |  | default false |
| `emailAlerts.templateId` | String |  |  |
| `emailAlerts.templateName` | String |  |  |
| `emailAlerts.templateHtml` | String |  |  |
| `emailAlerts.syncedAt` | Date |  |  |
| `founderAlerts.enabled` | Boolean |  | default false |
| `founderAlerts.recipients` | [String] |  |  |
| `gstInclusive` | Boolean |  | default true |
| `requireIosPayment` | Boolean |  | default false |
| `appleFeeInclusive` | Boolean |  | default false |
| `isActive` | Boolean |  | index, default true |
| `isRecurring` | Boolean |  | index, default false |
| `recurrencePattern.type` | String |  | enum ["daily","weekly","monthly"] |
| `recurrencePattern.excludedDays` | [Number] |  |  |
| `recurrencePattern.dayOfWeek` | Number |  |  |
| `recurrencePattern.dayOfMonth` | Number |  |  |
| `recurrencePattern.daysOfWeek` | [Number] |  |  |
| `recurrencePattern.daysOfMonth` | [Number] |  |  |
| `recurrenceStartDate` | Date |  | index |
| `recurrenceEndDate` | Date |  |  |
| `isRecurrenceActive` | Boolean |  | default true |
| `enrollmentType` | String |  | default "once", enum ["once","per_session"] |
| `currentSessionDate` | Date |  |  |
| `recordingMode` | String |  | default "manual", enum ["manual","automatic"] |
| `simulatedAudience.enabled` | Boolean |  | default false |
| `simulatedAudience.people` | [subdoc] |  |  |
| `simulatedAudience.chat` | [subdoc] |  |  |
| `simulatedAudience.viewers.enabled` | Boolean |  | default false |
| `simulatedAudience.viewers.peak` | Number |  | default 0 |
| `evergreen.enabled` | Boolean |  | default false |
| `evergreen.source` | String |  | enum ["upload","recording"] |
| `evergreen.videoUrl` | String |  |  |
| `evergreen.videoS3Key` | String |  |  |
| `evergreen.durationSec` | Number |  |  |
| `evergreen.joinWindowMin` | Number |  | default null |
| `evergreen.loop` | Boolean |  | default true |
| `evergreen.simulatedChat` | [subdoc] |  |  |
| `evergreen.simulatedViewers.enabled` | Boolean |  | default false |
| `evergreen.simulatedViewers.peak` | Number |  |  |
| `isSubscription` | Boolean |  | default false |
| `subscriptionPeriod` | String |  | enum ["weekly","monthly","quarterl… |
| `rating` | Number |  |  |
| `ratingCount` | Number |  | default 0 |
| `aboutText` | String |  |  |
| `learningPoints` | [String] |  |  |
| `agenda` | [subdoc] |  |  |
| `bonuses` | [subdoc] |  |  |
| `reviews` | [subdoc] |  |  |
| `faqs` | [subdoc] |  |  |
| `requirements` | [String] |  |  |
| `whatsIncluded` | [String] |  |  |
| `hostRating` | Number |  |  |
| `hostStudents` | String |  |  |
| `hostWebinars` | String |  |  |
| `hostExperience` | String |  |  |
| `speakers` | [ObjectId] | `User` |  |
| `deletedAt` | Date |  | index |
| `restoredAt` | Date |  |  |
| `_id` | ObjectId |  |  |
| `createdAt` | Date |  |  |
| `updatedAt` | Date |  |  |

**Indexes:** `{"date":1} {"background":true}`; `{"orgId":1} {"background":true}`; `{"isActive":1} {"background":true}`; `{"isRecurring":1} {"background":true}`; `{"recurrenceStartDate":1} {"background":true}`; `{"deletedAt":1} {"background":true}`; `{"orgId":1,"date":1,"isActive":1} {"background":true}`; `{"orgId":1,"channelIds":1,"date":1} {"background":true}`; `{"createdBy":1,"date":1} {"background":true}`; `{"orgId":1,"isRecurring":1,"isRecurrenceActive":1,"isActive":1} {"background":true}`

### WorkshopRegistration

- **Collection:** `workshopregistrations` · **Area:** Core platform · **Source:** `server/models/workshopRegistration.model.ts` (doc: `server/models/workshopRegistration.model.ts.md`) · **Options:** timestamps=true, autoIndex=null, capped=false
- **Used by:** `server/routes/learnInit.ts`, `server/routes/public.ts`, `server/routes/publicMeet.ts`, `server/routes/publicWebinar.ts`, `server/routes/unifiedOrders.ts`, `server/routes/workshop.ts`, `server/scripts/backfill-india-freedom-webinar.ts`, `server/services/downlineMemberLiveStreams.ts`, … +5 more
- **Hooks:** pre(save) ×5, pre(findOneAndReplace) ×1, pre(findOneAndUpdate) ×1, pre(replaceOne) ×1, pre(update) ×1, pre(updateOne) ×1, pre(updateMany) ×1, pre(remove) ×1, post(save) ×3, post(init) ×1
- **Statics/methods:** `initializeTimestamps()`

| Field | Type | Ref | Flags |
|---|---|---|---|
| `workshopId` | ObjectId | `Workshop` | required, index |
| `userId` | ObjectId | `User` | required, index |
| `orgId` | ObjectId | `Organization` | required, index |
| `status` | String |  | default "registered", enum ["registered","attended","can… |
| `hasPaid` | Boolean |  | default false |
| `paymentId` | String |  |  |
| `orderId` | String |  |  |
| `invoiceShortUrl` | String |  |  |
| `amountPaid` | Number |  |  |
| `currency` | String |  | default "INR" |
| `registeredAt` | Date |  | default fn now |
| `attendedAt` | Date |  |  |
| `enrollmentType` | String |  | default "full", enum ["full","session"] |
| `sessionDate` | Date |  | index |
| `enrolledAt` | Date |  | default fn now |
| `grandfathered` | Boolean |  | default false |
| `cancelledAt` | Date |  |  |
| `_id` | ObjectId |  |  |
| `createdAt` | Date |  |  |
| `updatedAt` | Date |  |  |

**Indexes:** `{"workshopId":1} {"background":true}`; `{"userId":1} {"background":true}`; `{"orgId":1} {"background":true}`; `{"sessionDate":1} {"background":true}`; `{"workshopId":1,"userId":1,"sessionDate":1} {"background":true}`; `{"userId":1,"status":1} {"background":true}`; `{"workshopId":1,"status":1} {"background":true}`; `{"workshopId":1,"userId":1,"enrollmentType":1} {"background":true}`; `{"workshopId":1,"sessionDate":1,"status":1} {"background":true}`; `{"workshopId":1,"grandfathered":1} {"background":true}`

### WorkshopSessionOverride

- **Collection:** `workshopsessionoverrides` · **Area:** Core platform · **Source:** `server/models/workshopSessionOverride.model.ts` (doc: `server/models/workshopSessionOverride.model.ts.md`) · **Options:** timestamps=true, autoIndex=null, capped=false
- **Used by:** `server/realtime/mediasoupHandlers.ts`, `server/realtime/webinarEnd.ts`, `server/routes/livekitRecording.ts`, `server/routes/publicWebinar.ts`, `server/routes/webinarRoutes.ts`, `server/routes/workshop.ts`, `server/routes/workshopCheckout.ts`, `server/services/downlineMemberLiveStreams.ts`, … +7 more
- **Hooks:** pre(save) ×5, pre(findOneAndReplace) ×1, pre(findOneAndUpdate) ×1, pre(replaceOne) ×1, pre(update) ×1, pre(updateOne) ×1, pre(updateMany) ×1, pre(remove) ×1, post(save) ×3, post(init) ×1
- **Statics/methods:** `initializeTimestamps()`

| Field | Type | Ref | Flags |
|---|---|---|---|
| `workshopId` | ObjectId | `Workshop` | required, index |
| `sessionDate` | Date |  | required |
| `deletedAt` | Date |  | index |
| `restoredAt` | Date |  |  |
| `manualStartedAt` | Date |  |  |
| `manualEndedAt` | Date |  |  |
| `hostUserId` | ObjectId | `User` |  |
| `garageTvViewerIds` | [String] |  |  |
| `liveState` | Mixed |  |  |
| `title` | String |  |  |
| `description` | String |  |  |
| `thumbnail` | String |  |  |
| `rescheduledDate` | Date |  |  |
| `startTime` | String |  |  |
| `endTime` | String |  |  |
| `timezone` | String |  |  |
| `isFree` | Boolean |  |  |
| `price` | Number |  |  |
| `speakerName` | String |  |  |
| `speakerBio` | String |  |  |
| `speakerAvatar` | String |  |  |
| `agenda` | [subdoc] |  |  |
| `isEdited` | Boolean |  |  |
| `meta.deletedBy` | ObjectId | `User` |  |
| `meta.restoredBy` | ObjectId | `User` |  |
| `meta.startedBy` | ObjectId | `User` |  |
| `meta.endedBy` | ObjectId | `User` |  |
| `meta.updatedBy` | ObjectId | `User` |  |
| `_id` | ObjectId |  |  |
| `createdAt` | Date |  |  |
| `updatedAt` | Date |  |  |

**Indexes:** `{"workshopId":1} {"background":true}`; `{"deletedAt":1} {"background":true}`; `{"workshopId":1,"sessionDate":1} {"unique":true,"background":true}`
