import { ActivationCondition, Phase } from '../types';

export function registerBT06DebugScenarios(manager: any) {
    const resetPlayerState = (player: any) => {
        player.hand = [];
        player.trash = [];
        player.skillZone = [];
        player.damage = [];
        player.deck = [];
        player.leaderLevel = 10;
        player.lockedActivationsUntilTurnEnd = {};
        player.unitZones.forEach((zone: any) => {
            zone.unit = null;
            zone.items = [];
            zone.buffs = [];
            zone.temporaryEffects = [];
            zone.hasAttacked = false;
            zone.isExhausted = false;
            zone.hasPlacedUnitThisTurn = false;
            zone.hasActivatedEffectThisTurn = false;
            zone.activatedEffectKeys = {};
            zone.attackCountThisTurn = 0;
            zone.extraAttackAllowance = 0;
        });
    };

    (manager as any).bt06_054_status = function () {
        const owner = this.game.state.players[0];
        const opponent = this.game.state.players[1];
        const status = {
            turnCount: this.game.state.turnCount,
            currentPlayerIndex: this.game.state.turnPlayerIndex,
            phase: this.game.state.phase,
            ownerHand: owner.hand.length,
            ownerDeck: owner.deck.length,
            opponentHand: opponent.hand.length,
            opponentDeck: opponent.deck.length,
        };
        console.table(status);
        return status;
    };

    (manager as any).bt06_054_triggerOpponentEffectDraw = function (count: number = 1, triggerDraw: boolean = false) {
        this.game.drawCard(1, count, {
            reason: 'EFFECT',
            sourceActivation: triggerDraw ? ActivationCondition.DAMAGE_TRIGGER : ActivationCondition.ACTIVE,
        });
        this.renderCallback();
        return (this as any).bt06_054_status();
    };

    (manager as any).bt06_054_triggerOpponentRuleDraw = function (count: number = 1) {
        this.game.drawCard(1, count, { reason: 'RULE' });
        this.renderCallback();
        return (this as any).bt06_054_status();
    };

    (manager as any).bt06_054_advanceTurn = function () {
        const startTurnCount = this.game.state.turnCount;
        let guard = 0;
        while (this.game.state.turnCount === startTurnCount && guard < 16 && !this.game.state.winner) {
            this.game.nextPhase();
            guard += 1;
        }
        this.renderCallback();
        return (this as any).bt06_054_status();
    };

    (manager as any).setupBT06_054_Passive_Scenario = function () {
        console.log('Setting up BT06-054 passive [DRAWN] scenario...');
        const p0 = this.game.state.players[0];
        const p1 = this.game.state.players[1];

        resetPlayerState(p0);
        resetPlayerState(p1);

        p0.unitZones[0].unit = this.getCard('BT06-054');
        p0.deck = [
            this.getCard('ST01-002'),
            this.getCard('ST01-002'),
            this.getCard('ST01-002'),
            this.getCard('ST01-002'),
            this.getCard('ST01-002'),
            this.getCard('ST01-002'),
        ].filter(Boolean);
        p1.deck = [
            this.getCard('ST01-002'),
            this.getCard('ST01-002'),
            this.getCard('ST01-002'),
            this.getCard('ST01-002'),
            this.getCard('ST01-002'),
            this.getCard('ST01-002'),
        ].filter(Boolean);

        this.game.state.turnPlayerIndex = 0;
        this.game.state.phase = Phase.MAIN;
        this.game.state.winner = null;
        (this.game.state as any).firedEffects = {};

        this.renderCallback();

        console.log('%c SCENARIO READY ', 'background: #4CAF50; color: white');
        console.log('1) window.debug.bt06_054_status()');
        console.log('2) window.debug.bt06_054_triggerOpponentEffectDraw(1, false)  // 비트리거 효과 드로우 -> P0 +1');
        console.log('3) window.debug.bt06_054_triggerOpponentEffectDraw(1, false)  // 같은 턴 추가 -> P0 추가 드로우 없음');
        console.log('4) window.debug.bt06_054_advanceTurn() twice                  // 턴 진행(턴당 1회 리셋)');
        console.log('5) window.debug.bt06_054_triggerOpponentEffectDraw(1, false)  // 다음 턴 재발동 확인');
        console.log('6) window.debug.bt06_054_triggerOpponentRuleDraw(1)           // 룰 드로우 -> 미발동');
        console.log('7) window.debug.bt06_054_triggerOpponentEffectDraw(1, true)   // 트리거 효과 드로우 -> 미발동');
    };
}

