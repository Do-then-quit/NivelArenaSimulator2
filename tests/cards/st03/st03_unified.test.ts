/**
 * ST03 Unified Tests (Vitest Runner)
 */

import { runUnifiedModule } from '../../helpers/vitest-adapter';
import { ST03Module } from '../../../src/logic/cardTests/shared/ST03';

runUnifiedModule(ST03Module);
