/**
 * BT01 Earth Unified Tests (Vitest Runner)
 */

import { runUnifiedModule } from '../../helpers/vitest-adapter';
import { BT01EarthModule } from '../../../src/logic/cardTests/shared/BT01Earth';

runUnifiedModule(BT01EarthModule);
