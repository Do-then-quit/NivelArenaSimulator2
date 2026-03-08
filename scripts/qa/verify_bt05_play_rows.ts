import { BT05Module } from '../../src/logic/cardTests/shared/BT05';
import { verifyPackPlayRows } from './verifyPackPlayRowsShared';

verifyPackPlayRows({
    packId: 'BT05',
    module: BT05Module,
    screenshotDir: '/tmp/nivelarena-bt05-play-verify',
}).catch((error) => {
    console.error(error);
    process.exit(1);
});
