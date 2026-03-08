/**
 * ST09 Unified Tests (Vitest Runner)
 */

import { runUnifiedModule } from '../../helpers/vitest-adapter';
import { ST09Module } from '../../../src/logic/cardTests/shared/ST09';

runUnifiedModule(ST09Module);
