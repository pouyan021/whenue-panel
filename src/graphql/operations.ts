import { gql, type TypedDocumentNode } from '@apollo/client';

// Hand-written types mirroring whenue-api's schema.graphqls, like whenue-app's.

export type StaffRole = 'ADMIN' | 'VENUE_STAFF';
export type TestimonialStatus = 'PENDING' | 'APPROVED' | 'REJECTED';
export type VideoStatus = 'UPLOADING' | 'UPLOADED' | 'QUEUED' | 'READY' | 'FAILED';

export type VenueSummary = { id: string; name: string };

export type Me = {
  id: string;
  email: string;
  role: StaffRole;
  venue: VenueSummary | null;
};

export const ME: TypedDocumentNode<{ me: Me | null }, Record<string, never>> = gql`
  query Me {
    me {
      id
      email
      role
      venue {
        id
        name
      }
    }
  }
`;

export const LOGIN: TypedDocumentNode<
  { login: { token: string; expiresAt: string; staff: Me } },
  { email: string; password: string }
> = gql`
  mutation Login($email: String!, $password: String!) {
    login(email: $email, password: $password) {
      token
      expiresAt
      staff {
        id
        email
        role
        venue {
          id
          name
        }
      }
    }
  }
`;

// Admins pick the venue they look at; venue staff only ever see their own.
export const VENUES: TypedDocumentNode<{ venues: VenueSummary[] }, { size: number }> = gql`
  query Venues($size: Int) {
    venues(size: $size) {
      id
      name
    }
  }
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
  createdAt: string;
  videoUrl: string | null;
  video: Video | null;
  user: { id: string; name: string; email: string };
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
  notificationSent: boolean;
  user: { id: string; name: string; email: string; phone: string | null };
  campaign: { id: string; name: string } | null;
  testimonial: { id: string; status: TestimonialStatus } | null;
};

const VISIT_FIELDS = gql`
  fragment VisitFields on Visit {
    id
    visitDate
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
