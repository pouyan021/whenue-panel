import { gql, type TypedDocumentNode } from '@apollo/client';

// Hand-written types mirroring whenue-api's schema.graphqls, like whenue-app's.

export type StaffRole = 'ADMIN' | 'ORG_ADMIN' | 'VENUE_STAFF';
export type TestimonialStatus = 'PENDING' | 'APPROVED' | 'REJECTED';
export type VideoStatus = 'UPLOADING' | 'UPLOADED' | 'QUEUED' | 'READY' | 'FAILED' | 'DELETED';
export type ClubModule = 'TESTIMONIALS' | 'REFERRALS';

export type OrganizationSummary = {
  id: string;
  name: string;
  slug: string;
  locale: string;
  timeZone: string;
  modules: { module: ClubModule; enabled: boolean }[];
};

export type VenueSummary = { id: string; name: string; organization: OrganizationSummary };

export type Me = {
  id: string;
  email: string;
  role: StaffRole;
  organization: OrganizationSummary | null;
  venue: VenueSummary | null;
};

const ORGANIZATION_SUMMARY = gql`
  fragment OrganizationSummary on Organization {
    id
    name
    slug
    locale
    timeZone
    modules {
      module
      enabled
    }
  }
`;

const ME_FIELDS = gql`
  fragment MeFields on StaffAccount {
    id
    email
    role
    organization {
      ...OrganizationSummary
    }
    venue {
      id
      name
      organization {
        ...OrganizationSummary
      }
    }
  }
  ${ORGANIZATION_SUMMARY}
`;

export const ME: TypedDocumentNode<{ me: Me | null }, Record<string, never>> = gql`
  query Me {
    me {
      ...MeFields
    }
  }
  ${ME_FIELDS}
`;

// Only the token: the request carries no token yet, so the account's organization cannot be read
// until the panel asks for it with Me.
export const LOGIN: TypedDocumentNode<
  { login: { token: string; expiresAt: string } },
  { email: string; password: string }
> = gql`
  mutation Login($email: String!, $password: String!) {
    login(email: $email, password: $password) {
      token
      expiresAt
    }
  }
`;

// Admins and organization admins pick the branch they look at; venue staff only ever see their own.
export const VENUES: TypedDocumentNode<{ venues: VenueSummary[] }, { size: number }> = gql`
  query Venues($size: Int) {
    venues(size: $size) {
      id
      name
      organization {
        ...OrganizationSummary
      }
    }
  }
  ${ORGANIZATION_SUMMARY}
`;

export type Venue = {
  id: string;
  name: string;
  description: string | null;
  address: string;
  contactEmail: string;
  contactPhone: string | null;
  logo: string | null;
};

const VENUE_FIELDS = gql`
  fragment VenueFields on Venue {
    id
    name
    description
    address
    contactEmail
    contactPhone
    logo
  }
`;

export const VENUE: TypedDocumentNode<{ venue: Venue | null }, { id: string }> = gql`
  query Venue($id: ID!) {
    venue(id: $id) {
      ...VenueFields
    }
  }
  ${VENUE_FIELDS}
`;

export type VenueInput = Partial<Omit<Venue, 'id'>>;

export const UPDATE_VENUE: TypedDocumentNode<{ updateVenue: Venue }, { id: string; input: VenueInput }> = gql`
  mutation UpdateVenue($id: ID!, $input: UpdateVenueInput!) {
    updateVenue(id: $id, input: $input) {
      ...VenueFields
    }
  }
  ${VENUE_FIELDS}
`;

// Testimonials

export type Video = {
  id: string;
  status: VideoStatus;
  durationSeconds: number | null;
  playbackUrl: string | null;
  posterUrl: string | null;
};

export type Testimonial = {
  id: string;
  status: TestimonialStatus;
  rating: number | null;
  text: string | null;
  approvedForUse: boolean;
  blurFace: boolean;
  withdrawnAt: string | null;
  publishableIn: ConsentPurpose[];
  createdAt: string;
  videoUrl: string | null;
  video: Video | null;
  user: { id: string; name: string; email: string | null; phone: string | null };
  visit: { id: string; visitDate: string } | null;
  campaign: { id: string; name: string } | null;
};

const TESTIMONIAL_FIELDS = gql`
  fragment TestimonialFields on Testimonial {
    id
    status
    rating
    text
    approvedForUse
    blurFace
    withdrawnAt
    publishableIn
    createdAt
    videoUrl
    video {
      id
      status
      durationSeconds
      playbackUrl
      posterUrl
    }
    user {
      id
      name
      email
      phone
    }
    visit {
      id
      visitDate
    }
    campaign {
      id
      name
    }
  }
`;

export const TESTIMONIALS: TypedDocumentNode<
  { testimonials: Testimonial[] },
  { venueId: string; status?: TestimonialStatus | null; page: number; size: number }
> = gql`
  query Testimonials($venueId: ID!, $status: TestimonialStatus, $page: Int, $size: Int) {
    testimonials(venueId: $venueId, status: $status, page: $page, size: $size) {
      ...TestimonialFields
    }
  }
  ${TESTIMONIAL_FIELDS}
`;

// Asked for again when a video is opened, so its signed URLs are fresh.
export const TESTIMONIAL: TypedDocumentNode<{ testimonial: Testimonial | null }, { id: string }> = gql`
  query Testimonial($id: ID!) {
    testimonial(id: $id) {
      ...TestimonialFields
    }
  }
  ${TESTIMONIAL_FIELDS}
`;

export type TestimonialCounts = { pending: number; approved: number; rejected: number };

export const TESTIMONIAL_COUNTS: TypedDocumentNode<
  { testimonialCounts: TestimonialCounts },
  { venueId: string }
> = gql`
  query TestimonialCounts($venueId: ID!) {
    testimonialCounts(venueId: $venueId) {
      pending
      approved
      rejected
    }
  }
`;

export const UPDATE_TESTIMONIAL_STATUS: TypedDocumentNode<
  { updateTestimonialStatus: Pick<Testimonial, 'id' | 'status' | 'approvedForUse'> },
  { id: string; status: TestimonialStatus }
> = gql`
  mutation UpdateTestimonialStatus($id: ID!, $status: TestimonialStatus!) {
    updateTestimonialStatus(id: $id, status: $status) {
      id
      status
      approvedForUse
    }
  }
`;

export const APPROVE_FOR_USE: TypedDocumentNode<
  { approveTestimonialForUse: Pick<Testimonial, 'id' | 'approvedForUse'> & { __typename?: 'Testimonial' } },
  { id: string; approved: boolean }
> = gql`
  mutation ApproveTestimonialForUse($id: ID!, $approved: Boolean!) {
    approveTestimonialForUse(id: $id, approved: $approved) {
      id
      approvedForUse
    }
  }
`;

export const DELETE_TESTIMONIAL: TypedDocumentNode<{ deleteTestimonial: boolean }, { id: string }> = gql`
  mutation DeleteTestimonial($id: ID!) {
    deleteTestimonial(id: $id)
  }
`;

// Visits

export type Visit = {
  id: string;
  visitDate: string;
  amountRial: number | null;
  notificationSent: boolean;
  user: { id: string; name: string; email: string | null; phone: string | null };
  campaign: { id: string; name: string } | null;
  testimonial: { id: string; status: TestimonialStatus } | null;
};

const VISIT_FIELDS = gql`
  fragment VisitFields on Visit {
    id
    visitDate
    amountRial
    notificationSent
    user {
      id
      name
      email
      phone
    }
    campaign {
      id
      name
    }
    testimonial {
      id
      status
    }
  }
`;

export const VISITS: TypedDocumentNode<{ visits: Visit[] }, { venueId: string; page: number; size: number }> = gql`
  query Visits($venueId: ID!, $page: Int, $size: Int) {
    visits(venueId: $venueId, page: $page, size: $size) {
      ...VisitFields
    }
  }
  ${VISIT_FIELDS}
`;

export type CreateVisitInput = {
  venueId: string;
  visitDate: string;
  campaignId?: string | null;
  visitor: { name: string; email: string; phone?: string | null };
};

export const CREATE_VISIT: TypedDocumentNode<{ createVisit: Visit }, { input: CreateVisitInput }> = gql`
  mutation CreateVisit($input: CreateVisitInput!) {
    createVisit(input: $input) {
      ...VisitFields
    }
  }
  ${VISIT_FIELDS}
`;

export const ISSUE_VISIT_TOKEN: TypedDocumentNode<
  { issueVisitToken: { token: string; expiresAt: string } },
  { visitId: string }
> = gql`
  mutation IssueVisitToken($visitId: ID!) {
    issueVisitToken(visitId: $visitId) {
      token
      expiresAt
    }
  }
`;

export const DELETE_VISIT: TypedDocumentNode<{ deleteVisit: boolean }, { id: string }> = gql`
  mutation DeleteVisit($id: ID!) {
    deleteVisit(id: $id)
  }
`;

// Campaigns and notification templates

export type NotificationTemplate = {
  id: string;
  title: string;
  message: string;
  incentive: string | null;
  callToAction: string;
  linkExpiration: number | null;
};

const TEMPLATE_FIELDS = gql`
  fragment TemplateFields on NotificationTemplate {
    id
    title
    message
    incentive
    callToAction
    linkExpiration
  }
`;

export const TEMPLATES: TypedDocumentNode<
  { notificationTemplates: NotificationTemplate[] },
  { venueId: string; size: number }
> = gql`
  query NotificationTemplates($venueId: ID!, $size: Int) {
    notificationTemplates(venueId: $venueId, size: $size) {
      ...TemplateFields
    }
  }
  ${TEMPLATE_FIELDS}
`;

export type TemplateInput = Omit<NotificationTemplate, 'id'>;

export const CREATE_TEMPLATE: TypedDocumentNode<
  { createNotificationTemplate: NotificationTemplate },
  { input: TemplateInput & { venueId: string } }
> = gql`
  mutation CreateNotificationTemplate($input: CreateNotificationTemplateInput!) {
    createNotificationTemplate(input: $input) {
      ...TemplateFields
    }
  }
  ${TEMPLATE_FIELDS}
`;

export const UPDATE_TEMPLATE: TypedDocumentNode<
  { updateNotificationTemplate: NotificationTemplate },
  { id: string; input: Partial<TemplateInput> }
> = gql`
  mutation UpdateNotificationTemplate($id: ID!, $input: UpdateNotificationTemplateInput!) {
    updateNotificationTemplate(id: $id, input: $input) {
      ...TemplateFields
    }
  }
  ${TEMPLATE_FIELDS}
`;

export const DELETE_TEMPLATE: TypedDocumentNode<{ deleteNotificationTemplate: boolean }, { id: string }> = gql`
  mutation DeleteNotificationTemplate($id: ID!) {
    deleteNotificationTemplate(id: $id)
  }
`;

export type Campaign = {
  id: string;
  name: string;
  description: string | null;
  active: boolean;
  startDate: string;
  endDate: string | null;
  notificationTemplate: { id: string; title: string };
};

const CAMPAIGN_FIELDS = gql`
  fragment CampaignFields on Campaign {
    id
    name
    description
    active
    startDate
    endDate
    notificationTemplate {
      id
      title
    }
  }
`;

export const CAMPAIGNS: TypedDocumentNode<
  { campaigns: Campaign[] },
  { venueId: string; active?: boolean | null; size: number }
> = gql`
  query Campaigns($venueId: ID!, $active: Boolean, $size: Int) {
    campaigns(venueId: $venueId, active: $active, size: $size) {
      ...CampaignFields
    }
  }
  ${CAMPAIGN_FIELDS}
`;

export type CampaignInput = {
  name: string;
  description: string | null;
  notificationTemplateId: string;
  startDate: string;
  endDate: string | null;
  active: boolean;
};

export const CREATE_CAMPAIGN: TypedDocumentNode<
  { createCampaign: Campaign },
  { input: CampaignInput & { venueId: string } }
> = gql`
  mutation CreateCampaign($input: CreateCampaignInput!) {
    createCampaign(input: $input) {
      ...CampaignFields
    }
  }
  ${CAMPAIGN_FIELDS}
`;

export const UPDATE_CAMPAIGN: TypedDocumentNode<
  { updateCampaign: Campaign },
  { id: string; input: Partial<CampaignInput> }
> = gql`
  mutation UpdateCampaign($id: ID!, $input: UpdateCampaignInput!) {
    updateCampaign(id: $id, input: $input) {
      ...CampaignFields
    }
  }
  ${CAMPAIGN_FIELDS}
`;

export const DELETE_CAMPAIGN: TypedDocumentNode<{ deleteCampaign: boolean }, { id: string }> = gql`
  mutation DeleteCampaign($id: ID!) {
    deleteCampaign(id: $id)
  }
`;

// Members and consents

export type ConsentPurpose =
  | 'CLUB_MEMBERSHIP'
  | 'MARKETING_SMS'
  | 'TESTIMONIAL_RECORDING'
  | 'PUBLISH_IN_CLINIC'
  | 'PUBLISH_ON_WEBSITE'
  | 'PUBLISH_ON_SOCIAL_MEDIA';
export type ConsentMethod = 'MEMBER_APP' | 'STAFF_RECORDED' | 'VISIT_LINK';

export type Consent = {
  purpose: ConsentPurpose;
  granted: boolean;
  textVersion: string;
  method: ConsentMethod;
  recordedAt: string;
};

export type ConsentInput = { purpose: ConsentPurpose; granted: boolean; textVersion: string; text: string };

const CONSENT_FIELDS = gql`
  fragment ConsentFields on Consent {
    purpose
    granted
    textVersion
    method
    recordedAt
  }
`;

export type MemberSummary = {
  id: string;
  name: string | null;
  mobile: string | null;
  memberSince: string | null;
  pointsBalance: number;
  createdAt: string;
};

const MEMBER_SUMMARY = gql`
  fragment MemberSummary on Member {
    id
    name
    mobile
    memberSince
    pointsBalance
    createdAt
  }
`;

export const MEMBERS: TypedDocumentNode<
  { members: MemberSummary[] },
  { organizationId: string; search?: string | null; page: number; size: number }
> = gql`
  query Members($organizationId: ID, $search: String, $page: Int, $size: Int) {
    members(organizationId: $organizationId, search: $search, page: $page, size: $size) {
      ...MemberSummary
    }
  }
  ${MEMBER_SUMMARY}
`;

export type PointKind =
  | 'VISIT'
  | 'SPEND'
  | 'REFERRAL_REFERRER'
  | 'REFERRAL_FRIEND'
  | 'TESTIMONIAL'
  | 'REDEMPTION'
  | 'REDEMPTION_CANCELLED'
  | 'ADJUSTMENT';

export type PointEntry = { id: string; points: number; kind: PointKind; note: string | null; createdAt: string };

export type Redemption = {
  id: string;
  points: number;
  status: 'REDEEMED' | 'CANCELLED';
  createdAt: string;
  cancelledAt: string | null;
  reward: { id: string; name: string };
};

const REDEMPTION_FIELDS = gql`
  fragment RedemptionFields on Redemption {
    id
    points
    status
    createdAt
    cancelledAt
    reward {
      id
      name
    }
  }
`;

export type MemberDetail = MemberSummary & {
  email: string | null;
  consents: Consent[];
  consentHistory: Consent[];
  pointEntries: PointEntry[];
  redemptions: Redemption[];
  referralCode: string | null;
  referrals: { pending: number; qualified: number };
};

export const MEMBER: TypedDocumentNode<{ member: MemberDetail | null }, { id: string; size: number }> = gql`
  query Member($id: ID!, $size: Int) {
    member(id: $id) {
      ...MemberSummary
      email
      consents {
        ...ConsentFields
      }
      consentHistory {
        ...ConsentFields
      }
      pointEntries(size: $size) {
        id
        points
        kind
        note
        createdAt
      }
      redemptions(size: $size) {
        ...RedemptionFields
      }
      referralCode
      referrals {
        pending
        qualified
      }
    }
  }
  ${MEMBER_SUMMARY}
  ${CONSENT_FIELDS}
  ${REDEMPTION_FIELDS}
`;

export const INVITE_MEMBER: TypedDocumentNode<
  { inviteMember: MemberSummary },
  { input: { organizationId: string; mobile: string; name: string } }
> = gql`
  mutation InviteMember($input: InviteMemberInput!) {
    inviteMember(input: $input) {
      ...MemberSummary
    }
  }
  ${MEMBER_SUMMARY}
`;

export const RECORD_MEMBER_CONSENTS: TypedDocumentNode<
  { recordMemberConsents: Consent[] },
  { memberId: string; consents: ConsentInput[] }
> = gql`
  mutation RecordMemberConsents($memberId: ID!, $consents: [ConsentInput!]!) {
    recordMemberConsents(memberId: $memberId, consents: $consents) {
      ...ConsentFields
    }
  }
  ${CONSENT_FIELDS}
`;

// Loyalty

export type CheckInResult = {
  visit: { id: string; visitDate: string; amountRial: number | null };
  pointsEarned: number;
  balance: number;
};

export const CHECK_IN: TypedDocumentNode<
  { checkIn: CheckInResult },
  { input: { venueId: string; memberId: string; amountRial: number | null } }
> = gql`
  mutation CheckIn($input: CheckInInput!) {
    checkIn(input: $input) {
      visit {
        id
        visitDate
        amountRial
      }
      pointsEarned
      balance
    }
  }
`;

export const REDEEM_REWARD: TypedDocumentNode<
  { redeemReward: Redemption },
  { input: { venueId: string; memberId: string; rewardId: string } }
> = gql`
  mutation RedeemReward($input: RedeemRewardInput!) {
    redeemReward(input: $input) {
      ...RedemptionFields
    }
  }
  ${REDEMPTION_FIELDS}
`;

export const CANCEL_REDEMPTION: TypedDocumentNode<{ cancelRedemption: Redemption }, { id: string }> = gql`
  mutation CancelRedemption($id: ID!) {
    cancelRedemption(id: $id) {
      ...RedemptionFields
    }
  }
  ${REDEMPTION_FIELDS}
`;

export const ADJUST_POINTS: TypedDocumentNode<
  { adjustPoints: PointEntry },
  { memberId: string; points: number; note: string }
> = gql`
  mutation AdjustPoints($memberId: ID!, $points: Int!, $note: String!) {
    adjustPoints(memberId: $memberId, points: $points, note: $note) {
      id
      points
      kind
      note
      createdAt
    }
  }
`;

export type LoyaltyProgram = {
  pointsPerVisit: number;
  spendUnitRial: number;
  pointsPerSpendUnit: number;
  referrerPoints: number;
  friendPoints: number;
  testimonialPoints: number;
};

export type Reward = {
  id: string;
  name: string;
  description: string | null;
  pointsCost: number;
  active: boolean;
};

const REWARD_FIELDS = gql`
  fragment RewardFields on Reward {
    id
    name
    description
    pointsCost
    active
  }
`;

const PROGRAM_FIELDS = gql`
  fragment ProgramFields on LoyaltyProgram {
    pointsPerVisit
    spendUnitRial
    pointsPerSpendUnit
    referrerPoints
    friendPoints
    testimonialPoints
  }
`;

export const LOYALTY: TypedDocumentNode<
  { organization: { id: string; loyaltyProgram: LoyaltyProgram; rewards: Reward[] } | null },
  { organizationId: string; includeInactive: boolean }
> = gql`
  query Loyalty($organizationId: ID!, $includeInactive: Boolean) {
    organization(id: $organizationId) {
      id
      loyaltyProgram {
        ...ProgramFields
      }
      rewards(includeInactive: $includeInactive) {
        ...RewardFields
      }
    }
  }
  ${PROGRAM_FIELDS}
  ${REWARD_FIELDS}
`;

export const UPDATE_LOYALTY_PROGRAM: TypedDocumentNode<
  { updateLoyaltyProgram: LoyaltyProgram },
  { organizationId: string; input: Partial<LoyaltyProgram> }
> = gql`
  mutation UpdateLoyaltyProgram($organizationId: ID, $input: LoyaltyProgramInput!) {
    updateLoyaltyProgram(organizationId: $organizationId, input: $input) {
      ...ProgramFields
    }
  }
  ${PROGRAM_FIELDS}
`;

export type RewardInput = { name: string; description: string | null; pointsCost: number };

export const CREATE_REWARD: TypedDocumentNode<
  { createReward: Reward },
  { input: RewardInput & { organizationId: string } }
> = gql`
  mutation CreateReward($input: CreateRewardInput!) {
    createReward(input: $input) {
      ...RewardFields
    }
  }
  ${REWARD_FIELDS}
`;

export const UPDATE_REWARD: TypedDocumentNode<
  { updateReward: Reward },
  { id: string; input: Partial<RewardInput> & { active?: boolean } }
> = gql`
  mutation UpdateReward($id: ID!, $input: UpdateRewardInput!) {
    updateReward(id: $id, input: $input) {
      ...RewardFields
    }
  }
  ${REWARD_FIELDS}
`;

// Club settings

export type OrganizationSettings = OrganizationSummary & { countryCode: string };

export const ORGANIZATION: TypedDocumentNode<{ organization: OrganizationSettings | null }, { id: string }> = gql`
  query Organization($id: ID!) {
    organization(id: $id) {
      ...OrganizationSummary
      countryCode
    }
  }
  ${ORGANIZATION_SUMMARY}
`;

export const UPDATE_ORGANIZATION: TypedDocumentNode<
  { updateOrganization: OrganizationSettings },
  { id: string; input: { name?: string; locale?: string; timeZone?: string } }
> = gql`
  mutation UpdateOrganization($id: ID!, $input: UpdateOrganizationInput!) {
    updateOrganization(id: $id, input: $input) {
      ...OrganizationSummary
      countryCode
    }
  }
  ${ORGANIZATION_SUMMARY}
`;

export const SET_ORGANIZATION_MODULE: TypedDocumentNode<
  { setOrganizationModule: OrganizationSummary },
  { organizationId: string; module: ClubModule; enabled: boolean }
> = gql`
  mutation SetOrganizationModule($organizationId: ID!, $module: ClubModule!, $enabled: Boolean!) {
    setOrganizationModule(organizationId: $organizationId, module: $module, enabled: $enabled) {
      ...OrganizationSummary
    }
  }
  ${ORGANIZATION_SUMMARY}
`;

// Integrations

export type ApiKey = {
  id: string;
  name: string;
  prefix: string;
  createdAt: string;
  lastUsedAt: string | null;
  revokedAt: string | null;
};

export type WebhookDelivery = {
  id: string;
  eventId: string;
  eventType: string;
  attempts: number;
  lastStatus: number | null;
  lastError: string | null;
  deliveredAt: string | null;
  failedAt: string | null;
  nextAttemptAt: string;
  createdAt: string;
};

export type WebhookEndpoint = {
  id: string;
  url: string;
  events: string[];
  active: boolean;
  createdAt: string;
  recentDeliveries: WebhookDelivery[];
};

const API_KEY_FIELDS = gql`
  fragment ApiKeyFields on ApiKey {
    id
    name
    prefix
    createdAt
    lastUsedAt
    revokedAt
  }
`;

const WEBHOOK_FIELDS = gql`
  fragment WebhookFields on WebhookEndpoint {
    id
    url
    events
    active
    createdAt
    recentDeliveries(limit: 10) {
      id
      eventId
      eventType
      attempts
      lastStatus
      lastError
      deliveredAt
      failedAt
      nextAttemptAt
      createdAt
    }
  }
`;

export const INTEGRATIONS: TypedDocumentNode<
  { organization: { id: string; apiKeys: ApiKey[]; webhookEndpoints: WebhookEndpoint[] } | null },
  { organizationId: string }
> = gql`
  query Integrations($organizationId: ID!) {
    organization(id: $organizationId) {
      id
      apiKeys {
        ...ApiKeyFields
      }
      webhookEndpoints {
        ...WebhookFields
      }
    }
  }
  ${API_KEY_FIELDS}
  ${WEBHOOK_FIELDS}
`;

export const CREATE_API_KEY: TypedDocumentNode<
  { createApiKey: { apiKey: ApiKey; key: string } },
  { organizationId: string; name: string }
> = gql`
  mutation CreateApiKey($organizationId: ID, $name: String!) {
    createApiKey(organizationId: $organizationId, name: $name) {
      apiKey {
        ...ApiKeyFields
      }
      key
    }
  }
  ${API_KEY_FIELDS}
`;

export const REVOKE_API_KEY: TypedDocumentNode<{ revokeApiKey: ApiKey }, { id: string }> = gql`
  mutation RevokeApiKey($id: ID!) {
    revokeApiKey(id: $id) {
      ...ApiKeyFields
    }
  }
  ${API_KEY_FIELDS}
`;

export const CREATE_WEBHOOK_ENDPOINT: TypedDocumentNode<
  { createWebhookEndpoint: { endpoint: WebhookEndpoint; secret: string } },
  { input: { organizationId: string; url: string; events: string[] } }
> = gql`
  mutation CreateWebhookEndpoint($input: CreateWebhookEndpointInput!) {
    createWebhookEndpoint(input: $input) {
      endpoint {
        ...WebhookFields
      }
      secret
    }
  }
  ${WEBHOOK_FIELDS}
`;

export const UPDATE_WEBHOOK_ENDPOINT: TypedDocumentNode<
  { updateWebhookEndpoint: WebhookEndpoint },
  { id: string; input: { url?: string; events?: string[]; active?: boolean } }
> = gql`
  mutation UpdateWebhookEndpoint($id: ID!, $input: UpdateWebhookEndpointInput!) {
    updateWebhookEndpoint(id: $id, input: $input) {
      ...WebhookFields
    }
  }
  ${WEBHOOK_FIELDS}
`;

export const DELETE_WEBHOOK_ENDPOINT: TypedDocumentNode<{ deleteWebhookEndpoint: boolean }, { id: string }> = gql`
  mutation DeleteWebhookEndpoint($id: ID!) {
    deleteWebhookEndpoint(id: $id)
  }
`;
