import { ST09Module } from '../../src/logic/cardTests/shared/ST09';
import { verifyPackPlayRows } from './verifyPackPlayRowsShared';

verifyPackPlayRows({
    packId: 'ST09',
    module: ST09Module,
    screenshotDir: '/tmp/nivelarena-st09-play-verify',
}).catch((error) => {
    console.error(error);
    process.exit(1);
});
