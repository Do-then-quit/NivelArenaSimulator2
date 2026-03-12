import { BaselineBot } from '../BaselineBot';
import { PracticeProfile } from './types';

export class PracticeBot extends BaselineBot {
    readonly profile: PracticeProfile;

    constructor(name: string, profile: PracticeProfile) {
        super(name, { practiceProfile: profile });
        this.profile = profile;
    }
}
