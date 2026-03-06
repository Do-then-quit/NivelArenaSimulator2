import fs from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright';

const TARGET_URL = process.env.TARGET_URL ?? 'http://127.0.0.1:5173';
const OUTPUT_DIR = path.resolve(process.cwd(), 'artifacts', 'preview-overlay-qa');
const HEADLESS = process.env.HEADLESS !== 'false';

fs.mkdirSync(OUTPUT_DIR, { recursive: true });

function assertCondition(condition, message) {
    if (!condition) {
        throw new Error(message);
    }
}

async function waitForApp(page) {
    await page.goto(TARGET_URL, { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('#start-game-btn');
}

async function waitForMainPhase(page) {
    await page.waitForFunction(() => {
        const state = window.__naPreviewDebug?.getState?.();
        return state?.screen === 'GAME'
            && state?.game?.phase === 'MAIN'
            && document.querySelector('.mulligan-overlay') === null;
    }, null, { timeout: 15_000 });
}

async function startQuickPlay(page) {
    await page.click('#start-game-btn');
    await page.waitForSelector('.game-container');

    for (let i = 0; i < 4; i += 1) {
        const keepBtn = page.locator('#mulligan-keep-btn');
        if (!(await keepBtn.isVisible().catch(() => false))) {
            break;
        }
        await keepBtn.click();
        await page.waitForTimeout(150);
    }

    await waitForMainPhase(page);
    await page.waitForTimeout(200);
}

async function capture(page, name) {
    const filePath = path.join(OUTPUT_DIR, `${name}.png`);
    await page.screenshot({ path: filePath, fullPage: false });
    return filePath;
}

async function writeJson(name, value) {
    const filePath = path.join(OUTPUT_DIR, `${name}.json`);
    fs.writeFileSync(filePath, JSON.stringify(value, null, 2));
    return filePath;
}

async function getQaState(page) {
    return page.evaluate(() => window.__naPreviewDebug?.getState?.() ?? null);
}

async function getQaSnapshot(page) {
    const [state, dom] = await Promise.all([
        getQaState(page),
        page.evaluate(() => {
            const tooltip = document.querySelector('.hover-preview-tooltip');
            const overlay = document.querySelector('.trash-hover-overlay');
            const activeAnchors = Array.from(document.querySelectorAll('.selection-zone-active')).map((el) => ({
                className: el.className,
                player: el.getAttribute('data-player'),
                text: (el.textContent ?? '').trim().slice(0, 80),
            }));
            return {
                tooltipDisplay: tooltip instanceof HTMLElement ? tooltip.style.display : null,
                overlayActive: overlay instanceof HTMLElement ? overlay.classList.contains('active') : false,
                overlayCardCount: document.querySelectorAll('.trash-hover-card').length,
                activeAnchors,
            };
        }),
    ]);
    return { state, dom };
}

function createErrorBuffer(page) {
    const errors = [];
    page.on('console', (message) => {
        if (message.type() === 'error') {
            errors.push({ type: 'console', text: message.text() });
        }
    });
    page.on('pageerror', (error) => {
        errors.push({ type: 'pageerror', text: String(error) });
    });
    return errors;
}

async function getCenter(locator) {
    const box = await locator.boundingBox();
    assertCondition(box, 'Expected locator to have a bounding box');
    return {
        x: box.x + box.width / 2,
        y: box.y + box.height / 2,
        width: box.width,
        height: box.height,
    };
}

async function moveMouseTo(locator, page) {
    const point = await getCenter(locator);
    await page.mouse.move(point.x, point.y);
    return point;
}

async function dispatchTouchPointer(locator, type, pointerId, point) {
    await locator.dispatchEvent(type, {
        pointerId,
        pointerType: 'touch',
        isPrimary: true,
        bubbles: true,
        cancelable: true,
        clientX: point.x,
        clientY: point.y,
    });
}

async function dispatchWindowTouch(page, type, pointerId, point) {
    await page.evaluate(({ eventType, activePointerId, x, y }) => {
        const event = new Event(eventType, { bubbles: true, cancelable: true });
        Object.assign(event, {
            pointerId: activePointerId,
            pointerType: 'touch',
            isPrimary: true,
            clientX: x,
            clientY: y,
        });
        window.dispatchEvent(event);
    }, { eventType: type, activePointerId: pointerId, x: point.x, y: point.y });
}

async function stageUnitAndItem(page) {
    await page.evaluate(() => {
        const debug = window.debug;
        if (!debug?.game) {
            throw new Error('window.debug.game unavailable');
        }
        const player = debug.game.state.players[0];
        const source = player.hand[0] ?? player.levelZone;
        if (!source) {
            throw new Error('No source card available for unit/item staging');
        }
        const zone = player.unitZones[0];
        zone.unit = {
            ...source,
            id: 'QA-UNIT-001',
            name: 'QA Unit',
            type: 'UNIT',
            power: source.power ?? 1000,
            hit: source.hit ?? 1000,
        };
        zone.items = [{
            ...source,
            id: 'QA-ITEM-001',
            name: 'QA Item',
            type: 'ITEM',
        }];
        debug.renderCallback();
    });
    await page.waitForTimeout(100);
}

async function stageTrashAndDamage(page) {
    await page.evaluate(() => {
        const debug = window.debug;
        if (!debug?.game) {
            throw new Error('window.debug.game unavailable');
        }
        const player = debug.game.state.players[0];
        const source = player.hand[0] ?? player.levelZone;
        if (!source) {
            throw new Error('No source card available for trash/damage staging');
        }
        player.trash = [{
            ...source,
            id: 'QA-TRASH-001',
            name: 'QA Trash',
            type: 'UNIT',
        }];
        player.damage = [{
            ...source,
            id: 'QA-DAMAGE-001',
            name: 'QA Damage',
            type: 'UNIT',
        }];
        debug.renderCallback();
    });
    await page.waitForTimeout(100);
}

async function recordScenario(page, summary, scenario, screenshotName, extra = {}) {
    summary.push({
        scenario,
        ...(await getQaSnapshot(page)),
        screenshot: await capture(page, screenshotName),
        ...extra,
    });
}

async function runDesktopScenarios(browser) {
    const context = await browser.newContext({ viewport: { width: 1600, height: 900 } });
    const page = await context.newPage();
    const errors = createErrorBuffer(page);
    const summary = [];

    await waitForApp(page);
    await startQuickPlay(page);

    const handCard = page.locator('.hand-zone .card-in-hand').first();
    await handCard.hover();
    await page.waitForTimeout(250);
    const handHoverState = await getQaState(page);
    assertCondition(handHoverState?.hoverPreview?.visible === true, 'Desktop hand hover did not open preview');
    await recordScenario(page, summary, 'desktop-hand-hover-show', 'desktop-hand-hover');

    await page.mouse.move(20, 20);
    await page.waitForTimeout(180);
    const handHideState = await getQaState(page);
    assertCondition(handHideState?.hoverPreview?.visible === false, 'Desktop hand hover preview did not hide after leaving card');
    await recordScenario(page, summary, 'desktop-hand-hover-hide', 'desktop-hand-hover-hide');

    await stageUnitAndItem(page);
    const unitZone = page.locator('.current .unit-zone[data-index="0"]').first();
    const miniItem = page.locator('.current .mini-item-card').first();
    await unitZone.hover();
    await page.waitForTimeout(150);
    const unitPreviewState = await getQaState(page);
    assertCondition(unitPreviewState?.hoverPreview?.cardName === 'QA Unit', 'Unit hover preview did not show the staged unit');

    await miniItem.hover();
    await page.waitForTimeout(150);
    const itemPreviewState = await getQaState(page);
    assertCondition(itemPreviewState?.hoverPreview?.cardName === 'QA Item', 'Mini-item hover preview did not switch to the staged item');

    await moveMouseTo(unitZone, page);
    await page.waitForTimeout(150);
    const backToUnitState = await getQaState(page);
    assertCondition(backToUnitState?.hoverPreview?.cardName === 'QA Unit', 'Preview did not restore the unit immediately after leaving the mini-item');
    await recordScenario(page, summary, 'desktop-unit-item-transition', 'desktop-unit-item-transition');

    await page.mouse.move(30, 30);
    await page.waitForTimeout(150);
    const afterBoundaryLeaveState = await getQaState(page);
    assertCondition(afterBoundaryLeaveState?.hoverPreview?.visible === false, 'Preview remained visible after leaving the unit/item boundary path');

    await stageTrashAndDamage(page);
    const trashZone = page.locator('.current .trash-zone').first();
    const damageZone = page.locator('.current .damage-zone').first();

    await trashZone.hover();
    await page.waitForTimeout(150);
    let overlayState = await getQaState(page);
    assertCondition(overlayState?.trashOverlay?.active === true, 'Trash summary overlay did not open');

    const overlay = page.locator('.trash-hover-overlay.active').first();
    await moveMouseTo(overlay, page);
    await page.waitForTimeout(180);
    overlayState = await getQaState(page);
    assertCondition(overlayState?.trashOverlay?.active === true, 'Trash summary overlay closed while pointer moved into the overlay');
    await recordScenario(page, summary, 'desktop-overlay-hold-open', 'desktop-overlay-hold-open');

    await page.mouse.move(20, 20);
    await page.waitForTimeout(220);
    overlayState = await getQaState(page);
    assertCondition(overlayState?.trashOverlay?.active === false, 'Trash summary overlay did not close after leaving both zone and overlay');

    await trashZone.hover();
    await page.waitForTimeout(120);
    await damageZone.hover();
    await page.waitForTimeout(150);
    const trashStillActive = await trashZone.evaluate((el) => el.classList.contains('selection-zone-active'));
    const damageActive = await damageZone.evaluate((el) => el.classList.contains('selection-zone-active'));
    assertCondition(trashStillActive === false && damageActive === true, 'Overlay anchor highlight did not move from trash to damage');
    await recordScenario(page, summary, 'desktop-overlay-anchor-switch', 'desktop-overlay-anchor-switch', {
        trashStillActive,
        damageActive,
    });

    await page.evaluate(() => window.__naPreviewDebug.hideAll());
    await page.mouse.move(20, 20);
    await page.waitForTimeout(180);
    await handCard.hover();
    await page.waitForTimeout(200);
    const beforeResize = await getQaState(page);
    assertCondition(beforeResize?.hoverPreview?.visible === true, 'Preview was not visible before resize dismissal check');
    await page.setViewportSize({ width: 1280, height: 720 });
    await page.waitForTimeout(220);
    const afterResize = await getQaState(page);
    assertCondition(afterResize?.hoverPreview?.visible === false, 'Preview remained visible after viewport resize');
    assertCondition(afterResize?.trashOverlay?.active === false, 'Overlay remained active after viewport resize');
    await recordScenario(page, summary, 'desktop-resize-dismiss', 'desktop-resize-dismiss');

    await page.setViewportSize({ width: 1600, height: 900 });
    await page.waitForTimeout(220);

    await stageUnitAndItem(page);
    const unitPoint = await getCenter(unitZone);
    const itemPoint = await getCenter(miniItem);
    for (let i = 0; i < 4; i += 1) {
        await page.mouse.move(unitPoint.x, unitPoint.y);
        await page.waitForTimeout(35);
        await page.mouse.move(itemPoint.x, itemPoint.y);
        await page.waitForTimeout(35);
    }
    await page.mouse.move(10, 10);
    await page.waitForTimeout(180);
    const afterWiggle = await getQaState(page);
    assertCondition(afterWiggle?.hoverPreview?.visible === false, 'Preview stayed stuck after rapid unit/item boundary movement');
    await recordScenario(page, summary, 'desktop-exploratory-wiggle-clear', 'desktop-exploratory-wiggle-clear');

    await stageTrashAndDamage(page);
    await trashZone.hover();
    await page.waitForTimeout(60);
    await damageZone.hover();
    await page.waitForTimeout(60);
    await trashZone.hover();
    await page.waitForTimeout(60);
    await page.mouse.move(10, 10);
    await page.waitForTimeout(200);
    const overlayClearState = await getQaSnapshot(page);
    assertCondition(overlayClearState.state?.trashOverlay?.active === false, 'Overlay remained active after fast zone switching and exit');
    assertCondition(overlayClearState.dom.activeAnchors.length === 0, 'Anchor highlight remained after fast zone switching and exit');
    await recordScenario(page, summary, 'desktop-exploratory-overlay-clear', 'desktop-exploratory-overlay-clear');

    await handCard.hover();
    await page.waitForTimeout(180);
    const beforeMenu = await getQaState(page);
    assertCondition(beforeMenu?.hoverPreview?.visible === true, 'Preview was not visible before screen transition check');
    await page.click('#db-back-to-menu');
    await page.waitForTimeout(180);
    const afterMenu = await getQaState(page);
    assertCondition(afterMenu?.screen === 'MENU', 'Screen transition did not reach menu');
    assertCondition(afterMenu?.hoverPreview?.visible === false, 'Preview remained visible after screen transition');
    assertCondition(afterMenu?.trashOverlay?.active === false, 'Overlay remained visible after screen transition');
    await recordScenario(page, summary, 'desktop-screen-transition-dismiss', 'desktop-screen-transition-dismiss');

    const result = {
        targetUrl: TARGET_URL,
        viewport: { width: 1600, height: 900 },
        errors,
        scenarios: summary,
    };
    await writeJson('desktop-summary', result);
    assertCondition(errors.length === 0, `Desktop QA encountered console/page errors: ${JSON.stringify(errors)}`);
    await context.close();
}

async function runMobileScenarios(browser) {
    const context = await browser.newContext({
        viewport: { width: 390, height: 844 },
        isMobile: true,
        hasTouch: true,
    });
    const page = await context.newPage();
    const errors = createErrorBuffer(page);
    const summary = [];

    await waitForApp(page);
    await startQuickPlay(page);

    const handCard = page.locator('.hand-zone .card-in-hand').first();
    const handPoint = await getCenter(handCard);
    await page.touchscreen.tap(handPoint.x, handPoint.y);
    await page.waitForTimeout(120);
    let handState = await getQaState(page);
    assertCondition(handState?.hoverPreview?.visible === false, 'Mobile tap opened preview unexpectedly');
    await recordScenario(page, summary, 'mobile-tap-no-preview', 'mobile-tap-no-preview');

    const handPointerId = 21;
    await dispatchTouchPointer(handCard, 'pointerdown', handPointerId, handPoint);
    await page.waitForTimeout(420);
    handState = await getQaState(page);
    assertCondition(handState?.hoverPreview?.visible === true, 'Mobile hand long-press did not open preview');
    await recordScenario(page, summary, 'mobile-long-press-hand-show', 'mobile-long-press-hand-show');

    await dispatchWindowTouch(page, 'pointerup', handPointerId, {
        x: handPoint.x + 120,
        y: handPoint.y - 260,
    });
    await page.waitForTimeout(180);
    handState = await getQaState(page);
    assertCondition(handState?.hoverPreview?.visible === false, 'Mobile hand long-press preview did not hide after outside release');
    await recordScenario(page, summary, 'mobile-outside-release-hide', 'mobile-outside-release-hide');

    await stageUnitAndItem(page);
    const miniItem = page.locator('.current .mini-item-card').first();
    const miniItemPoint = await getCenter(miniItem);
    const miniPointerId = 33;
    await dispatchTouchPointer(miniItem, 'pointerdown', miniPointerId, miniItemPoint);
    await page.waitForTimeout(420);
    let miniItemState = await getQaState(page);
    assertCondition(miniItemState?.hoverPreview?.cardName === 'QA Item', 'Mobile mini-item long-press did not show the attached item preview');
    await recordScenario(page, summary, 'mobile-mini-item-long-press', 'mobile-mini-item-long-press');

    await dispatchWindowTouch(page, 'pointerup', miniPointerId, miniItemPoint);
    await page.waitForTimeout(180);
    miniItemState = await getQaState(page);
    assertCondition(miniItemState?.hoverPreview?.visible === false, 'Mobile mini-item preview did not hide on release');

    const fixtureShown = await page.evaluate(() => window.__naPreviewDebug.showOverlayFixture({
        anchorSelector: '.current .damage-zone',
        zoneLabel: 'QA Overlay',
        interactive: true,
        selectableIndexes: [0],
        hideOnSelect: false,
        cards: [{ id: 'qa-overlay-touch-1', name: 'QA Overlay Touch 1', type: 'UNIT' }],
    }));
    assertCondition(fixtureShown === true, 'Failed to stage overlay fixture for mobile overlay-card QA');

    const overlayCard = page.locator('.trash-hover-card[data-index="0"]').first();
    const overlayPoint = await getCenter(overlayCard);
    const overlayPointerId = 45;
    await dispatchTouchPointer(overlayCard, 'pointerdown', overlayPointerId, overlayPoint);
    await page.waitForTimeout(420);
    let overlayCardState = await getQaState(page);
    assertCondition(overlayCardState?.hoverPreview?.cardName === 'QA Overlay Touch 1', 'Mobile overlay-card long-press did not open preview');
    await recordScenario(page, summary, 'mobile-overlay-card-long-press', 'mobile-overlay-card-long-press');

    await dispatchWindowTouch(page, 'pointerup', overlayPointerId, {
        x: overlayPoint.x + 140,
        y: overlayPoint.y + 160,
    });
    await page.waitForTimeout(180);
    overlayCardState = await getQaState(page);
    assertCondition(overlayCardState?.hoverPreview?.visible === false, 'Mobile overlay-card preview did not hide after outside release');

    await overlayCard.click();
    await page.waitForTimeout(100);
    let fixtureStats = await page.evaluate(() => window.__naPreviewDebug.getFixtureStats());
    assertCondition(fixtureStats.overlaySelectCount === 0, 'Overlay card accepted the first click after long-press instead of suppressing it');

    await overlayCard.click();
    await page.waitForTimeout(100);
    fixtureStats = await page.evaluate(() => window.__naPreviewDebug.getFixtureStats());
    assertCondition(fixtureStats.overlaySelectCount === 1 && fixtureStats.lastSelectedOverlayIndex === 0, 'Overlay card did not accept the second click after long-press suppression');

    const contextMenuPrevented = await page.evaluate(() => {
        const card = document.querySelector('.trash-hover-card[data-index="0"]');
        if (!(card instanceof HTMLElement)) return false;
        const event = new MouseEvent('contextmenu', { bubbles: true, cancelable: true });
        card.dispatchEvent(event);
        return event.defaultPrevented;
    });
    assertCondition(contextMenuPrevented === true, 'Overlay card did not prevent context menu in mobile/touch mode');
    await recordScenario(page, summary, 'mobile-overlay-card-click-suppression', 'mobile-overlay-card-click-suppression', {
        fixtureStats,
        contextMenuPrevented,
    });

    const result = {
        targetUrl: TARGET_URL,
        viewport: { width: 390, height: 844 },
        errors,
        scenarios: summary,
    };
    await writeJson('mobile-summary', result);
    assertCondition(errors.length === 0, `Mobile QA encountered console/page errors: ${JSON.stringify(errors)}`);
    await context.close();
}

async function main() {
    const browser = await chromium.launch({ headless: HEADLESS });
    try {
        await runDesktopScenarios(browser);
        await runMobileScenarios(browser);
    } finally {
        await browser.close();
    }
}

main().catch((error) => {
    console.error(error);
    process.exit(1);
});
