import fs from 'fs';
import path from 'path';
import axios from 'axios';

const jsonPath = path.resolve('ST02.json');
const outputDir = path.resolve('public/assets/cards');

async function downloadImages() {
    const data = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));

    for (const card of data) {
        if (card.imageUrl) {
            const fileName = `${card.id}.jpg`;
            const filePath = path.join(outputDir, fileName);

            console.log(`Downloading ${card.id} from ${card.imageUrl}...`);
            try {
                const response = await axios.get(card.imageUrl, { responseType: 'arraybuffer' });
                fs.writeFileSync(filePath, response.data);
                console.log(`Saved ${fileName}`);
            } catch (error) {
                console.error(`Failed to download ${card.id}:`, error.message);
            }
        }
    }
}

downloadImages();
