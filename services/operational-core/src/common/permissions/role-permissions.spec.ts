import { Role } from '@prisma/client';
import { PERMISSIONS } from './permission';
import { ROLE_PERMISSIONS } from './role-permissions';

// Platform Remediation PEP-3 (WP-3.0 — Permission Constants Foundation).
// These tests cover only the new permission constants and their role
// mappings added by WP-3.0. No controller, guard, or decorator is touched
// or exercised here — that is WP-3.1/3.2/3.3's scope, not this one's.
describe('PEP-3 WP-3.0 permission foundation', () => {
  const NEW_PERMISSIONS = [
    'integration.sync',
    'integration.deadLetters.read',
    'integration.deadLetters.resolve',
    'parts.create',
    'parts.matchCandidates.manage',
    'vehicle.create',
    'vehicle.correct',
  ] as const;

  // Exact mapping table from
  // docs/governance/DGX3_PLATFORM_REMEDIATION_TECHNICAL_SPECIFICATION_1.md
  // §4 (PRTS-003) — every role each permission must be granted to, and by
  // implication every role it must NOT be granted to.
  const EXPECTED_GRANTS: Record<(typeof NEW_PERMISSIONS)[number], Role[]> = {
    'integration.sync': [Role.SYSTEM_ADMINISTRATOR, Role.OWNER],
    'integration.deadLetters.read': [Role.SYSTEM_ADMINISTRATOR, Role.OWNER, Role.DATA_QUALITY_REVIEWER],
    'integration.deadLetters.resolve': [Role.SYSTEM_ADMINISTRATOR, Role.OWNER, Role.DATA_QUALITY_REVIEWER],
    'parts.create': [Role.SYSTEM_ADMINISTRATOR, Role.OWNER, Role.PARTS_MANAGER, Role.STOREKEEPER],
    'parts.matchCandidates.manage': [Role.SYSTEM_ADMINISTRATOR, Role.OWNER, Role.PARTS_MANAGER],
    'vehicle.create': [Role.SYSTEM_ADMINISTRATOR, Role.OWNER, Role.BRANCH_MANAGER, Role.PARTS_MANAGER],
    'vehicle.correct': [Role.SYSTEM_ADMINISTRATOR, Role.OWNER, Role.BRANCH_MANAGER, Role.PARTS_MANAGER],
  };

  describe('permission constants exist', () => {
    it.each(NEW_PERMISSIONS)('%s is present in PERMISSIONS', (permission) => {
      expect(PERMISSIONS).toContain(permission);
    });
  });

  describe('no duplicate permission constants', () => {
    it('PERMISSIONS contains no duplicate entries', () => {
      const unique = new Set(PERMISSIONS);
      expect(unique.size).toBe(PERMISSIONS.length);
    });

    it('none of the 7 new permissions collided with a pre-existing string', () => {
      const occurrences = (permission: string) => PERMISSIONS.filter((p) => p === permission).length;
      for (const permission of NEW_PERMISSIONS) {
        expect(occurrences(permission)).toBe(1);
      }
    });
  });

  describe('role mappings match the approved mapping table exactly', () => {
    for (const permission of NEW_PERMISSIONS) {
      const expectedRoles = EXPECTED_GRANTS[permission];

      it(`${permission} is granted to exactly [${expectedRoles.join(', ')}]`, () => {
        const actualRoles = (Object.keys(ROLE_PERMISSIONS) as Role[]).filter((role) =>
          ROLE_PERMISSIONS[role].includes(permission),
        );
        expect(actualRoles.sort()).toEqual([...expectedRoles].sort());
      });
    }

    it('no role array contains a duplicate of any new permission', () => {
      for (const role of Object.keys(ROLE_PERMISSIONS) as Role[]) {
        for (const permission of NEW_PERMISSIONS) {
          const count = ROLE_PERMISSIONS[role].filter((p) => p === permission).length;
          expect(count).toBeLessThanOrEqual(1);
        }
      }
    });

    it('GENERAL_MANAGER — deliberately excluded per the Technical Specification — has none of the 7 new permissions', () => {
      for (const permission of NEW_PERMISSIONS) {
        expect(ROLE_PERMISSIONS[Role.GENERAL_MANAGER]).not.toContain(permission);
      }
    });
  });

  describe('no unexpected change to pre-existing permission mappings', () => {
    it('SYSTEM_ADMINISTRATOR and OWNER still spread the full PERMISSIONS array (unchanged mechanism)', () => {
      expect(ROLE_PERMISSIONS[Role.SYSTEM_ADMINISTRATOR]).toEqual([...PERMISSIONS]);
      expect(ROLE_PERMISSIONS[Role.OWNER]).toEqual([...PERMISSIONS]);
    });

    it('a sample of pre-existing, untouched grants remains present and unchanged', () => {
      expect(ROLE_PERMISSIONS[Role.STOREKEEPER]).toEqual(
        expect.arrayContaining(['warehouse.read', 'inventory.read', 'inventory.adjust', 'purchases.read', 'sales.read']),
      );
      expect(ROLE_PERMISSIONS[Role.PARTS_MANAGER]).toEqual(expect.arrayContaining(['parts.read', 'parts.manage']));
      expect(ROLE_PERMISSIONS[Role.BRANCH_MANAGER]).toEqual(expect.arrayContaining(['customer.manage', 'inventory.adjust']));
      expect(ROLE_PERMISSIONS[Role.DATA_QUALITY_REVIEWER]).toEqual(
        expect.arrayContaining(['dataQuality.read', 'dataQuality.resolve']),
      );
    });

    it('roles entirely outside the mapping table (e.g. SALESPERSON, TECHNICIAN) have none of the 7 new permissions', () => {
      const uninvolvedRoles = [
        Role.LUBRICANTS_MANAGER,
        Role.PURCHASING_OFFICER,
        Role.PURCHASING_MANAGER,
        Role.SALESPERSON,
        Role.AUDITOR,
        Role.READ_ONLY_VIEWER,
        Role.GARAGE_MANAGER,
        Role.WORKSHOP_SUPERVISOR,
        Role.RECEPTION,
        Role.TECHNICIAN,
        Role.DIAGNOSTIC_TECHNICIAN,
        Role.QUALITY_INSPECTOR,
        Role.SERVICE_ADVISOR,
        Role.KNOWLEDGE_STEWARD,
      ];
      for (const role of uninvolvedRoles) {
        for (const permission of NEW_PERMISSIONS) {
          expect(ROLE_PERMISSIONS[role]).not.toContain(permission);
        }
      }
    });
  });
});
