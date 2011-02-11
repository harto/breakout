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
    BOTTOM_ROW_Y = WALL_H + (BRICK_ROWS + 3) * BRICK_H,

    PADDLE_W = 2 * BRICK_W,
    PADDLE_H = 2 / 3 * BRICK_H,
    PADDLE_SPEED = 15,

    BALL_SIZE = BRICK_W / 4,
    BALL_SPEED = PADDLE_SPEED / 2,

    LIVES = 3,

    walls,
    paddle,
    bricks,
    ball,

    lives,
    level,
    score,
    paused,
    finished;

/// ball

function Ball() {
    this.x = (SCREEN_W - BALL_SIZE) / 2;
    this.y = SCREEN_H - (BOTTOM_ROW_Y + BRICK_H + BALL_SIZE + GUTTER_H) / 2;

    this.radius = BALL_SIZE / 2;

    this.vx = BALL_SPEED;
    this.vy = -BALL_SPEED;
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

    collision: function (o) {
        var x = this.x, x2 = this.x + BALL_SIZE,
            y = this.y, y2 = this.y + BALL_SIZE,
            ox = o.x, ox2 = o.x + o.w,
            oy = o.y, oy2 = o.y + o.h;

        var collides = ((ox <= x && x <= ox2) || (ox <= x2 && x2 <= ox2)) &&
                       ((oy <= y && y <= oy2) || (oy <= y2 && y2 <= oy2));

        if (collides && x < ox) {
            this.vx = -Math.abs(this.vx);
        } else if (collides && ox2 < x2) {
            this.vx = Math.abs(this.vx);
        }

        if (collides && y < oy) {
            this.vy = -Math.abs(this.vy);
        } else if (collides && oy2 < y2) {
            this.vy = Math.abs(this.vy);
        }

        return collides;
    },

    toString: function () {
        return 'Ball[x=' + this.x + ', y=' + this.y +
               ', size=' + BALL_SIZE + ']';
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
    this.colour = ROW_COLOURS[BRICK_ROWS - 1 - row];
    this.value = 2 * Math.floor(row / 2) + 1;

    this.x = WALL_W + col * BRICK_W;
    this.y = BOTTOM_ROW_Y - row * BRICK_H;

    this.w = BRICK_W;
    this.h = BRICK_H;
}

Brick.prototype = new Rectangle();

Brick.prototype.toString = function () {
    return 'Brick[x=' + this.x + ', y=' + this.y +
           ', colour=' + this.colour + ', value=' + this.value + ']';
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

    walls.concat(bricks, ball, paddle).forEach(function (o) {
        o.draw(ctx);
    });
}

var movingLeft = false,
    movingRight = false;

function update() {
    if (paused) {
        return;
    }

    // process collisions

    walls.concat(paddle).forEach(function (o) {
        ball.collision(o);
    });

    for (var i = 0; i < bricks.length; i++) {
        var brick = bricks[i];
        if (ball.collision(brick)) {
            score += brick.value;
            bricks.splice(i, 1);
            break;
        }
    }

    // update state

    ball.update();
    paddle.move(movingLeft ? -1 : movingRight ? 1 : 0);
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

    score = 0;
    lives = LIVES;
    paused = false;
    finished = false;
    
    ball = new Ball();
    paddle = new Paddle();

    bricks = [];
    for (var row = 0; row < BRICK_ROWS; row++) {
        for (var col = 0; col < BRICK_COLS; col++) {
            bricks.push(new Brick(col, row));
        }
    }

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

