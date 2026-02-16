/**
 * ST05 Unified Tests (Vitest Runner)
 */

import { runUnifiedModule } from '../../helpers/vitest-adapter';
import { ST05Module } from '../../../src/logic/cardTests/shared/ST05';

runUnifiedModule(ST05Module);
