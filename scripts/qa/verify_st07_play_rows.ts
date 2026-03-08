import { ST07Module } from '../../src/logic/cardTests/shared/ST07';
import { verifyPackPlayRows } from './verifyPackPlayRowsShared';

verifyPackPlayRows({
    packId: 'ST07',
    module: ST07Module,
    screenshotDir: '/tmp/nivelarena-st07-play-verify',
}).catch((error) => {
    console.error(error);
    process.exit(1);
});
