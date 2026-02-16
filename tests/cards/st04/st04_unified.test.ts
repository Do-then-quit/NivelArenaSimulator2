/**
 * ST04 Unified Tests (Vitest Runner)
 */

import { runUnifiedModule } from '../../helpers/vitest-adapter';
import { ST04Module } from '../../../src/logic/cardTests/shared/ST04';

runUnifiedModule(ST04Module);
