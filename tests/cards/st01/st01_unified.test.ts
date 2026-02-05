/**
 * ST01 Unified Tests (Vitest Runner)
 */

import { runUnifiedModule } from '../../helpers/vitest-adapter';
import { ST01Module } from '../../../src/logic/cardTests/shared/ST01';

runUnifiedModule(ST01Module);
