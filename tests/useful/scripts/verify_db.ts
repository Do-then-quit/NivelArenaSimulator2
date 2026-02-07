import { DUMMY_CARDS } from '../../../src/logic/CardDatabase';

console.log(`Loaded ${DUMMY_CARDS.length} cards.`);

const leader = DUMMY_CARDS.find(c => c.id === 'ST02-001');
if (leader) {
    console.log(`Leader: ${leader.name}, Type: ${leader.type}, Cost: ${leader.cost}`);
} else {
    console.error("Leader ST02-001 not found!");
    process.exit(1);
}

const unit = DUMMY_CARDS.find(c => c.id === 'ST02-002');
if (unit) {
    console.log(`Unit: ${unit.name}, Type: ${unit.type}, Power: ${unit.power}, Hit: ${unit.hit}`);
} else {
    console.error("Unit ST02-002 not found!");
    process.exit(1);
}

const skill = DUMMY_CARDS.find(c => c.id === 'ST02-012');
if (skill) {
    console.log(`Skill: ${skill.name}, Type: ${skill.type}`);
} else {
    console.error("Skill ST02-012 not found!");
    process.exit(1);
}

const withEffects = DUMMY_CARDS.find(c => c.id === 'ST02-007');
if (withEffects && withEffects.effects && withEffects.effects.length > 0) {
    console.log(`Card with effects: ${withEffects.name}, Effects count: ${withEffects.effects.length}`);
} else {
    console.error("Card ST02-007 effects not found or empty!");
    process.exit(1);
}

console.log("Database Verification Successful!");
