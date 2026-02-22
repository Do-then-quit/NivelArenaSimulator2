/**
 * ST11 Unified Tests (Vitest Runner)
 */

import { runUnifiedModule } from '../../helpers/vitest-adapter';
import { ST11Module } from '../../../src/logic/cardTests/shared/ST11';

runUnifiedModule(ST11Module);
