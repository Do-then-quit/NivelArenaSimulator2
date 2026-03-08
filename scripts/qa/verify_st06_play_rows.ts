import { ST06Module } from '../../src/logic/cardTests/shared/ST06';
import { verifyPackPlayRows } from './verifyPackPlayRowsShared';

verifyPackPlayRows({
    packId: 'ST06',
    module: ST06Module,
    screenshotDir: '/tmp/nivelarena-st06-play-verify',
}).catch((error) => {
    console.error(error);
    process.exit(1);
});
