/**
 * BT01 Fire Unified Tests (Vitest Runner)
 * 
 * This file runs the shared unified tests using vitest.
 */

import { runUnifiedModule } from '../../helpers/vitest-adapter';
import { BT01FireModule } from '../../../src/logic/cardTests/shared/BT01Fire';

// Run all BT01 Fire tests
runUnifiedModule(BT01FireModule);
