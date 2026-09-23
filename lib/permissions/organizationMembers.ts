import type { OrganizationMemberDetail, OrganizationRole } from '@/lib/types/user'

/**
 * Wer die Aktion ausführen würde: Rolle des eingeloggten Users in der
 * Organisation (null z.B. für globale Admins ohne eigene Mitgliedschaft) und
 * ob das betroffene Mitglied der eingeloggte User selbst ist.
 */
export interface MemberActionActor {
  currentUserRole: OrganizationRole | null
  isSelf: boolean
}

/**
 * Einzige Quelle für die Frage "wer darf mit wem was machen" in der
 * Mitgliederverwaltung. Wird sowohl von der Desktop-Tabelle als auch von den
 * Mobile-Kacheln in app/admin/users/page.tsx verwendet, damit beide
 * Ansichten zwangsläufig dieselben Regeln zeigen.
 */
export function canPromoteToAdmin(member: OrganizationMemberDetail): boolean {
  return member.role === 'employee'
}

export function canDemoteToEmployee(
  member: OrganizationMemberDetail,
  { currentUserRole }: MemberActionActor,
): boolean {
  return member.role === 'admin' && currentUserRole === 'owner'
}

export function canTransferOwnership(
  member: OrganizationMemberDetail,
  { currentUserRole, isSelf }: MemberActionActor,
): boolean {
  return member.role !== 'owner' && currentUserRole === 'owner' && !isSelf
}

/**
 * Mitarbeiter dürfen von jedem Admin/Owner entfernt werden, Admins nur vom
 * Owner. Die Owner-Rolle und die eigene Mitgliedschaft sind nie entfernbar
 * (kein Selbst-Rauswurf über diesen Button).
 */
export function canRemoveMember(
  member: OrganizationMemberDetail,
  { currentUserRole, isSelf }: MemberActionActor,
): boolean {
  if (member.role === 'owner' || isSelf) return false
  return member.role === 'employee' || currentUserRole === 'owner'
}
