/**
 * BT01 Storm Unified Tests (Vitest Runner)
 */

import { runUnifiedModule } from '../../helpers/vitest-adapter';
import { BT01StormModule } from '../../../src/logic/cardTests/shared/BT01Storm';

runUnifiedModule(BT01StormModule);
