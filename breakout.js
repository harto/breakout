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

    walls,
    paddle,

    bricks,
    ball,
    lives,
    level,
    score,
    paused,
    finished;

/// misc

var NORTH = 1,
    SOUTH = 2,
    EAST = 4,
    WEST = 16;

function within(x, min, max) {
    return min <= x && x <= max;
}

/* Detect a collision and return the side(s) of `b` that `a` collided with
   (some bitwise combination of NORTH, SOUTH, EAST and WEST). */
function collision(a, b) {
    var ax = a.x, ax2 = a.x + a.w,
        ay = a.y, ay2 = a.y + a.h,
        bx = b.x, bx2 = b.x + b.w,
        by = b.y, by2 = b.y + b.h;

    var collides = (within(ax, bx, bx2) || within(ax2, bx, bx2)) &&
                   (within(ay, by, by2) || within(ay2, by, by2));

    var collidesNorth = collides && ay < by ? NORTH : 0;
    var collidesSouth = collides && by2 < ay2 ? SOUTH : 0;
    var collidesWest = collides && ax < bx ? WEST : 0;
    var collidesEast = collides && bx2 < ax2 ? EAST : 0;

    return collidesNorth | collidesSouth | collidesEast | collidesWest;
}

/// vector-like data structure

function Velocity(x, y) {
    this.x = x;
    this.y = y;
}

Velocity.prototype.deflect = function (direction) {
    var x = this.x;
    var y = this.y;

    if (direction & NORTH) {
        y = -Math.abs(y);
    }
    if (direction & SOUTH) {
        y = Math.abs(y);
    }
    if (direction & EAST) {
        x = Math.abs(x);
    }
    if (direction & WEST) {
        x = -Math.abs(x);
    }

    return new Velocity(x, y);
};

/// ball

function Ball() {
    this.x = (SCREEN_W - BALL_SIZE) / 2;
    this.y = SCREEN_H - (BOTTOM_ROW_Y + BRICK_H + BALL_SIZE + GUTTER_H) / 2;
    this.w = this.h = BALL_SIZE;
    this.radius = this.w / 2;

    this.v = new Velocity(BALL_SPEED, -BALL_SPEED);
}

Ball.prototype = {

    draw: function (ctx) {
        ctx.save();
        ctx.fillStyle = 'white';
        ctx.fillCircle(this.x + this.radius, this.y + this.radius, this.radius);
        ctx.restore();
    },

    update: function () {
        this.x += this.v.x;
        this.y += this.v.y;
    },

    toString: function () {
        return 'Ball[x=' + this.x + ', y=' + this.y +
               ', size=' + BALL_SIZE + ']';
    }
};

/// paddle

function Paddle() {
    this.w = PADDLE_W;
    this.h = PADDLE_H;
    this.x = (SCREEN_W - this.w) / 2;
    this.y = SCREEN_H - GUTTER_H - this.h;
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

    this.w = BRICK_W;
    this.h = BRICK_H;
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

function Wall(x, y, w, h) {
    this.x = x;
    this.y = y;
    this.w = w;
    this.h = h;
}

Wall.prototype = {

    draw: function (ctx) {
        ctx.save();
        ctx.fillStyle = 'grey';
        ctx.fillRect(this.x, this.y, this.w, this.h);
        ctx.restore();
    }
};

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
        var direction = collision(ball, o);
        if (direction) {
            ball.v = ball.v.deflect(direction);
        }
    });

    for (var i = 0; i < bricks.length; i++) {
        var brick = bricks[i];
        var direction = collision(ball, brick);
        if (direction) {
            ball.v = ball.v.deflect(direction);
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
    paused = false;
    finished = false;
    ball = new Ball();
    bricks = [];
    for (var row = 0; row < BRICK_ROWS; row++) {
        for (var col = 0; col < BRICK_COLS; col++) {
            bricks.push(new Brick(col, row));
        }
    }

    nextLoopTime = +new Date();
    timer = window.setTimeout(loop, UPDATE_DELAY);
}

// add higher-level functions to graphics ctx
function extendGraphicsContext(ctx) {
    var FULL_ARC = Math.PI * 2;
    ctx.fillCircle = function (x, y, radius) {
        this.beginPath();
        this.arc(x, y, radius, 0, FULL_ARC, true);
        this.fill();
        this.closePath();
    };
}

$(function () {
    var canvas = $('canvas').get(0);

    ctx = canvas.getContext('2d');
    extendGraphicsContext(ctx);

    var vWallHeight = SCREEN_H - GUTTER_H;
    walls = [
        new Wall(0, 0, WALL_W, vWallHeight),
        new Wall(SCREEN_W - WALL_W, 0, WALL_W, vWallHeight),
        new Wall(0, 0, SCREEN_W, WALL_H)
    ];
    paddle = new Paddle();

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

