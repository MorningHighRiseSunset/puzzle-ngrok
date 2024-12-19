const Logger = require('./logger.js');
const axios = require('axios');

class DictionaryService {
    constructor() {
        this.cache = new Map();
        
        // Common valid two-letter words in English Scrabble
        this.VALID_TWO_LETTER_WORDS = new Set([
            'ad', 'am', 'an', 'as', 'at', 'be', 'by', 'do', 'go', 'he',
            'hi', 'if', 'in', 'is', 'it', 'me', 'my', 'no', 'of', 'on',
            'or', 'so', 'to', 'up', 'us', 'we'
        ]);

        // Common valid three-letter words that might be rejected by APIs
        this.VALID_THREE_LETTER_WORDS = new Set([
            'ace', 'act', 'add', 'age', 'ago', 'aid', 'aim', 'air', 'all',
            'and', 'any', 'apt', 'art', 'ash', 'ask', 'ate', 'bad', 'bag',
            'ban', 'bar', 'bat', 'bay', 'bed', 'bee', 'beg', 'bet', 'bid',
            'big', 'bit', 'box', 'boy', 'bug', 'bus', 'but', 'buy', 'can',
            'cap', 'car', 'cat', 'cow', 'cry', 'cup', 'cut', 'day', 'die',
            'dig', 'dim', 'dip', 'dog', 'dot', 'dry', 'due', 'dug', 'ear',
            'eat', 'egg', 'ego', 'end', 'era', 'eye', 'far', 'fat', 'fee',
            'few', 'fig', 'fit', 'fix', 'fly', 'fog', 'for', 'fox', 'fun',
            'fur', 'gas', 'get', 'got', 'gun', 'gut', 'guy', 'gym', 'had',
            'ham', 'has', 'hat', 'hay', 'her', 'hey', 'him', 'hip', 'hit',
            'hop', 'hot', 'how', 'hub', 'hue', 'hug', 'hut', 'ice', 'ill',
            'ink', 'inn', 'ion', 'its', 'jar', 'jaw', 'jay', 'jet', 'job',
            'jog', 'joy', 'key', 'kid', 'kit', 'lab', 'lag', 'lap', 'law',
            'lay', 'leg', 'let', 'lid', 'lie', 'lip', 'lit', 'log', 'lot',
            'low', 'mad', 'man', 'map', 'mat', 'may', 'men', 'met', 'mix',
            'mob', 'mom', 'mop', 'mud', 'mug', 'nap', 'net', 'new', 'nod',
            'not', 'now', 'nun', 'nut', 'oak', 'odd', 'off', 'oil', 'old',
            'one', 'our', 'out', 'owe', 'owl', 'own', 'pad', 'pan', 'par',
            'pat', 'pay', 'pen', 'pet', 'pig', 'pin', 'pit', 'pop', 'pot',
            'pro', 'put', 'rad', 'rag', 'ram', 'ran', 'rap', 'rat', 'raw',
            'ray', 'red', 'rib', 'rid', 'rim', 'rip', 'rob', 'rod', 'rot',
            'row', 'rub', 'rug', 'run', 'sad', 'sat', 'saw', 'say', 'sea',
            'see', 'set', 'sew', 'she', 'shy', 'sin', 'sip', 'sir', 'sit',
            'six', 'ski', 'sky', 'sly', 'son', 'spy', 'sum', 'sun', 'tab',
            'tag', 'tan', 'tap', 'tar', 'tax', 'tea', 'ten', 'the', 'tie',
            'tin', 'tip', 'toe', 'too', 'top', 'toy', 'try', 'tub', 'two',
            'use', 'van', 'vat', 'vet', 'via', 'war', 'was', 'wax', 'way',
            'web', 'wed', 'wet', 'who', 'why', 'win', 'wit', 'won', 'yes',
            'yet', 'you', 'zip', 'zoo'
        ]);

        // Words that should be specifically disallowed despite being in APIs
        this.DISALLOWED_WORDS = new Set([
            'aa',   // volcanic rock
            'ae',   // Scottish one
            'ag',   // agriculture abbreviation
            'ai',   // three-toed sloth
            'ed',   // education abbreviation
            'ef',   // letter F
            'eh',   // interjection
            'el',   // elevated train
            'em',   // printing measure
            'er',   // hesitation
            'es',   // musical note
            'et',   // and (Latin)
            'ex',   // former spouse
            'fa',   // musical note
            'fe',   // symbol for iron
            'gi',   // martial arts uniform
            'ha',   // interjection
            'hm',   // interjection
            'id',   // psychology term
            'ki',   // vital force (Chinese)
            'la',   // musical note
            'li',   // Chinese distance measure
            'lo',   // look
            'ma',   // mother
            'mi',   // musical note
            'mm',   // interjection
            'mo',   // moment
            'mu',   // Greek letter
            'na',   // not applicable
            'ne',   // born as
            'oh',   // interjection
            'om',   // spiritual symbol
            'op',   // operative
            'os',   // bone prefix
            'ow',   // interjection
            'ox',   // already in valid words if needed
            'oy',   // interjection
            'pa',   // father
            'pe',   // Hebrew letter
            'pi',   // Greek letter
            'po',   // chamber pot
            'qi',   // Chinese vital force
            're',   // about
            'sh',   // interjection
            'si',   // musical note
            'ta',   // thanks
            'ti',   // musical note
            'um',   // interjection
            'un',   // one (French)
            'ut',   // musical note
            'uh',   // interjection
            'wo',   // woe
            'xi',   // Greek letter
            'xu',   // Vietnamese money
            'ya',   // you
            'ye',   // you (archaic)
            'yo',   // interjection
            'za'    // pizza
        ]);

        // Three-letter words that should be specifically disallowed
        this.DISALLOWED_THREE_LETTER_WORDS = new Set([
            'gax',   // not a real word
            'zex',   // not a real word
            'kax',   // not a real word
            'jax',   // proper noun/brand name
            'vax',   // informal/slang
            'fax',   // informal shortening
            'hox',   // not a real word
            'qix',   // not a real word
            'wex',   // not a real word
            'yox'    // not a real word
        ]);
    }

    async findWord(word) {
        word = word.toLowerCase().trim();

        // Check if word is explicitly disallowed
        if (this.DISALLOWED_WORDS.has(word)) {
            Logger.warn(`Word "${word}" is in disallowed list`);
            return false;
        }

        // Check if three-letter word is explicitly disallowed
        if (word.length === 3 && this.DISALLOWED_THREE_LETTER_WORDS.has(word)) {
            Logger.warn(`Three-letter word "${word}" is in disallowed list`);
            return false;
        }

        // Check if word is in valid two-letter words list
        if (word.length === 2 && this.VALID_TWO_LETTER_WORDS.has(word)) {
            return true;
        }

        // Check if word is in valid three-letter words list
        if (word.length === 3 && this.VALID_THREE_LETTER_WORDS.has(word)) {
            return true;
        }

        // Check cache for longer words
        if (this.cache.has(word)) {
            return this.cache.get(word);
        }

        // For longer words, validate against dictionary APIs
        if (word.length >= 4) {
            try {
                // Try Free Dictionary API first
                const exists = await this.checkFreeDictionaryAPI(word);
                this.cache.set(word, exists);
                return exists;
            } catch (error) {
                Logger.warn(`Free Dictionary API failed, trying Datamuse API for: ${word}`);
                
                try {
                    // Fallback to Datamuse API
                    const exists = await this.checkDatamuseAPI(word);
                    this.cache.set(word, exists);
                    return exists;
                } catch (err) {
                    Logger.error(`Both APIs failed for word: ${word}`);
                    return false;
                }
            }
        }

        return false;
    }

    async checkFreeDictionaryAPI(word) {
        try {
            const response = await axios.get(`https://api.dictionaryapi.dev/api/v2/entries/en/${word}`);
            return response.status === 200;
        } catch (error) {
            if (error.response && error.response.status === 404) {
                return false;
            }
            throw error;
        }
    }

    async checkDatamuseAPI(word) {
        try {
            const response = await axios.get(`https://api.datamuse.com/words?sp=${word}&md=f&max=1`);
            if (response.data && response.data.length > 0) {
                // Check if the word matches exactly and has reasonable frequency
                const result = response.data[0];
                if (result.word === word) {
                    // If word has frequency data, check if it's common enough
                    if (result.tags && result.tags.some(tag => tag.startsWith('f:'))) {
                        const freq = parseFloat(result.tags.find(tag => tag.startsWith('f:')).slice(2));
                        // Adjust this threshold as needed
                        return freq > 0.1;
                    }
                    return true;
                }
            }
            return false;
        } catch (error) {
            Logger.error(`Datamuse API error: ${error.message}`);
            return false;
        }
    }

    clearCache() {
        this.cache.clear();
        Logger.info('Dictionary cache cleared');
    }
}

const dictionaryService = new DictionaryService();

async function FindWord(lang, word) {
    // Currently only supporting English
    if (lang !== 'en') {
        Logger.warn(`Language ${lang} not supported yet`);
        return false;
    }

    try {
        return await dictionaryService.findWord(word);
    } catch (error) {
        Logger.error(`Error checking word ${word}: ${error.message}`);
        return false;
    }
}

module.exports = {
    FindWord,
    clearDictionaryCache: () => dictionaryService.clearCache()
};
