import {
    ActivationCondition,
    CardType,
    type ActionAvailability,
    type AuditTrailCategory,
    type AuditTrailEntry,
    type Card,
    type Effect,
    type EngineAction,
    type EngineUiSnapshot,
    type MandatoryQueueItem,
    Phase,
    type PlayerState,
    type TimingWindow,
    type UnitZoneState,
    type UiTraceEvent,
} from '../../types';
import { RuleValidator } from '../../RuleValidator';
import { TargetSelector } from '../../TargetSelector';

const PHASE_LABELS: Record<Phase, string> = {
    [Phase.LEVEL_UP]: '레벨업',
    [Phase.DRAW]: '드로우',
    [Phase.MAIN]: '메인',
    [Phase.ATTACK]: '어택',
    [Phase.BLOCK]: '어택',
    [Phase.END]: '엔드',
};

const COMBAT_STEP_LABELS: Record<string, string> = {
    NONE: '',
    ATTACK_DECLARATION: '공격 선언',
    DEFENSE_DECLARATION: '방어 선언',
    BATTLE: '전투/대미지',
    BATTLE_END: '전투 종료',
};

const INTERACTION_MODE_LABELS: Record<string, string> = {
    NORMAL: '일반 진행',
    SELECT_MULLIGAN: '멀리건 선택',
    SELECT_TARGET: '대상 선택',
    SELECT_COST: '비용 선택',
    SELECT_OPTIONAL: '선택 효과 확인',
};

const ACTIVATION_REASON_LABELS: Record<string, string> = {
    ENTRY: '엔트리',
    PASSIVE: '패시브 유발',
    ACTIVE: '액티브',
    ACTIVE_MAIN: '메인 액티브',
    ATTACKER: '어태커',
    GUARDIAN: '가디언',
    TURN_END: '턴 종료',
    DAMAGE_TRIGGER: '데미지 트리거',
};

function resolveInteractionOwnerId(engine: any): string | null {
    if (typeof engine.getInteractionOwnerId === 'function') {
        return engine.getInteractionOwnerId();
    }
    if (engine.state.interactionMode === 'NORMAL') {
        if (engine.state.phase === Phase.BLOCK && engine.state.pendingAttackerIndex !== null) {
            return engine.opponentPlayer.id;
        }
        return engine.currentPlayer.id;
    }
    return (
        engine.state.interactionOwnerPlayerId ??
        engine.state.pendingEffect?.controllerPlayerId ??
        engine.state.pendingEffect?.sourcePlayerId ??
        null
    );
}

function getPlayerById(engine: any, playerId: string): PlayerState | null {
    return engine.state.players.find((player: PlayerState) => player.id === playerId) ?? null;
}

function getOpponentOf(engine: any, player: PlayerState): PlayerState {
    return engine.state.players.find((candidate: PlayerState) => candidate.id !== player.id)!;
}

function actionKey(action: EngineAction): string {
    return JSON.stringify(action);
}

function createAvailabilityId(prefix: string, parts: Array<string | number | undefined>): string {
    return [prefix, ...parts.filter((part) => part !== undefined)].join(':');
}

function getLaneLabel(zoneIndex: number): string {
    return `${zoneIndex + 1}라인`;
}

function toAuditCategory(eventType: string): AuditTrailCategory {
    switch (eventType) {
        case 'PHASE_CHANGED':
            return 'PHASE';
        case 'INTERACTION_OPENED':
            return 'INTERACTION';
        case 'EFFECT_EXECUTED':
            return 'EFFECT';
        case 'DAMAGE_CARD_REVEALED':
        case 'DAMAGE_TRIGGER_ACTIVATED':
            return 'COMBAT';
        default:
            return 'SYSTEM';
    }
}

function buildTraceDetail(engine: any, event: UiTraceEvent): { title: string; detail: string } {
    const getPlayerName = (playerId?: string) => {
        if (!playerId) return '플레이어';
        return engine.state.players.find((player: PlayerState) => player.id === playerId)?.name ?? playerId;
    };

    switch (event.type) {
        case 'PHASE_CHANGED':
            return {
                title: '페이즈 전환',
                detail: `${PHASE_LABELS[event.phase]} 페이즈로 이동`,
            };
        case 'INTERACTION_OPENED': {
            const interactionLabel = INTERACTION_MODE_LABELS[event.interactionMode || 'NORMAL'] ?? '선택 입력';
            const sourceLabel = event.sourceCardName ?? '효과';
            return {
                title: '입력 대기',
                detail: `${sourceLabel}로 ${interactionLabel} 창이 열렸습니다.`,
            };
        }
        case 'EFFECT_EXECUTED':
            return {
                title: '효과 실행',
                detail: event.effectDescription
                    ? `효과: ${event.effectDescription}`
                    : `${event.sourceCardName ?? '카드 효과'}가 해결되었습니다.`,
            };
        case 'CARDS_DRAWN':
            return {
                title: '드로우',
                detail: `${getPlayerName(event.sourcePlayerId)}이 ${event.count ?? event.cardIds?.length ?? 0}장 드로우`,
            };
        case 'DAMAGE_CARD_REVEALED':
            return {
                title: '데미지 공개',
                detail: `${getPlayerName(event.targetPlayerId)}의 데미지 공개: ${event.sourceCardName ?? '카드'}`,
            };
        case 'DAMAGE_TRIGGER_ACTIVATED':
            return {
                title: '데미지 트리거',
                detail: `${event.sourceCardName ?? '카드'}의 데미지 트리거가 발동했습니다.`,
            };
        default:
            return {
                title: '시스템 기록',
                detail: event.effectDescription || event.sourceCardName || '상태 변화가 기록되었습니다.',
            };
    }
}

export function createAuditTrailEntryFromUiTraceEvent(engine: any, event: UiTraceEvent): AuditTrailEntry {
    const detail = buildTraceDetail(engine, event);
    return {
        id: event.id,
        createdAtMs: event.createdAtMs,
        category: toAuditCategory(event.type),
        title: detail.title,
        detail: detail.detail,
        turnCount: event.turnCount,
        phase: event.phase,
        sourcePlayerId: event.sourcePlayerId,
        sourceCardName: event.sourceCardName,
    };
}

function normalizeReason(reason: string | undefined, fallback: string): string {
    if (!reason) return fallback;

    const reasonMap: Array<[RegExp, string]> = [
        [/Not in MAIN phase/i, '메인 페이즈가 아니어서 사용할 수 없습니다.'],
        [/Not in ATTACK phase/i, '어택 페이즈가 아니어서 공격할 수 없습니다.'],
        [/Already placed in this zone this turn/i, '이 라인은 이번 턴 일반 배치/업그레이드를 이미 사용했습니다.'],
        [/Cost must be higher than existing unit to upgrade/i, '업그레이드는 기존 유닛보다 높은 코스트여야 합니다.'],
        [/Cost exceeds Size limit/i, '현재 사이즈를 초과합니다.'],
        [/Target zone has no unit/i, '장착 대상 유닛이 없습니다.'],
        [/Unit is exhausted/i, '이 유닛은 Exhaust 상태입니다.'],
        [/Unit already attacked/i, '이 유닛은 이번 턴 이미 공격했습니다.'],
        [/Cannot pay attack cost/i, '공격 비용을 지불할 수 없습니다.'],
        [/Must attack with Berserker units first/i, '광전사 유닛의 공격을 먼저 해결해야 합니다.'],
        [/Skill is locked until end of turn/i, '이 스킬은 턴 종료까지 잠겨 있습니다.'],
        [/No .* card in hand to pay cost/i, '비용으로 버릴 카드가 부족합니다.'],
        [/Lane lock:/i, '상대 효과로 이 라인의 일반 배치가 잠겨 있습니다.'],
        [/Cannot equip duplicate item name on this unit/i, '같은 이름의 장비는 중복 장착할 수 없습니다.'],
        [/This unit cannot equip items by external methods/i, '이 유닛은 외부 방법으로 장비할 수 없습니다.'],
        [/Equip condition is not satisfied/i, '장착 조건을 만족하지 않습니다.'],
    ];

    for (const [pattern, nextReason] of reasonMap) {
        if (pattern.test(reason)) return nextReason;
    }

    return reason;
}

function nextPhaseLabel(phase: Phase): string {
    switch (phase) {
        case Phase.LEVEL_UP:
            return '드로우';
        case Phase.DRAW:
            return '메인';
        case Phase.MAIN:
            return '어택';
        case Phase.ATTACK:
        case Phase.BLOCK:
            return '엔드';
        case Phase.END:
            return '레벨업';
        default:
            return '다음 단계';
    }
}

function buildNextPhaseAvailability(engine: any, actor: PlayerState, legalActionMap: Set<string>): ActionAvailability | null {
    if (actor.id !== engine.currentPlayer.id) return null;
    const nextPhaseAction: EngineAction = { type: 'NEXT_PHASE', actorPlayerId: actor.id };
    const enabled = legalActionMap.has(actionKey(nextPhaseAction));
    let reason: string | undefined;
    if (!enabled) {
        if (engine.state.interactionMode !== 'NORMAL') {
            reason = '진행 중인 선택 또는 효과 해결을 먼저 끝내야 합니다.';
        } else if (engine.state.phase === Phase.BLOCK) {
            reason = '방어 선언을 먼저 해결해야 합니다.';
        } else {
            reason = normalizeReason(
                RuleValidator.canEndPhase(engine, actor).reason,
                '아직 다음 페이즈로 넘어갈 수 없습니다.',
            );
        }
    }

    return {
        id: createAvailabilityId('NEXT_PHASE', [actor.id]),
        action: nextPhaseAction,
        actionType: 'NEXT_PHASE',
        group: 'PHASE',
        label: '다음 페이즈',
        enabled,
        reason,
        preview: `${nextPhaseLabel(engine.state.phase)} 페이즈로 이동`,
        sourcePlayerId: actor.id,
        emphasis: 'PRIMARY',
    };
}

function buildPlayAvailabilities(engine: any, actor: PlayerState, legalActionMap: Set<string>): ActionAvailability[] {
    const availabilities: ActionAvailability[] = [];
    if (actor.id !== engine.currentPlayer.id) return availabilities;

    actor.hand.forEach((card: Card, handIndex: number) => {
        if (card.type === CardType.UNIT) {
            actor.unitZones.forEach((zone: UnitZoneState, zoneIndex: number) => {
                const action: EngineAction = { type: 'PLAY_UNIT', actorPlayerId: actor.id, handIndex, zoneIndex };
                const validation = RuleValidator.canPlayUnit(engine, actor, handIndex, zoneIndex);
                availabilities.push({
                    id: createAvailabilityId('PLAY_UNIT', [actor.id, handIndex, zoneIndex]),
                    action,
                    actionType: 'PLAY_UNIT',
                    group: 'PLAY',
                    label: `${card.name} -> ${getLaneLabel(zoneIndex)} ${zone.unit ? '업그레이드' : '일반 배치'}`,
                    enabled: legalActionMap.has(actionKey(action)),
                    reason: validation.valid ? undefined : normalizeReason(validation.reason, '지금은 일반 배치할 수 없습니다.'),
                    preview: `${getLaneLabel(zoneIndex)}에 ${card.name} ${zone.unit ? '업그레이드' : '배치'}`,
                    sourcePlayerId: actor.id,
                    handIndex,
                    zoneIndex,
                });
            });
            return;
        }

        if (card.type === CardType.ITEM) {
            actor.unitZones.forEach((_zone: UnitZoneState, zoneIndex: number) => {
                const action: EngineAction = { type: 'PLAY_ITEM', actorPlayerId: actor.id, handIndex, zoneIndex };
                const validation = RuleValidator.canPlayItem(engine, actor, handIndex, zoneIndex);
                availabilities.push({
                    id: createAvailabilityId('PLAY_ITEM', [actor.id, handIndex, zoneIndex]),
                    action,
                    actionType: 'PLAY_ITEM',
                    group: 'PLAY',
                    label: `${card.name} -> ${getLaneLabel(zoneIndex)} 장착`,
                    enabled: legalActionMap.has(actionKey(action)),
                    reason: validation.valid ? undefined : normalizeReason(validation.reason, '지금은 장비할 수 없습니다.'),
                    preview: `${getLaneLabel(zoneIndex)} 유닛에 ${card.name} 장착`,
                    sourcePlayerId: actor.id,
                    handIndex,
                    zoneIndex,
                });
            });
            return;
        }

        if (card.type === CardType.SKILL) {
            const action: EngineAction = { type: 'PLAY_SKILL', actorPlayerId: actor.id, handIndex };
            const validation = RuleValidator.canPlaySkill(engine, actor, handIndex);
            availabilities.push({
                id: createAvailabilityId('PLAY_SKILL', [actor.id, handIndex]),
                action,
                actionType: 'PLAY_SKILL',
                group: 'PLAY',
                label: `${card.name} 사용`,
                enabled: legalActionMap.has(actionKey(action)),
                reason: validation.valid ? undefined : normalizeReason(validation.reason, '지금은 스킬을 사용할 수 없습니다.'),
                preview: `${card.name} 스킬 사용`,
                sourcePlayerId: actor.id,
                handIndex,
            });
        }
    });

    return availabilities;
}

function canPayEffectCost(actor: PlayerState, effect: Effect): boolean {
    if (!effect.cost || effect.cost.type === 'NONE') return true;
    if (effect.cost.type === 'TRASH_HAND' || effect.cost.type === 'SHUFFLE_HAND_TO_DECK') {
        const requiredAmount = effect.cost.amount || 1;
        const costFilter = effect.cost.cardTypeFilter;
        const payableCount = actor.hand.filter((card: Card) => !costFilter || card.type === costFilter).length;
        return payableCount >= requiredAmount;
    }
    return true;
}

function buildActiveEffectAvailability(
    engine: any,
    actor: PlayerState,
    legalActionMap: Set<string>,
    sourceCard: Card,
    effect: Effect,
    effectIndex: number,
    sourceType: 'UNIT' | 'ITEM' | 'LEADER',
    zoneIndex: number,
    itemIndex?: number,
): ActionAvailability {
    const action: EngineAction = {
        type: 'ACTIVATE_EFFECT',
        actorPlayerId: actor.id,
        zoneIndex,
        effectIndex,
        sourceType,
        ...(itemIndex !== undefined ? { itemIndex } : {}),
    };
    const opponent = getOpponentOf(engine, actor);
    const zone = zoneIndex >= 0 ? actor.unitZones[zoneIndex] : undefined;
    const effectKey = sourceType === 'ITEM'
        ? `${sourceCard.id}_${itemIndex}_${effect.id || effectIndex}`
        : `${sourceCard.id}_${effect.id || effectIndex}`;
    const leaderActivatedKeys = ((actor as any).leaderActivatedEffectKeys || {}) as Record<string, boolean>;
    const effectAlreadyUsed = sourceType === 'LEADER'
        ? !!leaderActivatedKeys[effectKey]
        : !!zone?.activatedEffectKeys?.[effectKey];
    const activatableInPhase =
        (effect.activation === ActivationCondition.ACTIVE && (engine.state.phase === Phase.MAIN || engine.state.phase === Phase.ATTACK)) ||
        (effect.activation === ActivationCondition.ACTIVE_MAIN && engine.state.phase === Phase.MAIN);
    const context = {
        sourceCard,
        player: actor,
        opponent,
        unitZone: zone,
        machine: engine,
    };

    const enabled = legalActionMap.has(actionKey(action));
    let reason: string | undefined;
    if (!enabled) {
        if (effectAlreadyUsed) {
            reason = '이번 턴에 이미 사용한 액티브입니다.';
        } else if (!activatableInPhase) {
            reason = effect.activation === ActivationCondition.ACTIVE_MAIN
                ? '메인 페이즈 전용 액티브입니다.'
                : '메인 또는 어택 페이즈에서만 사용할 수 있습니다.';
        } else if (!engine.effectManager.checkCondition(effect, context)) {
            reason = '발동 조건을 충족하지 못했습니다.';
        } else if (!canPayEffectCost(actor, effect)) {
            reason = '비용을 지불할 수 없습니다.';
        } else if (effect.targets?.selectMode === 'MANUAL' && TargetSelector.resolve(engine, effect.targets, context).length === 0) {
            reason = '유효한 대상이 없어 발동할 수 없습니다.';
        } else {
            reason = '지금은 사용할 수 없습니다.';
        }
    }

    const sourceLabel = sourceType === 'LEADER'
        ? '리더'
        : sourceType === 'ITEM'
            ? `${getLaneLabel(zoneIndex)} 장비`
            : getLaneLabel(zoneIndex);

    return {
        id: createAvailabilityId('ACTIVE', [actor.id, sourceType, sourceCard.id, zoneIndex, itemIndex, effectIndex]),
        action,
        actionType: 'ACTIVATE_EFFECT',
        group: 'ACTIVE',
        label: `${sourceLabel} 액티브: ${effect.description}`,
        enabled,
        reason,
        preview: effect.description,
        sourcePlayerId: actor.id,
        zoneIndex,
        itemIndex,
        emphasis: enabled ? 'SECONDARY' : 'WARNING',
    };
}

function buildActiveAvailabilities(engine: any, actor: PlayerState, legalActionMap: Set<string>): ActionAvailability[] {
    const availabilities: ActionAvailability[] = [];

    actor.unitZones.forEach((zone: UnitZoneState, zoneIndex: number) => {
        if (zone.unit?.effects) {
            zone.unit.effects.forEach((effect: Effect, effectIndex: number) => {
                if (effect.activation !== ActivationCondition.ACTIVE && effect.activation !== ActivationCondition.ACTIVE_MAIN) return;
                availabilities.push(
                    buildActiveEffectAvailability(engine, actor, legalActionMap, zone.unit!, effect, effectIndex, 'UNIT', zoneIndex),
                );
            });
        }
        zone.items.forEach((item: Card, itemIndex: number) => {
            (item.effects || []).forEach((effect: Effect, effectIndex: number) => {
                if (effect.activation !== ActivationCondition.ACTIVE && effect.activation !== ActivationCondition.ACTIVE_MAIN) return;
                availabilities.push(
                    buildActiveEffectAvailability(engine, actor, legalActionMap, item, effect, effectIndex, 'ITEM', zoneIndex, itemIndex),
                );
            });
        });
    });

    if (actor.levelZone?.effects) {
        actor.levelZone.effects.forEach((effect: Effect, effectIndex: number) => {
            if (effect.activation !== ActivationCondition.ACTIVE && effect.activation !== ActivationCondition.ACTIVE_MAIN) return;
            availabilities.push(
                buildActiveEffectAvailability(engine, actor, legalActionMap, actor.levelZone!, effect, effectIndex, 'LEADER', -1),
            );
        });
    }

    return availabilities;
}

function buildAttackAvailabilities(engine: any, actor: PlayerState, legalActionMap: Set<string>): ActionAvailability[] {
    if (actor.id !== engine.currentPlayer.id) return [];
    const availabilities: ActionAvailability[] = [];
    actor.unitZones.forEach((zone: UnitZoneState, zoneIndex: number) => {
        if (!zone.unit) return;
        const action: EngineAction = { type: 'ATTACK', actorPlayerId: actor.id, attackerZoneIndex: zoneIndex };
        const validation = RuleValidator.canAttack(engine, actor, zoneIndex);
        availabilities.push({
            id: createAvailabilityId('ATTACK', [actor.id, zoneIndex]),
            action,
            actionType: 'ATTACK',
            group: 'ATTACK',
            label: `${getLaneLabel(zoneIndex)} 공격 선언`,
            enabled: legalActionMap.has(actionKey(action)),
            reason: validation.valid ? undefined : normalizeReason(validation.reason, '지금은 공격할 수 없습니다.'),
            preview: `${getLaneLabel(zoneIndex)}에서 공격`,
            sourcePlayerId: actor.id,
            zoneIndex,
            emphasis: 'PRIMARY',
        });
    });
    return availabilities;
}

function buildInteractionAvailabilities(engine: any, actor: PlayerState, legalActions: EngineAction[]): ActionAvailability[] {
    const availabilities: ActionAvailability[] = [];

    if (engine.state.interactionMode === 'SELECT_MULLIGAN') {
        availabilities.push(
            {
                id: createAvailabilityId('MULLIGAN_KEEP', [actor.id]),
                action: { type: 'RESOLVE_MULLIGAN', actorPlayerId: actor.id, shouldMulligan: false },
                actionType: 'RESOLVE_MULLIGAN',
                group: 'INTERACTION',
                label: '패 유지',
                enabled: legalActions.some((action) => action.type === 'RESOLVE_MULLIGAN' && action.shouldMulligan === false),
                preview: '현재 시작 패를 유지합니다.',
                sourcePlayerId: actor.id,
                emphasis: 'PRIMARY',
            },
            {
                id: createAvailabilityId('MULLIGAN_FULL', [actor.id]),
                action: { type: 'RESOLVE_MULLIGAN', actorPlayerId: actor.id, shouldMulligan: true },
                actionType: 'RESOLVE_MULLIGAN',
                group: 'INTERACTION',
                label: '전체 멀리건',
                enabled: legalActions.some((action) => action.type === 'RESOLVE_MULLIGAN' && action.shouldMulligan === true),
                preview: '시작 패 5장을 모두 다시 뽑습니다.',
                sourcePlayerId: actor.id,
                emphasis: 'WARNING',
            },
        );
        return availabilities;
    }

    if (engine.state.interactionMode === 'SELECT_OPTIONAL') {
        availabilities.push(
            {
                id: createAvailabilityId('OPTIONAL_CONFIRM', [actor.id]),
                action: { type: 'RESOLVE_OPTIONAL', actorPlayerId: actor.id, confirm: true },
                actionType: 'RESOLVE_OPTIONAL',
                group: 'INTERACTION',
                label: '효과 사용',
                enabled: legalActions.some((action) => action.type === 'RESOLVE_OPTIONAL' && action.confirm === true),
                preview: '선택 효과를 사용합니다.',
                sourcePlayerId: actor.id,
                emphasis: 'PRIMARY',
            },
            {
                id: createAvailabilityId('OPTIONAL_SKIP', [actor.id]),
                action: { type: 'RESOLVE_OPTIONAL', actorPlayerId: actor.id, confirm: false },
                actionType: 'RESOLVE_OPTIONAL',
                group: 'INTERACTION',
                label: '건너뛰기',
                enabled: legalActions.some((action) => action.type === 'RESOLVE_OPTIONAL' && action.confirm === false),
                preview: '선택 효과를 사용하지 않습니다.',
                sourcePlayerId: actor.id,
                emphasis: 'SECONDARY',
            },
        );
    }

    if (engine.state.interactionMode === 'SELECT_TARGET') {
        const confirmAction: EngineAction = { type: 'CONFIRM_TARGETS', actorPlayerId: actor.id };
        const canConfirm = legalActions.some((action) => action.type === 'CONFIRM_TARGETS');
        availabilities.push({
            id: createAvailabilityId('CONFIRM_TARGETS', [actor.id]),
            action: confirmAction,
            actionType: 'CONFIRM_TARGETS',
            group: 'INTERACTION',
            label: '대상 선택 확정',
            enabled: canConfirm,
            reason: canConfirm ? undefined : '필요한 대상을 모두 선택하면 확정할 수 있습니다.',
            preview: '현재 선택한 대상으로 효과를 해결합니다.',
            sourcePlayerId: actor.id,
            emphasis: 'PRIMARY',
        });
    }

    if (engine.state.phase === Phase.BLOCK) {
        legalActions
            .filter((action) => action.type === 'RESOLVE_BLOCK')
            .forEach((action) => {
                const blockAction = action as Extract<EngineAction, { type: 'RESOLVE_BLOCK' }>;
                availabilities.push({
                    id: createAvailabilityId('RESOLVE_BLOCK', [actor.id, blockAction.blockerZoneIndex, blockAction.shouldBlock ? 'block' : 'pass']),
                    action: blockAction,
                    actionType: 'RESOLVE_BLOCK',
                    group: 'INTERACTION',
                    label: blockAction.shouldBlock
                        ? `${getLaneLabel(blockAction.blockerZoneIndex ?? 0)}로 방어`
                        : '방어하지 않음',
                    enabled: true,
                    preview: blockAction.shouldBlock ? '가디언/방어를 선언합니다.' : '방어를 포기합니다.',
                    sourcePlayerId: actor.id,
                    zoneIndex: blockAction.blockerZoneIndex,
                    emphasis: blockAction.shouldBlock ? 'PRIMARY' : 'SECONDARY',
                });
            });
    }

    return availabilities;
}

function buildSystemWarnings(actor: PlayerState): ActionAvailability[] {
    const warnings: ActionAvailability[] = [];
    if (actor.deck.length === 0) {
        warnings.push({
            id: createAvailabilityId('SYSTEM_WARNING', [actor.id, 'deck_zero']),
            action: null,
            actionType: 'PASS_PRIORITY',
            group: 'SYSTEM',
            label: '덱 상태 경고',
            enabled: false,
            reason: '덱은 0장이지만 즉시 패배는 아닙니다. 다음 드로우 요구가 발생하면 패배합니다.',
            preview: '드로우를 요구하는 효과나 규칙 처리 전에 대비가 필요합니다.',
            sourcePlayerId: actor.id,
            emphasis: 'WARNING',
        });
    }
    return warnings;
}

function resolvePendingReason(engine: any): string {
    const pending = engine.state.pendingEffect;
    if (!pending) return '효과 해결 대기';
    if (pending.triggerReason && pending.triggerReason.trim()) return pending.triggerReason.trim();
    if (pending.sourceActivation) {
        const key = String(pending.sourceActivation);
        return ACTIVATION_REASON_LABELS[key] ?? key;
    }
    if (pending.effectDescription) return pending.effectDescription;
    return '효과 해결 대기';
}

function buildMandatoryQueue(engine: any): MandatoryQueueItem[] {
    if (engine.state.interactionMode === 'SELECT_MULLIGAN') {
        const pendingPlayerId = engine.state.mulliganState?.pendingPlayerIds?.[0] ?? resolveInteractionOwnerId(engine);
        return [{
            id: 'mandatory:mulligan',
            title: '멀리건 결정',
            reason: '시작 패를 유지할지 전체 멀리건할지 결정해야 합니다.',
            blocking: true,
            controllerPlayerId: pendingPlayerId ?? undefined,
            actionType: 'RESOLVE_MULLIGAN',
            preview: 'Keep Hand 또는 Full Mulligan 중 하나를 선택하세요.',
        }];
    }

    if (engine.state.pendingEffect) {
        const pending = engine.state.pendingEffect;
        const preview = pending.sourceEffectDescription || pending.effectDescription || undefined;
        const titleMap: Record<string, string> = {
            SELECT_TARGET: '강제 대상 선택',
            SELECT_COST: '강제 비용 선택',
            SELECT_OPTIONAL: '선택 효과 확인',
            NORMAL: '효과 해결 대기',
        };
        return [{
            id: `mandatory:${pending.actionType}`,
            title: titleMap[engine.state.interactionMode] ?? '효과 해결 대기',
            reason: resolvePendingReason(engine),
            blocking: true,
            sourceCardName: pending.sourceCard?.name,
            controllerPlayerId: pending.controllerPlayerId ?? pending.sourcePlayerId,
            actionType: pending.actionType,
            preview,
        }];
    }

    if (engine.state.effectQueue.length > 0) {
        const nextItem = engine.state.effectQueue[0];
        return [{
            id: `mandatory:queue:${nextItem.id}`,
            title: '효과 해결 대기열',
            reason: `${engine.state.effectQueue.length}개의 효과가 순서대로 해결됩니다.`,
            blocking: false,
            sourceCardName: nextItem.context?.sourceCard?.name,
            controllerPlayerId: nextItem.context?.player?.id,
            actionType: nextItem.effect?.action?.type,
            preview: nextItem.effect?.description,
        }];
    }

    return [];
}

function buildTimingWindow(engine: any): TimingWindow {
    const interactionOwnerPlayerId = resolveInteractionOwnerId(engine);
    const phase = engine.state.phase as Phase;
    const combatStep = engine.state.combatStep as TimingWindow['combatStep'];
    return {
        phase,
        phaseLabel: PHASE_LABELS[phase],
        combatStep,
        combatStepLabel: combatStep === 'NONE' ? null : COMBAT_STEP_LABELS[combatStep],
        interactionMode: engine.state.interactionMode,
        interactionOwnerPlayerId,
        awaitingInput: engine.state.interactionMode !== 'NORMAL',
        awaitingMandatory: engine.state.interactionMode !== 'NORMAL' || engine.state.effectQueue.length > 0,
    };
}

function buildAuditTrail(engine: any): AuditTrailEntry[] {
    const rawHistory = (typeof engine.peekUiTraceHistory === 'function'
        ? engine.peekUiTraceHistory(12)
        : ((engine.uiTraceHistory as UiTraceEvent[] | undefined) ?? []).slice(-12)
    ) as UiTraceEvent[];

    const entries = rawHistory.map((event) => createAuditTrailEntryFromUiTraceEvent(engine, event));
    if (entries.length > 0) return entries.reverse();

    if (engine.state.pendingEffect) {
        return [{
            id: `audit:pending:${engine.state.pendingEffect.actionType}`,
            createdAtMs: Date.now(),
            category: 'INTERACTION',
            title: '효과 해결 대기',
            detail: resolvePendingReason(engine),
            turnCount: engine.state.turnCount,
            phase: engine.state.phase,
            sourcePlayerId: engine.state.pendingEffect.sourcePlayerId,
            sourceCardName: engine.state.pendingEffect.sourceCard?.name,
        }];
    }

    return [{
        id: 'audit:idle',
        createdAtMs: Date.now(),
        category: 'SYSTEM',
        title: '대기 상태',
        detail: `${PHASE_LABELS[engine.state.phase as Phase]} 페이즈 진행 중`,
        turnCount: engine.state.turnCount,
        phase: engine.state.phase as Phase,
    }];
}

export function buildUiSnapshot(engine: any, actorPlayerId: string): EngineUiSnapshot {
    const actor = getPlayerById(engine, actorPlayerId);
    const legalActions: EngineAction[] = actor ? engine.getLegalActions(actorPlayerId) : [];
    const legalActionMap = new Set<string>(legalActions.map(actionKey));
    const visibleActions: ActionAvailability[] = [];

    if (actor) {
        const nextPhaseAvailability = buildNextPhaseAvailability(engine, actor, legalActionMap);
        if (nextPhaseAvailability) visibleActions.push(nextPhaseAvailability);
        visibleActions.push(...buildPlayAvailabilities(engine, actor, legalActionMap));
        visibleActions.push(...buildAttackAvailabilities(engine, actor, legalActionMap));
        visibleActions.push(...buildActiveAvailabilities(engine, actor, legalActionMap));
        visibleActions.push(...buildInteractionAvailabilities(engine, actor, legalActions));
        visibleActions.push(...buildSystemWarnings(actor));
    }

    const groupOrder: Record<string, number> = {
        PHASE: 0,
        INTERACTION: 1,
        PLAY: 2,
        ATTACK: 3,
        ACTIVE: 4,
        SYSTEM: 5,
    };
    visibleActions.sort((left, right) => {
        const groupCompare = groupOrder[left.group] - groupOrder[right.group];
        if (groupCompare !== 0) return groupCompare;
        if (left.enabled !== right.enabled) return left.enabled ? -1 : 1;
        return left.label.localeCompare(right.label, 'ko');
    });

    return {
        actorPlayerId,
        legalActions,
        visibleActions,
        mandatoryQueue: buildMandatoryQueue(engine),
        timingWindow: buildTimingWindow(engine),
        auditTrail: buildAuditTrail(engine),
    };
}
