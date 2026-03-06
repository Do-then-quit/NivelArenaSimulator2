import { Card } from '../logic/types';

export interface RenderCardOptions {
    extraClasses?: string[];
    dataAttributes?: Record<string, string | number | boolean | null | undefined>;
}

function buildAttributeString(
    dataAttributes: Record<string, string | number | boolean | null | undefined> | undefined,
): string {
    if (!dataAttributes) return '';
    return Object.entries(dataAttributes)
        .filter(([, value]) => value !== null && value !== undefined && value !== false)
        .map(([key, value]) => {
            const renderedValue = value === true ? '' : `="${escapeHtml(String(value))}"`;
            return ` ${key}${renderedValue}`;
        })
        .join('');
}

export function escapeHtml(text: string): string {
    return text
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

export function renderCard(
    card: Card,
    isSmall: boolean = false,
    _calculatedPower?: number,
    _calculatedHit?: number,
    options?: RenderCardOptions,
): string {
    const attributeClass = (card.attribute || 'NONE').toString().toLowerCase();
    const safeName = escapeHtml(card.name || card.id || 'Unknown');
    const safeId = escapeHtml(card.id || '');
    const safeText = escapeHtml(card.text || '');
    const extraClasses = options?.extraClasses?.filter(Boolean) ?? [];
    const attrString = buildAttributeString(options?.dataAttributes);
    const className = [
        'card',
        attributeClass,
        isSmall ? 'small-card' : '',
        card.isAwakened ? 'awakened' : '',
        card.imageUrl ? '' : 'card-text-fallback',
        ...extraClasses,
    ].filter(Boolean).join(' ');

    return `
        <div class="${className}"${attrString}>
            ${card.imageUrl
            ? `<img src="${card.imageUrl}" class="card-image" alt="${safeName}">`
            : `
                <div class="card-fallback">
                    <div class="card-fallback-id">${safeId}</div>
                    <div class="card-fallback-name">${safeName}</div>
                    ${safeText ? `<div class="card-fallback-text">${safeText}</div>` : ''}
                </div>
            `}
        </div>
    `;
}

export function renderHiddenHandCard(isSmall: boolean = false, options?: RenderCardOptions): string {
    const extraClasses = options?.extraClasses?.filter(Boolean) ?? [];
    const attrString = buildAttributeString(options?.dataAttributes);
    const className = [
        'card',
        'card-back',
        isSmall ? 'small-card' : '',
        ...extraClasses,
    ].filter(Boolean).join(' ');
    return `
        <div class="${className}"${attrString}>
            <div class="card-back-pattern"></div>
            <div class="card-back-label">HIDDEN</div>
        </div>
    `;
}
