export interface Organization {
  id: string
  name: string
  subdomain?: string
  contactEmail?: string
  // Öffentliche URL des Firmenlogos (Supabase Storage). null/undefined = kein
  // Logo gewählt, das Frontend zeigt dann einen Initialen-Avatar.
  logoUrl?: string | null
  isActive: boolean
  // Gesetzt, wenn der Owner die Organisation selbst zur Löschung freigegeben
  // hat (Soft-Delete, null/undefined = aktiv). Nur für die Admin-Übersicht relevant.
  deletionRequestedAt?: string | null
  createdAt: string
  updatedAt: string
  // Nur von GET /organizations (Admin-Übersicht) mitgeliefert.
  subscription?: {
    tier: SubscriptionTier
    status: SubscriptionStatus
    currentPeriodEnd?: string
  } | null
  owner?: { email: string; name?: string } | null
}

export type OrganizationRole = 'employee' | 'admin' | 'owner'
export type SubscriptionTier = 'free' | 'pro'
export type SubscriptionStatus = 'active' | 'past_due' | 'canceled'

export interface OrganizationMembership {
  id: string
  userId: string
  organizationId: string
  organization?: Organization
  role: OrganizationRole
  joinedAt: string
}

// Mitgliederliste inkl. verknüpftem User (Backend liefert
// OrganizationMemberEntity mit relations: ['user']) - für die
// Mitglieder-Verwaltung (Rolle ändern, Owner-Übergabe) im User-Management.
export interface OrganizationMemberDetail {
  id: string
  userId: string
  organizationId: string
  role: OrganizationRole
  joinedAt: string
  user: {
    id: string
    email: string
    firstName?: string
    lastName?: string
  }
}

export interface SubscriptionLimits {
  maxProjects: number | null
  maxMembers: number | null
  priceChf: number
}

export interface OrganizationSubscription {
  id: string
  organizationId: string
  tier: SubscriptionTier
  status: SubscriptionStatus
  currentPeriodStart?: string
  currentPeriodEnd?: string
  canceledAt?: string
  // Nur gesetzt, sobald einmal eine Stripe-Subscription bestand (nie beim
  // reinen Free-Tarif) - steuert im Frontend, ob der Link zum
  // Stripe Customer Portal (Rechnungen/Zahlungsmethode) angezeigt wird.
  stripeCustomerId?: string
  createdAt: string
  updatedAt: string
  limits?: SubscriptionLimits
  // true, wenn die Organisation aktuell mehr aktive Projekte oder Mitarbeiter
  // hat, als der kostenlose Free-Tarif erlaubt - steuert die verschärfte
  // Kündigungswarnung (Kündigen trennt in diesem Fall alle Mitgliedschaften).
  overFreeLimit?: boolean
}

// Antwort von PATCH /organizations/:id/subscription - bei einem Upgrade vom
// kostenlosen Free-Tarif liefert der Server statt der aktualisierten
// Subscription eine Stripe-Checkout-URL, zu der weitergeleitet werden muss
// (die Subscription selbst aendert sich erst nach erfolgreicher Zahlung).
export interface UpdateOrganizationSubscriptionResponse extends OrganizationSubscription {
  checkoutUrl?: string | null
}

export interface PendingInvite {
  token: string
  role: OrganizationRole
  organization: {
    id: string
    name: string
  }
  expiresAt: string
}

export interface User {
  id: string
  email: string
  // Globale, funktionale Rolle - nur diese zwei Werte existieren serverseitig.
  // "administrator" ist ausschliesslich für Entwickler-Accounts gedacht (kann
  // organisationsübergreifend auf alle Daten zugreifen); es gibt keine
  // separate "super_admin"-Stufe.
  role: 'user' | 'administrator'
  organizationId: string | null
  organization: Organization | null
  organizationMemberships?: OrganizationMembership[]
  firstName?: string
  lastName?: string
  name?: string
}

export interface InviteEntity {
  id: string
  token: string
  email: string
  role: OrganizationRole
  expiresAt: string
  usedAt: string | null
  usedBy: string | null
  invitedBy: string
  createdAt: string
  organizationId: string
}

export interface SelfServiceOrganizationRequest {
  name: string
  subdomain?: string
  contactEmail?: string
  tier: SubscriptionTier
}

export interface SelfServiceOrganizationResponse {
  // null when checkoutUrl is set: for a paid tier, the organization isn't created
  // yet - it only gets created once the Stripe payment succeeds (webhook).
  organization: Organization | null
  subscription: OrganizationSubscription | null
  checkoutUrl: string | null
}

export type InviteStatus = 'used' | 'pending' | 'expired'
