import { registerST01DebugScenarios } from './st01';
import { registerST02DebugScenarios } from './st02';
import { registerST03DebugScenarios } from './st03';
import { registerBT01DebugScenarios } from './bt01';

export function registerAllDebugScenarios(manager: any) {
    registerST01DebugScenarios(manager);
    registerST02DebugScenarios(manager);
    registerST03DebugScenarios(manager);
    registerBT01DebugScenarios(manager);
}
