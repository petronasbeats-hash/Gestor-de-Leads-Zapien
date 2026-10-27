'use strict';

const {
  buildRescheduleRequest
} = require('./reschedule-request.v1.cjs');

const ROOT_RE = /^bookingCore\/labLifecycleV04\/[A-Za-z0-9_-]+$/;

function createBookingLifecycleAdapter(db, rootPath) {
  if (!db || typeof db.ref !== 'function') {
    throw new TypeError('RTDB_REQUIRED');
  }

  if (!ROOT_RE.test(rootPath || '')) {
    throw new TypeError('LAB_ROOT_REQUIRED');
  }

  const root = db.ref(rootPath);

  async function reschedule(input) {
    const command = buildRescheduleRequest(input);
    const targetSlot = command.slot;

    await root.get();

    const result = await root.transaction(current => {
      if (current === null) return null;
      const state = current;
      const citas = state.citas || {};
      const slots = state.slots || {};
      const commands = state.commands || {};

      const previous = commands[command.commandId];

      if (previous) return;

      const cita = citas[command.citaId];

      if (!cita ||
          cita.version !== command.expectedVersion ||
          cita.slot !== command.expectedSlot ||
          slots[command.expectedSlot] !== command.citaId ||
          slots[targetSlot]) {
        return;
      }

      const nextVersion = cita.version + 1;

      const nextSlots = { ...slots };
      delete nextSlots[command.expectedSlot];
      nextSlots[targetSlot] = command.citaId;

      return {
        ...state,
        slots: nextSlots,
        citas: {
          ...citas,
          [command.citaId]: {
            ...cita,
            slot: targetSlot,
            version: nextVersion,
            historial: {
              ...(cita.historial || {}),
              [command.commandId]: {
                type: 'RESCHEDULE',
                from: command.expectedSlot,
                to: targetSlot,
                version: nextVersion
              }
            }
          }
        },
        commands: {
          ...commands,
          [command.commandId]: {
            type: 'RESCHEDULE',
            citaId: command.citaId,
            expectedSlot: command.expectedSlot,
            slot: targetSlot,
            expectedVersion: command.expectedVersion,
            resultingVersion: nextVersion
          }
        }
      };
    }, undefined, false);

    if (result.committed) {
      const committedState = result.snapshot.val();
      const committedCita =
        committedState?.citas?.[command.citaId];
      const committedCommand =
        committedState?.commands?.[command.commandId];

      if (
        !committedCita ||
        !committedCommand ||
        committedCommand.type !== 'RESCHEDULE' ||
        committedCommand.citaId !== command.citaId ||
        committedCommand.expectedSlot !== command.expectedSlot ||
        committedCommand.slot !== targetSlot ||
        committedCommand.expectedVersion !== command.expectedVersion ||
        committedCommand.resultingVersion !== command.expectedVersion + 1 ||
        committedCita.slot !== targetSlot ||
        committedCita.version !== command.expectedVersion + 1 ||
        committedState.slots?.[targetSlot] !== command.citaId
      ) {
        throw new Error('RESCHEDULE_CONFLICT');
      }

      return Object.freeze({
        applied: true,
        citaId: command.citaId,
        slot: targetSlot,
        version: command.expectedVersion + 1
      });
    }

    const state = result.snapshot.val() || {};
    const previous = state.commands?.[command.commandId];

    if (previous) {
      const same =
        previous.type === 'RESCHEDULE' &&
        previous.citaId === command.citaId &&
        previous.expectedSlot === command.expectedSlot &&
        previous.slot === targetSlot &&
        previous.expectedVersion === command.expectedVersion;

      if (!same) {
        throw new Error('COMMAND_ID_CONFLICT');
      }

      return Object.freeze({
        applied: false,
        citaId: command.citaId,
        slot: targetSlot,
        version: previous.resultingVersion
      });
    }

    throw new Error('RESCHEDULE_CONFLICT');
  }

  return Object.freeze({ reschedule });
}

module.exports = Object.freeze({
  createBookingLifecycleAdapter
});
