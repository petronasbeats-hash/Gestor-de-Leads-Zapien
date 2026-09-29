# Live Write Protocol V0.1

Scope: one synthetic canary only: LAB-YANG-07.

Sequence:
1. AUTH preflight.
2. Read property_core_lab_v01.
3. Build an already-proven atomic transition.
4. Write event + snapshot atomically.
5. Read both back immediately.
6. Verify both exist and match expected LAB identity/state.
7. Record evidence.
8. Roll back only the canary paths if the test is meant to leave no residue.

Hard stops:
- no authenticated user;
- unit is not LAB-YANG-07;
- any path outside property_core_lab_v01;
- readback missing;
- state/trace verification failure.

Never touch leads, propiedades, citas, citas_publicas or telefonos_index.
