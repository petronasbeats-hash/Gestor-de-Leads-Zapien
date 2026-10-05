#!/usr/bin/env python3
"""Read-only integrity check for Synapse/Habitat Firebase RTDB emulator."""
import json
import sys
import urllib.request

BASE = "http://127.0.0.1:9000"
NS = "demo-synapse-lab"

def read(path):
    url = f"{BASE}/{path}.json?ns={NS}"
    with urllib.request.urlopen(url, timeout=5) as response:
        value = json.load(response)
    return value if isinstance(value, dict) else {}

def main():
    try:
        leads, citas, slots, units = (read(p) for p in
            ("leads", "citas", "citas_publicas", "units"))
    except Exception as exc:
        print(f"ERROR: No se pudo leer el emulador: {exc}")
        return 2

    issues = []
    cita_by_slot = {}
    for cita_id, cita in citas.items():
        if not isinstance(cita, dict):
            issues.append(f"Cita {cita_id}: registro inválido")
            continue
        lead_id, unit_id = cita.get("leadId"), cita.get("unitId")
        if not lead_id or lead_id not in leads:
            issues.append(f"Cita {cita_id}: lead inexistente")
        if unit_id and unit_id not in units:
            issues.append(f"Cita {cita_id}: unidad inexistente")
        if not cita.get("fecha") or not cita.get("hora"):
            issues.append(f"Cita {cita_id}: fecha/hora incompletas")
            continue
        key = f'{cita["fecha"]}_{cita["hora"]}'
        cita_by_slot.setdefault(key, []).append((cita_id, cita))
        if cita.get("estado") not in ("cancelada",):
            slot = slots.get(key)
            if not isinstance(slot, dict):
                issues.append(f"Cita {cita_id}: horario {key} sin bloqueo")
            elif slot.get("unitId") != unit_id:
                issues.append(f"Cita {cita_id}: unidad distinta en bloqueo {key}")

    for key, slot in slots.items():
        linked = [(cid, c) for cid, c in cita_by_slot.get(key, [])
                  if c.get("estado") != "cancelada"]
        if not linked:
            issues.append(f"Horario {key}: ocupado sin cita activa")
        if len(linked) > 1:
            issues.append(f"Horario {key}: {len(linked)} citas activas (colisión)")

    print(f"Leads: {len(leads)} | Citas: {len(citas)} | Horarios ocupados: {len(slots)} | Unidades: {len(units)}")
    if issues:
        for issue in issues:
            print("ALERTA:", issue)
        return 1
    print("OK: sin inconsistencias detectadas en las relaciones comprobadas")
    print("NOTA: no prueba protección frente a reservas simultáneas.")
    return 0

if __name__ == "__main__":
    sys.exit(main())
