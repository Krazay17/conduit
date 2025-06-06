import Player from '../things/Player.js';
import NetworkManager from '../things/NetworkManager.js';
import GameManager from '../things/GameManager.js';
import SpawnManager from '../things/_spawnmanager.js';
import WeaponGroup from '../weapons/WeaponGroup.js';
import GhostPlayer from '../things/GhostPlayer.js';

export default class BaseGame extends Phaser.Scene {
  constructor(key) {
    super(key);

    this.key = key;

  }

  preload() {
    this.loadingBar();
  }

  update(time, delta) {
    if (this.player) this.player.handleInput(delta);

    if (this.network) {
      this.network.socket.emit('playerMove', {
        x: this.player.x,
        y: this.player.y
      });
    }
  }

  setupWorld(xleft = -1600, ytop = 0, width = 3200, height = 900) {
    this.physics.world.setBounds(xleft, ytop, width, height);
    this.bounds = this.physics.world.bounds;
    this.cameras.main.setBounds(xleft, ytop, width, height);
    this.spawnManager = new SpawnManager(this)
    this.sound.pauseOnBlur = false;

    this.input.on('wheel', (wheel) => {
      if (!this.zoom) this.zoom = 1;
      // Step 1: Adjust zoom
this.zoom -= wheel.deltaY / 1000;

// Step 2: Clamp
this.zoom = Phaser.Math.Clamp(this.zoom, 0.6, 3);

// Step 3: Snap to nearest 0.2
this.zoom = Phaser.Math.Snap.To(this.zoom, 0.1);


      this.sky1.setScale(1 / this.zoom);
      this.cameras.main.setZoom(this.zoom)
      //this.resizeBackgroundToFill();
    })

    // window.addEventListener('focus', () => {
    //   this.sound.mute = false;
    // });

    // window.addEventListener('blur', () => {
    //   this.sound.mute = true;
    // });

    this.network = new NetworkManager(this);

    // Object.values(this.network.otherPlayers).forEach(([id, oldGhost]) => {
    //   //ghost.updateScene(this);
    //   //console.log(ghost)
    //   // Recreate with current scene
    //   const {x, y, data} = oldGhost.getMyData();
    //   oldGhost.destroy();

    //   this.network.otherPlayers[id] = new GhostPlayer(this, id, x, y, data);
    // });
    this.network.refreshScene(this);
  }

  setupSky(a = 'purplesky0', ao = { x: this.scale.width /2 , y: this.scale.height / 2 }, b = 'purplesky1', bo = { x: 800, y: 600 }, c = 'purplesky2', co = { x: 600, y: 500 }) {
    this.sky1 = this.add.image(ao.x, ao.y, a).setOrigin(.5)
      .setDisplaySize(this.scale.width, this.scale.height).setScrollFactor(0);
    this.sky2 = this.add.image(bo.x, bo.y, b).setScale(1).setScrollFactor(.2);
    this.sky3 = this.add.image(co.x, co.y, c).setScale(1).setScrollFactor(.6);
    this.scale.on('resize', this.resizeSky, this);
  }

  setupPlayer(x = 0, y = 0) {
    this.player = new Player(this, x, y);
    this.cameras.main.startFollow(this.player, false, .025, .025);


    if (!this.scene.isActive('Inventory')) {
      this.scene.launch('Inventory', { player: this.player });
      this.invMenu = this.scene.get('Inventory');
    } else {
      this.invMenu = this.scene.get('Inventory');
      this.invMenu.init({ player: this.player });
    }


    this.input.keyboard.on('keydown-C', () => {
      this.invMenu.scene.setVisible(true);
      this.invMenu.scene.setActive(true);
      this.invMenu.input.enabled = true;
    });
    this.input.keyboard.on('keyup-C', () => {
      this.invMenu.scene.setVisible(false);
      this.invMenu.input.enabled = false;
      this.invMenu.scene.setActive(false);
    });

    if (!this.scene.isActive('PlayerUI')) {
      this.scene.launch('PlayerUI', { player: this.player, gameScene: this });
      this.playerUI = this.scene.get('PlayerUI');
    } else {
      this.playerUI = this.scene.get('PlayerUI');
      this.playerUI.init({ player: this.player, gameScene: this });
    }
    if (!this.scene.isActive('EscMenu')) {
      this.scene.launch('EscMenu', { gameScene: this, playerUI: this.playerUI });
      this.escMenu = this.scene.get('EscMenu');
    } else {
      this.escMenu = this.scene.get('EscMenu');
      this.escMenu.init({ gameScene: this, playerUI: this.playerUI })
    }
  }


  setupTileMap(tilemap = 'tilemap1', tilesheet = 'tilesheet') {
    const map = this.make.tilemap({ key: tilemap });
    const tileset = map.addTilesetImage(tilesheet, tilesheet);
    const layer1 = map.createLayer('layer1', tileset, 0, 0);
    const layer2 = map.createLayer('layer2', tileset, 0, 0);
    this.walls = map.createLayer('walls', tileset, 0, 0);
    const walls2 = map.createLayer('walls2', tileset, 0, 0);

    this.walls.setCollisionByExclusion([-1]); // excludes only empty tiles
    walls2.setCollisionByExclusion([-1]); // excludes only empty tiles
    this.tilemapColliders = [
      { walls: this.walls, handler: 'TouchPlatform' },
      { walls: walls2, handler: 'touchFireWall' },
    ];

    const objects = map.getObjectLayer('objects');
    objects.objects.forEach(obj => {
      this[obj.name]?.(obj.x, obj.y, obj.text?.text);
    });
  }

  setupGroups() {
    this.weaponGroup = new WeaponGroup(this, this.player);

    this.attackableGroups = [
      { group: this.walkableGroup = this.physics.add.group({ allowGravity: false, immovable: true }), handler: 'platformHit', zap: false },
      { group: this.enemyGroup = this.physics.add.group(), handler: 'enemyHit', zap: true },
      // { group: this.flyingEnemyGroup = this.physics.add.group({ allowGravity: false }), handler: 'enemyHit' },
      { group: this.softEnemyGroup = this.physics.add.group(), handler: 'enemyHit', zap: true },
      { group: this.staticEnemyGroup = this.physics.add.group({ allowGravity: false, immovable: true }), handler: 'enemyHit', zap: true },
      { group: this.bulletGroup = this.physics.add.group({ allowGravity: false }), handler: 'bulletHit', zap: true },
      { group: this.softBulletGroup = this.physics.add.group({ allowGravity: false }), handler: 'bulletHit', zap: true },
      { group: this.itemGroup = this.physics.add.group(), handler: 'itemHit', zap: false },
      { group: this.staticItemGroup = this.physics.add.group({ allowGravity: false, immovable: true }), handler: 'itemHit', zap: false }
    ];
  }

  setupCollisions() {
    this.attackableGroups.forEach(({ group, handler }) =>
      this.physics.add.overlap(
        this.weaponGroup,
        group,
        (weapon, target) => weapon[handler]?.(target),
        null,
        this
      ));

    // Explicitly add wall collisions
    if (this.tilemapColliders?.length) {
      this.tilemapColliders.forEach(({ walls, handler }) => {
        this.physics.add.collider(this.weaponGroup, walls, (weapon, wall) => {
          weapon[handler]?.(wall);
        }, null, this);
        this.physics.add.collider(this.player, walls, (player, wall) => {
          player[handler]?.(wall);
        }, null, this);
        this.physics.add.collider(this.enemyGroup, walls);
        this.physics.add.collider(this.itemGroup, walls);
      });
    }

    this.walkableCollider = this.physics.add.collider(this.player, this.walkableGroup, (player, walkable) => {
      player.TouchPlatform(walkable);
    }, null, this);

    this.physics.add.collider(this.player, this.staticEnemyGroup, (player, walkable) => {
      player.TouchPlatform(walkable);
    }, null, this);

    this.physics.add.overlap(this.player, this.enemyGroup, (player, enemy) => {
      enemy.playerCollide(player, enemy);
    }, null, this);

    this.physics.add.overlap(this.player, this.flyingEnemyGroup, (player, enemy) => {
      enemy.playerCollide(player, enemy);
    }, null, this);


    this.physics.add.overlap(this.player, this.softBulletGroup, (player, bullet) => {
      bullet.playerHit(player, bullet);
    }, null, this);

    this.physics.add.overlap(this.player, this.softEnemyGroup, (player, enemy) => {
      enemy.playerCollide(player, enemy);
    }, null, this);

    this.physics.add.overlap(this.player, this.itemGroup, (player, pickup) => {
      pickup.pickup?.(player, pickup);
    }, null, this);

    this.physics.add.collider(this.player, this.staticItemGroup, (player, walkable) => {
      player.TouchPlatform(walkable);
    }, null, this);

    this.physics.add.collider(this.weaponGroup, this.staticItemGroup);
    this.physics.add.collider(this.weaponGroup, this.walkableGroup);
    this.physics.add.collider(this.itemGroup, this.walkableGroup);
    this.physics.add.collider(this.enemyGroup, this.walkableGroup);
    this.physics.add.collider(this.enemyGroup, this.enemyGroup);
    this.physics.add.collider(this.softEnemyGroup, this.softEnemyGroup, (enemy1, enemy2) => {
    }, null, this);
  }

  setupMusic(key = 'music1', volume = 1) {
    // If music is already playing and it's the same track, do nothing
    // Use globalThis to store music reference

    if (!globalThis.currentMusic || globalThis.currentMusic.key !== key) {

      // Stop current music
      if (globalThis.currentMusic && globalThis.currentMusic.isPlaying) {
        globalThis.currentMusic.stop();
      }

      // Start new track
      globalThis.currentMusic = this.sound.add(key, { loop: true });
      globalThis.currentMusic.volume = GameManager.volume.music ?? 1;
      globalThis.currentMusic.play();
    }
  }


  setupPlatforms(platformPos = [[0, 800]]) {
    platformPos.forEach(pos => this.walkableGroup.create(pos[0], pos[1], 'platform'));
  }

  setupQuick(x = 0, y = 0) {
    this.setupSky();
    this.setupSave();
    this.setupWorld();
    this.setupPlayer(x, y);
    this.setupGroups();
    this.setupCollisions();
    this.setupMusic();
  }

  shrinkCollision(object, x, y) {
    object.body.setSize(x, y); // Smaller than sprite size
    object.body.setOffset(
      (object.width - x) / 2,
      (object.height - y) / 2
    );
  }

  setupSave() {
    GameManager.area = this.key;
    GameManager.save();
  }

  loadingBar() {
    // Create a progress bar background
    const { width, height } = this.cameras.main;
    const barWidth = 300;
    const barHeight = 30;
    const barX = (width - barWidth) / 2;
    const barY = (height - barHeight) / 2;

    const progressBarBg = this.add.graphics();
    progressBarBg.fillStyle(0x222222, 1);
    progressBarBg.fillRect(barX, barY, barWidth, barHeight);

    const progressBar = this.add.graphics();

    // Optional: Add text
    const loadingText = this.add.text(width / 2, barY - 40, 'Loading...', {
      fontSize: '20px',
      fill: '#ffffff'
    }).setOrigin(0.5);

    // Listen to loading progress
    this.load.on('progress', (value) => {
      progressBar.clear();
      progressBar.fillStyle(0xffffff, 1);
      progressBar.fillRect(barX, barY, barWidth * value, barHeight);
      if (value === 1) {
        loadingText.destroy();
        progressBar.clear();
      }
    });
  }

  resizeSky(gameSize) {
    const width = gameSize.width;
    const height = gameSize.height;
    this.sky1.setPosition(width /2 , height / 2);
  }

  spawnSunman(x, y) {
    this.spawnManager.spawnSunMans(x, y, 10)
  }

  spawnBullets(x, y, text) {
    const delay = parseInt(text, 10);

    this.time.addEvent({
      delay: delay,
      loop: true,
      callback: () => {
        this.spawnManager.spawnBullet(x, y);
      }
    })

    // if (!this.bulletSpawnLocs) {
    //   this.bulletSpawnLocs = [];

    //   this.time.addEvent({
    //     delay: delay,
    //     loop: true,
    //     callback: () => {
    //       this.bulletSpawnLocs.forEach(([x, y]) => {
    //         this.spawnManager.spawnBullet(x, y);
    //         console.log('fire')

    //       })
    //     }
    //   })
    // }
    // this.bulletSpawnLocs.push([x, y])
  }

  spawnDuck(x, y) {
    const duck = this.spawnManager.spawnDuck(x, y, 20, .25);
    duck.on('die', () => {
      const deathSpawn = () => this.time.delayedCall(25000, () => {
        const dx = this.player.x - x;
        const dy = this.player.y - y;
        const distance = Math.sqrt(dx * dx - dy * dy);
        if (distance > 800) {
          this.spawnDuck(x, y);
        } else {
          deathSpawn();
        }
      })
      deathSpawn();
    })
  }

  spawnCoin(x, y) {
    const coin = this.spawnManager.SpawnCoin(x, y);
    coin.on('pickup', () => {
      this.time.delayedCall(25000, () => {
        this.spawnCoin(x, y);
      })
    })
  }
}