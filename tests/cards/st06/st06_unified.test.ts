/**
 * ST06 Unified Tests (Vitest Runner)
 */

import { runUnifiedModule } from '../../helpers/vitest-adapter';
import { ST06Module } from '../../../src/logic/cardTests/shared/ST06';

runUnifiedModule(ST06Module);
