/**
 * BT05 Unified Tests (Vitest Runner)
 */

import { runUnifiedModule } from '../../helpers/vitest-adapter';
import { BT05Module } from '../../../src/logic/cardTests/shared/BT05';

runUnifiedModule(BT05Module);
