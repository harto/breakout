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
    // reverse-lookup
    KEYCODES = {},

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
    BOTTOM_SPACE = 2 * WALL_H,

    BRICK_W = (SCREEN_W - 2 * WALL_W) / BRICK_COLS,
    BRICK_H = 15,
    BOTTOM_ROW_Y = WALL_H + (BRICK_ROWS + 3) * BRICK_H,

    BALL_SIZE = BRICK_W / 4,

    PADDLE_W = 2 * BRICK_W,
    PADDLE_H = 2/3 * BRICK_H,
    PADDLE_SPEED = 15,

    world,
    paddle,
    lives,
    level,
    score,
    paused,
    finished;

for (var k in KEYS) {
    if (KEYS.hasOwnProperty(k)) {
        KEYCODES[KEYS[k]] = k;
    }
}

/// misc

function extendGraphicsContext(ctx) {
    var FULL_ARC = Math.PI * 2;
    ctx.fillCircle = function (x, y, radius) {
        this.beginPath();
        this.arc(x, y, radius, 0, FULL_ARC, true);
        this.fill();
        this.closePath();
    };
}

/// ball

function Ball() {
    this.x = (SCREEN_W - BALL_SIZE) / 2;
    this.y = SCREEN_H - (BOTTOM_ROW_Y + BRICK_H + BALL_SIZE + BOTTOM_SPACE) / 2;

    this.radius = BALL_SIZE / 2;
}

Ball.prototype = {

    draw: function (ctx) {
        ctx.save();
        ctx.fillStyle = 'white';
        ctx.fillCircle(this.x + this.radius, this.y + this.radius, this.radius);
        ctx.restore();
    },

    toString: function () {
        return 'Ball[x=' + this.x + ', y=' + this.y +
               ', size=' + BALL_SIZE + ']';
    }
};

/// paddle

function Paddle() {
    this.x = (SCREEN_W - PADDLE_W) / 2;
    this.y = SCREEN_H - BOTTOM_SPACE - PADDLE_H;
}

Paddle.prototype = {

    draw: function (ctx) {
        ctx.save();
        ctx.fillStyle = 'white';
        ctx.fillRect(this.x, this.y, PADDLE_W, PADDLE_H);
        ctx.restore();
    },

    move: function (direction) {
        var x = this.x + direction * PADDLE_SPEED;
        this.x = Math.min(Math.max(x, WALL_W), SCREEN_W - WALL_W - PADDLE_W);
    }

    // toString: function () {
    // }
};

/// bricks

function Brick(col, row) {
    this.colour = ROW_COLOURS[BRICK_ROWS - 1 - row];
    this.value = Math.floor(row / 2) + 1;

    this.x = WALL_W + col * BRICK_W;
    this.y = BOTTOM_ROW_Y - row * BRICK_H;
}

Brick.prototype = {

    draw: function (ctx) {
        ctx.save();

        ctx.fillStyle = this.colour;
        ctx.fillRect(this.x, this.y, BRICK_W, BRICK_H);

        ctx.restore();
    },

    toString: function () {
        return 'Brick[x=' + this.x + ', y=' + this.y +
               ', colour=' + this.colour + ', value=' + this.value + ']';
    }
};

/// playing area

function World() {
    this.bricks = [];

    for (var row = 0; row < BRICK_ROWS; row++) {
        for (var col = 0; col < BRICK_COLS; col++) {
            this.bricks.push(new Brick(col, row));
        }
    }

    this.ball = new Ball();
}

World.prototype = {

    draw: function (ctx) {
        ctx.save();

        ctx.fillStyle = 'black';
        ctx.fillRect(0, 0, SCREEN_W, SCREEN_H);

        // side walls
        var vWallHeight = SCREEN_H - BOTTOM_SPACE;
        ctx.fillStyle = 'grey';
        ctx.fillRect(0, 0, WALL_W, vWallHeight);
        ctx.fillRect(SCREEN_W - WALL_W, 0, WALL_W, vWallHeight);
        // top wall
        ctx.fillRect(0, 0, SCREEN_W, WALL_H);

        this.bricks.forEach(function (b) {
            b.draw(ctx);
        });
        this.ball.draw(ctx);

        ctx.restore();
    },

    update: function () {
    }
};

/// engine

function draw(ctx) {
    world.draw(ctx);
    paddle.draw(ctx);
}

var movingLeft = false,
    movingRight = false;

function update() {
    if (!paused) {
        world.update();
        paddle.move(movingLeft ? -1 : movingRight ? 1 : 0);
    }
}

var timer, nextLoopTime, ctx;

function loop() {
    update();
    draw(ctx);

    if (!finished) {
        nextLoopTime += UPDATE_DELAY;
        var delay = nextLoopTime - new Date();
        // TODO: recover if falling behind
        timer = window.setTimeout(loop, Math.max(0, delay));
    }
}

/// initialisation

function newGame() {
    window.clearTimeout(timer);

    world = new World();
    paddle = new Paddle();
    score = 0;
    paused = false;
    finished = false;

    nextLoopTime = +new Date();
    timer = window.setTimeout(loop, UPDATE_DELAY);
}

$(function () {
    var canvas = $('canvas').get(0);

    ctx = canvas.getContext('2d');
    extendGraphicsContext(ctx);

    function getKeyCode(e) {
        var k = e.which;
        if (!KEYCODES[k] || e.ctrlKey || e.metaKey) {
            return null;
        }
        e.preventDefault();
        return k;
    }

    $(window).keydown(function (e) {
        var k = getKeyCode(e);
        if (!k) return;

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
            throw new Error('unrecognised keycode: ' + k);
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

