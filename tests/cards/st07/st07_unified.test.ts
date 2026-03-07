/**
 * ST07 Unified Tests (Vitest Runner)
 */

import { runUnifiedModule } from '../../helpers/vitest-adapter';
import { ST07Module } from '../../../src/logic/cardTests/shared/ST07';

runUnifiedModule(ST07Module);
