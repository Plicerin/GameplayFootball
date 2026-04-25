console.log('main.js start');
class MainScene extends Phaser.Scene {
  constructor() {
    super({ key: 'MainScene' });
  }

  preload() {}

  create() {
    console.log('MainScene.create start');
    const W = 800, H = 600;
    this.cameras.main.setBackgroundColor('#0b3d91');

    const field = this.add.graphics();
    field.fillStyle(0x137a3a, 1);
    field.fillRect(0, 0, W, H);
    field.lineStyle(4, 0xffffff, 0.85);
    field.strokeRect(24, 24, W - 48, H - 48);
    field.lineBetween(W / 2, 24, W / 2, H - 24);
    field.strokeCircle(W / 2, H / 2, 72);
    field.setDepth(-10);

    // Create simple textures (circles/rectangles) as sprites
    const g = this.add.graphics();
    g.fillStyle(0xffffff, 1);
    g.fillRect(0, 0, 32, 48);
    g.generateTexture('player', 32, 48);
    g.clear();

    g.fillStyle(0xffcc00, 1);
    g.fillCircle(8, 8, 8);
    g.generateTexture('ball', 16, 16);
    g.destroy();

    // Physics world bounds
    this.physics.world.setBounds(0, 0, W, H);

    // Spawner: programmatically create player, AI, and ball
    this.spawnConfig = {
      playerPos: { x: 200, y: 300 },
      aiPos: { x: 600, y: 300 },
      ballPos: { x: 400, y: 300 },
    };

    this.createPlayer(this.spawnConfig.playerPos.x, this.spawnConfig.playerPos.y);
    this.createAI(this.spawnConfig.aiPos.x, this.spawnConfig.aiPos.y);
    this.createBall(this.spawnConfig.ballPos.x, this.spawnConfig.ballPos.y);

    // Collisions
    this.physics.add.collider(this.player, this.ball, this.onPlayerBallCollision, null, this);
    this.physics.add.collider(this.ai, this.ball, this.onAIBallCollision, null, this);
    this.physics.add.collider(this.player, this.ai);

    // Input
    this.cursors = this.input.keyboard.createCursorKeys();
    console.log('MainScene.create done');
  }

  createPlayer(x, y) {
    this.player = this.physics.add.sprite(x, y, 'player');
    this.player.setBounce(0.2);
    this.player.setCollideWorldBounds(true);
    this.player.speed = 180;
  }

  createAI(x, y) {
    this.ai = this.physics.add.sprite(x, y, 'player');
    this.ai.setTint(0xff6666);
    this.ai.setBounce(0.2);
    this.ai.setCollideWorldBounds(true);
    this.ai.speed = 140;
  }

  createBall(x, y) {
    this.ball = this.physics.add.sprite(x, y, 'ball');
    this.ball.setBounce(0.9);
    this.ball.setCollideWorldBounds(true);
    this.ball.setVelocity(0, 0);
  }

  onPlayerBallCollision(player, ball) {
    // Kick: push ball in player's facing direction (use velocity)
    const vx = (ball.x - player.x) * 3;
    const vy = (ball.y - player.y) * 3;
    ball.setVelocity(vx, vy);
  }

  onAIBallCollision(ai, ball) {
    const vx = (ball.x - ai.x) * 2.5;
    const vy = (ball.y - ai.y) * 2.5;
    ball.setVelocity(vx, vy);
  }

  update(time, dt) {
    // Player controls (arrow keys)
    const p = this.player;
    p.setVelocity(0);
    if (this.cursors.left.isDown) p.setVelocityX(-p.speed);
    if (this.cursors.right.isDown) p.setVelocityX(p.speed);
    if (this.cursors.up.isDown) p.setVelocityY(-p.speed);
    if (this.cursors.down.isDown) p.setVelocityY(p.speed);

    // AI: simple chase-the-ball with slight damping
    const a = this.ai;
    const dx = this.ball.x - a.x;
    const dy = this.ball.y - a.y;
    const dist = Math.hypot(dx, dy) || 1;
    const nx = dx / dist;
    const ny = dy / dist;
    a.setVelocity(nx * a.speed, ny * a.speed);
  }
}

const config = {
  type: Phaser.CANVAS,
  width: 800,
  height: 600,
  parent: 'game-root',
  physics: {
    default: 'arcade',
    arcade: { gravity: { y: 0 }, debug: false }
  },
  scene: [MainScene]
};

function startGame() {
  if (window.__pf_game) return;

  try{
    console.log('creating Phaser.Game', typeof Phaser !== 'undefined');
    const game = new Phaser.Game(config);
    window.__pf_game = game;
    console.log('Phaser.Game created');
  }catch(e){
    console.error('Failed to create Phaser.Game', e);
    showPFError && showPFError('Failed to create Phaser.Game: ' + (e && e.stack ? e.stack : e));
  }
}

if (document.readyState === 'loading') {
  window.addEventListener('DOMContentLoaded', startGame, { once: true });
} else {
  startGame();
}
