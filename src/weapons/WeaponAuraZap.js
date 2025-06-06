import GameManager from "../things/GameManager.js";
import WeaponBase from "./_weaponbase.js";
import AuraSprite from "./auraSprite.js";
import DarkOrbProjectile from "./darkOrbProjectile.js";
import ZapSprite from "./zapSprite.js";

export default class AuraZap extends WeaponBase {
    constructor(scene, player) {
        super(scene, player, 1);
        this.maxTargets = 1;
        this.baseZapCd = 5000;
        this.upA = 0;
        this.upB = 0;

        this.upgradeCosts = { A1: 1000, A2: 500, B1: 2000, B2: 1000, };

        this.auraSprite = new AuraSprite(scene, player.x, player.y, GameManager.power.auraLevel);

        this.zapTimer = this.scene.time.addEvent({
            delay: 5000,
            callback: () => {
                this.fire();
            },
            loop: true,
        });

        this.setStats();
    }

    update(delta) {
        super.update(delta);
        this.auraSprite.setPosition(this.player.x, this.player.y);
    }

    getCost() {
        const level = GameManager.power.auraLevel
        return (level ** 3) + (level * 50);
    }

    tryIncreaseAura() {
        const level = GameManager.power.auraLevel;
        const cost = level ** 3 + level * 50;

        if (GameManager.power.money >= cost) {
            this.player.updateMoney(-cost);
            GameManager.power.auraLevel += 1;
            GameManager.power.spent += cost;
            GameManager.save();
            this.setStats();
            return true;
        } else return false;
    }

    damage() {
        console.log(this.baseDamage + this.upA + this.upB)
        return this.baseDamage + this.upA + this.upB;
    }

    setStats() {
        const power = GameManager.power;

        this.auraSprite.setAuraLevel(power.auraLevel);

        if (this.zapTimer.delay) {
            this.zapTimer.delay = this.baseZapCd / power.auraLevel;
        }

        if (power.auraUpgradeA) {
            switch (power.auraUpgradeA) {
                case 1:
                    this.maxTargets = 2;
                    break;
                case 2:
                    this.upA= 2;
                    break;
            }
        } else {
            this.maxTargets = 1;
            this.upA= 0;
        }

        if (power.auraUpgradeB) {
            switch (power.auraUpgradeB) {
                case 1:
                    this.spawnOrb = true;
                    break;
                case 2:
                    this.upB = 2;
                    break;
            }
        } else {
            this.spawnOrb = false;
            this.upB = 0;
        }

        this.player.network.socket.emit('playerLevel', power);
    }

    fire() {
        const groups = this.scene.attackableGroups;
        const range = Phaser.Math.Clamp(GameManager.power.auraLevel * 25, 250, 600);
        const playerPos = this.player.getCurrentPos();
        const validTargets = [];

        this.hitTargets = [];

        groups.forEach(({ zap, group, handler }) => {
            if (!zap) return;

            group.getChildren().forEach(target => {
                const targetPos = new Phaser.Math.Vector2(target.x, target.y);
                const distance = Phaser.Math.Distance.BetweenPoints(playerPos, targetPos);

                if (distance <= range) {
                    validTargets.push({
                        target,
                        distance,
                        handler,
                        pos: targetPos
                    });
                }
            });
        });

        // Sort by distance, ascending
        validTargets.sort((a, b) => a.distance - b.distance);

        // Hit up to this.maxTargets
        for (let i = 0; i < Math.min(validTargets.length, this.maxTargets); i++) {
            const { target, handler, pos } = validTargets[i];
            this[handler]?.(target);
            this.zapVisual(target.x, target.y, target);
            if (this.spawnOrb) {
                const orb = new DarkOrbProjectile(this.scene, target.x, target.y, this.player);
                this.scene.weaponGroup.add(orb);
                orb.setScale(.1);
                orb.detonate = true;
            }
        }
    }


    zapVisual(x, y, target) {
        this.zapLine = new ZapSprite(this.scene, x, y, this.player, target)

    }

    upgradeA(upgrade) {
        const { A1, A2 } = this.upgradeCosts
        switch (upgrade) {
            case 1:
                if (GameManager.power.money > A1) {
                    this.player.updateMoney(-A1)
                    GameManager.power.spent += A1;
                    GameManager.power.auraUpgradeA = 1;
                    GameManager.save();

                    this.maxTargets = 2;

                    return true;
                }
            case 2:
                if (GameManager.power.money > A2) {
                    this.player.updateMoney(-A2)
                    GameManager.power.spent += A2;
                    GameManager.power.auraUpgradeA = 2;
                    GameManager.save();

                    this.upA = 2;

                    return true;
                }
        }
        return false;
    }

    upgradeB(upgrade) {
        const { B1, B2 } = this.upgradeCosts
        switch (upgrade) {
            case 1:
                if (GameManager.power.money > B1) {
                    this.player.updateMoney(-B1)
                    GameManager.power.spent += B1;
                    GameManager.power.auraUpgradeB = 1;
                    GameManager.save();

                    this.spawnOrb = true;

                    return true;
                }
            case 2:
                if (GameManager.power.money > B2) {
                    this.player.updateMoney(-B2)
                    GameManager.power.spent += B2;
                    GameManager.power.auraUpgradeB = 2;
                    GameManager.save();

                    this.upB = 2

                    return true;
                }
        }
        return false;
    }

    resetUpgrades() {
        GameManager.power.auraLevel = 1;
        GameManager.power.auraUpgradeA = 0;
        GameManager.power.auraUpgradeB = 0;
        this.setStats();
    }
}