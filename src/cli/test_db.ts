
import { CardDatabase } from '../logic/CardDatabase';

try {
    console.log("Testing CardDatabase...");
    const db = CardDatabase.getInstance();
    const cards = db.getAllCards();
    console.log(`Loaded ${cards.length} cards.`);

    const card = db.getCard('ST04-001');
    if (card) {
        console.log("Sample card loaded:", card.name);
    } else {
        console.log("Sample card ST04-001 NOT found.");
    }
} catch (e) {
    console.error("CardDatabase Test Failed:", e);
}
