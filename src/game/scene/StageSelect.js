'use strict';

Game.scenes.StageSelect = class StageSelect extends Game.Scene
{
    constructor()
    {
        super();

        this.EVENT_STAGE_ENTER = 'stage-enter';
        this.EVENT_STAGE_SELECTED = 'stage-selected';
        this.EVENT_SELECTION_CHANGED = 'selection-changed';

        this.animations = {};
        this.world.camera.camera.position.z = 120;
        this.cameraDesiredPosition = new THREE.Vector3();
        this.cameraDistance = 140;
        this.cameraSmoothing = 20;
        this.captionOffset = new THREE.Vector3(0, -32, .2);
        this.currentIndex = undefined;
        this.stages = [];
        this.rowLength = 3;
        this.spacing = new THREE.Vector2(64, 64);

        this.background = new THREE.Mesh(
            new THREE.PlaneGeometry(500, 500),
            new THREE.MeshLambertMaterial());
        this.world.scene.add(this.background);

        const input = this.input;
        input.disable();
        input.hit(input.LEFT, () => {
            this.steer(-1, 0);
        });
        input.hit(input.RIGHT, () => {
            this.steer(1, 0);
        });
        input.hit(input.UP, () => {
            this.steer(0, -1);
        });
        input.hit(input.DOWN, () => {
            this.steer(0, 1);
        });
        input.hit(input.START, () => {
            this.enter();
        });

        const simulate = (dt) => {
            this.update(dt);
        };

        this.modifiers = new Set();

        this.events.bind(this.EVENT_CREATE, (game) => {
            this.modifiers.clear();
            this.animations = {
                'camera': this.createCameraAnimation(),
                'flash': this.createFlashAnimation(),
                'indicator': this.createIndicatorAnimation(),
            };
            if (game.state) {

            }
        });
        this.events.bind(this.EVENT_START, (game) => {
            this.timer.events.bind(this.timer.EVENT_SIMULATE, simulate);
            this.modifiers.add(this.animations.camera);
            this.enableIndicator();
            this.input.enable();
        });
        this.events.bind(this.EVENT_DESTROY, (game) => {
            this.timer.events.unbind(this.timer.EVENT_SIMULATE, simulate);
        });
    }
    addStage(avatar, caption, name)
    {
        const x = this.stages.length % this.rowLength;
        const y = Math.floor(this.stages.length / this.rowLength);

        const pos = new THREE.Vector2(this.spacing.x * x, -this.spacing.y * y);
        const frame = this.frame.clone();

        this.stages.push({
            "avatar": avatar,
            "name": name,
            "caption": caption,
            "frame": frame,
        });

        frame.position.set(pos.x, pos.y, 0);
        avatar.position.set(pos.x, pos.y, .1);
        caption.position.copy(avatar.position);
        caption.position.add(this.captionOffset);
        this.world.scene.add(frame);
        this.world.scene.add(avatar);
        this.world.scene.add(caption);
    }
    createCameraAnimation(dt)
    {
        const camera = this.world.camera.camera;
        const pos = this.cameraDesiredPosition;
        return (dt) => {
            if (camera.position.distanceToSquared(pos) > 1) {
                const intermediate = pos.clone()
                    .sub(camera.position)
                    .multiplyScalar(dt * 3);
                camera.position.add(intermediate);
            }
        };
    }
    createFlashAnimation()
    {
        const backgroundColor = this.background.material.ambient;
        const defaultBackgroundColor = backgroundColor.clone();
        const light = this.world.ambientLight.color;
        const defaultLight = light.clone();

        const interval = (3/60) * 2;
        let time = 0;
        let state = false;

        const on = () => {
            backgroundColor.setRGB(1,1,1);
            light.setRGB(5,5,5);
            state = true;
        };
        const off = () => {
            backgroundColor.copy(defaultBackgroundColor);
            light.copy(defaultLight);
            state = false;
        };

        return (dt) => {
            if (dt === -1) {
                time = 0;
                off();
            } else {
                time += dt;
                const prog = (time % interval) / interval;
                if (state === true && prog < .5) {
                    off();
                } else if (state === false && prog > .5) {
                    on();
                }
            }
        }
    }
    createIndicatorAnimation()
    {
        const interval = (this.indicatorInterval) * 2;
        const indicator = this.indicator;
        let time = 0;
        return (dt) => {
            if (dt === -1) {
                time = 0;
                indicator.visible = false;
            } else {
                time += dt;
            }
            indicator.visible = (time % interval) / interval < .5;
        }
    }
    equalize(index)
    {
        if (!this.stages[index]) {
            index = 0;
        }

        const center = new THREE.Vector3();
        center.x = this.stages[0].avatar.position.x
                 + this.stages[this.rowLength - 1].avatar.position.x;
        center.x /= 2;

        center.y = this.stages[0].avatar.position.y
                 + this.stages[this.stages.length - 1].avatar.position.y;
        center.y /= 2;
        center.y -= 8; // Adjust for caption.

        this.cameraDesiredPosition.copy(center);
        this.cameraDesiredPosition.z += this.cameraDistance;
        this.world.camera.position.copy(center);
        this.world.camera.position.z = this.cameraDesiredPosition.z - 100;

        this.selectIndex(index);
        this.background.position.copy(center);
        this.background.position.z -= 10;
    }
    enter()
    {
        this.input.release();
        this.input.disable();
        this.disableIndicator();
        this.events.trigger(this.EVENT_STAGE_SELECTED);
        const args = [this.stages[this.currentIndex], this.currentIndex];
        this.modifiers.add(this.animations.flash);
        this.waitFor(1.0)
            .then(() => {
                this.modifiers.delete(this.animations.flash);
                this.animations.flash(-1);
                this.events.trigger(this.EVENT_STAGE_ENTER, args);
            });
    }
    selectIndex(index)
    {
        if (!this.stages[index]) {
            return false;
        }
        const avatar = this.stages[index].avatar;
        this.indicator.position.x = avatar.position.x;
        this.indicator.position.y = avatar.position.y;
        this.animations.indicator(-1);

        this.currentIndex = index;

        return this.currentIndex;
    }
    setBackgroundColor(hexcolor)
    {
        this.background.material.ambient.setHex(hexcolor);
    }
    setFrame(model)
    {
        this.frame = model;
    }
    disableIndicator()
    {
        this.animations.indicator(-1);
        this.modifiers.delete(this.animations.indicator);
    }
    enableIndicator()
    {
        this.modifiers.add(this.animations.indicator);
    }
    setIndicator(model)
    {
        this.indicator = model;
        this.indicator.position.z = .1;
        this.world.scene.add(model);
    }
    steer(x, y)
    {
        let newIndex = this.currentIndex;
        let d = (this.currentIndex % this.rowLength) + x;
        if (d >= 0 && d < this.rowLength) {
            newIndex += x;
        }
        d = newIndex + y * this.rowLength;
        if (d >= 0 && d < this.stages.length) {
            newIndex = d;
        }

        if (newIndex === this.currentIndex) {
            return;
        }

        this.selectIndex(newIndex);

        this.events.trigger(this.EVENT_SELECTION_CHANGED, [this.currentIndex]);
    }
    update(dt)
    {
        this.modifiers.forEach(mod => {
            mod(dt);
        });
    }
}
