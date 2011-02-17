/*
 * A minimal Breakout clone.
 * https://www.github.com/harto/breakout
 *
 * Requires: jQuery 1.4.2
 */

/*global $, window */

function charCode(c) {
    return c.charCodeAt(0);
}

var UPDATE_HZ = 20,
    UPDATE_DELAY = 1000 / UPDATE_HZ,

    KEYS = {
        moveLeft:    37, // left arrow
        moveRight:   39, // right arrow
        togglePause: charCode('P'),
        newGame:     charCode('N')
    },

    SCREEN_W = 600,
    SCREEN_H = 400,

    LIVES = 3,

    // game states
    State = {
        RUNNING: 1,
        REINSERT: 2,
        FINISHED: 3
    },

    // directions
    NORTH = 1,
    SOUTH = 2,
    EAST = 4,
    WEST = 16,

    boundary,
    paddle,
    bricks,
    ball,

    lives,
    level,
    score,

    paused,
    state,
    timeOfDeath;

/// base class for rectangular shapes

function Rectangle() {}

Rectangle.prototype.draw = function (ctx) {
    ctx.save();
    ctx.fillStyle = this.colour;
    ctx.fillRect(this.x, this.y, this.w, this.h);
    ctx.restore();
};

/// playing area

function Wall(x, y, w, h) {
    this.x = x;
    this.y = y;
    this.w = w;
    this.h = h;
    this.colour = 'grey';
}

Wall.W = 20;
Wall.H = 20;
Wall.VSPACE = 2 * Wall.H;

Wall.prototype = new Rectangle();

function Boundary() {
    var vWallHeight = SCREEN_H - Wall.VSPACE;
    this.walls = [
        new Wall(0, 0, Wall.W, vWallHeight),
        new Wall(SCREEN_W - Wall.W, 0, Wall.W, vWallHeight),
        new Wall(0, 0, SCREEN_W, Wall.H)
    ];
}

Boundary.prototype = {
    draw: function (ctx) {
        this.walls.forEach(function (wall) {
            wall.draw(ctx);
        });
    },

    applyCollisions: function (ball) {
        if (ball.x <= Wall.W) {
            ball.angle(EAST);
        } else if (SCREEN_W - Wall.W - ball.size < ball.x) {
            ball.angle(WEST);
        }
        if (ball.y <= Wall.H) {
            ball.angle(SOUTH);
        }
    }
};

/// bricks

function Brick(col, row) {
    this.colour = Brick.ROW_COLOURS[row];
    this.value = 2 * Math.floor(row / 2) + 1;

    this.x = Wall.W + col * Brick.W;
    this.y = Brick.Y_OFFSET + row * Brick.H;

    this.w = Brick.W;
    this.h = Brick.H;
}

Brick.ROW_COLOURS = ['darkred',
                     'red',
                     'darkorange',
                     'orange',
                     'darkgreen',
                     'green',
                     'gold',
                     'yellow'];
Brick.COLS = 14;
Brick.ROWS = Brick.ROW_COLOURS.length;
Brick.W = (SCREEN_W - 2 * Wall.W) / Brick.COLS;
Brick.H = 15;
Brick.Y_OFFSET = Wall.H + 3 * Brick.H;

Brick.prototype = new Rectangle();

function Stack() {
    this.rows = [];
    for (var y = 0; y < Brick.ROWS; y++) {
        var row = [];
        for (var x = 0; x < Brick.COLS; x++) {
            row.push(new Brick(x, y));
        }
        this.rows.push(row);
    }
}

Stack.prototype = {
    draw: function (ctx) {
        this.rows.forEach(function (row) {
            row.forEach(function (brick) {
                brick.draw(ctx);
            });
        });
    },

    applyCollisions: function (ball) {
        // Determine which rows need per-brick inspection
        var rows = this.rows.filter(function (_, i) {
            var by = ball.y,
                by2 = ball.y + ball.size,
                ry = Brick.Y_OFFSET + i * Brick.H,
                ry2 = ry + Brick.H;
            return (ry <= by && by <= ry2) || (ry <= by2 && by2 <= ry2);
        });

        // Traverse bricks according to the current direction of the ball. This
        // resolves any ambiguity about the deflection angle or which brick to
        // remove when the ball strikes two or more bricks at once.

        var n2s = ball.vy > 0;
        var w2e = ball.vx > 0;

        var rowStart = n2s ? 0 : rows.length - 1;
        var rowEnd = n2s ? rows.length : -1;
        var rowInc = n2s ? 1 : -1;

        var colInc = w2e ? 1 : -1;

        outer:
        for (var y = rowStart; y !== rowEnd; y += rowInc) {
            var row = rows[y];
            var colStart = w2e ? 0 : row.length - 1;
            var colEnd = w2e ? row.length : -1;
            for (var x = colStart; x !== colEnd; x += colInc) {
                var brick = row[x];
                if (ball.collision(brick)) {
                    row.splice(x, 1);
                    score += brick.value;
                    break outer;
                }
            }
        }
    }
};

/// paddle

function Paddle() {
    this.w = 2 * Brick.W;
    this.h = 2 / 3 * Brick.H;
    this.x = (SCREEN_W - this.w) / 2;
    this.y = SCREEN_H - Wall.VSPACE - this.h;
    this.colour = 'white';
}

Paddle.SPEED = 15;

Paddle.prototype = new Rectangle();

Paddle.prototype.move = function (direction) {
    var x = this.x + direction * Paddle.SPEED;
    this.x = Math.min(Math.max(x, Wall.W), SCREEN_W - Wall.W - this.w);
};

Paddle.prototype.applyCollisions = function (ball) {
    ball.collision(this);
};

/// ball

function Ball() {
    this.size = Brick.W / 4;
    this.r = this.size / 2;
    this.x = (SCREEN_W - this.size) / 2;
    this.y = SCREEN_H - (Brick.Y_OFFSET + Brick.ROWS * Brick.H + this.size + Wall.VSPACE) / 2;

    this.speed = Paddle.SPEED / 2;
    this.angle(NORTH | EAST);
}

Ball.REINSERT_DELAY = 2000;

Ball.prototype = {
    draw: function (ctx) {
        ctx.save();
        ctx.fillStyle = 'white';
        ctx.beginPath();
        ctx.arc(this.x + this.r, this.y + this.r, this.r, 0, Math.PI * 2, true);
        ctx.fill();
        ctx.closePath();
        ctx.restore();
    },

    update: function () {
        this.x += this.vx;
        this.y += this.vy;
    },

    // process collision with object and update angle accordingly
    collision: function (o) {
        var x = this.x, x2 = this.x + this.size,
            y = this.y, y2 = this.y + this.size,
            ox = o.x, ox2 = o.x + o.w,
            oy = o.y, oy2 = o.y + o.h;

        var collides = ((ox <= x && x <= ox2) || (ox <= x2 && x2 <= ox2)) &&
                       ((oy <= y && y <= oy2) || (oy <= y2 && y2 <= oy2));

        this.angle((!collides ? 0 : x < ox ? WEST : ox2 < x2 ? EAST : 0) |
                   (!collides ? 0 : y < oy ? NORTH : oy2 < y2 ? SOUTH : 0));

        return collides;
    },

    angle: function (d) {
        this.vx = d & WEST ? -this.speed : d & EAST ? this.speed : this.vx;
        this.vy = d & NORTH ? -this.speed : d & SOUTH ? this.speed : this.vy;
    },

    outOfBounds: function () {
        return SCREEN_H <= this.y;
    }
};

/// engine

function draw(ctx) {
    ctx.fillStyle = 'black';
    ctx.fillRect(0, 0, SCREEN_W, SCREEN_H);

    [boundary, bricks, paddle, ball].forEach(function (o) {
        o.draw(ctx);
    });

    ctx.font = 'bold 10px Helvetica, Arial, sans-serif';
    ctx.fillStyle = 'white';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'bottom';
    ctx.fillText('Score: ' + score, 5, SCREEN_H - 21);
    ctx.fillText('Lives: ' + lives, 5, SCREEN_H - 7);

    // FIXME: make this look nicer
    ctx.textAlign = 'center';
    if (paused) {
        ctx.fillText('<Paused>', SCREEN_W / 2, 2 * SCREEN_H / 3);
    } else if (state === State.FINISHED) {
        ctx.fillText('Press <N> to restart', SCREEN_W / 2, 2 * SCREEN_H / 3);
    }
}

var movingLeft = false,
    movingRight = false;

function update() {
    paddle.move(movingLeft ? -1 : movingRight ? 1 : 0);

    if (state === State.RUNNING) {
        [boundary, bricks, paddle].forEach(function (o) {
            o.applyCollisions(ball);
        });
        ball.update();
        if (ball.outOfBounds()) {
            state = (--lives === 0) ? State.FINISHED : State.REINSERT;
            timeOfDeath = +new Date();
        }
    } else if (state === State.REINSERT) {
        if (new Date() - timeOfDeath >= Ball.REINSERT_DELAY) {
            ball = new Ball();
            state = State.RUNNING;
        }
    }
}

var timer, nextLoopTime, ctx;

function loop() {
    if (!paused) {
        update();
    }
    draw(ctx);

    if (state !== State.FINISHED) {
        nextLoopTime += UPDATE_DELAY;
        var delay = nextLoopTime - new Date();
        // TODO: recover if falling behind
        timer = window.setTimeout(loop, Math.max(0, delay));
    }
}

/// initialisation

function newGame() {
    window.clearTimeout(timer);

    score = 0;
    lives = LIVES;
    state = State.RUNNING;
    paused = false;

    bricks = new Stack();
    paddle = new Paddle();
    ball = new Ball();

    nextLoopTime = +new Date();
    timer = window.setTimeout(loop, UPDATE_DELAY);
}

$(function () {
    var canvas = $('canvas').get(0);
    ctx = canvas.getContext('2d');

    boundary = new Boundary();

    // reverse-lookup
    var keycodes = {};
    for (var k in KEYS) {
        if (KEYS.hasOwnProperty(k)) {
            keycodes[KEYS[k]] = k;
        }
    }

    function getKeyCode(e) {
        var k = e.which;
        if (!keycodes[k] || e.ctrlKey || e.metaKey) {
            return null;
        }
        e.preventDefault();
        return k;
    }

    $(window).keydown(function (e) {
        var k = getKeyCode(e);
        if (!k) {
            return;
        }

        switch (k) {
        case KEYS.moveLeft:
            movingLeft = true;
            break;
        case KEYS.moveRight:
            movingRight = true;
            break;
        case KEYS.togglePause:
            paused = !paused;
            break;
        case KEYS.newGame:
            newGame();
            break;
        default:
            throw new Error('unhandled: ' + keycodes[k]);
        }
    });

    $(window).keyup(function (e) {
        var k = getKeyCode(e);

        switch (k) {
        case KEYS.moveLeft:
            movingLeft = false;
            break;
        case KEYS.moveRight:
            movingRight = false;
            break;
        default:
            // ignore
        }
    });

    newGame();
});

