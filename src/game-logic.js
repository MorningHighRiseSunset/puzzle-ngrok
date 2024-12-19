const Logger = require('./logger.js');
const Registrar = require('./game-registrar.js');
const Lobbies = require('./lobbies.js');
const Dist = require('./letter-distributions.js');
const Dict = require('./dictionary.js');
const Helpers = require('./helpers.js');

let ActiveGames = [];

// Mirrors client's one
// This was automatically generated, the code for it is lonnnggg gone
const BoardLocations = {
    '0,0': 'QW',
    '0,3': 'QL',
    '0,7': 'TW',
    '0,11': 'QL',
    '0,14': 'QW',
    '1,1': 'TW',
    '1,5': 'TL',
    '1,9': 'TL',
    '1,13': 'TW',
    '2,2': 'TW',
    '2,6': 'QL',
    '2,8': 'QL',
    '2,12': 'TW',
    '3,0': 'QL',
    '3,3': 'TW',
    '3,7': 'QL',
    '3,11': 'TW',
    '3,14': 'QL',
    '4,4': 'TW',
    '4,10': 'TW',
    '5,1': 'TL',
    '5,5': 'TL',
    '5,9': 'TL',
    '5,13': 'TL',
    '6,2': 'QL',
    '6,6': 'QL',
    '6,8': 'QL',
    '6,12': 'QL',
    '7,0': 'QW',
    '7,3': 'QL',
    '7,7': 'TL',
    '7,11': 'QL',
    '7,14': 'QW',
    '8,2': 'QL',
    '8,6': 'QL',
    '8,8': 'QL',
    '8,12': 'QL',
    '9,1': 'TL',
    '9,5': 'TL',
    '9,9': 'TL',
    '9,13': 'TL',
    '10,4': 'TW',
    '10,10': 'TW',
    '11,0': 'QL',
    '11,3': 'TW',
    '11,7': 'QL',
    '11,11': 'TW',
    '11,14': 'QL',
    '12,2': 'TW',
    '12,6': 'QL',
    '12,8': 'QL',
    '12,12': 'TW',
    '13,1': 'TW',
    '13,5': 'TL',
    '13,9': 'TL',
    '13,13': 'TW',
    '14,0': 'QW',
    '14,3': 'QL',
    '14,7': 'TW',
    '14,11': 'QL',
    '14,14': 'QW'
};


function GetGameByUserUID(useruid)
{
    for (const game in ActiveGames)
        for (const player of ActiveGames[game].players)
            if (player.uid === useruid) return ActiveGames[game];

    return false;
}

function GetGameUserByUserUID(useruid)
{
    for (const game in ActiveGames)
        for (const player of ActiveGames[game].players)
            if (player.uid === useruid) return player;

    return false;
}

function GetTurnUser(gameuid)
{
    if (!ActiveGames[gameuid]) return false;
    return ActiveGames[gameuid].players[ActiveGames[gameuid].turn];
}


function BeginGame(lobby)
{
    // game uses the owners language - assumes it's valid
    const gameowner = Registrar.GetUserByUID(lobby.owneruid);

    let tilebag = Dist.GenerateStartStateDistribution(gameowner.locale);

    let players = lobby.players.map(i => { return {
        uid: i.uid, 
        name: i.name,
        activetiles: [],
        score: 0
    }});
    
    // shuffle for turn order
    players = Helpers.ShuffleArray(players);
    
    // populate users tile drawer
    for (const player in players)
    {
        // start all players with 7 random tiles
        for (let i = 0; i < 7; i++)
        {
            let t, r;
            do {
                // TODO: this goes out of range
                r = Math.floor(Math.random() * tilebag.length + 1);
                t = tilebag[r];
            } while (t === undefined)
            tilebag.splice(r, 1);
            players[player].activetiles.push(t);
        }
    }

    const gamestate = {
        playeruid: -1,
        turn: 0,
        turntype: '',
        outcome: {
            valid: false
        },
        oldboardtiles: [],
        boardtiles: []
    };

    ActiveGames[lobby.uid] = {
        uid: lobby.uid,
        locale: gameowner.locale,
        players: players,
        turn: 0,
        turntotal: 0,   
        gamestates: [gamestate],
        tilebag: tilebag,
        tileset: Dist.GetTileSet(gameowner.locale)
    };

    return ActiveGames[lobby.uid];
}

function PlayTurn(gameuid, playeruid, turn) {
    const game = ActiveGames[gameuid];
    const turninfo = gameNextTurn(gameuid);

    turn.turn = turninfo.newTurn;
    turn.oldboardtiles = ActiveGames[gameuid].gamestates[ActiveGames[gameuid].gamestates.length - 1].boardtiles;

    // generate diff between oldboardtiles and newboardtiles
    const diff = turnDiff(turn.oldboardtiles, turn.boardtiles);
    if (diff.length === 0) {
        const error = {
            error: 'error-game-no-change'
        };
        return [error, undefined, undefined, undefined];
    }

    // Validate diff pieces before processing
    for (const piece of diff) {
        if (!piece || 
            !piece.pos || 
            piece.pos.x === undefined || 
            piece.pos.y === undefined || 
            !piece.letter) {
            console.log('Malformed piece:', piece);
            const error = {
                error: 'error-game-malformed-tiles'
            };
            return [error, undefined, undefined, undefined];
        }
    }

    // Check if this is the first move
    const isFirstMove = turn.oldboardtiles.length === 0;
    
    // Check if any placed tile is on the center square for first move
    if (isFirstMove) {
        const centerUsed = diff.some(piece => 
            piece.pos.x === 7 && piece.pos.y === 7
        );
        if (!centerUsed) {
            const error = {
                error: 'error-game-must-use-center'
            };
            return [error, undefined, undefined, undefined];
        }
    } else {
        // Check if any new tile is adjacent to existing tiles
        let hasValidPlacement = false;
        for (const piece of diff) {
            const adjacent = [
                turn.oldboardtiles.some(t => t.pos.x === piece.pos.x - 1 && t.pos.y === piece.pos.y),
                turn.oldboardtiles.some(t => t.pos.x === piece.pos.x + 1 && t.pos.y === piece.pos.y),
                turn.oldboardtiles.some(t => t.pos.x === piece.pos.x && t.pos.y === piece.pos.y - 1),
                turn.oldboardtiles.some(t => t.pos.x === piece.pos.x && t.pos.y === piece.pos.y + 1)
            ];
            
            if (adjacent.some(a => a)) {
                hasValidPlacement = true;
                break;
            }
        }

        if (!hasValidPlacement) {
            const error = {
                error: 'error-game-no-adjacent'
            };
            return [error, undefined, undefined, undefined];
        }
    }

    // check if user is allowed to make that move
    const gameplayer = GetGameUserByUserUID(playeruid);
    for (const newpiece of diff) {
        if (!gameplayer.activetiles.includes(newpiece.letter)) {
            // If they've got a wild card
            if (gameplayer.activetiles.includes('_')) {
                // make sure it's actually allowed
                const tileset = Dist.GetDist(game.locale).dist;
                const tilesetincludes = (l) => {
                    for (const range of tileset)
                        if (range.letters.includes(l)) return true;
                    return false;
                };

                if (!tilesetincludes(newpiece.letter)) {
                    const error = {
                        error: 'error-game-illegal-move'
                    };
                    return [error, undefined, undefined, undefined];
                }

                // then remove it (because it was placed) and continue
                gameplayer.activetiles.splice(gameplayer.activetiles.indexOf('_'), 1);
            } else {
                const error = {
                    error: 'error-game-illegal-move'
                };
                return [error, undefined, undefined, undefined];
            }
        }
    }

    // remove tiles from users drawer
    for (const piece of diff) {
        const index = gameplayer.activetiles.indexOf(piece.letter);
        if (index !== -1) {
            gameplayer.activetiles.splice(index, 1);
        }
    }

    // process outcome
    const temptiles = turn.oldboardtiles.concat(diff);
    let words = [];
    let wordsbasic = [];

    for (const newpiece of diff) {
        const check = (x, y) => {
            for (const checkpiece of temptiles) {
                if (checkpiece.pos && checkpiece.pos.x === x && checkpiece.pos.y === y)
                    return checkpiece;
            }
            return false;
        };

        const directions = [
            { x: 1, y: 0 },  // horizontal (right)
            { x: 0, y: 1 }   // vertical (down)
        ];

        // Find complete words in both directions
        for (const direction of directions) {
            // First find the start of the word by moving backwards
            let startPos = { ...newpiece.pos };
            let currentPos = { ...newpiece.pos };
            
            // Move backwards until we find no more tiles
            while (true) {
                const prevPos = {
                    x: currentPos.x - direction.x,
                    y: currentPos.y - direction.y
                };
                const tile = check(prevPos.x, prevPos.y);
                if (!tile) break;
                currentPos = prevPos;
                startPos = { ...currentPos };
            }

            // Now read forward from start position to build the word
            let word = [];
            currentPos = { ...startPos };
            let foundNewPiece = false;

            while (true) {
                const tile = check(currentPos.x, currentPos.y);
                if (!tile) break;
                
                word.push(tile);
                if (diff.some(p => p.pos.x === currentPos.x && p.pos.y === currentPos.y)) {
                    foundNewPiece = true;
                }

                currentPos.x += direction.x;
                currentPos.y += direction.y;
            }

            // Only add words that include a new piece and are longer than 1 letter
            if (word.length > 1 && foundNewPiece) {
                const wordStr = word.map(tile => tile.letter).join('');
                if (!wordsbasic.includes(wordStr)) {
                    words.push(word);
                    wordsbasic.push(wordStr);
                }
            }
        }
    }

    if (words.length === 0) {
        const error = {
            error: 'error-game-no-words'
        };
        return [error, undefined, undefined, undefined];
    }

    // check dictionary
    for (let i = 0; i < wordsbasic.length; i++) {
        const word = wordsbasic[i];
        const doesexist = Dict.FindWord(game.locale, word.toUpperCase());
        if (!doesexist) {
            const error = {
                error: 'error-game-word-not-exist',
                word: word
            };
            return [error, undefined, undefined, undefined];
        }
        Logger.game(`WORD ${word} FOUND`);
    }

    // update tiles with scores
    turn.boardtiles = turn.oldboardtiles.concat(diff);
    for (const tile of turn.boardtiles) {
        if (tile && tile.letter) {
            let score = 0;
            for (const pointband of Dist.GetDist(game.locale).dist) {
                if (pointband.letters.includes(tile.letter)) {
                    score = pointband.points;
                    break;
                }
            }
            tile.score = score;
        }
    }

    // process turn and allocate scores
    let outcome = {
        valid: true,
        points: 0,
        words: []
    };

    for (const word of words) {
        let wordscore = 0;
        let wordMultiplier = 1;
    
        // First calculate base scores and letter multipliers
        // In PlayTurn scoring section
        for (const tile of word) {
            let letterScore = tile.score || 0;
            
            // Apply letter multipliers
            switch(tile.modifier) {
                case 'DL':
                    letterScore *= 2;
                    break;
                case 'TL':
                case 'TL-CENTER':  // Add this to handle center square
                    letterScore *= 3;
                    break;
                case 'QL':
                    letterScore *= 4;
                    break;
                case 'DW':
                    wordMultiplier *= 2;
                    break;
                case 'TW':
                    wordMultiplier *= 3;
                    break;
                case 'QW':
                    wordMultiplier *= 4;
                    break;
            }
            wordscore += letterScore;
        }

        // Apply word multiplier after all letter scores
        wordscore *= wordMultiplier;
        
        outcome.points += wordscore;
        outcome.words.push({
            word: word.map(tile => tile.letter).join(''),
            points: wordscore,
            tiles: word
        });
    }
    

    // give user new tiles
    while (gameplayer.activetiles.length < 7 && game.tilebag.length > 0) {
        const r = Math.floor(Math.random() * game.tilebag.length);
        const t = game.tilebag[r];
        if (t !== undefined) {
            game.tilebag.splice(r, 1);
            gameplayer.activetiles.push(t);
        }
    }

    turn.outcome = outcome;
    gameplayer.score += outcome.points;
    ActiveGames[gameuid].gamestates.push(turn);
    ActiveGames[gameuid].turn = turninfo.newTurn;
    ActiveGames[gameuid].turntotal = turninfo.newTotalTurn;

    return [undefined, turn, turninfo, gameplayer.activetiles];
}



function SkipTurn(gameuid, playeruid)
{
    const turninfo = gameNextTurn(gameuid);
    // get last game state
    const turn = {
        playeruid: playeruid,
        turn: turninfo.newTurn,
        turntype: 'SKIP',
        outcome: {},
        oldboardtiles: ActiveGames[gameuid].gamestates[ActiveGames[gameuid].gamestates.length - 1],
        boardtiles: ActiveGames[gameuid].gamestates[ActiveGames[gameuid].gamestates.length - 1]
    };
    
    ActiveGames[gameuid].gamestates.push(turn);
    ActiveGames[gameuid].turn = turninfo.newTurn;
    ActiveGames[gameuid].turntotal = turninfo.newTotalTurn;
    
    return [turn, turninfo];
}

function gameNextTurn(gameuid)
{
    const playerCount = ActiveGames[gameuid].players.length;
    let newTurn = ActiveGames[gameuid].turn += 1;
    newTurn = ActiveGames[gameuid].turn % playerCount;
    const newTotalTurn = ActiveGames[gameuid].turntotal += 1;

    return {
        turnplayer: ActiveGames[gameuid].players[newTurn],
        newTurn: newTurn,
        newTotalTurn: newTotalTurn
    };
}

// same as how the 
function EndGame(gameuid)
{
    delete ActiveGames[gameuid];    
}


function turnDiff(turntilesold, turntilesnew) {
    if (!Array.isArray(turntilesold) || !Array.isArray(turntilesnew)) {
        return [];
    }
    
    if (turntilesold.length === 0) return turntilesnew;
    if (turntilesnew.length === 0) return [];

    // Find tiles that are in turntilesnew but not in turntilesold
    return turntilesnew.filter(newTile => {
        // Make sure we have valid tile objects
        if (!newTile || !newTile.pos || newTile.pos.x === undefined || newTile.pos.y === undefined) {
            return false;
        }
        
        // Check if this tile exists in the old tiles
        return !turntilesold.some(oldTile => 
            oldTile.pos && 
            oldTile.pos.x === newTile.pos.x && 
            oldTile.pos.y === newTile.pos.y
        );
    });
}




module.exports = {
    // Game validation exports

    // Get game exports
    GetGameByUserUID: GetGameByUserUID,
    GetGameUserByUserUID: GetGameUserByUserUID,
    GetTurnUser: GetTurnUser,

    // Change game state exports
    BeginGame: BeginGame,
    PlayTurn: PlayTurn,
    SkipTurn: SkipTurn,
    EndGame: EndGame
}
