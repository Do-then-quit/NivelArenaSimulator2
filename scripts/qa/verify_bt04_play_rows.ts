import { BT04Module } from '../../src/logic/cardTests/shared/BT04';
import { verifyPackPlayRows } from './verifyPackPlayRowsShared';

verifyPackPlayRows({
    packId: 'BT04',
    module: BT04Module,
    screenshotDir: '/tmp/nivelarena-bt04-play-verify',
}).catch((error) => {
    console.error(error);
    process.exit(1);
});
