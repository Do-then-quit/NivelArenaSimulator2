/**
 * BT06 Unified Tests (Vitest Runner)
 */

import { runUnifiedModule } from '../../helpers/vitest-adapter';
import { BT06Module } from '../../../src/logic/cardTests/shared/BT06';

runUnifiedModule(BT06Module);
