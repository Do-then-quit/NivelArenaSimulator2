
export interface CLICommand {
    type: 'PLAY' | 'ATTACK' | 'SELECT' | 'CONFIRM' | 'CANCEL' | 'PASS' | 'EXIT' | 'HELP' | 'DEBUG' | 'UNKNOWN';
    args: string[];
}

export class CommandParser {
    parse(input: string): CLICommand {
        const parts = input.trim().split(/\s+/);
        if (parts.length === 0 || parts[0] === '') {
            return { type: 'UNKNOWN', args: [] };
        }

        const command = parts[0].toLowerCase();
        const args = parts.slice(1);

        switch (command) {
            case 'play':
                return { type: 'PLAY', args };
            case 'attack':
            case 'a':
                return { type: 'ATTACK', args };
            case 'select':
            case 's':
            case 'target': // Alias
                return { type: 'SELECT', args };
            case 'confirm':
            case 'yes':
                return { type: 'CONFIRM', args };
            case 'cancel':
            case 'no':
                return { type: 'CANCEL', args };
            case 'pass':
            case 'end':
            case 'next':
                return { type: 'PASS', args };
            case 'exit':
            case 'quit':
                return { type: 'EXIT', args };
            case 'debug':
                return { type: 'DEBUG', args };
            case 'help':
                return { type: 'HELP', args };
            default:
                return { type: 'UNKNOWN', args };
        }
    }
}
