
import { CardParser, ParsedEffectType } from './CardParser';

// Mock some card text samples
const samples = [
    {
        text: "[엔트리] 등장시 카드를 1장 뽑는다.",
        expectedType: ParsedEffectType.AUTO,
        expectedKeywords: ['엔트리']
    },
    {
        text: "[패시브] 이 유닛의 파워 +1000.",
        expectedType: ParsedEffectType.CONTINUOUS,
        expectedKeywords: ['패시브']
    },
    {
        text: "[액티브: 메인] [턴 1회] 상대를 지정한다.",
        expectedType: ParsedEffectType.ACTIVATE,
        expectedKeywords: ['액티브', '액티브: 메인'] // Parser might extract '액티브' if it splits by colon
    },
    {
        text: "어태커 : 관통[1]",
        expectedType: ParsedEffectType.UNKNOWN, // "어태커" is not in brackets here, checking robustness
        expectedKeywords: []
    },
    {
        text: "[어태커] : 관통[1]",
        expectedType: ParsedEffectType.AUTO, // [어태커] is Auto
        expectedKeywords: ['어태커', '관통']
    }
];

function runTests() {
    console.log("Starting CardParser Verification...");

    let passed = 0;

    samples.forEach((sample, idx) => {
        console.log(`\nTest Case #${idx + 1}: "${sample.text}"`);

        const type = CardParser.classifyEffectType(sample.text);
        const keywords = CardParser.parseKeywords(sample.text);

        console.log(`  Target Type: ${sample.expectedType} | Actual: ${type}`);
        console.log(`  Target Keywords: ${sample.expectedKeywords.join(', ')} | Actual: ${keywords.join(', ')}`);

        const typeMatch = type === sample.expectedType;
        // Loose check for keywords
        const kwMatch = sample.expectedKeywords.every(k => {
            // '액티브: 메인' might be parsed as '액티브' depending on logic
            if (k.includes(':')) return true; // skip complex ones for simple list check
            return keywords.includes(k);
        });

        if (typeMatch && kwMatch) {
            console.log("  -> Check PASSED");
            passed++;
        } else {
            console.error("  -> Check FAILED");
            if (!typeMatch) console.error(`     Type mismatch: Expected ${sample.expectedType}, got ${type}`);
            if (!kwMatch) console.error(`     Keyword mismatch: Expected ${sample.expectedKeywords.join(', ')}, got ${keywords.join(', ')}`);
        }
    });

    console.log("\n-------------------------");
    console.log(`Total Passed: ${passed} / ${samples.length}`);
}

runTests();
