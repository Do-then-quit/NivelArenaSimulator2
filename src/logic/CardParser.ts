

export enum ParsedEffectType {
    AUTO = 'AUTO',
    ACTIVATE = 'ACTIVATE',
    CONTINUOUS = 'CONTINUOUS',
    TRIGGER = 'TRIGGER',
    UNKNOWN = 'UNKNOWN'
}

export class CardParser {
    // Regex Definitions per GameLogicDetailProposal.md

    // Auto: [엔트리], [엑시트], [어태커], [디펜더], [이스케이프], [가디언], [공멸], [관통], [약탈], [종결], [침투], [듀얼리스트]
    private static AUTO_PATTERN = /\[(엔트리|엑시트|어태커|디펜더|이스케이프|가디언|공멸|관통|약탈|종결|침투|듀얼리스트)\]/;

    // Activate: [액티브: 메인], [액티브: 어택], [스킬], [기동]
    // Note: '스킬' usually refers to Skill Cards, effectively Active.
    private static ACTIVATE_PATTERN = /\[(액티브\s*:\s*메인|액티브\s*:\s*어택|액티브|기동)\]/;

    // Continuous: [패시브], [암드], [전선구축], [레벨링크], [믹스], [광전사], [아이템 기본효과]
    // Added '돌파' (Breakthrough) as it's often continuous/passive-like or auto depending on impl, 
    // but typically modifies blocking rules. Proposal listed keywords under Auto? 
    // Wait, Proposal 3.1 says Breakthrough is a Keyword Check in Attack Declaration.
    // 4.1 says:
    // TYPE_AUTO: [엔트리] ... [관통], [약탈] ...
    // TYPE_CONTINUOUS: [패시브] ... [전선구축], [레벨링크], [믹스], [광전사]
    // Let's stick to Proposal 4.1 list.
    private static CONTINUOUS_PATTERN = /\[(패시브|암드|전선구축|레벨링크|믹스|광전사|아이템 기본효과)\]/;

    // Trigger: [트리거 / ~]
    private static TRIGGER_PATTERN = /\[(트리거)[\s\/]*.*?\]/;

    /**
     * Extracts keywords and categorizes them.
     */
    public static parseKeywords(text: string): string[] {
        const keywords = new Set<string>();
        if (!text) return [];

        // Simple regex to find all [...] patterns to extract potential keywords
        // This is a broad extraction to catch anything in brackets
        const bracketRegex = /\[([^\]]+)\]/g;
        let match;
        while ((match = bracketRegex.exec(text)) !== null) {
            // content inside brackets, e.g. "액티브: 메인" or "관통: 1"
            let content = match[1];

            // Normalize: remove values like ": 1" or "(3)"
            // e.g., "관통: 1" -> "관통"
            const keywordOnly = content.split(/[:\(\/\s]/)[0];

            if (CardParser.isValidKeyword(keywordOnly)) {
                keywords.add(keywordOnly);
            }
        }

        // Also scan for specific known keywords that might appear without full brackets
        // e.g., "관통[1]", "약탈[1]"
        // FIX: Use negative lookbehind to avoid matching keywords inside conditions (e.g., "어태커 : 관통")
        const abilityKeywords = ['관통', '약탈', '광전사', '전선구축', '레벨링크', '돌파', '침투', '듀얼리스트'];
        const conditions = '(어태커|엔트리|디펜더|액티브|트리거|패시브)';
        
        abilityKeywords.forEach(kw => {
            try {
                // Regex: Match 'kw' only if NOT immediately preceded by "Condition : "
                // \s* allows for flexible whitespace.
                const regex = new RegExp(`(?<!${conditions}\\s*:\\s*)${kw}`);
                if (regex.test(text)) {
                    keywords.add(kw);
                }
            } catch (e) {
                // Fallback for environments without lookbehind support (shouldn't happen in ES2020+)
                if (text.includes(kw)) {
                    // Primitive check: if "어태커 : kw" exists, don't add? 
                    // This fallback is risky, but better than crashing.
                    // For now, assume lookbehind works.
                    console.warn(`Regex error for ${kw}:`, e);
                }
            }
        });

        return Array.from(keywords);
    }

    private static isValidKeyword(kw: string): boolean {
        const validList = [
            '엔트리', '엑시트', '어태커', '디펜더', '이스케이프', '가디언', '공멸', '관통', '약탈', '종결', '침투', '듀얼리스트',
            '액티브', '기동',
            '패시브', '암드', '전선구축', '레벨링크', '믹스', '광전사', '트리거', '돌파'
        ];
        return validList.includes(kw);
    }

    /**
     * Heuristic to determine the primary Effect Type of a text block.
     * Useful if a card has multiple lines and we want to classify each line.
     */
    public static classifyEffectType(textBlock: string): ParsedEffectType {
        if (CardParser.TRIGGER_PATTERN.test(textBlock)) return ParsedEffectType.TRIGGER;
        if (CardParser.ACTIVATE_PATTERN.test(textBlock)) return ParsedEffectType.ACTIVATE;
        if (CardParser.CONTINUOUS_PATTERN.test(textBlock)) return ParsedEffectType.CONTINUOUS;
        if (CardParser.AUTO_PATTERN.test(textBlock)) return ParsedEffectType.AUTO;

        return ParsedEffectType.UNKNOWN;
    }
}
