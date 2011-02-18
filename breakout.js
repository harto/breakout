/*
 * A minimal Breakout clone.
 * https://www.github.com/harto/breakout
 *
 * Requires: jQuery 1.4.2
 */

/*global $, window */

var SCREEN_W = 600,
    SCREEN_H = 400,
    TEXT_HEIGHT = 10,

    NORTH = 1,
    SOUTH = 2,
    EAST = 4,
    WEST = 16,

    lives,
    score;

/// partial re-rendering

var invalidated = [];

// mark some area of the screen as requiring a redraw
function invalidate(x, y, w, h) {
    invalidated.push({ x: x, y: y, w: w, h: h });
}

function invalidateScreen() {
    invalidate(0, 0, SCREEN_W, SCREEN_H);
}

/// miscellany

function overlapping(ax, ay, aw, ah, bx, by, bw, bh) {
    var ax2 = ax + aw, ay2 = ay + ah,
        bx2 = bx + bw, by2 = by + bh;
    return (// x-overlap
            (((bx <= ax && ax <= bx2) || (bx <= ax2 && ax2 <= bx2)) ||
             ((ax <= bx && bx <= ax2) || (ax <= bx2 && bx2 <= ax2))) &&
           (// y-overlap
            (((by <= ay && ay <= by2) || (by <= ay2 && ay2 <= by2))) ||
             ((ay <= by && by <= ay2) || (ay <= by2 && by2 <= ay2))));
}

/// base class for rectangular shapes

function Rectangle() {}

Rectangle.prototype = {
    draw: function (ctx) {
        ctx.save();
        ctx.fillStyle = this.colour;
        ctx.fillRect(this.x, this.y, this.w, this.h);
        ctx.restore();
    },

    overlaps: function (x, y, w, h) {
        return overlapping(this.x, this.y, this.w, this.h, x, y, w, h);
    }
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

var boundary = {
    walls: [new Wall(0, 0, Wall.W, SCREEN_H - Wall.VSPACE),
            new Wall(SCREEN_W - Wall.W, 0, Wall.W, SCREEN_H - Wall.VSPACE),
            new Wall(0, 0, SCREEN_W, Wall.H)],

    draw: function (ctx) {
        this.walls.forEach(function (wall) {
            wall.draw(ctx);
        });
    },

    applyCollisions: function (ball) {
        if (ball.x <= Wall.W) {
            ball.angle(EAST);
        } else if (SCREEN_W - Wall.W <= ball.x + ball.size) {
            ball.angle(WEST);
        }
        if (ball.y <= Wall.H) {
            ball.angle(SOUTH);
        }
    },

    overlaps: function (x, y, w, h) {
        return this.walls.some(function (wall) {
            return wall.overlaps(x, y, w, h);
        });
    }
};

var scoreboard = {
    x: 0,
    y: SCREEN_H - Wall.VSPACE,

    // compute real width once text is rendered
    w: SCREEN_W,
    h: Wall.VSPACE,

    draw: function (ctx) {
        ctx.save();
        ctx.fillStyle = 'white';
        ctx.textAlign = 'left';
        ctx.textBaseline = 'top';

        var scoreLine = 'Score: ' + score;
        var livesLine = 'Lives: ' + lives;

        ctx.fillText(scoreLine, this.x + 5, this.y + 9);
        ctx.fillText(livesLine, this.x + 5, this.y + 23);

        this.w = 10 + Math.max(ctx.measureText(scoreLine).width,
                               ctx.measureText(livesLine).width);
    },

    overlaps: Rectangle.prototype.overlaps,

    invalidate: function () {
        invalidate(this.x, this.y, this.w, this.h);
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
                    invalidate(brick.x, brick.y, brick.w, brick.h);
                    row.splice(x, 1);
                    score += brick.value;
                    scoreboard.invalidate();
                    break outer;
                }
            }
        }
    },

    overlaps: function (x, y, w, h) {
        return this.rows.some(function (row) {
            return row.some(function (brick) {
                return brick.overlaps(x, y, w, h);
            });
        });
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
    invalidate(this.x, this.y, this.w, this.h);
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
        // FIXME: should this be here?
        invalidate(this.x - 1, this.y - 1, this.size + 2, this.size + 2);
    },

    update: function () {
        this.x += this.vx;
        this.y += this.vy;
    },

    // process possible collision with object and update angle accordingly
    collision: function (o) {
        var collides = overlapping(this.x, this.y, this.size, this.size,
                                   o.x, o.y, o.w, o.h);

        if (collides) {
            if (this.x < o.x) {
                this.angle(WEST);
            } else if (o.x + o.w < this.x + this.size) {
                this.angle(EAST);
            }
            if (this.y < o.y) {
                this.angle(NORTH);
            } else if (o.y + o.h < this.y + this.size) {
                this.angle(SOUTH);
            }
        }

        return collides;
    },

    angle: function (d) {
        this.vx = d & WEST ? -this.speed : d & EAST ? this.speed : this.vx;
        this.vy = d & NORTH ? -this.speed : d & SOUTH ? this.speed : this.vy;
    },

    outOfBounds: function () {
        return SCREEN_H < this.y;
    }
};

/// engine

var paddle,
    bricks,
    ball,

    // game states
    State = {
        RUNNING: 1,
        REINSERT: 2,
        FINISHED: 3
    },

    state,
    paused;

function draw(ctx) {
    // repaint background over invalidated regions
    invalidated.forEach(function (r) {
        ctx.fillStyle = 'black';
        ctx.fillRect(r.x, r.y, r.w, r.h);
    });

    // redraw elements that intersect at least one invalidated region
    [boundary, bricks, paddle, scoreboard].filter(function (o) {
        return invalidated.some(function (r) {
            return o.overlaps(r.x, r.y, r.w, r.h);
        });
    }).forEach(function (o) {
        o.draw(ctx);
    });

    invalidated = [];

    ball.draw(ctx);

    if (paused || state === State.FINISHED) {
        var text = paused ? '<Paused>' : 'Press <N> to restart';
        var padding = 5;
        var w = ctx.measureText(text).width + 2 * padding;
        var h = TEXT_HEIGHT + 2 * padding;
        var x = (SCREEN_W - w) / 2;
        var y = (SCREEN_H - h) / 1.5;

        ctx.fillStyle = 'white';
        ctx.fillRect(x, y, w, h);

        ctx.fillStyle = 'black';
        ctx.textAlign = 'left';
        ctx.verticalAlign = 'top';
        ctx.fillText(text, x + padding, y + padding);
    }
}

var movingLeft,
    movingRight,
    timeOfDeath;

function update() {
    if (movingLeft || movingRight) {
        paddle.move(movingLeft ? -1 : 1);
    }

    if (state === State.RUNNING) {
        [boundary, bricks, paddle].forEach(function (o) {
            o.applyCollisions(ball);
        });
        ball.update();
        if (ball.outOfBounds()) {
            state = (--lives === 0) ? State.FINISHED : State.REINSERT;
            scoreboard.invalidate();
            timeOfDeath = new Date();
        }
    } else if (state === State.REINSERT) {
        if (new Date() - timeOfDeath >= Ball.REINSERT_DELAY) {
            ball = new Ball();
            state = State.RUNNING;
        }
    }
}

var UPDATE_HZ = 20,
    UPDATE_DELAY = 1000 / UPDATE_HZ,
    timer,
    nextLoopTime,
    ctx;

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
    lives = 3;
    state = State.RUNNING;
    paused = false;

    bricks = new Stack();
    paddle = new Paddle();
    ball = new Ball();

    invalidateScreen();

    nextLoopTime = +new Date();
    timer = window.setTimeout(loop, UPDATE_DELAY);
}

function togglePause() {
    paused = !paused;
    if (!paused) {
        invalidateScreen();
    }
}

$(function () {
    var canvas = $('canvas').get(0);

    ctx = canvas.getContext('2d');
    ctx.font = 'bold ' + TEXT_HEIGHT + 'px Helvetica, Arial, sans-serif';

    function charCode(c) {
        return c.charCodeAt(0);
    }

    var keys = {
        moveLeft:    37, // left arrow
        moveRight:   39, // right arrow
        togglePause: charCode('P'),
        newGame:     charCode('N')
    };

    // reverse-lookup
    var keycodes = {};
    for (var k in keys) {
        if (keys.hasOwnProperty(k)) {
            keycodes[keys[k]] = k;
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
        case keys.moveLeft:
            movingLeft = true;
            break;
        case keys.moveRight:
            movingRight = true;
            break;
        case keys.togglePause:
            togglePause();
            break;
        case keys.newGame:
            newGame();
            break;
        default:
            throw new Error('unhandled: ' + keycodes[k]);
        }
    });

    $(window).keyup(function (e) {
        var k = getKeyCode(e);

        switch (k) {
        case keys.moveLeft:
            movingLeft = false;
            break;
        case keys.moveRight:
            movingRight = false;
            break;
        default:
            // ignore
        }
    });

    newGame();
});

