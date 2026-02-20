import { UnitZoneState } from '../types';

export function getOwnerOfZone(machine: any, zone: UnitZoneState): any {
    if (machine.state.players[0].unitZones.includes(zone)) return machine.state.players[0];
    if (machine.state.players[1].unitZones.includes(zone)) return machine.state.players[1];
    return null;
}

export function zoneHasKeyword(zone: UnitZoneState, keyword: string): boolean {
    if (!zone.unit) return false;
    if (zone.unit.keywords?.includes(keyword)) return true;
    if (zone.unit.effects?.some((effect: any) => (effect.description || '').includes(keyword))) return true;
    if (zone.items.some(item => item.keywords?.includes(keyword) || item.effects?.some((effect: any) => (effect.description || '').includes(keyword)))) return true;
    if (zone.temporaryEffects.some((effect: any) => (effect.description || '').includes(keyword))) return true;
    return false;
}

export function findItemLocation(machine: any, itemCard: any): { owner: any; zone: UnitZoneState; zoneIndex: number; itemIndex: number } | null {
    for (const owner of machine.state.players) {
        for (let zoneIndex = 0; zoneIndex < owner.unitZones.length; zoneIndex++) {
            const zone = owner.unitZones[zoneIndex];
            const itemIndex = zone.items.indexOf(itemCard);
            if (itemIndex !== -1) {
                return { owner, zone, zoneIndex, itemIndex };
            }
        }
    }
    return null;
}
