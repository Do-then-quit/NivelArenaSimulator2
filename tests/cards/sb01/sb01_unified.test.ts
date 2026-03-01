/**
 * SB01 Unified Tests (Vitest Runner)
 */

import { runUnifiedModule } from '../../helpers/vitest-adapter';
import { SB01Module } from '../../../src/logic/cardTests/shared/SB01';

runUnifiedModule(SB01Module);
