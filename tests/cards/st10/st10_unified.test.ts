/**
 * ST10 Unified Tests (Vitest Runner)
 */

import { runUnifiedModule } from '../../helpers/vitest-adapter';
import { ST10Module } from '../../../src/logic/cardTests/shared/ST10';

runUnifiedModule(ST10Module);
