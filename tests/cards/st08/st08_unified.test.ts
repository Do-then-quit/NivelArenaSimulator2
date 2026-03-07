/**
 * ST08 Unified Tests (Vitest Runner)
 */

import { runUnifiedModule } from '../../helpers/vitest-adapter';
import { ST08Module } from '../../../src/logic/cardTests/shared/ST08';

runUnifiedModule(ST08Module);
