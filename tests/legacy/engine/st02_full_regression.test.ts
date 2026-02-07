import { execSync } from 'child_process';

const testFiles = [
    'tests/penetration.test.ts',
    'tests/plunder.test.ts',
    'tests/dualist.test.ts',
    'tests/st02_001_003.test.ts',
    'tests/st02_004_006.test.ts',
    'tests/st02_007_009.test.ts',
    'tests/st02_010_012.test.ts',
    'tests/st02_013_015.test.ts',
    'tests/st02_016_017.test.ts'
];

console.log("Starting Global Regression Test for ST02 Card Pack...");

let passCount = 0;
let failCount = 0;

for (const file of testFiles) {
    console.log(`\n--- Running ${file} ---`);
    try {
        const output = execSync(`npx tsx ${file}`, { encoding: 'utf-8' });
        console.log(output);
        passCount++;
    } catch (error: any) {
        console.error(`FAILED: ${file}`);
        console.error(error.stdout);
        console.error(error.stderr);
        failCount++;
    }
}

console.log("\n========================================");
console.log(`ST02 Regression Completed.`);
console.log(`Passed: ${passCount}`);
console.log(`Failed: ${failCount}`);
console.log("========================================");

if (failCount > 0) {
    process.exit(1);
} else {
    process.exit(0);
}
