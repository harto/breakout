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

    DEBUG = false,

    KEYS = {
        moveLeft:    37, // left arrow
        moveRight:   39, // right arrow

        toggleDebug: charCode('D'),
        togglePause: charCode('P'),
        newGame:     charCode('N')
    },

    BRICK_COLS = 14,
    BRICK_ROWS = 8,

    ROW_COLOURS = ['darkred',
                   'red',
                   'darkorange',
                   'orange',
                   'darkgreen',
                   'green',
                   'gold',
                   'yellow'],

    SCREEN_W = 600,
    SCREEN_H = 400,

    WALL_W = 20,
    WALL_H = 20,
    GUTTER_H = 2 * WALL_H,

    BRICK_W = (SCREEN_W - 2 * WALL_W) / BRICK_COLS,
    BRICK_H = 15,
    // FIXME: consolidate
    BRICK_Y_OFFSET = WALL_H + 3 * BRICK_H,
    BOTTOM_ROW_Y = WALL_H + (BRICK_ROWS + 3) * BRICK_H,

    PADDLE_W = 2 * BRICK_W,
    PADDLE_H = 2 / 3 * BRICK_H,
    PADDLE_SPEED = 15,

    BALL_SIZE = BRICK_W / 4,
    BALL_SPEED = PADDLE_SPEED / 2,

    REINSERT_DELAY = 2000,
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

    walls,
    paddle,
    bricks,
    ball,

    lives,
    level,
    score,

    paused,
    state,
    dropoutTime;

/// ball

function Ball() {
    this.x = (SCREEN_W - BALL_SIZE) / 2;
    this.y = SCREEN_H - (BOTTOM_ROW_Y + BRICK_H + BALL_SIZE + GUTTER_H) / 2;

    this.radius = BALL_SIZE / 2;

    this.speed = BALL_SPEED;
    this.angle(NORTH | EAST);
}

Ball.prototype = {

    draw: function (ctx) {
        ctx.save();

        ctx.fillStyle = 'white';

        ctx.beginPath();
        ctx.arc(this.x + this.radius, this.y + this.radius, this.radius,
                0, Math.PI * 2, true);
        ctx.fill();
        ctx.closePath();

        ctx.restore();
    },

    update: function () {
        this.x += this.vx;
        this.y += this.vy;
    },

    // compute angle of deflection from collision with object
    collision: function (o) {
        var x = this.x, x2 = this.x + BALL_SIZE,
            y = this.y, y2 = this.y + BALL_SIZE,
            ox = o.x, ox2 = o.x + o.w,
            oy = o.y, oy2 = o.y + o.h;

        var collides = ((ox <= x && x <= ox2) || (ox <= x2 && x2 <= ox2)) &&
                       ((oy <= y && y <= oy2) || (oy <= y2 && y2 <= oy2));

        this.angle((!collides ? 0 : x < ox ? WEST : ox2 < x2 ? EAST : 0) |
                   (!collides ? 0 : y < oy ? NORTH : oy2 < y2 ? SOUTH : 0));

        return collides;
    },

    angle: function (d) {
        this.vx = d & WEST ? -this.speed :
                  d & EAST ? this.speed :
                  this.vx;

        this.vy = d & NORTH ? -this.speed :
                  d & SOUTH ? this.speed :
                  this.vy;
    },

    outOfBounds: function () {
        return SCREEN_H <= this.y;
    }
};

/// base class for rectangular shapes

function Rectangle() {}

Rectangle.prototype.draw = function (ctx) {
    ctx.save();
    ctx.fillStyle = this.colour;
    ctx.fillRect(this.x, this.y, this.w, this.h);
    ctx.restore();
};

/// paddle

function Paddle() {
    this.w = PADDLE_W;
    this.h = PADDLE_H;
    this.x = (SCREEN_W - this.w) / 2;
    this.y = SCREEN_H - GUTTER_H - this.h;
    this.colour = 'white';
}

Paddle.prototype = new Rectangle();

Paddle.prototype.move = function (direction) {
    var x = this.x + direction * PADDLE_SPEED;
    this.x = Math.min(Math.max(x, WALL_W), SCREEN_W - WALL_W - PADDLE_W);
};

/// bricks

function Brick(col, row) {
    this.colour = ROW_COLOURS[row];
    this.value = 2 * Math.floor(row / 2) + 1;

    this.x = WALL_W + col * BRICK_W;
    this.y = BRICK_Y_OFFSET + row * BRICK_H;

    this.w = BRICK_W;
    this.h = BRICK_H;
}

Brick.prototype = new Rectangle();

Brick.init = function () {
    var bricks = [];
    for (var y = 0; y < BRICK_ROWS; y++) {
        var row = [];
        for (var x = 0; x < BRICK_COLS; x++) {
            row.push(new Brick(x, y));
        }
        bricks.push(row);
    }
    return bricks;
};

/// playing area

function Wall(x, y, w, h) {
    this.x = x;
    this.y = y;
    this.w = w;
    this.h = h;
    this.colour = 'grey';
}

Wall.prototype = new Rectangle();

/// engine

function draw(ctx) {
    ctx.fillStyle = 'black';
    ctx.fillRect(0, 0, SCREEN_W, SCREEN_H);

    walls.concat(ball, paddle).forEach(function (o) {
        o.draw(ctx);
    });
    bricks.forEach(function (row) {
        row.forEach(function (brick) {
            brick.draw(ctx);
        });
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

function processCollisions() {
    // simple collision detection for walls
    if (ball.x <= WALL_W) {
        ball.angle(EAST);
    } else if (SCREEN_W - WALL_W - BALL_SIZE < ball.x) {
        ball.angle(WEST);
    }
    if (ball.y <= WALL_H) {
        ball.angle(SOUTH);
    }

    ball.collision(paddle);

    // Determine which rows need per-brick inspection
    var rows = bricks.filter(function (_, i) {
        var by = ball.y,
            by2 = ball.y + BALL_SIZE,
            ry = BRICK_Y_OFFSET + i * BRICK_H,
            ry2 = ry + BRICK_H;
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
    for (var y = rowStart; y != rowEnd; y += rowInc) {
        var row = rows[y];
        var colStart = w2e ? 0 : row.length - 1;
        var colEnd = w2e ? row.length : -1;
        for (var x = colStart; x != colEnd; x += colInc) {
            var brick = row[x];
            if (ball.collision(brick)) {
                row.splice(x, 1);
                score += brick.value;
                break outer;
            }
        }
    }
}

function update() {
    paddle.move(movingLeft ? -1 : movingRight ? 1 : 0);

    switch (state) {
    case State.RUNNING:
        processCollisions();
        ball.update();
        if (ball.outOfBounds()) {
            state = (--lives === 0) ? State.FINISHED : State.REINSERT;
            dropoutTime = +new Date();
        }
        break;
    case State.REINSERT:
        if (new Date() - dropoutTime >= REINSERT_DELAY) {
            ball = new Ball();
            state = State.RUNNING;
        }
        break;
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

    ball = new Ball();
    paddle = new Paddle();
    bricks = Brick.init();

    nextLoopTime = +new Date();
    timer = window.setTimeout(loop, UPDATE_DELAY);
}

$(function () {
    var canvas = $('canvas').get(0);
    ctx = canvas.getContext('2d');

    var vWallHeight = SCREEN_H - GUTTER_H;
    walls = [
        new Wall(0, 0, WALL_W, vWallHeight),
        new Wall(SCREEN_W - WALL_W, 0, WALL_W, vWallHeight),
        new Wall(0, 0, SCREEN_W, WALL_H)
    ];

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
        case KEYS.toggleDebug:
            DEBUG = !DEBUG;
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

