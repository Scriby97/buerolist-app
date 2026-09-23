import { describe, it, expect } from 'vitest'
import {
  canPromoteToAdmin,
  canDemoteToEmployee,
  canTransferOwnership,
  canRemoveMember,
} from './organizationMembers'
import type { OrganizationMemberDetail, OrganizationRole } from '@/lib/types/user'

const member = (role: OrganizationRole): OrganizationMemberDetail =>
  ({ role }) as OrganizationMemberDetail

describe('canPromoteToAdmin', () => {
  it('is true only for employees', () => {
    expect(canPromoteToAdmin(member('employee'))).toBe(true)
    expect(canPromoteToAdmin(member('admin'))).toBe(false)
    expect(canPromoteToAdmin(member('owner'))).toBe(false)
  })
})

describe('canDemoteToEmployee', () => {
  it('lets the owner demote an admin', () => {
    expect(
      canDemoteToEmployee(member('admin'), { currentUserRole: 'owner', isSelf: false }),
    ).toBe(true)
  })

  it('does not let an admin demote another admin', () => {
    expect(
      canDemoteToEmployee(member('admin'), { currentUserRole: 'admin', isSelf: false }),
    ).toBe(false)
  })

  it('cannot demote an employee (not admin) or the owner', () => {
    expect(
      canDemoteToEmployee(member('employee'), { currentUserRole: 'owner', isSelf: false }),
    ).toBe(false)
    expect(
      canDemoteToEmployee(member('owner'), { currentUserRole: 'owner', isSelf: false }),
    ).toBe(false)
  })
})

describe('canTransferOwnership', () => {
  it('lets the owner transfer to an admin or employee', () => {
    expect(
      canTransferOwnership(member('admin'), { currentUserRole: 'owner', isSelf: false }),
    ).toBe(true)
    expect(
      canTransferOwnership(member('employee'), { currentUserRole: 'owner', isSelf: false }),
    ).toBe(true)
  })

  it('cannot transfer to the current owner themselves', () => {
    expect(
      canTransferOwnership(member('owner'), { currentUserRole: 'owner', isSelf: false }),
    ).toBe(false)
  })

  it('cannot transfer to yourself', () => {
    expect(
      canTransferOwnership(member('admin'), { currentUserRole: 'owner', isSelf: true }),
    ).toBe(false)
  })

  it('an admin (not owner) can never transfer ownership', () => {
    expect(
      canTransferOwnership(member('employee'), { currentUserRole: 'admin', isSelf: false }),
    ).toBe(false)
  })
})

describe('canRemoveMember', () => {
  it('lets any admin or owner remove an employee', () => {
    expect(
      canRemoveMember(member('employee'), { currentUserRole: 'admin', isSelf: false }),
    ).toBe(true)
    expect(
      canRemoveMember(member('employee'), { currentUserRole: 'owner', isSelf: false }),
    ).toBe(true)
  })

  it('lets only the owner remove an admin', () => {
    expect(
      canRemoveMember(member('admin'), { currentUserRole: 'owner', isSelf: false }),
    ).toBe(true)
    expect(
      canRemoveMember(member('admin'), { currentUserRole: 'admin', isSelf: false }),
    ).toBe(false)
  })

  it('never allows removing the owner', () => {
    expect(
      canRemoveMember(member('owner'), { currentUserRole: 'owner', isSelf: false }),
    ).toBe(false)
  })

  it('never allows removing yourself, regardless of role', () => {
    expect(
      canRemoveMember(member('employee'), { currentUserRole: 'owner', isSelf: true }),
    ).toBe(false)
    expect(
      canRemoveMember(member('admin'), { currentUserRole: 'owner', isSelf: true }),
    ).toBe(false)
  })
})
