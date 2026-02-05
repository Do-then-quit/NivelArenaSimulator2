/**
 * ST02 Unified Tests (Vitest Runner)
 */

import { runUnifiedModule } from '../../helpers/vitest-adapter';
import { ST02Module } from '../../../src/logic/cardTests/shared/ST02';

runUnifiedModule(ST02Module);
